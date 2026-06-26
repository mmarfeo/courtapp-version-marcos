-- 1. Agregar columna roles a perfiles_usuarios
ALTER TABLE perfiles_usuarios ADD COLUMN IF NOT EXISTS roles text[] DEFAULT ARRAY['Jugador'];

-- 2. Migrar usuarios existentes para tener sus roles correspondientes
UPDATE perfiles_usuarios
SET roles = CASE 
  WHEN rol = 'SuperAdmin' THEN ARRAY['SuperAdmin', 'Organizador', 'Profesor', 'Jugador']
  WHEN rol = 'Jugador' THEN ARRAY['Jugador']
  ELSE ARRAY[rol::text, 'Jugador']
END;

-- 3. Actualizar la función handle_new_user para que asigne el array roles inicial
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfiles_usuarios (id, nombre, email, rol, roles)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuario ' || split_part(new.email, '@', 1)),
    new.email,
    'Jugador',
    ARRAY['Jugador']
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Actualizar la función prevenir_cambio_rol para validar que el rol destino esté en el array roles
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
  IF NEW.rol IS DISTINCT FROM OLD.rol AND NOT (NEW.rol::text = ANY(OLD.roles)) THEN
    RAISE EXCEPTION 'No tienes permisos para cambiar a este rol.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
