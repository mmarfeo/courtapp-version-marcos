-- Migración: Agregar columna es_semanal a la tabla alquileres_cancha
ALTER TABLE public.alquileres_cancha 
ADD COLUMN IF NOT EXISTS es_semanal BOOLEAN DEFAULT FALSE;
