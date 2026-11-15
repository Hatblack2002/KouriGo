-- ============================================================================
-- KouriGo — Pruebas: perfil del cliente editable e inspección del repartidor
-- (migración 0006). Casos positivos y negativos según
-- docs/product/perfiles-imagenes-verificacion.md secciones 3, 4 y 5.
-- Fixtures de prueba: NO son datos reales de operación.
-- ============================================================================
\set ON_ERROR_STOP on

BEGIN;

SET LOCAL search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Preparación (superusuario): usuarios y roles de prueba
--   c1 repartidor aprobado · c2 repartidor en draft · c3 cliente · c5 admin
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-4000-8000-000000000101', 'repartidor-p@prueba.kourigo.local'),
  ('a0000000-0000-4000-8000-000000000102', 'repartidor-q@prueba.kourigo.local'),
  ('a0000000-0000-4000-8000-000000000103', 'cliente-perfil@prueba.kourigo.local'),
  ('a0000000-0000-4000-8000-000000000105', 'admin-perfil@prueba.kourigo.local');

INSERT INTO public.user_roles (user_id, role) VALUES
  ('a0000000-0000-4000-8000-000000000101', 'courier'),
  ('a0000000-0000-4000-8000-000000000102', 'courier'),
  ('a0000000-0000-4000-8000-000000000103', 'customer'),
  ('a0000000-0000-4000-8000-000000000105', 'admin');

-- Los fixtures se insertan con los triggers desactivados: esta prueba
-- cubre la RPC de inspección y el perfil editable, no el flujo de
-- transiciones del expediente (eso ya lo cubren las pruebas de
-- verificación del expediente). El repartidor P ya está «aprobado».
SET LOCAL session_replication_role = replica;

INSERT INTO public.courier_profiles (user_id, verification_status, work_zone, vehicle_plate) VALUES
  ('a0000000-0000-4000-8000-000000000101', 'approved', 'Delmas', 'PRUEBA123'),
  ('a0000000-0000-4000-8000-000000000102', 'draft', 'Pétion-Ville', 'PRUEBA456');

INSERT INTO public.courier_verification_cases (id, courier_user_id, status, verification_method, decision_at)
VALUES ('d0000000-0000-4000-8000-000000000101',
        'a0000000-0000-4000-8000-000000000101', 'approved',
        'documental', now() - interval '2 days');

SET LOCAL session_replication_role = DEFAULT;

-- ---------------------------------------------------------------------------
-- 1. El cliente edita TODOS los campos de su perfil (a su favor)
-- ---------------------------------------------------------------------------
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000103"}';

INSERT INTO public.profiles (id, full_name, phone, departamento, ville, codigo_postal, numero_casa)
VALUES ('a0000000-0000-4000-8000-000000000103',
        'Cliente de Prueba', '+50937141234', 'Ouest', 'Delmas', '6110', '#113');

SELECT public.afirmar(
  (SELECT count(*) FROM public.profiles
   WHERE id = 'a0000000-0000-4000-8000-000000000103'
     AND departamento = 'Ouest' AND ville = 'Delmas'
     AND numero_casa = '#113' AND codigo_postal = '6110'
     AND phone = '+50937141234') = 1,
  'el cliente guarda su perfil completo (nombre, +509, departamento, ville, código postal, casa)');

-- Edita a su favor todo el conjunto en una sola actualización
UPDATE public.profiles
SET full_name = 'Cliente Renombrado', ville = 'Pétion-Ville',
    numero_casa = '#42, Rue 12, Delmas', codigo_postal = NULL
WHERE id = 'a0000000-0000-4000-8000-000000000103';

SELECT public.afirmar(
  (SELECT ville FROM public.profiles
   WHERE id = 'a0000000-0000-4000-8000-000000000103') = 'Pétion-Ville',
  'el cliente puede volver a editar cualquier campo de su perfil');

-- ---------------------------------------------------------------------------
-- 2. Reglas negativas del perfil (CHECK)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.profiles SET departamento = 'Oaxaca'
    WHERE id = 'a0000000-0000-4000-8000-000000000103';
  EXCEPTION WHEN check_violation THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(bloqueado, 'el departamento debe ser uno de los 10 de Haití');
END $$;

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.profiles SET phone = '+509 1234 5678'
    WHERE id = 'a0000000-0000-4000-8000-000000000103';
  EXCEPTION WHEN check_violation THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(bloqueado, 'el teléfono debe ser +509 y 8 dígitos sin espacios');
END $$;

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.profiles SET phone = '+50951412347'
    WHERE id = 'a0000000-0000-4000-8000-000000000103';
  EXCEPTION WHEN check_violation THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(bloqueado,
    'el primer dígito del número local debe ser 2, 3 o 4');
END $$;

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.profiles SET numero_casa = repeat('#1', 80)
    WHERE id = 'a0000000-0000-4000-8000-000000000103';
  EXCEPTION WHEN check_violation THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(bloqueado, 'el número de casa no supera la longitud máxima');
END $$;

-- ---------------------------------------------------------------------------
-- 3. Inspección: el cliente VE el repartidor aprobado, NO puede modificar
-- ---------------------------------------------------------------------------
SELECT public.afirmar(
  (SELECT verificado FROM public.perfil_publico_repartidor(
     'a0000000-0000-4000-8000-000000000101')) = true,
  'el cliente ve verificado=true al inspeccionar al repartidor aprobado');

SELECT public.afirmar(
  (SELECT placa_vehiculo || '|' || zona_trabajo FROM public.perfil_publico_repartidor(
     'a0000000-0000-4000-8000-000000000101')) = 'PRUEBA123|Delmas',
  'la inspección expone zona y placa (datos operativos seguros)');

SELECT public.afirmar(
  (SELECT metodo_verificacion FROM public.perfil_publico_repartidor(
     'a0000000-0000-4000-8000-000000000101')) = 'documental',
  'la inspección muestra el método de verificación y su fecha');

-- El repartidor en draft NO es inspeccionable: sin filas
SELECT public.afirmar(
  (SELECT count(*) FROM public.perfil_publico_repartidor(
     'a0000000-0000-4000-8000-000000000102')) = 0,
  'un repartidor sin aprobación no aparece en la inspección');

DO $$
DECLARE
  afectadas int := 0;
  bloqueado boolean := false;
BEGIN
  BEGIN
    UPDATE public.courier_profiles SET vehicle_plate = 'CULPABLE1'
    WHERE user_id = 'a0000000-0000-4000-8000-000000000101';
    GET DIAGNOSTICS afectadas = ROW_COUNT;
  EXCEPTION WHEN insufficient_privilege THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(
    bloqueado OR afectadas = 0,
    'el cliente NO puede modificar el perfil del repartidor que inspecciona');
END $$;

-- ---------------------------------------------------------------------------
-- 4. Cuenta desactivada o sin sesión: la inspección no está disponible
-- ---------------------------------------------------------------------------
RESET role;
RESET request.jwt.claims;

UPDATE public.courier_profiles SET account_active = false
WHERE user_id = 'a0000000-0000-4000-8000-000000000101';

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000103"}';

SELECT public.afirmar(
  (SELECT count(*) FROM public.perfil_publico_repartidor(
     'a0000000-0000-4000-8000-000000000101')) = 0,
  'una cuenta de repartidor desactivada no aparece en la inspección');

RESET role;
RESET request.jwt.claims;

UPDATE public.courier_profiles SET account_active = true
WHERE user_id = 'a0000000-0000-4000-8000-000000000101';

-- Sin sesión (rol anon con claims de anónimo) la función debe estar denegada
SET LOCAL role anon;

DO $$
DECLARE
  bloqueado boolean := false;
BEGIN
  BEGIN
    PERFORM * FROM public.perfil_publico_repartidor(
      'a0000000-0000-4000-8000-000000000101');
  EXCEPTION WHEN insufficient_privilege THEN
    bloqueado := true;
  END;
  PERFORM public.afirmar(bloqueado,
    'sin sesión autenticada la inspección está denegada');
END $$;

ROLLBACK;
