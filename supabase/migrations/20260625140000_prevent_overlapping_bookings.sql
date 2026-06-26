-- Trigger to prevent overlapping court bookings (alquileres_cancha)
CREATE OR REPLACE FUNCTION check_overlapping_booking()
RETURNS TRIGGER AS $$
DECLARE
    overlap_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM public.alquileres_cancha a
        WHERE a.cancha_id = NEW.cancha_id
          AND a.id IS DISTINCT FROM NEW.id
          AND a.estado_pago IN ('Aprobado', 'Pendiente')
          AND NEW.estado_pago IN ('Aprobado', 'Pendiente')
          -- Time overlap:
          AND NEW.hora_inicio < a.hora_fin
          AND NEW.hora_fin > a.hora_inicio
          -- Date / Recurrence overlap:
          AND (
              -- Case 1: Neither is weekly
              (NOT NEW.es_semanal AND NOT a.es_semanal AND a.fecha = NEW.fecha)
              OR
              -- Case 2: Both are weekly
              (NEW.es_semanal AND a.es_semanal 
               AND extract(dow from a.fecha) = extract(dow from NEW.fecha)
               AND NEW.fecha <= COALESCE(a.fecha_fin_recurrencia, '9999-12-31')
               AND a.fecha <= COALESCE(NEW.fecha_fin_recurrencia, '9999-12-31'))
              OR
              -- Case 3: a is weekly, NEW is not weekly
              (a.es_semanal AND NOT NEW.es_semanal
               AND extract(dow from a.fecha) = extract(dow from NEW.fecha)
               AND NEW.fecha >= a.fecha
               AND NEW.fecha <= COALESCE(a.fecha_fin_recurrencia, '9999-12-31'))
              OR
              -- Case 4: NEW is weekly, a is not weekly
              (NEW.es_semanal AND NOT a.es_semanal
               AND extract(dow from a.fecha) = extract(dow from NEW.fecha)
               AND a.fecha >= NEW.fecha
               AND a.fecha <= COALESCE(NEW.fecha_fin_recurrencia, '9999-12-31'))
          )
    ) INTO overlap_exists;

    IF overlap_exists THEN
        RAISE EXCEPTION 'La cancha ya se encuentra reservada u ocupada en ese horario y fecha.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_overlapping_booking ON public.alquileres_cancha;
CREATE TRIGGER trigger_check_overlapping_booking
BEFORE INSERT OR UPDATE ON public.alquileres_cancha
FOR EACH ROW
EXECUTE FUNCTION check_overlapping_booking();
