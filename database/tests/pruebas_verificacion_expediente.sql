-- ============================================================================
-- KouriGo — Pruebas de autorización: verificación de repartidores (Etapa 2)
-- Fuente: docs/operations/courier-identity-verification.md (secciones 4, 6,
-- 7, 8, 9 y 10). Cubre el flujo de revisión completo, el aislamiento de
-- documentos en Storage y los accesos permitidos y denegados por rol.
-- Fixtures de prueba: NO son datos reales de operación.
-- ============================================================================
\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------------
-- Preparación (superusuario)
--   P: candidato principal    Q: segundo candidato
--   R: cliente                S: administrador/revisor
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-4000-8000-0000000000c1', 'candidato-p@prueba.kourigo.local'),
  ('a0000000-0000-4000-8000-0000000000c2', 'candidato-q@prueba.kourigo.local'),
  ('a0000000-0000-4000-8000-0000000000c3', 'cliente-r@prueba.kourigo.local'),
  ('a0000000-0000-4000-8000-0000000000c4', 'admin-s@prueba.kourigo.local');

INSERT INTO public.user_roles (user_id, role) VALUES
  ('a0000000-0000-4000-8000-0000000000c1', 'courier'),
  ('a0000000-0000-4000-8000-0000000000c2', 'courier'),
  ('a0000000-0000-4000-8000-0000000000c3', 'customer'),
  ('a0000000-0000-4000-8000-0000000000c4', 'admin');

INSERT INTO public.courier_profiles (user_id, verification_status, account_active) VALUES
  ('a0000000-0000-4000-8000-0000000000c1', 'draft', true),
  ('a0000000-0000-4000-8000-0000000000c2', 'draft', true);

-- Pedido del cliente R con oferta para P: prueba de habilitación operativa.
INSERT INTO public.orders (
  id, client_id, order_type, status, pickup_address_text, dropoff_address_text,
  currency, service_fee_amount
) VALUES (
  'b0000000-0000-4000-8000-0000000000c1',
  'a0000000-0000-4000-8000-0000000000c3',
  'delivery', 'pending', 'Direccion de recogida de prueba', 'Direccion de destino de prueba',
  'HTG', 15000
);

UPDATE public.orders SET status = 'offered' WHERE id = 'b0000000-0000-4000-8000-0000000000c1';

INSERT INTO public.order_assignments (order_id, courier_user_id, status) VALUES
  ('b0000000-0000-4000-8000-0000000000c1', 'a0000000-0000-4000-8000-0000000000c1', 'offered');

-- ---------------------------------------------------------------------------
-- Fase 1 — candidato P: creación propia, presentación y límites
-- ---------------------------------------------------------------------------
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-0000000000c1"}';

DO $$
DECLARE
  bloqueado boolean := false;
  afectadas int := 0;
BEGIN
  BEGIN
    INSERT INTO public.courier_verification_cases (courier_user_id, status)
    VALUES ('a0000000-0000-4000-8000-0000000000c2', 'draft');
    GET DIAGNOSTICS afectadas = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado OR afectadas = 0,
    'un candidato no debe poder crear un expediente para otro usuario');
END $$;

DO $$
DECLARE
  bloqueado boolean := false;
  afectadas int := 0;
BEGIN
  BEGIN
    INSERT INTO public.courier_verification_cases
      (courier_user_id, status) VALUES (auth.uid(), 'submitted');
    GET DIAGNOSTICS afectadas = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado OR afectadas = 0,
    'el expediente debe crearse en draft; la presentación ocurre por transición');
END $$;

INSERT INTO public.courier_verification_cases (id, courier_user_id)
VALUES ('d0000000-0000-4000-8000-0000000000c1', 'a0000000-0000-4000-8000-0000000000c1');

SELECT public.afirmar(
  (SELECT status FROM public.courier_verification_cases
   WHERE id = 'd0000000-0000-4000-8000-0000000000c1') = 'draft',
  'el candidato crea su expediente en draft');

SELECT public.afirmar(
  (SELECT count(*) FROM public.courier_verification_events
   WHERE case_id = 'd0000000-0000-4000-8000-0000000000c1'
     AND event_type = 'status_changed' AND from_status IS NULL
     AND to_status = 'draft') = 1,
  'la creación del expediente queda auditada');

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.courier_verification_cases SET status = 'submitted'
    WHERE id = 'd0000000-0000-4000-8000-0000000000c1';
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado,
    'la presentación sin documentos debe bloquearse');
END $$;

SELECT public.afirmar(
  (SELECT status FROM public.courier_verification_cases
   WHERE id = 'd0000000-0000-4000-8000-0000000000c1') = 'draft',
  'el expediente sigue en draft tras el intento de presentación sin documentos');

-- Carga del objeto en su carpeta y del metadato del documento
INSERT INTO storage.objects (bucket_id, name, owner_id)
VALUES ('courier-identity-private',
        auth.uid()::text || '/selfie-1.jpg', auth.uid()::text);

SELECT public.afirmar(
  (SELECT count(*) FROM storage.objects
   WHERE bucket_id = 'courier-identity-private'
     AND name = auth.uid()::text || '/selfie-1.jpg') = 1,
  'el candidato sube documentos a su propia carpeta');

DO $$
DECLARE
  bloqueado boolean := false;
  afectadas int := 0;
BEGIN
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner_id)
    VALUES ('courier-identity-private',
            'a0000000-0000-4000-8000-0000000000c2' || '/invasion.jpg',
            auth.uid()::text);
    GET DIAGNOSTICS afectadas = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado OR afectadas = 0,
    'un candidato no debe poder escribir en la carpeta de otro');
END $$;

DO $$
DECLARE
  bloqueado boolean := false;
  afectadas int := 0;
BEGIN
  BEGIN
    INSERT INTO public.courier_verification_documents
      (case_id, courier_user_id, document_type, storage_bucket, storage_path)
    VALUES ('d0000000-0000-4000-8000-0000000000c1',
            'a0000000-0000-4000-8000-0000000000c2', 'selfie',
            'courier-identity-private', auth.uid()::text || '/ajena.jpg');
    GET DIAGNOSTICS afectadas = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado OR afectadas = 0,
    'un candidato no debe registrar documentos a nombre de otro usuario');
END $$;

DO $$
DECLARE
  bloqueado boolean := false;
  afectadas int := 0;
BEGIN
  BEGIN
    INSERT INTO public.courier_verification_documents
      (case_id, courier_user_id, document_type, storage_bucket, storage_path)
    VALUES ('d0000000-0000-4000-8000-0000000000c1', auth.uid(), 'selfie',
            'courier-identity-private', 'otra-carpeta/selfie.jpg');
    GET DIAGNOSTICS afectadas = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado OR afectadas = 0,
    'el metadato del documento debe apuntar a la carpeta propia del usuario');
END $$;

DO $$
DECLARE
  bloqueado boolean := false;
  afectadas int := 0;
BEGIN
  BEGIN
    INSERT INTO public.courier_verification_documents
      (case_id, courier_user_id, document_type, storage_bucket, storage_path)
    VALUES ('d0000000-0000-4000-8000-0000000000c1', auth.uid(), 'selfie',
            'otro-bucket', auth.uid()::text || '/selfie.jpg');
    GET DIAGNOSTICS afectadas = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado OR afectadas = 0,
    'los documentos de identidad solo se registran en el bucket privado de identidad');
END $$;

SELECT public.afirmar(
  (SELECT count(*) FROM public.courier_verification_documents) = 0,
  'ningún documento inválido quedó registrado');

INSERT INTO public.courier_verification_documents
  (case_id, courier_user_id, document_type, storage_bucket, storage_path)
VALUES ('d0000000-0000-4000-8000-0000000000c1', auth.uid(), 'selfie',
        'courier-identity-private', auth.uid()::text || '/selfie-1.jpg');

SELECT public.afirmar(
  (SELECT count(*) FROM public.courier_verification_documents
   WHERE case_id = 'd0000000-0000-4000-8000-0000000000c1') = 1,
  'el candidato registra el documento de su expediente');

SELECT public.afirmar(
  (SELECT count(*) FROM public.courier_verification_events
   WHERE case_id = 'd0000000-0000-4000-8000-0000000000c1'
     AND event_type = 'document_uploaded') = 1,
  'la carga del documento queda auditada');

UPDATE public.courier_verification_cases SET status = 'submitted'
WHERE id = 'd0000000-0000-4000-8000-0000000000c1';

SELECT public.afirmar(
  (SELECT status FROM public.courier_verification_cases
   WHERE id = 'd0000000-0000-4000-8000-0000000000c1') = 'submitted'
  AND (SELECT submitted_at FROM public.courier_verification_cases
       WHERE id = 'd0000000-0000-4000-8000-0000000000c1') IS NOT NULL,
  'el candidato presenta su expediente con fecha de presentación');

SELECT public.afirmar(
  (SELECT verification_status FROM public.courier_profiles
   WHERE user_id = 'a0000000-0000-4000-8000-0000000000c1') = 'submitted',
  'el perfil del repartidor refleja el estado presentado');

SELECT public.afirmar(
  (SELECT count(*) FROM public.courier_verification_events
   WHERE case_id = 'd0000000-0000-4000-8000-0000000000c1'
     AND from_status = 'draft' AND to_status = 'submitted') = 1,
  'la presentación queda auditada');

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.courier_verification_cases SET status = 'approved'
    WHERE id = 'd0000000-0000-4000-8000-0000000000c1';
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado,
    'un candidato no debe poder aprobar su propio expediente');
END $$;

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.courier_verification_cases SET decision_reason = 'autodesignado'
    WHERE id = 'd0000000-0000-4000-8000-0000000000c1';
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado,
    'un candidato no debe poder modificar campos privilegiados del expediente');
END $$;

-- Tras la sincronización del sistema, la vía directa sigue bloqueada para el
-- candidato (la marca de sincronización no puede favorecerlo).
DO $$
DECLARE
  bloqueado boolean := false;
  afectadas int := 0;
BEGIN
  BEGIN
    UPDATE public.courier_profiles SET verification_status = 'approved'
    WHERE user_id = auth.uid();
    GET DIAGNOSTICS afectadas = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado OR afectadas = 0,
    'un candidato no debe cambiar verification_status directamente');
END $$;

UPDATE public.courier_profiles SET work_zone = 'Puerto Principe centro'
WHERE user_id = auth.uid();

SELECT public.afirmar(
  (SELECT work_zone FROM public.courier_profiles WHERE user_id = auth.uid())
    = 'Puerto Principe centro'
  AND (SELECT verification_status FROM public.courier_profiles
       WHERE user_id = auth.uid()) = 'submitted',
  'el candidato conserva la actualización de sus datos operativos');

-- ---------------------------------------------------------------------------
-- Fase 2 — candidato Q: aislamiento total del expediente ajeno
-- ---------------------------------------------------------------------------
RESET role;
RESET request.jwt.claims;

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-0000000000c2"}';

SELECT public.afirmar(
  (SELECT count(*) FROM public.courier_verification_cases
   WHERE id = 'd0000000-0000-4000-8000-0000000000c1') = 0,
  'un repartidor no debe leer el expediente de otro');

SELECT public.afirmar(
  (SELECT count(*) FROM public.courier_verification_documents
   WHERE case_id = 'd0000000-0000-4000-8000-0000000000c1') = 0,
  'un repartidor no debe leer documentos del expediente ajeno');

SELECT public.afirmar(
  (SELECT count(*) FROM public.courier_verification_events
   WHERE case_id = 'd0000000-0000-4000-8000-0000000000c1') = 0,
  'un repartidor no debe leer eventos del expediente ajeno');

SELECT public.afirmar(
  (SELECT count(*) FROM storage.objects
   WHERE bucket_id = 'courier-identity-private'
     AND name LIKE 'a0000000-0000-4000-8000-0000000000c1' || '/%') = 0,
  'un repartidor no debe ver objetos en la carpeta de otro');

DO $$
DECLARE
  bloqueado boolean := false;
  afectadas int := 0;
BEGIN
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner_id)
    VALUES ('courier-identity-private',
            'a0000000-0000-4000-8000-0000000000c1' || '/robo.jpg',
            auth.uid()::text);
    GET DIAGNOSTICS afectadas = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado OR afectadas = 0,
    'un repartidor no debe poder escribir en la carpeta de otro');
END $$;

INSERT INTO storage.objects (bucket_id, name, owner_id)
VALUES ('courier-identity-private',
        auth.uid()::text || '/selfie-1.jpg', auth.uid()::text);

SELECT public.afirmar(
  (SELECT count(*) FROM storage.objects
   WHERE bucket_id = 'courier-identity-private'
     AND name LIKE auth.uid()::text || '/%') = 1,
  'cada repartidor ve únicamente su propia carpeta');

DO $$
DECLARE
  bloqueado boolean := false;
  afectadas int := 0;
BEGIN
  BEGIN
    INSERT INTO public.courier_verification_documents
      (case_id, courier_user_id, document_type, storage_bucket, storage_path)
    VALUES ('d0000000-0000-4000-8000-0000000000c1', auth.uid(), 'passport',
            'courier-identity-private', auth.uid()::text || '/pasaporte.jpg');
    GET DIAGNOSTICS afectadas = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado OR afectadas = 0,
    'un repartidor no debe registrar documentos en el expediente ajeno');
END $$;

-- ---------------------------------------------------------------------------
-- Fase 3 — cliente R: sin acceso al expediente
-- ---------------------------------------------------------------------------
RESET role;
RESET request.jwt.claims;

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-0000000000c3"}';

SELECT public.afirmar(
  (SELECT count(*) FROM public.courier_verification_cases) = 0
  AND (SELECT count(*) FROM public.courier_verification_documents) = 0
  AND (SELECT count(*) FROM public.courier_verification_events) = 0
  AND (SELECT count(*) FROM storage.objects
       WHERE bucket_id = 'courier-identity-private'
         AND name LIKE auth.uid()::text || '/%') = 0,
  'un cliente no debe ver expedientes, documentos ni objetos de identidad');

-- ---------------------------------------------------------------------------
-- Fase 4 — revisión administrativa del expediente de P
-- ---------------------------------------------------------------------------
RESET role;
RESET request.jwt.claims;

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-0000000000c4"}';

DO $$
DECLARE
  bloqueado boolean := false;
  afectadas int := 0;
BEGIN
  BEGIN
    INSERT INTO public.courier_verification_cases
      (courier_user_id, status) VALUES ('a0000000-0000-4000-8000-0000000000c1', 'draft');
    GET DIAGNOSTICS afectadas = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado OR afectadas = 0,
    'la administración no debe crear expedientes ajenos: el candidato es el titular');
END $$;

UPDATE public.courier_verification_cases SET status = 'under_review'
WHERE id = 'd0000000-0000-4000-8000-0000000000c1';

SELECT public.afirmar(
  (SELECT review_started_at FROM public.courier_verification_cases
   WHERE id = 'd0000000-0000-4000-8000-0000000000c1') IS NOT NULL,
  'iniciar la revisión registra la fecha de inicio');

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.courier_verification_cases SET status = 'needs_information'
    WHERE id = 'd0000000-0000-4000-8000-0000000000c1';
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado,
    'solicitar información exige motivo registrado');
END $$;

UPDATE public.courier_verification_cases
SET status = 'needs_information',
    decision_reason = 'Falta el reverso de la cedula nacional'
WHERE id = 'd0000000-0000-4000-8000-0000000000c1';

SELECT public.afirmar(
  (SELECT decision_reason FROM public.courier_verification_cases
   WHERE id = 'd0000000-0000-4000-8000-0000000000c1')
    = 'Falta el reverso de la cedula nacional',
  'la solicitud de información muestra el motivo al candidato');

SELECT public.afirmar(
  (SELECT count(*) FROM public.courier_verification_events
   WHERE case_id = 'd0000000-0000-4000-8000-0000000000c1'
     AND to_status = 'needs_information'
     AND safe_metadata->>'motivo' = 'Falta el reverso de la cedula nacional') = 1,
  'la solicitud de información queda auditada con su motivo');

-- ---------------------------------------------------------------------------
-- Fase 5 — P subsana y presenta de nuevo; S aprueba con método y motivo
-- ---------------------------------------------------------------------------
RESET role;
RESET request.jwt.claims;

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-0000000000c1"}';

INSERT INTO storage.objects (bucket_id, name, owner_id)
VALUES ('courier-identity-private',
        auth.uid()::text || '/national-id-back.jpg', auth.uid()::text);

INSERT INTO public.courier_verification_documents
  (case_id, courier_user_id, document_type, storage_bucket, storage_path)
VALUES ('d0000000-0000-4000-8000-0000000000c1', auth.uid(), 'national_id_back',
        'courier-identity-private', auth.uid()::text || '/national-id-back.jpg');

UPDATE public.courier_verification_cases SET status = 'submitted'
WHERE id = 'd0000000-0000-4000-8000-0000000000c1';

SELECT public.afirmar(
  (SELECT decision_reason FROM public.courier_verification_cases
   WHERE id = 'd0000000-0000-4000-8000-0000000000c1') IS NULL
  AND (SELECT status FROM public.courier_verification_cases
       WHERE id = 'd0000000-0000-4000-8000-0000000000c1') = 'submitted',
  'tras subsanar, el motivo pendiente se limpia y el expediente vuelve a submitted');

RESET role;
RESET request.jwt.claims;

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-0000000000c4"}';

UPDATE public.courier_verification_cases SET status = 'under_review'
WHERE id = 'd0000000-0000-4000-8000-0000000000c1';

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.courier_verification_cases SET status = 'approved'
    WHERE id = 'd0000000-0000-4000-8000-0000000000c1';
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(bloqueado,
    'aprobar sin método ni motivo debe bloquearse');
END $$;

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.courier_verification_cases
    SET status = 'approved', decision_reason = 'Documentos completos'
    WHERE id = 'd0000000-0000-4000-8000-0000000000c1';
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(bloqueado,
    'aprobar sin método de verificación debe bloquearse');
END $$;

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.courier_verification_cases
    SET status = 'approved', verification_method = 'documental'
    WHERE id = 'd0000000-0000-4000-8000-0000000000c1';
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(bloqueado,
    'aprobar sin motivo debe bloquearse');
END $$;

UPDATE public.courier_verification_cases
SET status = 'approved', verification_method = 'documental',
    decision_reason = 'Documentos legibles y consistentes con los datos declarados'
WHERE id = 'd0000000-0000-4000-8000-0000000000c1';

SELECT public.afirmar(
  (SELECT decision_by FROM public.courier_verification_cases
   WHERE id = 'd0000000-0000-4000-8000-0000000000c1')
    = 'a0000000-0000-4000-8000-0000000000c4'
  AND (SELECT decision_at FROM public.courier_verification_cases
       WHERE id = 'd0000000-0000-4000-8000-0000000000c1') IS NOT NULL,
  'la aprobación registra revisor y fecha');

SELECT public.afirmar(
  (SELECT verification_status FROM public.courier_profiles
   WHERE user_id = 'a0000000-0000-4000-8000-0000000000c1') = 'approved',
  'la aprobación se refleja en el perfil del repartidor');

UPDATE public.courier_verification_documents
SET review_status = 'accepted', review_notes = 'Selfie legible y consistente',
    reviewed_by = auth.uid(), reviewed_at = now()
WHERE case_id = 'd0000000-0000-4000-8000-0000000000c1' AND document_type = 'selfie';

SELECT public.afirmar(
  (SELECT count(*) FROM public.courier_verification_events
   WHERE case_id = 'd0000000-0000-4000-8000-0000000000c1'
     AND event_type = 'document_reviewed'
     AND safe_metadata->>'review_status' = 'accepted') = 1,
  'la revisión del documento queda auditada');

-- ---------------------------------------------------------------------------
-- Fase 6 — P habilitado opera; la suspensión bloquea de inmediato
-- ---------------------------------------------------------------------------
RESET role;
RESET request.jwt.claims;

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-0000000000c1"}';

SELECT public.afirmar(
  (SELECT public.repartidor_aprobado()) = true,
  'el repartidor aprobado cumple la regla de habilitación');

SELECT public.afirmar(
  (SELECT count(*) FROM public.order_assignments
   WHERE order_id = 'b0000000-0000-4000-8000-0000000000c1') = 1,
  'el repartidor aprobado ve su oferta');

UPDATE public.order_assignments SET status = 'accepted'
WHERE order_id = 'b0000000-0000-4000-8000-0000000000c1'
  AND courier_user_id = 'a0000000-0000-4000-8000-0000000000c1';

SELECT public.afirmar(
  (SELECT status FROM public.order_assignments
   WHERE order_id = 'b0000000-0000-4000-8000-0000000000c1'
     AND courier_user_id = 'a0000000-0000-4000-8000-0000000000c1') = 'accepted',
  'el repartidor aprobado puede aceptar el pedido');

RESET role;
RESET request.jwt.claims;

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-0000000000c4"}';

UPDATE public.courier_verification_cases
SET status = 'suspended', decision_reason = 'Suspension preventiva por investigación interna'
WHERE id = 'd0000000-0000-4000-8000-0000000000c1';

SELECT public.afirmar(
  (SELECT verification_status FROM public.courier_profiles
   WHERE user_id = 'a0000000-0000-4000-8000-0000000000c1') = 'suspended',
  'la suspensión se refleja en el perfil');

RESET role;
RESET request.jwt.claims;

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-0000000000c1"}';

SELECT public.afirmar(
  (SELECT public.repartidor_aprobado()) = false,
  'el repartidor suspendido deja de cumplir la habilitación');

SELECT public.afirmar(
  (SELECT count(*) FROM public.order_assignments
   WHERE order_id = 'b0000000-0000-4000-8000-0000000000c1') = 0,
  'el repartidor suspendido no ve sus asignaciones');

-- ---------------------------------------------------------------------------
-- Fase 7 — reapertura, rechazo con motivo y nueva solicitud
-- ---------------------------------------------------------------------------
RESET role;
RESET request.jwt.claims;

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-0000000000c4"}';

UPDATE public.courier_verification_cases SET status = 'under_review'
WHERE id = 'd0000000-0000-4000-8000-0000000000c1';

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.courier_verification_cases SET status = 'rejected'
    WHERE id = 'd0000000-0000-4000-8000-0000000000c1';
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(bloqueado,
    'rechazar sin motivo debe bloquearse');
END $$;

UPDATE public.courier_verification_cases
SET status = 'rejected', decision_reason = 'La selfie no coincide con la cedula presentada'
WHERE id = 'd0000000-0000-4000-8000-0000000000c1';

SELECT public.afirmar(
  (SELECT verification_status FROM public.courier_profiles
   WHERE user_id = 'a0000000-0000-4000-8000-0000000000c1') = 'rejected',
  'el rechazo se refleja en el perfil');

RESET role;
RESET request.jwt.claims;

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-0000000000c1"}';

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.courier_verification_cases SET status = 'submitted'
    WHERE id = 'd0000000-0000-4000-8000-0000000000c1';
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(bloqueado,
    'un expediente rechazado exige una nueva solicitud, no una reactivación');
END $$;

-- Fase 8 — nueva solicitud tras el rechazo
INSERT INTO public.courier_verification_cases (id, courier_user_id)
VALUES ('d0000000-0000-4000-8000-0000000000c2', 'a0000000-0000-4000-8000-0000000000c1');

SELECT public.afirmar(
  (SELECT count(*) FROM public.courier_verification_cases
   WHERE courier_user_id = 'a0000000-0000-4000-8000-0000000000c1') = 2,
  'el historial conserva el caso rechazado y admite una nueva solicitud');

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.courier_verification_cases SET decision_reason = 'manipulado'
    WHERE id = 'd0000000-0000-4000-8000-0000000000c2';
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(bloqueado,
    'el candidato no puede tocar campos de decisión ni en un expediente nuevo');
END $$;

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.courier_verification_cases (courier_user_id, status)
    VALUES (auth.uid(), 'draft');
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(bloqueado,
    'solo puede existir un expediente activo por repartidor');
END $$;

-- ---------------------------------------------------------------------------
-- Fase 9 — Q: ciclo completo hasta la expiración por el sistema
-- ---------------------------------------------------------------------------
RESET role;
RESET request.jwt.claims;

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-0000000000c2"}';

INSERT INTO public.courier_verification_cases (id, courier_user_id)
VALUES ('d0000000-0000-4000-8000-0000000000c3', 'a0000000-0000-4000-8000-0000000000c2');

INSERT INTO storage.objects (bucket_id, name, owner_id)
VALUES ('courier-identity-private',
        auth.uid()::text || '/passport-1.jpg', auth.uid()::text);

INSERT INTO public.courier_verification_documents
  (case_id, courier_user_id, document_type, storage_bucket, storage_path)
VALUES ('d0000000-0000-4000-8000-0000000000c3', auth.uid(), 'passport',
        'courier-identity-private', auth.uid()::text || '/passport-1.jpg');

UPDATE public.courier_verification_cases SET status = 'submitted'
WHERE id = 'd0000000-0000-4000-8000-0000000000c3';

RESET role;
RESET request.jwt.claims;

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-0000000000c4"}';

UPDATE public.courier_verification_cases SET status = 'under_review'
WHERE id = 'd0000000-0000-4000-8000-0000000000c3';

UPDATE public.courier_verification_cases
SET status = 'verification_scheduled', verification_method = 'videoconferencia'
WHERE id = 'd0000000-0000-4000-8000-0000000000c3';

UPDATE public.courier_verification_cases SET status = 'under_review'
WHERE id = 'd0000000-0000-4000-8000-0000000000c3';

UPDATE public.courier_verification_cases
SET status = 'approved', verification_method = 'videoconferencia',
    decision_reason = 'Videoconferencia completada: identidad confirmada'
WHERE id = 'd0000000-0000-4000-8000-0000000000c3';

SELECT public.afirmar(
  (SELECT verification_status FROM public.courier_profiles
   WHERE user_id = 'a0000000-0000-4000-8000-0000000000c2') = 'approved',
  'la aprobación por videoconferencia se refleja en el perfil');

-- El sistema (sin sesión) aplica la política de vigencia
RESET role;
RESET request.jwt.claims;

UPDATE public.courier_verification_cases
SET status = 'expired', decision_reason = 'Politica de vigencia anual del expediente'
WHERE id = 'd0000000-0000-4000-8000-0000000000c3';

SELECT public.afirmar(
  (SELECT verification_status FROM public.courier_profiles
   WHERE user_id = 'a0000000-0000-4000-8000-0000000000c2') = 'expired',
  'la expiración por política se refleja en el perfil');

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-0000000000c2"}';

INSERT INTO public.courier_verification_cases (id, courier_user_id)
VALUES ('d0000000-0000-4000-8000-0000000000c4', 'a0000000-0000-4000-8000-0000000000c2');

SELECT public.afirmar(
  (SELECT count(*) FROM public.courier_verification_cases
   WHERE courier_user_id = 'a0000000-0000-4000-8000-0000000000c2') = 2,
  'tras la expiración, el repartidor puede iniciar una reverificación');

-- ---------------------------------------------------------------------------
-- Cierre — la administración ve todo; la auditoría consolidada es completa
-- ---------------------------------------------------------------------------
RESET role;
RESET request.jwt.claims;

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-0000000000c4"}';

SELECT public.afirmar(
  (SELECT count(*) FROM storage.objects
   WHERE bucket_id = 'courier-identity-private') = 4,
  'la administración puede revisar todos los documentos privados');

SELECT public.afirmar(
  (SELECT count(*) FROM public.courier_verification_events
   WHERE case_id = 'd0000000-0000-4000-8000-0000000000c1'
     AND event_type = 'status_changed') = 10,
  'el historial del caso de P contiene las diez transiciones auditadas');

ROLLBACK;
