// Sistema de logging centralizado para Supabase
export const SupabaseLogger = {
  // Logs de información
  info: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`ℹ️ ${message}`, data || '')
    }
  },

  // Logs de éxito
  success: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ ${message}`, data || '')
    }
  },

  // Logs de advertencia
  warn: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`⚠️ ${message}`, data || '')
    }
  },

  // Logs de error
  error: (message: string, error?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(`❌ ${message}`, error || '')
    }
  },

  // Logs de debug
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG === 'true') {
      console.log(`🔍 ${message}`, data || '')
    }
  },

  // Verificar si un error es "normal" (no crítico)
  isNormalError: (error: any): boolean => {
    if (!error || typeof error !== 'object') return false
    
    const normalErrors = [
      'Auth session missing!',
      'No user found',
      'Invalid JWT',
      'JWT expired',
      'User not found'
    ]
    
    return normalErrors.some(normalError => 
      error.message?.includes(normalError) || 
      error.error_description?.includes(normalError)
    )
  },

  // Log condicional basado en el tipo de error
  logConditionally: (message: string, error: any, level: 'warn' | 'error' = 'warn') => {
    if (SupabaseLogger.isNormalError(error)) {
      // Error normal - solo log en debug
      SupabaseLogger.debug(`${message} (normal)`, error.message)
    } else {
      // Error crítico - log completo
      if (level === 'warn') {
        SupabaseLogger.warn(message, error)
      } else {
        SupabaseLogger.error(message, error)
      }
    }
  }
}

// Configuración de logging para diferentes entornos
export const LoggingConfig = {
  development: {
    enableAllLogs: true,
    enableDebugLogs: true,
    enableNormalErrorLogs: false
  },
  production: {
    enableAllLogs: false,
    enableDebugLogs: false,
    enableNormalErrorLogs: false
  },
  test: {
    enableAllLogs: false,
    enableDebugLogs: false,
    enableNormalErrorLogs: false
  }
}

// Función para obtener la configuración de logging actual
export function getLoggingConfig() {
  const env = process.env.NODE_ENV || 'development'
  return LoggingConfig[env as keyof typeof LoggingConfig] || LoggingConfig.development
}
