-- Función para verificar el cupo máximo
CREATE OR REPLACE FUNCTION public.check_clase_cupo()
RETURNS TRIGGER AS $$
DECLARE
  v_cupo_maximo INT;
  v_reservas_actuales INT;
BEGIN
  -- 1. Obtener el cupo_maximo de la clase
  SELECT cupo_maximo INTO v_cupo_maximo
  FROM public.clases_disponibles
  WHERE id = NEW.clase_id;

  -- 2. Contar reservas aprobadas de esta clase (excluyendo la actual si es una actualización)
  SELECT COUNT(*) INTO v_reservas_actuales
  FROM public.reservas_clases
  WHERE clase_id = NEW.clase_id 
    AND estado_pago = 'Aprobado' 
    AND id <> COALESCE(NEW.id, -1);

  -- 3. Si se supera el cupo, lanzar excepción para revertir la transacción
  IF v_reservas_actuales >= v_cupo_maximo THEN
    RAISE EXCEPTION 'La clase ya se encuentra reservada o no quedan cupos disponibles.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que se ejecuta antes de insertar o actualizar el estado de pago a 'Aprobado'
CREATE OR REPLACE TRIGGER check_clase_cupo_trigger
BEFORE INSERT OR UPDATE ON public.reservas_clases
FOR EACH ROW
WHEN (NEW.estado_pago = 'Aprobado')
EXECUTE FUNCTION public.check_clase_cupo();
