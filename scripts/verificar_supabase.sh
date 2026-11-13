#!/usr/bin/env bash
# ============================================================================
# KouriGo — Etapa 1.5: verificación contra el proyecto real de Supabase.
#
# Requiere DATABASE_URL. Ejecuta:
#   1) database/supabase/verificacion_esquema.sql  (solo lectura: tablas, RLS,
#      funciones, triggers, CHECK de estados, políticas de pedidos, PostGIS)
#   2) las pruebas de database/tests/ con la preparación de
#      database/supabase/preparacion_pruebas.sql. Cada prueba abre BEGIN y
#      cierra con ROLLBACK: no deja fixtures en el proyecto real.
#
# La función public.afirmar() se suelta en el trap de salida para no dejar
# objetos de prueba en el proyecto.
# ============================================================================
set -euo pipefail

: "${DATABASE_URL:?Define la variable DATABASE_URL (secreto de GitHub Actions)}"

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

LIMPIAR() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=0 \
    -qc "DROP FUNCTION IF EXISTS public.afirmar(boolean, text);" >/dev/null 2>&1 || true
}
trap LIMPIAR EXIT

echo "== Verificación del esquema contra el proyecto real de Supabase"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q \
  -f "$RAIZ/database/supabase/verificacion_esquema.sql"

for PRUEBA in pruebas_rls_cliente.sql pruebas_rls_repartidor.sql pruebas_transiciones.sql; do
  echo "== Prueba contra Supabase real: $PRUEBA"
  {
    cat "$RAIZ/database/supabase/preparacion_pruebas.sql"
    cat "$RAIZ/database/tests/$PRUEBA"
  } | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q
done

echo "OK: verificación contra Supabase real completada."
