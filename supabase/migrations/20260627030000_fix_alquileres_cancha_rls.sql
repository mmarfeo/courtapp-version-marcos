-- Actualizar la política de lectura de alquileres_cancha para permitir
-- que cualquier miembro de la organización (organizador, profesor, jugador)
-- pueda ver todos los alquileres de las canchas de su club.
-- Esto es necesario para mostrar disponibilidad en la grilla de canchas.

DROP POLICY IF EXISTS "Lectura de alquileres" ON alquileres_cancha;

CREATE POLICY "Lectura de alquileres"
ON alquileres_cancha FOR SELECT
USING (
  -- El dueño del alquiler siempre puede ver el suyo
  usuario_id = auth.uid()
  OR
  -- SuperAdmin ve todo
  public.es_superadmin()
  OR
  -- Cualquier miembro de la organización dueña de la cancha puede ver los alquileres
  EXISTS (
    SELECT 1 FROM canchas c
    JOIN miembros_organizacion mo ON mo.organizacion_id = c.organizacion_id
    WHERE c.id = alquileres_cancha.cancha_id
    AND mo.usuario_id = auth.uid()
  )
);
