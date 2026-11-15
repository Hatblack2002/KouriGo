# Perfiles, imágenes y verificación — definición de producto

> Estado (2026-11-15): credenciales recibidas y configuradas; la Edge
> Function `subir-imagen` está implementada, desplegada al runtime y
> probada E2E (ver sección 8). Siguiente paso: migración 0006 y la APK.

---

## 1. Principio de camuflaje: nada de proveedores visibles

Todo el producto debe verse como una empresa profesional (KouriGo), sin
rastros de los servicios técnicos que usamos por detrás.

**Regla obligatoria para toda imagen o archivo que el usuario suba o vea:**

1. La aplicación móvil y la consola admin **nunca muestran** texto, logo,
   marca de agua ni URL de Cloudinary. El usuario solo ve la imagen
   renderizada; las URLs reales viven dentro del código y la base de datos,
   nunca en pantalla.
2. La app **jamás habla directamente con Cloudinary** ni contiene claves.
   Toda subida pasa por nuestra Edge Function (dominio propio de Supabase:
   `ouowxtpntqptsajqgjud.supabase.co/functions/v1/subir-imagen`), que
   autentica al usuario, valida el archivo, firma la subida y devuelve
   nuestra referencia interna (`public_id`).
3. La base de datos guarda `public_id`, no URLs largas. Las URLs se
   construyen en el servidor con las transformaciones fijas
   (`f_auto,q_auto,w_800` para fotos de producto y avatar).
4. **Camuflaje total del dominio (fase 2, gratis):** si algún día se
   requiere que ni siquiera el tráfico revele el origen, se añade un proxy
   `/img/:public_id` servido por nuestra Edge Function; así el dominio que
   ve el teléfono es siempre el nuestro. Hoy, en una app móvil, la URL no
   es visible para el usuario en ninguna pantalla. (El dominio propio en
   Cloudinary, tipo `img.kourigo.com`, es una función de plan pago; el
   proxy logra el mismo efecto sin costo.)
5. **Lo que NUNCA va a Cloudinary:** los documentos de identidad de los
   repartidores (CIN, pasaporte, selfie, licencia, certificado de buena
   conducta) se quedan en el bucket privado `courier-identity-private` de
   Supabase, con cifrado y RLS. Cloudinary es solo para imágenes de
   catálogo y avatares.

## 2. Lo que el fundador debe dar de Cloudinary (lista exacta)

Se abren los 3 valores desde el panel: <https://console.cloudinary.com>
(Dashboard → *Account Details* / *Settings → Access Keys*):

| # | Dato | Dónde se encuentra | Clasificación | Destino |
|---|------|--------------------|---------------|---------|
| 1 | **Cloud name** (p. ej. `dxyz123ab`) | Panel principal | Público, sin riesgo | Configuración de la app (solo lectura de imágenes) |
| 2 | **API Key** | Settings → Access Keys | Semiprivado | GitHub Secret |
| 3 | **API Secret** | Settings → Access Keys (botón "reveal") | **Privado** | GitHub Secret `CLOUDINARY_URL` |

El formato completo que pide GitHub Secret es una sola línea:

```
cloudinary://<API_KEY>:<API_SECRET>@<CLOUD_NAME>
```

**Cómo entregarlo:** basta pegar aquí en el chat los 3 valores; se cargan
con `gh secret set` al repositorio y no se guardan en ningún archivo ni en
el código. Alternativa: configurar el secret directamente en GitHub
(Settings → Secrets and variables → Actions → New repository secret, nombre
`CLOUDINARY_URL`).

**No se necesita configurar nada más en el panel de Cloudinary.** Las
subidas serán firmadas (server-side), no hace falta "unsigned upload
preset". Más adelante, si el fundador quiere, se puede activar "Strict
transformations" para mayor control; no bloquea nada hoy.

## 3. Perfil del CLIENTE (editable desde la APK)

El cliente edita su perfil desde la APK, en **Mi cuenta → Editar perfil**:

| Campo | Tipo | Regla |
|-------|------|-------|
| Foto | Imagen | Subida camuflada (sección 1), carpeta `avatares/`; opcional |
| Nombre completo | Texto | Obligatorio |
| Teléfono | Texto | **Solo formato Haití: 11 dígitos empezando por 509** (o 8 dígitos que la app completa con +509); primer dígito del número 2, 3 o 4 |
| Departamento | Lista | Los 10 departamentos de Haití (Ouest, Artibonite, Centre, Grand'Anse, Nippes, Nord, Nord-Est, Nord-Ouest, Sud, Sud-Est) |
| Ville | Texto | Comuna/ciudad; texto libre (en el lanzamiento solo se entrega en comunas habilitadas del Ouest) |
| Código postal | Texto | Opcional |
| Número de casa | Texto | Formato local libre: la mayoría se apunta `#113`, `#42, Rue ...`, etc.; obligatorio para entregas |

**Todo es editable a favor del cliente en cualquier momento.**

**Uso principal:** cuando el cliente crea un pedido, la dirección de
entrega se **prellena automáticamente** con estos datos (departamento,
ville, número de casa y teléfono de contacto), editable en ese momento si
lo desea. Esa misma información es la que permite al repartidor llegar al
lugar.

**Almacenamiento:** columnas nuevas en la tabla `profiles` existente
(`departamento`, `ville`, `codigo_postal`, `numero_casa`, `avatar_url`,
`avatar_public_id`). Las políticas RLS existentes de `profiles` ya permiten
que cada usuario lea y actualice solo su propia fila.

## 4. Perfil del REPARTIDOR (modelo distinto, no es editable como el cliente)

El repartidor **no tiene el mismo formulario de edición** que el cliente.
Su perfil tiene dos partes con reglas opuestas:

### 4.1 Información de identidad — CONGELADA

Todo lo que envió al registrarse (CIN/pasaporte, selfie, licencia,
certificado de buena conducta, zona, placa) queda bloqueado tras el envío
(`submitted`). Nadie lo edita después salvo el equipo de verificación; si
el repartidor necesita cambiar un dato de identidad, abre una
re-verificación (`reverification_required`) y vuelve al mismo proceso.

### 4.2 Certificado e insignia — tras la aprobación del admin

Cuando el admin aprueba (`approved`), en el perfil del repartidor aparece:

- **Insignia de verificación** (check verde) **al lado del nombre**, en
  todas las pantallas donde el repartidor aparece: su propio perfil, la
  tarjeta ante el cliente, el seguimiento del pedido.
- **Certificado visible en su perfil**, que recoge la información de la
  verificación ya existente en la base de datos:
  - "Certificado de buena conducta" — estado del documento
    `certificate_good_conduct` (aceptado/rechazado/pendiente);
  - método de verificación (documental, videoconferencia o presencial);
  - fecha de la decisión (`decision_at`);
  - zona de trabajo y placa del vehículo;
  - estado del expediente (`approved`).

El certificado es una **vista**, no un documento nuevo: se construye con
los datos de `courier_profiles` y `courier_verification_cases` que ya
existen (migraciones 0002/0003). No se duplica información.

### 4.3 Lo que el repartidor SÍ puede cambiar

Solo lo operativo: disponibilidad (conectado/desconectado, ya existente).
Nada de identidad.

## 5. Inspección del repartidor por el cliente (solo lectura)

El cliente tiene derecho a **ver** el perfil de cualquier repartidor que se
le asigne o se le ofrezca para su entrega, y **no tiene permiso de
modificar nada**.

**Lo que el cliente ve** (pantalla de inspección, solo lectura):

- foto del repartidor;
- nombre + insignia de verificación;
- calificación y número de entregas (cuando existan);
- zona de trabajo;
- tipo/placa del vehículo;
- fecha de verificación y método (documental / videoconferencia / presencial).

**Lo que el cliente NUNCA ve:** documentos de identidad, motivos de
decisión, historial de verificación interno, datos de otros usuarios.

**Técnica:** función RPC `perfil_publico_repartidor(courier_user_id)` con
`SECURITY DEFINER` que devuelve únicamente la lista blanca de campos y solo
si el expediente está `approved`. El cliente no recibe acceso directo de
SELECT a `courier_profiles`; así los documentos y datos internos quedan
imposibles de leer desde el cliente, incluso manipulando la app.

**Componente:** se amplía `TarjetaPerfilRepartidor` (ya existe en la APK)
con la insignia y la navegación a la pantalla de inspección.

## 6. Mapa de secretos y permisos

| Secreto / dato | Dónde vive | Quién lo usa |
|----------------|-----------|--------------|
| `CLOUDINARY_URL` (key+secret+cloud) | GitHub Secrets → Edge Function `subir-imagen` | Solo servidor |
| `cloud_name` | Configuración pública de la app | Lectura de imágenes |
| `SUPABASE_ANON_KEY` | Build de la APK | Clientes (con RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub Secrets → Edge Functions | Solo servidor |
| Documentos de identidad | Bucket privado Supabase | Solo dueño y equipo de verificación |

## 7. Plan de implementación — un solo trabajo, 5 pasos verificables

1. **Migración 0006:** columnas de perfil cliente en `profiles` + RPC
   `perfil_publico_repartidor` + políticas RLS. Verificación: CI de base de
   datos verde. — **PENDIENTE**
2. **Edge Function `subir-imagen`:** autenticación Supabase; cliente sube
   solo su avatar (`avatares/<user_id>/`), admin sube solo catálogo
   (`catalogo/<categoria>/`); firma Cloudinary server-side; devuelve
   `public_id`. Verificación: pruebas de la función en CI. — **HECHO**
   (commit `01d3dc2` + `06a7c1b`; desplegada por el workflow
   `Supabase (proyecto real)`; runtime exige JWT; secret `CLOUDINARY_URL`
   configurado en GitHub Secrets y en el runtime de Supabase)
3. **APK — Mi cuenta editable:** pantalla con los 7 campos, validación
   +509, selector de departamento, subida de foto camuflada, y prellenado
   de la dirección al crear pedido. Verificación: APK nueva, cadenas de
   texto presentes en el bundle. — **PENDIENTE**
4. **APK — insignia + certificado + inspección:** insignia junto al nombre,
   certificado en el perfil del repartidor, vista de inspección para el
   cliente desde su pedido. Verificación: APK nueva. — **PENDIENTE**
5. **Consola admin — catálogo con fotos:** alta de productos con imagen,
   solo admin, todo camuflado. Verificación: consola en GitHub Pages.
   — **PENDIENTE**

Cada paso entra a `main` con su commit y se comprueba en GitHub Actions
antes de pasar al siguiente. Nada se declara terminado sin evidencia.

## 8. Evidencia de la verificación E2E del paso 2 (2026-11-15)

Prueba completa contra el proyecto real con un usuario de prueba creado y
eliminado en la misma prueba (no queda ningún dato falso):

| # | Escenario | Resultado |
|---|-----------|-----------|
| 1 | Catálogo sin rol admin | 403 "Solo un administrador puede agregar imágenes al catálogo" |
| 2 | Catálogo con rol admin | 200, `public_id = kourigo/catalogo/cat_electronique/pro-…` |
| 3 | URL de entrega (f_auto,q_auto) | HTTP 200, imagen renderizada |
| 4 | Avatar del propio usuario | 200, `public_id = kourigo/avatares/<user_id>/av-…` |
| 5 | Formato no admitido (PDF) | 400 "Formato no admitido: solo JPEG, PNG o WebP" |
| 6 | Limpieza | imágenes destruidas (result: ok), auditoría, rol y usuario de prueba eliminados |

Además: plan Cloudinary verificado Free con 2.72 % de créditos usados;
credenciales validadas contra `/ping` (`status: ok`); sin token la función
responde 401 (verificado por el workflow en el runtime).
