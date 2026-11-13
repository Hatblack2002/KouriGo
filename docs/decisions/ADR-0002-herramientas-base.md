# ADR-0002: Herramientas base del monorepo y pipeline de verificación

- **Estado:** Aceptado
- **Fecha:** 2026-11-13
- **Responsable:** Producto KouriGo (autorización en sesión del 2026-11-13); ejecución técnica: agente responsable técnico
- **Ámbito:** infraestructura de desarrollo, calidad y CI

## Contexto

El README (sección 17) exige un pipeline reproducible con instalación reproducible, verificación de formato, lint, análisis de tipos, pruebas unitarias, pruebas de integración que no requieran secretos de producción, build y análisis de dependencias/secretos. El repositorio no tenía código ni configuración: esta decisión fija las herramientas de partida (README sección 10 pide validar la propuesta antes de fijar dependencias).

## Decisión

- Monorepo con **npm workspaces** (gestor elegido por el responsable del producto en sesión; sin herramientas adicionales). Lockfile `package-lock.json` versionado para instalación reproducible.
- **TypeScript 5** en modo estricto (`strict`, `noUncheckedIndexedAccess`) con módulos NodeNext.
- **Vitest** para pruebas unitarias del dominio (`packages/domain`).
- **ESLint 9** (configuración plana) + **typescript-eslint** para lint.
- **Prettier** para formato determinista.
- Verificación de base de datos en CI con **PostgreSQL 16 + PostGIS 3.4** (imagen `postgis/postgis:16-3.4`) como service container de GitHub Actions: allí se aplican las migraciones y se ejecutan pruebas SQL de autorización con casos positivos y negativos por rol.
- **gitleaks** para análisis de secretos en el historial completo.
- Emulación mínima de Supabase Auth (`database/ci/0000_emulacion_supabase_auth.sql`) únicamente para probar RLS fuera de Supabase. No se aplica al proyecto real de Supabase.

## Consecuencias

**Positivas**
- Pipeline completo que no requiere secretos de producción (README sección 17.6).
- Las reglas de negocio de pedidos quedan probadas dos veces: en el dominio TypeScript y en la base de datos (trigger SQL), con pruebas que demuestran denegación y permiso por rol.
- Reproducibilidad garantizada por lockfile e imagen de base de datos fijada.

**Obligaciones**
- Mantener sincronizados los pares de transiciones de `packages/domain/src/transiciones.ts` y del trigger `validar_transicion_pedido` en `database/migrations/`.
- Todo código nuevo debe pasar el pipeline completo antes de considerarse entregado (README sección 23).

## Alternativas consideradas

- **pnpm / yarn:** descartados por decisión del responsable del producto (npm) y por simplicidad operativa.
- **Jest:** Vitest cubre el mismo caso de uso con menos configuración en proyectos TypeScript ESM.
- **Probar RLS solo contra Supabase:** descartado porque exigiría secretos de producción en CI y perdería reproducibilidad local; la emulación permite probar la lógica de autorización sin secretos.

## Revisión

Reabrir esta decisión si el número de paquetes o la duración del CI lo justifican (por ejemplo, migrar a pnpm), documentando un nuevo ADR.
