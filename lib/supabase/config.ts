// Configuración de Supabase para Next.js 2025
// Basado en la documentación oficial: https://supabase.com/docs/guides/auth/auth-helpers/nextjs

export const SUPABASE_CONFIG = {
  // URLs y claves
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  
  // Configuración de cookies
  cookies: {
    // Nombre de la cookie de sesión
    sessionName: 'sb-auth-token',
    // Tiempo de expiración en segundos
    expiryMargin: 300, // 5 minutos
    // Tiempo de refresh en segundos
    refreshMargin: 60, // 1 minuto
  },
  
  // Configuración de autenticación
  auth: {
    // Habilitar refresh automático de tokens
    autoRefreshToken: true,
    // Persistir sesión en localStorage
    persistSession: true,
    // Detectar sesión en subdominios
    detectSessionInUrl: true,
  },
  
  // Configuración de logging
  logging: {
    // Habilitar logs detallados en desarrollo
    enableVerbose: process.env.NODE_ENV === 'development',
    // Mostrar información sensible en logs
    showSensitiveInfo: process.env.NODE_ENV === 'development',
  }
}

// Validar configuración
export function validateSupabaseConfig() {
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ]
  
  const missingVars = requiredEnvVars.filter(
    varName => !process.env[varName]
  )
  
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    )
  }
  
  return true
}
