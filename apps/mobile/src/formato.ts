/**
 * Formato de importes y fechas (README sección 9: formatos localizados).
 * Los importes viven como enteros en la unidad mínima de la moneda
 * (README sección 11): HTG y USD usan dos decimales en su unidad menor
 * (centime/cent), así que se dividen entre 100 para mostrarlos.
 */
import type { Idioma } from "./i18n.js";

/** Muestra un importe entero (unidad mínima) con su código de moneda. */
export function formatearDinero(monto: number, moneda: string): string {
  if (!Number.isSafeInteger(monto) || monto < 0) {
    return `— ${moneda}`;
  }
  return `${(monto / 100).toFixed(2)} ${moneda}`;
}

const LOCALES: Record<Idioma, string> = {
  ht: "fr-HT",
  fr: "fr-FR",
};

/** Fecha y hora localizadas; si Intl falla, devuelve el ISO original. */
export function formatearFecha(iso: string, idioma: Idioma): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) {
    return iso;
  }
  try {
    return new Intl.DateTimeFormat(LOCALES[idioma], {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(fecha);
  } catch {
    return iso;
  }
}
