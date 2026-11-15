-- AgroPlant para MariaDB 10.4+ / MySQL 8; ejecutar después de 00_crear_base.sql
USE agroplant_db;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS estados (
 codigo CHAR(2) PRIMARY KEY,
 nombre VARCHAR(80) NOT NULL,
 abreviatura VARCHAR(8) NOT NULL,
 latitud DECIMAL(10,6) NOT NULL,
 longitud DECIMAL(10,6) NOT NULL,
 frase VARCHAR(255) NOT NULL,
 INDEX idx_estados_nombre(nombre)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS municipios (
 codigo CHAR(5) PRIMARY KEY,
 codigo_estado CHAR(2) NOT NULL,
 nombre VARCHAR(160) NOT NULL,
 latitud DECIMAL(10,6) NULL,
 longitud DECIMAL(10,6) NULL,
 actualizado TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_municipio_estado FOREIGN KEY(codigo_estado) REFERENCES estados(codigo),
 INDEX idx_municipio_estado_nombre(codigo_estado,nombre)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cultivos (
 id INT AUTO_INCREMENT PRIMARY KEY,
 slug VARCHAR(90) NOT NULL UNIQUE,
 nombre VARCHAR(120) NOT NULL,
 nombre_cientifico VARCHAR(160) DEFAULT NULL,
 familia VARCHAR(60) NOT NULL,
 temp_min DECIMAL(6,2) DEFAULT NULL,
 temp_max DECIMAL(6,2) DEFAULT NULL,
 lluvia_mes_min DECIMAL(8,2) DEFAULT NULL,
 lluvia_mes_max DECIMAL(8,2) DEFAULT NULL,
 agua VARCHAR(25) NOT NULL DEFAULT 'pendiente',
 emoji VARCHAR(30) DEFAULT '🌱',
 ciclo VARCHAR(100) DEFAULT NULL,
 estacion VARCHAR(120) DEFAULT NULL,
 descripcion TEXT,
 titulo_wikipedia VARCHAR(160) DEFAULT NULL,
 activo TINYINT(1) DEFAULT 1,
 INDEX idx_cultivo_nombre(nombre)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS imagenes_cultivo (
 id INT AUTO_INCREMENT PRIMARY KEY,
 id_cultivo INT NOT NULL,
 url_imagen VARCHAR(1200) DEFAULT NULL,
 url_google VARCHAR(1200) NOT NULL,
 url_fuente VARCHAR(1200) DEFAULT NULL,
 autor VARCHAR(255) DEFAULT NULL,
 licencia VARCHAR(150) DEFAULT NULL,
 es_principal TINYINT(1) NOT NULL DEFAULT 1,
 CONSTRAINT fk_imagen_cultivo FOREIGN KEY(id_cultivo) REFERENCES cultivos(id) ON DELETE CASCADE,
 UNIQUE KEY uk_foto_cultivo(id_cultivo,es_principal)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS parcelas (
 id INT AUTO_INCREMENT PRIMARY KEY,
 nombre VARCHAR(120) NOT NULL DEFAULT 'Mi parcela',
 codigo_estado CHAR(2) NOT NULL,
 codigo_municipio CHAR(5) DEFAULT NULL,
 latitud DECIMAL(10,6) NOT NULL,
 longitud DECIMAL(10,6) NOT NULL,
 suelo VARCHAR(25) NOT NULL DEFAULT 'desconocido',
 riego VARCHAR(25) NOT NULL DEFAULT 'temporal',
 superficie_ha DECIMAL(11,3) NULL,
 fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_parcela_estado FOREIGN KEY(codigo_estado) REFERENCES estados(codigo),
 CONSTRAINT fk_parcela_municipio FOREIGN KEY(codigo_municipio) REFERENCES municipios(codigo) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS historial_siembra (
 id INT AUTO_INCREMENT PRIMARY KEY,
 id_parcela INT NOT NULL,
 id_cultivo INT NOT NULL,
 fecha_siembra DATE NULL,
 fecha_cosecha DATE NULL,
 notas TEXT NULL,
 CONSTRAINT fk_historial_parcela FOREIGN KEY(id_parcela) REFERENCES parcelas(id) ON DELETE CASCADE,
 CONSTRAINT fk_historial_cultivo FOREIGN KEY(id_cultivo) REFERENCES cultivos(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fuentes (
 id VARCHAR(24) PRIMARY KEY,
 nombre VARCHAR(120) NOT NULL,
 url VARCHAR(350) NOT NULL,
 uso VARCHAR(160) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS analisis (
 id INT AUTO_INCREMENT PRIMARY KEY,
 id_parcela INT NULL,
 id_cultivo INT NOT NULL,
 fecha_siembra DATE NOT NULL,
 puntaje TINYINT UNSIGNED NULL,
 clasificacion VARCHAR(20) DEFAULT NULL,
 fuente_clima VARCHAR(100) NOT NULL,
 resultado_json LONGTEXT NOT NULL,
 fecha_analisis TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_analisis_parcela FOREIGN KEY(id_parcela) REFERENCES parcelas(id) ON DELETE SET NULL,
 CONSTRAINT fk_analisis_cultivo FOREIGN KEY(id_cultivo) REFERENCES cultivos(id),
 INDEX idx_analisis_fecha(fecha_analisis)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS estrategias_rotacion (
 id INT AUTO_INCREMENT PRIMARY KEY,
 id_analisis INT NOT NULL,
 nombre VARCHAR(160) NOT NULL,
 posicion TINYINT UNSIGNED NOT NULL,
 descripcion VARCHAR(500) NULL,
 CONSTRAINT fk_estrategia_analisis FOREIGN KEY(id_analisis) REFERENCES analisis(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ciclos_rotacion (
 id INT AUTO_INCREMENT PRIMARY KEY,
 id_estrategia INT NOT NULL,
 id_cultivo INT NOT NULL,
 orden TINYINT UNSIGNED NOT NULL,
 CONSTRAINT fk_ciclo_estrategia FOREIGN KEY(id_estrategia) REFERENCES estrategias_rotacion(id) ON DELETE CASCADE,
 CONSTRAINT fk_ciclo_cultivo FOREIGN KEY(id_cultivo) REFERENCES cultivos(id),
 UNIQUE KEY uk_ciclo_orden(id_estrategia,orden)
) ENGINE=InnoDB;
