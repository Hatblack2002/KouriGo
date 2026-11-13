# ADR-0004: Flujo de verificación de repartidores (expediente y Storage)

- **Estado:** Aceptado
- **Fecha:** 2026-11-13
- **Ámbito:** verificación de repartidores (Etapa 2)
- **Especificación:** docs/operations/courier-identity-verification.md; docs/architecture/backend-supabase.md (secciones 4 y 5)

## Contexto

La Etapa 2 exige tablas de expediente, buckets privados de Storage con políticas, flujo de revisión y pruebas de acceso permitido/denegado en CI. La migración 0001 ya creó `courier_profiles` con `verification_status` protegido por trigger, pero sin un expediente que sustente el flujo de revisión (documentos, decisiones, auditoría).

## Decisión

1. **`courier_verification_cases` es la fuente de la verdad del flujo.** El candidato crea el caso en `draft`, carga documentos y presenta (`submitted`); la administración revisa y decide. La matriz de transiciones vive en el trigger `validar_transicion_expediente` (SQL) y en `packages/domain/src/expediente.ts` (TypeScript), espejadas como en la Etapa 1.
2. **`courier_profiles.verification_status` pasa a ser una proyección** mantenida por el trigger `sincronizar_estado_verificacion`; así `public.repartidor_aprobado()` (0001) sigue operando sin cambios. El candidato ya no puede cambiar `verification_status` directamente: el trigger `proteger_estado_verificacion` (v2, esta migración) lo bloquea. La sincronización se marca con la GUC local `app.sincronizacion_expediente`, que se limpia en la misma transacción para no favorecer escrituras directas del candidato.
3. **Requisitos de decisión:** toda decisión (`approved`, `rejected`, `suspended`, `reverification_required`, `expired`) y la solicitud de información exigen `decision_reason`; aprobar exige método de verificación y revisión iniciada; programar exige método. La decisión fuerza `decision_by = auth.uid()` (auditoría, sección 5 y 10 de la especificación).
4. **Storage privado con carpeta por usuario:** bucket `courier-identity-private` (nombre propuesto en backend-supabase.md sección 4), creado por migración con `ON CONFLICT DO NOTHING`. Las políticas de `storage.objects` permiten al candidato escribir/leer solo en su carpeta (`storage.foldername(name)[1] = auth.uid()`) y al admin solo leer; no hay política de escritura administrativa ni de acceso público. Los metadatos del documento (`courier_verification_documents`) denormalizan `courier_user_id` y exigen bucket y carpeta propios en `WITH CHECK`.
5. **Auditoría mínima:** `courier_verification_events` registra `status_changed`, `document_uploaded` y `document_reviewed` con `safe_metadata` (actor, motivo y método; nunca números de documento). El candidato lee los eventos de su propio caso (los motivos de rechazo y solicitud de información le son visibles, sección 10).
6. **Un expediente activo por repartidor:** índice parcial único que excluye `rejected` y `expired` (quedan como historial y permiten nueva solicitud o reverificación).
7. **CI:** `database/ci/0001_emulacion_supabase_storage.sql` emula el esquema `storage` (buckets, objects, `foldername`) SOLO en CI; en el proyecto real el esquema ya existe. `database/tests/run.sh` aplica ahora todas las emulaciones y migraciones por glob; `scripts/verificar_supabase.sh` ejecuta todas las pruebas por glob.

## Consecuencias

**Positivas**
- Flujo de revisión real, auditable y probado: positivo y negativo por rol (candidato, repartidor, cliente, revisor y sistema), en CI y contra el proyecto real de Supabase.
- Reglas de la especificación impuestas en base de datos, no solo en la aplicación: presentación con documentos, sin autoaprobación, decisiones con motivo/método/revisor, suspensión inmediata.

**Riesgos y obligaciones**
- La elegibilidad de entregas motorizadas según `driver_license` (especificación sección 2) queda pendiente de lógica de negocio en la Etapa 3; la migración no automatiza rechazos por licencia.
- Los signed URLs de corta duración se emiten en la Etapa 3 (Edge Functions); hoy la lectura depende de las políticas de `storage.objects`.
- Retención y eliminación segura de documentos: pendientes antes de producción (sección 7 de la especificación).

## Alternativas consideradas

- **Aprobar escribiendo directamente `courier_profiles.verification_status`:** rechazada; sin expediente no hay documentos, decisiones ni auditoría, y contradice las secciones 5, 6 y 9 de la especificación.
- **Carpeta pública o Cloudinary para documentos:** prohibido por backend-supabase.md sección 4 y la especificación sección 7.
- **Múltiples expedientes activos:** rechazado; un solo caso activo evita decisiones contradictorias y simplifica el panel administrativo.
