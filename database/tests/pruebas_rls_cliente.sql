-- ============================================================================
-- KouriGo — Pruebas de autorización: cliente
-- Casos positivos y negativos según README sección 16 y
-- docs/architecture/backend-supabase.md sección 10.
-- Fixtures de prueba: NO son datos reales de operación.
-- ============================================================================
\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------------
-- Preparación (superusuario): usuarios y roles de prueba
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'cliente-a@prueba.kourigo.local'),
  ('a0000000-0000-4000-8000-000000000002', 'cliente-b@prueba.kourigo.local'),
  ('a0000000-0000-4000-8000-000000000005', 'admin-e@prueba.kourigo.local');

INSERT INTO public.user_roles (user_id, role) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'customer'),
  ('a0000000-0000-4000-8000-000000000002', 'customer'),
  ('a0000000-0000-4000-8000-000000000005', 'admin');

-- ---------------------------------------------------------------------------
-- El cliente A crea su pedido en borrador y lo ve
-- ---------------------------------------------------------------------------
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001"}';

INSERT INTO public.orders (
  id, client_id, order_type, status, pickup_address_text, dropoff_address_text,
  currency, service_fee_amount
) VALUES (
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'delivery', 'draft', 'Avenue Jean-Paul II, junto a la farmacia', 'Rue 12, Delmas, casa azul',
  'HTG', 15000
);

SELECT public.afirmar(
  (SELECT count(*) FROM public.orders WHERE id = 'b0000000-0000-4000-8000-000000000001') = 1,
  'el cliente A debe ver su propio pedido');

-- ---------------------------------------------------------------------------
-- El cliente A NO puede insertar directamente un pedido ya confirmado
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.orders (
      id, client_id, order_type, status, pickup_address_text, dropoff_address_text,
      currency, service_fee_amount
    ) VALUES (
      'b0000000-0000-4000-8000-000000000009',
      'a0000000-0000-4000-8000-000000000001',
      'delivery', 'pending', 'Punto de recogida de prueba', 'Destino de prueba',
      'HTG', 10000
    );
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado,
    'insertar un pedido directamente en estado pending debe estar bloqueado');
END $$;

-- ---------------------------------------------------------------------------
-- El cliente B crea su pedido; A no debe verlo (aislamiento entre clientes)
-- ---------------------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002"}';

INSERT INTO public.orders (
  id, client_id, order_type, status, pickup_address_text, dropoff_address_text,
  currency, service_fee_amount
) VALUES (
  'b0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000002',
  'delivery', 'draft', 'Direccion de recogida del cliente B', 'Direccion de destino del cliente B',
  'HTG', 12000
);

SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001"}';

SELECT public.afirmar(
  (SELECT count(*) FROM public.orders WHERE id = 'b0000000-0000-4000-8000-000000000002') = 0,
  'el cliente A no debe ver el pedido del cliente B');

-- ---------------------------------------------------------------------------
-- El cliente A confirma su pedido (draft -> pending) y el evento queda
-- registrado; luego NO puede marcarlo en tránsito por su cuenta
-- ---------------------------------------------------------------------------
UPDATE public.orders SET status = 'pending' WHERE id = 'b0000000-0000-4000-8000-000000000001';

SELECT public.afirmar(
  (SELECT status FROM public.orders WHERE id = 'b0000000-0000-4000-8000-000000000001') = 'pending',
  'el cliente A puede confirmar su pedido (draft -> pending)');

SELECT public.afirmar(
  (SELECT count(*) FROM public.order_events
   WHERE order_id = 'b0000000-0000-4000-8000-000000000001'
     AND event_type = 'status_changed'
     AND from_status = 'draft'
     AND to_status = 'pending') = 1,
  'el cambio de estado debe quedar registrado en order_events');

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.orders SET status = 'in_transit'
    WHERE id = 'b0000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado,
    'el cliente no debe poder pasar su pedido a in_transit');
END $$;

-- ---------------------------------------------------------------------------
-- El cliente no puede leer ni escribir auditoría ni mayor financiero
-- ---------------------------------------------------------------------------
SELECT public.afirmar(
  (SELECT count(*) FROM public.audit_logs) = 0,
  'un cliente no debe leer audit_logs');

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id)
    VALUES ('a0000000-0000-4000-8000-000000000001', 'intento_no_valido', 'audit_logs', 'x');
  EXCEPTION WHEN OTHERS THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(bloqueado, 'un cliente no debe poder escribir en audit_logs');
END $$;

SELECT public.afirmar(
  (SELECT count(*) FROM public.ledger_entries) = 0,
  'un cliente no debe leer ledger_entries');

RESET role;
RESET request.jwt.claims;

INSERT INTO public.ledger_entries (account, order_id, entry_type, amount, currency, reference)
VALUES ('courier:prueba', NULL, 'commission', 40, 'HTG', 'prueba-inmutabilidad');

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001"}';

DO $$
DECLARE
  denegado boolean := false;
BEGIN
  BEGIN
    UPDATE public.ledger_entries SET amount = 999 WHERE reference = 'prueba-inmutabilidad';
  EXCEPTION WHEN OTHERS THEN
    denegado := true;
  END;
  PERFORM public.afirmar(
    denegado,
    'un cliente no debe poder modificar el mayor financiero');
END $$;

-- ---------------------------------------------------------------------------
-- Geolocalización con PostGIS (docs/architecture/backend-supabase.md sección 9:
-- no dar PostGIS por probado sin ejecutar consultas geoespaciales)
-- ---------------------------------------------------------------------------
RESET role;
RESET request.jwt.claims;

INSERT INTO public.service_zones (id, name, boundary)
VALUES (
  'c0000000-0000-4000-8000-000000000001',
  'Zona de prueba',
  ST_GeogFromText('SRID=4326;MULTIPOLYGON(((-72.40 18.50, -72.30 18.50, -72.30 18.60, -72.40 18.60, -72.40 18.50)))')
);

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001"}';

UPDATE public.orders
SET pickup_coordinates = ST_SetSRID(ST_MakePoint(-72.35, 18.55), 4326)::geography
WHERE id = 'b0000000-0000-4000-8000-000000000001';

SELECT public.afirmar(
  EXISTS (
    SELECT 1 FROM public.service_zones z
    WHERE z.status = 'active'
      AND ST_Contains(
        z.boundary::geometry,
        (SELECT pickup_coordinates::geometry FROM public.orders
         WHERE id = 'b0000000-0000-4000-8000-000000000001')
      )
  ),
  'la zona de servicio activa debe contener el punto de recogida del pedido');

SELECT public.afirmar(
  (SELECT ST_Distance(
     pickup_coordinates,
     ST_SetSRID(ST_MakePoint(-72.34, 18.56), 4326)::geography)
   FROM public.orders
   WHERE id = 'b0000000-0000-4000-8000-000000000001') > 0,
  'ST_Distance sobre geografía debe devolver una distancia positiva');

ROLLBACK;
