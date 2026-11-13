/**
 * Reparto de la tarifa de servicio entre el repartidor y KouriGo
 * (README sección 5).
 *
 * El 40/60 es una hipótesis comercial PENDIENTE de aprobación del fundador;
 * por eso el porcentaje siempre se recibe como parámetro y nunca se fija
 * aquí. El porcentaje se aplica únicamente sobre la tarifa de
 * servicio/entrega: nunca sobre el valor de los productos comprados,
 * propinas, impuestos, reembolsos ni dinero entregado para compras.
 *
 * Los importes se manejan como enteros en la unidad mínima de la moneda
 * (README sección 11): nunca coma flotante para dinero.
 */
export interface RepartoComision {
  readonly tarifaServicio: number;
  readonly porcentajeRepartidor: number;
  readonly montoRepartidor: number;
  readonly montoPlataforma: number;
}

export class ComisionInvalidaError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ComisionInvalidaError";
  }
}

/**
 * Calcula el reparto de una tarifa de servicio ya confirmada.
 *
 * Redondeo determinista: el repartidor recibe el redondeo hacia arriba
 * (mitad superior) y la plataforma absorbe la diferencia, de modo que el
 * reparto siempre suma exactamente la tarifa, sin céntimos perdidos.
 */
export function calcularRepartoTarifaServicio(
  tarifaServicio: number,
  porcentajeRepartidor: number,
): RepartoComision {
  if (!Number.isSafeInteger(tarifaServicio) || tarifaServicio < 0) {
    throw new ComisionInvalidaError(
      "La tarifa de servicio debe ser un entero no negativo en la unidad mínima de la moneda.",
    );
  }
  if (tarifaServicio > Number.MAX_SAFE_INTEGER / 100) {
    throw new ComisionInvalidaError("La tarifa de servicio excede el límite seguro de cálculo.");
  }
  if (
    !Number.isFinite(porcentajeRepartidor) ||
    porcentajeRepartidor < 0 ||
    porcentajeRepartidor > 100
  ) {
    throw new ComisionInvalidaError("El porcentaje del repartidor debe estar entre 0 y 100.");
  }

  const montoRepartidor = Math.round((tarifaServicio * porcentajeRepartidor) / 100);
  const montoPlataforma = tarifaServicio - montoRepartidor;

  return { tarifaServicio, porcentajeRepartidor, montoRepartidor, montoPlataforma };
}
