-- Migration to allow students to update their own class reservations (e.g., to cancel them)

CREATE POLICY "Alumnos actualizan sus reservas"
ON reservas_clases FOR UPDATE
USING (alumno_id = auth.uid());
