-- Agregar columnas faltantes a torneos
ALTER TABLE torneos ADD COLUMN IF NOT EXISTS fecha_inicio DATE;
ALTER TABLE torneos ADD COLUMN IF NOT EXISTS formato_sets VARCHAR(50) DEFAULT '3_sets';
