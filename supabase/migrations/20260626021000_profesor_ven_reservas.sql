-- Permitir que los profesores vean las reservas de sus propias clases
CREATE POLICY "Profesores ven reservas de sus clases"
ON reservas_clases FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clases_disponibles c
    WHERE c.id = reservas_clases.clase_id
    AND c.profesor_id = auth.uid()
  )
);

-- Arreglar las reservas antiguas que no tenian fecha_pago (para que aparezcan en el dashboard)
UPDATE reservas_clases 
SET fecha_pago = CURRENT_TIMESTAMP 
WHERE estado_pago = 'Aprobado' AND fecha_pago IS NULL;
