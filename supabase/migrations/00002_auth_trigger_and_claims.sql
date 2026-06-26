-- 1. Create a function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfiles_usuarios (id, nombre, email, rol)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuario ' || split_part(new.email, '@', 1)),
    new.email,
    'Jugador' -- Default role
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Create a function to inject custom claims (e.g. role) into the JWT
CREATE OR REPLACE FUNCTION public.set_claim(uid uuid, claim text, value jsonb)
RETURNS text AS $$
DECLARE
  status text;
BEGIN
  -- We update the auth.users table's raw_app_meta_data to include the claim
  UPDATE auth.users
  SET raw_app_meta_data = 
    raw_app_meta_data || 
    json_build_object(claim, value)::jsonb
  WHERE id = uid;
  
  RETURN 'OK';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger to sync role updates to custom claims
CREATE OR REPLACE FUNCTION public.sync_role_to_claims()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.rol IS DISTINCT FROM NEW.rol) THEN
    PERFORM public.set_claim(NEW.id, 'rol', to_jsonb(NEW.rol::text));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_perfil_rol_updated ON public.perfiles_usuarios;
CREATE TRIGGER on_perfil_rol_updated
  AFTER INSERT OR UPDATE OF rol ON public.perfiles_usuarios
  FOR EACH ROW EXECUTE PROCEDURE public.sync_role_to_claims();
