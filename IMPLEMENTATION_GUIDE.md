# 🚀 Guía de Implementación Paso a Paso

## ⚡ Resumen Rápido

He actualizado la configuración de Supabase en tu proyecto para resolver el problema de recargas al cambiar de pestaña. Los cambios principales son:

1. ✅ Cliente Supabase singleton en `lib/supabase/client.ts`
2. ✅ Hooks personalizados en `lib/hooks/use-supabase.ts`
3. ✅ Auth Provider optimizado
4. ✅ Script de verificación
5. ✅ Documentación completa

---

## 📝 Pasos para Activar los Cambios

### Paso 1: Verificar Variables de Entorno

Asegúrate de que tu archivo `.env.local` contiene:

```env
NEXT_PUBLIC_SUPABASE_URL=tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon
```

### Paso 2: Instalar Dependencias (si es necesario)

```bash
npm install
```

### Paso 3: Ejecutar Verificación

```bash
npm run verify:supabase
```

**Resultado esperado:**
```
✅ ¡Configuración correcta! Tu app debería funcionar sin recargas.
```

### Paso 4: Iniciar el Servidor de Desarrollo

```bash
npm run dev
```

### Paso 5: Probar la Solución

1. **Abre** http://localhost:3000
2. **Inicia sesión** con tus credenciales
3. **Cambia de pestaña** por 30-60 segundos
4. **Regresa** a la aplicación
5. **Verifica:** La página NO debe recargarse ✅

---

## 🔍 Verificación de la Solución

### En la Consola del Navegador

Deberías ver algo como:

```
🔄 Initial session: usuario@email.com
✅ Sign in successful: usuario@email.com
```

### NO deberías ver:

```
❌ Multiple "Initial session" logs
❌ Unexpected SIGNED_OUT events
❌ Page reloads when switching tabs
```

---

## 📂 Archivos que Debes Revisar

### 1. Si tienes componentes que usan Supabase directamente

**ANTES (incorrecto):**
```typescript
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(...)
```

**DESPUÉS (correcto):**
```typescript
import supabase from '@/lib/supabase/client'
// O
import { useSupabase } from '@/lib/hooks/use-supabase'
```

### 2. Para actualizar tus componentes

Busca en tu código cualquier archivo que tenga:

```typescript
import { createBrowserClient } from '@supabase/ssr'
```

Y reemplázalo con:

```typescript
import supabase from '@/lib/supabase/client'
```

### 3. Script para buscar automáticamente

Puedes ejecutar este comando en tu terminal para encontrar archivos que necesitan actualización:

**En Windows (PowerShell):**
```powershell
Get-ChildItem -Path . -Recurse -Include *.tsx,*.ts -Exclude node_modules | Select-String "createBrowserClient"
```

**En Windows (CMD):**
```cmd
findstr /s /i "createBrowserClient" *.ts *.tsx
```

**En Mac/Linux:**
```bash
grep -r "createBrowserClient" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules .
```

---

## 🎯 Casos de Uso Comunes

### Caso 1: Obtener el usuario actual en un componente

```typescript
import { useSupabaseUser } from '@/lib/hooks/use-supabase'

export default function MyComponent() {
  const { user, loading } = useSupabaseUser()
  
  if (loading) {
    return <div>Cargando...</div>
  }
  
  if (!user) {
    return <div>Por favor inicia sesión</div>
  }
  
  return <div>Bienvenido {user.email}</div>
}
```

### Caso 2: Hacer una consulta a la base de datos

```typescript
import { useSupabase } from '@/lib/hooks/use-supabase'
import { useEffect, useState } from 'react'

export default function DataComponent() {
  const supabase = useSupabase()
  const [data, setData] = useState([])
  
  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('tu_tabla')
        .select('*')
      
      if (!error && data) {
        setData(data)
      }
    }
    
    fetchData()
  }, [supabase])
  
  return <div>{/* Tu UI aquí */}</div>
}
```

### Caso 3: Verificar autenticación en Server Components

```typescript
// En un Server Component (app/ruta/page.tsx)
import { createServerSupabase } from '@/lib/supabase-server'

export default async function ServerPage() {
  const supabase = createServerSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    redirect('/login')
  }
  
  // Tu lógica aquí
}
```

---

## ⚠️ Advertencias Importantes

### 1. NO crear múltiples instancias

```typescript
// ❌ NUNCA HAGAS ESTO
const supabase1 = createBrowserClient(...)
const supabase2 = createBrowserClient(...)

// ✅ SIEMPRE USA LA INSTANCIA SINGLETON
import supabase from '@/lib/supabase/client'
```

### 2. NO importar desde archivos deprecados

```typescript
// ❌ DEPRECADO
import { supabase } from '@/lib/supabase-browser'

// ✅ CORRECTO
import supabase from '@/lib/supabase/client'
```

### 3. Limpiar subscripciones

```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      // Tu lógica
    }
  )

  // ✅ SIEMPRE LIMPIAR
  return () => {
    subscription.unsubscribe()
  }
}, [])
```

---

## 🐛 Resolución de Problemas

### Problema: El script de verificación falla

**Solución:**
1. Asegúrate de que Node.js esté instalado: `node --version`
2. Verifica que estás en la raíz del proyecto
3. Revisa que el archivo existe: `scripts/verify-supabase-config.js`

### Problema: Aún hay recargas al cambiar de pestaña

**Solución:**
1. Ejecuta el script: `npm run verify:supabase`
2. Busca y corrige los warnings
3. Reinicia el servidor completamente:
   ```bash
   # Detener el servidor (Ctrl + C)
   npm run dev
   ```
4. Limpia la caché del navegador o usa modo incógnito

### Problema: Error "Missing Supabase environment variables"

**Solución:**
1. Verifica tu archivo `.env.local`
2. Asegúrate de que las variables empiecen con `NEXT_PUBLIC_`
3. Reinicia el servidor después de cambiar `.env.local`

### Problema: Usuario se desloguea inesperadamente

**Solución:**
1. Verifica la configuración en Supabase Dashboard
2. Revisa el tiempo de expiración del token
3. Asegúrate de que `autoRefreshToken: true` esté configurado

---

## 📊 Checklist de Implementación

- [ ] Variables de entorno configuradas en `.env.local`
- [ ] Script de verificación ejecutado exitosamente
- [ ] Servidor de desarrollo reiniciado
- [ ] Probado inicio de sesión
- [ ] Probado cambio de pestaña sin recargas
- [ ] Revisado que no hay warnings en la consola
- [ ] Actualizado cualquier import directo de `createBrowserClient`
- [ ] Limpiada la caché del navegador

---

## 📚 Recursos Adicionales

### Documentación Creada

1. **`SUPABASE_CHANGES_SUMMARY.md`** - Resumen ejecutivo de cambios
2. **`SUPABASE_CONFIG_GUIDE.md`** - Guía técnica completa
3. **`scripts/verify-supabase-config.js`** - Script de verificación automática

### Enlaces Útiles

- [Documentación de Supabase](https://supabase.com/docs)
- [Supabase Auth con Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Patrón Singleton en JavaScript](https://www.patterns.dev/posts/singleton-pattern)

---

## ✨ Resultado Final

Una vez completados todos los pasos:

✅ **No más recargas** al cambiar de pestaña  
✅ **Sesión persistente** entre recargas  
✅ **Mejor rendimiento** de la aplicación  
✅ **Código más limpio** y mantenible  
✅ **Experiencia de usuario** mejorada  

---

## 🎉 ¡Listo!

Tu aplicación ahora tiene una configuración robusta de Supabase que previene las recargas al cambiar de pestaña.

Si encuentras algún problema, revisa la documentación en los archivos markdown creados o ejecuta el script de verificación.

**¡Éxito con tu proyecto! 🚀**
