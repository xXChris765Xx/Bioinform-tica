<?php
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

Dotenv\Dotenv::createImmutable(__DIR__)->safeLoad();

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = array_unique([
    $_ENV['API_ALLOWED_ORIGIN'] ?? (getenv('API_ALLOWED_ORIGIN') ?: 'http://127.0.0.1:5500'),
    'http://127.0.0.1:5500',
    'http://localhost:5500',
]);
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

Flight::route('GET /api/health', function () {
    try {
        db()->query('SELECT 1');
        Flight::json(['ok' => true, 'database' => 'MySQL conectado']);
    } catch (Throwable $error) {
        apiError($error);
    }
});

Flight::route('GET /api/especies', function () {
    try {
        $rows = db()->query('SELECT id, nombre_comun, nombre_cientifico, descripcion,
            temperatura_min_c, temperatura_max_c, humedad_min_pct, humedad_max_pct,
            luz_min_horas, luz_optima_horas, hidratacion_min_pct, ph_min, ph_max,
            r, capacidad_carga, dias_madurez
            FROM especies WHERE activo = 1 ORDER BY nombre_comun')->fetchAll();
        Flight::json($rows);
    } catch (Throwable $error) {
        apiError($error);
    }
});

Flight::route('GET /api/simulaciones', function () {
    try {
        $rows = db()->query('SELECT s.id, s.nombre, s.notas, s.modelo, s.estado, s.dias_planeados,
            s.dia_actual, s.creada_en, e.nombre_comun AS especie, e.nombre_cientifico
            FROM simulaciones s JOIN plantas p ON p.id = s.planta_id
            JOIN especies e ON e.id = p.especie_id ORDER BY s.creada_en DESC LIMIT 100')->fetchAll();
        Flight::json($rows);
    } catch (Throwable $error) {
        apiError($error);
    }
});

Flight::route('GET /api/simulaciones/@id:[0-9]+', function (string $id) {
    try {
        $id = (int)$id;
        $pdo = db();
        $statement = $pdo->prepare('SELECT s.*, p.nombre AS planta, p.especie_id, p.edad_inicial_dias,
            p.altura_inicial_cm, p.biomasa_inicial_g, p.salud_inicial_pct,
            e.nombre_comun AS especie, e.nombre_cientifico
            FROM simulaciones s JOIN plantas p ON p.id = s.planta_id
            JOIN especies e ON e.id = p.especie_id WHERE s.id = ?');
        $statement->execute([$id]);
        $simulation = $statement->fetch();
        if (!$simulation) {
            Flight::json(['error' => 'Simulación no encontrada.'], 404);
            return;
        }
        $measurements = $pdo->prepare('SELECT * FROM mediciones WHERE simulacion_id = ? ORDER BY dia');
        $measurements->execute([$id]);
        $simulation['mediciones'] = $measurements->fetchAll();
        $decisions = $pdo->prepare('SELECT * FROM decisiones WHERE simulacion_id = ? ORDER BY creada_en DESC');
        $decisions->execute([$id]);
        $simulation['decisiones'] = $decisions->fetchAll();
        Flight::json($simulation);
    } catch (Throwable $error) {
        apiError($error);
    }
});

Flight::route('POST /api/simulaciones', function () {
    try {
        $body = jsonBody();
        requireFields($body, ['especieId', 'nombre', 'modelo', 'diasPlaneados', 'condiciones', 'parametros']);
        $models = ['lineal', 'exponencial', 'logistico', 'gompertz'];
        if (!in_array($body['modelo'], $models, true) || !is_array($body['condiciones']) || !is_array($body['parametros'])) {
            Flight::json(['error' => 'Modelo, condiciones o parámetros no válidos.'], 422);
            return;
        }
        $pdo = db();
        $pdo->beginTransaction();
        $species = $pdo->prepare('SELECT id, nombre_comun FROM especies WHERE id = ? AND activo = 1');
        $species->execute([(int)$body['especieId']]);
        $speciesRow = $species->fetch();
        if (!$speciesRow) {
            $pdo->rollBack();
            Flight::json(['error' => 'La especie seleccionada no existe.'], 422);
            return;
        }
        $plant = $pdo->prepare('INSERT INTO plantas (especie_id, nombre, edad_inicial_dias, altura_inicial_cm, biomasa_inicial_g, salud_inicial_pct)
            VALUES (?, ?, ?, ?, ?, ?)');
        $plant->execute([
            $speciesRow['id'], mb_substr((string)$body['nombre'], 0, 120),
            max(0, (int)($body['edadInicialDias'] ?? 0)),
            max(0, (float)($body['alturaInicialCm'] ?? 10)),
            max(0, (float)($body['biomasaInicialG'] ?? 10)),
            min(100, max(0, (float)($body['saludInicialPct'] ?? 100))),
        ]);
        $plantId = (int)$pdo->lastInsertId();
        $simulation = $pdo->prepare('INSERT INTO simulaciones (planta_id, nombre, notas, modelo, dias_planeados, condiciones, parametros)
            VALUES (?, ?, ?, ?, ?, ?, ?)');
        $simulation->execute([
            $plantId, mb_substr((string)$body['nombre'], 0, 160),
            isset($body['notas']) ? (string)$body['notas'] : null,
            $body['modelo'], min(20000, max(1, (int)$body['diasPlaneados'])),
            json_encode($body['condiciones'], JSON_THROW_ON_ERROR),
            json_encode($body['parametros'], JSON_THROW_ON_ERROR),
        ]);
        $id = (int)$pdo->lastInsertId();
        $pdo->commit();
        Flight::json(['id' => $id, 'plantaId' => $plantId, 'estado' => 'borrador'], 201);
    } catch (Throwable $error) {
        if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
        apiError($error);
    }
});

Flight::route('POST /api/simulaciones/@id:[0-9]+/mediciones', function (string $id) {
    try {
        $id = (int)$id;
        $body = jsonBody();
        requireFields($body, ['dia', 'alturaCm', 'biomasaG', 'saludPct', 'hidratacionPct']);
        $pdo = db();
        $exists = $pdo->prepare('SELECT id FROM simulaciones WHERE id = ?');
        $exists->execute([$id]);
        if (!$exists->fetch()) {
            Flight::json(['error' => 'Simulación no encontrada.'], 404);
            return;
        }
        $measurement = $pdo->prepare('INSERT INTO mediciones
            (simulacion_id, dia, altura_cm, biomasa_g, hojas, ramas, flores, frutos, salud_pct, hidratacion_pct,
             estres_hidrico, estres_termico, estres_luminico, estres_nutricional, nutrientes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE altura_cm=VALUES(altura_cm), biomasa_g=VALUES(biomasa_g), hojas=VALUES(hojas),
             ramas=VALUES(ramas), flores=VALUES(flores), frutos=VALUES(frutos), salud_pct=VALUES(salud_pct),
             hidratacion_pct=VALUES(hidratacion_pct), estres_hidrico=VALUES(estres_hidrico),
             estres_termico=VALUES(estres_termico), estres_luminico=VALUES(estres_luminico),
             estres_nutricional=VALUES(estres_nutricional), nutrientes=VALUES(nutrientes)');
        $measurement->execute([
            $id, max(0, (int)$body['dia']), max(0, (float)$body['alturaCm']), max(0, (float)$body['biomasaG']),
            max(0, (int)($body['hojas'] ?? 0)), max(0, (int)($body['ramas'] ?? 0)),
            max(0, (int)($body['flores'] ?? 0)), max(0, (int)($body['frutos'] ?? 0)),
            min(100, max(0, (float)$body['saludPct'])), min(100, max(0, (float)$body['hidratacionPct'])),
            min(100, max(0, (float)($body['estresHidrico'] ?? 0))),
            min(100, max(0, (float)($body['estresTermico'] ?? 0))),
            min(100, max(0, (float)($body['estresLuminico'] ?? 0))),
            min(100, max(0, (float)($body['estresNutricional'] ?? 0))),
            isset($body['nutrientes']) ? json_encode($body['nutrientes'], JSON_THROW_ON_ERROR) : null,
        ]);
        $update = $pdo->prepare("UPDATE simulaciones
            SET dia_actual = GREATEST(dia_actual, ?),
                estado = CASE WHEN ? >= dias_planeados THEN 'completada' ELSE 'ejecutando' END
            WHERE id = ?");
        $update->execute([(int)$body['dia'], (int)$body['dia'], $id]);
        Flight::json(['ok' => true, 'dia' => (int)$body['dia']], 201);
    } catch (Throwable $error) {
        apiError($error);
    }
});

Flight::route('DELETE /api/simulaciones/@id:[0-9]+/mediciones/despues/@dia:[0-9]+', function (string $id, string $day) {
    try {
        $pdo = db();
        $pdo->beginTransaction();
        $exists = $pdo->prepare('SELECT id FROM simulaciones WHERE id = ? FOR UPDATE');
        $exists->execute([(int)$id]);
        if (!$exists->fetch()) {
            $pdo->rollBack();
            Flight::json(['error' => 'Simulación no encontrada.'], 404);
            return;
        }
        $delete = $pdo->prepare('DELETE FROM mediciones WHERE simulacion_id = ? AND dia > ?');
        $delete->execute([(int)$id, (int)$day]);
        $update = $pdo->prepare("UPDATE simulaciones SET dia_actual = ?, estado = 'ejecutando' WHERE id = ?");
        $update->execute([(int)$day, (int)$id]);
        $pdo->commit();
        Flight::json(['ok' => true, 'dia' => (int)$day, 'medicionesEliminadas' => $delete->rowCount()]);
    } catch (Throwable $error) {
        if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
        apiError($error);
    }
});

Flight::route('POST /api/simulaciones/@id:[0-9]+/decisiones', function (string $id) {
    try {
        $id = (int)$id;
        $body = jsonBody();
        requireFields($body, ['categoria', 'regla', 'recomendacion']);
        $categories = ['riego', 'temperatura', 'luz', 'nutrientes', 'cosecha', 'comparacion', 'general'];
        $priorities = ['info', 'aviso', 'critica'];
        if (!in_array($body['categoria'], $categories, true) || !in_array($body['prioridad'] ?? 'info', $priorities, true)) {
            Flight::json(['error' => 'Categoría o prioridad no válida.'], 422);
            return;
        }
        $statement = db()->prepare('INSERT INTO decisiones (simulacion_id, categoria, regla, umbral, valor_observado, recomendacion, prioridad)
            SELECT id, ?, ?, ?, ?, ?, ? FROM simulaciones WHERE id = ?');
        $statement->execute([
            $body['categoria'], mb_substr((string)$body['regla'], 0, 120), $body['umbral'] ?? null,
            $body['valorObservado'] ?? null, mb_substr((string)$body['recomendacion'], 0, 500),
            $body['prioridad'] ?? 'info', $id,
        ]);
        if ($statement->rowCount() === 0) {
            Flight::json(['error' => 'Simulación no encontrada.'], 404);
            return;
        }
        Flight::json(['ok' => true], 201);
    } catch (Throwable $error) {
        apiError($error);
    }
});

Flight::route('GET /api/reportes/resumen', function () {
    try {
        $pdo = db();
        $top = $pdo->query('SELECT s.id, s.nombre AS simulacion, e.nombre_comun AS especie,
            MAX(m.biomasa_g) AS biomasa_maxima_g, MAX(m.frutos) AS frutos_maximos
            FROM simulaciones s JOIN plantas p ON p.id = s.planta_id JOIN especies e ON e.id = p.especie_id
            LEFT JOIN mediciones m ON m.simulacion_id = s.id
            GROUP BY s.id, s.nombre, e.nombre_comun ORDER BY biomasa_maxima_g DESC LIMIT 5')->fetchAll();
        $maturity = $pdo->query('SELECT AVG(first_fruit.day) AS dias_promedio
            FROM simulaciones s
            JOIN (SELECT simulacion_id, MIN(dia) AS day FROM mediciones WHERE frutos > 0 GROUP BY simulacion_id) first_fruit
              ON first_fruit.simulacion_id = s.id
            WHERE s.estado = "completada"')->fetch();
        $efficiency = $pdo->query("SELECT e.id, e.nombre_comun, e.nombre_cientifico,
            AVG(m.biomasa_g / NULLIF(
                CAST(JSON_UNQUOTE(JSON_EXTRACT(s.condiciones, '$.riego_litros_semana')) AS DECIMAL(10,2))
                * s.dias_planeados / 7, 0)) AS gramos_por_litro
            FROM simulaciones s JOIN plantas p ON p.id = s.planta_id JOIN especies e ON e.id = p.especie_id
            JOIN mediciones m ON m.simulacion_id = s.id
            WHERE s.estado = 'completada' AND CAST(JSON_UNQUOTE(JSON_EXTRACT(s.condiciones, '$.riego_litros_semana')) AS DECIMAL(10,2)) > 0
            GROUP BY e.id, e.nombre_comun, e.nombre_cientifico
            ORDER BY gramos_por_litro DESC LIMIT 1")->fetch();
        Flight::json(['top5' => $top, 'diasPromedioMadurez' => $maturity['dias_promedio'], 'especieMasEficiente' => $efficiency ?: null]);
    } catch (Throwable $error) {
        apiError($error);
    }
});

Flight::map('error', function (Throwable $error) {
    apiError($error);
});

Flight::start();
