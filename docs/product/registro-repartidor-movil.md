# Registro de repartidor en la app móvil — auditoría y plan (pendiente de autorización)

Fecha: 2026-11-15 · Commit auditado: `4b050aa` · Autoría: agente KouriGo
Estado: **PROPUESTA** — no se implementa hasta que el fundador dé luz verde (regla 8).

## 1. Qué ya existe (auditado en el código, nada simulado)

El backend de verificación de repartidores está **completo** (ADR-0004, Etapa 5):

| Pieza | Ubicación | Estado |
|---|---|---|
| Perfil de repartidor (`courier_profiles`) | `database/migrations/0001` | Listo: `verification_status` con 10 estados (`draft`, `submitted`, `under_review`, `needs_information`, `verification_scheduled`, `approved`, `rejected`, `suspended`, `expired`, `reverification_required`), `work_zone`, `vehicle_plate` |
| Expediente (`courier_verification_cases`) | `database/migrations/0002` | Listo: ciclo de vida completo con fechas (`submitted_at`, `review_started_at`, `decision_at`), `decision_by`, `decision_reason`, método (`documental`, `videoconferencia`, `presencial`) |
| Documentos (`courier_verification_documents`) | `database/migrations/0002` | Listo: 6 tipos (`national_id_front`, `national_id_back`, `passport`, `selfie`, `certificate_good_conduct`, `driver_license`), revisión por documento (`pending`/`accepted`/`rejected` + notas) |
| Bucket privado de identidad | `0002` (líneas 430–470) | Listo: `courier-identity-private`, cada repartidor solo escribe/lee en la carpeta con su `user_id`; la administración solo lee (no manipula evidencia) |
| RLS del repartidor | `0002` | Listo: crear su expediente borrador, cargar sus documentos, leer lo propio |
| Revisión administrativa | `apps/admin` + Edge Functions `documento-firmado` y `decision-verificacion` | Listo y en producción (Etapa 5, probado E2E contra el proyecto real) |
| Rol repartidor y disponibilidad | `user_roles`, `0005` | Listo: sin expediente aprobado el backend no abre la concha de repartidor con pedidos |

## 2. Lo que falta: el flujo de registro en el móvil

Auditado con `git grep` sobre `apps/mobile/src`: la pantalla de registro actual solo crea la cuenta de
autenticación y el perfil base. **Ninguna pantalla** (a) pregunta la intención de ser repartidor,
(b) crea `courier_profile`, (c) recoge zona de trabajo o placa, (d) sube documentos al bucket
privado, ni (e) muestra el estado del expediente. Ese es el hueco exacto que este plan cierra.

Pantallas propuestas (navegación por estado actual, sin librerías nuevas salvo el selector de archivos):

1. **«Devenir livreur»** — entrada desde la bienvenida/registro y desde el perfil. Crea
   `courier_profile` (estado `draft`) con zona de trabajo y placa bajo RLS.
2. **Carga de documentos** — 6 ranuras con los tipos reales de la base de datos; subida a
   `courier-identity-private/<user_id>/…` + fila en `courier_verification_documents`
   (política `documentos_cargar_propio`). Reintento y borrado del propio archivo (política DELETE propia).
3. **Enviar expediente** — `draft → submitted` con `submitted_at` (política `expedientes_actualizar_participantes`).
4. **Estado del expediente** — lectura real del caso: enviado, en revisión, requiere información
   (con el motivo de la administración), aprobado o rechazado (con el motivo registrado).

Limitación honesta: mientras el expediente no esté `approved`, el backend ya se lo niega al
repartidor; la app lo reflejará así sin atajos.

## 3. Datos y documentos que el repartidor debe aportar (la obligación)

| Campo/tabla | Documento real en Haití |
|---|---|
| `national_id_front` / `national_id_back` | CIN (carte d'identification nationale), frente y reverso |
| `passport` | Pasaporte (alternativa para extranjeros; decisión pendiente, sección 4) |
| `selfie` | Autorretrato para cotejo facial con el documento |
| `certificate_good_conduct` | Certificado de buena conducta / casier judiciaire |
| `driver_license` | Permis de conduire |
| `courier_profiles.work_zone` | Comuna de trabajo (Ouest: Port-au-Prince, Delmas, Pétion-Ville, …) |
| `courier_profiles.vehicle_plate` | Placa de la motocicleta/vehículo |

## 4. Decisiones que solo el fundador puede tomar (la información pendiente)

1. ¿`certificate_good_conduct` es **obligatorio** para enviar el expediente o opcional?
2. ¿`passport` se exige solo a extranjeros o se acepta siempre como alternativa a la CIN?
3. ¿Método de verificación por defecto del MVP: `documental`, `videoconferencia` o `presencial`?
4. ¿Se usa `verification_scheduled` (cita presencial) en el MVP o se omite ese estado por ahora?
5. Lista cerrada de **comunas/zonas** habilitadas en el lanzamiento.
6. Texto de consentimiento para el tratamiento de datos de identidad (quién lo redacta y en qué idiomas).

## 5. Plan técnico por pasos (cada uno verificable en GitHub Actions)

| Paso | Entregable | Verificación |
|---|---|---|
| 1 | Pantalla de registro de repartidor + `courier_profile` real | E2E: crear perfil bajo RLS; negación para otro usuario |
| 2 | Subida de documentos al bucket privado | E2E: subir, leer propio, URL firmada de administración, 403 a terceros |
| 3 | Envío y estado del expediente | E2E: `draft → submitted → needs_information → approved` por la función real |
| 4 | APK nueva publicada en el release fijo | Workflow «APK de prueba (Android)» verde + verificación del bundle |

Sin simulaciones: todas las pantallas contra las tablas, el bucket y las funciones reales
(ADR-0001). Dependencia nueva prevista: `expo-image-picker` instalada vía `npm` en CI con
permisos nativos declarados en `apps/mobile/app.json` antes del `prebuild`.
