import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Crear respuesta mutable para poder escribir cookies actualizadas
  let response = NextResponse.next({ request })

  try {
    // Crear cliente SSR para refrescar el token si está próximo a expirar.
    // Esto evita que sesiones largas (editor de encuestas) fallen silenciosamente.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            response = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options as any)
            )
          },
        },
      }
    )

    // Refrescar sesión — si el access token expiró y hay refresh token válido,
    // Supabase lo renueva automáticamente y escribe las cookies actualizadas.
    // No lanzamos error si falla: simplemente dejamos pasar la petición.
    await supabase.auth.getUser()

    // Redirigir si usuario ya autenticado intenta ir a /login — al portal de
    // encuestador si su rol es 'surveyor', al dashboard administrativo si no.
    if (pathname === '/login') {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userInfo } = await supabase.from('users').select('role').eq('id', user.id).single()
        const destination = (userInfo as any)?.role === 'surveyor' ? '/portal-encuestador' : '/dashboard'
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Middleware - Usuario autenticado, redirigiendo a ${destination}`)
        }
        return NextResponse.redirect(new URL(destination, request.url))
      }
    }

  } catch (error) {
    // No bloquear nunca la navegación por errores del middleware
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Middleware error:', error)
    }
  }

  return response
}

// Interceptar todas las rutas de la aplicación para mantener sesiones activas.
// Las rutas de assets estáticos se excluyen automáticamente.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
