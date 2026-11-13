# Plan de ejecución por etapas

**Fecha:** 2026-11-13
**Autorización registrada:** el responsable del producto aprobó en sesión (2026-11-13): alcance completo de la Etapa 1, monorepo con npm, commits y documentación en español, integración directa en `main`, crear/conectar el proyecto Supabase con credenciales guardadas como secretos de GitHub Actions, y usar GitHub Actions como mecanismo de compilación y verificación.

| Etapa | Contenido | Verificación | Estado |
|---|---|---|---|
| 1 | Base técnica: monorepo TypeScript, `packages/domain` (estados, transiciones por rol, comisión, validaciones), migración inicial con RLS y triggers, pipeline CI completo (formato, lint, tipos, pruebas unitarias, PostgreSQL+PostGIS, build, secretos) | Workflow `CI` verde en GitHub Actions (run 43347150143, commit 70cc89b: los cuatro jobs en verde) | **Completada** |
| 1.5 | Conexión del proyecto Supabase real: aplicar migraciones, verificar RLS contra el proyecto, revisar variables de entorno | Job `Supabase (proyecto real)` aplicando migraciones con `DATABASE_URL` (secreto) y ejecutando `scripts/verificar_supabase.sh` | **Completada** (2026-11-13): contraseña de base de datos verificada por SCRAM-SHA-256 con firma del servidor; secretos `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` configurados en el repositorio; run 43355644288 aplicó las migraciones y superó la verificación de esquema/RLS y las pruebas contra el proyecto real (idempotencia confirmada); disparo por push a `main` habilitado con filtro de rutas (ADR-0003) |
| 2 | Verificación de repartidores: tablas de expediente, buckets privados de Storage y políticas, flujo de revisión | Pruebas de acceso permitido/denegado en CI | **Completada** (2026-11-13): migraciones 0002 y 0003 con expediente (`courier_verification_cases/documents/events`), bucket privado `courier-identity-private`, políticas de Storage por carpeta de usuario y flujo de revisión validado por trigger con espejo en `packages/domain` (ADR-0004); pruebas de permitido/denegado por rol en el job `Base de datos` (CI verde en commit 2adc061) y contra el proyecto real de Supabase (workflow `Supabase (proyecto real)` verde en commit c6de54d) |
| 3 | Edge Functions: operaciones privilegiadas (despacho, aprobaciones, transiciones, auditoría) | Pruebas de integración en CI | En curso (2026-11-13): funciones `transicion-pedido`, `despachar-pedido`, `decision-verificacion` y `documento-firmado` con RPC atómico de despacho solo para service_role (migración 0004) y pruebas reales contra el proyecto (ADR-0005); pendiente registrar runs verdes |
| 4 | App móvil Expo: autenticación real y creación de pedidos conectada al backend real | Build y pruebas E2E | Pendiente |
| 5 | Consola administrativa web | Build y pruebas | Pendiente |
| 6 | Pagos reales (MonCash/NatCash) y notificaciones push | Integración con credenciales oficiales del proveedor | Pendiente |

Notas de cumplimiento (README sección 23):

- Ninguna etapa se declara terminada sin ejecución verificable en GitHub Actions.
- La emulación de Supabase Auth usada en CI vive en `database/ci/` y NO se aplica al proyecto real de Supabase.
- Decisiones aún pendientes del fundador (README sección 22): moneda, tarifas, zona del piloto, base exacta del reparto 40/60, método de liquidación, entre otras. El código las mantiene como parámetros o sin valores por defecto, nunca como reglas fijadas.
- Mientras no exista integración real con proveedores de pago, la plataforma no presentará pagos simulados como reales (README sección 6).
