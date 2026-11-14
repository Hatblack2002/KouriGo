-- ============================================================================
-- KouriGo — Migración 0005: disponibilidad del repartidor (interruptor «en línea»)
--
-- La maqueta aprobada del móvil incluye el interruptor «En ligne / Hors
-- ligne» de la pantalla de repartidor. Para que el interruptor sea REAL y no
-- decorativo (regla del proyecto: nada se simula) el backend necesita un
-- campo que registre la disponibilidad declarada por el propio repartidor.
--
-- La política «courier_actualizar_expediente_propio» ya permite al titular
-- actualizar su fila (el trigger trg_proteger_estado_verificacion sigue
-- blindando verification_status), así que no hacen falta políticas nuevas:
-- basta con la columna. La lectura sigue limitada al titular o a la
-- administración («courier_leer_propio_o_admin»).
--
-- Nota de alcance: esta columna registra la INTENCIÓN del repartidor. El
-- despacho real de ofertas lo ejecuta la administración con la Edge Function
-- despachar-pedido (RPC despachar_pedido); ninguna oferta se genera sola.
-- ============================================================================

BEGIN;

ALTER TABLE public.courier_profiles
  ADD COLUMN IF NOT EXISTS available boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.courier_profiles.available IS
  'Disponibilidad declarada por el propio repartidor (interruptor de la app móvil). El despacho de ofertas sigue siendo una operación administrativa.';

COMMIT;
