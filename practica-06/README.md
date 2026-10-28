# Práctica 06 - Geovisualización Global y Datos Reales

Continuación del Laboratorio Bioinformático de Cultivo de la Práctica 05. Integra el simulador Three.js con un observatorio 3D que consulta clima (Open-Meteo y NASA POWER), biodiversidad (GBIF) y suelo (SoilGrids) mediante un proxy PHP FlightPHP. Permite explorar coordenadas, revisar idoneidad estimada, comparar ubicaciones, precargar una simulación y guardar análisis geográficos en MySQL.

## Objetivo y alcance de la práctica

Transformar el laboratorio bioinformático de la Práctica 05 en un observatorio global de cultivos que consulte datos públicos reales de clima, biodiversidad y suelo, y los integre con el motor de crecimiento. El observatorio permitirá explorar ubicaciones en un globo interactivo, consultar condiciones del sitio, comparar escenarios de cultivo y guardar los análisis asociados a sus simulaciones.

La solución se plantea en tres capas:

1. **Datos externos:** una API PHP con FlightPHP consulta GBIF, NASA POWER, Open-Meteo y SoilGrids. El servidor valida y normaliza las respuestas, maneja errores y protege las credenciales; las claves no se exponen en el navegador.
2. **Geovisualización:** una escena Three.js presenta la Tierra y sus marcadores georreferenciados. Al seleccionar una ubicación, el usuario consulta sus datos y puede iniciar una simulación. Mapbox GL o deck.gl pueden añadirse si se requiere una proyección cartográfica.
3. **Decisiones geo-agronómicas:** la lógica del cliente y MySQL relacionan clima, suelo, ocurrencias y resultados de crecimiento para mostrar riesgos, recomendaciones y rankings de idoneidad.

### Funciones previstas

- Consultar clima, suelo y biodiversidad para coordenadas seleccionadas.
- Mostrar registros de ocurrencia de una especie en GBIF y explorar su distribución.
- Iniciar simulaciones con condiciones del sitio y persistir el análisis geoespacial junto con sus resultados.
- Comparar dos ubicaciones para la misma especie y consultar un ranking de idoneidad.
- Aplicar reglas configurables, como alertar por precipitación anual inferior a 400 mm, temperatura media superior a 35 °C o pH inferior a 5.5.
- Mantener una caché de respuestas para reducir solicitudes repetidas y respetar los límites de las APIs.

El alcance implementado y sus limitaciones se detallan en las secciones siguientes.

### Fuentes de datos y documentación

- [GBIF Occurrence API](https://www.gbif.org/developer/occurrence): registros de presencia de especies.
- [GBIF Maps API](https://www.gbif.org/developer/maps): capas cartográficas de biodiversidad.
- [NASA POWER](https://power.larc.nasa.gov/api/): series agroclimáticas de radiación, temperatura y precipitación.
- [Open-Meteo](https://open-meteo.com): clima, pronóstico y geocodificación sin clave de API.
- [OpenStreetMap Nominatim](https://nominatim.org/release-docs/latest/api/Reverse/): localidad y región aproximada a partir de coordenadas.
- [SoilGrids](https://rest.isric.org/soilgrids/v2.0/docs): propiedades globales del suelo.
- [three-globe](https://github.com/vasturiano/three-globe) y [lithosphere](https://www.npmjs.com/package/lithosphere): opciones para representar el globo con Three.js.
- [Threebox](https://github.com/jscastro76/threebox): integración de Three.js con Mapbox GL JS.

## Estado del proyecto

- El visor representa un limonero procedural con tronco, ramas, hojas y limones; conserva la jerarquía, viento, OrbitControls, raycasting y `requestAnimationFrame`.
- `database/schema.sql` define especies, plantas, simulaciones, mediciones y decisiones.
- `database/seed.sql` carga especies de referencia y una corrida de ejemplo con mediciones.
- `api/` contiene rutas FlightPHP para catálogo, simulaciones, mediciones, decisiones e indicadores de reportes.
- `api/src/geo.php` centraliza consultas cURL a Open-Meteo, NASA POWER, SoilGrids y GBIF, con caché MySQL y manejo de fallas por proveedor.
- `database/schema.sql` incluye `geo_cache` y `analisis_geograficos` para reutilizar respuestas y persistir análisis.
- `geo-globe.js` crea el globo Three.js, convierte clics a coordenadas y resalta las ocurrencias GBIF con puntos luminosos.
- `assets/earth-blue-marble.jpg` aporta una textura terrestre de mayor resolución; se conserva un mapa procedural de respaldo.
- La vista Observatorio presenta datos del sitio, reglas de riesgo, ranking por especie y comparación A/B; permite transferir variables a la simulación.
- `simulation.js` implementa los cuatro modelos, índices de estrés y cosecha aproximada.
- La interfaz consume la API con `fetch`, presenta KPIs, gráficas, historial y exportación CSV/impresión PDF.

## Modelo de limonero

El reporte de requisitos del proyecto describe rangos óptimos de 17–28 °C, 50–70 % de humedad ambiental, al menos 6 horas de luz, pH 6–7 y umbral de estrés hídrico bajo 30 %. También describe el descenso diario de humedad del suelo por evapotranspiración, respuesta a riego y efectos de temperatura, luz y nutrientes. Estos datos son los parámetros iniciales del simulador, no una validación agronómica de un modelo de campo.

La entidad `especies` conserva óptimos y parámetros para que otras especies se puedan añadir. `plantas` contiene el estado inicial de cada árbol. `simulaciones` guarda el modelo y las condiciones elegidas. `mediciones` registra resultados por día y los índices de estrés. `decisiones` conserva reglas y recomendaciones emitidas.

La corrida visual comienza con el árbol adulto sin flores ni limones. El modelo didáctico inicia la floración, forma los primeros frutos después de 28 días simulados y los aumenta gradualmente durante los siguientes 120 días; el panel estima cuándo completarían ese ciclo.

## Base de datos

Importa primero el esquema y luego los datos de ejemplo en MariaDB/MySQL. Con XAMPP, arranca MySQL y ejecuta desde la carpeta del proyecto:

```sh
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

## API local

Requiere PHP 8.1+, Composer y MySQL 8 o MariaDB 10.4+ (MariaDB viene incluido con XAMPP). PHP necesita habilitada la extensión ZIP para que Composer descargue los paquetes. En XAMPP se habilita en `C:\xampp\php\php.ini` quitando el `;` de `;extension=zip`; después, abre una terminal nueva. La primera vez, desde `api/`:

```sh
composer install
Copy-Item .env.example .env
```

Configura las variables de conexión en `api/.env`. Con MySQL iniciado en XAMPP, desde `api/` ejecuta el servidor integrado:

```sh
php -S 127.0.0.1:8000 index.php
```

Rutas disponibles:

| Método y ruta | Propósito |
| --- | --- |
| `GET /api/health` | Verifica API y conexión MySQL |
| `GET /api/especies` | Devuelve el catálogo activo |
| `GET /api/simulaciones` | Lista las últimas simulaciones |
| `GET /api/simulaciones/{id}` | Devuelve una simulación, mediciones y decisiones |
| `POST /api/simulaciones` | Crea una planta y una simulación |
| `POST /api/simulaciones/{id}/mediciones` | Persiste el estado de un día simulado |
| `DELETE /api/simulaciones/{id}/mediciones/despues/{dia}` | Recorta mediciones futuras al reanudar desde un día anterior |
| `POST /api/simulaciones/{id}/decisiones` | Guarda una recomendación |
| `GET /api/reportes/resumen` | Consulta top de biomasa y días hasta primeros frutos |
| `GET /api/geo/site?lat=...&lon=...&speciesId=...` | Consulta clima, suelo y ocurrencias GBIF para una ubicación; usa caché MySQL |
| `GET /api/geo/occurrences?speciesId=...` | Precarga 50 puntos GBIF globales de la especie y devuelve el total de registros |
| `POST /api/geo/analyses` | Guarda un análisis geográfico y su relación opcional con simulación/especie |
| `GET /api/geo/analyses` | Lista los últimos 50 análisis guardados |

El cliente Three.js consume estas rutas con `fetch`. La API usa PDO con consultas preparadas para los valores recibidos. El navegador de desarrollo puede usar `http://127.0.0.1:5500` o `http://localhost:5500`.

## Cliente Three.js

Abre `index.html` mediante Live Server después de iniciar la API. El selector mantiene Citrus limon como especie enfocada. El panel permite cambiar modelo, clima, riego, nutrientes, pH y parámetros genéticos; iniciar y guardar corridas; recorrer la línea de tiempo para volver a un día guardado y reanudar desde allí; revisar reportes; cargar el historial; exportar CSV o imprimir un reporte en PDF. El visor incluye un espantapájaros junto al limonero. Three.js, OrbitControls y Chart.js se cargan desde CDN.

## Preguntas y respuestas de la Práctica 06

**Alcance y limitaciones:** las APIs, el globo, el ranking, las recomendaciones y el comparador ya están conectados a la aplicación. El índice de idoneidad y el motor de crecimiento siguen siendo aproximaciones educativas. Open-Meteo, NASA POWER, SoilGrids o GBIF pueden fallar o no tener cobertura para una coordenada; la interfaz indica qué proveedor no respondió.

### 1. ¿Qué APIs públicas integraste y por qué las elegiste? ¿Qué tipo de datos aporta cada una?

Se integran GBIF para ocurrencias georreferenciadas de la especie seleccionada; Open-Meteo para condiciones actuales y serie diaria breve; NASA POWER para el resumen climático aproximado de un año (temperatura, lluvia y radiación); SoilGrids para pH, carbono orgánico, arcilla y arena en la capa de 0–5 cm; y OpenStreetMap Nominatim para mostrar localidad, región y país aproximados. Clima y suelo describen condiciones del sitio, mientras GBIF muestra registros reportados, no una medida directa de aptitud agrícola.

### 2. ¿Cómo implementaste el proxy PHP para proteger las API keys? Muestra el flujo frontend → FlightPHP → cURL → API externa → MySQL (caché) → JSON.

El frontend solicita `GET /api/geo/site` → FlightPHP valida las coordenadas → el servidor revisa `geo_cache` → si no existe una respuesta vigente, cURL consulta las fuentes públicas → normaliza los valores y guarda cada respuesta con su expiración → FlightPHP devuelve JSON. Nominatim identifica la zona aproximada con geocodificación inversa, cachea la respuesta 30 días y limita las consultas nuevas a una por segundo. La interfaz atribuye a OpenStreetMap los datos de localidad.

### 3. ¿Cómo construiste el globo terráqueo 3D? ¿Usaste three-globe, lithosphere, o lo hiciste desde cero? Explica la proyección de coordenadas.

El globo se construyó con una esfera Three.js, textura Blue Marble de mayor resolución, grilla, atmósfera, estrellas y controles orbitales. Se hizo desde cero para integrarlo a la escena. Para radio `R`, latitud `φ` y longitud `λ` en radianes se usa `x = -R cos(φ) cos(λ)`, `y = R sin(φ)` y `z = R cos(φ) sin(λ)`. El mismo cálculo coloca puntos GBIF y el marcador seleccionado.

### 4. ¿Cómo georreferenciaste los marcadores y las ocurrencias GBIF sobre la esfera?

Al abrir Observatorio se solicitan automáticamente hasta 50 ocurrencias globales de GBIF para la especie y se dibujan como puntos turquesa luminosos. Los puntos se pueden seleccionar; el clic consulta clima, suelo y biodiversidad alrededor de esa coordenada. También se puede hacer clic en el globo para explorar cualquier otro sitio. La consulta local limita sus puntos a 100 y la capa global a 50 para mantener la escena fluida. El marcador dorado identifica el sitio consultado.

### 5. ¿Cómo calculas el índice de idoneidad? ¿Qué variables consideraste y con qué pesos?

El servidor calcula un puntaje preliminar de 0 a 100: temperatura 40 %, pH del suelo 35 % y precipitación anual como indicador hídrico 25 %. La temperatura y el pH se comparan con los rangos de la especie del catálogo. GBIF se presenta como contexto y no suma al índice, porque el esfuerzo de muestreo y la ausencia de registros no prueban que un cultivo no pueda crecer allí. Los pesos son iniciales y requieren calibración agronómica antes de interpretar el resultado como recomendación científica.

### 6. ¿Qué reglas de decisión geo-agronómicas implementaste? Da 3 ejemplos con su umbral y recomendación.

El observatorio aplica, entre otras, estas reglas: precipitación anual menor a 400 mm → recomendar riego suplementario; temperatura media mayor a 35 °C → advertir estrés térmico y evaluar variedades tolerantes; pH menor a 5.5 → recomendar análisis local y evaluar encalado; radiación media mayor a 25 MJ/m²/día → revisar estrés hídrico y sombra parcial; cero ocurrencias GBIF → indicar que no hay registros en el área, sin inferir ausencia. El simulador conserva además sus reglas de hidratación, helada, viento y temperatura. Los umbrales requieren ajuste por cultivo y región.

### 7. ¿Cómo manejas el caché de APIs para no exceder los límites de uso? ¿Qué tiempo de expiración usaste?

La tabla MySQL `geo_cache` guarda cada respuesta por proveedor y parámetros normalizados. La expiración configurada es de 1 hora para Open-Meteo, 30 días para NASA POWER, SoilGrids y Nominatim, y 24 horas para GBIF. Además se separan al menos 12 segundos entre consultas nuevas a SoilGrids y al menos un segundo entre consultas a Nominatim, conforme a sus políticas públicas. Los datos de proveedores que fallen se muestran como no disponibles; en esta versión no se sustituye automáticamente una respuesta vencida por una copia antigua.

### 8. ¿Cómo lanzas una simulación de crecimiento usando los datos reales de una ubicación? Describe el flujo completo.

En Observatorio se consulta un sitio y se pulsa **Usar datos en simulación**. La interfaz precarga temperatura anual (o actual si no hay histórico), humedad actual, pH y una estimación de horas de luz a partir de radiación; luego se inicia la corrida habitual. Al crear la simulación, el sitio aplicado se guarda en `analisis_geograficos` y queda vinculado con su ID. Los datos faltantes no se inventan y el motor de crecimiento se mantiene como modelo educativo.

### 9. ¿Cómo funciona el comparador A/B geográfico? ¿Qué métricas comparas y cómo declaras un ganador?

Se guardan dos ubicaciones consultadas como A y B y se comparan con la especie seleccionada. La versión actual compara el índice de idoneidad preliminar y la precipitación anual; declara una diferencia menor a dos puntos como resultado cercano. El ganador del índice es una orientación inicial, no una corrida A/B de las simulaciones de biomasa y frutos.

### 10. ¿Qué dificultades encontraste al integrar datos reales con la simulación procedural? ¿Cómo las resolviste?

La integración combina datos con distintas escalas temporales y algunos proveedores pueden fallar o carecer de cobertura en un punto. Se normalizan las respuestas en FlightPHP, se aplica caché, se valida latitud/longitud y se muestran errores por proveedor sin descartar las demás fuentes. Los datos puntuales se distinguen de los promedios anuales. La simulación procedural conserva su carácter educativo y no se presenta como pronóstico agronómico validado.

### 11. ¿Qué valor añadido aporta el mapa 3D frente a un simple formulario de coordenadas? ¿En qué casos es realmente útil?

El globo permite seleccionar ubicaciones visualmente, explorar la distribución de registros GBIF y comparar regiones separadas sin introducir coordenadas a mano. Para mediciones catastrales o tareas locales de alta precisión, un mapa 2D especializado sería más adecuado; el globo aporta más cuando interesa la exploración global y la distribución espacial.

### 12. Si tuvieras que conectar este observatorio a sensores IoT en tiempo real y a imágenes satelitales (NDVI, Sentinel-2), ¿cómo lo harías?

Se añadiría una ingesta segura de sensores mediante MQTT o HTTP, con identificador, coordenadas, marca de tiempo y validación de cada lectura. Un proceso del servidor guardaría las series temporales y publicaría mediciones recientes al cliente. Para Sentinel-2, un worker consultaría un catálogo compatible con STAC, descargaría escenas disponibles, aplicaría máscara de nubes y calcularía NDVI; el mapa mostraría la fecha y resolución de cada escena. Los sensores describirían el lote en tiempo casi real y los satélites aportarían contexto espacial periódico.

### 13. ¿Cómo escalarías la aplicación para consultar miles de ubicaciones simultáneamente sin saturar las APIs externas? (colas, workers, caché distribuida, etc.)

Se aceptarían trabajos por lotes en una cola, con workers que respeten límites por proveedor, reintentos con espera progresiva y deduplicación de consultas equivalentes. Una caché distribuida como Redis reduciría solicitudes repetidas; MySQL conservaría los análisis y resultados persistentes. También se agruparían puntos por celda espacial, se paginarían ocurrencias y se entregarían resultados parciales mientras terminan los trabajos. Esta arquitectura es una propuesta, no parte de la aplicación actual.

### 14. ¿Qué decisiones reales puede tomar un agrónomo o investigador con esta herramienta que no podía tomar con la Práctica 05?

La Práctica 05 permite explorar escenarios didácticos con condiciones introducidas manualmente. El observatorio añade selección espacial, consulta de clima y suelo, evidencia de ocurrencias, alertas agroclimáticas preliminares y comparación de idoneidad entre sitios. Un agrónomo podría priorizar ubicaciones para visita, identificar dónde revisar disponibilidad de agua o acidez y documentar el análisis vinculado a una simulación. Las decisiones de campo requieren validar los datos y umbrales con mediciones locales.
