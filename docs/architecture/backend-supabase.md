# Arquitectura de backend de KouriGo — Supabase

**Estado:** decisión aprobada para la arquitectura inicial.  
**Repositorio:** Hatblack2002/KouriGo  
**Idioma:** español.

## 1. Decisión

Supabase será el backend principal de KouriGo. La plataforma utilizará:

- **Supabase Auth** para autenticación, identidad de sesión y proveedores OAuth.
- **PostgreSQL** como fuente central de datos transaccionales.
- **PostGIS** para coordenadas, cobertura, proximidad y consultas geoespaciales.
- **Supabase Storage** para archivos privados y documentos operativos.
- **Row Level Security (RLS)** para aplicar aislamiento de datos a nivel de base de datos.
- **Edge Functions** para operaciones privilegiadas, validaciones y coordinación con servicios externos.
- **Realtime**, únicamente donde una necesidad operativa real lo justifique y después de definir autorización, frecuencia y consumo.

Firebase queda excluido del backend inicial. No añadir Firebase Auth, Firestore o Firebase Storage como segundo sistema de identidad/datos. Una futura excepción requiere ADR y aprobación expresa del responsable del producto.

## 2. Proveedores de autenticación por tipo de cuenta

| Tipo de cuenta | Método definido | Condición |
|---|---|---|
| Cliente | Google Sign-In mediante Supabase Auth | El cliente inicia sesión con una cuenta Google |
| Repartidor | Flujo separado de registro y autenticación; teléfono verificado y expediente de identidad | No puede operar hasta aprobación administrativa |
| Administrador | Microsoft Sign-In mediante Supabase Auth | Cuenta previamente creada/invitada o autorizada; sin registro público |

La autenticación confirma quién controla una sesión/proveedor. No equivale a verificar que un documento nacional sea auténtico ni a conceder permisos de negocio.

Los roles no se aceptan desde el cliente ni se guardan como única fuente de autoridad en almacenamiento local. La asignación y revocación de roles se realiza mediante operaciones confiables del servidor. Las políticas RLS y las funciones backend deben comprobar el rol y el estado vigente.

## 3. Límites de confianza y responsabilidades

### Aplicaciones cliente

Las aplicaciones pueden usar la clave pública/anon de Supabase, porque no es un secreto privilegiado. Toda tabla expuesta debe tener RLS activado y políticas restrictivas. La interfaz nunca decide por sí sola que un repartidor está aprobado ni que un pago fue confirmado.

### Edge Functions y servidor

Las operaciones privilegiadas se ejecutan en Edge Functions o servicios backend confiables. La clave service-role, secretos de proveedores y credenciales privadas solo pueden existir en el entorno servidor/secret manager; nunca en código móvil, frontend, repositorio ni builds públicos.

Operaciones que requieren control de servidor incluyen:

- asignar o cambiar roles;
- aprobar, rechazar o suspender repartidores;
- emitir acceso temporal a documentos privados;
- aceptar/asignar pedidos con validación de elegibilidad;
- confirmar pagos mediante el proveedor;
- calcular comisiones y asientos del ledger;
- ejecutar reembolsos y liquidaciones;
- registrar eventos administrativos sensibles.

### Base de datos

PostgreSQL es la fuente de verdad para perfiles, estados, pedidos, asignaciones, pagos, ledger y auditoría. Las migraciones SQL deben versionarse en Git. Los cambios de esquema no se realizan manualmente solo desde el dashboard sin migración reproducible.

## 4. Almacenamiento y clasificación de archivos

### Supabase Storage privado

Crear buckets privados separados por finalidad, por ejemplo:

- `courier-identity-private`: cédulas, pasaportes y evidencias de verificación.
- `order-evidence-private`: recibos o pruebas operativas que no deban ser públicas.

Los nombres son propuestas de organización, no buckets que ya existan. El agente no debe afirmar que están configurados hasta crearlos y probar sus políticas.

Requisitos:

- nunca habilitar acceso público a documentos de identidad;
- validar autorización en servidor y políticas de Storage;
- limitar lectura a personal de verificación autorizado y al propio titular cuando corresponda;
- usar URLs firmadas de corta duración solo cuando sea necesario;
- registrar acceso/decisiones sensibles sin copiar el contenido del documento a logs;
- limitar tamaño, MIME, extensión y cantidad de archivos;
- evitar que el nombre del archivo contenga números de documento u otros datos personales;
- definir retención y eliminación segura antes de producción.

### Cloudinary

Cloudinary se reserva para recursos visuales públicos o destinados a publicación, como imágenes de comercios, productos, banners y recursos de marca. No almacenar ni entregar por Cloudinary documentos de identidad, selfies KYC, pasaportes, cédulas, direcciones privadas ni evidencias sensibles.

## 5. Modelo de datos: entidades iniciales

El esquema definitivo debe diseñarse con migraciones y restricciones. Como mínimo, evaluar:

- `profiles`: datos generales asociados al ID de Auth.
- `user_roles`: roles y asignación controlada.
- `courier_profiles`: datos operativos y estado de habilitación.
- `courier_verification_cases`: expediente, estado, método y decisión.
- `courier_verification_documents`: metadatos y ruta privada del objeto, nunca URL pública.
- `courier_verification_events`: historial de revisión, solicitudes y decisión.
- `orders`, `order_assignments`, `order_events`: ciclo operativo.
- `payments`, `ledger_entries`, `courier_payouts`: finanzas y liquidaciones.
- `admin_audit_logs`: actor, acción, recurso, fecha y metadatos mínimos.

No duplicar innecesariamente los datos del proveedor OAuth. Usar UUID de Supabase Auth como identificador interno estable. No guardar imágenes binarias en columnas PostgreSQL; guardar el objeto en Storage y metadatos/ruta en tablas con acceso restringido.

## 6. Geolocalización

Activar PostGIS cuando se implemente la búsqueda por distancia o cobertura. Guardar coordenadas con tipo espacial adecuado y definir SRID de forma consistente. No inferir una dirección exacta a partir de coordenadas aproximadas ni activar rastreo permanente. La ubicación del repartidor solo se comparte durante una entrega activa y conforme a permisos y política de privacidad.

## 7. Seguridad obligatoria

- RLS habilitado en todas las tablas accesibles desde clientes.
- Políticas de mínimo privilegio y pruebas negativas por rol.
- Sin service-role key en cliente.
- Sin documentos KYC en buckets públicos.
- Sin permisos basados solo en valores locales o claims no confiables.
- MFA para cuentas administrativas cuando esté disponible y configurado.
- Registro de auditoría para aprobación/rechazo, cambios de rol, suspensión y acciones financieras.
- Límites de solicitudes, validación de entradas e idempotencia para operaciones sensibles.
- Separación de proyectos/credenciales por entorno (local/test/staging/production).
- Secretos solo en el gestor de secretos del entorno.
- Backups y política de retención definidos antes de producción.

## 8. Variables de entorno

El agente puede crear un `.env.example` con nombres y valores vacíos/placeholder no secretos, por ejemplo:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL` (servidor)
- `SUPABASE_SERVICE_ROLE_KEY` (solo servidor; nunca exponer con prefijo público)
- credenciales OAuth configuradas en Supabase Dashboard
- secretos de Edge Functions/proveedores externos

No introducir credenciales reales en Git. No inventar valores ni marcar un proveedor OAuth como operativo sin probar el flujo en un entorno configurado.

## 9. Reglas de implementación para el agente

1. Inspeccionar el repositorio y sus dependencias antes de cambiar código.
2. Diseñar primero migraciones, RLS y pruebas de autorización.
3. No implementar una pantalla que simule una operación backend inexistente.
4. No dar por terminado Google/Microsoft OAuth sin callback, sesión y pruebas reales.
5. No dar por terminado PostGIS hasta probar consultas geoespaciales.
6. No dar por protegidos documentos hasta probar acceso permitido y denegado.
7. No crear buckets, tablas, proveedores OAuth o funciones ficticias en documentación de estado: distinguir claramente diseño de configuración real.
8. Registrar cualquier desviación de esta decisión en un ADR y solicitar aprobación antes de introducir Firebase u otro backend paralelo.

## 10. Criterios de aceptación

- Cliente puede autenticarse con Google en entorno configurado.
- Administrador previamente autorizado puede autenticarse con Microsoft.
- Un usuario no puede elevar su propio rol.
- Repartidor no aprobado no puede aceptar pedidos ni acceder a funciones operativas.
- Un cliente no puede leer perfiles/documentos de otros usuarios.
- Un documento KYC no es accesible mediante URL pública.
- Acceso temporal a un documento exige autorización y expira.
- RLS bloquea consultas cruzadas entre usuarios/roles.
- Las migraciones recrean el esquema desde cero en un entorno limpio.
- No hay claves privilegiadas en bundle, repositorio o logs.

**Estado de implementación:** esta decisión documenta la arquitectura objetivo. No implica que Supabase esté configurado, que OAuth esté conectado, que existan tablas/buckets ni que las pruebas hayan pasado.
