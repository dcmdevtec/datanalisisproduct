import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/client'
import { SupabaseLogger } from '@/lib/supabase/logging'

// Componente que se ejecuta en el servidor para inicializar Supabase (2025)
export async function SupabaseSSRInit() {
  try {
    const cookieStore = cookies()
    const supabase = await createServerSupabaseClient(cookieStore)

    // Verificar la sesión en el servidor usando getUser() (más seguro)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      // Usar el sistema de logging centralizado
      SupabaseLogger.logConditionally('Error en SSR Supabase', userError, 'warn')
    } else if (user) {
      SupabaseLogger.success('Usuario autenticado en SSR', user.email)
      
      // También verificar la sesión para compatibilidad
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        SupabaseLogger.logConditionally('Warning en getSession SSR', sessionError, 'warn')
      } else if (session) {
        SupabaseLogger.success('Sesión válida en SSR para usuario', user.email)
      }
    } else {
      // No hay usuario autenticado - esto es normal en SSR
      SupabaseLogger.info('No hay usuario autenticado en SSR (normal)')
    }

    // Retornar null ya que este componente solo se ejecuta en el servidor
    return null
  } catch (err) {
    SupabaseLogger.error('Error crítico en SSR Supabase', err)
    return null
  }
}

// Componente que se ejecuta en el cliente para sincronizar con el servidor
export function SupabaseClientSync() {
  // Este componente se ejecuta en el cliente para sincronizar el estado
  // con la información obtenida del servidor
  return null
}
