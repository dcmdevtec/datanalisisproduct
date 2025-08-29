// Configuración de rutas de redirección basadas en roles de usuario
export const AUTH_ROUTES = {
  // Rutas de autenticación
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  
  // Rutas por defecto para cada rol
  DEFAULT_ROUTES: {
    admin: '/dashboard',
    supervisor: '/dashboard',
    surveyor: '/surveys',
    user: '/results',
    default: '/dashboard'
  },
  
  // Rutas protegidas que requieren autenticación
  PROTECTED_ROUTES: [
    '/dashboard',
    '/projects',
    '/surveys',
    '/users',
    '/zones',
    '/reports',
    '/settings',
    '/preview'
  ],
  
  // Rutas públicas que no requieren autenticación
  PUBLIC_ROUTES: [
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/terms',
    '/contact'
  ]
}

// Función para obtener la ruta de destino basada en el rol del usuario
export function getDestinationRoute(userRole: string): string {
  const route = AUTH_ROUTES.DEFAULT_ROUTES[userRole as keyof typeof AUTH_ROUTES.DEFAULT_ROUTES]
  return route || AUTH_ROUTES.DEFAULT_ROUTES.default
}

// Función para verificar si una ruta es protegida
export function isProtectedRoute(pathname: string): boolean {
  return AUTH_ROUTES.PROTECTED_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )
}

// Función para verificar si una ruta es de autenticación
export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.PUBLIC_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )
}

// Función para verificar si un usuario puede acceder a una ruta específica
export function canAccessRoute(userRole: string, pathname: string): boolean {
  // Todos los usuarios pueden acceder a todas las rutas
  return true
}
