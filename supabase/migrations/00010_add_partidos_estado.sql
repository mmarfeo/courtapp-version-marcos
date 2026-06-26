-- Crear el tipo ENUM para el estado del partido si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_partido_enum') THEN
        CREATE TYPE estado_partido_enum AS ENUM ('propuesto', 'confirmado', 'reprogramado', 'w.o.', 'jugado', 'cancelado');
    END IF;
END $$;

-- Agregar columna estado a la tabla partidos
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS estado estado_partido_enum DEFAULT 'propuesto';
