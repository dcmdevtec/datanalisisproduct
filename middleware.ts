import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { 
  MIDDLEWARE_CONFIG,
  isProtectedRoute,
  isAuthRoute,
  shouldIgnoreRoute,
  getRedirectRoute 
} from '@/lib/middleware/config' // Ajusta la ruta según tu estructura

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Ignorar rutas que no necesitan procesamiento
  if (shouldIgnoreRoute(path)) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  try {
    // Verificar el usuario autenticado
    const { data: { user }, error } = await supabase.auth.getUser()

    if (MIDDLEWARE_CONFIG.LOGGING.ENABLE_VERBOSE) {
      console.log('🔒 Middleware ejecutándose en:', path)
      console.log('🔑 Estado de usuario:', {
        authenticated: !!user,
        hasError: !!error,
        userId: MIDDLEWARE_CONFIG.LOGGING.SHOW_SENSITIVE_INFO ? user?.id : '***'
      })
    }

    // Manejar rutas protegidas
    if (isProtectedRoute(path)) {
      if (!user || error) {
        const loginUrl = new URL(MIDDLEWARE_CONFIG.REDIRECTS.DEFAULT_UNAUTHENTICATED, request.url)
        loginUrl.searchParams.set('redirectedFrom', path)
        
        if (MIDDLEWARE_CONFIG.LOGGING.ENABLE_VERBOSE) {
          console.log('🛡️ Acceso denegado - Redirigiendo a login desde:', path)
        }
        
        return NextResponse.redirect(loginUrl)
      }

      // Usuario autenticado - obtener rol si está disponible
      const userRole = user.user_metadata?.role || user.app_metadata?.role
      
      if (MIDDLEWARE_CONFIG.LOGGING.ENABLE_VERBOSE) {
        console.log('✅ Acceso permitido a ruta protegida:', path)
        console.log('👤 Rol de usuario:', userRole || 'Sin rol definido')
      }
    }

    // Manejar rutas de autenticación (evitar acceso si ya está logueado)
    if (isAuthRoute(path) && user && !error) {
      const userRole = user.user_metadata?.role || user.app_metadata?.role
      const redirectRoute = getRedirectRoute(userRole)
      
      if (MIDDLEWARE_CONFIG.LOGGING.ENABLE_VERBOSE) {
        console.log('🔄 Usuario ya autenticado - Redirigiendo desde:', path, 'hacia:', redirectRoute)
      }
      
      return NextResponse.redirect(new URL(redirectRoute, request.url))
    }

    return response

  } catch (error) {
    if (MIDDLEWARE_CONFIG.LOGGING.ENABLE_VERBOSE) {
      console.error('❌ Error en middleware:', error)
    }

    // Si hay error y es una ruta protegida, redirigir a login
    if (isProtectedRoute(path)) {
      const loginUrl = new URL(MIDDLEWARE_CONFIG.REDIRECTS.DEFAULT_UNAUTHENTICATED, request.url)
      loginUrl.searchParams.set('redirectedFrom', path)
      return NextResponse.redirect(loginUrl)
    }

    // Para otras rutas, continuar normalmente
    return response
  }
}


export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}