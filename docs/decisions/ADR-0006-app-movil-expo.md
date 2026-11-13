# ADR-0006: Aplicación móvil Expo (Etapa 4)

- **Estado:** Aceptado
- **Fecha:** 2026-11-14
- **Ámbito:** aplicación móvil del cliente en `apps/mobile`
- **Especificación:** README (secciones 2.1, 9, 10, 15-Fase 2 y 16); docs/product/plan-etapas.md (Etapa 4)

## Contexto

La Etapa 4 del plan exige «App móvil Expo: autenticación real y creación de pedidos conectada al backend real», verificada con «build y pruebas E2E». El producto no dispone de presupuesto (todo debe usar servicios gratuitos), el README sección 10 ya fijó React Native + Expo + TypeScript como cliente móvil, y las operaciones reales del backend ya existen desde las Etapas 1.5-3: Auth de Supabase, RLS sobre `orders`/`order_items`/`profiles`, y la Edge Function `transicion-pedido` desplegada al runtime (ADR-0005). El agente no instala dependencias ni herramientas en su entorno de trabajo: toda compilación, verificación y prueba se ejecuta en GitHub Actions.

## Decisión

1. **`apps/mobile` dentro del monorepo npm existente** (workspace `apps/*` ya declarado en la raíz). Expo **SDK 58** (última estable al 2026-11-14, React 19.3.0, React Native 0.88.1) con las versiones exactas que la plantilla oficial `expo-template-blank@sdk-58` recomienda; `@react-native-async-storage/async-storage ~2.2.0` (versión recomendada por la documentación del SDK 58) y `@supabase/supabase-js ^2.119.0`. El lockfile se regenera resolviendo el árbol con `npm install --package-lock-only` (solo produce el artefacto versionado del repositorio; NO instala paquetes: `npm ci` en CI es la instalación real y reproducible, ADR-0002).
2. **Autenticación real, sin simulaciones:** `supabase-js` con `persistSession` y adaptador de almacenamiento inyectable — `AsyncStorage` en el dispositivo (`almacen-async-storage.ts`) y almacenamiento en memoria en la prueba E2E en Node (`almacen-memoria.ts`). El adaptador de memoria solo sustituye el almacenamiento LOCAL de la sesión, nunca ninguna operación del backend: registro (`signUp`), inicio (`signInWithPassword`), cierre (`signOut`) y restauración (`getSession` + `onAuthStateChange`) son llamadas reales a Supabase Auth.
3. **Pedidos conectados al backend real:** la creación de pedidos es PostgREST bajo RLS (el cliente solo puede insertar su propio `draft` con artículos en `order_items`), las transiciones pasan SIEMPRE por la Edge Function real `transicion-pedido` (el actor lo determina el servidor; la app jamás envía su rol) y la validación local reutiliza `@kourigo/domain` + una capa con claves de mensaje localizables que replica los mismos límites impuestos por CHECK y trigger SQL. La app revalida con `validarCreacionPedido` antes de enviar: no envía datos que el backend rechazaría.
4. **Moneda y tarifa como parámetros sin valor por defecto:** son decisiones pendientes del fundador (README sección 22: moneda, tarifas, base del 40/60); el formulario las exige explícitamente y los importes se manejan como enteros en la unidad mínima de la moneda (README sección 11).
5. **Interfaz bilingüe kreyòl/français** (README sección 9 y criterio del MVP): diccionario completo en `src/i18n.ts` con las mismas claves en ambos idiomas; estados y tipos muestran etiquetas por idioma manteniendo los literales reales de la base de datos. Sin valores de negocio fijados en la interfaz.
6. **Navegación por estado sin librerías de enrutado:** el alcance de la etapa es un flujo completo verificable (inicio de sesión → lista → nuevo pedido → detalle con eventos → confirmar/cancelar), no un mapa de pantallas decorativo. expo-router/react-navigation se introducirán cuando el número de pantallas lo justifique, con su propio ADR.
7. **Build real sin coste en CI:** `expo export --platform android` (bundle Hermes compilado por Metro, sin emulador, sin EAS y sin cuota) en el workflow «App móvil (Expo)», que sube el bundle como artefacto de evidencia. Con valores `EXPO_PUBLIC_*` de marcador para la compilación: el bundle resultante prueba el build; la app exige la configuración pública real en el arranque y muestra un error claro si falta.
8. **Pruebas E2E contra el proyecto real** (patrón ADR-0005): `apps/mobile/tests/e2e/proyecto-real.test.ts` crea usuarios reales por la Admin API, inicia sesiones con el mismo servicio de la app, crea el pedido por PostgREST bajo RLS, confirma y cancela mediante la Edge Function desplegada, comprueba el aislamiento entre clientes (un cliente no ve el pedido ajeno ni sus artículos), los rechazos por transición inválida y sin sesión, el evento del trigger SQL, y el registro público real (`signUp` + confirmación por Admin API si el proyecto la exige). La limpieza final elimina pedidos y usuarios y la prueba FALLA si deja residuos. Sin secretos, la suite se omite sola (el job de CI normal no tiene secretos).
9. **Integración con el pipeline:** el job `calidad` de `CI` compila los paquetes internos antes del typecheck (la app importa los tipos de `@kourigo/domain` desde `dist/`), pasa a Node 22 (requisito del SDK 58) y ejecuta las unitarias de la app vía workspaces. El nuevo workflow «App móvil (Expo)» se dispara con `apps/**` y `packages/**`.

## Consecuencias

**Positivas**
- Flujo cliente completo y real de punta a punta, verificado en CI y contra el proyecto de Supabase, sin gasto: build por exportación de bundle y E2E en el plan gratuito de GitHub Actions + Supabase.
- Las reglas de negocio siguen teniendo tres imposiciones independientes y probadas: dominio TypeScript (unitarias), trigger SQL (pruebas SQL y E2E) y Edge Function (E2E contra el runtime).
- La app no contiene ninguna clave privilegiada: solo URL + clave anon (públicas por diseño), inyectadas como `EXPO_PUBLIC_*`.

**Riesgos y obligaciones**
- El formato exacto de Prettier sobre TSX se verifica en CI; cualquier desviación se corrige con commit de formato (mismo método que las etapas anteriores).
- El modo repartidor y las pantallas del expediente de verificación NO forman parte de esta etapa: llegarán con la operación del repartidor (README Fase 3) y reutilizarán estos servicios.
- El perfil del cliente se crea en el registro cuando la sesión es inmediata; para cuentas con confirmación de correo pendiente, el perfil se completa en la primera acción posterior al inicio de sesión (misma vía RLS `perfiles_insertar_propio`).
- Los binaries nativos (APK/IPA) para distribución siguen pendientes: se harán con EAS Build (cuota gratuita) o prebuild cuando la operación lo exija; hoy la evidencia de build es el bundle exportado.

## Alternativas consideradas

- **expo-router / react-navigation desde el inicio:** descartadas por el alcance mínimo de la etapa; añadirían dependencias y configuración que no se piden en la verificación.
- **Detox u otro E2E con emulador Android:** descartado por coste de tiempo y fragilidad en runners; el E2E real contra el proyecto cubre exactamente los criterios de la etapa (autenticación y creación de pedidos reales). Un E2E de UI se reevaluará cuando existan pantallas de repartidor.
- **EAS Build como evidencia de etapa:** requiere cuenta/expo-cli y consume cuota gratuita; la exportación de bundle Hermes demuestra la compilación real sin gasto y queda registrada como artefacto.
- **Generar la sesión de la E2E con credenciales fijas:** rechazado; los usuarios se crean y eliminan por run con credenciales únicas, igual que en la Etapa 3.
