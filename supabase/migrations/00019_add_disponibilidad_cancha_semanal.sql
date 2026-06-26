-- Migración: Agregar disponibilidad semanal de canchas global
CREATE TABLE IF NOT EXISTS public.disponibilidad_cancha_semanal (
    id              SERIAL PRIMARY KEY,
    cancha_id       INT NOT NULL REFERENCES public.canchas(id) ON DELETE CASCADE,
    dia_semana      VARCHAR(15) NOT NULL, -- 'lunes', 'martes', etc.
    hora_inicio     TIME NOT NULL,
    hora_fin        TIME NOT NULL,
    creado_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_cancha_semana_slot UNIQUE (cancha_id, dia_semana, hora_inicio)
);

-- Habilitar Row Level Security
ALTER TABLE public.disponibilidad_cancha_semanal ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Lectura publica disponibilidad_cancha_semanal" ON public.disponibilidad_cancha_semanal;
CREATE POLICY "Lectura publica disponibilidad_cancha_semanal" ON public.disponibilidad_cancha_semanal
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Escritura local disponibilidad_cancha_semanal" ON public.disponibilidad_cancha_semanal;
CREATE POLICY "Escritura local disponibilidad_cancha_semanal" ON public.disponibilidad_cancha_semanal
    FOR ALL USING (true) WITH CHECK (true);
