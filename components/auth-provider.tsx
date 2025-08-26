"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import type { Session, User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { useRedirectDebug } from "@/hooks/use-redirect-debug"
import { getRedirectRoute } from "@/lib/middleware/config"

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const supabase = createClient()
  
  // Debug de redirecciones
  useRedirectDebug()

  useEffect(() => {
    // Obtener sesión inicial
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Error getting session:', error)
        } else {
          console.log('🔄 Sesión inicial obtenida:', session ? 'Sí' : 'No')
          setSession(session)
          setUser(session?.user ?? null)
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listener de cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, session?.user?.email)
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)

        // Solo redirigir en eventos específicos y evitar bucles
        if (event === 'SIGNED_IN' && session && !isRedirecting) {
          setIsRedirecting(true)
          
          // Obtener el rol del usuario
          const userRole = session.user.user_metadata?.role || session.user.app_metadata?.role
          
          // Verificar si hay una redirección pendiente
          const redirectedFrom = searchParams.get('redirectedFrom')
          const targetRoute = redirectedFrom || getRedirectRoute(userRole)
          
          console.log('✅ Usuario autenticado:', {
            email: session.user.email,
            role: userRole,
            redirectedFrom,
            targetRoute
          })
          
          toast({
            title: "Inicio de sesión exitoso",
            description: `Bienvenido, ${session.user.email}`,
          })
          
          // Usar router.replace en lugar de push para evitar bucles
          console.log('🚀 Redirigiendo a:', targetRoute)
          router.replace(targetRoute)
          
          // Reset flag después de un momento
          setTimeout(() => setIsRedirecting(false), 2000)
        }

        // Manejar logout
        if (event === 'SIGNED_OUT') {
          setIsRedirecting(false)
          console.log('👋 Usuario desconectado')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase, router, searchParams, toast, isRedirecting])

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      console.log('🔐 Iniciando login para:', email)
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      console.log('✅ Login exitoso')
      
      // NO redirigir aquí, dejar que onAuthStateChange maneje todo
      console.log('⏳ Esperando que onAuthStateChange maneje la redirección...')
      
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al iniciar sesión"
      console.error('❌ Error en login:', message)
      toast({ title: "Error", description: message, variant: "destructive" })
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setIsRedirecting(true)
      console.log('🚪 Cerrando sesión...')
      await supabase.auth.signOut()
      
      // Limpiar el estado inmediatamente
      setUser(null)
      setSession(null)
      
      router.push("/login")
      toast({ title: "Sesión cerrada correctamente" })
    } catch (error) {
      console.error('❌ Error al cerrar sesión:', error)
      toast({
        title: "Error al cerrar sesión",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      })
    } finally {
      setIsRedirecting(false)
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}