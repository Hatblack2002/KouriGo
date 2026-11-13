# ADR-0005: Edge Functions para operaciones privilegiadas (Etapa 3)

- **Estado:** Aceptado
- **Fecha:** 2026-11-13
- **Ámbito:** Edge Functions: despacho, aprobaciones, transiciones y auditoría (Etapa 3)
- **Especificación:** docs/architecture/backend-supabase.md (sección "Edge Functions y servidor"); docs/product/plan-etapas.md (Etapa 3)

## Contexto

La Etapa 3 exige operaciones privilegiadas de servidor: despacho de pedidos, aprobaciones del expediente, transiciones de estado con el actor determinado en el servidor y auditoría. La clave service-role solo puede existir en el entorno servidor (backend-supabase.md sección 39). Las Edge Functions de Supabase están incluidas en el plan gratuito del proyecto; no requieren pago. El plan define la verificación de la etapa como pruebas de integración en CI.

## Decisión

1. **Cuatro funciones en `supabase/functions/` (Deno, sin dependencias externas):**
   - `transicion-pedido`: transición de estado con el actor resuelto SIEMPRE en el servidor (JWT verificado contra `/auth/v1/user`; rol administrador leído de `user_roles` con el JWT del llamador, cliente propietario o repartidor aprobado con asignación). La matriz local (`_shared/dominio.ts`) valida el par antes de tocar el backend y el trigger `validar_transicion_pedido` vuelve a imponerla con la sesión real.
   - `despachar-pedido`: solo administrador. La operación atómica vive en el RPC `public.despachar_pedido` (migración 0004, SECURITY DEFINER, EXECUTE revocado a PUBLIC/anon/authenticated y concedido solo a service_role): crea la asignación, mueve el pedido a `offered`, escribe el evento `despacho_administrativo` con el administrador real como actor y registra en `audit_logs` en una única transacción.
   - `decision-verificacion`: solo administrador. Aplica decisiones del expediente (iniciar_revision, pedir_informacion, programar_verificacion, aprobar, rechazar, suspender, solicitar_reverificacion, expirar) y la revisión de documentos. Las mutaciones se aplican con el JWT del propio administrador, de modo que RLS y el trigger `validar_transicion_expediente` (migraciones 0002 y 0003: pares, motivo fresco, método) imponen las reglas y los eventos quedan con `auth.uid()` real.
   - `documento-firmado`: solo administrador. Emite signed URLs de corta duración (300 s) para los documentos KYC del bucket `courier-identity-private` (obligación dejada por ADR-0004), tras comprobar bucket y convención de carpeta por usuario; cada emisión se audita.
2. **service_role solo para lo verdaderamente privilegiado:** invocar el RPC de despacho, escribir en `audit_logs` (sin política de INSERT) y firmar documentos. Todo lo demás usa el JWT del llamador para que RLS y triggers vean la identidad real. El JWT se verifica contra el servicio Auth y el rol contra `user_roles`; nunca se acepta un rol enviado por el cliente (README sección 12, regla 15).
3. **Patrón de pruebas sin dependencias:** cada función exporta `procesar(req)` y solo monta `Deno.serve` cuando `import.meta.main`. Las pruebas unitarias (`_pruebas/unitarias.test.ts`) ejecutan `procesar` directamente con `Request` construidos, sin secretos; las aserciones viven en `_pruebas/afirmar.ts` para resolver sin red.
4. **Pruebas de integración reales (`_pruebas/integracion.test.ts`), en el workflow `Supabase (proyecto real)`:** crean usuarios reales por la Admin API con credenciales únicas, inician sesiones por password grant, suben una evidencia real al bucket privado, presentan el expediente por la vía del candidato, recorren revisión→aprobación→despacho→aceptación invocando los mismos manejadores `procesar`, comprueban efectos en `orders`, `order_assignments`, `courier_profiles`, `order_events` y `audit_logs`, y rechazan los accesos indebidos. La limpieza final elimina usuarios, filas y objetos; la prueba falla si deja residuos. Sin secretos, la prueba se omite (el job de CI normal no tiene secretos).
5. **Workflow:** `CI` añade el job `edge-functions` (Deno: `deno check` + unitarias); `Supabase (proyecto real)` añade Deno, la verificación de tipos y las pruebas de integración, y ahora se dispara con `supabase/**`.
6. **Convención de estilo:** el código Deno no pasa por ESLint/Prettier del monorepo npm (ignorado en `eslint.config.mjs` y en `.prettierignore`, por tratarse de un runtime distinto); su calidad la fijan `deno check` y `deno test` en su propio job, igual que `database/**` se valida con sus pruebas SQL.

## Consecuencias

**Positivas**
- Operaciones privilegiadas reales, atómicas y auditables: el despacho solo puede ocurrir a través de la Edge Function (REVOKE del RPC), y toda decisión y firma queda en `audit_logs`.
- El actor y el rol se determinan en el servidor; el cliente nunca envía su rol.
- Cobertura positiva y negativa por rol, ejecutada contra el proyecto real de Supabase en cada push que toque `database/**`, `scripts/**` o `supabase/**`.

**Riesgos y obligaciones**
- **Despliegue al runtime de Supabase:** completado el 2026-11-13 con el `SUPABASE_ACCESS_TOKEN` (gratuito, creado por el responsable del producto en el dashboard) configurado como secreto; el workflow despliega con `supabase functions deploy --yes` y exige 401 sin JWT de cada endpoint (run 43466047543, commit 3045fa5). Detalles en «Notas operativas del despliegue al runtime».
- El espejo `_shared/dominio.ts` debe mantenerse sincronizado con `packages/domain` y los triggers; las tres suites de pruebas (vitest, Deno y SQL) cierran la consistencia.
- La firma de documentos tiene vigencia de 300 s y se audita; la retención y eliminación segura de documentos sigue pendiente antes de producción (ADR-0004).

## Alternativas consideradas

- **Despacho en dos llamadas REST desde la función (insertar asignación y luego actualizar el pedido):** rechazada; una falla parcial dejaría un pedido `offered` sin asignación o una asignación huérfana. El RPC SECURITY DEFINER hace todo atómico.
- **Dejar el RPC ejecutable por authenticated y que la función solo valide payload:** rechazada; el despacho sería invocable por PostgREST sin pasar por la función, debilitando el punto único de auditoría.
- **Usar supabase-js u otras dependencias en las funciones:** rechazada por ahora; con `fetch` y tipos locales la verificación de tipos y las pruebas se resuelven sin red y sin riesgo de versiones.

## Notas operativas de la primera ejecución (2026-11-13)

1. **El secreto `SUPABASE_URL` tenía el ref transpuesto** (`ouowxtptnqptsajqgjud` en lugar de `ouowxtpntqptsajqgjud`): hostname inexistente → NXDOMAIN en los runners, DoH sin respuesta y 400 del edge de Cloudflare al fijar una IP. El ref correcto se tomó del claim `ref` del JWT del proyecto y el secreto se repuso; el pooler IPv4 de ADR-0003 nunca se vio afectado porque su hostname no depende del ref.
2. **Regla del header `apikey`:** PostgREST y Storage exigen SIEMPRE una clave de proyecto (anon o service_role); el JWT del llamador va solo en `Authorization: Bearer`. Usar el JWT como apikey produce "Invalid API key" — corregido en `_shared/rest.ts` y detectado por la prueba de integración real.
3. **Resolución DNS en runners:** el paso del workflow comprueba el host con `getent`; solo si no resuelve prueba cuatro resolutores DoH y, como último recurso, fija una IP anycast conocida de Cloudflare en `/etc/hosts` EXIGIENDO un 200 real de `/auth/v1/health` (sin verdes falsos). Con el hostname correcto, los runners resuelven de forma nativa.

## Notas operativas del despliegue al runtime (2026-11-13)

4. **El secreto `SUPABASE_URL` se volvió a corromper al reponer los secretos desde una copia local desactualizada** (ref transpuesto `ouowxtptnqptsajqgjud`): el paso de DNS falló con host inexistente, DoH sin respuesta y la IP de respaldo con health 400 (run 43464024629). Corregido reponiendo el secreto con el ref correcto, tomado del claim `ref` de las claves del proyecto; el DNS nativo volvió a resolver (run 43464548433). Lección: al reponer secretos, validar el ref contra el claim `ref` del JWT del proyecto antes de escribir el secreto.
5. **La CLI de Supabase exige confirmación en modo no interactivo:** `supabase functions deploy` en CI requiere `--yes` («Confirmation required… Re-run with --yes to confirm», run 43464548433); añadido al paso y verificado.
6. **Despliegue verificado:** run 43466047543 (commit 3045fa5) desplegó las 4 funciones y verificó 401 sin JWT en cada endpoint del runtime; una prueba de humo independiente contra `https://<ref>.supabase.co/functions/v1/<función>` devolvió 401 con `{"code":"UNAUTHORIZED_NO_AUTH_HEADER"}` en las 4.
