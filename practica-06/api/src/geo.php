<?php
declare(strict_types=1);

function geoHttpJson(string $url): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('La extensión cURL de PHP no está habilitada.');
    }
    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 24,
        CURLOPT_USERAGENT => 'BioCultivo-Practica06/1.0 (educational geospatial viewer)',
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
    ]);
    $body = curl_exec($handle);
    $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($handle);
    curl_close($handle);
    if ($body === false || $status < 200 || $status >= 300) {
        throw new RuntimeException($curlError ?: "El proveedor respondió HTTP {$status}.");
    }
    $decoded = json_decode($body, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('El proveedor devolvió JSON no válido.');
    }
    return $decoded;
}

function geoCached(string $provider, array $params, int $ttl, callable $loader): array
{
    $key = hash('sha256', $provider . ':' . json_encode($params, JSON_THROW_ON_ERROR));
    $pdo = db();
    $readCache = static function () use ($pdo, $key): ?array {
        $query = $pdo->prepare('SELECT respuesta FROM geo_cache WHERE cache_key = ? AND expira_en > NOW()');
        $query->execute([$key]);
        $cached = $query->fetchColumn();
        if ($cached === false) return null;
        $decoded = json_decode((string)$cached, true);
        return is_array($decoded) ? $decoded : null;
    };
    $cached = $readCache();
    if ($cached !== null) return $cached;

    $providerIntervals = ['soilgrids' => 12, 'nominatim' => 1];
    $providerLock = false;
    $lockName = 'practica06-' . $provider;
    if (isset($providerIntervals[$provider])) {
        $lock = $pdo->prepare('SELECT GET_LOCK(?, 25)');
        $lock->execute([$lockName]);
        $providerLock = (int)$lock->fetchColumn() === 1;
        if (!$providerLock) throw new RuntimeException("{$provider} está ocupado; intenta de nuevo en unos segundos.");
        $cached = $readCache();
        if ($cached !== null) {
            $release = $pdo->prepare('SELECT RELEASE_LOCK(?)');
            $release->execute([$lockName]);
            return $cached;
        }
        $lastCall = $pdo->prepare('SELECT TIMESTAMPDIFF(MICROSECOND, ultima_consulta, NOW()) / 1000000 FROM geo_provider_limits WHERE proveedor = ?');
        $lastCall->execute([$provider]);
        $elapsed = $lastCall->fetchColumn();
        $minimumInterval = $providerIntervals[$provider];
        if ($elapsed !== false && $elapsed !== null && (float)$elapsed < $minimumInterval) {
            usleep((int)ceil(($minimumInterval - (float)$elapsed) * 1000000));
        }
        $markCall = $pdo->prepare('INSERT INTO geo_provider_limits (proveedor, ultima_consulta) VALUES (?, NOW())
            ON DUPLICATE KEY UPDATE ultima_consulta = NOW()');
        $markCall->execute([$provider]);
    }
    try {
        $response = $loader();
    } finally {
        if ($providerLock) {
            $release = $pdo->prepare('SELECT RELEASE_LOCK(?)');
            $release->execute([$lockName]);
        }
    }
    $insert = $pdo->prepare('INSERT INTO geo_cache (cache_key, proveedor, respuesta, expira_en)
        VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
        ON DUPLICATE KEY UPDATE proveedor = VALUES(proveedor), respuesta = VALUES(respuesta),
        consultado_en = NOW(), expira_en = VALUES(expira_en)');
    $insert->execute([$key, $provider, json_encode($response, JSON_THROW_ON_ERROR), $ttl]);
    return $response;
}

function geoProvider(callable $callback, array &$errors, string $name): ?array
{
    try {
        return $callback();
    } catch (Throwable $error) {
        $errors[$name] = $error->getMessage();
        return null;
    }
}

function geoSoilMedian(array $response, string $name): ?float
{
    foreach (($response['properties']['layers'] ?? []) as $layer) {
        if (($layer['name'] ?? '') !== $name) continue;
        $depths = $layer['depths'] ?? [];
        foreach ($depths as $depth) {
            if (($depth['label'] ?? '') !== '0-5cm') continue;
            $value = $depth['values']['Q0.5'] ?? $depth['values']['mean'] ?? null;
            $factor = (float)($layer['unit_measure']['d_factor'] ?? 1);
            if (!is_numeric($value) || (float)$value < 0 || $factor <= 0) return null;
            return (float)$value / $factor;
        }
    }
    return null;
}

Flight::route('GET /api/geo/site', function () {
    try {
        $lat = filter_var($_GET['lat'] ?? null, FILTER_VALIDATE_FLOAT);
        $lon = filter_var($_GET['lon'] ?? null, FILTER_VALIDATE_FLOAT);
        $speciesId = max(0, (int)($_GET['speciesId'] ?? 0));
        if ($lat === false || $lon === false || $lat < -90 || $lat > 90 || $lon < -180 || $lon > 180) {
            Flight::json(['error' => 'Indica latitud entre -90 y 90 y longitud entre -180 y 180.'], 422);
            return;
        }
        $lat = round((float)$lat, 3);
        $lon = round((float)$lon, 3);
        $errors = [];
        $coords = ['lat' => $lat, 'lon' => $lon];

        $geocode = geoProvider(function () use ($lat, $lon) {
            $params = http_build_query(['format' => 'jsonv2', 'lat' => $lat, 'lon' => $lon, 'zoom' => 10, 'addressdetails' => 1, 'accept-language' => 'es']);
            return geoCached('nominatim', [$lat, $lon, 'reverse-es-zoom10'], 2592000,
                fn() => geoHttpJson('https://nominatim.openstreetmap.org/reverse?' . $params));
        }, $errors, 'openStreetMap');

        $weather = geoProvider(function () use ($lat, $lon) {
            $params = http_build_query([
                'latitude' => $lat, 'longitude' => $lon,
                'current' => 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m',
                'daily' => 'temperature_2m_mean,precipitation_sum,shortwave_radiation_sum,wind_speed_10m_max',
                'past_days' => 7, 'forecast_days' => 1, 'timezone' => 'auto',
            ]);
            return geoCached('open-meteo', [$lat, $lon, 'current-daily-v1'], 3600,
                fn() => geoHttpJson('https://api.open-meteo.com/v1/forecast?' . $params));
        }, $errors, 'openMeteo');

        $today = new DateTimeImmutable('today', new DateTimeZone('UTC'));
        $end = $today->modify('-5 days');
        $start = $end->modify('-364 days');
        $power = geoProvider(function () use ($lat, $lon, $start, $end) {
            $params = http_build_query([
                'parameters' => 'T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN', 'community' => 'AG',
                'longitude' => $lon, 'latitude' => $lat,
                'start' => $start->format('Ymd'), 'end' => $end->format('Ymd'), 'format' => 'JSON',
            ]);
            return geoCached('nasa-power', [$lat, $lon, $start->format('Ymd'), $end->format('Ymd')], 2592000,
                fn() => geoHttpJson('https://power.larc.nasa.gov/api/temporal/daily/point?' . $params));
        }, $errors, 'nasaPower');

        $soil = geoProvider(function () use ($lat, $lon) {
            $base = 'https://rest.isric.org/soilgrids/v2.0/properties/query?' . http_build_query(['lon' => $lon, 'lat' => $lat]);
            $url = $base . '&property=phh2o&property=clay&property=sand&property=soc&depth=0-5cm&value=Q0.5';
            return geoCached('soilgrids', [$lat, $lon, 'phh2o-clay-sand-soc-0-5cm-Q0.5'], 2592000,
                fn() => geoHttpJson($url));
        }, $errors, 'soilGrids');

        $species = null;
        if ($speciesId > 0) {
            $statement = db()->prepare('SELECT id, nombre_comun, nombre_cientifico, temperatura_min_c,
                temperatura_max_c, ph_min, ph_max, hidratacion_min_pct FROM especies WHERE id = ? AND activo = 1');
            $statement->execute([$speciesId]);
            $species = $statement->fetch() ?: null;
        }
        $gbif = null;
        if ($species) {
            $halfDegree = 0.5;
            $minLat = max(-89.9, $lat - $halfDegree); $maxLat = min(89.9, $lat + $halfDegree);
            $minLon = max(-179.9, $lon - $halfDegree); $maxLon = min(179.9, $lon + $halfDegree);
            $polygon = "POLYGON(({$minLon} {$minLat},{$maxLon} {$minLat},{$maxLon} {$maxLat},{$minLon} {$maxLat},{$minLon} {$minLat}))";
            $gbif = geoProvider(function () use ($species, $polygon, $lat, $lon) {
                $params = http_build_query(['scientificName' => $species['nombre_cientifico'], 'geometry' => $polygon, 'hasCoordinate' => 'true', 'limit' => 100]);
                return geoCached('gbif', [$species['nombre_cientifico'], $polygon], 86400,
                    fn() => geoHttpJson('https://api.gbif.org/v1/occurrence/search?' . $params));
            }, $errors, 'gbif');
        }

        $current = $weather['current'] ?? [];
        $daily = $weather['daily'] ?? [];
        $means = $power['properties']['parameter'] ?? [];
        $avg = static function (?array $values): ?float {
            if (!$values) return null;
            $valid = array_filter(array_map('floatval', $values), static fn($value) => $value > -900);
            return $valid ? array_sum($valid) / count($valid) : null;
        };
        $yearlyRain = isset($means['PRECTOTCORR']) ? array_sum(array_filter(array_map('floatval', $means['PRECTOTCORR']), static fn($v) => $v > -900)) : null;
        $ph = $soil ? geoSoilMedian($soil, 'phh2o') : null;
        $clay = $soil ? geoSoilMedian($soil, 'clay') : null;
        $sand = $soil ? geoSoilMedian($soil, 'sand') : null;
        $soc = $soil ? geoSoilMedian($soil, 'soc') : null;
        $annualMeanTemp = $avg(isset($means['T2M']) ? $means['T2M'] : null);
        $temperature = $annualMeanTemp ?? (isset($current['temperature_2m']) ? (float)$current['temperature_2m'] : null);
        $radiation = $avg(isset($means['ALLSKY_SFC_SW_DWN']) ? $means['ALLSKY_SFC_SW_DWN'] : null);
        $score = null;
        if ($species && $temperature !== null) {
            $tempMid = ((float)$species['temperatura_min_c'] + (float)$species['temperatura_max_c']) / 2;
            $tempRange = max(1, (float)$species['temperatura_max_c'] - (float)$species['temperatura_min_c']);
            $tempScore = max(0, 100 - abs($temperature - $tempMid) / $tempRange * 100);
            $soilScore = $ph === null ? 55 : max(0, 100 - max((float)$species['ph_min'] - $ph, $ph - (float)$species['ph_max'], 0) * 25);
            $rainScore = $yearlyRain === null ? 55 : min(100, max(0, $yearlyRain / 8));
            $score = round($tempScore * 0.4 + $soilScore * 0.35 + $rainScore * 0.25, 1);
        }
        $rules = [];
        if ($yearlyRain !== null && $yearlyRain < 400) $rules[] = ['priority' => 'critica', 'rule' => 'precipitacion_baja', 'threshold' => 400, 'value' => round($yearlyRain, 1), 'message' => 'Precipitación anual menor a 400 mm: riego suplementario necesario.'];
        if ($temperature !== null && $temperature > 35) $rules[] = ['priority' => 'critica', 'rule' => 'temperatura_alta', 'threshold' => 35, 'value' => round($temperature, 1), 'message' => 'Temperatura elevada: evaluar variedad tolerante al calor y riesgo de estrés térmico.'];
        if ($ph !== null && $ph < 5.5) $rules[] = ['priority' => 'aviso', 'rule' => 'suelo_acido', 'threshold' => 5.5, 'value' => round($ph, 2), 'message' => 'Suelo ácido: realizar análisis local y evaluar encalado antes de sembrar.'];
        if ($radiation !== null && $radiation > 25) $rules[] = ['priority' => 'aviso', 'rule' => 'radiacion_alta', 'threshold' => 25, 'value' => round($radiation, 2), 'message' => 'Radiación solar alta: valorar sombra parcial y monitorear estrés hídrico.'];
        if ($gbif && (int)($gbif['count'] ?? 0) === 0) $rules[] = ['priority' => 'aviso', 'rule' => 'sin_registros_gbif', 'threshold' => 1, 'value' => 0, 'message' => 'GBIF no reporta ocurrencias en el área consultada; esto no demuestra ausencia de la especie.'];

        $occurrences = [];
        foreach (($gbif['results'] ?? []) as $record) {
            if (isset($record['decimalLatitude'], $record['decimalLongitude'])) {
                $occurrences[] = ['lat' => (float)$record['decimalLatitude'], 'lon' => (float)$record['decimalLongitude'], 'name' => $record['scientificName'] ?? '', 'year' => $record['year'] ?? null, 'key' => $record['key'] ?? null];
            }
        }
        $address = $geocode['address'] ?? [];
        $locality = $address['city'] ?? $address['town'] ?? $address['village'] ?? $address['municipality'] ?? $address['county'] ?? null;
        $region = $address['state'] ?? $address['region'] ?? $address['state_district'] ?? null;
        $country = $address['country'] ?? null;
        $placeParts = array_values(array_unique(array_filter([$locality, $region, $country])));
        $place = $placeParts ? implode(', ', $placeParts) : sprintf('%.3f°, %.3f°', $lat, $lon);
        $payload = [
            'coordinates' => $coords, 'place' => $place,
            'location' => ['locality' => $locality, 'region' => $region, 'country' => $country,
                'countryCode' => $address['country_code'] ?? null, 'feature' => $geocode['type'] ?? null,
                'addressType' => $geocode['addresstype'] ?? null, 'elevationMeters' => $weather['elevation'] ?? null,
                'source' => $geocode ? 'OpenStreetMap / Nominatim' : null],
            'fetchedAt' => gmdate(DATE_ATOM),
            'weather' => ['current' => $current, 'daily' => $daily],
            'climate' => ['annualPrecipitationMm' => $yearlyRain === null ? null : round($yearlyRain, 1), 'annualMeanTempC' => $annualMeanTemp, 'solarRadiation' => $radiation === null ? null : round($radiation, 2), 'radiationUnit' => 'MJ/m²/día'],
            'soil' => ['ph' => $ph, 'clayPct' => $clay, 'sandPct' => $sand, 'organicCarbon' => $soc],
            'biodiversity' => ['count' => $gbif['count'] ?? null, 'occurrences' => $occurrences],
            'suitability' => $score, 'rules' => $rules, 'errors' => $errors,
            'sources' => ['weather' => 'Open-Meteo', 'climate' => 'NASA POWER', 'soil' => 'SoilGrids / ISRIC', 'biodiversity' => 'GBIF'],
        ];
        Flight::json($payload);
    } catch (Throwable $error) {
        apiError($error);
    }
});

Flight::route('GET /api/geo/occurrences', function () {
    try {
        $speciesId = max(0, (int)($_GET['speciesId'] ?? 0));
        if ($speciesId < 1) {
            Flight::json(['error' => 'Selecciona una especie del catálogo.'], 422);
            return;
        }
        $statement = db()->prepare('SELECT nombre_comun, nombre_cientifico FROM especies WHERE id = ? AND activo = 1');
        $statement->execute([$speciesId]);
        $species = $statement->fetch();
        if (!$species) {
            Flight::json(['error' => 'La especie seleccionada no existe.'], 404);
            return;
        }
        $response = geoCached('gbif-global', [$species['nombre_cientifico'], 100], 86400, function () use ($species) {
            $params = http_build_query([
                'scientificName' => $species['nombre_cientifico'],
                'hasCoordinate' => 'true', 'occurrenceStatus' => 'PRESENT',
                'limit' => 100, 'offset' => 0,
            ]);
            return geoHttpJson('https://api.gbif.org/v1/occurrence/search?' . $params);
        });
        $points = [];
        foreach (($response['results'] ?? []) as $record) {
            if (!isset($record['decimalLatitude'], $record['decimalLongitude'])) continue;
            $latitude = (float)$record['decimalLatitude'];
            $longitude = (float)$record['decimalLongitude'];
            if ($latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) continue;
            $points[] = [
                'lat' => $latitude, 'lon' => $longitude,
                'key' => $record['key'] ?? null, 'year' => $record['year'] ?? null,
                'locality' => $record['locality'] ?? null,
                'stateProvince' => $record['stateProvince'] ?? null,
                'country' => $record['country'] ?? $record['countryCode'] ?? null,
            ];
        }
        Flight::json([
            'species' => $species['nombre_comun'], 'scientificName' => $species['nombre_cientifico'],
            'count' => (int)($response['count'] ?? 0), 'points' => $points,
            'loaded' => count($points), 'limit' => 100,
        ]);
    } catch (Throwable $error) {
        error_log('GBIF global occurrence endpoint: ' . $error->getMessage());
        apiError($error);
    }
});

Flight::route('POST /api/geo/analyses', function () {
    try {
        $body = jsonBody();
        requireFields($body, ['lat', 'lon', 'data']);
        $lat = filter_var($body['lat'], FILTER_VALIDATE_FLOAT);
        $lon = filter_var($body['lon'], FILTER_VALIDATE_FLOAT);
        if ($lat === false || $lon === false || $lat < -90 || $lat > 90 || $lon < -180 || $lon > 180 || !is_array($body['data'])) {
            Flight::json(['error' => 'Coordenadas o análisis no válidos.'], 422);
            return;
        }
        $statement = db()->prepare('INSERT INTO analisis_geograficos (simulacion_id, especie_id, nombre_lugar, latitud, longitud, idoneidad, datos)
            VALUES (?, ?, ?, ?, ?, ?, ?)');
        $statement->execute([
            isset($body['simulacionId']) ? (int)$body['simulacionId'] : null,
            isset($body['especieId']) ? (int)$body['especieId'] : null,
            mb_substr((string)($body['nombre'] ?? 'Ubicación consultada'), 0, 180), $lat, $lon,
            isset($body['data']['suitability']) ? (float)$body['data']['suitability'] : null,
            json_encode($body['data'], JSON_THROW_ON_ERROR),
        ]);
        Flight::json(['id' => (int)db()->lastInsertId()], 201);
    } catch (Throwable $error) {
        apiError($error);
    }
});

Flight::route('GET /api/geo/analyses', function () {
    try {
        $rows = db()->query('SELECT id, simulacion_id AS simulacionId, especie_id AS especieId, nombre_lugar AS nombre,
            latitud AS lat, longitud AS lon, idoneidad, creado_en AS creadoEn FROM analisis_geograficos ORDER BY creado_en DESC LIMIT 50')->fetchAll();
        Flight::json($rows);
    } catch (Throwable $error) {
        apiError($error);
    }
});
