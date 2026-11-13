# ADR-0001: Supabase como backend principal

- **Estado:** Aprobado
- **Fecha:** 2026-11-12
- **Responsable:** Producto KouriGo
- **Ámbito:** arquitectura inicial

## Contexto

KouriGo necesita un backend transaccional para clientes, repartidores, verificación de identidad, pedidos, asignaciones, pagos, comisiones, liquidaciones, geolocalización y administración. Los datos presentan relaciones fuertes y requieren integridad referencial, consultas operativas y controles de acceso por rol.

## Decisión

Adoptar Supabase como backend principal inicial:

- PostgreSQL como base de datos relacional;
- PostGIS para capacidades geoespaciales;
- Supabase Auth para sesiones y proveedores OAuth;
- Google Sign-In para clientes;
- Microsoft Sign-In para administradores previamente autorizados;
- flujo de cuenta de repartidor separado con verificación obligatoria;
- Supabase Storage privado para cédulas, pasaportes, selfies KYC y evidencias privadas;
- Edge Functions para operaciones privilegiadas y validaciones de negocio;
- RLS como capa obligatoria de aislamiento de datos.

Cloudinary queda limitado a imágenes públicas de productos, comercios y marca. Firebase no se incorpora a la arquitectura inicial.

## Consecuencias

**Positivas**
- Un modelo SQL relacional para pedidos, usuarios y finanzas.
- Integridad referencial y consultas complejas.
- RLS y políticas de Storage integradas con la identidad.
- PostGIS disponible para consultas espaciales.
- Menos duplicación de sistemas de autenticación y datos.

**Costes y obligaciones**
- Se deben diseñar y probar políticas RLS y Storage; no se obtienen automáticamente por usar Supabase.
- OAuth requiere configuración real de proveedores, callbacks y secretos.
- La clave service-role debe permanecer exclusivamente en servidor.
- Se debe revisar disponibilidad, límites, coste, backups y región antes del piloto/producción.
- La decisión no implica que el backend esté implementado o desplegado.

## Alternativas consideradas

- **Firebase:** no elegido para la arquitectura inicial. Firestore es NoSQL y llevaría a duplicar o adaptar el modelo relacional de pedidos, asignaciones y ledger; no se justifica mantener dos backends.
- **Backend PostgreSQL autogestionado:** no elegido inicialmente por la carga operativa adicional que introduce.
- **Supabase + Firebase en paralelo:** rechazado por duplicar identidad, datos, permisos y observabilidad sin necesidad demostrada.

## Revisión

Reabrir esta decisión únicamente si un requisito medido de escala, disponibilidad, coste, cumplimiento o integración no puede satisfacerse razonablemente con Supabase. Toda sustitución o backend paralelo requiere un nuevo ADR y aprobación del responsable del producto.
