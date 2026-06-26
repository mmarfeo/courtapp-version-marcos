-- 1. Agregar columna fecha_fin_recurrencia a alquileres_cancha
ALTER TABLE public.alquileres_cancha
ADD COLUMN IF NOT EXISTS fecha_fin_recurrencia DATE;

-- 2. Crear tabla de notificaciones pendientes
CREATE TABLE IF NOT EXISTS public.notificaciones_pendientes (
    id SERIAL PRIMARY KEY,
    usuario_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    cuerpo TEXT NOT NULL,
    estado VARCHAR(50) DEFAULT 'Pendiente',
    creado_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Habilitar RLS para notificaciones (solo lectura para el dueño)
ALTER TABLE public.notificaciones_pendientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios ven sus notificaciones" ON public.notificaciones_pendientes
FOR SELECT USING (auth.uid() = usuario_id);

-- 3. Trigger para cambio de precios de profesor en canchas
CREATE OR REPLACE FUNCTION notify_profesores_on_price_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.precio_profesor_hora_dia IS DISTINCT FROM OLD.precio_profesor_hora_dia) OR 
       (NEW.precio_profesor_hora_noche IS DISTINCT FROM OLD.precio_profesor_hora_noche) THEN
       
       -- Insertar notificación para los profesores con alquileres futuros en esta cancha
       INSERT INTO public.notificaciones_pendientes (usuario_id, titulo, cuerpo)
       SELECT DISTINCT a.usuario_id, 
              'Cambio de precio de alquiler', 
              'El precio de alquiler de la cancha ' || NEW.numero_cancha || ' ha sido actualizado a $' || COALESCE(NEW.precio_profesor_hora_dia, 0) || ' / $' || COALESCE(NEW.precio_profesor_hora_noche, 0) || '. Tus próximas reservas reflejarán este cambio.'
       FROM public.alquileres_cancha a
       JOIN public.perfiles_usuarios u ON u.id = a.usuario_id
       WHERE a.cancha_id = NEW.id AND a.fecha >= CURRENT_DATE AND u.rol = 'Profesor';
       
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_profesores_on_price_change ON public.canchas;
CREATE TRIGGER trigger_notify_profesores_on_price_change
AFTER UPDATE ON public.canchas
FOR EACH ROW
EXECUTE FUNCTION notify_profesores_on_price_change();
