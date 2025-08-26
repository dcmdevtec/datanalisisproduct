# 🚀 Mejores Prácticas de Supabase 2025 con Next.js

## 📚 **Documentación Oficial Consultada**

- [Supabase Auth Helpers para Next.js](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/ssr)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)

## ✅ **Configuración Correcta del Middleware**

### **1. Middleware con createServerClient (Oficial)**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
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
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  // Verificar sesión usando getSession() (recomendado)
  const { data: { session } } = await supabase.auth.getSession()
  
  // Lógica de redirección...
}
```

### **2. ¿Por qué NO usar createBrowserClient en Middleware?**

- **`createBrowserClient`** está diseñado para el navegador
- **`createServerClient`** está diseñado para el servidor (middleware, SSR)
- El middleware se ejecuta en el servidor, no en el navegador
- Las cookies se manejan de manera diferente en cada contexto

## 🔐 **Configuración de Autenticación**

### **1. Cliente del Navegador (Oficial)**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        storageKey: 'sb-auth-token',
      },
    }
  )
}
```

### **2. Cliente del Servidor (Oficial)**

```typescript
import { createServerClient } from '@supabase/ssr'

export async function createServerSupabaseClient(cookieStore: ReturnType<typeof cookies>) {
  const cookies = await cookieStore
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookies.set({ name, value, ...options })
          } catch (error) {
            // Error esperado en componentes del cliente
          }
        },
        remove(name: string, options: any) {
          try {
            cookies.set({ name, value: '', ...options })
          } catch (error) {
            // Error esperado en componentes del cliente
          }
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
```

## 🍪 **Manejo Correcto de Cookies**

### **1. En Middleware**

```typescript
cookies: {
  getAll: () => request.cookies.getAll(),
  setAll: (cookies) => {
    cookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options)
    })
  },
}
```

### **2. En Server Components**

```typescript
cookies: {
  get(name: string) {
    return cookieStore.get(name)?.value
  },
  set(name: string, value: string, options: any) {
    try {
      cookieStore.set({ name, value, ...options })
    } catch (error) {
      // Error esperado en componentes del cliente
    }
  },
}
```

## 🔄 **Flujo de Autenticación Recomendado**

### **1. Login en Cliente**

```typescript
const login = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ 
    email, 
    password 
  })
  
  if (error) throw error
  
  // El middleware detectará automáticamente la sesión
  // No es necesario hacer redirección manual aquí
}
```

### **2. Middleware Detecta Sesión**

```typescript
// En middleware
const { data: { session } } = await supabase.auth.getSession()

if (session?.user) {
  // Usuario autenticado
  if (isAuthRoute(path)) {
    // Redirigir desde rutas de auth
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
} else {
  // Usuario no autenticado
  if (isProtectedRoute(path)) {
    // Redirigir a login
    return NextResponse.redirect(new URL('/login', request.url))
  }
}
```

### **3. Hook de Redirección (Opcional)**

```typescript
// Solo para casos especiales o redirecciones basadas en rol
export function useAuthRedirect() {
  const { user, session, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user && session) {
      const destinationRoute = getRouteByRole(user.role)
      setTimeout(() => {
        router.push(destinationRoute)
      }, 1000)
    }
  }, [user, session, loading, router])
}
```

## 🚫 **Errores Comunes a Evitar**

### **1. NO usar createBrowserClient en Middleware**
```typescript
// ❌ INCORRECTO
const supabase = createBrowserClient(...)

// ✅ CORRECTO
const supabase = createServerClient(...)
```

### **2. NO hacer redirección manual en login**
```typescript
// ❌ INCORRECTO
const login = async () => {
  await supabase.auth.signInWithPassword(...)
  router.push('/dashboard') // No hacer esto
}

// ✅ CORRECTO
const login = async () => {
  await supabase.auth.signInWithPassword(...)
  // Dejar que el middleware maneje la redirección
}
```

### **3. NO usar cookies del navegador en servidor**
```typescript
// ❌ INCORRECTO
cookies: {
  get: () => document.cookie // No funciona en servidor
}

// ✅ CORRECTO
cookies: {
  get: (name) => cookieStore.get(name)?.value
}
```

## 🎯 **Configuración Recomendada para 2025**

### **1. Variables de Entorno**
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NODE_ENV=development
```

### **2. Package.json**
```json
{
  "dependencies": {
    "@supabase/ssr": "^0.6.1",
    "@supabase/supabase-js": "^2.39.6"
  }
}
```

### **3. Middleware Config**
```typescript
export const config = {
  matcher: [
    '/((?!api|_next|favicon\\.ico|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|webp|gif)).*)',
  ],
}
```

## 🔍 **Debugging del Middleware**

### **1. Logs en Desarrollo**
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('🛣️ Middleware - Ruta:', path)
  console.log('👤 Usuario:', user?.email)
}
```

### **2. Verificar Cookies**
```typescript
// En middleware
const allCookies = request.cookies.getAll()
console.log('🍪 Cookies:', allCookies.map(c => c.name))
```

### **3. Verificar Sesión**
```typescript
const { data: { session }, error } = await supabase.auth.getSession()
console.log('🔑 Sesión:', session ? 'Activa' : 'No activa')
if (error) console.log('❌ Error:', error.message)
```

## 📋 **Resumen de Cambios Implementados**

1. **Middleware corregido** para usar `createServerClient`
2. **Cliente de Supabase actualizado** según mejores prácticas 2025
3. **Hook de redirección simplificado** para mayor estabilidad
4. **Manejo de cookies corregido** para middleware y servidor
5. **Logging condicional** solo en desarrollo

---

**🎯 Conclusión**: La implementación ahora sigue exactamente las mejores prácticas oficiales de Supabase 2025 para Next.js, lo que debería resolver los problemas de autenticación y middleware.
