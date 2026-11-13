-- ============================================================================
-- KouriGo — Etapa 1.5: preparación para ejecutar database/tests/pruebas_*.sql
-- contra el proyecto REAL de Supabase.
--
-- Crea la función de aserción que en CI aporta
-- database/ci/0000_emulacion_supabase_auth.sql (misma definición). El script
-- scripts/verificar_supabase.sh la elimina en su trap de salida.
--
-- Las pruebas abren BEGIN y cierran con ROLLBACK: no dejan fixtures en el
-- proyecto real (fixtures de prueba: NO son datos reales de operación).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.afirmar(condicion boolean, mensaje text) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT COALESCE(condicion, false) THEN
    RAISE EXCEPTION 'FALLO DE PRUEBA: %', mensaje;
  END IF;
END
$$;
