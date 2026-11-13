/**
 * Pantallas de autenticación (README sección 2.1: registrarse, iniciar y
 * cerrar sesión). Llaman al servicio real de Supabase Auth; los errores se
 * muestran traducidos y nunca se ocultan (criterio del MVP: la aplicación
 * muestra estados de error). Estilo según la maqueta aprobada: tarjetas
 * blancas, botón verde grande y vuelta a la bienvenida. Sin botón de
 * Google: el proveedor no está configurado en Supabase y no se simula.
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Aviso,
  Boton,
  CampoTexto,
  MensajeError,
  Titulo,
  COLORES,
} from "./components";
import { iniciarSesion, registrarCliente, type SesionActiva } from "./auth";
import type { Idioma } from "./i18n";
import { texto } from "./i18n";

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORES.blanco,
  },
  contenido: {
    padding: 20,
    paddingBottom: 40,
  },
  botonVolver: {
    alignSelf: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  textoVolver: {
    color: COLORES.verde,
    fontWeight: "700",
    fontSize: 14,
  },
  encabezado: {
    marginTop: 8,
    marginBottom: 20,
  },
  eslogan: {
    fontSize: 14,
    color: COLORES.grisTexto,
    marginTop: 4,
  },
  tarjeta: {
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 14,
    padding: 16,
    backgroundColor: COLORES.blanco,
  },
  enlace: {
    color: COLORES.verde,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 14,
    paddingVertical: 16,
  },
});

interface PropsBase {
  readonly idioma: Idioma;
  readonly cliente: SupabaseClient;
  readonly alIniciar: (sesion: SesionActiva) => void;
  readonly alVolver: () => void;
  /** Mensaje informativo sobre un proceso previo (p. ej. confirmación pendiente). */
  readonly aviso?: string | null;
}

function EnlaceVolver({ idioma, alVolver }: { readonly idioma: Idioma; readonly alVolver: () => void }) {
  return (
    <Pressable onPress={alVolver} style={estilos.botonVolver}>
      <Text style={estilos.textoVolver}>← {texto(idioma, "volver")}</Text>
    </Pressable>
  );
}

export function PantallaInicioSesion({ idioma, cliente, alIniciar, alVolver, aviso }: PropsBase) {
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    setCargando(true);
    setError(null);
    const resultado = await iniciarSesion(cliente, correo.trim(), contrasena);
    setCargando(false);
    if (resultado.tipo === "ok") {
      alIniciar(resultado.sesion);
      return;
    }
    setError(texto(idioma, resultado.clave));
  }

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
      <EnlaceVolver idioma={idioma} alVolver={alVolver} />
      <View style={estilos.encabezado}>
        <Titulo>{texto(idioma, "iniciar_sesion")}</Titulo>
        <Text style={estilos.eslogan}>{texto(idioma, "eslogan")}</Text>
      </View>
      <View style={estilos.tarjeta}>
        <CampoTexto etiqueta={texto(idioma, "correo")} valor={correo} alCambiar={setCorreo} />
        <CampoTexto
          etiqueta={texto(idioma, "contrasena")}
          valor={contrasena}
          alCambiar={setContrasena}
          secreta={true}
        />
        {aviso !== null && aviso !== undefined ? <Aviso mensaje={aviso} /> : null}
        {error !== null ? <MensajeError mensaje={error} /> : null}
        <Boton
          textoBoton={cargando ? texto(idioma, "cargando") : texto(idioma, "iniciar_sesion")}
          alPulsar={() => {
            void enviar();
          }}
          deshabilitado={cargando}
        />
      </View>
    </ScrollView>
  );
}

interface PropsRegistro extends PropsBase {
  readonly alPendienteConfirmacion: () => void;
}

export function PantallaRegistro({
  idioma,
  cliente,
  alIniciar,
  alVolver,
  alPendienteConfirmacion,
}: PropsRegistro) {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    setCargando(true);
    setError(null);
    const resultado = await registrarCliente(cliente, correo.trim(), contrasena, nombre.trim());
    setCargando(false);
    if (resultado.tipo === "ok") {
      alIniciar(resultado.sesion);
      return;
    }
    if (resultado.tipo === "pendiente_confirmacion") {
      alPendienteConfirmacion();
      return;
    }
    setError(texto(idioma, resultado.clave));
  }

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
      <EnlaceVolver idioma={idioma} alVolver={alVolver} />
      <View style={estilos.encabezado}>
        <Titulo>{texto(idioma, "crear_cuenta")}</Titulo>
        <Text style={estilos.eslogan}>{texto(idioma, "eslogan")}</Text>
      </View>
      <View style={estilos.tarjeta}>
        <CampoTexto
          etiqueta={texto(idioma, "nombre_completo")}
          valor={nombre}
          alCambiar={setNombre}
        />
        <CampoTexto etiqueta={texto(idioma, "correo")} valor={correo} alCambiar={setCorreo} />
        <CampoTexto
          etiqueta={texto(idioma, "contrasena")}
          valor={contrasena}
          alCambiar={setContrasena}
          secreta={true}
        />
        {error !== null ? <MensajeError mensaje={error} /> : null}
        <Boton
          textoBoton={cargando ? texto(idioma, "cargando") : texto(idioma, "crear_cuenta")}
          alPulsar={() => {
            void enviar();
          }}
          deshabilitado={cargando}
        />
      </View>
    </ScrollView>
  );
}
