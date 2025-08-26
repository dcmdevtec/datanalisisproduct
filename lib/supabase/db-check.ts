import { supabase } from './client'

// Función para verificar la conexión a la base de datos
export async function checkDatabaseConnection() {
  try {
    console.log('🔍 Verificando conexión a la base de datos...')
    
    // Verificar que las variables de entorno estén disponibles
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error('❌ Variables de entorno de Supabase no configuradas')
    }
    
    console.log('✅ Variables de entorno configuradas')
    console.log('🌐 URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('🔑 Anon Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...')
    
    // Verificar conexión haciendo una consulta simple
    const { data, error } = await supabase
      .from('surveys')
      .select('id')
      .limit(1)
    
    if (error) {
      console.error('❌ Error de conexión a la base de datos:', error.message)
      return { success: false, error: error.message }
    }
    
    console.log('✅ Conexión a la base de datos exitosa')
    console.log('📊 Datos de prueba:', data)
    
    return { success: true, data }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
    console.error('❌ Error crítico verificando conexión:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

// Función para verificar tablas específicas
export async function checkTableAccess() {
  try {
    console.log('🔍 Verificando acceso a tablas...')
    
    // Verificar tabla surveyors
    const { data: surveyorsData, error: surveyorsError } = await supabase
      .from('surveyors')
      .select('id, name, email')
      .limit(1)
    
    if (surveyorsError) {
      console.error('❌ Error accediendo a tabla surveyors:', surveyorsError.message)
    } else {
      console.log('✅ Tabla surveyors accesible:', surveyorsData)
    }
    
    // Verificar tabla zones
    const { data: zonesData, error: zonesError } = await supabase
      .from('zones')
      .select('id, name, geometry')
      .limit(1)
    
    if (zonesError) {
      console.error('❌ Error accediendo a tabla zones:', zonesError.message)
    } else {
      console.log('✅ Tabla zones accesible:', zonesData)
    }
    
    // Verificar tabla surveys
    const { data: surveysData, error: surveysError } = await supabase
      .from('surveys')
      .select('id, title')
      .limit(1)
    
    if (surveysError) {
      console.error('❌ Error accediendo a tabla surveys:', surveysError.message)
    } else {
      console.log('✅ Tabla surveys accesible:', surveysData)
    }
    
    return {
      surveyors: { success: !surveyorsError, error: surveyorsError?.message },
      zones: { success: !zonesError, error: zonesError?.message },
      surveys: { success: !surveysError, error: surveysError?.message }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
    console.error('❌ Error crítico verificando tablas:', errorMessage)
    return { error: errorMessage }
  }
}

// Función para verificar permisos de usuario
export async function checkUserPermissions() {
  try {
    console.log('🔍 Verificando permisos de usuario...')
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('❌ Error obteniendo usuario:', userError.message)
      return { success: false, error: userError.message }
    }
    
    if (!user) {
      console.log('👤 No hay usuario autenticado')
      return { success: false, error: 'No hay usuario autenticado' }
    }
    
    console.log('✅ Usuario autenticado:', user.email)
    console.log('🆔 User ID:', user.id)
    console.log('📧 Email:', user.email)
    
    // Verificar sesión
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.warn('⚠️ Warning obteniendo sesión:', sessionError.message)
    } else if (session) {
      console.log('✅ Sesión válida')
      console.log('⏰ Expira en:', new Date(session.expires_at! * 1000).toLocaleString())
    }
    
    return { success: true, user, session }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
    console.error('❌ Error crítico verificando permisos:', errorMessage)
    return { success: false, error: errorMessage }
  }
}
