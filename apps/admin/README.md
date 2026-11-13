# Consola administrativa web (`@kourigo/admin`)

Aplicación web de la Etapa 5 (README secciones 2.3, 12 y 14): consola separada,
con acceso restringido y protección REAL en el backend. Stack: Vite + React +
TypeScript, bundle estático sin servidor propio ni coste.

## Qué hace (nada decorativo)

- **Inicio de sesión real** contra Supabase Auth. NO hay registro público: las
  cuentas administrativas las crea o invita el administrador principal
  (Supabase Admin API / panel), según el README sección 12.
- **Comprobación de rol en el backend**: al abrir sesión se consulta
  `user_roles` bajo RLS; una sesión sin rol `admin` activo queda bloqueada en
  la consola y, aunque conociera las URLs, RLS le devuelve datos vacíos.
- **Resumen**: métricas reales de la tabla `orders` (pendientes, ofrecidos,
  aceptados, en tránsito, entregados, incidencias, cancelados y total).
- **Pedidos**: lista con filtro de estado, detalle con artículos, eventos,
  asignaciones; transiciones por la Edge Function `transicion-pedido`
  (las correcciones exclusivas del administrador exigen motivo, que queda en
  `audit_logs` con la acción `transicion_administrativa`); despacho por la
  Edge Function `despachar-pedido` (RPC atómico, migración 0004).
- **Repartidores**: expedientes de verificación con filtro, documentos del
  bucket privado vía URLs firmadas de `documento-firmado`, revisión documento
  a documento y decisiones por la Edge Function `decision-verificacion`
  (motivo y método según la matriz compartida de `@kourigo/domain`).
- **Auditoría**: últimas entradas reales de `audit_logs`, que solo el rol
  administrador puede leer por RLS.

## Desarrollo

```bash
npm ci
npm run build --workspace @kourigo/domain
VITE_SUPABASE_URL=https://<proyecto>.supabase.co \
VITE_SUPABASE_ANON_KEY=<clave anon> \
npm run dev --workspace @kourigo/admin
```

La clave anon es pública por diseño; el acceso a datos lo impone RLS. La
clave service-role NUNCA entra en la consola.

## Verificación en CI

Workflow `Consola administrativa (web)` (`.github/workflows/consola-admin.yml`):

1. Build real del bundle con `vite build` (con valores de marcador: la
   configuración pública real se exige al servir la consola).
2. Pruebas unitarias (vitest, sin red).
3. Prueba E2E contra el proyecto real de Supabase con usuarios creados por la
   Admin API: bloqueo de no administradores (RLS y escalada), revisión y
   aprobación del expediente por la función real, creación y confirmación de
   pedidos bajo RLS, despacho, aceptación, corrección administrativa con
   motivo y auditoría, URL firmada del documento privado, rechazos por rol y
   limpieza sin residuos.
