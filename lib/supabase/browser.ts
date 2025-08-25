import { createBrowserClient } from "@supabase/ssr"

// Configuración optimizada para mantener conexiones estables
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    // Configuración de autenticación optimizada
    auth: {
      // Mantener la sesión activa más tiempo
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // Evitar detección automática que puede causar recargas
      flowType: 'pkce', // Usar PKCE para mayor seguridad y estabilidad
      // Configurar tiempo de expiración del token
      storageKey: 'supabase-auth-token',
    },
    // Configuración de la base de datos
    db: {
      // Configurar esquema por defecto
      schema: 'public',
    },
    // Configuración global
    global: {
      // Headers personalizados para mantener conexión
      headers: {
        'X-Client-Info': 'supabase-js-browser',
        'Keep-Alive': 'timeout=300, max=1000',
      },
    },
    // Configuración de realtime
    realtime: {
      // Mantener conexión realtime activa
      params: {
        eventsPerSecond: 10,
      },
    },
  }
)

// Cliente optimizado para operaciones de solo lectura (caché)
export const supabaseReadOnly = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false, // No refrescar tokens para operaciones de solo lectura
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
  }
)

// Cliente para operaciones de escritura (con reconexión automática)
export const supabaseWrite = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'X-Client-Info': 'supabase-js-write',
        'Keep-Alive': 'timeout=300, max=1000',
      },
    },
  }
)
