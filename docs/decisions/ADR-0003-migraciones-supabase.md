# ADR-0003: Aplicación de migraciones al proyecto real de Supabase desde CI

- **Estado:** Aceptado
- **Fecha:** 2026-11-13
- **Ámbito:** operación de base de datos (Etapa 1.5)

## Contexto

La Etapa 1.5 exige aplicar las migraciones versionadas al proyecto real de Supabase y verificar el esquema/RLS contra él, mediante un job de GitHub Actions que use `DATABASE_URL` como secreto (docs/product/plan-etapas.md). Restricciones observadas en la sesión del 2026-11-13:

- La conexión directa (`db.<proyecto>.supabase.co:5432`) resuelve **solo IPv6**; los runners de GitHub Actions (y el entorno de trabajo) solo tienen IPv4.
- El pooler IPv4 de Supavisor (`aws-0-us-east-1.pooler.supabase.com:5432`, session mode, usuario `postgres.<proyecto>`) está disponible; la región `us-east-1` quedó confirmada por diagnóstico del protocolo.
- Esa instancia del pooler **no negocia TLS de cliente** en los puertos 5432/6543: responde al `SSLRequest` de PostgreSQL con un error 08P01 y no acepta handshake TLS implícito. La autenticación SCRAM-SHA-256 (la que usa el pooler) no transmite la contraseña ni sus derivados: la credencial queda protegida, aunque el resto de la sesión viaja sin cifrar.

## Decisión

1. Las migraciones se aplican desde CI con **psql** sobre `DATABASE_URL` (secreto del repositorio), apuntando al **pooler session mode IPv4** (`aws-0-us-east-1.pooler.supabase.com:5432`).
2. El runner `scripts/aplicar_migraciones.sh` mantiene una **tabla de control** `public.schema_migrations(version, applied_at)`: aplica solo las migraciones no registradas y registra cada versión al finalizar. Es idempotente y reejecutable.
3. El runner `scripts/verificar_supabase.sh` verifica contra el proyecto real, sin emulación de Auth:
   - `database/supabase/verificacion_esquema.sql`: aserciones de solo lectura (PostGIS, tablas, RLS, funciones, triggers, CHECK de los 10 estados, políticas clave de `orders`, `auth.uid()`, grants a `authenticated`, registro de migraciones).
   - Las pruebas de `database/tests/` (que ya abren `BEGIN` y cierran con `ROLLBACK`), precedidas por `database/supabase/preparacion_pruebas.sql`, que crea la función de aserción `public.afirmar()`. El runner la elimina al terminar: **no se dejan fixtures ni objetos de prueba en el proyecto real**.
4. El workflow `.github/workflows/supabase.yml` ejecuta ambos runners con el secreto `DATABASE_URL`, en modo **manual (`workflow_dispatch`)** hasta que la credencial esté verificada. Verificada la credencial el 2026-11-13 (SCRAM-SHA-256, firma del servidor comprobada), se habilitó también el disparo por push a `main`, con filtro de rutas (`database/**`, `scripts/**` y el propio workflow) para no reejecutar en commits de documentación.
5. La `DATABASE_URL` se construye con `sslmode=disable` (el pooler rechaza la negociación SSL observada) y el usuario `postgres.<proyecto>`. La credencial no viaja en claro (SCRAM).

## Consecuencias

**Positivas**
- El proyecto real de Supabase pasa a verificarse por CI: migraciones idempotentes + aserciones de esquema + pruebas de autorización con rollback.
- Ningún valor de credencial entra al repositorio (regla README sección 12.12); solo existe como secreto de GitHub Actions.

**Riesgos y obligaciones**
- La sesión contra el pooler va sin cifrado TLS mientras la instancia no negocie SSL: contenido de consultas observable en tránsito. La credencial no lo está (SCRAM). Revisar en cuanto Supabase ofrezca TLS en el pooler y pasar a `sslmode=require`.
- Si una migración pierde idempotencia, un reejecutado tras fallo parcial podría chocar: mantener el estilo `IF NOT EXISTS` / `IF EXISTS` de la migración 0001.
- El primer run real puede exigir ajustes (permisos de `postgres` sobre `auth.users` para fixtures): los errores quedarán visibles en el log del job.

## Verificación inicial contra el proyecto real (2026-11-13)

- La contraseña de la base de datos se verificó con un cliente SCRAM-SHA-256 propio (stdlib, sin instalar dependencias) contra el pooler session mode: la firma `v=` del servidor confirmó la credencial antes de configurar el secreto.
- Secretos configurados en el repositorio: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Run 43355248676 (primer run real): migraciones aplicadas con éxito; la verificación falló porque exigía las funciones auxiliares con firma vacía (`es_participante_pedido()`), y la migración la define con argumento (`es_participante_pedido(id_pedido uuid)`). Corregido en commit 5bbd74a usando `to_regproc` (búsqueda por nombre).
- Run 43355644288 (verificación completa): todas las aserciones pasaron — PostGIS, 15 tablas, RLS habilitado, funciones auxiliares, triggers de integridad, CHECK de los 10 estados, políticas clave de `orders`, `auth.uid()`, grants a `authenticated` y `schema_migrations` con 1 migración; además corrieron las pruebas de RLS (cliente y repartidor) y de transiciones contra el proyecto real con `ROLLBACK`.
- La reejecución confirmó la idempotencia: la migración ya registrada se omite («0001_esquema_inicial ya aplicada, se omite»).

## Alternativas consideradas

- **Supabase CLI / Docker:** exige instalar herramientas y contenedores fuera de GitHub Actions; contradice la regla de no instalar dependencias en el entorno de trabajo.
- **Management API de Supabase:** requiere un access token personal adicional que no existe en el proyecto.
- **Aplicar migraciones desde el SQL Editor del dashboard:** manual, no reproducible ni auditable; contradice README sección 11 («migraciones versionadas») y sección 23 (verificación por CI).
- **Conexión directa IPv6:** imposible desde los runners de GitHub Actions.
