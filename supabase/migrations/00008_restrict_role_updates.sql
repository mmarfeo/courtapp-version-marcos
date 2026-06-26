-- 1. Función para chequear si el usuario logueado originalmente tiene el correo del SuperAdmin
CREATE OR REPLACE FUNCTION public.es_cuenta_superadmin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'nicortiz29@gmail.com'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Función de trigger para evitar que un usuario altere su propio rol a menos que sea el SuperAdmin de pruebas
CREATE OR REPLACE FUNCTION public.prevenir_cambio_rol()
RETURNS trigger AS $$
BEGIN
  IF NEW.rol IS DISTINCT FROM OLD.rol AND NOT public.es_cuenta_superadmin() THEN
    RAISE EXCEPTION 'No tienes permisos para modificar el rol de usuario.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear el trigger en la tabla perfiles_usuarios
DROP TRIGGER IF EXISTS check_rol_update ON public.perfiles_usuarios;
CREATE TRIGGER check_rol_update
  BEFORE UPDATE OF rol ON public.perfiles_usuarios
  FOR EACH ROW EXECUTE PROCEDURE public.prevenir_cambio_rol();
