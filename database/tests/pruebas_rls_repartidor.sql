-- ============================================================================
-- KouriGo — Pruebas de autorización: repartidor
-- Regla central (docs/operations/courier-identity-verification.md): sin estado
-- 'approved', el backend deniega ver ofertas, aceptar pedidos y operar.
-- Fixtures de prueba: NO son datos reales de operación.
-- ============================================================================
\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------------
-- Preparación (superusuario)
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'cliente-a@prueba.kourigo.local'),
  ('a0000000-0000-4000-8000-000000000002', 'cliente-b@prueba.kourigo.local'),
  ('a0000000-0000-4000-8000-000000000003', 'repartidor-c@prueba.kourigo.local'),
  ('a0000000-0000-4000-8000-000000000004', 'repartidor-d@prueba.kourigo.local'),
  ('a0000000-0000-4000-8000-000000000005', 'admin-e@prueba.kourigo.local');

INSERT INTO public.user_roles (user_id, role) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'customer'),
  ('a0000000-0000-4000-8000-000000000002', 'customer'),
  ('a0000000-0000-4000-8000-000000000003', 'courier'),
  ('a0000000-0000-4000-8000-000000000004', 'courier'),
  ('a0000000-0000-4000-8000-000000000005', 'admin');

INSERT INTO public.courier_profiles (user_id, verification_status, account_active) VALUES
  ('a0000000-0000-4000-8000-000000000003', 'submitted', true),
  ('a0000000-0000-4000-8000-000000000004', 'approved', true);

-- Pedido X del cliente A, ya ofrecido a los dos repartidores de prueba
INSERT INTO public.orders (
  id, client_id, order_type, status, pickup_address_text, dropoff_address_text,
  currency, service_fee_amount
) VALUES (
  'b0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000001',
  'delivery', 'pending', 'Direccion de recogida del pedido X', 'Direccion de destino del pedido X',
  'HTG', 15000
);

UPDATE public.orders SET status = 'offered' WHERE id = 'b0000000-0000-4000-8000-000000000003';

INSERT INTO public.order_assignments (order_id, courier_user_id, status) VALUES
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'offered'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004', 'offered');

-- Pedido privado del cliente B (no debe verse desde otros roles)
INSERT INTO public.orders (
  id, client_id, order_type, status, pickup_address_text, dropoff_address_text,
  currency, service_fee_amount
) VALUES (
  'b0000000-0000-4000-8000-000000000004',
  'a0000000-0000-4000-8000-000000000002',
  'delivery', 'draft', 'Direccion de recogida del cliente B', 'Direccion de destino del cliente B',
  'HTG', 12000
);

-- ---------------------------------------------------------------------------
-- Repartidor C SIN aprobación: no ve ofertas ni pedidos operativos, no puede
-- aceptar asignaciones ni auto-aprobarse
-- ---------------------------------------------------------------------------
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000003"}';

SELECT public.afirmar(
  (SELECT count(*) FROM public.orders WHERE id = 'b0000000-0000-4000-8000-000000000003') = 0,
  'un repartidor sin aprobar no debe ver ofertas de pedidos');

SELECT public.afirmar(
  (SELECT count(*) FROM public.order_assignments
   WHERE courier_user_id = 'a0000000-0000-4000-8000-000000000003') = 0,
  'un repartidor sin aprobar no debe ver sus asignaciones');

DO $$
DECLARE
  bloqueado boolean := false;
  afectadas int := 0;
BEGIN
  BEGIN
    UPDATE public.order_assignments SET status = 'accepted'
    WHERE order_id = 'b0000000-0000-4000-8000-000000000003'
      AND courier_user_id = 'a0000000-0000-4000-8000-000000000003';
    GET DIAGNOSTICS afectadas = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  -- El bloqueo puede manifestarse como excepción (trigger/RLS) o como
  -- actualización silenciosa de cero filas (la fila no es visible para el rol).
  PERFORM public.afirmar(
    bloqueado OR afectadas = 0,
    'un repartidor sin aprobar no debe poder aceptar un pedido');
END $$;

DO $$
DECLARE
  bloqueado boolean := false;
  afectadas int := 0;
BEGIN
  BEGIN
    UPDATE public.courier_profiles SET verification_status = 'approved'
    WHERE user_id = 'a0000000-0000-4000-8000-000000000003';
    GET DIAGNOSTICS afectadas = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado OR afectadas = 0,
    'un candidato no debe poder aprobar su propio expediente');
END $$;

-- ---------------------------------------------------------------------------
-- Repartidor D aprobado: ve su oferta, acepta y ejecuta el ciclo completo
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000004"}';

SELECT public.afirmar(
  (SELECT count(*) FROM public.order_assignments
   WHERE order_id = 'b0000000-0000-4000-8000-000000000003'
     AND courier_user_id = 'a0000000-0000-4000-8000-000000000004') = 1,
  'el repartidor aprobado debe ver su asignación');

SELECT public.afirmar(
  (SELECT count(*) FROM public.orders WHERE id = 'b0000000-0000-4000-8000-000000000003') = 1,
  'el repartidor aprobado debe ver el pedido ofrecido');

SELECT public.afirmar(
  (SELECT count(*) FROM public.orders WHERE id = 'b0000000-0000-4000-8000-000000000004') = 0,
  'el repartidor no debe ver pedidos que no le conciernen');

SELECT public.afirmar(
  (SELECT count(*) FROM public.courier_profiles
   WHERE user_id = 'a0000000-0000-4000-8000-000000000003') = 0,
  'un repartidor no debe leer el expediente de otro repartidor');

UPDATE public.order_assignments SET status = 'accepted'
WHERE order_id = 'b0000000-0000-4000-8000-000000000003'
  AND courier_user_id = 'a0000000-0000-4000-8000-000000000004';

SELECT public.afirmar(
  (SELECT status FROM public.order_assignments
   WHERE order_id = 'b0000000-0000-4000-8000-000000000003'
     AND courier_user_id = 'a0000000-0000-4000-8000-000000000004') = 'accepted',
  'el repartidor aprobado puede aceptar su asignación');

UPDATE public.orders SET status = 'accepted' WHERE id = 'b0000000-0000-4000-8000-000000000003';
UPDATE public.orders SET status = 'at_pickup' WHERE id = 'b0000000-0000-4000-8000-000000000003';
UPDATE public.orders SET status = 'picked_up' WHERE id = 'b0000000-0000-4000-8000-000000000003';
UPDATE public.orders SET status = 'in_transit' WHERE id = 'b0000000-0000-4000-8000-000000000003';

SELECT public.afirmar(
  (SELECT status FROM public.orders WHERE id = 'b0000000-0000-4000-8000-000000000003') = 'in_transit',
  'el repartidor aprobado recorre el ciclo operativo hasta in_transit');

-- El cliente no puede marcar la entrega por su cuenta
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001"}';

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.orders SET status = 'delivered'
    WHERE id = 'b0000000-0000-4000-8000-000000000003';
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado,
    'el cliente no debe poder marcar su pedido como entregado');
END $$;

-- El repartidor completa la entrega y cierra su asignación
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000004"}';

UPDATE public.orders SET status = 'delivered' WHERE id = 'b0000000-0000-4000-8000-000000000003';

SELECT public.afirmar(
  (SELECT status FROM public.orders WHERE id = 'b0000000-0000-4000-8000-000000000003') = 'delivered',
  'el repartidor aprobado completa la entrega');

UPDATE public.order_assignments SET status = 'completed'
WHERE order_id = 'b0000000-0000-4000-8000-000000000003'
  AND courier_user_id = 'a0000000-0000-4000-8000-000000000004';

SELECT public.afirmar(
  (SELECT status FROM public.order_assignments
   WHERE order_id = 'b0000000-0000-4000-8000-000000000003'
     AND courier_user_id = 'a0000000-0000-4000-8000-000000000004') = 'completed',
  'la asignación queda completada');

SELECT public.afirmar(
  (SELECT count(*) FROM public.order_events
   WHERE order_id = 'b0000000-0000-4000-8000-000000000003'
     AND event_type = 'status_changed'
     AND to_status = 'delivered') = 1,
  'la entrega queda registrada en order_events');

-- ---------------------------------------------------------------------------
-- La suspensión bloquea inmediatamente las operaciones protegidas
-- ---------------------------------------------------------------------------
RESET role;
RESET request.jwt.claims;

UPDATE public.courier_profiles SET verification_status = 'suspended'
WHERE user_id = 'a0000000-0000-4000-8000-000000000004';

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000004"}';

SELECT public.afirmar(
  (SELECT count(*) FROM public.orders WHERE id = 'b0000000-0000-4000-8000-000000000003') = 0,
  'un repartidor suspendido no debe seguir viendo pedidos operativos');

ROLLBACK;
