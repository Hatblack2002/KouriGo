/**
 * Variables de entorno públicas que Expo inyecta en el bundle
 * (EXPO_PUBLIC_*). Son valores públicos por diseño (sección 8 de
 * docs/architecture/backend-supabase.md): la URL del proyecto y la clave
 * anon de Supabase. La clave service-role NUNCA se declara ni usa aquí.
 */
declare var process: {
  env: {
    readonly EXPO_PUBLIC_SUPABASE_URL?: string;
    readonly EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  };
};
