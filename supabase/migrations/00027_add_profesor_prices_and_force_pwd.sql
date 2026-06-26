-- Migración para precios de profesores en canchas y bandera de cambio de contraseña

-- 1. Agregar precios de profesor a canchas
ALTER TABLE public.canchas
ADD COLUMN IF NOT EXISTS precio_profesor_hora_dia DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS precio_profesor_hora_noche DECIMAL(10,2);

-- 2. Agregar bandera para forzar el cambio de contraseña en el primer inicio de sesión
ALTER TABLE public.perfiles_usuarios
ADD COLUMN IF NOT EXISTS requiere_cambio_password BOOLEAN DEFAULT FALSE;
