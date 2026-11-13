-- ============================================================================
-- KouriGo — Migración 0004: operación privilegiada de despacho (Etapa 3)
--
-- Fuente: docs/architecture/backend-supabase.md (sección "Edge Functions y
-- servidor") y docs/product/plan-etapas.md (Etapa 3).
--
-- El despacho crea la oferta al repartidor, mueve el pedido a `offered` y
-- registra auditoría. Los tres pasos deben ser atómicos, así que viven en
-- una función SECURITY DEFINER que solo puede ejecutar `service_role`:
-- REVOKE a PUBLIC, anon y authenticated garantiza que la única vía de
-- entrada sea la Edge Function supabase/functions/despachar-pedido, que
-- autentica al llamador con su JWT real, comprueba el rol de administrador
-- contra user_roles y pasa el identificador del administrador verificado.
--
-- El llamador autenticado que invoque el RPC directamente por PostgREST
-- recibe un error de privilegio (42501). Ver docs/decisions/
-- ADR-0005-edge-functions.md.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.despachar_pedido(
  id_pedido uuid,
  id_repartidor uuid,
  id_administrador uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_estado text;
  v_asignacion uuid;
BEGIN
  IF id_administrador IS NULL THEN
    RAISE EXCEPTION 'Se requiere el identificador del administrador que despacha';
  END IF;

  SELECT status INTO v_estado FROM public.orders WHERE id = id_pedido;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido % no existe', id_pedido;
  END IF;
  IF v_estado <> 'pending' THEN
    RAISE EXCEPTION
      'Solo se pueden despachar pedidos en estado pending (estado actual: %)',
      v_estado;
  END IF;

  -- Regla de habilitación operativa: expediente aprobado y cuenta activa
  -- (docs/operations/courier-identity-verification.md sección 8).
  IF NOT EXISTS (
    SELECT 1 FROM public.courier_profiles cp
    WHERE cp.user_id = id_repartidor
      AND cp.verification_status = 'approved'
      AND cp.account_active = true
  ) THEN
    RAISE EXCEPTION 'El repartidor no está aprobado para operar';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.order_assignments oa
    WHERE oa.order_id = id_pedido AND oa.status IN ('offered', 'accepted')
  ) THEN
    RAISE EXCEPTION 'El pedido ya tiene una oferta activa para un repartidor';
  END IF;

  INSERT INTO public.order_assignments (order_id, courier_user_id, status)
  VALUES (id_pedido, id_repartidor, 'offered')
  RETURNING id INTO v_asignacion;

  -- El trigger validar_transicion_pedido registra su propio evento de
  -- cambio de estado con el rol de la sesión (sistema cuando la llamada
  -- llega por service_role).
  UPDATE public.orders SET status = 'offered' WHERE id = id_pedido;

  -- Evento explícito con el administrador real como actor, determinado por
  -- la Edge Function a partir del JWT verificado (nunca desde el cliente).
  INSERT INTO public.order_events
    (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES
    (id_pedido, id_administrador, 'despacho_administrativo', 'pending', 'offered',
     jsonb_build_object('assignment_id', v_asignacion,
                        'courier_user_id', id_repartidor));

  -- Auditoría de la operación privilegiada: audit_logs no tiene política de
  -- INSERT, de modo que el registro queda reservado al service_role y al
  -- propietario (sección "Edge Functions y servidor" del backend).
  INSERT INTO public.audit_logs
    (actor_id, action, resource_type, resource_id, metadata)
  VALUES
    (id_administrador, 'despacho_pedido', 'order', id_pedido::text,
     jsonb_build_object('assignment_id', v_asignacion,
                        'courier_user_id', id_repartidor));

  RETURN v_asignacion;
END;
$$;

-- Única vía de entrada: la Edge Function con service_role. Los roles de
-- sesión (anon y authenticated) no pueden ejecutarla, ni directa ni a
-- través de PUBLIC.
REVOKE ALL ON FUNCTION public.despachar_pedido(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.despachar_pedido(uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.despachar_pedido(uuid, uuid, uuid) TO service_role;

COMMIT;
