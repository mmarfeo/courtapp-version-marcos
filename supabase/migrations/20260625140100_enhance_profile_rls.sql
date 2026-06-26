-- Restricción de lectura de perfiles de usuario
DROP POLICY IF EXISTS "Lectura publica de perfiles" ON perfiles_usuarios;
DROP POLICY IF EXISTS "Permitir lectura publica perfiles" ON perfiles_usuarios;

CREATE POLICY "Lectura de perfiles para usuarios autenticados"
ON perfiles_usuarios FOR SELECT
TO authenticated
USING (true);
