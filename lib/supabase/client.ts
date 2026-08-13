import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Instancia singleton del cliente de Supabase
let supabaseInstance: SupabaseClient<Database> | null = null

export function createClient(): SupabaseClient<Database> {
  // Si ya existe una instancia, retornarla (patrón singleton)
  if (supabaseInstance) {
    return supabaseInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // CORRECCIÓN (2026-08-12): antes lanzaba throw en el nivel del módulo.
  // Si las env vars faltan en producción (ej. un deploy sin .env), el import
  // del cliente crasheaba TODAS las páginas con "client-side exception while loading".
  // Ahora usamos placeholders seguros — Supabase rechaza las peticiones con
  // "invalid URL" en vez de crashear el proceso de React durante la hidratación.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      '[supabase/client] NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY no están definidas. ' +
      'Revisa las variables de entorno en producción.'
    )
    // Retornar un cliente no-funcional en vez de tirar la app entera.
    // Esto permite que la UI cargue y muestre el error de login en vez de
    // la pantalla de crash genérica de Next.js.
    supabaseInstance = createBrowserClient<Database>(
      'https://placeholder.supabase.co',
      'placeholder-anon-key',
    ) as unknown as SupabaseClient<Database>
    return supabaseInstance
  }

  // Crear la instancia una sola vez
  supabaseInstance = createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
      global: {
        headers: {
          'x-application-name': 'datanalisis-app',
        },
      },
    }
  ) as unknown as SupabaseClient<Database>

  return supabaseInstance
}

// Exportar la instancia singleton
export const supabase = createClient()
// Aliases for compatibility with hooks that expect separate read/write clients
// (In this app there's only one client; use these names to satisfy imports)
export const supabaseReadOnly = supabase
export const supabaseWrite = supabase
export default supabase
