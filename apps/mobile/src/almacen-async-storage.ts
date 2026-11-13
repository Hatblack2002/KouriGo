/**
 * Adaptador de almacenamiento de sesión con AsyncStorage: la manera estándar
 * de persistir la sesión de Supabase Auth entre ejecuciones de la app móvil.
 * Este módulo solo se importa desde el bundle móvil (App.tsx); la prueba E2E
 * en Node usa el adaptador de memoria de almacen-memoria.ts.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AlmacenSesion } from "./almacen-memoria";

export function almacenAsyncStorage(): AlmacenSesion {
  return {
    getItem(clave) {
      return AsyncStorage.getItem(clave);
    },
    async setItem(clave, valor) {
      await AsyncStorage.setItem(clave, valor);
    },
    async removeItem(clave) {
      await AsyncStorage.removeItem(clave);
    },
  };
}

const CLAVE_IDIOMA = "kourigo.idioma";

/** Lee el idioma elegido en la bienvenida (null si nunca se eligió). */
export function leerIdiomaGuardado(): Promise<string | null> {
  return AsyncStorage.getItem(CLAVE_IDIOMA);
}

/** Guarda el idioma elegido para las siguientes ejecuciones. */
export async function guardarIdioma(idioma: string): Promise<void> {
  await AsyncStorage.setItem(CLAVE_IDIOMA, idioma);
}
