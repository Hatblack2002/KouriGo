/**
 * Pantalla de inicio de sesión real (Supabase Auth). La consola NO ofrece
 * registro público: las cuentas administrativas las crea o invita el
 * administrador principal (README sección 12, reglas 3 y 5).
 */
import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SesionActiva, ResultadoSesion } from "../auth";
import { iniciarSesion } from "../auth";
import { MensajeError } from "../componentes";

export function PantallaLogin({
  cliente,
  alIniciar,
}: {
  readonly cliente: SupabaseClient;
  readonly alIniciar: (sesion: SesionActiva) => void;
}) {
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
        setError(resultado.mensaje);
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="pantalla-centrada">
      <section className="tarjeta">
        <h1>KouriGo — Consola administrativa</h1>
        <p className="nota">
          Acceso restringido al personal autorizado. Las cuentas administrativas se crean o invitan
          desde la administración principal; no existe registro público (README sección 12).
        </p>
        <form onSubmit={(e) => void enviar(e)}>
          <label>
            Correo
            <input
              type="email"
              autoComplete="username"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
            />
          </label>
          <label>
            Contraseña
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
            {ocupado ? "Comprobando…" : "Iniciar sesión"}
          </button>
        </form>
      </section>
    </div>
  );
}
