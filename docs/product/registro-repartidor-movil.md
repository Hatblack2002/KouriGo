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

## 4. Decisiones del fundador (registradas el 2026-11-15)

1. **Buena conducta: OBLIGATORIA** — sin `certificate_good_conduct` el expediente no se puede enviar.
2. **Pasaporte: solo extranjeros**, y también aceptado como alternativa si la persona no tiene CIN.
3. **Método por defecto: `documental`.** La cita presencial (`verification_scheduled`)
   **no es necesaria por defecto**; solo si la administración no tiene información suficiente
   (flujo `needs_information` → cita → decisión).
4. **Comunas del lanzamiento: PENDIENTE** (en duda). Propuesta de partida para confirmar:
   área metropolitana del Ouest — Port-au-Prince, Delmas, Pétion-Ville, Carrefour, Tabarre.
5. **Consentimiento de identidad: borrador propuesto abajo (sección 5), editable por el fundador.**

## 5. Borrador de consentimiento para datos de identidad (propuesto, editable)

- **Français** : « En soumettant vos documents d'identité, vous autorisez KouriGo à les traiter
  uniquement pour vérifier votre identité de livreur. Ils sont conservés dans un espace privé et
  seuls les membres de l'équipe de vérification peuvent les consulter. »
- **Kreyòl ayisyen** : « Lè ou voye dokiman idantite ou, ou bay KouriGo pèmèt trete yo sèlman pou
  verifye idantite livè ou. Yo nan yon espas prive, epi sèlman ekip verifikasyon an ka wè yo. »
- **Español** : « Al enviar tus documentos de identidad, autorizas a KouriGo a tratarlos únicamente
  para verificar tu identidad de repartidor. Quedan en un espacio privado y solo el equipo de
  verificación puede verlos. »

## 6. Plan técnico por pasos (cada uno verificable en GitHub Actions)

| Paso | Entregable | Verificación |
|---|---|---|
| 1 | Pantalla de registro de repartidor + `courier_profile` real | E2E: crear perfil bajo RLS; negación para otro usuario |
| 2 | Subida de documentos (buena conducta obligatoria) al bucket privado + consentimiento | E2E: subir, leer propio, URL firmada de administración, 403 a terceros; envío rechazado sin buena conducta |
| 3 | Envío y estado del expediente (método documental por defecto) | E2E: `draft → submitted → needs_information → approved` por la función real |
| 4 | APK nueva publicada en el release fijo | Workflow «APK de prueba (Android)» verde + verificación del bundle |

Sin simulaciones: todas las pantallas contra las tablas, el bucket y las funciones reales
(ADR-0001). Dependencia nueva prevista: `expo-image-picker` instalada vía `npm` en CI con
permisos nativos declarados en `apps/mobile/app.json` antes del `prebuild`.

## 7. Ventana 3 del diseño — seguimiento con mapa (estado honesto: NO implementado)

De las 3 ventanas de la maqueta, la tercera («Suivi en temps réel») está **parcialmente**
implementada: la línea de tiempo del pedido SÍ existe en el detalle (componente
`LineaTiempoEventos`, eventos reales de `order_events`), pero **el mapa no está implementado ni
verificado**: la pantalla `PantallaSeguimientoTiempoReal` del kit no está conectada a ninguna
ruta y no hay proveedor de mapas.

Plan propuesto (requiere luz verde; dependencias nativas nuevas):

1. Mapa con mosaicos gratuitos de **OpenStreetMap** (`react-native-maps` + `UrlTile`, sin clave
   de API ni coste), declarado en `apps/mobile/app.json` antes del `prebuild`.
2. Posición del repartidor compartida **solo con la app abierta** (sin rastreo en segundo plano
   en el MVP): tabla nueva de posiciones + canal Realtime de Supabase (ADR-0001) o transición
   por la función existente; sin posiciones simuladas.
3. Conexión de `PantallaSeguimientoTiempoReal` al pedido real del cliente: estado, eventos y
   posición del repartidor asignado; sin asignación real, estado vacío honesto.
4. Privacidad: consentimiento explícito del repartidor para compartir posición durante las
   entregas activas.
