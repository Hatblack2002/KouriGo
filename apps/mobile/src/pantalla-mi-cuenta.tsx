/**
 * Pantalla «Mi cuenta» del CLIENTE (decisión del fundador 2026-11-15):
 * edición COMPLETA del perfil desde la APK — foto + teléfono SOLO formato
 * Haití (+509, 8 dígitos) + nombre completo + departamento + ville +
 * código postal + número de casa (formato local «#113»).
 *
 * Todo es editable a favor del usuario y se guarda en `profiles` bajo RLS
 * («perfiles_actualizar_propio»: solo la propia fila). La foto sube por la
 * Edge Function `subir-imagen` (contexto avatar; el proveedor de imágenes
 * queda camuflado: la app solo recibe public_id + URL de entrega y jamás
 * muestra ni nombra la cadena).
 *
 * La misma información prellena la dirección de entrega al crear un pedido
 * (componerDireccionEntrega en pantalla-nuevo-pedido).
 */
import { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as ImagePicker from "expo-image-picker";
import { Boton, CampoTexto, MensajeError, COLORES } from "./components";
import { leerConfiguracionPublica } from "./configuracion";
import { invocarFuncion } from "./funciones";
import {
  DEPARTAMENTOS_HAITI,
  asegurarPerfilPropio,
  componerDireccionEntrega,
  guardarAvatarPerfil,
  guardarPerfilEdicion,
  type DatosPerfilEdicion,
  type FilaPerfil,
} from "./perfil";
import { texto, type Idioma } from "./i18n";

interface RespuestaSubida {
  readonly public_id?: string;
  readonly url?: string;
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORES.grisFondo,
  },
  contenido: {
    padding: 16,
    paddingBottom: 40,
  },
  botonVolver: {
    alignSelf: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  textoVolver: {
    color: COLORES.verde,
    fontWeight: "700",
    fontSize: 14,
  },
  titulo: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORES.grafito,
    marginBottom: 12,
  },
  tarjeta: {
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    backgroundColor: COLORES.blanco,
  },
  filaAvatar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORES.grisFondo,
    borderWidth: 1,
    borderColor: COLORES.borde,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImagen: {
    width: "100%",
    height: "100%",
  },
  avatarInicial: {
    fontSize: 30,
    fontWeight: "800",
    color: COLORES.grisTexto,
  },
  columnaAvatar: {
    flex: 1,
    gap: 4,
  },
  etiquetaCampo: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORES.grafito,
    marginTop: 12,
    marginBottom: 6,
  },
  ayuda: {
    fontSize: 12,
    color: COLORES.grisTexto,
    marginTop: 4,
  },
  selector: {
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: COLORES.blanco,
  },
  selectorVacio: {
    borderColor: COLORES.error,
  },
  textoSelector: {
    fontSize: 14,
    color: COLORES.grafito,
  },
  textoSelectorVacio: {
    color: COLORES.grisTexto,
  },
  fondoModal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 24,
  },
  tarjetaModal: {
    backgroundColor: COLORES.blanco,
    borderRadius: 14,
    padding: 8,
    maxHeight: 420,
  },
  opcionDepartamento: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  textoOpcion: {
    fontSize: 14,
    color: COLORES.grafito,
  },
  tituloModal: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORES.grafito,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  exito: {
    color: COLORES.verdeOscuro,
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 8,
  },
});

interface Props {
  readonly idioma: Idioma;
  readonly cliente: SupabaseClient;
  readonly correo: string | null;
  /** Recarga la tarjeta de perfil de la concha tras guardar. */
  readonly alGuardado: () => void;
  readonly alVolver: () => void;
}

function telefonoVisible(perfil: FilaPerfil): string {
  if (perfil.phone === null || perfil.phone.trim().length === 0) {
    return "";
  }
  // Muestra el formato internacional separado: +509 3714 1234
  const limpio = perfil.phone.replace(/[^\d+]/g, "");
  const local = limpio.startsWith("+509") ? limpio.slice(4) : limpio.replace(/^509/, "");
  return `+509 ${local.slice(0, 4)} ${local.slice(4)}`.trim();
}

export function PantallaMiCuenta({ idioma, cliente, correo, alGuardado, alVolver }: Props) {
  const [perfil, setPerfil] = useState<FilaPerfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avisoExito, setAvisoExito] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [ville, setVille] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [numeroCasa, setNumeroCasa] = useState("");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  useEffect(() => {
    let activo = true;
    void (async () => {
      // Autocura: si el usuario aún no tiene fila en `profiles` (registrado
      // con una versión anterior de la app) se crea aquí mismo y se usa la
      // fila real; el id nunca vuelve a ser vacío.
      const resultado = await asegurarPerfilPropio(cliente);
      if (!activo) {
        return;
      }
      setCargando(false);
      if (resultado.tipo !== "ok") {
        setError(resultado.mensaje);
        return;
      }
      const datos = resultado.datos;
      setPerfil(datos);
      setNombre(datos?.full_name ?? "");
      setTelefono(telefonoVisible(datos ?? ({} as FilaPerfil)));
      setDepartamento(datos?.departamento ?? "");
      setVille(datos?.ville ?? "");
      setCodigoPostal(datos?.codigo_postal ?? "");
      setNumeroCasa(datos?.numero_casa ?? "");
    })();
    return () => {
      activo = false;
    };
  }, [cliente]);

  async function subirFoto(): Promise<void> {
    setError(null);
    setAvisoExito(null);
    try {
      const permiso = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (!permiso.granted) {
        const pedido = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!pedido.granted) {
          setError(texto(idioma, "err_foto_leida"));
          return;
        }
      }
      const seleccion = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
        exif: false,
      });
      if (seleccion.canceled) {
        return;
      }
      const activoFoto = seleccion.assets?.[0];
      const contenido = activoFoto?.base64;
      if (!activoFoto || contenido === null || contenido === undefined) {
        setError(texto(idioma, "err_foto_leida"));
        return;
      }
      const mime = activoFoto.mimeType ?? "image/jpeg";
      const archivo = `data:${mime};base64,${contenido}`;
      setSubiendoFoto(true);
      const { data: datosSesion } = await cliente.auth.getSession();
      const token = datosSesion.session?.access_token;
      if (typeof token !== "string" || token.length === 0) {
        setSubiendoFoto(false);
        setError(texto(idioma, "error_red"));
        return;
      }
      const configuracion = leerConfiguracionPublica();
      const respuesta = await invocarFuncion<RespuestaSubida>(
        configuracion,
        token,
        "subir-imagen",
        { contexto: "avatar", archivo },
      );
      setSubiendoFoto(false);
      if (!respuesta.ok || respuesta.datos === null) {
        setError(respuesta.mensajeError ?? texto(idioma, "err_foto_leida"));
        return;
      }
      const publicId = respuesta.datos.public_id;
      const urlEntrega = respuesta.datos.url;
      if (
        typeof publicId !== "string" ||
        publicId.length === 0 ||
        typeof urlEntrega !== "string" ||
        urlEntrega.length === 0
      ) {
        setError(texto(idioma, "err_foto_leida"));
        return;
      }
      let fila = perfil;
      if (fila === null) {
        const asegurado = await asegurarPerfilPropio(cliente);
        if (asegurado.tipo !== "ok") {
          setError(asegurado.mensaje);
          return;
        }
        fila = asegurado.datos;
        setPerfil(fila);
      }
      const guardado = await guardarAvatarPerfil(cliente, fila.id, publicId, urlEntrega);
      if (guardado.tipo !== "ok") {
        setError(guardado.mensaje);
        return;
      }
      setAvisoExito(texto(idioma, "cambios_guardados"));
      alGuardado();
    } catch (fallo) {
      setSubiendoFoto(false);
      setError(texto(idioma, "err_foto_leida"));
      console.error("[kourigo] avatar:", String(fallo));
    }
  }

  async function guardar(): Promise<void> {
    setError(null);
    setAvisoExito(null);
    // Autocura: si la fila del perfil aún no existe se crea aquí mismo.
    let fila = perfil;
    if (fila === null) {
      const asegurado = await asegurarPerfilPropio(cliente);
      if (asegurado.tipo !== "ok") {
        setError(asegurado.mensaje);
        return;
      }
      fila = asegurado.datos;
      setPerfil(fila);
    }
    const datos: DatosPerfilEdicion = {
      nombreCompleto: nombre,
      telefono,
      departamento,
      ville,
      codigoPostal,
      numeroCasa,
    };
    const resultado = await guardarPerfilEdicion(cliente, fila.id, idioma, datos);
    if (resultado.tipo !== "ok") {
      setError(resultado.mensaje);
      return;
    }
    setAvisoExito(texto(idioma, "cambios_guardados"));
    alGuardado();
  }

  const inicial = nombre.trim().length > 0 ? nombre.trim().charAt(0).toUpperCase() : "";

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
      <Pressable onPress={alVolver} style={estilos.botonVolver}>
        <Text style={estilos.textoVolver}>← {texto(idioma, "volver")}</Text>
      </Pressable>
      <Text style={estilos.titulo}>{texto(idioma, "mi_cuenta")}</Text>
      {error !== null ? <MensajeError mensaje={error} /> : null}
      {avisoExito !== null ? <Text style={estilos.exito}>{avisoExito}</Text> : null}

      <View style={estilos.tarjeta}>
        <Text style={estilos.etiquetaCampo}>{texto(idioma, "campo_foto")}</Text>
        <View style={estilos.filaAvatar}>
          <View style={estilos.avatar}>
            {perfil?.avatar_url ? (
              <Image
                source={{ uri: perfil.avatar_url }}
                style={estilos.avatarImagen}
                resizeMode="cover"
              />
            ) : (
              <Text style={estilos.avatarInicial}>{inicial}</Text>
            )}
          </View>
          <View style={estilos.columnaAvatar}>
            <Boton
              textoBoton={
                subiendoFoto ? texto(idioma, "subiendo_foto") : texto(idioma, "cambiar_foto")
              }
              alPulsar={() => {
                void subirFoto();
              }}
              deshabilitado={subiendoFoto || cargando}
              secundario={true}
            />
            <Text style={estilos.ayuda}>{correo ?? ""}</Text>
          </View>
        </View>
      </View>

      <View style={estilos.tarjeta}>
        <CampoTexto
          etiqueta={texto(idioma, "nombre_completo")}
          valor={nombre}
          alCambiar={setNombre}
        />
        <CampoTexto
          etiqueta={texto(idioma, "campo_telefono")}
          valor={telefono}
          alCambiar={setTelefono}
          numerico={true}
        />
        <Text style={estilos.ayuda}>{texto(idioma, "ayuda_telefono")}</Text>

        <Text style={estilos.etiquetaCampo}>{texto(idioma, "campo_departamento")}</Text>
        <Pressable
          onPress={() => setModalAbierto(true)}
          style={[estilos.selector, departamento.length === 0 ? estilos.selectorVacio : null]}
        >
          <Text
            style={[
              estilos.textoSelector,
              departamento.length === 0 ? estilos.textoSelectorVacio : null,
            ]}
          >
            {departamento.length > 0 ? departamento : texto(idioma, "elegir_departamento")}
          </Text>
        </Pressable>

        <CampoTexto etiqueta={texto(idioma, "campo_ville")} valor={ville} alCambiar={setVille} />
        <CampoTexto
          etiqueta={texto(idioma, "campo_codigo_postal")}
          valor={codigoPostal}
          alCambiar={setCodigoPostal}
          numerico={true}
        />
        <CampoTexto
          etiqueta={texto(idioma, "campo_casa")}
          valor={numeroCasa}
          alCambiar={setNumeroCasa}
        />
        <Text style={estilos.ayuda}>{texto(idioma, "ayuda_casa")}</Text>

        <View style={{ marginTop: 16 }}>
          <Boton
            textoBoton={texto(idioma, "guardar")}
            alPulsar={() => {
              void guardar();
            }}
            deshabilitado={cargando}
          />
        </View>
      </View>

      <View style={estilos.tarjeta}>
        <Text style={{ fontSize: 13, color: COLORES.grisTexto }}>
          {texto(idioma, "direccion_precargada")}
        </Text>
        <Text style={{ fontSize: 14, fontWeight: "700", color: COLORES.grafito, marginTop: 6 }}>
          {componerDireccionEntrega({
            numero_casa: numeroCasa,
            ville,
            departamento,
          }) || "—"}
        </Text>
      </View>

      <Modal visible={modalAbierto} transparent={true} animationType="fade">
        <Pressable style={estilos.fondoModal} onPress={() => setModalAbierto(false)}>
          <Pressable style={estilos.tarjetaModal}>
            <Text style={estilos.tituloModal}>{texto(idioma, "elegir_departamento")}</Text>
            <ScrollView>
              {DEPARTAMENTOS_HAITI.map((opcion) => (
                <Pressable
                  key={opcion}
                  style={estilos.opcionDepartamento}
                  onPress={() => {
                    setDepartamento(opcion);
                    setModalAbierto(false);
                  }}
                >
                  <Text style={estilos.textoOpcion}>{opcion}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
