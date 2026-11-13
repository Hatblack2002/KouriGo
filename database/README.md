# Base de datos de KouriGo

Estructura:

- `migrations/` — migraciones SQL versionadas, aplicables tanto al proyecto real de Supabase como a un PostgreSQL 16 + PostGIS local/CI. El orden es lexicográfico por prefijo numérico. Los cambios de esquema nunca se hacen solo desde el dashboard sin migración reproducible (docs/architecture/backend-supabase.md sección 3).
- `ci/` — SOLO para CI y desarrollo local sin Supabase: emula la superficie mínima de Supabase Auth (esquema `auth`, `auth.uid()` y roles) y de Supabase Storage (esquema `storage`, `storage.foldername`). **No aplicar al proyecto real de Supabase.**
- `tests/` — pruebas SQL de autorización (RLS, transiciones, inmutabilidad del mayor) con casos positivos y negativos por rol, según README sección 17. Las referencias a PostGIS usan calificación explícita (`extensions.ST_*`, `::extensions.geography`) para no depender del `search_path` vigente al cambiar de rol durante las pruebas.

## Ejecución local

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=... bash database/tests/run.sh
```

En CI, el job `base-de-datos` de `.github/workflows/ci.yml` ejecuta el mismo script contra el service container `postgis/postgis:16-3.4`.

## Aplicación al proyecto real de Supabase (Etapa 1.5)

- `scripts/aplicar_migraciones.sh` aplica sobre `DATABASE_URL` las migraciones de `migrations/` que falten y las registra en `public.schema_migrations` (una fila por versión). Es idempotente: se puede reejecutar sin efecto.
- `scripts/verificar_supabase.sh` ejecuta contra el proyecto real: 1) `database/supabase/verificacion_esquema.sql` (solo lectura: PostGIS, tablas, RLS, funciones, triggers, CHECK de los 10 estados, políticas de pedidos) y 2) las mismas pruebas de `tests/` envueltas con `database/supabase/preparacion_pruebas.sql`. Las pruebas abren `BEGIN` y cierran con `ROLLBACK`, así que no dejan fixtures en el proyecto real.
- El workflow `.github/workflows/supabase.yml` ejecuta ambos runners desde GitHub Actions con el secreto `DATABASE_URL`: en cada push a `main` que toque `database/`, `scripts/` o el propio workflow, y a demanda (`workflow_dispatch`). La credencial quedó verificada el 2026-11-13 (run 43355644288: verificación de esquema/RLS y pruebas con rollback superadas).
- La conexión usa el pooler IPv4 de Supabase en session mode (el acceso directo es solo IPv6 y los runners de Actions no tienen IPv6). La emulación de `database/ci/` **no** se aplica al proyecto real. Ver `docs/decisions/ADR-0003-migraciones-supabase.md`.

## Estado de implementación

La migración `0001_esquema_inicial.sql` crea el esquema inicial (perfiles, roles, pedidos, asignaciones, eventos, incidencias, pagos, mayor, liquidaciones y auditoría) con RLS activado en todas las tablas, triggers de validación de transiciones y protección del estado de verificación de repartidores.

La migración `0002_verificacion_repartidores.sql` (Etapa 2, ADR-0004) añade el expediente de verificación: `courier_verification_cases` (flujo de revisión con transiciones validadas por trigger y espejo en `packages/domain/src/expediente.ts`), `courier_verification_documents` (metadatos con ruta privada), `courier_verification_events` (auditoría), el bucket privado `courier-identity-private` con sus políticas de `storage.objects` (carpeta propia por usuario; lectura administrativa solo para el rol admin) y la proyección de `verification_status` en `courier_profiles`.

Pendiente para próximas etapas (según docs/architecture/backend-supabase.md sección 5):

- Edge Functions para las operaciones privilegiadas (despacho, emisión de signed URLs de corta duración, aprobación de repartidores, pagos).
- Regla de habilitación de entregas motorizadas según `driver_license` (decisión del responsable del producto).
- Retención y eliminación segura de documentos antes de producción.
