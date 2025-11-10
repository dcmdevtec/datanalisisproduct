"use client"

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import supabase from '@/lib/supabase/client'
import { useCleanup } from '@/lib/hooks/use-cleanup'
import type { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

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
  const { clearAllSessionData } = useCleanup()
  const router = useRouter()

  // Memoizar la función de sign out
  const handleSignOut = useCallback(async () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('👋 Signing out...')
      }
      await supabase.auth.signOut()
      setUser(null)
      clearAllSessionData()
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }, [clearAllSessionData, router])

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
      
      if (data.user) {
        setUser(data.user)
      }
    } catch (error) {
      console.error('❌ Error signing in:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Obtener sesión inicial
    setLoading(true)
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Initial session:', session?.user?.email || 'No user')
      }
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch(error => {
      console.error('Error getting initial session:', error)
      setUser(null)
      setLoading(false)
    })

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔄 Auth state changed:', event, session?.user?.email || 'No user')
        }
        
        // Solo actualizar el usuario si realmente cambió
        setUser(prevUser => {
          const newUser = session?.user ?? null
          // Evitar actualizaciones innecesarias
          if (prevUser?.id === newUser?.id) {
            return prevUser
          }
          return newUser
        })
        
        setLoading(false)
        
        // Solo redirigir en sign out explícito
        if (event === 'SIGNED_OUT') {
          if (process.env.NODE_ENV === 'development') {
            console.log('👋 Sesión cerrada - Redirigiendo al login')
          }
          clearAllSessionData()
          router.push('/login')
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [clearAllSessionData, router])

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
