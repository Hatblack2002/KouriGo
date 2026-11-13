# Verificación de identidad de repartidores

**Estado:** requisitos de producto aprobados; implementación pendiente hasta que exista código, configuración y pruebas.  
**Ámbito:** KouriGo, mercado inicial Haití.

## 1. Objetivo y regla de habilitación

Toda cuenta de repartidor requiere revisión y aprobación administrativa antes de poder operar.

La creación de una cuenta, la verificación del teléfono o la carga de una fotografía documental no habilitan al repartidor. La autorización debe persistirse en el backend y comprobarse en cada operación protegida.

Mientras el estado no sea `approved`, el backend debe denegar:

- conectarse como repartidor disponible;
- consultar/recibir ofertas de pedidos operativos;
- aceptar o reclamar pedidos;
- acceder a datos operativos de pedidos que no le correspondan;
- registrar entregas como repartidor;
- solicitar o ejecutar retiros/liquidaciones.

No basta con deshabilitar botones en la aplicación. La API/Edge Functions y RLS deben hacer cumplir la regla.

## 2. Datos y documentos solicitados al candidato

Reunir solo lo necesario para comprobar identidad, antecedentes documentales requeridos por la operación y habilitación del medio de transporte:

- nombre y apellidos legales;
- teléfono y confirmación OTP;
- correo electrónico, si se requiere para la cuenta;
- selfie/fotografía actual del candidato;
- documento de identidad: cédula nacional haitiana (frente y reverso, cuando corresponda) o pasaporte;
- **certificat de bonnes vie et mœurs** (certificado de buena conducta/vida y costumbres solicitado por el responsable del desarrollo);
- **permis de conduire** (licencia de conducir), cuando el repartidor vaya a operar un vehículo para el que la normativa exija permiso;
- dirección o zona de residencia declarada;
- zona habitual de trabajo;
- información del vehículo y matrícula solo cuando aplique al tipo de entrega.

**Regla de habilitación de transporte:** la revisión del permis de conduire debe confirmar que el documento corresponde al candidato, está vigente y cubre la categoría del vehículo declarado. No habilitar entregas motorizadas si el permiso requerido está ausente, vencido, ilegible o pendiente de revisión. Si KouriGo permite repartidores a pie o en bicicleta, no exigir una licencia de conducir para esos modos, salvo que el responsable del producto establezca y justifique otra regla. La exigencia del certificat de bonnes vie et mœurs se aplica al expediente de repartidor conforme a la nueva instrucción del responsable del desarrollo.

La documentación interna no sustituye una validación oficial. El agente debe confirmar con el responsable del producto el formato aceptado, vigencia exigida, autoridad emisora y método legítimo de comprobación de cada certificado antes de automatizar rechazos.

No solicitar contraseñas, PIN de billeteras ni información personal no necesaria. Informar al solicitante del propósito, acceso, conservación y proceso de revisión antes de recopilar documentos.

## 3. Métodos de verificación permitidos

El administrador puede seleccionar y registrar uno o más métodos:

### A. Revisión documental

- comprobar legibilidad, integridad aparente y consistencia de los datos;
- comparar el nombre del formulario con el documento;
- comparar la selfie con la fotografía del documento, cuando la calidad lo permita;
- marcar discrepancias, vencimiento aparente, daño o necesidad de nueva captura;
- no declarar autenticidad oficial si KouriGo no dispone de una fuente o mecanismo oficial de validación.

### B. Videoconferencia

- agendar contacto con consentimiento del candidato;
- pedir que muestre el documento durante la sesión;
- comparar a la persona presente con la foto del documento;
- registrar fecha, revisor, resultado y observaciones mínimas;
- no grabar la llamada por defecto. Si se propone grabar, requiere política, consentimiento explícito y justificación aprobada.

### C. Verificación presencial

- programar visita o encuentro con consentimiento;
- asignar un representante autorizado;
- registrar fecha, responsable, resultado y observaciones mínimas;
- no conservar ubicación precisa o información adicional más allá de lo necesario para la verificación.

Estos métodos son controles internos de KouriGo. No equivalen a una consulta oficial de un registro nacional ni garantizan por sí solos que un documento sea auténtico.

## 4. Estados del expediente

Estados sugeridos:

- `draft`: registro incompleto, aún no enviado.
- `submitted`: candidato envió solicitud y documentos.
- `under_review`: revisión administrativa iniciada.
- `needs_information`: se requieren documentos o aclaraciones.
- `verification_scheduled`: videollamada o visita programada.
- `approved`: identidad revisada y cuenta habilitada por decisión administrativa.
- `rejected`: solicitud rechazada con motivo registrado.
- `suspended`: cuenta previamente habilitada, temporalmente bloqueada.
- `expired` o `reverification_required`: revisión adicional necesaria por política o cambio material.

El estado del expediente debe separarse del estado general de la cuenta y de la disponibilidad del repartidor. Un repartidor aprobado puede estar inactivo/no disponible; un repartidor suspendido no puede operar.

## 5. Panel administrativo

Sección: **Verificación de repartidores**.

Cada expediente debe presentar, según permisos:

- identificador interno del caso;
- nombre declarado y datos de contacto necesarios;
- tipo de documento;
- imágenes privadas con acceso temporal autorizado;
- fecha de envío y antigüedad del caso;
- método(s) de comprobación;
- estado y motivo de estado;
- administrador/revisor responsable;
- lista cronológica de eventos;
- solicitudes de información pendientes.

Acciones disponibles:

- iniciar revisión;
- marcar documentos ilegibles;
- solicitar nueva captura o información;
- programar videoconferencia;
- asignar verificación presencial;
- aprobar;
- rechazar con motivo;
- suspender una cuenta ya aprobada;
- reabrir o solicitar reverificación, con justificación.

No permitir que el mismo candidato apruebe su propia cuenta. Registrar quién tomó cada decisión y cuándo.

## 6. Modelo de datos sugerido

La implementación debe revisar el esquema existente antes de crear tablas. Entidades/campos sugeridos:

### `courier_verification_cases`

- `id`
- `courier_user_id`
- `status`
- `submitted_at`
- `review_started_at`
- `decision_at`
- `decision_by`
- `decision_reason`
- `verification_method`
- `created_at`
- `updated_at`

### `courier_verification_documents`

- `id`
- `case_id`
- `document_type` (national_id_front, national_id_back, passport, selfie, certificate_good_conduct, driver_license)
- `storage_bucket`
- `storage_path`
- `uploaded_at`
- `review_status`
- `review_notes` (sin repetir números completos de documento)

### `courier_verification_events`

- `id`
- `case_id`
- `actor_user_id`
- `event_type`
- `from_status`
- `to_status`
- `occurred_at`
- `safe_metadata`

El número completo de documento no debe copiarse en logs o metadatos genéricos. Si existe una necesidad justificada de almacenar un identificador, se debe definir cifrado, minimización, retención y acceso antes de implementarlo.

## 7. Almacenamiento y privacidad

Los documentos se almacenan en Supabase Storage en bucket privado, con políticas de mínimo privilegio. No usar Cloudinary ni URLs públicas para cédulas, pasaportes o selfies KYC.

- No enviar documentos por logs, analytics, crash reports o notificaciones.
- No devolver rutas o URLs públicas a usuarios no autorizados.
- Generar signed URLs de corta duración después de validar permiso.
- Restringir el acceso de revisores por rol.
- Registrar accesos y decisiones sensibles con metadatos mínimos.
- Definir periodo de retención y proceso de eliminación antes del lanzamiento.
- Proteger copias, exportaciones y backups con controles equivalentes.

## 8. Reglas de autorización

La elegibilidad del repartidor debe validarse en servidor usando el estado persistido:

`account_active = true AND verification_status = 'approved' AND not_suspended`

Esta expresión es ilustrativa; la implementación debe modelar correctamente estados y permisos.

Las operaciones de aprobación/rechazo/suspensión se ejecutan mediante función confiable, con validación de rol administrativo. El cliente no puede escribir directamente el estado de verificación ni asignar `approved`.

RLS debe impedir que un repartidor lea documentos de otro repartidor. El candidato puede consultar el estado de su propio expediente y enviar archivos mediante el flujo autorizado, pero no aprobarse ni alterar la decisión.

## 9. Auditoría y prevención de abuso

Registrar:

- creación y envío del expediente;
- carga/reemplazo/eliminación de documento;
- acceso administrativo a documentos;
- solicitud de información;
- videoconferencia o visita completada;
- aprobación, rechazo, suspensión y reverificación;
- actor, fecha, caso y motivo.

Evitar guardar imágenes o números completos de documento dentro de los logs. Las notas del revisor deben ser profesionales, pertinentes y no discriminatorias.

## 10. Criterios de aceptación

- El registro de repartidor no concede estado aprobado.
- El expediente contempla el certificat de bonnes vie et mœurs.
- El permiso de conducir se revisa para repartidores que operen vehículos que lo requieran.
- Un repartidor no puede realizar entregas motorizadas si el permiso requerido está ausente, vencido o pendiente de validación.
- Un candidato no puede cambiar su propio estado mediante API directa.
- El usuario no aprobado no puede aceptar un pedido ni consultar ofertas operativas.
- El usuario aprobado sí puede operar cuando además está activo y disponible.
- La suspensión bloquea inmediatamente nuevas operaciones protegidas.
- Solo personal autorizado puede visualizar documentos.
- Un repartidor no puede descargar documentos de otro.
- Los enlaces temporales expiran.
- Cada decisión registra administrador, fecha, método y motivo.
- Rechazo y solicitud de información muestran un motivo claro al candidato.
- Las pruebas incluyen acceso permitido y denegado para cliente, repartidor, revisor y administrador.

**No declarar el sistema de verificación implementado hasta que existan migraciones, políticas Storage/RLS, flujo de revisión, controles backend y pruebas automatizadas ejecutadas.**
