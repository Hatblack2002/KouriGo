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

## Idiomas de la interfaz (README sección 9)

Toda la interfaz sale del diccionario `src/idiomas.tsx` con las mismas claves
en **kreyòl ayisyen** (idioma prioritario), **français** (segundo idioma) y
**español** (idioma adicional admitido por la sección 9). La terminología de
kreyòl/français coincide con la app móvil (`apps/mobile/src/i18n.ts`,
ADR-0006). Un selector en la barra y en el login cambia el idioma; la
elección se guarda en `localStorage` y el kreyòl es el idioma por defecto.
Las fechas usan formato localizado (`fr-HT` para kreyòl/français, `es-ES`
para español) y el código de moneda SIEMPRE viene de la fila del pedido.
Los literales reales de la base de datos (estados, tipos de documento) se
mantienen como respaldo si aún no tienen etiqueta. La prueba
`tests/idiomas.test.ts` garantiza en CI la paridad de claves entre los tres
idiomas y la terminología compartida con la app móvil.

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

## Acceso en vivo (GitHub Pages)

Workflow `Despliegue consola (Pages)`
(`.github/workflows/consola-admin-pages.yml`): compila el bundle con la
configuración pública real (URL y clave anon, públicas por diseño) y lo
publica en GitHub Pages, el alojamiento estático gratuito de GitHub, en cada
cambio de `main`. La consola queda navegable en:

- **URL**: <https://hatblack2002.github.io/KouriGo/>

No hay servidor propio ni coste: Pages solo sirve archivos estáticos; toda la
lógica con privilegios vive en el backend (RLS + Edge Functions, ADR-0001 y
ADR-0005).

### Aprovisionar la primera cuenta administradora

NO hay registro público (README sección 12). La primera cuenta se crea desde
el panel de Supabase (Supabase Dashboard → proyecto KouriGo):

1. **Authentication → Users → Add user**: crear el usuario con correo y
   contraseña, con **Auto Confirm User** activado, y copiar su ID (UUID).
2. **Table Editor → `user_roles` → Insert row**: `user_id` = UUID copiado,
   `role` = `admin`, `status` = `active`.
3. Entrar a la URL de la consola con ese correo y contraseña.

El permiso se comprueba SIEMPRE en el backend: una sesión válida sin rol
`admin` activo queda bloqueada en la consola y, aun conociendo las URLs, RLS
le devuelve listas vacías y niega las operaciones privilegiadas. Las cuentas
administradoras adicionales se crean igual (panel de Supabase) hasta que la
consola incluya gestión de usuarios.
