-- 1. Agregar columnas a clases_disponibles para permitir la recurrencia semanal
ALTER TABLE public.clases_disponibles
ADD COLUMN IF NOT EXISTS es_semanal BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fecha_fin_recurrencia DATE;

-- 2. Corregir y robustecer la función trigger de solapamientos
CREATE OR REPLACE FUNCTION check_overlapping_booking()
RETURNS TRIGGER AS $$
DECLARE
    overlap_exists BOOLEAN;
    class_overlap_exists BOOLEAN;
BEGIN
    -- 2.1 Comprobar solapamiento con otros alquileres (Aprobados o Pendientes)
    SELECT EXISTS (
        SELECT 1
        FROM public.alquileres_cancha a
        WHERE a.cancha_id = NEW.cancha_id
          AND a.id IS DISTINCT FROM NEW.id
          AND a.estado_pago IN ('Aprobado', 'Pendiente')
          AND NEW.estado_pago IN ('Aprobado', 'Pendiente')
          AND NEW.hora_inicio < a.hora_fin
          AND NEW.hora_fin > a.hora_inicio
          AND (
              -- Caso 1: Ninguno es semanal
              (NOT NEW.es_semanal AND NOT a.es_semanal AND a.fecha = NEW.fecha)
              OR
              -- Caso 2: Ambos son semanales
              (NEW.es_semanal AND a.es_semanal 
               AND extract(dow from a.fecha) = extract(dow from NEW.fecha)
               AND NEW.fecha <= COALESCE(a.fecha_fin_recurrencia, '9999-12-31')
               AND a.fecha <= COALESCE(NEW.fecha_fin_recurrencia, '9999-12-31'))
              OR
              -- Caso 3: El existente es semanal, el nuevo no
              (a.es_semanal AND NOT NEW.es_semanal
               AND extract(dow from a.fecha) = extract(dow from NEW.fecha)
               AND NEW.fecha >= a.fecha
               AND NEW.fecha <= COALESCE(a.fecha_fin_recurrencia, '9999-12-31'))
              OR
              -- Caso 4: El nuevo es semanal, el existente no
              (NEW.es_semanal AND NOT a.es_semanal
               AND extract(dow from a.fecha) = extract(dow from NEW.fecha)
               AND a.fecha >= NEW.fecha
               AND a.fecha <= COALESCE(NEW.fecha_fin_recurrencia, '9999-12-31'))
          )
    ) INTO overlap_exists;

    IF overlap_exists THEN
        RAISE EXCEPTION 'La cancha ya se encuentra reservada u ocupada en ese horario y fecha.';
    END IF;

    -- 2.2 Comprobar solapamiento con clases en clases_disponibles
    SELECT EXISTS (
        SELECT 1
        FROM public.clases_disponibles c
        WHERE c.cancha_id = NEW.cancha_id
          AND c.activa = true
          AND NEW.estado_pago IN ('Aprobado', 'Pendiente')
          AND NEW.hora_inicio < c.hora_fin
          AND NEW.hora_fin > c.hora_inicio
          AND (
              -- Caso 1: Ninguno es semanal
              (NOT NEW.es_semanal AND NOT c.es_semanal AND c.fecha = NEW.fecha)
              OR
              -- Caso 2: Ambos son semanales
              (NEW.es_semanal AND c.es_semanal 
               AND extract(dow from c.fecha) = extract(dow from NEW.fecha)
               AND NEW.fecha <= COALESCE(c.fecha_fin_recurrencia, '9999-12-31')
               AND c.fecha <= COALESCE(NEW.fecha_fin_recurrencia, '9999-12-31'))
              OR
              -- Caso 3: La clase es semanal, el nuevo alquiler no
              (c.es_semanal AND NOT NEW.es_semanal
               AND extract(dow from c.fecha) = extract(dow from NEW.fecha)
               AND NEW.fecha >= c.fecha
               AND NEW.fecha <= COALESCE(c.fecha_fin_recurrencia, '9999-12-31'))
              OR
              -- Caso 4: El nuevo alquiler es semanal, la clase no
              (NEW.es_semanal AND NOT c.es_semanal
               AND extract(dow from c.fecha) = extract(dow from NEW.fecha)
               AND c.fecha >= NEW.fecha
               AND c.fecha <= COALESCE(NEW.fecha_fin_recurrencia, '9999-12-31'))
          )
    ) INTO class_overlap_exists;

    IF class_overlap_exists THEN
        RAISE EXCEPTION 'La cancha tiene una clase programada en ese horario y fecha.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Eliminar las políticas RLS inseguras/públicas introducidas en el entorno de desarrollo local
DROP POLICY IF EXISTS "Permitir insert organizaciones" ON public.organizaciones;
DROP POLICY IF EXISTS "Permitir update organizaciones" ON public.organizaciones;
DROP POLICY IF EXISTS "Permitir delete organizaciones" ON public.organizaciones;
DROP POLICY IF EXISTS "Permitir insert torneos" ON public.torneos;
DROP POLICY IF EXISTS "Permitir update torneos" ON public.torneos;
DROP POLICY IF EXISTS "Permitir insert tarifas" ON public.tarifas_torneo;
DROP POLICY IF EXISTS "Permitir update tarifas" ON public.tarifas_torneo;
DROP POLICY IF EXISTS "Escritura local disponibilidad_cancha_semanal" ON public.disponibilidad_cancha_semanal;

-- 4. Recrear políticas de escritura/borrado seguras para organizaciones si no existen
-- Las organizaciones solo deben ser manejadas por SuperAdmins
CREATE POLICY "SuperAdmins insert organizaciones" ON public.organizaciones FOR INSERT
TO authenticated
WITH CHECK (public.es_superadmin() OR public.es_usuario_superadmin(auth.uid()));

CREATE POLICY "SuperAdmins update organizaciones" ON public.organizaciones FOR UPDATE
TO authenticated
USING (public.es_superadmin() OR public.es_usuario_superadmin(auth.uid()))
WITH CHECK (public.es_superadmin() OR public.es_usuario_superadmin(auth.uid()));

CREATE POLICY "SuperAdmins delete organizaciones" ON public.organizaciones FOR DELETE
TO authenticated
USING (public.es_superadmin() OR public.es_usuario_superadmin(auth.uid()));

-- 5. Reestablecer políticas para disponibilidad semanal
CREATE POLICY "SuperAdmin y Organizadores escriben disponibilidad semanal"
ON public.disponibilidad_cancha_semanal FOR ALL
TO authenticated
USING (
  public.es_superadmin() OR
  public.es_usuario_superadmin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.canchas c
    WHERE c.id = disponibilidad_cancha_semanal.cancha_id
    AND public.es_organizador_de_org(auth.uid(), c.organizacion_id)
  )
);

-- 6. Reemplazar "Lectura general de reservas" (vulnerabilidad de exposición de datos) por política restrictiva
DROP POLICY IF EXISTS "Lectura general de reservas" ON public.reservas_clases;

CREATE POLICY "Lectura general de reservas segura"
ON public.reservas_clases FOR SELECT
TO authenticated
USING (
  -- El propio alumno ve su reserva
  alumno_id = auth.uid()
  OR
  -- El profesor de la clase ve las reservas de su clase
  EXISTS (
    SELECT 1 FROM public.clases_disponibles c
    WHERE c.id = reservas_clases.clase_id
    AND c.profesor_id = auth.uid()
  )
  -- El organizador del club ve las reservas de su club
  OR EXISTS (
    SELECT 1 FROM public.clases_disponibles c
    WHERE c.id = reservas_clases.clase_id
    AND public.es_organizador_de_org(auth.uid(), c.organizacion_id)
  )
  -- El SuperAdmin ve todo
  OR public.es_superadmin()
  OR public.es_usuario_superadmin(auth.uid())
);
