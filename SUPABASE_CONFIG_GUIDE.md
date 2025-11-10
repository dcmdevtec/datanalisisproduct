# Guía de Configuración de Supabase - Solución de Recargas

## 🔧 Problema Solucionado

**Síntoma:** La página se recargaba al cambiar de pestaña en el navegador.

**Causa:** Múltiples instancias del cliente de Supabase siendo creadas, causando conflictos en la gestión de sesiones.

## ✅ Solución Implementada

### 1. Cliente Singleton Unificado

**Archivo:** `lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Instancia singleton del cliente de Supabase
let supabaseInstance: SupabaseClient<Database> | null = null

export function createClient(): SupabaseClient<Database> {
  // Si ya existe una instancia, retornarla (patrón singleton)
  if (supabaseInstance) {
    return supabaseInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please check your .env.local file.'
    )
  }

  // Crear la instancia una sola vez
  supabaseInstance = createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        // CRÍTICO: Configuración para evitar recargas
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        // Usar localStorage para persistencia
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
      global: {
        headers: {
          'x-application-name': 'datanalisis-app',
        },
      },
    }
  )

  return supabaseInstance
}

// Exportar la instancia singleton
export const supabase = createClient()
export default supabase
```

### 2. Configuración Clave

**Parámetros importantes:**

- `autoRefreshToken: true` - Refresca automáticamente el token antes de que expire
- `persistSession: true` - Mantiene la sesión en localStorage
- `detectSessionInUrl: true` - Detecta sesiones en la URL (útil para magic links)
- `flowType: 'pkce'` - Usa PKCE para mayor seguridad
- `storage: localStorage` - **CRÍTICO:** Define explícitamente el storage para evitar conflictos

### 3. Hooks Personalizados

**Archivo:** `lib/hooks/use-supabase.ts`

```typescript
import { useEffect, useState } from 'react'
import supabase from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export function useSupabaseUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}

export function useSupabase() {
  return supabase
}
```

## 📋 Uso Correcto en Componentes

### ❌ INCORRECTO (No hacer esto)

```typescript
import { createBrowserClient } from '@supabase/ssr'

// ❌ Crear múltiples instancias
const supabase = createBrowserClient(...)
```

### ✅ CORRECTO

```typescript
import supabase from '@/lib/supabase/client'
// O usar el hook
import { useSupabase } from '@/lib/hooks/use-supabase'

function MyComponent() {
  const supabase = useSupabase() // ✅ Usa la instancia singleton
  
  // Tu código...
}
```

## 🔍 Verificación de la Solución

### 1. Verificar que solo hay una instancia

Abre la consola del navegador y ejecuta:

```javascript
// Debe mostrar la misma referencia en todos los componentes
console.log(window.supabaseInstance === window.supabaseInstance)
```

### 2. Monitorear cambios de estado

En desarrollo, verás logs como:

```
🔄 Initial session: user@email.com
🔄 Auth state changed: TOKEN_REFRESHED user@email.com
```

**No deberías ver:**
- Múltiples "Initial session" consecutivos
- "Auth state changed: SIGNED_OUT" sin acción del usuario

### 3. Prueba de cambio de pestaña

1. Inicia sesión
2. Cambia a otra pestaña por 30 segundos
3. Regresa a la app
4. La página **NO** debe recargarse

## 🛠️ Archivos Modificados

1. ✅ `lib/supabase/client.ts` - Cliente singleton con configuración correcta
2. ✅ `components/auth-provider.tsx` - Optimizado para evitar renders innecesarios
3. ✅ `lib/hooks/use-supabase.ts` - Hooks personalizados para uso consistente
4. ✅ `lib/supabase-browser.ts` - Deprecado, ahora redirige al cliente correcto

## 🚀 Mejores Prácticas

### 1. Siempre importar desde el mismo lugar

```typescript
// ✅ CORRECTO
import supabase from '@/lib/supabase/client'

// ❌ INCORRECTO
import { createBrowserClient } from '@supabase/ssr'
```

### 2. Usar hooks personalizados cuando sea posible

```typescript
// En componentes cliente
const { user, loading } = useSupabaseUser()
const supabase = useSupabase()
```

### 3. Manejar estados de carga correctamente

```typescript
const { user, loading } = useAuth()

if (loading) {
  return <LoadingSpinner />
}

if (!user) {
  return <LoginPrompt />
}

return <AuthenticatedContent />
```

### 4. Evitar múltiples subscripciones

```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      // Tu lógica
    }
  )

  // ⚠️ IMPORTANTE: Siempre limpiar la subscripción
  return () => {
    subscription.unsubscribe()
  }
}, []) // Array de dependencias vacío para suscribirse solo una vez
```

## 🔒 Seguridad

### Variables de entorno requeridas

`.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

### Row Level Security (RLS)

Asegúrate de que todas tus tablas tengan políticas RLS activadas:

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
ON users FOR SELECT
USING (auth.uid() = id);
```

## 📊 Monitoreo

### Logs útiles en desarrollo

El sistema incluye logs para monitorear el estado de autenticación:

```
🔄 Initial session: user@email.com
✅ Sign in successful: user@email.com
👋 Signing out...
🔄 Auth state changed: SIGNED_OUT
```

### Desactivar logs en producción

Los logs se desactivan automáticamente en producción:

```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('🔄 Auth state changed:', event)
}
```

## 🐛 Troubleshooting

### Problema: Sesión se pierde al recargar

**Solución:** Verifica que `persistSession: true` esté configurado y que localStorage esté disponible.

### Problema: Token expira muy rápido

**Solución:** Ajusta `autoRefreshToken: true` y verifica la configuración de Supabase.

### Problema: Múltiples instancias detectadas

**Solución:** 
1. Busca imports directos de `createBrowserClient`
2. Reemplázalos con `import supabase from '@/lib/supabase/client'`
3. Reinicia el servidor de desarrollo

## 📚 Referencias

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Supabase SSR Package](https://supabase.com/docs/guides/auth/server-side/nextjs)

## ✨ Resultado Final

Con esta configuración:

- ✅ No más recargas al cambiar de pestaña
- ✅ Sesión persistente entre recargas
- ✅ Token refresh automático
- ✅ Una sola fuente de verdad para el estado de autenticación
- ✅ Mejor rendimiento y experiencia de usuario
