/**
 * Adaptador de almacenamiento de sesión en memoria.
 *
 * Es el almacenamiento que la prueba E2E usa en Node (donde AsyncStorage
 * nativo no existe). NO simula ninguna operación del backend: únicamente
 * guarda la cadena de sesión en memoria, igual que AsyncStorage guarda la
 * misma cadena en el dispositivo. La sesión, su validez y todos los datos
 * siguen siendo reales (Supabase Auth).
 */
export interface AlmacenSesion {
  getItem(clave: string): Promise<string | null>;
  setItem(clave: string, valor: string): Promise<void>;
  removeItem(clave: string): Promise<void>;
}

export function almacenMemoria(): AlmacenSesion {
  const valores = new Map<string, string>();
  return {
    async getItem(clave) {
      return valores.get(clave) ?? null;
    },
    async setItem(clave, valor) {
      valores.set(clave, valor);
    },
    async removeItem(clave) {
      valores.delete(clave);
    },
  };
}
