-- ============================================================================
-- KouriGo — CI: emulación mínima de Supabase Storage (SOLO para CI/desarrollo)
--
-- Crea el esquema `storage` con la superficie que usan las políticas de la
-- migración 0002 (buckets, objects y storage.foldername). NO aplicar al
-- proyecto real de Supabase: allí el esquema storage y sus permisos ya
-- existen. Ver database/README.md y ADR-0004.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    CREATE SCHEMA storage;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets (id),
  name text,
  owner_id text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_id, name)
);

-- Igual que en Supabase: segmentos de la ruta del objeto.
CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[]
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_segmentos text[];
BEGIN
  SELECT array_agg(seg) INTO v_segmentos
  FROM unnest(string_to_array(name, '/')) AS seg;
  RETURN v_segmentos;
END;
$$;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated, service_role;
GRANT SELECT ON storage.buckets TO authenticated, service_role;
