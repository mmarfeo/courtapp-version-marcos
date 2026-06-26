-- 1. Corregir la función prevenir_cambio_rol para validar contra NEW.roles en lugar de OLD.roles
CREATE OR REPLACE FUNCTION public.prevenir_cambio_rol()
RETURNS trigger AS $$
BEGIN
  -- Si se ejecuta desde el CLI (por ejemplo, seed.sql), auth.uid() es nulo y permitimos el cambio
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- El SuperAdmin de pruebas (nicortiz29@gmail.com) puede cambiar a cualquier rol
  IF public.es_cuenta_superadmin() THEN
    RETURN NEW;
  END IF;

  -- Para otros usuarios, el nuevo rol activo DEBE estar dentro de sus roles asignados
  -- Corregido: se evalúa contra NEW.roles para permitir la actualización simultánea de rol y roles en la misma query.
  IF NEW.rol IS DISTINCT FROM OLD.rol AND NOT (NEW.rol::text = ANY(NEW.roles)) THEN
    RAISE EXCEPTION 'No tienes permisos para cambiar a este rol.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Políticas RLS para organizaciones (Clubes)
DROP POLICY IF EXISTS "Permitir insert organizaciones" ON organizaciones;
CREATE POLICY "Permitir insert organizaciones" ON organizaciones FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir update organizaciones" ON organizaciones;
CREATE POLICY "Permitir update organizaciones" ON organizaciones FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir delete organizaciones" ON organizaciones;
CREATE POLICY "Permitir delete organizaciones" ON organizaciones FOR DELETE USING (true);

-- 3. Políticas RLS para torneos
DROP POLICY IF EXISTS "Permitir lectura publica torneos" ON torneos;
CREATE POLICY "Permitir lectura publica torneos" ON torneos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insert torneos" ON torneos;
CREATE POLICY "Permitir insert torneos" ON torneos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir update torneos" ON torneos;
CREATE POLICY "Permitir update torneos" ON torneos FOR UPDATE USING (true) WITH CHECK (true);

-- 4. Políticas RLS para tarifas_torneo
DROP POLICY IF EXISTS "Permitir lectura publica tarifas" ON tarifas_torneo;
CREATE POLICY "Permitir lectura publica tarifas" ON tarifas_torneo FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insert tarifas" ON tarifas_torneo;
CREATE POLICY "Permitir insert tarifas" ON tarifas_torneo FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir update tarifas" ON tarifas_torneo;
CREATE POLICY "Permitir update tarifas" ON tarifas_torneo FOR UPDATE USING (true) WITH CHECK (true);

-- 5. Políticas RLS para partidos
DROP POLICY IF EXISTS "Permitir lectura publica partidos" ON partidos;
CREATE POLICY "Permitir lectura publica partidos" ON partidos FOR SELECT USING (true);

-- 6. Políticas RLS para perfiles_usuarios
DROP POLICY IF EXISTS "Permitir lectura publica perfiles" ON perfiles_usuarios;
CREATE POLICY "Permitir lectura publica perfiles" ON perfiles_usuarios FOR SELECT USING (true);
