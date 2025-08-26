# 🚀 Configuración de Supabase 2025

## 📋 **Variables de Entorno Requeridas**

Crea un archivo `.env.local` en la raíz de tu proyecto con las siguientes variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Database Configuration (opcional)
DATABASE_URL=postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres

# Service Role Key (para operaciones administrativas)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Debug y Logging (opcional)
NEXT_PUBLIC_DEBUG=true
```

## 🔧 **Cómo Obtener las Credenciales**

### **1. Ir a tu Dashboard de Supabase**
- Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
- Selecciona tu proyecto

### **2. Obtener la URL del Proyecto**
- Ve a **Settings** → **API**
- Copia la **Project URL**

### **3. Obtener la Anon Key**
- En la misma página de **Settings** → **API**
- Copia la **anon public** key

### **4. Obtener la Service Role Key**
- En la misma página de **Settings** → **API**
- Copia la **service_role** key (mantén esta segura)

## 🗄️ **Verificar la Base de Datos**

### **1. Verificar que las Tablas Existan**
Asegúrate de que las siguientes tablas existan en tu base de datos:

```sql
-- Tabla de encuestas
CREATE TABLE IF NOT EXISTS surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de encuestadores
CREATE TABLE IF NOT EXISTS surveyors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de zonas
CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  geometry GEOMETRY(POLYGON, 4326),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### **2. Verificar Políticas de Seguridad (RLS)**
Asegúrate de que las políticas de seguridad estén configuradas correctamente:

```sql
-- Habilitar RLS en las tablas
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveyors ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;

-- Política básica para usuarios autenticados
CREATE POLICY "Users can view surveys" ON surveys
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view surveyors" ON surveyors
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view zones" ON zones
  FOR SELECT USING (auth.role() = 'authenticated');
```

## 🧪 **Probar la Conexión**

### **1. Usar el Componente de Debug**
- Ve a `/debug` en tu aplicación
- Selecciona el tab "Supabase Debug"
- Ejecuta el diagnóstico completo

### **2. Verificar en la Consola del Navegador**
Abre las herramientas de desarrollador y verifica que no haya errores relacionados con:
- Variables de entorno faltantes
- Errores de conexión a Supabase
- Errores de autenticación

### **3. Verificar en la Consola del Servidor**
En tu terminal donde ejecutas Next.js, verifica que no haya errores de:
- Variables de entorno no configuradas
- Errores de conexión a la base de datos
- Errores de SSR

## 🚨 **Solución de Problemas Comunes**

### **Error: "Variables de entorno no configuradas"**
```bash
# Verifica que el archivo .env.local existe
ls -la .env.local

# Verifica que las variables estén definidas
cat .env.local
```

### **Error: "Error de conexión a Supabase"**
- Verifica que la URL del proyecto sea correcta
- Verifica que la anon key sea válida
- Verifica que tu proyecto esté activo en Supabase

### **Error: "Tabla no existe"**
- Ve a tu dashboard de Supabase
- Ve a **Table Editor**
- Verifica que las tablas existan
- Si no existen, créalas usando el SQL proporcionado arriba

### **Error: "Permisos insuficientes"**
- Verifica que RLS esté habilitado
- Verifica que las políticas estén configuradas
- Verifica que el usuario esté autenticado

### **Error: "Auth session missing!"**
- **Este error es NORMAL** cuando no hay usuario autenticado
- No indica un problema real con la aplicación
- El sistema de logging está configurado para no mostrar este error
- Solo verás logs cuando haya usuarios autenticados

## 🔍 **Herramientas de Debug Disponibles**

### **1. Componente SupabaseDebug**
- Estado de conexión
- Estado de autenticación
- Verificación de tablas
- Verificación de permisos
- Variables de entorno

### **2. Página de Debug**
- `/debug` - Herramientas completas de depuración
- Verificación de conexión
- Verificación de tablas
- Información del navegador

### **3. Logs de Consola**
- Logs del cliente (navegador)
- Logs del servidor (terminal)
- Logs de middleware

### **4. Sistema de Logging Inteligente**
- **Logs automáticos** para errores críticos
- **Logs condicionales** para errores normales
- **Configuración por entorno** (dev/prod/test)
- **Filtrado automático** de errores comunes

## 📊 **Configuración de Logging**

### **Entorno de Desarrollo**
```bash
NODE_ENV=development
NEXT_PUBLIC_DEBUG=true
```
- Todos los logs habilitados
- Errores normales filtrados automáticamente
- Información detallada de conexión

### **Entorno de Producción**
```bash
NODE_ENV=production
NEXT_PUBLIC_DEBUG=false
```
- Solo logs críticos
- Errores normales silenciados
- Rendimiento optimizado

### **Entorno de Testing**
```bash
NODE_ENV=test
NEXT_PUBLIC_DEBUG=false
```
- Logs mínimos para testing
- Errores silenciados
- Foco en funcionalidad

## 📚 **Recursos Adicionales**

- [Documentación oficial de Supabase](https://supabase.com/docs)
- [Guía de Next.js con Supabase](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs)
- [Configuración de RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Variables de entorno en Next.js](https://nextjs.org/docs/basic-features/environment-variables)

---

**🎯 Resultado**: Con esta configuración, tu aplicación debería conectarse correctamente a Supabase, no deberías ver más errores de conexión, y el sistema de logging inteligente filtrará automáticamente los errores normales como "Auth session missing!".
