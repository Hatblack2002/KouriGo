/**
 * Aserciones mínimas para las pruebas Deno de las Edge Functions, sin
 * dependencias externas (las pruebas deben resolverse sin red).
 */

export function afirmar(condicion: boolean, mensaje: string): void {
  if (!condicion) {
    throw new Error(`FALLO DE PRUEBA: ${mensaje}`);
  }
}

export function afirmarIgual<T>(real: T, esperado: T, mensaje: string): void {
  const serializadoReal = JSON.stringify(real);
  const serializadoEsperado = JSON.stringify(esperado);
  if (serializadoReal !== serializadoEsperado) {
    throw new Error(
      `FALLO DE PRUEBA: ${mensaje} (real: ${serializadoReal}, esperado: ${serializadoEsperado})`,
    );
  }
}
