/**
 * Formato de importes y fechas de la consola (README sección 9: formatos
 * localizados). Los importes viven como enteros en la unidad mínima de la
 * moneda (README sección 11); el código de moneda viene SIEMPRE de la fila
 * del pedido — la consola no fija moneda ni conversión (decisión pendiente
 * del fundador, README sección 22).
 */

/** Muestra un importe entero (unidad mínima) con su código de moneda. */
export function formatearDinero(monto: number | null, moneda: string): string {
  if (monto === null || !Number.isSafeInteger(monto) || monto < 0) {
    return `— ${moneda}`;
  }
  return `${(monto / 100).toFixed(2)} ${moneda}`;
}

/** Fecha y hora en formato español; si Intl falla, devuelve el ISO original. */
export function formatearFecha(iso: string | null): string {
  if (iso === null || iso.length === 0) {
    return "—";
  }
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) {
    return iso;
  }
  try {
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(fecha);
  } catch {
    return iso;
  }
}
