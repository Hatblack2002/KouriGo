/**
 * Reglas de validación para la creación de pedidos (README secciones 2.1
 * y 3). Son las mismas reglas que debe volver a aplicar el backend antes
 * de aceptar una solicitud. Los importes son enteros en la unidad mínima
 * de la moneda (README sección 11).
 */
export const TIPOS_PEDIDO = ["delivery", "assisted_purchase"] as const;

export type TipoPedido = (typeof TIPOS_PEDIDO)[number];

export interface ArticuloPedido {
  descripcion: string;
  cantidad: number;
  precioEstimado?: number;
}

export interface DatosCreacionPedido {
  tipo: TipoPedido;
  recogidaTexto: string;
  recogidaLat?: number;
  recogidaLon?: number;
  destinoTexto: string;
  destinoLat?: number;
  destinoLon?: number;
  notas?: string;
  contactoNombre?: string;
  contactoTelefono?: string;
  /** Requerido para compra asistida; entero en unidad mínima de la moneda. */
  presupuestoTotal?: number;
  items: readonly ArticuloPedido[];
}

const TEXTO_DIRECCION_MIN = 5;
const TEXTO_DIRECCION_MAX = 300;
const MAX_ITEMS = 20;
const PATRON_TELEFONO = /^[+0-9()\-\s]{6,20}$/;

function esEnteroNoNegativo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 0;
}

function validarCoordenada(
  valor: number | undefined,
  min: number,
  max: number,
  etiqueta: string,
  errores: string[],
): void {
  if (valor === undefined) {
    return;
  }
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor < min || valor > max) {
    errores.push(`${etiqueta} debe ser un número entre ${min} y ${max}, u omitirse.`);
  }
}

export function validarCreacionPedido(datos: DatosCreacionPedido): string[] {
  const errores: string[] = [];

  if (!(TIPOS_PEDIDO as readonly string[]).includes(datos.tipo)) {
    errores.push("El tipo de pedido debe ser 'delivery' o 'assisted_purchase'.");
  }

  const textoRecogida = (datos.recogidaTexto ?? "").trim();
  if (textoRecogida.length < TEXTO_DIRECCION_MIN || textoRecogida.length > TEXTO_DIRECCION_MAX) {
    errores.push(
      `El punto de recogida debe tener entre ${TEXTO_DIRECCION_MIN} y ${TEXTO_DIRECCION_MAX} caracteres.`,
    );
  }

  const textoDestino = (datos.destinoTexto ?? "").trim();
  if (textoDestino.length < TEXTO_DIRECCION_MIN || textoDestino.length > TEXTO_DIRECCION_MAX) {
    errores.push(
      `El punto de destino debe tener entre ${TEXTO_DIRECCION_MIN} y ${TEXTO_DIRECCION_MAX} caracteres.`,
    );
  }

  validarCoordenada(datos.recogidaLat, -90, 90, "La latitud de recogida", errores);
  validarCoordenada(datos.recogidaLon, -180, 180, "La longitud de recogida", errores);
  validarCoordenada(datos.destinoLat, -90, 90, "La latitud de destino", errores);
  validarCoordenada(datos.destinoLon, -180, 180, "La longitud de destino", errores);

  if ((datos.notas ?? "").length > 500) {
    errores.push("Las notas no pueden superar 500 caracteres.");
  }

  if (datos.contactoNombre !== undefined) {
    const nombre = datos.contactoNombre.trim();
    if (nombre.length < 2 || nombre.length > 80) {
      errores.push("El nombre de contacto debe tener entre 2 y 80 caracteres.");
    }
  }

  if (datos.contactoTelefono !== undefined && !PATRON_TELEFONO.test(datos.contactoTelefono)) {
    errores.push("El teléfono de contacto no tiene un formato válido.");
  }

  if (!Array.isArray(datos.items) || datos.items.length < 1) {
    errores.push("El pedido debe incluir al menos un artículo.");
  } else {
    if (datos.items.length > MAX_ITEMS) {
      errores.push(`El pedido no puede superar ${MAX_ITEMS} artículos.`);
    }
    datos.items.forEach((item, indice) => {
      const descripcion = (item.descripcion ?? "").trim();
      if (descripcion.length < 1 || descripcion.length > 300) {
        errores.push(
          `El artículo ${indice + 1} necesita una descripción de 1 a 300 caracteres.`,
        );
      }
      if (!esEnteroNoNegativo(item.cantidad) || item.cantidad < 1 || item.cantidad > 999) {
        errores.push(`El artículo ${indice + 1} debe tener una cantidad entera entre 1 y 999.`);
      }
      if (item.precioEstimado !== undefined && !esEnteroNoNegativo(item.precioEstimado)) {
        errores.push(
          `El precio estimado del artículo ${indice + 1} debe ser un entero no negativo (unidad mínima de la moneda).`,
        );
      }
    });
  }

  if (datos.tipo === "assisted_purchase" && !esEnteroNoNegativo(datos.presupuestoTotal)) {
    errores.push(
      "La compra asistida requiere un presupuesto total entero no negativo (unidad mínima de la moneda).",
    );
  }

  return errores;
}
