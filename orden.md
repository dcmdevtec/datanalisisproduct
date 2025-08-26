// lib/supabase/client.ts - Para uso en el cliente
import { createBrowserClient } from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

// lib/supabase/server.ts - Para uso en el servidor
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createClient = async () => {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // El set de cookies puede fallar en middleware/server components
            // Esto es esperado y no debe romper la aplicación
          }
        },
      },
    }
  )
}

// lib/supabase/middleware.ts - Para uso en middleware
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export const createClient = (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  return { supabase, response: supabaseResponse }
}
// middleware.ts
import { createClient } from '@/lib/supabase/middleware'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  try {
    const { supabase, response } = createClient(request)

    // Refresh session si existe pero está expirada
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    // Si hay error en la sesión, limpia las cookies
    if (error) {
      const response = NextResponse.next()
      response.cookies.delete('sb-access-token')
      response.cookies.delete('sb-refresh-token')
      return response
    }

    // Rutas protegidas
    const protectedRoutes = ['/dashboard', '/profile', '/admin']
    const authRoutes = ['/login', '/signup', '/auth']
    
    const isProtectedRoute = protectedRoutes.some(route => 
      request.nextUrl.pathname.startsWith(route)
    )
    const isAuthRoute = authRoutes.some(route => 
      request.nextUrl.pathname.startsWith(route)
    )

    // Redirigir usuarios no autenticados de rutas protegidas
    if (isProtectedRoute && !session) {
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // Redirigir usuarios autenticados de rutas de auth
    if (isAuthRoute && session) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return response

  } catch (error) {
    // En caso de error, permite el acceso pero registra el error
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images in the public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
// hooks/useAuth.ts
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, AuthError, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Obtener sesión inicial
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          setSession(null)
          setUser(null)
        } else {
          setSession(session)
          setUser(session?.user ?? null)
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        setSession(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Escuchar cambios de auth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email)
      
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      // Refresh la página en ciertos eventos para sincronizar cookies
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        router.refresh()
      }
    })

    return () => subscription.unsubscribe()
  }, [router, supabase.auth])

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { error }
    } catch (error) {
      console.error('Sign in error:', error)
      return { error: error as AuthError }
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string) => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })
      return { error }
    } catch (error) {
      console.error('Sign up error:', error)
      return { error: error as AuthError }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })
      return { error }
    } catch (error) {
      console.error('Reset password error:', error)
      return { error: error as AuthError }
    }
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
import { AuthProvider } from '@/hooks/useAuth'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}