/**
 * Pantalla de inicio de sesión real (Supabase Auth). La consola NO ofrece
 * registro público: las cuentas administrativas las crea o invita el
 * administrador principal (README sección 12, reglas 3 y 5). Los mensajes
 * de error visibles salen del diccionario de idiomas (README sección 9).
 */
import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SesionActiva, ResultadoSesion } from "../auth";
import { iniciarSesion } from "../auth";
import { MensajeError } from "../componentes";
import { SelectorIdioma, useIdioma } from "../idiomas";

export function PantallaLogin({
  cliente,
  alIniciar,
}: {
  readonly cliente: SupabaseClient;
  readonly alIniciar: (sesion: SesionActiva) => void;
}) {
  const { t } = useIdioma();
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setOcupado(true);
    try {
      const resultado: ResultadoSesion = await iniciarSesion(cliente, correo, contrasena);
      if (resultado.tipo === "ok") {
        alIniciar(resultado.sesion);
      } else {
        setError(resultado.clave !== null ? t(resultado.clave) : resultado.mensaje);
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="pantalla-centrada">
      <section className="tarjeta">
        <h1>{t("login_titulo")}</h1>
        <p className="nota">{t("login_nota")}</p>
        <form onSubmit={(e) => void enviar(e)}>
          <label>
            {t("correo")}
            <input
              type="email"
              autoComplete="username"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
            />
          </label>
          <label>
            {t("contrasena")}
            <input
              type="password"
              autoComplete="current-password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              required
            />
          </label>
          <MensajeError mensaje={error} />
          <button className="accion" type="submit" disabled={ocupado}>
            {ocupado ? t("comprobando") : t("iniciar_sesion")}
          </button>
        </form>
      </section>
      <div className="selector-centrado">
        <SelectorIdioma />
      </div>
    </div>
  );
}
