-- Agregar columna pareja_email a la tabla inscripciones_torneo
ALTER TABLE public.inscripciones_torneo 
ADD COLUMN IF NOT EXISTS pareja_email VARCHAR(150);

-- Agregar índice para búsquedas rápidas de invitaciones por email
CREATE INDEX IF NOT EXISTS idx_inscripciones_torneo_pareja_email 
ON public.inscripciones_torneo(torneo_id, pareja_email);
