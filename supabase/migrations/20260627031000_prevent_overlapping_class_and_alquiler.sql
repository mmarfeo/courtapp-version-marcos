-- Actualizar la función trigger para comprobar solapamiento tanto con otros alquileres
-- como con clases disponibles en la tabla clases_disponibles.

CREATE OR REPLACE FUNCTION check_overlapping_booking()
RETURNS TRIGGER AS $$
DECLARE
    overlap_exists BOOLEAN;
    class_overlap_exists BOOLEAN;
BEGIN
    -- 1. Comprobar solapamiento con otros alquileres (Aprobados o Pendientes)
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

    -- 2. Comprobar solapamiento con clases en clases_disponibles
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
               AND NEW.fecha <= COALESCE(NEW.fecha_fin_recurrencia, '9999-12-31')
               AND c.fecha <= COALESCE(NEW.fecha_fin_recurrencia, '9999-12-31'))
              OR
              -- Caso 3: La clase es semanal, el nuevo alquiler no
              (c.es_semanal AND NOT NEW.es_semanal
               AND extract(dow from c.fecha) = extract(dow from NEW.fecha)
               AND NEW.fecha >= c.fecha)
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
