// Configuración del middleware para autenticación y rutas
export const MIDDLEWARE_CONFIG = {
  // Rutas que requieren autenticación
  PROTECTED_ROUTES: [
    '/dashboard',
    '/projects',
    '/surveys',
    '/users',
    '/zones',
    '/reports',
    '/settings',
    // '/preview', // Removido para permitir acceso sin autenticación
  ],

  // Rutas de autenticación (login, register, etc.)
  AUTH_ROUTES: [
    '/login',
    '/register',
    '/forgot-password',
  ],

  // Rutas públicas que no requieren middleware
  PUBLIC_ROUTES: [
    '/',
    '/terms',
    '/contact',
    '/api',
    '/_next',
    '/favicon.ico',
    '/robots.txt',
  ],

  // Rutas que deben ser ignoradas completamente por el middleware
  IGNORED_ROUTES: [
    '/api',
    '/_next',
    '/favicon.ico',
    '/robots.txt',
    '.*\\.(svg|png|jpg|jpeg|webp|gif)$',
  ],

  // Configuración de redirección
  REDIRECTS: {
    // Ruta por defecto para usuarios autenticados
    DEFAULT_AUTHENTICATED: '/dashboard',
    // Ruta para usuarios no autenticados
    DEFAULT_UNAUTHENTICATED: '/login',
    // Rutas específicas por rol
    BY_ROLE: {
      admin: '/dashboard',
      supervisor: '/dashboard',
      surveyor: '/surveys',
      user: '/results',
    }
  },

  // Configuración de cookies
  COOKIES: {
    // Nombre de la cookie de sesión
    SESSION_NAME: 'sb-auth-token',
    // Tiempo de expiración en segundos
    EXPIRY_MARGIN: 300, // 5 minutos
    // Tiempo de refresh en segundos
    REFRESH_MARGIN: 60, // 1 minuto
  },

  // Configuración de logging
  LOGGING: {
    // Habilitar logs detallados en desarrollo
    ENABLE_VERBOSE: process.env.NODE_ENV === 'development',
    // Mostrar información sensible en logs
    SHOW_SENSITIVE_INFO: process.env.NODE_ENV === 'development',
  }
}

// Función para verificar si una ruta es protegida
export function isProtectedRoute(pathname: string): boolean {
  return MIDDLEWARE_CONFIG.PROTECTED_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )
}

// Función para verificar si una ruta es de autenticación
export function isAuthRoute(pathname: string): boolean {
  return MIDDLEWARE_CONFIG.AUTH_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )
}

// Función para verificar si una ruta es pública
export function isPublicRoute(pathname: string): boolean {
  return MIDDLEWARE_CONFIG.PUBLIC_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )
}

// Función para verificar si una ruta debe ser ignorada
export function shouldIgnoreRoute(pathname: string): boolean {
  return MIDDLEWARE_CONFIG.IGNORED_ROUTES.some(pattern => {
    if (pattern.startsWith('.*')) {
      // Patrón regex
      const regex = new RegExp(pattern)
      return regex.test(pathname)
    }
    return pathname === pattern || pathname.startsWith(pattern + '/')
  })
}

// Función para obtener la ruta de redirección basada en el rol
export function getRedirectRoute(userRole?: string): string {
  if (userRole && MIDDLEWARE_CONFIG.REDIRECTS.BY_ROLE[userRole as keyof typeof MIDDLEWARE_CONFIG.REDIRECTS.BY_ROLE]) {
    return MIDDLEWARE_CONFIG.REDIRECTS.BY_ROLE[userRole as keyof typeof MIDDLEWARE_CONFIG.REDIRECTS.BY_ROLE]
  }
  return MIDDLEWARE_CONFIG.REDIRECTS.DEFAULT_AUTHENTICATED
}
