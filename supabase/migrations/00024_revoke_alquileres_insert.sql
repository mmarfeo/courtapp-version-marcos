-- Borramos la política que permitía al frontend insertar alquileres directamente.
-- A partir de ahora, SOLO el backend con su llave privada (Service Role) podrá insertar reservas,
-- obligando a todo el mundo a pasar por las validaciones matemáticas de Vercel.
DROP POLICY IF EXISTS "Usuarios pueden insertar sus propios alquileres" ON alquileres_cancha;
