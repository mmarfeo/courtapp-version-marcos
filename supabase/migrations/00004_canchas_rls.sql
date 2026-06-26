-- --------------------------------------------------------------------------------
-- Políticas de canchas
-- --------------------------------------------------------------------------------

-- Lectura: Jugadores y SuperAdmins pueden ver todas las canchas activas.
-- Organizadores solo pueden ver las canchas de su propia organización, incluso si no están activas.
CREATE POLICY "Lectura de canchas"
ON canchas FOR SELECT
USING (
  activa = true OR
  public.es_superadmin() OR
  EXISTS (
    SELECT 1 FROM miembros_organizacion mo
    WHERE mo.organizacion_id = canchas.organizacion_id
    AND mo.usuario_id = auth.uid()
    AND (SELECT rol FROM perfiles_usuarios WHERE id = auth.uid()) = 'Organizador'
  )
);

-- Escritura (Insert/Update/Delete): Solo Organizadores de la misma organización o SuperAdmin.
CREATE POLICY "Organizadores insertan canchas de su org"
ON canchas FOR INSERT
WITH CHECK (
  public.es_superadmin() OR
  EXISTS (
    SELECT 1 FROM miembros_organizacion mo
    WHERE mo.organizacion_id = organizacion_id
    AND mo.usuario_id = auth.uid()
    AND (SELECT rol FROM perfiles_usuarios WHERE id = auth.uid()) = 'Organizador'
  )
);

CREATE POLICY "Organizadores actualizan canchas de su org"
ON canchas FOR UPDATE
USING (
  public.es_superadmin() OR
  EXISTS (
    SELECT 1 FROM miembros_organizacion mo
    WHERE mo.organizacion_id = canchas.organizacion_id
    AND mo.usuario_id = auth.uid()
    AND (SELECT rol FROM perfiles_usuarios WHERE id = auth.uid()) = 'Organizador'
  )
);

CREATE POLICY "Organizadores eliminan canchas de su org"
ON canchas FOR DELETE
USING (
  public.es_superadmin() OR
  EXISTS (
    SELECT 1 FROM miembros_organizacion mo
    WHERE mo.organizacion_id = canchas.organizacion_id
    AND mo.usuario_id = auth.uid()
    AND (SELECT rol FROM perfiles_usuarios WHERE id = auth.uid()) = 'Organizador'
  )
);

-- --------------------------------------------------------------------------------
-- Políticas de alquileres_cancha
-- --------------------------------------------------------------------------------

-- Lectura: El jugador dueño del alquiler, el organizador de la cancha o el SuperAdmin.
CREATE POLICY "Lectura de alquileres"
ON alquileres_cancha FOR SELECT
USING (
  public.es_superadmin() OR
  usuario_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM canchas c
    JOIN miembros_organizacion mo ON mo.organizacion_id = c.organizacion_id
    WHERE c.id = alquileres_cancha.cancha_id
    AND mo.usuario_id = auth.uid()
    AND (SELECT rol FROM perfiles_usuarios WHERE id = auth.uid()) = 'Organizador'
  )
);

-- Inserción: Cualquier jugador activo puede solicitar un alquiler.
CREATE POLICY "Jugadores pueden solicitar alquiler"
ON alquileres_cancha FOR INSERT
WITH CHECK (
  usuario_id = auth.uid()
);
