import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const response = NextResponse.next()

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Supabase env vars faltantes.')
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError) {
    console.error('Error obteniendo usuario en middleware:', userError.message)
  }
  console.log('🛡️ Middleware user:', user?.email ?? 'No user')

  const protectedRoutes = [
    '/dashboard',
    '/projects',
    '/surveys',
    '/users',
    '/zones',
    '/reports',
    '/settings',
  ]

  const authRoutes = ['/login', '/register', '/forgot-password']
  const path = url.pathname

  const isProtectedRoute = protectedRoutes.some(route => path === route || path.startsWith(route + '/'))
  const isAuthRoute = authRoutes.some(route => path === route || path.startsWith(route + '/'))

  if (!user && isProtectedRoute) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next|favicon\\.ico|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|webp|gif)).*)',
  ],
}

