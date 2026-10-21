-- Práctica 05: Laboratorio Bioinformático de Cultivo
-- Compatible con MySQL 8.0+.
CREATE DATABASE IF NOT EXISTS practica05_bioinformatica
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE practica05_bioinformatica;

CREATE TABLE IF NOT EXISTS especies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre_comun VARCHAR(100) NOT NULL,
  nombre_cientifico VARCHAR(160) NOT NULL UNIQUE,
  descripcion TEXT NULL,
  temperatura_min_c DECIMAL(5,2) NOT NULL DEFAULT 17,
  temperatura_max_c DECIMAL(5,2) NOT NULL DEFAULT 28,
  humedad_min_pct DECIMAL(5,2) NOT NULL DEFAULT 50,
  humedad_max_pct DECIMAL(5,2) NOT NULL DEFAULT 70,
  luz_min_horas DECIMAL(5,2) NOT NULL DEFAULT 6,
  luz_optima_horas DECIMAL(5,2) NOT NULL DEFAULT 10,
  hidratacion_min_pct DECIMAL(5,2) NOT NULL DEFAULT 30,
  ph_min DECIMAL(4,2) NOT NULL DEFAULT 6.0,
  ph_max DECIMAL(4,2) NOT NULL DEFAULT 7.0,
  r DECIMAL(10,6) NOT NULL DEFAULT 0.025,
  capacidad_carga DECIMAL(12,4) NOT NULL DEFAULT 100,
  dias_madurez INT UNSIGNED NOT NULL DEFAULT 1095,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS plantas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  especie_id BIGINT UNSIGNED NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  edad_inicial_dias INT UNSIGNED NOT NULL DEFAULT 0,
  altura_inicial_cm DECIMAL(10,2) NOT NULL DEFAULT 0,
  biomasa_inicial_g DECIMAL(12,2) NOT NULL DEFAULT 10,
  salud_inicial_pct DECIMAL(5,2) NOT NULL DEFAULT 100,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_plantas_especies FOREIGN KEY (especie_id) REFERENCES especies(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS simulaciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  planta_id BIGINT UNSIGNED NOT NULL,
  nombre VARCHAR(160) NOT NULL,
  notas TEXT NULL,
  modelo ENUM('lineal','exponencial','logistico','gompertz') NOT NULL DEFAULT 'logistico',
  dias_planeados INT UNSIGNED NOT NULL DEFAULT 365,
  estado ENUM('borrador','ejecutando','completada','pausada') NOT NULL DEFAULT 'borrador',
  condiciones JSON NOT NULL,
  parametros JSON NOT NULL,
  dia_actual INT UNSIGNED NOT NULL DEFAULT 0,
  creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_simulaciones_plantas FOREIGN KEY (planta_id) REFERENCES plantas(id) ON DELETE CASCADE,
  INDEX idx_simulaciones_estado_fecha (estado, creada_en),
  INDEX idx_simulaciones_planta (planta_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mediciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  simulacion_id BIGINT UNSIGNED NOT NULL,
  dia INT UNSIGNED NOT NULL,
  altura_cm DECIMAL(10,2) NOT NULL,
  biomasa_g DECIMAL(12,2) NOT NULL,
  hojas INT UNSIGNED NOT NULL DEFAULT 0,
  ramas INT UNSIGNED NOT NULL DEFAULT 0,
  flores INT UNSIGNED NOT NULL DEFAULT 0,
  frutos INT UNSIGNED NOT NULL DEFAULT 0,
  salud_pct DECIMAL(5,2) NOT NULL,
  hidratacion_pct DECIMAL(5,2) NOT NULL,
  estres_hidrico DECIMAL(5,2) NOT NULL DEFAULT 0,
  estres_termico DECIMAL(5,2) NOT NULL DEFAULT 0,
  estres_luminico DECIMAL(5,2) NOT NULL DEFAULT 0,
  estres_nutricional DECIMAL(5,2) NOT NULL DEFAULT 0,
  nutrientes JSON NULL,
  registrado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mediciones_simulaciones FOREIGN KEY (simulacion_id) REFERENCES simulaciones(id) ON DELETE CASCADE,
  UNIQUE KEY uq_medicion_dia (simulacion_id, dia),
  INDEX idx_mediciones_biomasa (biomasa_g),
  INDEX idx_mediciones_dia (simulacion_id, dia)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS decisiones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  simulacion_id BIGINT UNSIGNED NOT NULL,
  medicion_id BIGINT UNSIGNED NULL,
  categoria ENUM('riego','temperatura','luz','nutrientes','cosecha','comparacion','general') NOT NULL DEFAULT 'general',
  regla VARCHAR(120) NOT NULL,
  umbral DECIMAL(10,2) NULL,
  valor_observado DECIMAL(10,2) NULL,
  recomendacion VARCHAR(500) NOT NULL,
  prioridad ENUM('info','aviso','critica') NOT NULL DEFAULT 'info',
  creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_decisiones_simulaciones FOREIGN KEY (simulacion_id) REFERENCES simulaciones(id) ON DELETE CASCADE,
  CONSTRAINT fk_decisiones_mediciones FOREIGN KEY (medicion_id) REFERENCES mediciones(id) ON DELETE SET NULL,
  INDEX idx_decisiones_simulacion_fecha (simulacion_id, creada_en)
) ENGINE=InnoDB;
