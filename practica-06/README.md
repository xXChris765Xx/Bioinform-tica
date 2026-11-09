# Práctica 05 - Laboratorio Bioinformático de Cultivo

Extensión del visor Three.js de la Práctica 04 para simular el crecimiento y la producción de un limonero (*Citrus limon*), persistir corridas en MySQL y consultar sus resultados mediante una API REST en PHP con FlightPHP.

## Estado del proyecto

- El visor representa un limonero procedural con tronco, ramas, hojas y limones; conserva la jerarquía, viento, OrbitControls, raycasting y `requestAnimationFrame`.
- `database/schema.sql` define especies, plantas, simulaciones, mediciones y decisiones.
- `database/seed.sql` carga especies de referencia y una corrida de ejemplo con mediciones.
- `api/` contiene rutas FlightPHP para catálogo, simulaciones, mediciones, decisiones e indicadores de reportes.
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

El cliente Three.js consume estas rutas con `fetch`. La API usa PDO con consultas preparadas para los valores recibidos. El navegador de desarrollo puede usar `http://127.0.0.1:5500` o `http://localhost:5500`.

## Cliente Three.js

Abre `index.html` mediante Live Server después de iniciar la API. El selector mantiene Citrus limon como especie enfocada. El panel permite cambiar modelo, clima, riego, nutrientes, pH y parámetros genéticos; iniciar y guardar corridas; recorrer la línea de tiempo para volver a un día guardado y reanudar desde allí; revisar reportes; cargar el historial; exportar CSV o imprimir un reporte en PDF. El visor incluye un espantapájaros junto al limonero. Three.js, OrbitControls y Chart.js se cargan desde CDN.
