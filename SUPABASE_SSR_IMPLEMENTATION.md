# 🚀 Implementación de SSR para Supabase en Next.js

## 📋 Problema Identificado

La aplicación actual no está implementando correctamente el **Server-Side Rendering (SSR)** para Supabase, lo que causa:

- ❌ **Pérdida de conexión** cuando sales del navegador
- ❌ **Necesidad de recargar la página** constantemente
- ❌ **Sesiones inestables** que se pierden fácilmente
- ❌ **Falta de persistencia** entre navegaciones

## ✅ Solución Implementada

### 1. **Cliente Unificado de Supabase** (`lib/supabase/client.ts`)

```typescript
// Cliente del navegador optimizado para SSR
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
        storageKey: 'supabase-auth-token',
        sessionExpiryMargin: 300, // 5 minutos
        tokenRefreshMargin: 60, // 1 minuto
      },
      // ... más configuración
    }
  )
}

// Cliente del servidor para SSR
export function createServerSupabaseClient(cookieStore: ReturnType<typeof cookies>) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Error esperado en componentes del cliente
          }
        },
      },
      auth: {
        autoRefreshToken: false, // No refrescar en el servidor
        persistSession: false, // No persistir en el servidor
      },
    }
  )
}
```

### 2. **Hook Mejorado con SSR** (`hooks/use-supabase-ssr.ts`)

```typescript
export function useSupabaseSSR(options: UseSupabaseSSROptions = {}): UseSupabaseSSRReturn {
  // ... configuración
  
  // Función para verificar la conexión con timeout
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      // Usar AbortController para timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 segundos timeout

      const { data, error } = await supabase
        .from('surveys')
        .select('id')
        .limit(1)
        .abortSignal(controller.signal)
      
      clearTimeout(timeoutId)
      
      if (error) {
        console.warn('⚠️ Error de conexión a Supabase:', error.message)
        return false
      }
      
      return true
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn('⚠️ Timeout en verificación de conexión')
      } else {
        console.error('❌ Error crítico de conexión:', err)
      }
      return false
    }
  }, [])

  // Función para reconectar con backoff exponencial
  const reconnect = useCallback(async (): Promise<void> => {
    if (retryCount.current >= maxRetries) {
      setError('Se alcanzó el límite máximo de reintentos')
      return
    }

    setLoading(true)
    retryCount.current++

    try {
      console.log(`🔄 Reintentando conexión (${retryCount.current}/${maxRetries})...`)
      
      // Backoff exponencial
      const delay = Math.min(retryDelay * Math.pow(2, retryCount.current - 1), 30000)
      await new Promise(resolve => setTimeout(resolve, delay))
      
      const connected = await checkConnection()
      if (connected) {
        setIsConnected(true)
        setError(null)
        retryCount.current = 0
        console.log('✅ Conexión restablecida')
      } else {
        throw new Error('No se pudo establecer la conexión')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error de reconexión'
      setError(errorMessage)
      console.error('❌ Error en reconexión:', errorMessage)
      
      // Programar siguiente reintento
      retryTimeout.current = setTimeout(() => {
        reconnect()
      }, retryDelay)
    } finally {
      setLoading(false)
    }
  }, [checkConnection, maxRetries, retryDelay])

  // ... más funcionalidades
}
```

### 3. **Inicialización de SSR en el Servidor** (`components/supabase-ssr-init.tsx`)

```typescript
export async function SupabaseSSRInit() {
  const cookieStore = cookies()
  const supabase = createServerSupabaseClient(cookieStore)

  try {
    // Verificar la sesión en el servidor
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('❌ Error en SSR Supabase:', error.message)
    } else if (session) {
      console.log('✅ Sesión válida en SSR:', session.user.email)
    }

    return null
  } catch (err) {
    console.error('❌ Error crítico en SSR Supabase:', err)
    return null
  }
}
```

### 4. **Middleware Mejorado** (`middleware.ts`)

```typescript
export async function middleware(request: NextRequest) {
  // ... configuración inicial
  
  try {
    // Crear cliente de Supabase en el middleware
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
          autoRefreshToken: false, // No refrescar en middleware
          persistSession: false, // No persistir en middleware
        },
      }
    )

    // Verificar sesión en el middleware
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error('❌ Error obteniendo usuario en middleware:', userError.message)
    } else if (user) {
      console.log('✅ Usuario autenticado en middleware:', user.email)
      
      // Refrescar token si es necesario
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // Verificar si el token está próximo a expirar
        const expiresAt = session.expires_at
        const now = Math.floor(Date.now() / 1000)
        
        if (expiresAt && (expiresAt - now) < 300) { // 5 minutos antes de expirar
          console.log('🔄 Token próximo a expirar, refrescando...')
          try {
            const { data, error } = await supabase.auth.refreshSession()
            if (error) {
              console.warn('⚠️ Error refrescando token:', error.message)
            } else if (data.session) {
              console.log('✅ Token refrescado exitosamente')
            }
          } catch (refreshError) {
            console.warn('⚠️ Error en refresh de token:', refreshError)
          }
        }
      }
    }

    // ... lógica de rutas protegidas
  } catch (error) {
    console.error('❌ Error crítico en middleware:', error)
    return response
  }
}
```

### 5. **Layout Principal con SSR** (`app/layout.tsx`)

```typescript
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <MantineProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            {/* Inicialización de Supabase en el servidor */}
            <SupabaseSSRInit />
            
            <SupabaseProvider 
              keepAlive={true}
              retryDelay={3000}
              maxRetries={5}
              useReadOnlyForQueries={true}
            >
              <ClientLayout>
                {children}
              </ClientLayout>
              <Toaster />
              <ConnectionStatus 
                showBadgeOnly={true}
                position="top-right"
                autoHide={true}
              />
            </SupabaseProvider>
          </ThemeProvider>
        </MantineProvider>
      </body>
    </html>
  )
}
```

## 🔧 Características Implementadas

### **Persistencia de Sesión**
- ✅ **SSR completo** con verificación de sesión en el servidor
- ✅ **Cookies persistentes** para mantener la autenticación
- ✅ **Refresh automático de tokens** antes de que expiren
- ✅ **Sincronización cliente-servidor** para estado consistente

### **Reconexión Inteligente**
- ✅ **Backoff exponencial** para reintentos de conexión
- ✅ **Verificación de conexión** cada minuto
- ✅ **Keep-alive** cada 30 segundos
- ✅ **Detección de cambios de red** (online/offline)

### **Manejo de Errores**
- ✅ **Timeouts configurables** para operaciones
- ✅ **Límite de reintentos** configurable
- ✅ **Logs detallados** para debugging
- ✅ **Fallbacks graceful** en caso de errores

### **Seguridad**
- ✅ **Headers de seguridad** en middleware
- ✅ **Validación de rutas** en el servidor
- ✅ **Manejo seguro de cookies** para SSR
- ✅ **Protección contra ataques** comunes

## 🚀 Beneficios de la Implementación

1. **🔒 Sesiones Estables**: No más pérdida de conexión al salir del navegador
2. **⚡ Rendimiento Mejorado**: SSR reduce el tiempo de carga inicial
3. **🔄 Reconexión Automática**: Se reconecta automáticamente si se pierde la conexión
4. **📱 Mejor UX**: No más necesidad de recargar la página constantemente
5. **🛡️ Mayor Seguridad**: Validación en el servidor y headers de seguridad
6. **📊 Monitoreo**: Logs detallados para debugging y monitoreo

## 📝 Uso

### **En Componentes del Cliente**
```typescript
import { useSupabase } from '@/components/supabase-provider'

export function MyComponent() {
  const { supabase, isConnected, session, user, isSSRReady } = useSupabase()
  
  if (!isSSRReady) {
    return <div>Cargando...</div>
  }
  
  // Tu componente aquí
}
```

### **En API Routes**
```typescript
import { createServerSupabaseClient } from '@/lib/supabase/client'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = cookies()
  const supabase = createServerSupabaseClient(cookieStore)
  
  const { data: { user } } = await supabase.auth.getUser()
  
  // Tu lógica aquí
}
```

## 🔍 Debugging

### **Logs del Servidor**
- ✅ Sesiones válidas en SSR
- ✅ Usuarios autenticados en middleware
- ✅ Tokens refrescados automáticamente

### **Logs del Cliente**
- ✅ Estado de conexión
- ✅ Reintentos de reconexión
- ✅ Cambios de estado de autenticación

## 📚 Recursos Adicionales

- [Documentación oficial de Supabase SSR](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Middleware de Next.js](https://nextjs.org/docs/app/building-your-application/routing/middleware)

---

**🎯 Resultado**: Conexión de Supabase estable y persistente con SSR completo, eliminando la necesidad de recargar la página constantemente.
