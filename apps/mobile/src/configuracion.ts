/**
 * Configuración pública de la aplicación móvil (sección 8 de
 * docs/architecture/backend-supabase.md): URL del proyecto y clave anon de
 * Supabase, inyectadas por Expo como variables EXPO_PUBLIC_* en tiempo de
 * compilación. La clave anon es pública por diseño; el acceso a datos se
 * controla con RLS en el backend. La clave service-role nunca aparece en
 * la app móvil.
 */
export interface ConfiguracionPublica {
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
}

export class ConfiguracionFaltanteError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ConfiguracionFaltanteError";
  }
}

/**
 * Lee la configuración pública del bundle. Las referencias literales a
 * process.env.EXPO_PUBLIC_* son reemplazadas por Expo en la compilación;
 * en pruebas (Node) se leen del entorno real.
 */
export function leerConfiguracionPublica(): ConfiguracionPublica {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const clave = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (
    typeof url !== "string" ||
    url.length === 0 ||
    typeof clave !== "string" ||
    clave.length === 0
  ) {
    throw new ConfiguracionFaltanteError(
      "La app no tiene configuración pública: faltan EXPO_PUBLIC_SUPABASE_URL y " +
        "EXPO_PUBLIC_SUPABASE_ANON_KEY en el bundle. Configure el entorno antes de compilar.",
    );
  }
  return { supabaseUrl: url.replace(/\/+$/, ""), supabaseAnonKey: clave };
}
