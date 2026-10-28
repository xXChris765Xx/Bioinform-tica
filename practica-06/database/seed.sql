-- Cargar después de database/schema.sql.
USE practica05_bioinformatica;

INSERT INTO especies
  (nombre_comun, nombre_cientifico, descripcion, temperatura_min_c, temperatura_max_c,
   humedad_min_pct, humedad_max_pct, luz_min_horas, luz_optima_horas,
   hidratacion_min_pct, ph_min, ph_max, r, capacidad_carga, dias_madurez)
VALUES
  ('Limonero', 'Citrus limon',
   'Árbol frutal perenne. Parámetros iniciales basados en el reporte del proyecto; el modelo es una simplificación didáctica.',
   17, 28, 50, 70, 6, 10, 30, 6.0, 7.0, 0.0025, 1, 1095),
  ('Tomate', 'Solanum lycopersicum', 'Especie de referencia para comparar escenarios de cultivo.',
   18, 27, 45, 70, 6, 10, 30, 5.5, 7.0, 0.0035, 1, 90),
  ('Frijol', 'Phaseolus vulgaris', 'Especie de referencia para comparar escenarios de cultivo.',
   18, 30, 40, 65, 6, 9, 30, 6.0, 7.0, 0.0030, 1, 75)
ON DUPLICATE KEY UPDATE
  nombre_comun = VALUES(nombre_comun), descripcion = VALUES(descripcion),
  temperatura_min_c = VALUES(temperatura_min_c), temperatura_max_c = VALUES(temperatura_max_c),
  humedad_min_pct = VALUES(humedad_min_pct), humedad_max_pct = VALUES(humedad_max_pct),
  luz_min_horas = VALUES(luz_min_horas), luz_optima_horas = VALUES(luz_optima_horas),
  hidratacion_min_pct = VALUES(hidratacion_min_pct), ph_min = VALUES(ph_min), ph_max = VALUES(ph_max),
  r = VALUES(r), capacidad_carga = VALUES(capacidad_carga), dias_madurez = VALUES(dias_madurez);

-- La siembra se hace solo una vez para que volver a cargar el seed no duplique el ejemplo.
INSERT INTO plantas (especie_id, nombre, edad_inicial_dias, altura_inicial_cm, biomasa_inicial_g, salud_inicial_pct)
SELECT id, 'Limonero adulto de ejemplo', 1825, 250, 18000, 90
FROM especies WHERE nombre_cientifico = 'Citrus limon'
  AND NOT EXISTS (SELECT 1 FROM plantas WHERE nombre = 'Limonero adulto de ejemplo');

INSERT INTO simulaciones (planta_id, nombre, notas, modelo, dias_planeados, estado, condiciones, parametros, dia_actual)
SELECT p.id, 'Escenario de referencia - riego adecuado',
       'Árbol adulto de 5 años en condiciones cercanas al óptimo, con 8 h de sol y temperatura media de 25 °C.',
       'logistico', 42, 'completada',
       JSON_OBJECT('temperatura_c',25,'humedad_ambiental_pct',60,'luz_horas',8,'viento_kmh',10,
                   'riego_litros_semana',80,'ph_suelo',6.5,'hidratacion_inicial_pct',75,
                   'nitrogeno_g_semana',5,'fosforo_g_semana',3,'potasio_g_semana',4,'hierro_g_semana',1),
       JSON_OBJECT('r',0.0025,'K',1,'t0',1095,'edad_inicial_dias',1825), 42
FROM plantas p
WHERE p.nombre = 'Limonero adulto de ejemplo'
  AND NOT EXISTS (SELECT 1 FROM simulaciones WHERE nombre = 'Escenario de referencia - riego adecuado');

INSERT INTO mediciones
  (simulacion_id, dia, altura_cm, biomasa_g, hojas, ramas, flores, frutos, salud_pct,
   hidratacion_pct, estres_hidrico, estres_termico, estres_luminico, estres_nutricional, nutrientes)
SELECT s.id, sample.dia, sample.altura, sample.biomasa, sample.hojas, sample.ramas,
       sample.flores, sample.frutos, sample.salud, sample.agua, sample.eh, sample.et,
       sample.el, sample.enut, JSON_OBJECT('N',72,'P',68,'K',75,'Fe',80)
FROM simulaciones s
JOIN (
  SELECT 0 dia, 250.00 altura, 18000.00 biomasa, 8 hojas, 3 ramas, 0 flores, 0 frutos, 90.00 salud, 75.00 agua, 0.00 eh, 0.00 et, 16.00 el, 0.00 enut
  UNION ALL SELECT 14, 250.40, 18120, 146, 26, 6, 0, 90, 77, 0, 0, 16, 0
  UNION ALL SELECT 42, 250.90, 18265, 146, 26, 0, 6, 91, 81, 0, 0, 16, 0
) sample
WHERE s.nombre = 'Escenario de referencia - riego adecuado'
ON DUPLICATE KEY UPDATE altura_cm = VALUES(altura_cm), biomasa_g = VALUES(biomasa_g), salud_pct = VALUES(salud_pct);

INSERT INTO decisiones (simulacion_id, categoria, regla, umbral, valor_observado, recomendacion, prioridad)
SELECT id, 'riego', 'hidratacion_minima', 30, 81,
       'La hidratación está dentro del rango seguro. Mantener el riego y revisar el suelo durante los días cálidos.', 'info'
FROM simulaciones WHERE nombre = 'Escenario de referencia - riego adecuado'
  AND NOT EXISTS (SELECT 1 FROM decisiones d WHERE d.simulacion_id = simulaciones.id AND d.regla = 'hidratacion_minima');
