-- --------------------------------------------------------------------------------
-- Avance Automático de Bracket en Tiempo Real
-- --------------------------------------------------------------------------------

-- Esta función se dispara cuando se actualiza la tabla "partidos".
-- Si se declara un ganador (ganador_pareja IS NOT NULL), la función busca
-- el siguiente partido en el árbol (donde este partido es el previo de p1 o p2)
-- y actualiza automáticamente a los jugadores para que avancen de ronda.

CREATE OR REPLACE FUNCTION public.avanzar_ganador_bracket()
RETURNS trigger AS $$
DECLARE
  v_next_partido_id INT;
  v_ganador_p1_id UUID;
  v_ganador_p2_id UUID;
  v_posicion TEXT; -- Indica si avanza como p1 o p2 en el próximo partido
BEGIN
  -- Verificar si el partido acaba de recibir un resultado final (hubo cambio en ganador_pareja)
  IF NEW.ganador_pareja IS NOT NULL AND OLD.ganador_pareja IS DISTINCT FROM NEW.ganador_pareja THEN
    
    -- Determinar los IDs del jugador o pareja ganadora
    IF NEW.ganador_pareja = 1 THEN
      v_ganador_p1_id := NEW.p1_jugador_1_id;
      v_ganador_p2_id := NEW.p1_jugador_2_id;
    ELSIF NEW.ganador_pareja = 2 THEN
      v_ganador_p1_id := NEW.p2_jugador_1_id;
      v_ganador_p2_id := NEW.p2_jugador_2_id;
    END IF;

    -- Buscar si existe un partido de la siguiente fase esperando a este ganador como P1
    SELECT id INTO v_next_partido_id
    FROM public.partidos
    WHERE partido_previo_p1_id = NEW.id;

    IF v_next_partido_id IS NOT NULL THEN
      -- Actualizar P1 del siguiente partido
      UPDATE public.partidos
      SET p1_jugador_1_id = v_ganador_p1_id,
          p1_jugador_2_id = v_ganador_p2_id
      WHERE id = v_next_partido_id;
      
      -- Emitir notificación en tiempo real vía pg_notify (opcional para logs/chats)
      PERFORM pg_notify('bracket_update', 'El partido ' || v_next_partido_id || ' tiene un nuevo participante P1');
      RETURN NEW;
    END IF;

    -- Buscar si existe un partido de la siguiente fase esperando a este ganador como P2
    SELECT id INTO v_next_partido_id
    FROM public.partidos
    WHERE partido_previo_p2_id = NEW.id;

    IF v_next_partido_id IS NOT NULL THEN
      -- Actualizar P2 del siguiente partido
      UPDATE public.partidos
      SET p2_jugador_1_id = v_ganador_p1_id,
          p2_jugador_2_id = v_ganador_p2_id
      WHERE id = v_next_partido_id;
      
      PERFORM pg_notify('bracket_update', 'El partido ' || v_next_partido_id || ' tiene un nuevo participante P2');
      RETURN NEW;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear el trigger
DROP TRIGGER IF EXISTS on_partido_finalizado ON public.partidos;
CREATE TRIGGER on_partido_finalizado
  AFTER UPDATE OF ganador_pareja ON public.partidos
  FOR EACH ROW EXECUTE PROCEDURE public.avanzar_ganador_bracket();
