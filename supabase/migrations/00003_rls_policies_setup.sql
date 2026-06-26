-- Habilitar RLS en todas las tablas
ALTER TABLE organizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE miembros_organizacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE canchas ENABLE ROW LEVEL SECURITY;
ALTER TABLE clases_disponibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas_clases ENABLE ROW LEVEL SECURITY;
ALTER TABLE torneos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarifas_torneo ENABLE ROW LEVEL SECURITY;
ALTER TABLE inscripciones_torneo ENABLE ROW LEVEL SECURITY;
ALTER TABLE alquileres_cancha ENABLE ROW LEVEL SECURITY;
ALTER TABLE propuestas_disponibilidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE partidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes_chat ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------------
-- Funciones Auxiliares para Políticas
-- --------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rol_usuario() RETURNS text AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.rol', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.es_superadmin() RETURNS boolean AS $$
  SELECT public.rol_usuario() = '"SuperAdmin"';
$$ LANGUAGE sql STABLE;

-- --------------------------------------------------------------------------------
-- Políticas de perfiles_usuarios
-- --------------------------------------------------------------------------------

CREATE POLICY "Lectura publica de perfiles" 
ON perfiles_usuarios FOR SELECT 
USING (true);

CREATE POLICY "Usuarios actualizan su propio perfil" 
ON perfiles_usuarios FOR UPDATE 
USING (auth.uid() = id);

-- --------------------------------------------------------------------------------
-- Políticas de organizaciones
-- --------------------------------------------------------------------------------

-- Todos los usuarios autenticados pueden ver organizaciones activas
CREATE POLICY "Lectura publica de organizaciones activas" 
ON organizaciones FOR SELECT 
USING (activa = true OR public.es_superadmin());

-- --------------------------------------------------------------------------------
-- Políticas de miembros_organizacion
-- --------------------------------------------------------------------------------

-- Organizadores leen miembros de su organización
CREATE POLICY "Organizadores leen miembros de su org"
ON miembros_organizacion FOR SELECT
USING (
  usuario_id = auth.uid() OR
  public.es_superadmin() OR
  EXISTS (
    SELECT 1 FROM miembros_organizacion mo
    WHERE mo.organizacion_id = miembros_organizacion.organizacion_id
    AND mo.usuario_id = auth.uid()
    AND (SELECT rol FROM perfiles_usuarios WHERE id = auth.uid()) = 'Organizador'
  )
);

-- --------------------------------------------------------------------------------
-- Políticas de clases_disponibles
-- --------------------------------------------------------------------------------

CREATE POLICY "Lectura publica de clases disponibles"
ON clases_disponibles FOR SELECT
USING (activa = true);

-- Profesores pueden insertar/actualizar sus propias clases
CREATE POLICY "Profesores manejan sus clases"
ON clases_disponibles FOR ALL
USING (profesor_id = auth.uid());

-- --------------------------------------------------------------------------------
-- Políticas de mensajes_chat
-- --------------------------------------------------------------------------------

-- Solo los involucrados en un partido pueden leer y escribir
CREATE POLICY "Participantes leen mensajes del partido"
ON mensajes_chat FOR SELECT
USING (
  public.es_superadmin() OR
  remitente_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM partidos p
    WHERE p.id = mensajes_chat.partido_id
    AND (
      p.p1_jugador_1_id = auth.uid() OR p.p1_jugador_2_id = auth.uid() OR
      p.p2_jugador_1_id = auth.uid() OR p.p2_jugador_2_id = auth.uid()
    )
  )
);

CREATE POLICY "Participantes escriben mensajes"
ON mensajes_chat FOR INSERT
WITH CHECK (
  remitente_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM partidos p
    WHERE p.id = partido_id
    AND (
      p.p1_jugador_1_id = auth.uid() OR p.p1_jugador_2_id = auth.uid() OR
      p.p2_jugador_1_id = auth.uid() OR p.p2_jugador_2_id = auth.uid()
    )
  )
);

-- Políticas de reservas_clases
CREATE POLICY "Alumnos ven sus reservas"
ON reservas_clases FOR SELECT
USING (alumno_id = auth.uid() OR public.es_superadmin());

CREATE POLICY "Alumnos insertan sus reservas"
ON reservas_clases FOR INSERT
WITH CHECK (alumno_id = auth.uid());

-- Políticas de torneos
CREATE POLICY "Lectura publica de torneos"
ON torneos FOR SELECT
USING (true);

-- Políticas de tarifas_torneo
CREATE POLICY "Lectura publica de tarifas_torneo"
ON tarifas_torneo FOR SELECT
USING (true);

-- Políticas de partidos
CREATE POLICY "Lectura publica de partidos"
ON partidos FOR SELECT
USING (true);
