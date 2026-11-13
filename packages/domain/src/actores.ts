/**
 * Actores que pueden intervenir en los cambios de estado de un pedido.
 * El actor debe determinarse SIEMPRE en el servidor a partir de la sesión
 * autenticada; nunca se acepta el rol enviado por la aplicación cliente
 * (README sección 12, regla 15).
 */
export const ACTORES = ["cliente", "repartidor", "administrador", "sistema"] as const;

export type Actor = (typeof ACTORES)[number];

export function esActor(valor: unknown): valor is Actor {
  return typeof valor === "string" && (ACTORES as readonly string[]).includes(valor);
}
