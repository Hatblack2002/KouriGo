-- ============================================================================
-- KouriGo — Migración 0003: cada decisión del expediente exige motivo fresco
--
-- Corrección detectada por la primera ejecución real (run 43435621456):
-- al reabrir la revisión (suspended->under_review) el trigger conservaba el
-- decision_reason de la decisión anterior, de modo que un rechazo sin motivo
-- nuevo pasaba la validación. Al entrar en under_review se cierra el ciclo
-- de decisión anterior; los motivos previos quedan en el historial de
-- courier_verification_events. Ver docs/decisions/ADR-0004.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.validar_transicion_expediente() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor text;
  v_par text;
  v_permitido boolean;
BEGIN
  IF NEW.courier_user_id IS DISTINCT FROM OLD.courier_user_id THEN
    RAISE EXCEPTION 'El titular del expediente no puede cambiarse';
  END IF;

  -- El actor se determina SOLO en el servidor, nunca desde el cliente.
  IF public.es_admin() THEN
    v_actor := 'administrador';
  ELSIF OLD.courier_user_id = auth.uid() THEN
    v_actor := 'candidato';
  ELSIF auth.uid() IS NULL THEN
    v_actor := 'sistema';
  ELSE
    RAISE EXCEPTION 'El usuario no tiene permiso para modificar este expediente';
  END IF;

  IF v_actor = 'candidato' THEN
    -- El candidato solo puede cambiar el estado; ningún campo privilegiado.
    IF NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       OR NEW.review_started_at IS DISTINCT FROM OLD.review_started_at
       OR NEW.decision_at IS DISTINCT FROM OLD.decision_at
       OR NEW.decision_by IS DISTINCT FROM OLD.decision_by
       OR NEW.decision_reason IS DISTINCT FROM OLD.decision_reason
       OR NEW.verification_method IS DISTINCT FROM OLD.verification_method THEN
      RAISE EXCEPTION 'Un candidato solo puede cambiar el estado de su expediente';
    END IF;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_par := OLD.status || '->' || NEW.status;

  IF v_actor = 'candidato' THEN
    v_permitido := v_par IN (
      'draft->submitted', 'needs_information->submitted', 'reverification_required->submitted'
    );
    IF v_permitido THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.courier_verification_documents d WHERE d.case_id = OLD.id
      ) THEN
        RAISE EXCEPTION 'La presentación del expediente exige al menos un documento cargado';
      END IF;
      NEW.submitted_at := now();
      NEW.decision_reason := NULL;  -- el motivo anterior quedó atendido; el historial lo conserva
    END IF;
  ELSIF v_actor = 'administrador' THEN
    v_permitido := v_par IN (
      'submitted->under_review',
      'under_review->needs_information', 'needs_information->under_review',
      'under_review->verification_scheduled', 'verification_scheduled->under_review',
      'under_review->approved', 'under_review->rejected',
      'approved->suspended', 'approved->reverification_required', 'approved->expired',
      'suspended->under_review', 'expired->under_review'
    );
  ELSE
    -- Sistema: únicamente la expiración por política de vigencia.
    v_permitido := v_par = 'approved->expired';
  END IF;

  IF NOT v_permitido THEN
    RAISE EXCEPTION 'Transición del expediente no permitida (% para el actor %)', v_par, v_actor;
  END IF;

  -- Inicio de la revisión administrativa.
  IF NEW.status = 'under_review' AND OLD.review_started_at IS NULL THEN
    NEW.review_started_at := now();
  END IF;

  -- Al entrar en revisión se cierra el ciclo de decisión anterior: la
  -- siguiente decisión exige un motivo fresco (los motivos previos quedan
  -- en el historial de eventos del expediente).
  IF NEW.status = 'under_review' THEN
    NEW.decision_reason := NULL;
  END IF;

  -- Toda decisión administrativa registra motivo (secciones 5 y 10).
  IF NEW.status IN ('approved', 'rejected', 'suspended', 'reverification_required',
                    'expired', 'needs_information')
     AND (NEW.decision_reason IS NULL OR btrim(NEW.decision_reason) = '') THEN
    RAISE EXCEPTION 'La decisión % exige un motivo registrado', NEW.status;
  END IF;

  -- Toda decisión de habilitación o programación registra el método (sección 5).
  IF NEW.status IN ('verification_scheduled', 'approved')
     AND (NEW.verification_method IS NULL OR btrim(NEW.verification_method) = '') THEN
    RAISE EXCEPTION 'La decisión % exige registrar el método de verificación', NEW.status;
  END IF;

  IF NEW.status = 'approved' AND OLD.review_started_at IS NULL THEN
    RAISE EXCEPTION 'La aprobación exige una revisión iniciada previamente';
  END IF;

  IF NEW.status IN ('approved', 'rejected', 'suspended', 'reverification_required', 'expired') THEN
    NEW.decision_at := now();
    NEW.decision_by := CASE WHEN v_actor = 'administrador' THEN auth.uid() ELSE NEW.decision_by END;
  END IF;

  -- Auditoría del cambio: actor, fecha, caso y motivo (sección 9).
  INSERT INTO public.courier_verification_events
    (case_id, actor_user_id, event_type, from_status, to_status, safe_metadata)
  VALUES
    (OLD.id, auth.uid(), 'status_changed', OLD.status, NEW.status,
     jsonb_build_object(
       'actor_rol', v_actor,
       'motivo', NEW.decision_reason,
       'metodo', NEW.verification_method
     ));

  RETURN NEW;
END;
$$;

COMMIT;
