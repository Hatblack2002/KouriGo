-- ============================================================================
-- KouriGo — Migración 0002: verificación de repartidores (Etapa 2)
--
-- Fuente: docs/operations/courier-identity-verification.md (secciones 4, 6,
-- 7, 8, 9 y 10) y docs/architecture/backend-supabase.md (secciones 4 y 5).
-- Crea el expediente de verificación (casos, documentos y eventos), el bucket
-- privado de Supabase Storage para documentos de identidad y sus políticas
-- de mínimo privilegio.
--
-- Decisiones registradas en docs/decisions/ADR-0004-verificacion-repartidores.md:
--   - courier_verification_cases es la fuente de la verdad del flujo de
--     revisión; courier_profiles.verification_status pasa a ser una
--     proyección sincronizada por trigger.
--   - Convención de carpetas por usuario en Storage: la primera carpeta del
--     objeto es auth.uid(); los nombres de archivo no llevan datos personales.
--   - Un solo expediente activo por repartidor (índice parcial único); los
--     casos rechazados o expirados quedan como historial.
--
-- Aplicable a Supabase y a PostgreSQL 16 + PostGIS (CI). En CI se aplica
-- antes database/ci/0001_emulacion_supabase_storage.sql, que crea el esquema
-- `storage` mínimo. En el proyecto real de Supabase ese esquema ya existe.
-- Idiomas: valores de estado según la especificación (en inglés); comentarios
-- en español.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Expediente: casos de verificación (especificación sección 6)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courier_verification_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_user_id uuid NOT NULL REFERENCES public.courier_profiles (user_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'under_review', 'needs_information',
    'verification_scheduled', 'approved', 'rejected', 'suspended',
    'expired', 'reverification_required'
  )),
  submitted_at timestamptz,
  review_started_at timestamptz,
  decision_at timestamptz,
  decision_by uuid REFERENCES auth.users (id),
  decision_reason text CHECK (decision_reason IS NULL OR length(btrim(decision_reason)) BETWEEN 1 AND 1000),
  verification_method text CHECK (verification_method IS NULL OR verification_method IN (
    'documental', 'videoconferencia', 'presencial'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Un solo expediente activo por repartidor; los rechazados y expirados
-- quedan como historial y permiten una nueva solicitud.
CREATE UNIQUE INDEX IF NOT EXISTS ux_casos_verificacion_activos
  ON public.courier_verification_cases (courier_user_id)
  WHERE status NOT IN ('rejected', 'expired');

-- ---------------------------------------------------------------------------
-- Documentos del expediente: metadatos y ruta privada del objeto, nunca
-- URL pública (backend-supabase.md sección 5). El número del documento no
-- se guarda en el nombre del archivo ni en los metadatos (sección 6).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courier_verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.courier_verification_cases (id) ON DELETE CASCADE,
  courier_user_id uuid NOT NULL REFERENCES public.courier_profiles (user_id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN (
    'national_id_front', 'national_id_back', 'passport', 'selfie',
    'certificate_good_conduct', 'driver_license'
  )),
  storage_bucket text NOT NULL,
  storage_path text NOT NULL CHECK (length(storage_path) BETWEEN 1 AND 500),
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'accepted', 'rejected')),
  review_notes text CHECK (review_notes IS NULL OR length(btrim(review_notes)) BETWEEN 1 AND 500),
  reviewed_by uuid REFERENCES auth.users (id),
  reviewed_at timestamptz,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, storage_path)
);

-- ---------------------------------------------------------------------------
-- Historial del expediente (auditoría sección 9): actor, caso, evento y
-- motivo de cada decisión, sin copiar contenido ni números de documento.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courier_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.courier_verification_cases (id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users (id),
  event_type text NOT NULL CHECK (event_type IN ('status_changed', 'document_uploaded', 'document_reviewed')),
  from_status text,
  to_status text,
  safe_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_casos_repartidor ON public.courier_verification_cases (courier_user_id);
CREATE INDEX IF NOT EXISTS idx_casos_status ON public.courier_verification_cases (status);
CREATE INDEX IF NOT EXISTS idx_documentos_caso ON public.courier_verification_documents (case_id);
CREATE INDEX IF NOT EXISTS idx_eventos_caso ON public.courier_verification_events (case_id, occurred_at);

-- ---------------------------------------------------------------------------
-- Bucket privado de identidad (backend-supabase.md sección 4: los documentos
-- KYC nunca en buckets públicos ni en Cloudinary).
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('courier-identity-private', 'courier-identity-private', false)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Flujo de revisión del expediente. Pares permitidos idénticos a
-- packages/domain/src/expediente.ts (mantener ambos listados sincronizados).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.preparar_expediente_nuevo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- El expediente nace en draft; la presentación exige documentos ya
  -- cargados y ocurre por transición (draft->submitted), no por inserción.
  IF NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'El expediente debe crearse en estado draft; la presentación ocurre por transición';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_creacion_expediente() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.courier_verification_events
    (case_id, actor_user_id, event_type, from_status, to_status, safe_metadata)
  VALUES
    (NEW.id, auth.uid(), 'status_changed', NULL, NEW.status,
     jsonb_build_object(
       'actor_rol',
       CASE
         WHEN public.es_admin() THEN 'administrador'
         WHEN NEW.courier_user_id = auth.uid() THEN 'candidato'
         ELSE 'sistema'
       END
     ));
  RETURN NEW;
END;
$$;

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

-- El estado del expediente se proyecta en courier_profiles.verification_status,
-- que es lo que consulta public.repartidor_aprobado() (migración 0001).
CREATE OR REPLACE FUNCTION public.sincronizar_estado_verificacion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Marca local a la transacción: el trigger de protección de
  -- courier_profiles distingue esta escritura del sistema de una escritura
  -- directa del candidato.
  PERFORM set_config('app.sincronizacion_expediente', '1', true);
  UPDATE public.courier_profiles
  SET verification_status = NEW.status
  WHERE user_id = NEW.courier_user_id
    AND verification_status IS DISTINCT FROM NEW.status;
  -- La marca se limpia de inmediato: es local a la transacción y, si no se
  -- resetea, protegería escrituras directas del candidato durante el resto
  -- de la misma transacción.
  PERFORM set_config('app.sincronizacion_expediente', '', true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preparar_expediente_nuevo ON public.courier_verification_cases;
CREATE TRIGGER trg_preparar_expediente_nuevo BEFORE INSERT ON public.courier_verification_cases
  FOR EACH ROW EXECUTE FUNCTION public.preparar_expediente_nuevo();

DROP TRIGGER IF EXISTS trg_evento_expediente_nuevo ON public.courier_verification_cases;
CREATE TRIGGER trg_evento_expediente_nuevo AFTER INSERT ON public.courier_verification_cases
  FOR EACH ROW EXECUTE FUNCTION public.registrar_creacion_expediente();

DROP TRIGGER IF EXISTS trg_validar_transicion_expediente ON public.courier_verification_cases;
CREATE TRIGGER trg_validar_transicion_expediente BEFORE UPDATE ON public.courier_verification_cases
  FOR EACH ROW EXECUTE FUNCTION public.validar_transicion_expediente();

DROP TRIGGER IF EXISTS trg_sincronizar_estado_verificacion ON public.courier_verification_cases;
CREATE TRIGGER trg_sincronizar_estado_verificacion AFTER INSERT OR UPDATE OF status
ON public.courier_verification_cases
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_estado_verificacion();

-- ---------------------------------------------------------------------------
-- Auditoría de documentos: carga y revisión (sección 9).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_evento_documento() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.courier_verification_events
    (case_id, actor_user_id, event_type, safe_metadata)
  VALUES
    (NEW.case_id, auth.uid(), 'document_uploaded',
     jsonb_build_object('document_id', NEW.id, 'document_type', NEW.document_type));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_revision_documento() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.review_status IS NOT DISTINCT FROM OLD.review_status THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.courier_verification_events
    (case_id, actor_user_id, event_type, safe_metadata)
  VALUES
    (NEW.case_id, auth.uid(), 'document_reviewed',
     jsonb_build_object('document_id', NEW.id, 'document_type', NEW.document_type,
                        'review_status', NEW.review_status));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evento_documento ON public.courier_verification_documents;
CREATE TRIGGER trg_evento_documento AFTER INSERT ON public.courier_verification_documents
  FOR EACH ROW EXECUTE FUNCTION public.registrar_evento_documento();

DROP TRIGGER IF EXISTS trg_evento_revision_documento ON public.courier_verification_documents;
CREATE TRIGGER trg_evento_revision_documento AFTER UPDATE OF review_status
ON public.courier_verification_documents
  FOR EACH ROW EXECUTE FUNCTION public.registrar_revision_documento();

-- ---------------------------------------------------------------------------
-- El candidato ya no cambia verification_status directamente: el estado se
-- gobierna SOLO mediante el expediente (sección 8: el cliente no puede
-- escribir directamente el estado de verificación). La administración
-- conserva la vía directa para correcciones.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proteger_estado_verificacion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF current_setting('app.sincronizacion_expediente', true) = '1' THEN
    RETURN NEW;  -- escritura del sistema desde el expediente
  END IF;
  IF public.es_admin() OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    RAISE EXCEPTION 'El estado de verificación se gobierna mediante el expediente de verificación';
  END IF;
  RETURN NEW;
END;
$$;

-- La política de actualización propia de courier_profiles (migración 0001)
-- se mantiene; la restricción del estado ahora vive en el trigger anterior.
DROP POLICY IF EXISTS "courier_actualizar_expediente_propio" ON public.courier_profiles;
CREATE POLICY "courier_actualizar_expediente_propio" ON public.courier_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS del expediente: activado en las tres tablas nuevas.
-- ---------------------------------------------------------------------------
ALTER TABLE public.courier_verification_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expedientes_leer_propio_o_admin" ON public.courier_verification_cases;
CREATE POLICY "expedientes_leer_propio_o_admin" ON public.courier_verification_cases
  FOR SELECT TO authenticated
  USING (courier_user_id = auth.uid() OR public.es_admin());
DROP POLICY IF EXISTS "expedientes_crear_propio_borrador" ON public.courier_verification_cases;
CREATE POLICY "expedientes_crear_propio_borrador" ON public.courier_verification_cases
  FOR INSERT TO authenticated
  WITH CHECK (courier_user_id = auth.uid() AND status = 'draft');
DROP POLICY IF EXISTS "expedientes_actualizar_participantes" ON public.courier_verification_cases;
CREATE POLICY "expedientes_actualizar_participantes" ON public.courier_verification_cases
  FOR UPDATE TO authenticated
  USING (courier_user_id = auth.uid() OR public.es_admin())
  WITH CHECK (courier_user_id = auth.uid() OR public.es_admin());

ALTER TABLE public.courier_verification_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "documentos_leer_propio_o_admin" ON public.courier_verification_documents;
CREATE POLICY "documentos_leer_propio_o_admin" ON public.courier_verification_documents
  FOR SELECT TO authenticated
  USING (courier_user_id = auth.uid() OR public.es_admin());
DROP POLICY IF EXISTS "documentos_cargar_propio" ON public.courier_verification_documents;
CREATE POLICY "documentos_cargar_propio" ON public.courier_verification_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    courier_user_id = auth.uid()
    AND storage_bucket = 'courier-identity-private'
    AND storage_path LIKE auth.uid()::text || '/%'
    AND EXISTS (
      SELECT 1 FROM public.courier_verification_cases c
      WHERE c.id = courier_verification_documents.case_id
        AND c.courier_user_id = auth.uid()
        AND c.status IN ('draft', 'needs_information', 'reverification_required')
    )
  );
DROP POLICY IF EXISTS "documentos_revisar_admin" ON public.courier_verification_documents;
CREATE POLICY "documentos_revisar_admin" ON public.courier_verification_documents
  FOR UPDATE TO authenticated
  USING (public.es_admin())
  WITH CHECK (public.es_admin());

ALTER TABLE public.courier_verification_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eventos_expediente_leer_participantes" ON public.courier_verification_events;
CREATE POLICY "eventos_expediente_leer_participantes" ON public.courier_verification_events
  FOR SELECT TO authenticated
  USING (
    public.es_admin()
    OR EXISTS (
      SELECT 1 FROM public.courier_verification_cases c
      WHERE c.id = courier_verification_events.case_id
        AND c.courier_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Políticas de Storage para el bucket privado (sección 7): mínimo privilegio,
-- carpeta propia por usuario, sin acceso público. La lectura administrativa
-- queda limitada al rol admin; no hay política de escritura para admin
-- (la evidencia no la manipula la administración).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "docs_identidad_insertar_propio" ON storage.objects;
CREATE POLICY "docs_identidad_insertar_propio" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'courier-identity-private'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "docs_identidad_leer_propio_o_admin" ON storage.objects;
CREATE POLICY "docs_identidad_leer_propio_o_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'courier-identity-private'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.es_admin())
  );

DROP POLICY IF EXISTS "docs_identidad_actualizar_propio" ON storage.objects;
CREATE POLICY "docs_identidad_actualizar_propio" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'courier-identity-private'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'courier-identity-private'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "docs_identidad_eliminar_propio" ON storage.objects;
CREATE POLICY "docs_identidad_eliminar_propio" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'courier-identity-private'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Permisos explícitos para las tablas nuevas (en Supabase ya existen por
-- omisión vía default privileges; en CI se crean aquí). El aislamiento real
-- de filas lo aplican las políticas RLS.
-- ---------------------------------------------------------------------------
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

COMMIT;
