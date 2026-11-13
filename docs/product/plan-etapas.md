# Plan de ejecución por etapas

**Fecha:** 2026-11-13
**Autorización registrada:** el responsable del producto aprobó en sesión (2026-11-13): alcance completo de la Etapa 1, monorepo con npm, commits y documentación en español, integración directa en `main`, crear/conectar el proyecto Supabase con credenciales guardadas como secretos de GitHub Actions, y usar GitHub Actions como mecanismo de compilación y verificación.

| Etapa | Contenido | Verificación | Estado |
|---|---|---|---|
| 1 | Base técnica: monorepo TypeScript, `packages/domain` (estados, transiciones por rol, comisión, validaciones), migración inicial con RLS y triggers, pipeline CI completo (formato, lint, tipos, pruebas unitarias, PostgreSQL+PostGIS, build, secretos) | Workflow `CI` verde en GitHub Actions | En ejecución |
| 1.5 | Conexión del proyecto Supabase real: aplicar migraciones, verificar RLS contra el proyecto, revisar variables de entorno | Job de CI aplicando migraciones con `DATABASE_URL` (secreto) | Pendiente de credencial de base de datos |
| 2 | Verificación de repartidores: tablas de expediente, buckets privados de Storage y políticas, flujo de revisión | Pruebas de acceso permitido/denegado en CI | Pendiente |
| 3 | Edge Functions: operaciones privilegiadas (despacho, aprobaciones, transiciones, auditoría) | Pruebas de integración en CI | Pendiente |
| 4 | App móvil Expo: autenticación real y creación de pedidos conectada al backend real | Build y pruebas E2E | Pendiente |
| 5 | Consola administrativa web | Build y pruebas | Pendiente |
| 6 | Pagos reales (MonCash/NatCash) y notificaciones push | Integración con credenciales oficiales del proveedor | Pendiente |

Notas de cumplimiento (README sección 23):

- Ninguna etapa se declara terminada sin ejecución verificable en GitHub Actions.
- La emulación de Supabase Auth usada en CI vive en `database/ci/` y NO se aplica al proyecto real de Supabase.
- Decisiones aún pendientes del fundador (README sección 22): moneda, tarifas, zona del piloto, base exacta del reparto 40/60, método de liquidación, entre otras. El código las mantiene como parámetros o sin valores por defecto, nunca como reglas fijadas.
- Mientras no exista integración real con proveedores de pago, la plataforma no presentará pagos simulados como reales (README sección 6).
