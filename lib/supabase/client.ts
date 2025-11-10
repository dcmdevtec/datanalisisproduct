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

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please check your .env.local file.'
    )
  }

  // Crear la instancia una sola vez
  supabaseInstance = createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        // CRÍTICO: Desactivar revalidación automática para evitar recargas
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        // Esta es la clave para evitar recargas al cambiar de pestaña
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
      global: {
        headers: {
          'x-application-name': 'datanalisis-app',
        },
      },
    }
  )

  return supabaseInstance
}

// Exportar la instancia singleton
export const supabase = createClient()
export default supabase
