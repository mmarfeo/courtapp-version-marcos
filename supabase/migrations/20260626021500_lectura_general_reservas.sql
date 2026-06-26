-- Eliminar las politicas anteriores si existen para reemplazarlas
DROP POLICY IF EXISTS "Alumnos ven sus reservas" ON reservas_clases;
DROP POLICY IF EXISTS "Profesores ven reservas de sus clases" ON reservas_clases;

-- Permitir que CUALQUIER usuario autenticado vea las reservas
-- Esto es necesario para que la app pueda calcular correctamente si una clase esta llena
-- sumando todos los cupos ocupados, sin importar quien los haya reservado.
CREATE POLICY "Lectura general de reservas"
ON reservas_clases FOR SELECT
USING (auth.role() = 'authenticated' OR public.es_superadmin());
