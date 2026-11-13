-- ============================================================================
-- KouriGo — Etapa 1.5/2: verificación de esquema contra el proyecto real de
-- Supabase (solo lectura). Ejecutada por scripts/verificar_supabase.sh.
--
-- Comprueba, contra el catálogo del proyecto real:
--   - PostGIS instalada (esquema extensions, según docs/architecture/
--     backend-supabase.md)
--   - las 18 tablas de las migraciones 0001 y 0002 existen en public
--   - RLS habilitado en todas ellas
--   - funciones auxiliares y triggers de integridad presentes
--   - el CHECK de orders.status cubre los 10 estados del README sección 4
--   - el CHECK de courier_verification_cases cubre los 10 estados del
--     expediente (courier-identity-verification.md sección 4)
--   - el bucket privado courier-identity-private existe y no es público
--   - las políticas clave de orders y de Storage existen
--   - la superficie de Supabase (auth.uid(), grants a authenticated)
--   - el registro de migraciones (schema_migrations) no está vacío
-- Cualquier fallo levanta una excepción y aborta con ON_ERROR_STOP.
-- ============================================================================

DO $$
DECLARE
  v_tablas text[] := ARRAY[
    'profiles', 'user_roles', 'customer_profiles', 'courier_profiles',
    'addresses', 'service_zones', 'orders', 'order_items',
    'order_assignments', 'order_events', 'incidents', 'payments',
    'ledger_entries', 'courier_payouts', 'audit_logs',
    'courier_verification_cases', 'courier_verification_documents',
    'courier_verification_events'
  ];
  v_faltantes text;
  v_definicion text;
  v_estado text;
BEGIN
  -- PostGIS en extensions
  IF (SELECT count(*) FROM pg_extension WHERE extname = 'postgis') = 0 THEN
    RAISE EXCEPTION 'PostGIS no está instalada en el proyecto';
  END IF;
  RAISE NOTICE 'OK: PostGIS instalada';

  -- Tablas presentes
  SELECT string_agg(t, ', ') INTO v_faltantes
  FROM unnest(v_tablas) AS t
  WHERE to_regclass('public.' || t) IS NULL;
  IF v_faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'Faltan tablas en public: %', v_faltantes;
  END IF;
  RAISE NOTICE 'OK: las % tablas esperadas existen', array_length(v_tablas, 1);

  -- RLS habilitado en todas
  SELECT string_agg(c.relname, ', ') INTO v_faltantes
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = ANY (v_tablas)
    AND c.relkind = 'r' AND NOT c.relrowsecurity;
  IF v_faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'RLS no está habilitado en: %', v_faltantes;
  END IF;
  RAISE NOTICE 'OK: RLS habilitado en todas las tablas';

  -- Funciones auxiliares de las migraciones
  FOREACH v_estado IN ARRAY ARRAY[
    'es_admin', 'repartidor_aprobado', 'es_participante_pedido',
    'fijar_actualizado_en', 'validar_transicion_pedido',
    'validar_transicion_asignacion', 'proteger_estado_verificacion',
    'bloquear_modificacion_mayor',
    'preparar_expediente_nuevo', 'registrar_creacion_expediente',
    'validar_transicion_expediente', 'sincronizar_estado_verificacion',
    'registrar_evento_documento', 'registrar_revision_documento'
  ] LOOP
    -- Por nombre (to_regproc), no por firma: es_participante_pedido(uuid)
    -- tiene argumentos y el resto son funciones sin parámetros.
    IF to_regproc('public.' || v_estado) IS NULL THEN
      RAISE EXCEPTION 'Falta la función public.%', v_estado;
    END IF;
  END LOOP;
  RAISE NOTICE 'OK: funciones auxiliares presentes';

  -- Triggers de integridad
  SELECT string_agg(t.tabla || '.' || t.trigger, ', ') INTO v_faltantes
  FROM (VALUES
    ('orders', 'trg_validar_transicion_pedido'),
    ('order_assignments', 'trg_validar_transicion_asignacion'),
    ('courier_profiles', 'trg_proteger_estado_verificacion'),
    ('ledger_entries', 'trg_bloquear_modificacion_mayor'),
    ('orders', 'trg_fijar_actualizado_en'),
    ('courier_verification_cases', 'trg_preparar_expediente_nuevo'),
    ('courier_verification_cases', 'trg_evento_expediente_nuevo'),
    ('courier_verification_cases', 'trg_validar_transicion_expediente'),
    ('courier_verification_cases', 'trg_sincronizar_estado_verificacion'),
    ('courier_verification_documents', 'trg_evento_documento'),
    ('courier_verification_documents', 'trg_evento_revision_documento')
  ) AS t(tabla, trigger)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_trigger tr
    JOIN pg_class c ON c.oid = tr.tgrelid
    WHERE c.relname = t.tabla
      AND tr.tgname = t.trigger
      AND NOT tr.tgisinternal
  );
  IF v_faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'Faltan triggers: %', v_faltantes;
  END IF;
  RAISE NOTICE 'OK: triggers de integridad presentes';

  -- CHECK de estados de pedidos: los 10 estados del README sección 4
  SELECT pg_get_constraintdef(oid) INTO v_definicion
  FROM pg_constraint
  WHERE conrelid = 'public.orders'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%' AND pg_get_constraintdef(oid) LIKE '%draft%';
  IF v_definicion IS NULL THEN
    RAISE EXCEPTION 'No se encontró el CHECK de orders.status';
  END IF;
  FOREACH v_estado IN ARRAY ARRAY[
    'draft', 'pending', 'offered', 'accepted', 'at_pickup',
    'picked_up', 'in_transit', 'delivered', 'cancelled', 'issue'
  ] LOOP
    IF v_definicion NOT LIKE '%' || v_estado || '%' THEN
      RAISE EXCEPTION 'El CHECK de orders.status no incluye el estado %', v_estado;
    END IF;
  END LOOP;
  RAISE NOTICE 'OK: orders.status cubre los 10 estados del README';

  -- CHECK del expediente: los 10 estados de la especificación de verificación
  SELECT pg_get_constraintdef(oid) INTO v_definicion
  FROM pg_constraint
  WHERE conrelid = 'public.courier_verification_cases'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%' AND pg_get_constraintdef(oid) LIKE '%submitted%';
  IF v_definicion IS NULL THEN
    RAISE EXCEPTION 'No se encontró el CHECK de courier_verification_cases.status';
  END IF;
  FOREACH v_estado IN ARRAY ARRAY[
    'draft', 'submitted', 'under_review', 'needs_information',
    'verification_scheduled', 'approved', 'rejected', 'suspended',
    'expired', 'reverification_required'
  ] LOOP
    IF v_definicion NOT LIKE '%' || v_estado || '%' THEN
      RAISE EXCEPTION 'El CHECK del expediente no incluye el estado %', v_estado;
    END IF;
  END LOOP;
  RAISE NOTICE 'OK: el expediente cubre los 10 estados de la verificación';

  -- Bucket privado de identidad: existe y no es público
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'courier-identity-private' AND public = false
  ) THEN
    RAISE EXCEPTION 'El bucket privado courier-identity-private no existe o es público';
  END IF;
  RAISE NOTICE 'OK: bucket privado courier-identity-private presente';

  -- Políticas clave de orders
  SELECT string_agg(t, ', ') INTO v_faltantes
  FROM unnest(ARRAY[
    'pedidos_insertar_propio_borrador',
    'pedidos_leer_participantes',
    'pedidos_actualizar_participantes'
  ]) AS t
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = t
  );
  IF v_faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'Faltan políticas de orders: %', v_faltantes;
  END IF;
  RAISE NOTICE 'OK: políticas clave de orders presentes';

  -- Políticas de Storage para el bucket privado (Etapa 2)
  SELECT string_agg(t, ', ') INTO v_faltantes
  FROM unnest(ARRAY[
    'docs_identidad_insertar_propio',
    'docs_identidad_leer_propio_o_admin',
    'docs_identidad_actualizar_propio',
    'docs_identidad_eliminar_propio'
  ]) AS t
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = t
  );
  IF v_faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'Faltan políticas de Storage: %', v_faltantes;
  END IF;
  RAISE NOTICE 'OK: políticas de Storage del bucket privado presentes';

  -- Superficie de Supabase y grants de operación
  IF to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'auth.uid() no está disponible en el proyecto real';
  END IF;
  IF NOT has_schema_privilege('authenticated', 'public', 'USAGE') THEN
    RAISE EXCEPTION 'El rol authenticated no tiene USAGE sobre el esquema public';
  END IF;
  RAISE NOTICE 'OK: auth.uid() disponible y grants de authenticated correctos';

  -- Registro de migraciones aplicadas
  IF (SELECT count(*) FROM public.schema_migrations) = 0 THEN
    RAISE EXCEPTION 'schema_migrations está vacía: aplicar migraciones primero';
  END IF;
  RAISE NOTICE 'OK: schema_migrations registra % migración(es)',
    (SELECT count(*) FROM public.schema_migrations);

  RAISE NOTICE 'VERIFICACIÓN DE ESQUEMA: todas las aserciones pasaron';
END
$$;
