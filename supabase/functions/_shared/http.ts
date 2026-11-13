/**
 * Utilidades HTTP compartidas por las Edge Functions de la Etapa 3.
 *
 * Toda respuesta de error es JSON con una clave `error` y un mensaje en
 * español; nunca se exponen rastros internos al llamador.
 */
import { ErrorHttp } from "./config.ts";

export function respuestaJson(estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export function respuestaError(error: unknown): Response {
  if (error instanceof ErrorHttp) {
    return respuestaJson(error.estado, { error: error.message });
  }
  console.error("[kourigo] error inesperado:", error);
  return respuestaJson(500, {
    error: "Error interno de la operación privilegiada.",
  });
}

export function exigirMetodo(req: Request, metodo: "POST"): void {
  if (req.method !== metodo) {
    throw new ErrorHttp(405, `Solo se admite el método ${metodo}.`);
  }
}

export async function leerCuerpoJson(
  req: Request,
): Promise<Record<string, unknown>> {
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    throw new ErrorHttp(400, "El cuerpo de la solicitud debe ser JSON válido.");
  }
  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) {
    throw new ErrorHttp(400, "El cuerpo de la solicitud debe ser un objeto JSON.");
  }
  return cuerpo as Record<string, unknown>;
}

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function exigirUuid(
  cuerpo: Record<string, unknown>,
  campo: string,
): string {
  const valor = cuerpo[campo];
  if (typeof valor !== "string" || !PATRON_UUID.test(valor)) {
    throw new ErrorHttp(400, `El campo ${campo} debe ser un UUID válido.`);
  }
  return valor;
}

export function exigirCadena(
  cuerpo: Record<string, unknown>,
  campo: string,
  longitudMaxima = 1000,
): string {
  const valor = cadenaOpcional(cuerpo, campo, longitudMaxima);
  if (valor === null) {
    throw new ErrorHttp(400, `El campo ${campo} es obligatorio.`);
  }
  return valor;
}

export function cadenaOpcional(
  cuerpo: Record<string, unknown>,
  campo: string,
  longitudMaxima = 1000,
): string | null {
  const valor = cuerpo[campo];
  if (valor === undefined || valor === null) {
    return null;
  }
  if (typeof valor !== "string") {
    throw new ErrorHttp(400, `El campo ${campo} debe ser texto.`);
  }
  const limpio = valor.trim();
  if (limpio.length === 0) {
    return null;
  }
  if (limpio.length > longitudMaxima) {
    throw new ErrorHttp(
      400,
      `El campo ${campo} supera la longitud máxima de ${longitudMaxima} caracteres.`,
    );
  }
  return limpio;
}
