// Configuración optimizada para Supabase
export const SUPABASE_CONFIG = {
  // Configuración de autenticación
  auth: {
    // Mantener sesión activa
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce' as const,
    storageKey: 'supabase-auth-token',
    
    // Configuración de tokens
    tokenRefreshMargin: 60, // Refrescar token 60 segundos antes de que expire
    
    // Configuración de sesión
    sessionExpiryMargin: 300, // Margen de 5 minutos para expiración de sesión
    
    // Configuración para SSR
    cookieOptions: {
      name: 'supabase-auth-token',
      lifetime: 60 * 60 * 24 * 7, // 7 días
      domain: process.env.NODE_ENV === 'production' ? '.tu-dominio.com' : 'localhost',
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },
  
  // Configuración de base de datos
  db: {
    schema: 'public',
    
    // Configuración de consultas
    queryTimeout: 30000, // 30 segundos de timeout para consultas
    
    // Configuración de paginación
    defaultPageSize: 50,
    maxPageSize: 1000,
  },
  
  // Configuración global
  global: {
    // Headers personalizados
    headers: {
      'X-Client-Info': 'supabase-js-browser-optimized',
      'Keep-Alive': 'timeout=300, max=1000',
      'Connection': 'keep-alive',
    },
    
    // Configuración de fetch
    fetch: {
      keepalive: true,
      credentials: 'include',
    },
  },
  
  // Configuración de realtime
  realtime: {
    // Mantener conexión realtime activa
    params: {
      eventsPerSecond: 10,
    },
    
    // Configuración de reconexión
    reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 30000),
    maxRetries: 5,
  },
  
  // Configuración de caché
  cache: {
    // Tiempo de vida del caché por defecto
    defaultTTL: 300000, // 5 minutos
    
    // Tamaño máximo del caché
    maxSize: 100,
    
    // Patrones de invalidación automática
    autoInvalidate: {
      // Invalidar caché de encuestas cuando se modifiquen
      surveys: ['surveys', 'survey_sections', 'questions'],
      // Invalidar caché de usuarios cuando se modifiquen
      users: ['users', 'surveyors'],
      // Invalidar caché de zonas cuando se modifiquen
      zones: ['zones', 'survey_surveyor_zones'],
    },
  },
  
  // Configuración de reintentos
  retry: {
    // Número máximo de reintentos
    maxRetries: 3,
    
    // Delay base entre reintentos (en ms)
    baseDelay: 1000,
    
    // Factor de multiplicación para delay exponencial
    backoffFactor: 2,
    
    // Delay máximo entre reintentos
    maxDelay: 10000,
    
    // Condiciones para reintentar
    retryConditions: [
      // Reintentar en errores de red
      (error: any) => error.code === 'NETWORK_ERROR',
      // Reintentar en timeouts
      (error: any) => error.code === 'TIMEOUT',
      // Reintentar en errores de servidor (5xx)
      (error: any) => error.status >= 500 && error.status < 600,
      // Reintentar en errores de rate limiting
      (error: any) => error.status === 429,
    ],
  },
  
  // Configuración de monitoreo
  monitoring: {
    // Habilitar logs detallados en desarrollo
    enableLogs: process.env.NODE_ENV === 'development',
    
    // Métricas de rendimiento
    performance: {
      // Medir tiempo de respuesta de consultas
      measureQueryTime: true,
      // Medir tiempo de autenticación
      measureAuthTime: true,
      // Medir tiempo de reconexión
      measureReconnectTime: true,
    },
    
    // Alertas automáticas
    alerts: {
      // Alertar cuando la latencia sea alta
      highLatency: 5000, // 5 segundos
      // Alertar cuando haya muchos reintentos
      maxRetries: 5,
      // Alertar cuando la conexión se pierda
      connectionLoss: true,
    },
  },
  
  // Configuración de desarrollo
  development: {
    // Simular latencia en desarrollo
    simulateLatency: false,
    latencyRange: [100, 500], // ms
    
    // Simular errores en desarrollo
    simulateErrors: false,
    errorRate: 0.1, // 10%
    
    // Logs detallados
    verboseLogging: true,
  },
  
  // Configuración de SSR
  ssr: {
    // Habilitar SSR completo
    enabled: true,
    
    // Configuración de cookies para SSR
    cookies: {
      // Nombre de la cookie de sesión
      sessionName: 'supabase-auth-token',
      // Tiempo de vida de la cookie (7 días)
      maxAge: 60 * 60 * 24 * 7,
      // Dominio de la cookie
      domain: process.env.NODE_ENV === 'production' ? '.tu-dominio.com' : 'localhost',
      // Ruta de la cookie
      path: '/',
      // Política de SameSite
      sameSite: 'lax',
      // Solo HTTPS en producción
      secure: process.env.NODE_ENV === 'production',
      // HttpOnly para mayor seguridad
      httpOnly: true,
    },
    
    // Configuración de middleware
    middleware: {
      // Habilitar verificación de autenticación en middleware
      enableAuthCheck: true,
      // Habilitar refresh automático de tokens
      enableTokenRefresh: true,
      // Tiempo antes de expirar para refrescar token (5 minutos)
      tokenRefreshThreshold: 300,
      // Rutas protegidas
      protectedRoutes: [
        '/dashboard',
        '/projects',
        '/surveys',
        '/users',
        '/zones',
        '/reports',
        '/settings',
        '/preview',
      ],
      // Rutas de autenticación
      authRoutes: [
        '/login',
        '/register',
        '/forgot-password',
      ],
    },
    
    // Configuración de sincronización cliente-servidor
    sync: {
      // Habilitar sincronización automática
      enabled: true,
      // Intervalo de sincronización (30 segundos)
      interval: 30000,
      // Sincronizar en cambios de visibilidad de página
      onVisibilityChange: true,
      // Sincronizar en cambios de estado de red
      onNetworkChange: true,
    },
  },
}

// Configuración específica para diferentes entornos
export const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV
  
  switch (env) {
    case 'development':
      return {
        ...SUPABASE_CONFIG,
        monitoring: {
          ...SUPABASE_CONFIG.monitoring,
          enableLogs: true,
        },
        development: {
          ...SUPABASE_CONFIG.development,
          verboseLogging: true,
        },
      }
    
    case 'production':
      return {
        ...SUPABASE_CONFIG,
        monitoring: {
          ...SUPABASE_CONFIG.monitoring,
          enableLogs: false,
        },
        retry: {
          ...SUPABASE_CONFIG.retry,
          maxRetries: 5, // Más reintentos en producción
        },
        cache: {
          ...SUPABASE_CONFIG.cache,
          defaultTTL: 600000, // 10 minutos en producción
        },
        ssr: {
          ...SUPABASE_CONFIG.ssr,
          cookies: {
            ...SUPABASE_CONFIG.ssr.cookies,
            secure: true, // Solo HTTPS en producción
            domain: '.tu-dominio.com', // Ajustar según tu dominio
          },
        },
      }
    
    case 'test':
      return {
        ...SUPABASE_CONFIG,
        auth: {
          ...SUPABASE_CONFIG.auth,
          persistSession: false, // No persistir en tests
        },
        cache: {
          ...SUPABASE_CONFIG.cache,
          defaultTTL: 0, // Sin caché en tests
        },
      }
    
    default:
      return SUPABASE_CONFIG
  }
}

// Función para crear configuración personalizada
export const createCustomConfig = (overrides: Partial<typeof SUPABASE_CONFIG>) => {
  return {
    ...SUPABASE_CONFIG,
    ...overrides,
  }
}
