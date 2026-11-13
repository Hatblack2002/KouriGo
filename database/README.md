# Base de datos de KouriGo

Estructura:

- `migrations/` — migraciones SQL versionadas, aplicables tanto al proyecto real de Supabase como a un PostgreSQL 16 + PostGIS local/CI. El orden es lexicográfico por prefijo numérico. Los cambios de esquema nunca se hacen solo desde el dashboard sin migración reproducible (docs/architecture/backend-supabase.md sección 3).
- `ci/` — SOLO para CI y desarrollo local sin Supabase: emula la superficie mínima de Supabase Auth (esquema `auth`, `auth.uid()` y roles). **No aplicar al proyecto real de Supabase.**
- `tests/` — pruebas SQL de autorización (RLS, transiciones, inmutabilidad del mayor) con casos positivos y negativos por rol, según README sección 17.

## Ejecución local

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=... bash database/tests/run.sh
```

En CI, el job `base-de-datos` de `.github/workflows/ci.yml` ejecuta el mismo script contra el service container `postgis/postgis:16-3.4`.

## Estado de implementación

La migración `0001_esquema_inicial.sql` crea el esquema inicial (perfiles, roles, pedidos, asignaciones, eventos, incidencias, pagos, mayor, liquidaciones y auditoría) con RLS activado en todas las tablas, triggers de validación de transiciones y protección del estado de verificación de repartidores.

Pendiente para próximas etapas (según docs/architecture/backend-supabase.md sección 5 y docs/operations/courier-identity-verification.md sección 6):

- Tablas de verificación de repartidores (`courier_verification_cases`, `courier_verification_documents`, `courier_verification_events`) junto con los buckets privados de Supabase Storage y sus políticas.
- Edge Functions para las operaciones privilegiadas (despacho, aprobación de repartidores, pagos).
- Políticas de Storage y pruebas de acceso a documentos.
