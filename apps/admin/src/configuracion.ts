/**
 * Configuración pública de la consola administrativa (sección 8 de
 * docs/architecture/backend-supabase.md): URL del proyecto y clave anon de
 * Supabase, inyectadas por Vite como variables VITE_* en tiempo de
 * compilación. La clave anon es pública por diseño; el acceso a los datos
 * lo impone RLS en el backend y la consola no contiene NUNCA la clave
 * service-role.
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
 * import.meta.env.VITE_* son reemplazadas por Vite en la compilación; en
 * las pruebas (Node) se leen del objeto real de import.meta.env, que
 * vitest permite sobreescribir.
 */
export function leerConfiguracionPublica(): ConfiguracionPublica {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const clave = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (
    typeof url !== "string" ||
    url.length === 0 ||
    typeof clave !== "string" ||
    clave.length === 0
  ) {
    throw new ConfiguracionFaltanteError(
      "La consola no tiene configuración pública: faltan VITE_SUPABASE_URL y " +
        "VITE_SUPABASE_ANON_KEY en el bundle. Configure el entorno antes de compilar.",
    );
  }
  return { supabaseUrl: url.replace(/\/+$/, ""), supabaseAnonKey: clave };
}
