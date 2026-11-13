# Edge Functions de KouriGo (Etapa 3)

Operaciones privilegiadas del servidor (docs/architecture/backend-supabase.md, sección "Edge Functions y servidor"). Código Deno sin dependencias externas: `fetch` + tipos locales, verificado con `deno check` y probado con `deno test` en GitHub Actions. Decisiones en `docs/decisions/ADR-0005-edge-functions.md`.

## Funciones

| Función | Entrada (POST) | Salida 200 | Privilegio |
|---|---|---|---|
| `transicion-pedido` | `{pedido_id, estado_destino}` | `{pedido_id, de, a, actor}` | Sesión real: cliente, repartidor aprobado con asignación o administrador |
| `despachar-pedido` | `{pedido_id, repartidor_id}` | `{pedido_id, repartidor_id, asignacion_id, estado}` | Solo administrador (RPC `despachar_pedido`, migración 0004, atómico) |
| `decision-verificacion` | `{caso_id, decision, motivo?, metodo?}` o `{caso_id, decision: "revision_documento", documento_id, estado_revision, notas?}` | `{caso_id, decision, de, a}` / `{documento_id, review_status}` | Solo administrador (RLS + trigger del expediente) |
| `documento-firmado` | `{documento_id}` | `{documento_id, url_firmada, expira_en_segundos}` | Solo administrador (firma con service_role, vigencia 300 s) |

Errores: JSON `{error}` con estado 4xx/5xx y mensaje en español. El actor y el rol se determinan SIEMPRE en el servidor a partir del JWT; nunca se aceptan desde el cliente.

## Claves y entorno

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (secretos del workflow o de la función). La clave service_role solo se usa para: invocar el RPC `despachar_pedido`, escribir en `audit_logs` (sin política de INSERT) y firmar documentos KYC. Todo lo demás se hace con el JWT del llamador para que RLS y triggers vean la identidad real.

## Estructura

- `_shared/config.ts`: entorno y `ErrorHttp`.
- `_shared/http.ts`: respuestas JSON, validación de cuerpo/UUID/cadenas.
- `_shared/auth.ts`: verificación del JWT y comprobación del rol de administrador.
- `_shared/rest.ts`: cliente PostgREST/Storage mínimo (sesión del llamador o service_role).
- `_shared/auditoria.ts`: registro en `audit_logs`.
- `_shared/dominio.ts`: espejo de las reglas de dominio (transiciones de pedidos y decisiones del expediente); mantener sincronizado con `packages/domain` y los triggers de `database/migrations/`.
- `_pruebas/unitarias.test.ts`: pruebas sin red ni secretos (job `edge-functions` del workflow `CI`).
- `_pruebas/integracion.test.ts`: flujo completo real contra el proyecto de Supabase (workflow "Supabase (proyecto real)"): usuarios reales por Admin API, sesiones reales, evidencia real en el bucket privado, expediente hasta aprobado, despacho atómico, aceptación del repartidor y rechazos por rol; limpieza final garantizada.

## Ejecución local en CI

```bash
deno check supabase/functions/
deno test --allow-all supabase/functions/_pruebas/unitarias.test.ts
deno test --allow-all supabase/functions/_pruebas/integracion.test.ts   # con secretos
```

## Despliegue

Las funciones se despliegan al runtime de Supabase desde el workflow `Supabase (proyecto real)` con `supabase functions deploy --yes --project-ref <ref>` y el secreto `SUPABASE_ACCESS_TOKEN` (token gratuito creado en el dashboard por el responsable del producto). Tras el despliegue, el workflow exige que cada endpoint responda 401 sin JWT. Primera verificación: run 43466047543 (commit 3045fa5); las 4 funciones responden 401 en `https://<ref>.supabase.co/functions/v1/<función>`. Ver ADR-0005 («Notas operativas del despliegue al runtime»).
