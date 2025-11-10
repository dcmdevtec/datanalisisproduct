import { useEffect, useState } from 'react'
import supabase from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

/**
 * Hook para obtener el usuario actual de Supabase
 * Usa la instancia singleton del cliente
 */
export function useSupabaseUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Obtener usuario inicial
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    // Escuchar cambios
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}

/**
 * Hook para obtener el cliente de Supabase
 * Siempre retorna la misma instancia singleton
 */
export function useSupabase() {
  return supabase
}
