-- Políticas para la tabla inscripciones_torneo
DROP POLICY IF EXISTS "Lectura publica de inscripciones" ON inscripciones_torneo;
CREATE POLICY "Lectura publica de inscripciones" 
ON inscripciones_torneo FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Usuarios insertan sus inscripciones" ON inscripciones_torneo;
CREATE POLICY "Usuarios insertan sus inscripciones" 
ON inscripciones_torneo FOR INSERT 
WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Usuarios actualizan sus inscripciones" ON inscripciones_torneo;
CREATE POLICY "Usuarios actualizan sus inscripciones" 
ON inscripciones_torneo FOR UPDATE 
USING (auth.uid() = usuario_id);

-- Políticas para la tabla propuestas_disponibilidad
DROP POLICY IF EXISTS "Lectura publica de disponibilidad" ON propuestas_disponibilidad;
CREATE POLICY "Lectura publica de disponibilidad" 
ON propuestas_disponibilidad FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Usuarios insertan su disponibilidad" ON propuestas_disponibilidad;
CREATE POLICY "Usuarios insertan su disponibilidad" 
ON propuestas_disponibilidad FOR INSERT 
WITH CHECK (auth.uid() = jugador_1_id);

DROP POLICY IF EXISTS "Usuarios actualizan su disponibilidad" ON propuestas_disponibilidad;
CREATE POLICY "Usuarios actualizan su disponibilidad" 
ON propuestas_disponibilidad FOR UPDATE 
USING (auth.uid() = jugador_1_id);
