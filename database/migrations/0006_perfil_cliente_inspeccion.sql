-- ============================================================================
-- KouriGo — Migración 0006: perfil del cliente editable e inspección
-- pública del repartidor.
--
-- Decisiones del fundador (2026-11-15, docs/product/
-- perfiles-imagenes-verificacion.md):
--  1. El cliente edita su perfil desde la APK: foto + teléfono solo
--     formato Haití (+509 y 8 dígitos) + nombre completo + departamento +
--     ville + código postal + número de casa (formato local «#113»).
--     Esa información prellena la dirección de entrega al crear un pedido.
--  2. El cliente puede INSPECCIONAR (solo lectura) el perfil de cualquier
--     repartidor aprobado que se le asigne, sin poder modificar nada y sin
--     ver documentos internos: función RPC con lista blanca de columnas.
--  3. El repartidor no edita su identidad: vive en courier_profiles y el
--     expediente de verificación (migraciones 0002/0003/0005).
--
-- La foto (avatar) se guarda con public_id + URL de entrega del proveedor
-- camuflado; la subida pasa por la Edge Function `subir-imagen`.
-- ============================================================================

BEGIN;

SET LOCAL search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Columnas nuevas del perfil (todas editables por el propio usuario, RLS
-- «perfiles_actualizar_propio» ya existente)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS departamento text,
  ADD COLUMN IF NOT EXISTS ville text,
  ADD COLUMN IF NOT EXISTS codigo_postal text,
  ADD COLUMN IF NOT EXISTS numero_casa text,
  ADD COLUMN IF NOT EXISTS avatar_public_id text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Reglas de integridad: los 10 departamentos de Haití, longitudes máximas
-- y el teléfono en formato Haití normalizado (+509 y 8 dígitos, primer
-- dígito 2/3/4 según la numeración nacional). La tabla estaba vacía al
-- aplicar esta migración: las restricciones estrictas son seguras.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_departamento_valido
    CHECK (departamento IS NULL OR departamento IN (
      'Ouest', 'Artibonite', 'Centre', 'Grand''Anse', 'Nippes',
      'Nord', 'Nord-Est', 'Nord-Ouest', 'Sud', 'Sud-Est'
    ));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_telefono_haiti
    CHECK (phone IS NULL OR phone ~ '^\+509[234][0-9]{7}$');

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_longitudes_perfil
    CHECK (
      (ville IS NULL OR char_length(ville) BETWEEN 1 AND 120)
      AND (codigo_postal IS NULL OR char_length(codigo_postal) BETWEEN 1 AND 20)
      AND (numero_casa IS NULL OR char_length(numero_casa) BETWEEN 1 AND 120)
      AND (avatar_public_id IS NULL OR char_length(avatar_public_id) BETWEEN 1 AND 300)
      AND (avatar_url IS NULL OR char_length(avatar_url) BETWEEN 1 AND 600)
    );

-- ---------------------------------------------------------------------------
-- Inspección pública del repartidor (solo lectura)
--
-- SECURITY DEFINER es necesario porque el cliente NO tiene SELECT directo
-- sobre courier_profiles; la función expone únicamente la lista blanca de
-- columnas seguras y solo si el expediente está aprobado y la cuenta activa.
-- Los documentos, motivos y el historial interno quedan fuera.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.perfil_publico_repartidor(courier_user_id uuid)
RETURNS TABLE (
  usuario_id uuid,
  nombre text,
  foto_url text,
  verificado boolean,
  estado_verificacion text,
  metodo_verificacion text,
  verificado_el timestamptz,
  zona_trabajo text,
  placa_vehiculo text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    cp.user_id,
    p.full_name,
    p.avatar_url,
    (cp.verification_status = 'approved'),
    cp.verification_status,
    caso.verification_method,
    caso.decision_at,
    cp.work_zone,
    cp.vehicle_plate
  FROM public.courier_profiles cp
  LEFT JOIN public.profiles p ON p.id = cp.user_id
  LEFT JOIN LATERAL (
    SELECT c.verification_method, c.decision_at
    FROM public.courier_verification_cases c
    WHERE c.courier_user_id = cp.user_id
      AND c.status = 'approved'
    ORDER BY c.decision_at DESC NULLS LAST
    LIMIT 1
  ) caso ON true
  WHERE cp.user_id = courier_user_id
    AND cp.verification_status = 'approved'
    AND cp.account_active
    AND EXISTS (
      SELECT 1
      FROM public.user_roles llamador
      WHERE llamador.user_id = auth.uid()
        AND llamador.status = 'active'
    );
$$;

-- Solo sesiones autenticadas pueden inspeccionar: sin acceso para anon ni
-- PUBLIC (por defecto las funciones son ejecutables por PUBLIC).
REVOKE EXECUTE ON FUNCTION public.perfil_publico_repartidor(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.perfil_publico_repartidor(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.perfil_publico_repartidor(uuid) TO authenticated;

COMMENT ON FUNCTION public.perfil_publico_repartidor(uuid) IS
  'Inspección de solo lectura del perfil de un repartidor aprobado: lista '
  'blanca de columnas seguras; nunca expone documentos ni datos internos '
  '(docs/product/perfiles-imagenes-verificacion.md sección 5).';

COMMIT;
