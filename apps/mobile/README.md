# KouriGo — App móvil (Etapa 4)

Aplicación cliente en **React Native + Expo + TypeScript** dentro del monorepo npm. Autenticación real contra **Supabase Auth** y creación de pedidos conectada al **backend real** (PostgREST bajo RLS + Edge Function `transicion-pedido`). El modo repartidor y la consola administrativa se implementan en etapas posteriores (`docs/product/plan-etapas.md`).

## Qué incluye (Etapa 4)

- **Autenticación real:** registro público como cliente (`signUp`, con aviso si el proyecto exige confirmación de correo), inicio y cierre de sesión, restauración de sesión persistida (`AsyncStorage`) y suscripción a cambios de sesión. El rol nunca se decide en el cliente.
- **Perfil propio:** creación de `profiles` y `customer_profiles` vía RLS (`perfiles_insertar_propio`).
- **Crear pedido:** borrador real (`orders` + `order_items`) con tipo `delivery` o `assisted_purchase` (Achte pou mwen + livre), artículos con cantidad y precio estimado, notas, moneda y tarifa de servicio **sin valores por defecto** (decisiones pendientes del fundador, README sección 22).
- **Confirmar / cancelar:** transiciones del cliente (`draft->pending`, cancelaciones) aplicadas **siempre** por la Edge Function real `transicion-pedido`; los botones disponibles salen de la matriz compartida `@kourigo/domain` (la misma que impone el trigger SQL).
- **Lista y detalle:** pedidos propios (RLS: un cliente no ve pedidos ajenos), artículos, tarifa y línea de eventos (`order_events`).
- **Interfaz bilingüe kreyòl/français** (README sección 9) con estados de carga, error y recarga manual.
- **Bienvenida con idioma al frente** (decisión del fundador, 2026-11-13): la primera pantalla muestra la marca, el héroe con el eslogan y el selector Français/Kreyòl; el francés entra primero y la elección se guarda en el dispositivo (AsyncStorage) y se restaura al arrancar.
- **Identidad visual según la maqueta aprobada (2026-11-13)**: verde profundo, tarjetas blancas con bordes suaves, chips de estado coloreados según el estado REAL del pedido y línea de tiempo real de `order_events` en el detalle. Sin imágenes decorativas ni datos simulados.

## Qué NO incluye (todavía)

- Pagos (etapa 6; nada se presenta como pago real, README sección 6), notificaciones push, modo repartidor, consola administrativa, iPhone (sin ruta gratuita: TestFlight exige la Apple Developer Program de pago) y publicación en tiendas (el APK de prueba ya se compila en Actions, ver "APK de prueba (Android)").
- **Google Sign-In** (requisito README sección 12.1): NO existe todavía. El proveedor de Google **no está configurado** en el proyecto Supabase (verificado por API el 2026-11-13: solo email está activo) y el cliente OAuth de Google Cloud lo debe crear el fundador. Mientras tanto, el registro real es por e-mail; la app **no muestra** un botón de Google.
- **Catálogo de comercios, buscador, mapa en tiempo real, chat y calificaciones**: no existen en el MVP actual y **no se simulan** (sin datos falsos, regla 6); lo que muestra la app son pedidos reales del cliente autenticado.

## Configuración pública (sin claves privilegiadas)

La app compila con variables `EXPO_PUBLIC_*` (sección 8 de `docs/architecture/backend-supabase.md`):

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<clave anon del proyecto>
```

Son valores públicos por diseño: el acceso se controla con RLS y Edge Functions. La clave service-role **nunca** entra en la app, el bundle ni el repositorio. Sin estas variables, la app arranca mostrando un error de configuración claro (no inventa datos).

## APK de prueba (Android)

El workflow **`APK de prueba (Android)`** compila la app real dentro de GitHub Actions (`expo prebuild` + `gradlew assembleRelease`, sin emulador, sin EAS Build y sin coste) y publica el APK instalable en un release prerelease con etiqueta fija **`prueba-apk`**:

- **Descarga (enlace estable):** `https://github.com/Hatblack2002/KouriGo/releases/download/prueba-apk/KouriGo-prueba.apk` — cada build lo reemplaza. También queda como artefacto `apk-prueba-android` en cada ejecución del workflow.
- **Instalación:** abrir el enlace en un teléfono Android, descargar `KouriGo-prueba.apk` y aceptar la instalación de apps de origen desconocido cuando el sistema lo pida (Ajustes → Seguridad → Instalar apps desconocidas). No requiere tienda ni cuenta.
- **Firma:** el prebuild de Expo firma el release con su clave de prueba (`signingConfigs.debug`, plantilla oficial del SDK 58): instalable en cualquier teléfono, pero no válido para tiendas.
- **Configuración real:** el bundle Hermes lleva la URL y la clave anon reales de Supabase; el workflow verifica el anfitrión dentro del APK y la firma con `apksigner` antes de publicar, y se niega a publicar si algo falta.
- **Identificador:** `com.kourigo.app` (app.json `android.package`); actualizar el teléfono es instalar el nuevo APK encima.

## Verificación (GitHub Actions)

- **Workflow `CI`** — job `calidad`: formato (Prettier), lint (ESLint), análisis de tipos y pruebas unitarias de la app con Vitest (diccionarios, formato, validación del formulario, cliente de funciones, almacenamiento en memoria).
- **Workflow `App móvil (Expo)`**:
  - `build`: compila los paquetes internos y produce el **bundle Hermes real** con `expo export --platform android` (sin emulador y sin coste); el bundle se sube como artefacto de evidencia.
  - `pruebas-e2e`: ejecuta `apps/mobile/tests/e2e/proyecto-real.test.ts` contra el **proyecto real de Supabase** con secretos: usuarios reales por la Admin API, sesión con el mismo servicio de la app, pedido creado por RLS, transiciones por la función desplegada, aislamiento entre clientes y rechazos por rol/estado; la limpieza elimina usuarios y filas y falla si deja residuos. Sin secretos, la E2E se omite sola.
- **Workflow `APK de prueba (Android)`**: genera el proyecto Android con `expo prebuild`, compila el APK instalable con `gradlew assembleRelease` (clave de prueba de la plantilla), comprueba firma y configuración real dentro del bundle, y lo publica en el release `prueba-apk` (sección "APK de prueba (Android)").

## Estructura

```
apps/mobile/
├── App.tsx                      # raíz: sesión + navegación por estado + idioma
├── index.ts                     # registerRootComponent
├── app.json / babel.config.js   # configuración Expo (SDK 58; android.package com.kourigo.app)
├── src/
│   ├── configuracion.ts         # EXPO_PUBLIC_* (públicas por diseño)
│   ├── almacen-async-storage.ts # sesión persistente en el dispositivo
│   ├── almacen-memoria.ts       # adaptador para la E2E en Node (solo almacenamiento local)
│   ├── auth.ts                  # registro / inicio / cierre / perfil (Supabase Auth real)
│   ├── pedidos.ts               # crear/listar/detalle/eventos (RLS) + transiciones (Edge Function)
│   ├── funciones.ts             # cliente de Edge Functions con reintentos y errores reales
│   ├── i18n.ts                  # kreyòl + français (mismas claves)
│   ├── formato.ts               # importes (unidad mínima) y fechas localizadas
│   ├── components.tsx           # componentes reutilizables (verde/grafito, README sección 8)
│   └── pantalla-*.tsx           # autenticación, lista, nuevo pedido, detalle
├── android/                     # proyecto Android generado (expo prebuild, gitignore, solo en CI)
└── tests/
    ├── *.test.ts                # unitarias (Vitest)
    └── e2e/proyecto-real.test.ts # E2E contra el proyecto real (omitida sin secretos)
```

Decisión de arquitectura completa en `docs/decisions/ADR-0006-app-movil-expo.md`.
