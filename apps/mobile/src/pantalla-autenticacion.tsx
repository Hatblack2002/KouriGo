/**
 * Pantallas de autenticación (README sección 2.1: registrarse, iniciar y
 * cerrar sesión). Llaman al servicio real de Supabase Auth; los errores se
 * muestran traducidos y nunca se ocultan (criterio del MVP: la aplicación
 * muestra estados de error).
 */
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Aviso,
  Boton,
  CampoTexto,
  MensajeError,
  Titulo,
  TituloSeccion,
  COLORES,
} from "./components";
import { iniciarSesion, registrarCliente, type SesionActiva } from "./auth";
import type { Idioma } from "./i18n";
import { texto } from "./i18n";

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORES.blanco,
    padding: 20,
  },
  encabezado: {
    marginTop: 40,
    marginBottom: 24,
  },
  eslogan: {
    fontSize: 14,
    color: COLORES.grisTexto,
    marginTop: 4,
  },
  bloque: {
    marginTop: 16,
  },
});

interface PropsBase {
  readonly idioma: Idioma;
  readonly cliente: SupabaseClient;
  readonly alIniciar: (sesion: SesionActiva) => void;
  /** Mensaje informativo sobre un proceso previo (p. ej. confirmación pendiente). */
  readonly aviso?: string | null;
}

export function PantallaInicioSesion({ idioma, cliente, alIniciar, aviso }: PropsBase) {
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
    <ScrollView style={estilos.contenedor}>
      <View style={estilos.encabezado}>
        <Titulo>{texto(idioma, "nombre_app")}</Titulo>
        <Text style={estilos.eslogan}>{texto(idioma, "eslogan")}</Text>
      </View>
      <TituloSeccion>{texto(idioma, "iniciar_sesion")}</TituloSeccion>
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
    <ScrollView style={estilos.contenedor}>
      <View style={estilos.bloque}>
        <Titulo>{texto(idioma, "crear_cuenta")}</Titulo>
      </View>
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
    </ScrollView>
  );
}
