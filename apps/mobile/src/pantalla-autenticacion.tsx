/**
 * Pantallas reales de autenticación (README sección 2.1: registrarse, iniciar y
 * cerrar sesión). Llaman al servicio real de Supabase Auth; los errores se
 * muestran traducidos y nunca se ocultan (criterio del MVP: la aplicación
 * muestra estados de error). Estilo según la maqueta aprobada: tarjetas
 * blancas, botón verde grande y vuelta a la bienvenida. Sin botón de
 * Google: el proveedor no está configurado en Supabase y no se simula.
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Aviso, CampoTexto, MensajeError } from "./components";
import { iniciarSesion, registrarCliente, type SesionActiva } from "./auth";
import type { Idioma } from "./i18n";
import { texto } from "./i18n";
import {
  BanderaHaiti,
  BotonPrimario,
  COLORES,
  ESPACIADO,
  IconoUI,
  LogoKouriGo,
  RADIOS,
  SOMBRAS,
  TIPOGRAFIA,
} from "./ui";

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: COLORES.grisFondo,
  },
  contenido: {
    paddingHorizontal: ESPACIADO.lg,
    paddingTop: 52,
    paddingBottom: 40,
    gap: ESPACIADO.lg,
  },
  barraSuperior: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  botonVolver: {
    flexDirection: "row",
    alignItems: "center",
    gap: ESPACIADO.xs,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: RADIOS.sm,
    backgroundColor: COLORES.blanco,
    borderWidth: 1,
    borderColor: COLORES.borde,
  },
  textoVolver: {
    color: COLORES.verdeProfundo,
    fontWeight: "700",
    fontSize: 13,
  },
  marcaContenedor: {
    alignItems: "center",
    marginTop: ESPACIADO.xs,
  },
  encabezado: {
    gap: 4,
  },
  titulo: {
    ...TIPOGRAFIA.tituloSeccion,
    fontSize: 22,
    lineHeight: 28,
    color: COLORES.grafito,
  },
  eslogan: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORES.grisTexto,
  },
  tarjeta: {
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: RADIOS.lg,
    padding: ESPACIADO.lg,
    backgroundColor: COLORES.blanco,
    gap: ESPACIADO.xs,
    ...SOMBRAS.tarjeta,
  },
  botonWrapper: {
    marginTop: ESPACIADO.sm,
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

function CabeceraAutenticacion({
  idioma,
  alVolver,
}: {
  readonly idioma: Idioma;
  readonly alVolver: () => void;
}) {
  return (
    <>
      <View style={estilos.barraSuperior}>
        <Pressable
          onPress={alVolver}
          style={({ pressed }) => [estilos.botonVolver, pressed ? { opacity: 0.8 } : null]}
        >
          <IconoUI nombre="back" tamano={16} color={COLORES.verdeProfundo} />
          <Text style={estilos.textoVolver}>{texto(idioma, "volver")}</Text>
        </Pressable>
        <BanderaHaiti />
      </View>
      <View style={estilos.marcaContenedor}>
        <LogoKouriGo subtitulo={texto(idioma, "etiqueta_marca")} />
      </View>
    </>
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
    <ScrollView
      style={estilos.contenedor}
      contentContainerStyle={estilos.contenido}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <CabeceraAutenticacion idioma={idioma} alVolver={alVolver} />
      <View style={estilos.encabezado}>
        <Text style={estilos.titulo}>{texto(idioma, "iniciar_sesion")}</Text>
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
        <View style={estilos.botonWrapper}>
          <BotonPrimario
            etiqueta={cargando ? texto(idioma, "cargando") : texto(idioma, "iniciar_sesion")}
            alPulsar={() => {
              void enviar();
            }}
            deshabilitado={cargando}
            slotIconoDerecha={
              cargando ? undefined : (
                <IconoUI nombre="arrowRight" tamano={15} color={COLORES.blanco} />
              )
            }
          />
        </View>
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
    <ScrollView
      style={estilos.contenedor}
      contentContainerStyle={estilos.contenido}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <CabeceraAutenticacion idioma={idioma} alVolver={alVolver} />
      <View style={estilos.encabezado}>
        <Text style={estilos.titulo}>{texto(idioma, "crear_cuenta")}</Text>
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
        <View style={estilos.botonWrapper}>
          <BotonPrimario
            etiqueta={cargando ? texto(idioma, "cargando") : texto(idioma, "crear_cuenta")}
            alPulsar={() => {
              void enviar();
            }}
            deshabilitado={cargando}
            slotIconoDerecha={
              cargando ? undefined : (
                <IconoUI nombre="arrowRight" tamano={15} color={COLORES.blanco} />
              )
            }
          />
        </View>
      </View>
    </ScrollView>
  );
}
