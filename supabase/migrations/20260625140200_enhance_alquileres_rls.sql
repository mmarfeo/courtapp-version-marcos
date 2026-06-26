-- Restricción de inserción de alquileres
DROP POLICY IF EXISTS "Jugadores pueden solicitar alquiler" ON alquileres_cancha;

CREATE POLICY "Jugadores pueden solicitar alquiler"
ON alquileres_cancha FOR INSERT
TO authenticated
WITH CHECK (
  usuario_id = auth.uid()
  AND (estado_pago = 'Pendiente' OR estado_pago IS NULL)
);
