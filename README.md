# KouriGo

> Plataforma de solicitud, compra asistida y entrega de última milla.  
> Documento rector del producto, la arquitectura y el plan de ejecución.

![KouriGo — identidad visual provisional](assets/brand/kourigo-logo.svg)

**Estado:** Fase 0 (definición del producto) completada; Fase 1 (base técnica) en construcción, con CI verificable en GitHub Actions.  
**Repositorio:** https://github.com/Hatblack2002/KouriGo  
**Mercado inicial previsto:** Haití.  
**Idioma de trabajo de este documento:** español. La interfaz deberá contemplar criollo haitiano (kreyòl ayisyen) y francés desde su diseño inicial.

> **Importante para cualquier agente o colaborador:** este README es la fuente inicial de verdad del proyecto. No inventes funcionalidades ya implementadas, credenciales, acuerdos comerciales, integraciones aprobadas ni disponibilidad de proveedores. El repositorio comienza como una base de proyecto; cada entrega debe reflejarse en código, pruebas y commits verificables. Cuando una decisión esté marcada como pendiente, conserva esa condición hasta recibir aprobación del responsable del producto.

---

## 1. Visión del producto

KouriGo busca facilitar el movimiento de productos y compras cotidianas mediante una plataforma digital que conecte a clientes, repartidores y operadores administrativos. El producto debe permitir solicitar una entrega desde un punto de recogida hasta un destino, y también pedir que un repartidor compre un artículo en nombre del cliente y luego lo entregue.

KouriGo no debe concebirse únicamente como una aplicación para mostrar repartidores en un mapa. Es un sistema operativo de pedidos y entregas: recibe solicitudes, valida direcciones, calcula o registra tarifas, asigna trabajos, coordina a las partes, conserva evidencias de cada cambio de estado y permite que la operación sea supervisada.

### Misión

Hacer que solicitar una compra o una entrega sea un proceso comprensible, trazable y accesible para clientes y repartidores, empezando por una operación local controlada y ampliándose por etapas.

### Principios del producto

1. **Confianza:** identidad y estado verificable de clientes, repartidores y pedidos.
2. **Simplicidad:** flujos cortos, textos claros y uso adecuado en teléfonos Android de gama media.
3. **Trazabilidad:** cada cambio importante de un pedido debe quedar registrado.
4. **Seguridad por diseño:** los permisos se aplican en el servidor; ocultar una pantalla no es seguridad.
5. **Operación realista:** no mostrar seguimiento GPS, pagos o disponibilidad en tiempo real si el sistema no los está proporcionando realmente.
6. **Crecimiento gradual:** validar una ciudad o zona antes de abrir múltiples localidades.
7. **Transparencia económica:** mostrar al repartidor cuánto recibe y explicar cómo se calcula cada comisión.

### Qué significa KouriGo

“Kouri” comunica la idea de correr o moverse en criollo haitiano; “Go” refuerza la acción de salir, avanzar y entregar. La marca debe sentirse rápida, confiable, urbana y empresarial, sin recurrir a ilustraciones infantiles ni a recursos visuales recargados.

---

## 2. Alcance del producto

KouriGo tendrá tres áreas de acceso diferenciadas:

| Área | Usuario | Responsabilidad |
|---|---|---|
| Aplicación de cliente | Cliente | Crear solicitudes, seguir sus pedidos y consultar su historial |
| Aplicación o modo de repartidor | Repartidor aprobado | Recibir, aceptar y completar entregas |
| Consola administrativa | Personal autorizado | Supervisar y gestionar la operación |

La separación puede implementarse inicialmente dentro de una sola aplicación móvil con navegación condicionada por rol, acompañada de una consola web administrativa. La arquitectura no debe permitir que un cliente cambie su rol modificando datos locales o parámetros de una petición.

### 2.1 Cliente

El cliente podrá:

- Registrarse, iniciar sesión y cerrar sesión.
- Gestionar su nombre y datos de contacto.
- Guardar direcciones frecuentes, con etiquetas como casa o trabajo.
- Crear un pedido de entrega indicando lugar de recogida y destino.
- Crear una solicitud **“Achte pou mwen + livre”** (compra por mí y entrega).
- Añadir descripción de artículos, cantidades, referencias y notas.
- Consultar el precio estimado antes de confirmar, cuando el cálculo esté disponible.
- Confirmar o cancelar una solicitud conforme a sus reglas de estado.
- Consultar el estado y los detalles de sus pedidos.
- Consultar el historial y el detalle de cada pedido.
- Recibir notificaciones de cambios relevantes.
- Contactar con soporte mediante el canal definido por la operación.

El cliente solo podrá consultar sus propios datos y pedidos. No podrá acceder a información privada de otros clientes ni a funciones administrativas.

### 2.2 Repartidor

El repartidor tendrá una cuenta separada, sujeta a aprobación administrativa. Debe presentar cédula nacional haitiana (anverso y reverso, cuando corresponda) o pasaporte, selfie, teléfono verificado, datos de residencia/operación y **certificat de bonnes vie et mœurs**. También debe presentar **permis de conduire** cuando vaya a realizar entregas con un vehículo para el que la normativa exija licencia; la operación motorizada no se habilita hasta revisar y aprobar ese permiso. La lista y el flujo de revisión están definidos en `docs/operations/courier-identity-verification.md`. La revisión puede ser documental, por videoconferencia o presencial. El registro de documentos no equivale a aprobación ni demuestra por sí solo autenticidad oficial. Hasta la aprobación explícita, el servidor debe denegar aceptación de pedidos, acceso a pedidos operativos y retiros/liquidaciones. Véase `docs/operations/courier-identity-verification.md`. Podrá:

- Completar su perfil y datos de contacto.
- Enviar la información requerida para su verificación.
- Indicar disponibilidad cuando esa función esté habilitada.
- Consultar solicitudes compatibles con su zona y estado.
- Aceptar o rechazar pedidos disponibles.
- Ver los datos necesarios para ejecutar un pedido aceptado.
- Cambiar el estado de la entrega siguiendo la secuencia permitida.
- Registrar incidencias y solicitar asistencia.
- Consultar entregas anteriores.
- Consultar el desglose de sus ingresos y liquidaciones.
- Consultar su porcentaje o importe de participación según las reglas vigentes.

Un repartidor no podrá ver documentos privados de otros repartidores, alterar su porcentaje de comisión, asignarse pagos ni modificar pedidos que no tenga asignados.

### 2.3 Administrador

La consola administrativa será una aplicación separada, preferiblemente web, con acceso restringido. Sus capacidades previstas incluyen:

- Resumen operativo y métricas.
- Búsqueda y consulta de pedidos.
- Gestión de clientes y repartidores.
- Revisión y aprobación de solicitudes de repartidor.
- Asignación o reasignación controlada de pedidos.
- Gestión de estados excepcionales y cancelaciones justificadas.
- Configuración de zonas, tarifas y reglas de servicio.
- Consulta de comisiones, pagos y liquidaciones.
- Gestión de incidencias y reclamaciones.
- Registro de actividad administrativa.
- Gestión de roles y permisos.
- Exportación controlada de reportes.

No se debe crear una cuenta administrativa pública ni permitir que el formulario de registro normal acepte el rol admin.

---

## 3. Flujos principales

### 3.1 Entrega normal

1. El cliente inicia sesión.
2. Selecciona “Solicitar entrega”.
3. Introduce el punto de recogida y el destino.
4. Añade descripción del paquete, contacto y notas necesarias.
5. El sistema valida los datos y muestra el coste estimado disponible.
6. El cliente confirma la solicitud.
7. El backend crea el pedido con estado inicial.
8. El pedido queda disponible para asignación según las reglas de zona.
9. Un repartidor autorizado acepta el pedido.
10. El repartidor recoge el artículo y actualiza el estado.
11. El repartidor completa la entrega y registra la evidencia permitida.
12. El cliente consulta el resultado y el pedido pasa a estado final.

### 3.2 “Achte pou mwen + livre”

1. El cliente selecciona compra asistida.
2. Indica el comercio o lugar de compra, si lo conoce.
3. Describe los artículos, cantidades, presupuesto y sustituciones permitidas.
4. El sistema separa claramente el importe estimado de los artículos y la tarifa del servicio.
5. El cliente confirma la solicitud y el método de pago disponible.
6. El repartidor acepta y realiza la compra siguiendo las instrucciones.
7. Se registra el importe real de compra y, cuando proceda, una evidencia del recibo.
8. El repartidor entrega los artículos.
9. El sistema conserva el desglose final y el historial de cambios.

**Regla crítica:** el dinero destinado a comprar productos no debe confundirse con la tarifa de entrega ni con los ingresos de KouriGo. La política de anticipos, reembolsos, límites de compra y comprobantes debe aprobarse antes de habilitar esta modalidad en producción.

### 3.3 Incidencias

Debe existir un flujo explícito para:

- Cliente ausente o inaccesible.
- Dirección incorrecta.
- Comercio cerrado o artículo agotado.
- Cliente que rechaza sustituciones.
- Repartidor que no puede continuar.
- Pedido dañado o incompleto.
- Pago no confirmado.
- Cancelación antes o después de la recogida.

Cada incidencia debe guardar quién la reportó, cuándo ocurrió, pedido relacionado, categoría, descripción y resolución. No se debe borrar el historial para “arreglar” un pedido.

---

## 4. Estados y reglas de los pedidos

Estados iniciales propuestos:

| Estado | Significado |
|---|---|
| draft | Solicitud aún no confirmada |
| pending | Pedido confirmado y pendiente de asignación |
| offered | Pedido ofrecido a uno o varios repartidores |
| accepted | Un repartidor aceptó el pedido |
| at_pickup | Repartidor llegó al punto de recogida |
| picked_up | Artículo recogido o compra iniciada/completada según modalidad |
| in_transit | Pedido en camino al destino |
| delivered | Entrega completada |
| cancelled | Pedido cancelado |
| issue | Pedido con una incidencia que requiere resolución |

El backend debe validar las transiciones. El cliente no puede enviar libremente cualquier estado. Por ejemplo, un pedido entregado no puede volver a pendiente mediante una petición ordinaria. Las correcciones administrativas deben exigir permiso, motivo y registro de auditoría.

Para la modalidad de compra asistida, conviene añadir hitos específicos —compra iniciada, compra realizada, importe confirmado— sin forzar esos pasos en una entrega normal.

---

## 5. Modelo comercial y reparto 40/60

La propuesta inicial recibida plantea **40 % para KouriGo y 60 % para el repartidor**. Es una hipótesis comercial, no una regla financiera aprobada ni implementada.

Antes de activarla, el fundador debe definir la base exacta del cálculo. Recomendación inicial para evaluar: aplicar el porcentaje únicamente sobre la tarifa de servicio/entrega que corresponda al repartidor, no sobre el valor de los productos comprados, propinas, impuestos, reembolsos ni dinero entregado para compras.

Ejemplo ilustrativo, no tarifa oficial:

- Tarifa de entrega cobrada: 100 unidades monetarias.
- Participación del repartidor al 60 %: 60.
- Participación de KouriGo al 40 %: 40.

El sistema debe guardar importes y reglas de cálculo en registros financieros inmutables o corregibles mediante asientos compensatorios. No calcular las ganancias únicamente en la interfaz móvil. Debe poder reconstruirse cómo se obtuvo cada cifra.

Pendientes de decisión comercial:

- Moneda y reglas de redondeo.
- Tarifas mínimas y por distancia/zona.
- Quién paga comisiones de pasarela.
- Tratamiento de propinas.
- Cancelaciones y compensaciones.
- Frecuencia y método de liquidación a repartidores.
- Reembolsos y contracargos.
- Si el 40/60 se aplica a todos los servicios o solo a determinados tipos.

---

## 6. Pagos

El MVP debe separar el registro del pedido del procesamiento del pago. No se debe marcar una transacción como pagada solo porque el cliente haya pulsado un botón.

Métodos a evaluar para Haití:

- Efectivo, sujeto a reglas operativas y límites.
- MonCash.
- NatCash.
- Otros proveedores locales únicamente después de verificar disponibilidad, condiciones y documentación.

Las integraciones con MonCash o NatCash requieren acceso legítimo a documentación, credenciales y entorno de pruebas del proveedor. Nunca se deben inventar endpoints, simular confirmaciones ni almacenar secretos en el repositorio.

### Reglas técnicas

- Crear una entidad de pago vinculada al pedido.
- Registrar importe, moneda, proveedor, referencia externa y estado.
- Verificar confirmaciones desde el servidor mediante el mecanismo oficial del proveedor.
- Validar firmas, autenticidad y protección contra repetición cuando el proveedor lo soporte.
- Usar claves de idempotencia para evitar cobros duplicados.
- No guardar números PIN, contraseñas de billeteras ni datos sensibles innecesarios.
- Mantener estados separados: pendiente, iniciado, confirmado, fallido, reembolsado.
- Conciliar pagos y pedidos antes de liquidar ganancias.

Mientras no exista integración real y probada, la interfaz debe indicar que el método está pendiente o utilizar un flujo manual controlado. Nunca presentar un pago simulado como real.

---

## 7. Geolocalización y direcciones

La ubicación es una parte esencial de la operación, pero no debe confundirse una dirección escrita con una coordenada GPS verificada.

El diseño debe permitir:

- Dirección en texto y referencias locales.
- Coordenadas de recogida y destino, cuando el dispositivo las proporcione.
- Confirmación manual del pin por el usuario.
- Permisos de ubicación solicitados solo cuando sean necesarios.
- Compartir ubicación del repartidor durante una entrega activa, con información clara al usuario.
- Dejar de compartir ubicación al terminar o cancelar la entrega.
- Manejar pérdida de señal y permisos denegados.
- Evitar rastreo permanente fuera del trabajo activo.

La primera versión puede usar selección manual de ubicación y registro de coordenadas. El seguimiento en vivo se habilitará solo cuando exista actualización fiable, control de privacidad y consumo de batería aceptable.

Proveedor de mapas: **pendiente de evaluación** por cobertura real en las ciudades objetivo, coste, términos de uso y rendimiento en Haití. No acoplar la lógica del pedido a un único proveedor de mapas.

---

## 8. Identidad visual

La identidad provisional utiliza:

- Nombre: **KouriGo**.
- Verde como color de acción y movimiento.
- Negro/grafito como color de contraste.
- Blanco para legibilidad.
- Una “G” inspirada en un velocímetro, con una aguja que comunica movimiento.

El archivo incluido en assets/brand/kourigo-logo.svg sirve **solamente para identificar el proyecto y orientar el trabajo inicial**. No debe considerarse un manual de marca aprobado ni limitar la evolución del diseño.

Criterios visuales:

- Interfaz limpia y empresarial.
- Iconografía consistente y funcional.
- Tipografía legible en pantallas pequeñas.
- Contraste accesible.
- Componentes reutilizables.
- Sin mockups decorativos como sustituto de pantallas funcionales.
- El logo debe poder utilizarse en launcher, cabecera, pantalla de inicio y material operativo.

Los colores exactos, tipografía final y variantes de marca se aprobarán en una fase de identidad visual.

---

## 9. Idiomas y accesibilidad

Idiomas iniciales previstos:

1. Criollo haitiano (kreyòl ayisyen): idioma prioritario para el mercado local.
2. Francés: segundo idioma.
3. Español o inglés: posibles idiomas adicionales, no requisito del primer MVP.

Todos los textos visibles deben salir de archivos de traducción o un sistema de internacionalización. No insertar textos directamente en componentes si eso impide traducirlos.

Usar formatos localizados de fecha, hora, moneda y números. Los mensajes de error deben explicar cómo resolver el problema, no exponer detalles técnicos internos.

---

## 10. Arquitectura técnica propuesta

La arquitectura debe ser modular, segura y económica de operar. La siguiente es una propuesta de partida que el agente técnico debe validar antes de fijar dependencias:

### Aplicaciones

- **Cliente móvil:** React Native + Expo + TypeScript.
- **Modo repartidor:** inicialmente dentro de la misma aplicación móvil, con navegación y permisos por rol; separar en otra aplicación solo si el producto lo justifica.
- **Consola administrativa:** aplicación web con TypeScript y diseño adaptable.
- **Backend:** API central con autenticación, autorización, lógica de pedidos, pagos y auditoría.
- **Base de datos:** PostgreSQL, por la naturaleza relacional de pedidos, usuarios, repartidores y movimientos financieros.
- **Notificaciones:** servicio push con registro de tokens y preferencias.
- **Almacenamiento:** archivos privados para documentos operativos y recibos; imágenes públicas solo cuando corresponda.

**Decisión aprobada: Supabase es el backend principal de KouriGo.** PostgreSQL será la base de datos central; PostGIS cubrirá consultas geoespaciales; Supabase Auth gestionará identidad y sesiones; Supabase Storage alojará documentos privados; y Edge Functions ejecutarán operaciones privilegiadas del servidor. Firebase queda fuera de la arquitectura inicial: no introducir Firebase Auth, Firestore ni Firebase Storage en paralelo. Cloudinary se reserva exclusivamente para recursos visuales públicos (por ejemplo, imágenes de comercios y productos), nunca para cédulas, pasaportes, selfies de verificación ni otros documentos sensibles. La especificación obligatoria está en `docs/architecture/backend-supabase.md`.

### Organización sugerida del repositorio

    KouriGo/
    ├── README.md
    ├── apps/
    │   ├── mobile/                 # Cliente y repartidor
    │   └── admin/                  # Consola administrativa
    ├── services/
    │   └── api/                    # API y lógica de negocio
    ├── packages/
    │   ├── domain/                 # Entidades y reglas compartidas
    │   ├── validation/             # Esquemas de validación
    │   ├── ui/                     # Componentes compartidos
    │   └── config/                 # Configuración común
    ├── database/
    │   ├── migrations/
    │   ├── seeds/
    │   └── policies/
    ├── docs/
    │   ├── architecture/
    │   ├── product/
    │   ├── operations/
    │   └── decisions/
    ├── assets/
    │   └── brand/
    ├── tests/
    │   ├── integration/
    │   └── e2e/
    ├── .github/
    │   └── workflows/
    └── .env.example

No es obligatorio crear todas las carpetas vacías al inicio. Cada módulo debe aparecer cuando tenga implementación real.

**Estado de la base técnica (2026-11-13):** el repositorio usa un monorepo npm workspaces en TypeScript estricto. Las reglas de negocio de pedidos viven en `packages/domain` y se aplican también en la base de datos (triggers + RLS) según `database/migrations/`. El pipeline de GitHub Actions (`.github/workflows/ci.yml`) ejecuta verificación de formato, lint, análisis de tipos, pruebas unitarias, pruebas de autorización contra PostgreSQL 16 + PostGIS y build. La decisión de herramientas está registrada en `docs/decisions/ADR-0002-herramientas-base.md` y el plan por etapas en `docs/product/plan-etapas.md`.

### Separación por dominios

- Identity & Access: cuentas, sesiones, roles y permisos.
- Customer: perfil, direcciones y preferencias.
- Courier: perfil, verificación, disponibilidad y liquidaciones.
- Orders: creación, asignación, estados e incidencias.
- Dispatch: oferta y asignación de pedidos.
- Pricing: tarifas, zonas y estimaciones.
- Payments: cobros, confirmaciones y reembolsos.
- Ledger: comisiones, saldos y liquidaciones.
- Notifications: avisos y preferencias.
- Admin: operaciones, configuración y auditoría.
- Support: reclamaciones e incidencias.

Cada dominio debe exponer operaciones controladas. Evitar que cualquier módulo modifique directamente tablas de otro dominio sin reglas explícitas.

---

## 11. Modelo de datos inicial

El esquema definitivo se definirá mediante migraciones versionadas. Entidades previstas:

| Entidad | Datos esenciales |
|---|---|
| users | id, nombre, contacto, estado, fecha de creación |
| user_roles | user_id, rol, estado, asignado_por |
| customer_profiles | user_id, preferencias |
| courier_profiles | user_id, estado de verificación, datos operativos |
| addresses | propietario, etiqueta, dirección, coordenadas opcionales |
| service_zones | nombre, límites o cobertura, estado |
| orders | cliente, tipo, recogida, destino, estado, tarifa |
| order_items | pedido, descripción, cantidad, precio estimado/real |
| order_assignments | pedido, repartidor, asignación, aceptación y cierre |
| order_events | pedido, actor, evento, estado anterior/nuevo, fecha |
| incidents | pedido, reportante, categoría, resolución |
| payments | pedido, proveedor, referencia, importe, estado |
| ledger_entries | cuenta, pedido, tipo, importe, moneda, referencia |
| courier_payouts | repartidor, periodo, importe, estado |
| notifications | destinatario, tipo, entrega y lectura |
| audit_logs | actor, acción, recurso, fecha y metadatos seguros |

Usar identificadores no predecibles cuando se expongan públicamente. Guardar fechas en UTC y presentar la hora local en la interfaz. Definir claves foráneas, índices y restricciones. Los importes monetarios deben almacenarse como enteros en la unidad mínima de la moneda o como tipo decimal exacto; nunca usar coma flotante binaria para dinero.

---

## 12. Seguridad y protección del panel administrativo

La consola administrativa no es una sección pública. Su protección debe existir en el backend y en la base de datos, no solo en el diseño de navegación.

Requisitos obligatorios:

1. El registro público de cliente utiliza Supabase Auth con Google Sign-In.
2. La cuenta de repartidor se crea mediante un flujo separado y queda bloqueada para operar hasta completar la verificación documental y recibir aprobación administrativa; el detalle obligatorio está en `docs/operations/courier-identity-verification.md`.
3. Las cuentas administrativas utilizan Microsoft Sign-In y deben ser creadas/invitadas o autorizadas previamente por el administrador principal; nunca existe registro público de administradores.
4. Los roles de repartidor y administrador se asignan mediante flujos autorizados del servidor.
3. Las rutas administrativas exigen sesión válida y permiso específico.
4. Cada operación sensible vuelve a comprobar permisos en el servidor.
5. Las políticas de base de datos deben impedir lectura o escritura entre usuarios no autorizados.
6. El cliente solo puede consultar sus pedidos y datos.
7. El repartidor solo puede consultar pedidos asignados o expresamente ofrecidos.
8. Los cambios de tarifa, comisión, pago, rol o estado excepcional requieren permiso administrativo.
9. Registrar acciones administrativas en una auditoría protegida contra modificaciones ordinarias.
10. Aplicar límites de solicitudes, validación de entradas y protección contra enumeración de cuentas.
11. Usar HTTPS en todos los entornos accesibles por red.
12. No incluir claves privadas, tokens de servicio ni contraseñas en Git.
13. Usar MFA para administradores cuando la plataforma de identidad lo permita.
14. Revocar sesiones y acceso cuando una cuenta sea suspendida.
15. No confiar en valores de rol enviados por la aplicación móvil.

Ocultar la URL del panel puede reducir exposición casual, pero no constituye un control de acceso. Aunque un usuario conozca la ruta, no debe obtener datos ni ejecutar acciones sin autorización válida.

---

## 13. Privacidad y manejo de datos

La aplicación manejará nombres, teléfonos, direcciones, ubicaciones y potencialmente comprobantes de compra. Debe recopilar solo los datos necesarios para prestar el servicio.

- Explicar por qué se solicita ubicación.
- Solicitar permiso de GPS en el momento de uso, no al instalar sin motivo.
- Limitar la visibilidad de teléfonos y direcciones al pedido activo y a los actores que lo necesitan.
- Definir retención de historial, recibos y registros de auditoría.
- Permitir corregir datos personales mediante un flujo seguro.
- No exponer documentos de verificación en URLs públicas.
- No utilizar datos de clientes para pruebas o capturas de demostración.
- Preparar una política de privacidad y términos antes de abrir el servicio al público.

La legislación aplicable y las obligaciones comerciales locales deben revisarse antes del lanzamiento.

---

## 14. Consola administrativa: diseño funcional

La consola debe priorizar el trabajo diario, no la decoración.

Secciones previstas:

1. **Resumen:** pedidos activos, pendientes, completados, incidencias y volumen de operación.
2. **Pedidos:** filtros por estado, fecha, zona, cliente y repartidor.
3. **Mapa operativo:** ubicación de pedidos activos y repartidores que estén compartiendo ubicación por una entrega.
4. **Clientes:** búsqueda, estado y detalle limitado según permisos.
5. **Repartidores:** verificación, disponibilidad, historial y liquidaciones.
6. **Finanzas:** tarifas, pagos, comisiones, ajustes y conciliación.
7. **Zonas y tarifas:** cobertura y configuración de servicio.
8. **Incidencias:** casos pendientes, responsables y resolución.
9. **Administradores:** usuarios internos, roles y permisos.
10. **Auditoría:** historial de operaciones sensibles.

Debe existir al menos un rol de administrador principal y roles operativos de privilegio limitado. No todos los empleados necesitan acceso a finanzas, datos personales o gestión de administradores.

---

## 15. MVP: qué construir primero

El objetivo del MVP es completar una operación pequeña de principio a fin, no lanzar todas las funciones imaginables.

### Fase 0 — Descubrimiento y validación

- Confirmar ciudad o zona inicial.
- Entrevistar clientes y posibles repartidores.
- Definir cómo se recibe y entrega un pedido en la operación real.
- Confirmar tarifas, moneda y política 40/60.
- Identificar métodos de pago realmente disponibles.
- Definir reglas de compra asistida y reembolsos.
- Aprobar los idiomas y textos iniciales.
- Registrar decisiones en docs/decisions/.

**Salida:** especificación aprobada y criterios de aceptación.

### Fase 1 — Base técnica

- Crear estructura de aplicaciones y backend.
- Configurar entornos de desarrollo y pruebas.
- Configurar base de datos y migraciones.
- Implementar autenticación.
- Implementar autorización por roles.
- Configurar CI para lint, análisis de tipos y pruebas.
- Añadir datos de demostración no reales.

**Salida:** usuarios autenticados y permisos comprobados automáticamente.

### Fase 2 — Pedido básico

- Perfil de cliente.
- Direcciones.
- Crear pedido de entrega.
- Lista y detalle de pedidos.
- Estados y eventos.
- Consola administrativa mínima.
- Repartidor aprobado y asignación manual.

**Salida:** un pedido puede crearse, asignarse, recogerse y entregarse en un entorno de pruebas.

### Fase 3 — Operación del repartidor

- Bandeja de pedidos disponibles.
- Aceptar o rechazar.
- Estados de entrega.
- Incidencias.
- Historial.
- Desglose preliminar de ganancias.

**Salida:** el flujo puede ejecutarse sin intervención técnica directa.

### Fase 4 — Compra asistida

- Formulario de artículos.
- Presupuesto y sustituciones.
- Registro de importe real.
- Recibo o evidencia.
- Diferenciación de dinero de compra y tarifa de servicio.
- Reglas de cancelación y reembolso.

**Salida:** compra asistida probada con escenarios normales y fallidos.

### Fase 5 — Pagos y notificaciones

- Integrar proveedores con documentación oficial y credenciales de prueba.
- Verificar confirmaciones en backend.
- Idempotencia y conciliación.
- Notificaciones push.
- Pruebas de cobro duplicado, fallido y reembolso.

**Salida:** transacciones verificables y notificaciones reales.

### Fase 6 — Piloto controlado

- Operar en una zona delimitada.
- Incorporar un grupo pequeño de repartidores verificados.
- Medir tiempos, cancelaciones, incidencias y costes.
- Revisar soporte y liquidaciones.
- Corregir fallos antes de ampliar cobertura.

**Salida:** informe del piloto y decisión documentada de expansión.

---

## 16. Criterios de aceptación del MVP

El MVP no se considera funcional solo porque las pantallas abran. Debe demostrar estos escenarios:

- Un usuario nuevo puede registrarse como cliente.
- El registro público no puede crear un administrador.
- Un administrador autorizado puede aprobar un repartidor.
- Un cliente puede crear un pedido válido.
- El backend rechaza datos incompletos o manipulados.
- Un repartidor no aprobado no puede aceptar pedidos.
- Un repartidor no puede ver pedidos privados de otros repartidores.
- Un pedido puede seguir las transiciones permitidas.
- Un cliente no puede marcar un pedido como entregado.
- Un usuario no puede consultar pedidos ajenos cambiando un ID.
- Los eventos de pedido quedan registrados.
- La tarifa y la comisión se calculan en backend.
- Las operaciones financieras no se duplican al repetir una petición.
- Las incidencias pueden abrirse y resolverse con historial.
- La aplicación muestra estados de error y pérdida de conexión.
- Los textos principales pueden cambiar entre kreyòl y francés.
- La consola administrativa bloquea a usuarios sin permisos incluso si conocen su URL.

Las pruebas deben incluir casos negativos y de autorización, no solo el camino feliz.

---

## 17. Pruebas, calidad y CI

Todo cambio debe mantener una base reproducible.

### Pruebas mínimas

- Unitarias para reglas de pedidos, tarifas y comisiones.
- Integración para autenticación, roles, pedidos y pagos.
- Pruebas de políticas de acceso a datos.
- Pruebas de API con usuarios de distintos roles.
- E2E para los flujos de cliente, repartidor y administrador.
- Pruebas de errores de red y reintentos.
- Pruebas de regresión para estados y liquidaciones.

### Automatización

El pipeline de GitHub Actions debe ejecutar, según las herramientas elegidas:

1. Instalación reproducible.
2. Formateo o verificación de formato.
3. Lint.
4. Análisis de tipos.
5. Pruebas unitarias.
6. Pruebas de integración que no requieran secretos de producción.
7. Build de las aplicaciones.
8. Análisis de dependencias y secretos.

Un build exitoso no demuestra por sí solo que el producto funcione. Cada fase debe incluir pruebas funcionales y evidencia de ejecución.

### Reglas de contribución

- Trabajar en ramas de funcionalidad.
- Usar commits pequeños y descriptivos.
- No introducir archivos de credenciales.
- No reemplazar funcionalidad real con botones decorativos o datos falsos.
- Marcar explícitamente cualquier mock o fixture de pruebas.
- Documentar decisiones de arquitectura.
- No borrar trabajo existente sin revisar su propósito.
- Actualizar este README cuando cambie una decisión estructural.
- No afirmar que una fase está terminada sin pruebas reproducibles.

---

## 18. Entornos y configuración

Entornos previstos:

- **Local:** desarrollo individual.
- **Test:** integración y pruebas automatizadas.
- **Staging:** validación previa al piloto.
- **Production:** operación real.

El archivo .env.example debe documentar nombres de variables sin valores secretos. Los secretos reales se guardan en el gestor de secretos del entorno de despliegue o en GitHub Actions Secrets cuando corresponda.

Ejemplos de categorías de configuración:

- URL de API.
- Configuración de base de datos.
- Proveedor de autenticación.
- Claves públicas de mapas.
- Credenciales de sandbox de pagos.
- Configuración de notificaciones.
- Almacenamiento de archivos.

Nunca usar una clave de servicio privilegiada en una aplicación móvil o web pública.

---

## 19. Operación del servicio

La tecnología no resuelve por sí sola la operación de entregas. Antes del piloto se deben definir:

- Zona y horario de servicio.
- Cómo se incorporan y verifican repartidores.
- Qué ocurre cuando no hay repartidores disponibles.
- Cómo se confirma la recogida y la entrega.
- Qué evidencia se solicita y cuándo.
- Cómo se gestiona efectivo.
- Quién responde ante pérdidas, daños o artículos incorrectos.
- Cómo se tramitan reembolsos y reclamaciones.
- Cómo se liquidan las ganancias.
- Qué soporte recibe cliente y repartidor.

El panel debe permitir a una persona operadora resolver los casos habituales sin modificar directamente la base de datos.

---

## 20. Métricas para evaluar el piloto

No medir únicamente descargas o registros. Métricas operativas:

- Pedidos creados y completados.
- Tasa de aceptación por repartidores.
- Tiempo hasta la asignación.
- Tiempo de recogida y entrega.
- Cancelaciones por motivo.
- Pedidos con incidencias.
- Repetición de clientes.
- Ingreso por tarifa de servicio.
- Participación pagadera a repartidores.
- Coste de operación por pedido.
- Pagos fallidos y tiempo de conciliación.
- Satisfacción de clientes y repartidores.

Las métricas deben definirse con denominadores claros y rangos temporales comparables.

---

## 21. Riesgos principales

| Riesgo | Mitigación |
|---|---|
| No hay repartidores suficientes | Lanzamiento por zona y horario |
| Direcciones difíciles de interpretar | Referencias locales, pin manual y contacto |
| Pagos no confirmados | Verificación servidor-servidor |
| Fraude o cuentas falsas | Verificación gradual y límites |
| Compra asistida con gasto no autorizado | Presupuesto, límites y autorización |
| Conflictos de comisión | Fórmula visible y ledger auditable |
| Exposición del panel admin | Autorización backend, MFA y auditoría |
| Conectividad irregular | Estados resilientes y reintentos idempotentes |
| Costes técnicos excesivos | Medir consumo y usar servicios escalables |
| Expansión prematura | Piloto y métricas antes de ampliar |

---

## 22. Decisiones pendientes que requieren al fundador

No deben resolverse por intuición del agente. Deben confirmarse con la persona responsable del negocio:

1. Ciudad o zona exacta del primer piloto.
2. Nombre legal y titularidad de la operación.
3. Moneda principal y política de efectivo.
4. Tarifas iniciales.
5. Base exacta del reparto 40/60.
6. Método y calendario de pago a repartidores.
7. Reglas de compra asistida, anticipos y reembolsos.
8. Proveedores de pago con acceso real a API.
9. Requisitos de verificación de repartidores.
10. Horarios, zonas y límites de servicio.
11. Idiomas obligatorios del primer lanzamiento.
12. Canales oficiales de soporte.
13. Política de privacidad y condiciones del servicio.
14. Responsables de infraestructura, cuentas y costes.
15. Propiedad intelectual, licencias y derechos sobre el código.

Cada decisión aprobada debe registrarse en un documento breve dentro de docs/decisions/, con fecha, responsable, contexto y consecuencias.

---

## 23. Instrucciones para el agente que continúe el proyecto

El agente que tome este repositorio debe actuar como responsable técnico de ejecución, no como generador de una maqueta superficial.

### Orden de trabajo obligatorio

1. Leer este README completo.
2. Inspeccionar el estado real del repositorio, ramas, commits y archivos.
3. Identificar qué está implementado y qué no.
4. Presentar un diagnóstico técnico breve antes de introducir una arquitectura irreversible.
5. Convertir las fases del MVP en tareas pequeñas y verificables.
6. Empezar por la base técnica y los controles de acceso.
7. Construir un flujo funcional de extremo a extremo antes de ampliar pantallas.
8. Ejecutar pruebas y builds después de cada fase.
9. Registrar decisiones, limitaciones y resultados.
10. Mantener commits que permitan revisar exactamente qué cambió.

### Prohibiciones

- No crear una interfaz que simule pedidos reales sin backend.
- No inventar pagos confirmados, GPS activo ni notificaciones entregadas.
- No guardar roles administrativos en almacenamiento local como única autorización.
- No exponer credenciales ni datos personales.
- No implementar un porcentaje comercial sin una fórmula aprobada.
- No declarar “MVP terminado” por tener pantallas navegables.
- No añadir dependencias innecesarias ni servicios de pago sin revisar costes.
- No borrar o reescribir componentes existentes sin inspección previa.

### Entrega esperada de cada fase

Cada fase debe terminar con:

- Lista de funcionalidades implementadas.
- Archivos y módulos modificados.
- Decisiones tomadas y pendientes.
- Pruebas ejecutadas y sus resultados.
- Build reproducible o explicación concreta del bloqueo.
- Commit(s) identificables.
- Riesgos conocidos y siguiente fase recomendada.

---

## 24. Definición de éxito

KouriGo habrá alcanzado un MVP operativo cuando un cliente real de prueba pueda crear una solicitud, un repartidor aprobado pueda aceptarla y completarla, y un operador autorizado pueda supervisar todo el ciclo desde la consola administrativa, con permisos correctos, historial verificable y cálculo económico reproducible.

La meta no es publicar rápidamente una aplicación visual. La meta es construir una herramienta que pueda sostener una operación real, comenzar pequeña, aprender del mercado haitiano y crecer sin tener que reconstruir su seguridad y sus reglas comerciales desde cero.

---

**KouriGo — Bouje pi fasil. Livre ak konfyans.**  
*Muévete con facilidad. Entrega con confianza.*
