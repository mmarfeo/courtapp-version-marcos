-- Migración: Agregar disponibilidad de canchas para torneos
CREATE TABLE IF NOT EXISTS public.disponibilidad_cancha_torneo (
    id                      SERIAL PRIMARY KEY,
    torneo_id               INT NOT NULL REFERENCES public.torneos(id) ON DELETE CASCADE,
    cancha_id               INT NOT NULL REFERENCES public.canchas(id) ON DELETE CASCADE,
    fecha_disponible        DATE NOT NULL,
    hora_inicio_disponible  TIME NOT NULL,
    hora_fin_disponible     TIME NOT NULL,
    creado_at               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_torneo_cancha_slot UNIQUE (torneo_id, cancha_id, fecha_disponible, hora_inicio_disponible)
);

-- Habilitar Row Level Security
ALTER TABLE public.disponibilidad_cancha_torneo ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Lectura publica disponibilidad_cancha_torneo" ON public.disponibilidad_cancha_torneo;
CREATE POLICY "Lectura publica disponibilidad_cancha_torneo" ON public.disponibilidad_cancha_torneo
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Escritura local disponibilidad_cancha_torneo" ON public.disponibilidad_cancha_torneo;
CREATE POLICY "Escritura local disponibilidad_cancha_torneo" ON public.disponibilidad_cancha_torneo
    FOR ALL USING (true) WITH CHECK (true);
