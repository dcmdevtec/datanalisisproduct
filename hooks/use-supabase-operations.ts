import { useCallback, useRef } from 'react'
import { useSupabase } from '@/components/supabase-provider'

interface UseSupabaseOperationsOptions {
  // Si es true, usa caché para operaciones de lectura
  enableCache?: boolean
  // Tiempo de vida del caché en ms
  cacheTTL?: number
  // Si es true, reintenta operaciones fallidas automáticamente
  autoRetry?: boolean
  // Número máximo de reintentos
  maxRetries?: number
  // Delay entre reintentos en ms
  retryDelay?: number
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export function useSupabaseOperations(options: UseSupabaseOperationsOptions = {}) {
  const {
    enableCache = true,
    cacheTTL = 300000, // 5 minutos por defecto
    autoRetry = true,
    maxRetries = 2,
    retryDelay = 1000
  } = options

  const { supabase, supabaseReadOnly, supabaseWrite, isConnected } = useSupabase()
  const cache = useRef<Map<string, CacheEntry<any>>>(new Map())
  const retryCount = useRef<Map<string, number>>(new Map())

  // Función para limpiar caché expirado
  const cleanExpiredCache = useCallback(() => {
    const now = Date.now()
    for (const [key, entry] of cache.current.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        cache.current.delete(key)
      }
    }
  }, [])

  // Función para obtener del caché
  const getFromCache = useCallback(<T>(key: string): T | null => {
    if (!enableCache) return null
    
    cleanExpiredCache()
    const entry = cache.current.get(key)
    if (entry && Date.now() - entry.timestamp <= entry.ttl) {
      return entry.data
    }
    return null
  }, [enableCache, cleanExpiredCache])

  // Función para guardar en caché
  const setCache = useCallback(<T>(key: string, data: T, ttl?: number) => {
    if (!enableCache) return
    
    cache.current.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || cacheTTL
    })
  }, [enableCache, cacheTTL])

  // Función para invalidar caché
  const invalidateCache = useCallback((pattern?: string) => {
    if (pattern) {
      // Invalidar entradas que coincidan con el patrón
      for (const key of cache.current.keys()) {
        if (key.includes(pattern)) {
          cache.current.delete(key)
        }
      }
    } else {
      // Limpiar todo el caché
      cache.current.clear()
    }
  }, [])

  // Función para operaciones de lectura con caché
  const read = useCallback(async <T>(
    operation: () => Promise<{ data: T | null; error: any }>,
    cacheKey?: string,
    options?: { ttl?: number; skipCache?: boolean }
  ): Promise<{ data: T | null; error: any }> => {
    const { ttl, skipCache = false } = options || {}
    
    // Intentar obtener del caché si está habilitado
    if (enableCache && cacheKey && !skipCache) {
      const cachedData = getFromCache<T>(cacheKey)
      if (cachedData !== null) {
        return { data: cachedData, error: null }
      }
    }

    // Si no hay conexión, reintentar
    if (!isConnected) {
      throw new Error('No hay conexión a la base de datos')
    }

    // Ejecutar operación
    try {
      const result = await operation()
      
      // Guardar en caché si fue exitosa
      if (result.data && enableCache && cacheKey && !skipCache) {
        setCache(cacheKey, result.data, ttl)
      }
      
      return result
    } catch (error) {
      console.error('❌ Error en operación de lectura:', error)
      throw error
    }
  }, [enableCache, getFromCache, setCache, isConnected])

  // Función para operaciones de escritura
  const write = useCallback(async <T>(
    operation: () => Promise<{ data: T | null; error: any }>,
    options?: { invalidateCache?: string[]; retryOnError?: boolean }
  ): Promise<{ data: T | null; error: any }> => {
    const { invalidateCache: patterns = [], retryOnError = autoRetry } = options || {}
    
    if (!isConnected) {
      throw new Error('No hay conexión a la base de datos')
    }

    let lastError: any
    let attempts = 0
    const maxAttempts = retryOnError ? maxRetries + 1 : 1

    while (attempts < maxAttempts) {
      try {
        attempts++
        const result = await operation()
        
        // Si fue exitosa, invalidar caché relacionado
        if (result.data && patterns.length > 0) {
          patterns.forEach(pattern => invalidateCache(pattern))
        }
        
        return result
      } catch (error) {
        lastError = error
        console.error(`❌ Error en operación de escritura (intento ${attempts}/${maxAttempts}):`, error)
        
        if (attempts < maxAttempts && retryOnError) {
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      }
    }

    throw lastError
  }, [isConnected, autoRetry, maxRetries, retryDelay, invalidateCache])

  // Función para operaciones de eliminación
  const remove = useCallback(async <T>(
    operation: () => Promise<{ data: T | null; error: any }>,
    invalidatePatterns: string[] = []
  ): Promise<{ data: T | null; error: any }> => {
    return write(operation, { invalidateCache: invalidatePatterns })
  }, [write])

  // Función para operaciones en lote
  const batch = useCallback(async <T>(
    operations: Array<() => Promise<{ data: T | null; error: any }>>,
    options?: { 
      invalidateCache?: string[]
      stopOnError?: boolean
      parallel?: boolean
    }
  ): Promise<Array<{ data: T | null; error: any; success: boolean }>> => {
    const { 
      invalidateCache: patterns = [], 
      stopOnError = true, 
      parallel = false 
    } = options || {}

    if (!isConnected) {
      throw new Error('No hay conexión a la base de datos')
    }

    const results: Array<{ data: T | null; error: any; success: boolean }> = []

    if (parallel) {
      // Ejecutar operaciones en paralelo
      const promises = operations.map(async (op, index) => {
        try {
          const result = await op()
          results[index] = { ...result, success: true }
          return results[index]
        } catch (error) {
          results[index] = { data: null, error, success: false }
          if (stopOnError) throw error
          return results[index]
        }
      })

      await Promise.all(promises)
    } else {
      // Ejecutar operaciones secuencialmente
      for (let i = 0; i < operations.length; i++) {
        try {
          const result = await operations[i]()
          results[i] = { ...result, success: true }
        } catch (error) {
          results[i] = { data: null, error, success: false }
          if (stopOnError) throw error
        }
      }
    }

    // Invalidar caché si hubo operaciones exitosas
    if (patterns.length > 0 && results.some(r => r.success)) {
      patterns.forEach(pattern => invalidateCache(pattern))
    }

    return results
  }, [isConnected, invalidateCache])

  return {
    // Clientes
    supabase,
    supabaseReadOnly,
    supabaseWrite,
    
    // Estado de conexión
    isConnected,
    
    // Operaciones optimizadas
    read,
    write,
    remove,
    batch,
    
    // Gestión de caché
    getFromCache,
    setCache,
    invalidateCache,
    cleanExpiredCache,
    
    // Utilidades
    cache: cache.current,
    retryCount: retryCount.current
  }
}
