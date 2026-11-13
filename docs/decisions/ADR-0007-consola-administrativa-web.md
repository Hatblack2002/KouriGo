# ADR-0007: Consola administrativa web (Etapa 5)

- **Estado:** Aceptado
- **Fecha:** 2026-11-14
- **Ámbito:** consola administrativa en `apps/admin` y extensión de motivo en `transicion-pedido`
- **Especificación:** README (secciones 2.3, 4, 10, 12, 14 y 21 criterio 568); docs/product/plan-etapas.md (Etapa 5)

## Contexto

La Etapa 5 del plan exige la «Consola administrativa web», verificada con «build y pruebas». El README fija la forma: «aplicación separada, preferiblemente web, con acceso restringido» (sección 2.3), con TypeScript y diseño adaptable (sección 10), sin registro público de administradores y con la protección en el backend y la base de datos, no solo en la navegación (sección 12). El proyecto no dispone de presupuesto (servicios gratuitos únicamente), el backend real ya tiene las piezas privilegiadas de las Etapas 1.5-3 (Auth, RLS de administración sobre `orders`/`profiles`/`user_roles`/`courier_*`, `audit_logs` de solo-lectura-admin, y las Edge Functions `transicion-pedido`, `despachar-pedido`, `decision-verificacion`, `documento-firmado` desplegadas al runtime — ADR-0005), y la capa de aplicación comparte `@kourigo/domain` (ADR-0002/0006). El agente no instala dependencias en su entorno: toda compilación, verificación y prueba se ejecuta en GitHub Actions.

## Decisión

1. **`apps/admin` dentro del monorepo npm existente** (workspace `apps/*` ya declarado; el README sección 11 ya reservaba `apps/admin`). Stack **Vite + React 19 + TypeScript**, con las mismas versiones de `typescript` (5.7.x), `vitest` (3.2.x) y `@supabase/supabase-js` (2.119.x) que el resto del monorepo. El lockfile se regenera con `npm install --package-lock-only` (solo el artefacto versionado del repositorio; la instalación real y reproducible es `npm ci` en CI, ADR-0002).
2. **Sin registro público y con bloqueo real de no administradores:** la consola solo inicia sesión (`signInWithPassword`) con cuentas aprovisionadas por la administración principal (Admin API/panel, README 12.3). Tras cada sesión (restaurada o nueva) se comprueba el rol en el BACKEND: fila activa `admin` en `user_roles` visible bajo RLS (`leerRolAdministrador`). Una sesión sin permiso ve la pantalla «Acceso denegado» y, aunque conociera las URLs, RLS le devuelve listas vacías y las funciones le responden 403 (criterio README 568, probado en la E2E).
3. **Solo secciones que el backend soporta HOY, ninguna decorativa** (README 14): Resumen (métricas reales de `orders`), Pedidos (lista con filtro, detalle con artículos/eventos/asignaciones, transiciones y despacho), Repartidores (expedientes con documentos y decisiones) y Auditoría (`audit_logs`). El mapa operativo, finanzas/pagos (Etapa 6), zonas y tarifas (decisiones pendientes del fundador, README 22) y la gestión de administradores quedan FUERA hasta que exista backend real que las sostenga; no se simulan pantallas ni botones muertos.
4. **Operaciones privilegiadas SIEMPRE por las Edge Functions del runtime** (ADR-0005): transiciones por `transicion-pedido`, despacho por `despachar-pedido`, decisiones del expediente por `decision-verificacion` y documentos por `documento-firmado`. La consola nunca envía su rol ni contiene la clave service-role: solo URL + clave anon (públicas por diseño). La lógica de UI reutiliza `@kourigo/domain` (matrices de transiciones y decisiones), la misma que imponen el trigger SQL y las funciones.
5. **Correcciones administrativas con motivo (README 4 y 12):** los pares de estados exclusivos del rol administrador (`esCorreccionAdministrativa` en `_shared/dominio.ts`, espejo de `packages/domain`) exigen un motivo de hasta 500 caracteres; `transicion-pedido` se extiende para rechazar la corrección sin motivo (422) y registrarla en `audit_logs` con la acción `transicion_administrativa` y los metadatos `{motivo, de, a}` (helper `registrarAuditoria` existente, service_role interno, sin datos personales). Las pruebas unitarias Deno cubren la clasificación de pares y la E2E verifica el rechazo y el registro.
6. **Build real sin coste en CI:** `vite build` (bundle estático con `base: "./"`, servible desde cualquier alojamiento) en el workflow «Consola administrativa (web)», que sube el bundle como artefacto de evidencia, con valores `VITE_*` de marcador para compilar: la consola exige la configuración pública real al abrirse y muestra un error claro si falta (patrón ADR-0006). No hay servidor propio, hosting de pago ni cuota que consumir.
7. **Prueba E2E contra el proyecto real** (patrón ADR-0005/0006): `apps/admin/tests/e2e/proyecto-real.test.ts` conduce los MÓDULOS reales de la consola (`auth`, `api/pedidos`, `api/expediente`, `api/auditoria`, `api/perfiles`, `funciones`) contra usuarios reales creados por la Admin API y las Edge Functions desplegadas: bloqueo y escalada de privilegios rechazada por RLS, auditoría vacía para un no administrador, revisión y aprobación del expediente real (incluido el rechazo de aprobar sin motivo), revisión de documento, pedido creado por su cliente bajo RLS y confirmado por la función, despacho y aceptación reales, corrección con motivo y su registro de auditoría, URL firmada del documento del bucket privado usada para descargarlo, rechazos 403 por rol y limpieza final sin residuos (la prueba FALLA si deja alguno).
8. **Pruebas unitarias sin red** (vitest, environment `node`): configuración pública (ausencia y normalización), formato de importes y fechas, interpretación de respuestas de funciones, agrupación de métricas, y las funciones puras `transicionesAdminDisponibles`/`decisionesAdminDisponibles`, que deben coincidir exactamente con las matrices de `@kourigo/domain` (la misma imposición triple de siempre: dominio, trigger SQL y función).

## Consecuencias

**Positivas**
- La operación diaria privilegiada del MVP queda cubierta y real: revisar repartidores, despachar, corregir estados con motivo y auditar, contra el proyecto de Supabase y sin gasto.
- La regla «permiso, motivo y registro de auditoría» del README sección 12 pasa a estar impuesta y probada en el servidor para las transiciones administrativas.
- Tres imposiciones independientes y probadas de cada regla: dominio TypeScript (unitarias), trigger SQL (pruebas SQL y E2E) y Edge Function (E2E contra el runtime), ahora también desde la consola.
- La consola no contiene ninguna clave privilegiada y puede servirse desde cualquier alojamiento estático cuando la operación lo decida.

**Riesgos y obligaciones**
- El formato exacto de Prettier sobre TSX se verifica en CI; cualquier desviación se corrige con el workflow de formato (mismo método que las etapas anteriores).
- El acceso de la consola exige que las cuentas admin existan previamente: aprovisionarlas es responsabilidad del fundador (Admin API/panel); el flujo de invitación con UI propia llega cuando el proyecto lo defina (README 14.9).
- El proveedor de identidad administrativa («Microsoft Sign-In», README 12.3) sigue pendiente de decisión del fundador; la sesión de la consola usa Supabase Auth real y funciona sin cambios cuando se habilite otro proveedor.
- Las secciones no implementadas (mapa, finanzas, zonas, gestión de administradores) quedan documentadas como alcance futuro con su backend correspondiente, no como deudas silenciosas.

## Alternativas consideradas

- **Next.js/SSR para la consola:** descartado: exigiría servidor (coste u ocupación de recursos) para un beneficio nulo; el backend ya es Supabase (ADR-0001) y el bundle estático cumple el README (sección 10 «aplicación web con TypeScript y diseño adaptable»).
- **Una sola app con vistas por rol (como la móvil):** descartado: el README sección 2.3 pide expresamente una aplicación separada, preferiblemente web, para la administración.
- **Reutilizar los componentes de `apps/mobile`:** descartado: React Native ≠ DOM; solo se comparte `@kourigo/domain` (y sería incorrecto compartir la capa de datos por el adaptador de almacenamiento distinto).
- **Extender `transicion-pedido` con RPC propio en la base:** descartado: el motivo administrativo es auditoría de la operación, no transacción atómica; el helper `registrarAuditoria` existente cubre el requisito con el patrón ya probado de la Etapa 3.
