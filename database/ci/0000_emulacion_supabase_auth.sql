-- ============================================================================
-- KouriGo — CI: emulación mínima de Supabase Auth (SOLO para CI/desarrollo)
--
-- Permite probar las políticas RLS y los triggers fuera de Supabase, contra
-- un PostgreSQL 16 + PostGIS. NO aplicar al proyecto real de Supabase: allí
-- el esquema auth y los roles ya existen.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Supabase Auth expone auth.uid() a partir de los claims JWT de la solicitud.
-- En CI, las pruebas lo fijan con: SET LOCAL request.jwt.claims = '{"sub": "..."}'.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;

-- Ayudante de pruebas: falla con excepción cuando una condición esperada no
-- se cumple. Se ejecuta con los privilegios del actor de prueba (SECURITY
-- INVOKER), de modo que las consultas dentro de la condición sufren las
-- mismas políticas RLS que el actor real.
CREATE OR REPLACE FUNCTION public.afirmar(condicion boolean, mensaje text) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT COALESCE(condicion, false) THEN
    RAISE EXCEPTION 'FALLO DE PRUEBA: %', mensaje;
  END IF;
END
$$;
