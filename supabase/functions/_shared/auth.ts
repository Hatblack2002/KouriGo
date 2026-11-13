/**
 * Autenticación y autorización de las Edge Functions de la Etapa 3.
 *
 * La identidad del llamador se verifica SIEMPRE contra el servicio de Auth
 * de Supabase con el JWT recibido (nunca se acepta un identificador enviado
 * por el cliente) y el rol se comprueba contra user_roles leyendo con el
 * propio JWT del llamador: la política RLS `roles_leer_propio_o_admin` solo
 * muestra a cada usuario sus propias filas, de modo que un impostor no ve
 * ninguna y la comprobación es segura.
 */
import type { Entorno } from "./config.ts";
import { ErrorHttp } from "./config.ts";
import { rest } from "./rest.ts";

export interface SesionLlamador {
  readonly usuarioId: string;
  readonly jwt: string;
}

interface UsuarioAuth {
  readonly id?: string;
}

interface FilaRol {
  readonly user_id?: string;
}

export async function verificarJwt(
  entorno: Entorno,
  req: Request,
): Promise<SesionLlamador> {
  const autorizacion = req.headers.get("Authorization");
  if (!autorizacion || !autorizacion.toLowerCase().startsWith("bearer ")) {
    throw new ErrorHttp(401, "La sesión es obligatoria para esta operación.");
  }
  const jwt = autorizacion.slice("bearer ".length).trim();
  if (jwt.length === 0) {
    throw new ErrorHttp(401, "La sesión es obligatoria para esta operación.");
  }
  const respuesta = await fetch(`${entorno.url}/auth/v1/user`, {
    headers: {
      "apikey": entorno.anonKey,
      "Authorization": `Bearer ${jwt}`,
    },
  });
  if (!respuesta.ok) {
    throw new ErrorHttp(401, "La sesión no es válida o ya expiró.");
  }
  const usuario = (await respuesta.json()) as UsuarioAuth;
  if (!usuario.id) {
    throw new ErrorHttp(401, "La sesión no es válida o ya expiró.");
  }
  return { usuarioId: usuario.id, jwt };
}

export async function esAdministrador(
  entorno: Entorno,
  sesion: SesionLlamador,
): Promise<boolean> {
  const filas = await rest<FilaRol[]>(
    entorno,
    "GET",
    `/rest/v1/user_roles?user_id=eq.${sesion.usuarioId}&role=eq.admin&status=eq.active&select=user_id`,
    null,
    { jwt: sesion.jwt },
  );
  return Array.isArray(filas) && filas.length > 0;
}

export async function exigirAdministrador(
  entorno: Entorno,
  sesion: SesionLlamador,
): Promise<void> {
  if (!(await esAdministrador(entorno, sesion))) {
    throw new ErrorHttp(403, "Esta operación requiere el rol de administrador.");
  }
}
