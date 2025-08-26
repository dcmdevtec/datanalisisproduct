import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { supabase, supabaseReadOnly, supabaseWrite } from '@/lib/supabase/client'
import type { Session, User } from '@supabase/supabase-js'

interface UseSupabaseSSROptions {
  // Si es true, mantiene la conexión activa
  keepAlive?: boolean
  // Tiempo en ms para reintentar conexión
  retryDelay?: number
  // Número máximo de reintentos
  maxRetries?: number
  // Si es true, usa el cliente de solo lectura para consultas
  useReadOnlyForQueries?: boolean
  // Si es true, implementa SSR completo
  enableSSR?: boolean
}

interface UseSupabaseSSRReturn {
  // Cliente principal de Supabase
  supabase: typeof supabase
  // Cliente de solo lectura
  supabaseReadOnly: typeof supabaseReadOnly
  // Cliente de escritura
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
  // Estado de SSR
  isSSRReady: boolean
}

export function useSupabaseSSR(options: UseSupabaseSSROptions = {}): UseSupabaseSSRReturn {
  const {
    keepAlive = true,
    retryDelay = 3000,
    maxRetries = 5,
    useReadOnlyForQueries = true,
    enableSSR = true
  } = options

  const [isConnected, setIsConnected] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSSRReady, setIsSSRReady] = useState(false)
  
  const retryCount = useRef(0)
  const retryTimeout = useRef<NodeJS.Timeout>()
  const keepAliveInterval = useRef<NodeJS.Timeout>()
  const isPageVisible = useRef(true)
  const connectionCheckInterval = useRef<NodeJS.Timeout>()

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

    const handleOnline = () => {
      console.log('🌐 Conexión de red restaurada')
      setIsConnected(true)
      setError(null)
      retryCount.current = 0
      keepConnectionAlive()
    }

    const handleOffline = () => {
      console.log('🌐 Conexión de red perdida')
      setIsConnected(false)
      setError('Conexión de red perdida')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [keepAlive, keepConnectionAlive])

  // Configurar keep-alive y verificación de conexión
  useEffect(() => {
    if (keepAlive) {
      keepAliveInterval.current = setInterval(keepConnectionAlive, 30000) // Cada 30 segundos
      connectionCheckInterval.current = setInterval(checkConnection, 60000) // Cada minuto
    }

    return () => {
      if (keepAliveInterval.current) {
        clearInterval(keepAliveInterval.current)
      }
      if (connectionCheckInterval.current) {
        clearInterval(connectionCheckInterval.current)
      }
    }
  }, [keepAlive, keepConnectionAlive, checkConnection])

  // Configurar listener de autenticación con SSR
  useEffect(() => {
    let mounted = true

    // Obtener sesión inicial
    const getInitialSession = async () => {
      try {
        // Intentar obtener sesión desde localStorage primero (SSR)
        if (enableSSR && typeof window !== 'undefined') {
          const storedSession = localStorage.getItem('supabase-auth-token')
          if (storedSession) {
            try {
              const parsedSession = JSON.parse(storedSession)
              if (parsedSession && parsedSession.access_token) {
                setSession(parsedSession)
                setUser(parsedSession.user ?? null)
                setIsSSRReady(true)
                setLoading(false)
                return
              }
            } catch (e) {
              console.warn('⚠️ Error al parsear sesión almacenada:', e)
            }
          }
        }

        // Si no hay sesión almacenada, obtener del servidor
        const { data: { session: initialSession }, error } = await supabase.auth.getSession()
        
        if (mounted) {
          if (error) {
            console.error('❌ Error al obtener sesión inicial:', error)
            setError('Error al obtener sesión inicial')
          } else {
            setSession(initialSession)
            setUser(initialSession?.user ?? null)
            setIsSSRReady(true)
          }
          setLoading(false)
        }
      } catch (err) {
        if (mounted) {
          console.error('❌ Error al obtener sesión inicial:', err)
          setError('Error al obtener sesión inicial')
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // Configurar listener de cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        
        console.log('🔄 Cambio de estado de autenticación:', event)
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
        setIsSSRReady(true)
        
        // Si hay sesión, verificar conexión
        if (session) {
          await checkConnection()
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [checkConnection, enableSSR])

  // Limpiar timeouts al desmontar
  useEffect(() => {
    return () => {
      if (retryTimeout.current) {
        clearTimeout(retryTimeout.current)
      }
      if (keepAliveInterval.current) {
        clearInterval(keepAliveInterval.current)
      }
      if (connectionCheckInterval.current) {
        clearInterval(connectionCheckInterval.current)
      }
    }
  }, [])

  // Memoizar el cliente principal para evitar recreaciones
  const memoizedSupabase = useMemo(() => supabase, [])
  const memoizedSupabaseReadOnly = useMemo(() => supabaseReadOnly, [])
  const memoizedSupabaseWrite = useMemo(() => supabaseWrite, [])

  return {
    supabase: memoizedSupabase,
    supabaseReadOnly: memoizedSupabaseReadOnly,
    supabaseWrite: memoizedSupabaseWrite,
    isConnected,
    session,
    user,
    loading,
    error,
    reconnect,
    checkConnection,
    isSSRReady
  }
}
