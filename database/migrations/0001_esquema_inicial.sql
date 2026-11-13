-- ============================================================================
-- KouriGo — Migración 0001: esquema inicial con Row Level Security
--
-- Fuente: README (secciones 4, 10, 11, 12) y
-- docs/architecture/backend-supabase.md (secciones 3, 5, 7).
-- Aplicable a Supabase y a PostgreSQL 16 + PostGIS (usado en CI).
--
-- Nota para CI: antes de esta migración se aplica
-- database/ci/0000_emulacion_supabase_auth.sql, que crea el esquema `auth`
-- mínimo (auth.users y auth.uid()). En el proyecto real de Supabase ese
-- esquema ya existe y NO debe aplicarse la emulación.
--
-- Idiomas: valores de estado y tipos según README (en inglés, tal como están
-- definidos); comentarios en español.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- PostGIS para consultas geoespaciales (Supabase lo instala en `extensions`)
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Tablas (nombres según docs/architecture/backend-supabase.md sección 5 y
-- README sección 11)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text,
  phone text,
  locale text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('customer', 'courier', 'admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  assigned_by uuid REFERENCES auth.users (id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.customer_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Estados del expediente de verificación según
-- docs/operations/courier-identity-verification.md sección 4.
CREATE TABLE IF NOT EXISTS public.courier_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  verification_status text NOT NULL DEFAULT 'draft' CHECK (verification_status IN (
    'draft', 'submitted', 'under_review', 'needs_information',
    'verification_scheduled', 'approved', 'rejected', 'suspended',
    'expired', 'reverification_required'
  )),
  account_active boolean NOT NULL DEFAULT true,
  work_zone text,
  vehicle_plate text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  label text,
  address_text text NOT NULL CHECK (length(btrim(address_text)) BETWEEN 1 AND 300),
  coordinates geography(Point, 4326),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  boundary geography(MultiPolygon, 4326),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- La moneda no tiene valor por defecto: su definición es una decisión
-- pendiente del fundador (README sección 22). Los importes son enteros en la
-- unidad mínima de la moneda (README sección 11).
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES auth.users (id),
  order_type text NOT NULL CHECK (order_type IN ('delivery', 'assisted_purchase')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending', 'offered', 'accepted', 'at_pickup',
    'picked_up', 'in_transit', 'delivered', 'cancelled', 'issue'
  )),
  pickup_address_text text NOT NULL CHECK (length(btrim(pickup_address_text)) BETWEEN 1 AND 300),
  pickup_coordinates geography(Point, 4326),
  dropoff_address_text text NOT NULL CHECK (length(btrim(dropoff_address_text)) BETWEEN 1 AND 300),
  dropoff_coordinates geography(Point, 4326),
  store_address_text text,
  notes text CHECK (notes IS NULL OR length(notes) <= 500),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  service_fee_amount bigint NOT NULL CHECK (service_fee_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 300),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 999),
  estimated_price_amount bigint CHECK (estimated_price_amount IS NULL OR estimated_price_amount >= 0),
  actual_price_amount bigint CHECK (actual_price_amount IS NULL OR actual_price_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  courier_user_id uuid NOT NULL REFERENCES auth.users (id),
  status text NOT NULL DEFAULT 'offered' CHECK (status IN (
    'offered', 'accepted', 'rejected', 'completed', 'cancelled'
  )),
  offered_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  UNIQUE (order_id, courier_user_id)
);

CREATE TABLE IF NOT EXISTS public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users (id),
  event_type text NOT NULL,
  from_status text,
  to_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Categorías según README sección 3.3.
CREATE TABLE IF NOT EXISTS public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id),
  reported_by uuid NOT NULL REFERENCES auth.users (id),
  category text NOT NULL CHECK (category IN (
    'client_absent', 'wrong_address', 'store_closed', 'item_unavailable',
    'courier_cannot_continue', 'order_damaged', 'payment_unconfirmed',
    'cancellation', 'other'
  )),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolution text,
  resolved_by uuid REFERENCES auth.users (id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Estados del pago según README sección 6. Los proveedores se registran con
-- su nombre textual; solo se integra con proveedores con documentación real.
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id),
  provider text NOT NULL,
  external_reference text,
  idempotency_key text UNIQUE,
  amount bigint NOT NULL CHECK (amount >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'initiated', 'confirmed', 'failed', 'refunded'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Registros financieros inmutables (README sección 5): correcciones mediante
-- asientos compensatorios, nunca con UPDATE/DELETE.
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account text NOT NULL,
  order_id uuid REFERENCES public.orders (id),
  entry_type text NOT NULL,
  amount bigint NOT NULL CHECK (amount <> 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.courier_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_user_id uuid NOT NULL REFERENCES auth.users (id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount bigint NOT NULL CHECK (amount >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users (id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_owner ON public.addresses (owner_id);
CREATE INDEX IF NOT EXISTS idx_addresses_coordinates ON public.addresses USING gist (coordinates);
CREATE INDEX IF NOT EXISTS idx_service_zones_boundary ON public.service_zones USING gist (boundary);
CREATE INDEX IF NOT EXISTS idx_orders_client ON public.orders (client_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_pickup ON public.orders USING gist (pickup_coordinates);
CREATE INDEX IF NOT EXISTS idx_orders_dropoff ON public.orders USING gist (dropoff_coordinates);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_assignments_order ON public.order_assignments (order_id);
CREATE INDEX IF NOT EXISTS idx_order_assignments_courier ON public.order_assignments (courier_user_id);
CREATE INDEX IF NOT EXISTS idx_order_events_order ON public.order_events (order_id);
CREATE INDEX IF NOT EXISTS idx_incidents_order ON public.incidents (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments (order_id);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON public.ledger_entries (account);
CREATE INDEX IF NOT EXISTS idx_courier_payouts_courier ON public.courier_payouts (courier_user_id);

-- ---------------------------------------------------------------------------
-- Funciones auxiliares de autorización (SECURITY DEFINER para evitar
-- recursión de políticas RLS; comprobables en las pruebas SQL)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.es_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  );
$$;

-- Regla de habilitación del repartidor según
-- docs/operations/courier-identity-verification.md sección 8:
-- account_active = true AND verification_status = 'approved'.
CREATE OR REPLACE FUNCTION public.repartidor_aprobado() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courier_profiles
    WHERE user_id = auth.uid()
      AND verification_status = 'approved'
      AND account_active = true
  );
$$;

-- Cliente dueño del pedido, o repartidor aprobado con asignación sobre él.
CREATE OR REPLACE FUNCTION public.es_participante_pedido(id_pedido uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = id_pedido
      AND (
        o.client_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.order_assignments oa
          WHERE oa.order_id = o.id
            AND oa.courier_user_id = auth.uid()
            AND public.repartidor_aprobado()
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Trigger genérico updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fijar_actualizado_en() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fijar_actualizado_en ON public.profiles;
CREATE TRIGGER trg_fijar_actualizado_en BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fijar_actualizado_en();

DROP TRIGGER IF EXISTS trg_fijar_actualizado_en ON public.customer_profiles;
CREATE TRIGGER trg_fijar_actualizado_en BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.fijar_actualizado_en();

DROP TRIGGER IF EXISTS trg_fijar_actualizado_en ON public.courier_profiles;
CREATE TRIGGER trg_fijar_actualizado_en BEFORE UPDATE ON public.courier_profiles
  FOR EACH ROW EXECUTE FUNCTION public.fijar_actualizado_en();

DROP TRIGGER IF EXISTS trg_fijar_actualizado_en ON public.orders;
CREATE TRIGGER trg_fijar_actualizado_en BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fijar_actualizado_en();

DROP TRIGGER IF EXISTS trg_fijar_actualizado_en ON public.payments;
CREATE TRIGGER trg_fijar_actualizado_en BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.fijar_actualizado_en();

-- ---------------------------------------------------------------------------
-- Validación de transiciones de pedidos (README sección 4): el backend debe
-- validarlas; el cliente no puede enviar libremente cualquier estado. Los
-- pares permitidos por actor son idénticos a packages/domain/src/transiciones.ts.
-- El trigger registra además cada cambio en order_events (auditoría).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_transicion_pedido() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_par text;
  v_actor text;
  v_permitido boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_par := OLD.status || '->' || NEW.status;

  -- El actor se determina SOLO en el servidor, nunca desde el cliente
  -- (README sección 12, regla 15).
  IF public.es_admin() THEN
    v_actor := 'administrador';
  ELSIF NEW.client_id = auth.uid() THEN
    v_actor := 'cliente';
  ELSIF public.repartidor_aprobado() THEN
    v_actor := 'repartidor';
  ELSIF auth.uid() IS NULL THEN
    v_actor := 'sistema';
  ELSE
    RAISE EXCEPTION 'El usuario no tiene permiso para modificar este pedido';
  END IF;

  -- El repartidor solo puede cambiar pedidos con asignación a su nombre.
  IF v_actor = 'repartidor' AND NOT EXISTS (
    SELECT 1 FROM public.order_assignments oa
    WHERE oa.order_id = OLD.id AND oa.courier_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'El repartidor no tiene una asignación sobre este pedido';
  END IF;

  IF v_actor = 'cliente' THEN
    v_permitido := v_par IN (
      'draft->pending', 'draft->cancelled', 'pending->cancelled', 'offered->cancelled'
    );
  ELSIF v_actor = 'repartidor' THEN
    v_permitido := v_par IN (
      'offered->accepted', 'accepted->at_pickup', 'at_pickup->picked_up',
      'picked_up->in_transit', 'in_transit->delivered',
      'accepted->issue', 'at_pickup->issue', 'picked_up->issue', 'in_transit->issue'
    );
  ELSIF v_actor = 'administrador' THEN
    v_permitido := v_par IN (
      'draft->pending', 'draft->cancelled', 'pending->offered', 'pending->cancelled',
      'offered->accepted', 'offered->pending', 'offered->cancelled',
      'accepted->at_pickup', 'accepted->issue', 'accepted->cancelled',
      'at_pickup->picked_up', 'at_pickup->issue', 'at_pickup->cancelled',
      'picked_up->in_transit', 'picked_up->issue', 'picked_up->cancelled',
      'in_transit->delivered', 'in_transit->issue', 'in_transit->cancelled',
      'issue->pending', 'issue->delivered', 'issue->cancelled'
    );
  ELSE
    v_permitido := v_par IN ('pending->offered', 'offered->pending');
  END IF;

  IF NOT v_permitido THEN
    RAISE EXCEPTION 'Transición de estado no permitida (% para el rol %)', v_par, v_actor;
  END IF;

  INSERT INTO public.order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (OLD.id, auth.uid(), 'status_changed', OLD.status, NEW.status,
          jsonb_build_object('actor_rol', v_actor));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_transicion_pedido ON public.orders;
CREATE TRIGGER trg_validar_transicion_pedido BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validar_transicion_pedido();

-- ---------------------------------------------------------------------------
-- Validación de transiciones de asignaciones: solo el repartidor asignado o
-- un administrador pueden cambiarlas; el repartidor debe estar aprobado.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_transicion_asignacion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (NEW.courier_user_id = auth.uid() OR public.es_admin()) THEN
    RAISE EXCEPTION 'Solo el repartidor asignado o un administrador pueden cambiar la asignación';
  END IF;

  IF NEW.courier_user_id = auth.uid() AND NOT public.es_admin() THEN
    IF NOT public.repartidor_aprobado() THEN
      RAISE EXCEPTION 'El repartidor no está aprobado para operar';
    END IF;
    IF NOT (
      (OLD.status = 'offered' AND NEW.status IN ('accepted', 'rejected'))
      OR (OLD.status = 'accepted' AND NEW.status = 'completed')
    ) THEN
      RAISE EXCEPTION 'Transición de asignación no permitida (% -> %)', OLD.status, NEW.status;
    END IF;
    IF NEW.status = 'accepted' THEN
      NEW.accepted_at := now();
    END IF;
    IF NEW.status = 'completed' THEN
      NEW.completed_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_transicion_asignacion ON public.order_assignments;
CREATE TRIGGER trg_validar_transicion_asignacion BEFORE UPDATE ON public.order_assignments
  FOR EACH ROW EXECUTE FUNCTION public.validar_transicion_asignacion();

-- ---------------------------------------------------------------------------
-- Protección del estado de verificación del repartidor: el candidato no
-- puede aprobarse a sí mismo ni alterar estados privilegiados
-- (docs/operations/courier-identity-verification.md secciones 8 y 10).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proteger_estado_verificacion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.es_admin() OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;
  IF OLD.verification_status IN ('approved', 'rejected', 'suspended') THEN
    RAISE EXCEPTION 'El estado de verificación actual solo puede modificarlo la administración';
  END IF;
  IF NEW.verification_status IN (
    'approved', 'rejected', 'suspended', 'expired',
    'under_review', 'verification_scheduled'
  ) THEN
    RAISE EXCEPTION 'Un candidato no puede asignarse un estado de verificación privilegiado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_estado_verificacion ON public.courier_profiles;
CREATE TRIGGER trg_proteger_estado_verificacion BEFORE UPDATE ON public.courier_profiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_estado_verificacion();

-- ---------------------------------------------------------------------------
-- Inmutabilidad del mayor financiero (README sección 5): correcciones solo
-- mediante asientos compensatorios.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bloquear_modificacion_mayor() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Los asientos del mayor (ledger_entries) son inmutables; registra un asiento compensatorio.';
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_modificacion_mayor ON public.ledger_entries;
CREATE TRIGGER trg_bloquear_modificacion_mayor BEFORE UPDATE OR DELETE ON public.ledger_entries
  FOR EACH STATEMENT EXECUTE FUNCTION public.bloquear_modificacion_mayor();

-- ---------------------------------------------------------------------------
-- Row Level Security: activado en TODAS las tablas accesibles desde clientes
-- (docs/architecture/backend-supabase.md sección 7). Sin política DELETE en
-- las tablas operativas: el historial no se borra.
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "perfiles_leer_propio_o_admin" ON public.profiles;
CREATE POLICY "perfiles_leer_propio_o_admin" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.es_admin());
DROP POLICY IF EXISTS "perfiles_insertar_propio" ON public.profiles;
CREATE POLICY "perfiles_insertar_propio" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "perfiles_actualizar_propio" ON public.profiles;
CREATE POLICY "perfiles_actualizar_propio" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_leer_propio_o_admin" ON public.user_roles;
CREATE POLICY "roles_leer_propio_o_admin" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.es_admin());
DROP POLICY IF EXISTS "roles_administrar" ON public.user_roles;
CREATE POLICY "roles_administrar" ON public.user_roles
  FOR ALL TO authenticated USING (public.es_admin()) WITH CHECK (public.es_admin());

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "perfiles_cliente_leer" ON public.customer_profiles;
CREATE POLICY "perfiles_cliente_leer" ON public.customer_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.es_admin());
DROP POLICY IF EXISTS "perfiles_cliente_insertar" ON public.customer_profiles;
CREATE POLICY "perfiles_cliente_insertar" ON public.customer_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "perfiles_cliente_actualizar" ON public.customer_profiles;
CREATE POLICY "perfiles_cliente_actualizar" ON public.customer_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.courier_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "courier_leer_propio_o_admin" ON public.courier_profiles;
CREATE POLICY "courier_leer_propio_o_admin" ON public.courier_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.es_admin());
DROP POLICY IF EXISTS "courier_crear_expediente_propio" ON public.courier_profiles;
CREATE POLICY "courier_crear_expediente_propio" ON public.courier_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND verification_status = 'draft');
DROP POLICY IF EXISTS "courier_actualizar_expediente_propio" ON public.courier_profiles;
CREATE POLICY "courier_actualizar_expediente_propio" ON public.courier_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND verification_status IN ('draft', 'submitted', 'needs_information', 'reverification_required')
  );
DROP POLICY IF EXISTS "courier_administrar" ON public.courier_profiles;
CREATE POLICY "courier_administrar" ON public.courier_profiles
  FOR UPDATE TO authenticated USING (public.es_admin()) WITH CHECK (public.es_admin());

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "direcciones_leer_propio_o_admin" ON public.addresses;
CREATE POLICY "direcciones_leer_propio_o_admin" ON public.addresses
  FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.es_admin());
DROP POLICY IF EXISTS "direcciones_escribir_propio" ON public.addresses;
CREATE POLICY "direcciones_escribir_propio" ON public.addresses
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

ALTER TABLE public.service_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "zonas_leer_autenticados" ON public.service_zones;
CREATE POLICY "zonas_leer_autenticados" ON public.service_zones
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "zonas_administrar" ON public.service_zones;
CREATE POLICY "zonas_administrar" ON public.service_zones
  FOR ALL TO authenticated USING (public.es_admin()) WITH CHECK (public.es_admin());

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pedidos_insertar_propio_borrador" ON public.orders;
CREATE POLICY "pedidos_insertar_propio_borrador" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid() AND status = 'draft');
DROP POLICY IF EXISTS "pedidos_leer_participantes" ON public.orders;
CREATE POLICY "pedidos_leer_participantes" ON public.orders
  FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    OR public.es_admin()
    OR (
      public.repartidor_aprobado()
      AND EXISTS (
        SELECT 1 FROM public.order_assignments oa
        WHERE oa.order_id = orders.id AND oa.courier_user_id = auth.uid()
      )
    )
  );
DROP POLICY IF EXISTS "pedidos_actualizar_participantes" ON public.orders;
CREATE POLICY "pedidos_actualizar_participantes" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    client_id = auth.uid()
    OR public.es_admin()
    OR (
      public.repartidor_aprobado()
      AND EXISTS (
        SELECT 1 FROM public.order_assignments oa
        WHERE oa.order_id = orders.id AND oa.courier_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    client_id = auth.uid()
    OR public.es_admin()
    OR (
      public.repartidor_aprobado()
      AND EXISTS (
        SELECT 1 FROM public.order_assignments oa
        WHERE oa.order_id = orders.id AND oa.courier_user_id = auth.uid()
      )
    )
  );

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "items_leer_participantes" ON public.order_items;
CREATE POLICY "items_leer_participantes" ON public.order_items
  FOR SELECT TO authenticated
  USING (public.es_participante_pedido(order_id) OR public.es_admin());
DROP POLICY IF EXISTS "items_escribir_cliente_borrador" ON public.order_items;
CREATE POLICY "items_escribir_cliente_borrador" ON public.order_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.client_id = auth.uid()
        AND o.status = 'draft'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.client_id = auth.uid()
        AND o.status = 'draft'
    )
  );

ALTER TABLE public.order_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "asignaciones_leer_propio_o_admin" ON public.order_assignments;
CREATE POLICY "asignaciones_leer_propio_o_admin" ON public.order_assignments
  FOR SELECT TO authenticated
  USING ((courier_user_id = auth.uid() AND public.repartidor_aprobado()) OR public.es_admin());
DROP POLICY IF EXISTS "asignaciones_insertar_admin" ON public.order_assignments;
CREATE POLICY "asignaciones_insertar_admin" ON public.order_assignments
  FOR INSERT TO authenticated WITH CHECK (public.es_admin());
DROP POLICY IF EXISTS "asignaciones_actualizar_repartidor" ON public.order_assignments;
CREATE POLICY "asignaciones_actualizar_repartidor" ON public.order_assignments
  FOR UPDATE TO authenticated
  USING (courier_user_id = auth.uid())
  WITH CHECK (
    courier_user_id = auth.uid()
    AND public.repartidor_aprobado()
    AND status IN ('accepted', 'rejected', 'completed')
  );
DROP POLICY IF EXISTS "asignaciones_actualizar_admin" ON public.order_assignments;
CREATE POLICY "asignaciones_actualizar_admin" ON public.order_assignments
  FOR UPDATE TO authenticated USING (public.es_admin()) WITH CHECK (public.es_admin());

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eventos_leer_participantes" ON public.order_events;
CREATE POLICY "eventos_leer_participantes" ON public.order_events
  FOR SELECT TO authenticated
  USING (public.es_participante_pedido(order_id) OR public.es_admin());

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "incidencias_leer_participantes" ON public.incidents;
CREATE POLICY "incidencias_leer_participantes" ON public.incidents
  FOR SELECT TO authenticated
  USING (public.es_participante_pedido(order_id) OR public.es_admin());
DROP POLICY IF EXISTS "incidencias_abrir_participantes" ON public.incidents;
CREATE POLICY "incidencias_abrir_participantes" ON public.incidents
  FOR INSERT TO authenticated
  WITH CHECK (public.es_participante_pedido(order_id) AND reported_by = auth.uid());
DROP POLICY IF EXISTS "incidencias_resolver_admin" ON public.incidents;
CREATE POLICY "incidencias_resolver_admin" ON public.incidents
  FOR UPDATE TO authenticated USING (public.es_admin()) WITH CHECK (public.es_admin());

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pagos_leer_participantes" ON public.payments;
CREATE POLICY "pagos_leer_participantes" ON public.payments
  FOR SELECT TO authenticated
  USING (public.es_participante_pedido(order_id) OR public.es_admin());
DROP POLICY IF EXISTS "pagos_gestionar_admin" ON public.payments;
CREATE POLICY "pagos_gestionar_admin" ON public.payments
  FOR ALL TO authenticated USING (public.es_admin()) WITH CHECK (public.es_admin());

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mayor_leer_admin" ON public.ledger_entries;
CREATE POLICY "mayor_leer_admin" ON public.ledger_entries
  FOR SELECT TO authenticated USING (public.es_admin());
DROP POLICY IF EXISTS "mayor_insertar_admin" ON public.ledger_entries;
CREATE POLICY "mayor_insertar_admin" ON public.ledger_entries
  FOR INSERT TO authenticated WITH CHECK (public.es_admin());

ALTER TABLE public.courier_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pagos_repartidor_leer_propio" ON public.courier_payouts;
CREATE POLICY "pagos_repartidor_leer_propio" ON public.courier_payouts
  FOR SELECT TO authenticated USING (courier_user_id = auth.uid() OR public.es_admin());
DROP POLICY IF EXISTS "pagos_repartidor_administrar" ON public.courier_payouts;
CREATE POLICY "pagos_repartidor_administrar" ON public.courier_payouts
  FOR ALL TO authenticated USING (public.es_admin()) WITH CHECK (public.es_admin());

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auditoria_leer_admin" ON public.audit_logs;
CREATE POLICY "auditoria_leer_admin" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.es_admin());

-- ---------------------------------------------------------------------------
-- Permisos explícitos de esquema/tabla (en Supabase ya existen por omisión;
-- en CI se crean aquí). El aislamiento real de filas lo aplican las políticas
-- RLS anteriores.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;

COMMIT;
