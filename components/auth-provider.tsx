"use client"

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCleanup } from '@/lib/hooks/use-cleanup'
import type { User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const { clearAllSessionData } = useCleanup()

  // Memoizar la función de limpieza para evitar recreaciones
  const handleSignOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      clearAllSessionData()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }, [supabase.auth, clearAllSessionData])

  // Memoizar la función de sign in
  const handleSignIn = useCallback(async (email: string, password: string) => {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔐 Attempting sign in for:', email)
      }
      setLoading(true)
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Sign in successful:', data.user?.email)
      }
      
      // Establecer el usuario inmediatamente para que el hook de redirección funcione
      if (data.user) {
        setUser(data.user)
        // No esperar - el hook useAuthRedirect se encargará de la redirección
      }
    } catch (error) {
      console.error('❌ Error signing in:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [supabase.auth])

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Error getting session:', error)
        }
        if (process.env.NODE_ENV === 'development') {
          console.log('🔄 Initial session:', session?.user?.email || 'No user')
        }
        setUser(session?.user ?? null)
      } catch (error) {
        console.error('Error in getInitialSession:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔄 Auth state changed:', event, session?.user?.email || 'No user')
        }
        setUser(session?.user ?? null)
        setLoading(false)
        
        // El middleware se encargará de la redirección automática
        if (event === 'SIGNED_IN' && session?.user) {
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ Login exitoso - El middleware manejará la redirección')
          }
        }
        
        if (event === 'SIGNED_OUT') {
          if (process.env.NODE_ENV === 'development') {
            console.log('👋 Sesión cerrada - El middleware manejará la redirección')
          }
          // Limpiar todos los datos de sesión cuando se cierra sesión
          clearAllSessionData()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase, clearAllSessionData])

  // Memoizar el contexto para evitar re-renders innecesarios
  const contextValue = useMemo(() => ({
    user,
    loading,
    signIn: handleSignIn,
    signOut: handleSignOut,
  }), [user, loading, handleSignIn, handleSignOut])

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}