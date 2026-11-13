#!/usr/bin/env bash
# ============================================================================
# KouriGo — Etapa 1.5: aplicación de migraciones al proyecto real de Supabase.
#
# Requiere DATABASE_URL (secreto de GitHub Actions o variable de entorno
# local). Aplica sobre esa conexión las migraciones de database/migrations/
# que no estén registradas en public.schema_migrations y registra cada una.
# Idempotente: se puede reejecutar sin efecto.
#
# No aplica database/ci/0000_emulacion_supabase_auth.sql: la emulación de
# Supabase Auth es SOLO para CI local (ver database/README.md).
# ============================================================================
set -euo pipefail

: "${DATABASE_URL:?Define la variable DATABASE_URL (secreto de GitHub Actions)}"

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PSQL() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 "$@"; }

echo "== Preparando tabla de control de migraciones"
PSQL -qc "CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);"

for ARCHIVO in "$RAIZ"/database/migrations/*.sql; do
  VERSION="$(basename "$ARCHIVO" .sql)"
  APLICADA="$(PSQL -Atqc "SELECT count(*) FROM public.schema_migrations WHERE version = '$VERSION';")"
  if [ "$APLICADA" != "0" ]; then
    echo "== $VERSION ya aplicada, se omite"
    continue
  fi
  echo "== Aplicando migración $VERSION"
  {
    cat "$ARCHIVO"
    printf "\nINSERT INTO public.schema_migrations (version) VALUES ('%s');\n" "$VERSION"
  } | PSQL -q
done

TOTAL="$(PSQL -Atqc 'SELECT count(*) FROM public.schema_migrations;')"
echo "== OK: migraciones aplicadas. Registro total en schema_migrations: $TOTAL"
