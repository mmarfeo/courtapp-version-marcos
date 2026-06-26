-- --------------------------------------------------------------------------------
-- Parche: Políticas de mensajes_chat (Inclusión del Organizador)
-- --------------------------------------------------------------------------------

-- 1. Eliminar las políticas previas para evitar conflictos
DROP POLICY IF EXISTS "Participantes leen mensajes del partido" ON mensajes_chat;
DROP POLICY IF EXISTS "Participantes escriben mensajes" ON mensajes_chat;

-- 2. Nueva política de Lectura: Jugadores, SuperAdmin, Y Organizador del club
CREATE POLICY "Participantes y Organizador leen mensajes"
ON mensajes_chat FOR SELECT
USING (
  public.es_superadmin() OR
  remitente_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM partidos p
    WHERE p.id = mensajes_chat.partido_id
    AND (
      -- Jugador inscripto
      p.p1_jugador_1_id = auth.uid() OR p.p1_jugador_2_id = auth.uid() OR
      p.p2_jugador_1_id = auth.uid() OR p.p2_jugador_2_id = auth.uid()
      OR
      -- Organizador dueño de la cancha donde se juega (o del torneo)
      EXISTS (
        SELECT 1 FROM torneos t
        JOIN miembros_organizacion mo ON mo.organizacion_id = t.organizacion_id
        WHERE t.id = p.torneo_id
        AND mo.usuario_id = auth.uid()
        AND (SELECT rol FROM perfiles_usuarios WHERE id = auth.uid()) = 'Organizador'
      )
    )
  )
);

-- 3. Nueva política de Escritura
CREATE POLICY "Participantes y Organizador escriben mensajes"
ON mensajes_chat FOR INSERT
WITH CHECK (
  remitente_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM partidos p
    WHERE p.id = partido_id
    AND (
      p.p1_jugador_1_id = auth.uid() OR p.p1_jugador_2_id = auth.uid() OR
      p.p2_jugador_1_id = auth.uid() OR p.p2_jugador_2_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM torneos t
        JOIN miembros_organizacion mo ON mo.organizacion_id = t.organizacion_id
        WHERE t.id = p.torneo_id
        AND mo.usuario_id = auth.uid()
        AND (SELECT rol FROM perfiles_usuarios WHERE id = auth.uid()) = 'Organizador'
      )
    )
  )
);
