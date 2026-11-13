-- ============================================================================
-- KouriGo — Pruebas de la máquina de estados (trigger SQL)
-- Los pares permitidos deben coincidir con packages/domain/src/transiciones.ts.
-- Fixtures de prueba: NO son datos reales de operación.
-- ============================================================================
\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------------
-- Preparación (superusuario)
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'cliente-a@prueba.kourigo.local'),
  ('a0000000-0000-4000-8000-000000000004', 'repartidor-d@prueba.kourigo.local'),
  ('a0000000-0000-4000-8000-000000000005', 'admin-e@prueba.kourigo.local');

INSERT INTO public.user_roles (user_id, role) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'customer'),
  ('a0000000-0000-4000-8000-000000000004', 'courier'),
  ('a0000000-0000-4000-8000-000000000005', 'admin');

INSERT INTO public.courier_profiles (user_id, verification_status, account_active)
VALUES ('a0000000-0000-4000-8000-000000000004', 'approved', true);

-- ---------------------------------------------------------------------------
-- SISTEMA (sin claims JWT): solo ofrece y devuelve a la cola
-- ---------------------------------------------------------------------------
INSERT INTO public.orders (
  id, client_id, order_type, status, pickup_address_text, dropoff_address_text,
  currency, service_fee_amount
) VALUES (
  'b0000000-0000-4000-8000-000000000011',
  'a0000000-0000-4000-8000-000000000001',
  'delivery', 'pending', 'Recogida sistema', 'Destino sistema', 'HTG', 10000
);

UPDATE public.orders SET status = 'offered' WHERE id = 'b0000000-0000-4000-8000-000000000011';

SELECT public.afirmar(
  (SELECT status FROM public.orders WHERE id = 'b0000000-0000-4000-8000-000000000011') = 'offered',
  'el sistema puede ofrecer un pedido pendiente');

UPDATE public.orders SET status = 'pending' WHERE id = 'b0000000-0000-4000-8000-000000000011';

SELECT public.afirmar(
  (SELECT status FROM public.orders WHERE id = 'b0000000-0000-4000-8000-000000000011') = 'pending',
  'el sistema puede devolver una oferta sin respuesta a la cola');

-- ---------------------------------------------------------------------------
-- CLIENTE: no puede reabrir un pedido entregado; puede cancelar una oferta
-- ---------------------------------------------------------------------------
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001"}';

INSERT INTO public.orders (
  id, client_id, order_type, status, pickup_address_text, dropoff_address_text,
  currency, service_fee_amount
) VALUES (
  'b0000000-0000-4000-8000-000000000012',
  'a0000000-0000-4000-8000-000000000001',
  'delivery', 'delivered', 'Recogida T12', 'Destino T12', 'HTG', 10000
);

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.orders SET status = 'pending'
    WHERE id = 'b0000000-0000-4000-8000-000000000012';
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado,
    'un pedido entregado no puede volver a pendiente mediante una petición ordinaria');
END $$;

INSERT INTO public.orders (
  id, client_id, order_type, status, pickup_address_text, dropoff_address_text,
  currency, service_fee_amount
) VALUES (
  'b0000000-0000-4000-8000-000000000013',
  'a0000000-0000-4000-8000-000000000001',
  'delivery', 'offered', 'Recogida T13', 'Destino T13', 'HTG', 10000
);

UPDATE public.orders SET status = 'cancelled' WHERE id = 'b0000000-0000-4000-8000-000000000013';

SELECT public.afirmar(
  (SELECT status FROM public.orders WHERE id = 'b0000000-0000-4000-8000-000000000013') = 'cancelled',
  'el cliente puede cancelar mientras hay una oferta sin aceptar');

-- ---------------------------------------------------------------------------
-- REPARTIDOR: no puede tomar un pedido en borrador ni saltarse pasos
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000004"}';

INSERT INTO public.orders (
  id, client_id, order_type, status, pickup_address_text, dropoff_address_text,
  currency, service_fee_amount
) VALUES (
  'b0000000-0000-4000-8000-000000000014',
  'a0000000-0000-4000-8000-000000000001',
  'delivery', 'draft', 'Recogida T14', 'Destino T14', 'HTG', 10000
);

INSERT INTO public.order_assignments (order_id, courier_user_id, status)
VALUES ('b0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000004', 'offered');

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.orders SET status = 'pending'
    WHERE id = 'b0000000-0000-4000-8000-000000000014';
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado,
    'un repartidor no puede aceptar un pedido en borrador');
END $$;

INSERT INTO public.orders (
  id, client_id, order_type, status, pickup_address_text, dropoff_address_text,
  currency, service_fee_amount
) VALUES (
  'b0000000-0000-4000-8000-000000000015',
  'a0000000-0000-4000-8000-000000000001',
  'delivery', 'offered', 'Recogida T15', 'Destino T15', 'HTG', 10000
);

INSERT INTO public.order_assignments (order_id, courier_user_id, status)
VALUES ('b0000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000004', 'offered');

UPDATE public.orders SET status = 'accepted' WHERE id = 'b0000000-0000-4000-8000-000000000015';

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.orders SET status = 'picked_up'
    WHERE id = 'b0000000-0000-4000-8000-000000000015';
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado,
    'no se puede saltar el estado at_pickup sin pasar por él');
END $$;

-- ---------------------------------------------------------------------------
-- ADMINISTRADOR: resuelve incidencias y cancela con justificación; no puede
-- reabrir estados finales. Cada decisión debe quedar en order_events.
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000005"}';

INSERT INTO public.orders (
  id, client_id, order_type, status, pickup_address_text, dropoff_address_text,
  currency, service_fee_amount
) VALUES (
  'b0000000-0000-4000-8000-000000000016',
  'a0000000-0000-4000-8000-000000000001',
  'delivery', 'issue', 'Recogida T16', 'Destino T16', 'HTG', 10000
);

UPDATE public.orders SET status = 'pending' WHERE id = 'b0000000-0000-4000-8000-000000000016';

SELECT public.afirmar(
  (SELECT status FROM public.orders WHERE id = 'b0000000-0000-4000-8000-000000000016') = 'pending',
  'el administrador puede resolver una incidencia devolviendo el pedido a la cola');

SELECT public.afirmar(
  (SELECT count(*) FROM public.order_events
   WHERE order_id = 'b0000000-0000-4000-8000-000000000016'
     AND event_type = 'status_changed'
     AND from_status = 'issue'
     AND to_status = 'pending') = 1,
  'la corrección administrativa debe quedar registrada en order_events');

INSERT INTO public.orders (
  id, client_id, order_type, status, pickup_address_text, dropoff_address_text,
  currency, service_fee_amount
) VALUES (
  'b0000000-0000-4000-8000-000000000017',
  'a0000000-0000-4000-8000-000000000001',
  'delivery', 'in_transit', 'Recogida T17', 'Destino T17', 'HTG', 10000
);

UPDATE public.orders SET status = 'cancelled' WHERE id = 'b0000000-0000-4000-8000-000000000017';

SELECT public.afirmar(
  (SELECT status FROM public.orders WHERE id = 'b0000000-0000-4000-8000-000000000017') = 'cancelled',
  'el administrador puede cancelar un pedido en tránsito con justificación');

INSERT INTO public.orders (
  id, client_id, order_type, status, pickup_address_text, dropoff_address_text,
  currency, service_fee_amount
) VALUES (
  'b0000000-0000-4000-8000-000000000018',
  'a0000000-0000-4000-8000-000000000001',
  'delivery', 'delivered', 'Recogida T18', 'Destino T18', 'HTG', 10000
);

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.orders SET status = 'in_transit'
    WHERE id = 'b0000000-0000-4000-8000-000000000018';
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado,
    'ni siquiera el administrador reabre un pedido entregado mediante petición ordinaria');
END $$;

ROLLBACK;
