import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase, supabaseReadOnly, supabaseWrite } from '@/lib/supabase/browser'
import type { Session, User } from '@supabase/supabase-js'

interface UseSupabaseStableOptions {
  // Si es true, mantiene la conexión activa incluso cuando la pestaña no está visible
  keepAlive?: boolean
  // Tiempo en ms para reintentar conexión si se pierde
  retryDelay?: number
  // Número máximo de reintentos
  maxRetries?: number
  // Si es true, usa el cliente de solo lectura para operaciones de consulta
  useReadOnlyForQueries?: boolean
}

interface UseSupabaseStableReturn {
  // Cliente principal de Supabase
  supabase: typeof supabase
  // Cliente de solo lectura (para consultas)
  supabaseReadOnly: typeof supabaseReadOnly
  // Cliente de escritura (para operaciones de modificación)
  supabaseWrite: typeof supabaseWrite
  // Estado de la conexión
  isConnected: boolean
  // Estado de la sesión
  session: Session | null
  // Usuario actual
  user: User | null
  // Estado de carga
  loading: boolean
  // Error de conexión
  error: string | null
  // Reconectar manualmente
  reconnect: () => Promise<void>
  // Verificar estado de la conexión
  checkConnection: () => Promise<boolean>
}

export function useSupabaseStable(options: UseSupabaseStableOptions = {}): UseSupabaseStableReturn {
  const {
    keepAlive = true,
    retryDelay = 5000,
    maxRetries = 3,
    useReadOnlyForQueries = true
  } = options

  const [isConnected, setIsConnected] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const retryCount = useRef(0)
  const retryTimeout = useRef<NodeJS.Timeout>()
  const keepAliveInterval = useRef<NodeJS.Timeout>()
  const isPageVisible = useRef(true)

  // Función para verificar la conexión
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      // Hacer una consulta simple para verificar la conexión
      const { data, error } = await supabase
        .from('surveys')
        .select('id')
        .limit(1)
      
      if (error) {
        console.warn('⚠️ Error de conexión a Supabase:', error.message)
        return false
      }
      
      return true
    } catch (err) {
      console.error('❌ Error crítico de conexión:', err)
      return false
    }
  }, [])

  // Función para reconectar
  const reconnect = useCallback(async (): Promise<void> => {
    if (retryCount.current >= maxRetries) {
      setError('Se alcanzó el límite máximo de reintentos')
      return
    }

    setLoading(true)
    retryCount.current++

    try {
      console.log(`🔄 Reintentando conexión (${retryCount.current}/${maxRetries})...`)
      
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

  // Función para mantener la conexión activa
  const keepConnectionAlive = useCallback(async () => {
    if (!keepAlive || !isPageVisible.current) return

    try {
      const connected = await checkConnection()
      if (!connected) {
        console.warn('⚠️ Conexión perdida, intentando reconectar...')
        setIsConnected(false)
        await reconnect()
      }
    } catch (err) {
      console.error('❌ Error en keep-alive:', err)
    }
  }, [keepAlive, checkConnection, reconnect])

  // Manejar visibilidad de la página
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageVisible.current = !document.hidden
      
      if (isPageVisible.current && keepAlive) {
        // Cuando la página vuelve a ser visible, verificar conexión
        keepConnectionAlive()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [keepAlive, keepConnectionAlive])

  // Configurar keep-alive
  useEffect(() => {
    if (keepAlive) {
      keepAliveInterval.current = setInterval(keepConnectionAlive, 30000) // Cada 30 segundos
    }

    return () => {
      if (keepAliveInterval.current) {
        clearInterval(keepAliveInterval.current)
      }
    }
  }, [keepAlive, keepConnectionAlive])

  // Configurar listener de autenticación
  useEffect(() => {
    // Obtener sesión inicial
    const getInitialSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession()
        setSession(initialSession)
        setUser(initialSession?.user ?? null)
      } catch (err) {
        console.error('❌ Error al obtener sesión inicial:', err)
        setError('Error al obtener sesión inicial')
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Configurar listener de cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Cambio de estado de autenticación:', event)
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
        
        // Si hay sesión, verificar conexión
        if (session) {
          await checkConnection()
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [checkConnection])

  // Limpiar timeouts al desmontar
  useEffect(() => {
    return () => {
      if (retryTimeout.current) {
        clearTimeout(retryTimeout.current)
      }
      if (keepAliveInterval.current) {
        clearInterval(keepAliveInterval.current)
      }
    }
  }, [])

  return {
    supabase,
    supabaseReadOnly,
    supabaseWrite,
    isConnected,
    session,
    user,
    loading,
    error,
    reconnect,
    checkConnection
  }
}
