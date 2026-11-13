-- ============================================================================
-- KouriGo — Pruebas de la operación privilegiada de despacho (Etapa 3)
--
-- Cubre la migración 0004 (public.despachar_pedido):
--   1. Un rol de sesión autenticado NO puede ejecutar el RPC directamente
--      (REVOKE: la única vía es la Edge Function con service_role).
--   2. service_role despacha un pedido pending a un repartidor aprobado:
--      crea la asignación, mueve el pedido a offered y registra auditoría
--      (audit_logs y order_events con el administrador como actor).
--   3. Rechaza un pedido que no está en pending.
--   4. Rechaza un repartidor sin expediente aprobado o con cuenta inactiva.
--   5. Rechaza un pedido que ya tiene una oferta activa.
--   6. Rechaza la llamada sin identificador de administrador.
--
-- Fixtures de prueba: NO son datos reales de operación.
-- ============================================================================
\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------------
-- Preparación (superusuario)
--   P: repartidor aprobado     Q: repartidor con cuenta inactiva
--   R: cliente                 S: administrador
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-4000-8000-0000000000d1', 'repartidor-p@prueba.kourigo.local'),
  ('a0000000-0000-4000-8000-0000000000d2', 'repartidor-q@prueba.kourigo.local'),
  ('a0000000-0000-4000-8000-0000000000d3', 'cliente-r@prueba.kourigo.local'),
  ('a0000000-0000-4000-8000-0000000000d4', 'admin-s@prueba.kourigo.local');

INSERT INTO public.user_roles (user_id, role) VALUES
  ('a0000000-0000-4000-8000-0000000000d1', 'courier'),
  ('a0000000-0000-4000-8000-0000000000d2', 'courier'),
  ('a0000000-0000-4000-8000-0000000000d3', 'customer'),
  ('a0000000-0000-4000-8000-0000000000d4', 'admin');

INSERT INTO public.courier_profiles (user_id, verification_status, account_active) VALUES
  ('a0000000-0000-4000-8000-0000000000d1', 'approved', true),
  ('a0000000-0000-4000-8000-0000000000d2', 'approved', false);

INSERT INTO public.orders (
  id, client_id, order_type, status, pickup_address_text, dropoff_address_text,
  currency, service_fee_amount
) VALUES
  ('b0000000-0000-4000-8000-0000000000d1',
   'a0000000-0000-4000-8000-0000000000d3',
   'delivery', 'pending', 'Direccion de recogida de prueba',
   'Direccion de destino de prueba', 'HTG', 15000),
  ('b0000000-0000-4000-8000-0000000000d2',
   'a0000000-0000-4000-8000-0000000000d3',
   'delivery', 'offered', 'Direccion de recogida de prueba',
   'Direccion de destino de prueba', 'HTG', 12000),
  ('b0000000-0000-4000-8000-0000000000d3',
   'a0000000-0000-4000-8000-0000000000d3',
   'delivery', 'pending', 'Direccion de recogida de prueba',
   'Direccion de destino de prueba', 'HTG', 9000);

-- ---------------------------------------------------------------------------
-- Fase 1 — un autenticado NO puede ejecutar el RPC directamente (REVOKE)
-- ---------------------------------------------------------------------------
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims =
  '{"sub": "a0000000-0000-4000-8000-0000000000d4"}';

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    PERFORM public.despachar_pedido(
      'b0000000-0000-4000-8000-0000000000d1',
      'a0000000-0000-4000-8000-0000000000d1',
      'a0000000-0000-4000-8000-0000000000d4'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado,
    'un rol authenticated no debe poder ejecutar despachar_pedido (REVOKE)'
  );
END;
$$;

SET LOCAL role postgres;
RESET request.jwt.claims;

-- ---------------------------------------------------------------------------
-- Fase 2 — service_role despacha y deja auditoría completa
--
-- Si la sesión puede asumir service_role (CI y proyecto real con membresía
-- concedida) se ejercita el GRANT; si no, el propietario ejecuta el RPC
-- (mismo comportamiento: la función es SECURITY DEFINER).
-- ---------------------------------------------------------------------------
SELECT CASE
  WHEN pg_has_role(current_user, 'service_role', 'member') THEN '1' ELSE '0'
END AS con_service_role
\gset

\if :con_service_role
SET LOCAL role service_role;
\endif

SELECT public.despachar_pedido(
  'b0000000-0000-4000-8000-0000000000d1',
  'a0000000-0000-4000-8000-0000000000d1',
  'a0000000-0000-4000-8000-0000000000d4'
) AS v_asignacion
\gset

-- La verificación se hace como propietario de las tablas: en CI el
-- service_role emulado no tiene BYPASSRLS y las políticas cubren solo a
-- authenticated; en el proyecto real el service_role bypasses RLS, pero
-- la lectura queda igual de correcta con el propietario.
RESET role;
RESET request.jwt.claims;

-- psql no interpola variables dentro de bloques dolarizados: se pasa el
-- valor por una GUC local a la transacción.
SELECT set_config('prueba.asignacion_despacho', :'v_asignacion', true);

DO $$
DECLARE
  v_asignacion uuid := current_setting('prueba.asignacion_despacho')::uuid;
  v_estado text;
  v_asignaciones int;
  v_auditorias int;
  v_eventos int;
BEGIN
  PERFORM public.afirmar(
    v_asignacion IS NOT NULL,
    'el despacho debe devolver el identificador de la asignación creada'
  );

  SELECT status INTO v_estado FROM public.orders
  WHERE id = 'b0000000-0000-4000-8000-0000000000d1';
  PERFORM public.afirmar(
    v_estado = 'offered',
    'el pedido debe quedar en estado offered tras el despacho'
  );

  SELECT count(*) INTO v_asignaciones FROM public.order_assignments
  WHERE id = v_asignacion
    AND order_id = 'b0000000-0000-4000-8000-0000000000d1'
    AND courier_user_id = 'a0000000-0000-4000-8000-0000000000d1'
    AND status = 'offered';
  PERFORM public.afirmar(
    v_asignaciones = 1,
    'la asignación debe existir con estado offered'
  );

  SELECT count(*) INTO v_auditorias FROM public.audit_logs
  WHERE actor_id = 'a0000000-0000-4000-8000-0000000000d4'
    AND action = 'despacho_pedido'
    AND resource_type = 'order'
    AND resource_id = 'b0000000-0000-4000-8000-0000000000d1';
  PERFORM public.afirmar(
    v_auditorias = 1,
    'la operación debe registrar una entrada en audit_logs con el administrador como actor'
  );

  SELECT count(*) INTO v_eventos FROM public.order_events
  WHERE order_id = 'b0000000-0000-4000-8000-0000000000d1'
    AND event_type = 'despacho_administrativo'
    AND actor_id = 'a0000000-0000-4000-8000-0000000000d4'
    AND from_status = 'pending' AND to_status = 'offered';
  PERFORM public.afirmar(
    v_eventos = 1,
    'la operación debe registrar un evento despacho_administrativo con el administrador como actor'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Fase 3 — rechazos del RPC
-- ---------------------------------------------------------------------------
\if :con_service_role
SET LOCAL role service_role;
\endif

DO $$
DECLARE
  v_mensaje text;
BEGIN
  BEGIN
    PERFORM public.despachar_pedido(
      'b0000000-0000-4000-8000-0000000000d1',
      'a0000000-0000-4000-8000-0000000000d1',
      'a0000000-0000-4000-8000-0000000000d4'
    );
  EXCEPTION WHEN OTHERS THEN
    v_mensaje := SQLERRM;
  END;
  PERFORM public.afirmar(
    v_mensaje LIKE 'Solo se pueden despachar pedidos en estado pending%',
    'un pedido ya despachado no debe admitir una segunda oferta: ' ||
    COALESCE(v_mensaje, 'sin excepción')
  );
END;
$$;

DO $$
DECLARE
  v_mensaje text;
BEGIN
  BEGIN
    PERFORM public.despachar_pedido(
      'b0000000-0000-4000-8000-0000000000d3',
      'a0000000-0000-4000-8000-0000000000d2',
      'a0000000-0000-4000-8000-0000000000d4'
    );
  EXCEPTION WHEN OTHERS THEN
    v_mensaje := SQLERRM;
  END;
  PERFORM public.afirmar(
    v_mensaje LIKE 'El repartidor no está aprobado para operar%',
    'un repartidor con cuenta inactiva no debe poder recibir ofertas: ' ||
    COALESCE(v_mensaje, 'sin excepción')
  );
END;
$$;

DO $$
DECLARE
  v_mensaje text;
BEGIN
  BEGIN
    PERFORM public.despachar_pedido(
      'b0000000-0000-4000-8000-0000000000d2',
      'a0000000-0000-4000-8000-0000000000d1',
      'a0000000-0000-4000-8000-0000000000d4'
    );
  EXCEPTION WHEN OTHERS THEN
    v_mensaje := SQLERRM;
  END;
  PERFORM public.afirmar(
    v_mensaje LIKE 'Solo se pueden despachar pedidos en estado pending%',
    'un pedido en offered no debe poder despacharse de nuevo: ' ||
    COALESCE(v_mensaje, 'sin excepción')
  );
END;
$$;

DO $$
DECLARE
  v_mensaje text;
BEGIN
  BEGIN
    PERFORM public.despachar_pedido(
      'b0000000-0000-4000-8000-0000000000d1',
      'a0000000-0000-4000-8000-0000000000d1',
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    v_mensaje := SQLERRM;
  END;
  PERFORM public.afirmar(
    v_mensaje LIKE 'Se requiere el identificador del administrador%',
    'la llamada sin administrador verificado debe rechazarse: ' ||
    COALESCE(v_mensaje, 'sin excepción')
  );
END;
$$;

ROLLBACK;
