#!/usr/bin/env bash
# ============================================================================
# KouriGo — pruebas de base de datos contra PostgreSQL 16 + PostGIS.
#
# Por cada archivo database/tests/pruebas_*.sql crea una base limpia, aplica
# las emulaciones de Supabase (Auth y Storage), las migraciones versionadas
# y ejecuta la prueba. Cualquier aserción fallida (excepción SQL) detiene la
# ejecución con error.
#
# Variables: PGHOST, PGPORT, PGUSER, PGPASSWORD (valores por defecto para CI).
# ============================================================================
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
export PGPASSWORD="${PGPASSWORD:-kourigo_ci}"

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE="kourigo_ci_$$"

PSQL="psql -v ON_ERROR_STOP=1 -h $PGHOST -p $PGPORT -U $PGUSER"
PSQL_Q="psql -v ON_ERROR_STOP=1 -h $PGHOST -p $PGPORT -U $PGUSER -q"

for PRUEBA in "$RAIZ"/database/tests/pruebas_*.sql; do
  echo "==> Preparando base limpia para $(basename "$PRUEBA")"
  dropdb --if-exists -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$BASE"
  createdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$BASE"
  for EMULACION in "$RAIZ"/database/ci/*.sql; do
    $PSQL_Q -d "$BASE" -f "$EMULACION"
  done
  for MIGRACION in "$RAIZ"/database/migrations/*.sql; do
    $PSQL_Q -d "$BASE" -f "$MIGRACION"
  done
  echo "==> Ejecutando $(basename "$PRUEBA")"
  $PSQL -d "$BASE" -f "$PRUEBA"
done

dropdb --if-exists -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$BASE" || true
echo "OK: todas las pruebas de base de datos pasaron."
