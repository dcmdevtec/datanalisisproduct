// Configuración segura para build que evita problemas de Edge Runtime
import { createClient } from '@supabase/supabase-js'

// Configuración básica sin APIs de Node.js
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Cliente de Supabase compatible con Edge Runtime
export const createBuildSafeClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: false, // Deshabilitar persistencia en Edge Runtime
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'supabase-js-edge',
      },
    },
  })
}

// Función para verificar autenticación sin usar APIs de Node.js
export const checkAuthStatus = async (request: Request) => {
  try {
    const cookies = request.headers.get('cookie') || ''
    const hasAuthToken = cookies.includes('sb-access-token') || 
                        cookies.includes('sb-refresh-token') || 
                        cookies.includes('supabase-auth-token')
    
    return { isAuthenticated: hasAuthToken }
  } catch (error) {
    console.error('Error checking auth status:', error)
    return { isAuthenticated: false }
  }
}

// Función para limpiar cookies de autenticación
export const clearAuthCookies = () => {
  const cookies = [
    'sb-access-token',
    'sb-refresh-token', 
    'supabase-auth-token'
  ]
  
  return cookies.map(name => ({
    name,
    value: '',
    expires: new Date(0),
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const
  }))
}
