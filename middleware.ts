import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Solo logging en desarrollo para no afectar producción
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Middleware - Ruta:', pathname)
  }

  try {
    // IMPORTANTE: Solo proteger la ruta de login para evitar que usuarios autenticados vuelvan ahí
    if (pathname === '/login') {
      // Verificación ultra-rápida de cookies de Supabase
      const cookies = request.cookies.getAll()
      const hasSupabaseCookies = cookies.some(cookie => 
        cookie.name.startsWith('sb-') && cookie.name.includes('access_token')
      )
      
      if (hasSupabaseCookies) {
        // Si hay cookies de Supabase, redirigir al dashboard (evitar que usuarios logueados vayan a login)
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Middleware - Usuario ya autenticado, redirigiendo desde login a dashboard')
        }
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      
      // Si no hay cookies de Supabase, permitir acceso a login
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Middleware - Usuario no autenticado, permitiendo acceso a login')
      }
      return NextResponse.next()
    }

    // Para TODAS las demás rutas: ACCESO LIBRE INMEDIATO
    // No validar cookies, no verificar sesión, permitir navegación libre
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Middleware - Ruta libre, permitiendo acceso sin validación')
    }
    
    return NextResponse.next()
    
  } catch (error) {
    // En caso de error, solo log en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Middleware error:', error)
    }
    
    // Si hay error, permitir acceso (no bloquear)
    return NextResponse.next()
  }
}

// Configuración optimizada del middleware
export const config = {
  matcher: [
    // Solo interceptar rutas que realmente necesiten middleware
    '/login',
    '/dashboard/:path*',
    '/projects/:path*',
    '/create-survey',
    '/preview/:path*',
    '/settings/:path*',
    '/users/:path*',
    '/zones/:path*',
    '/surveyors/:path*',
    '/reports/:path*',
    '/companies/:path*',
    '/contact',
    '/terms',
    '/forgot-password',
    '/register'
  ],
}