"use client"

import { createContext, useContext, type ReactNode } from 'react'
import { useSupabaseStable } from '@/hooks/use-supabase-stable'

interface SupabaseContextType {
  // Cliente principal de Supabase
  supabase: ReturnType<typeof useSupabaseStable>['supabase']
  // Cliente de solo lectura (para consultas)
  supabaseReadOnly: ReturnType<typeof useSupabaseStable>['supabaseReadOnly']
  // Cliente de escritura (para operaciones de modificación)
  supabaseWrite: ReturnType<typeof useSupabaseStable>['supabaseWrite']
  // Estado de la conexión
  isConnected: boolean
  // Estado de la sesión
  session: ReturnType<typeof useSupabaseStable>['session']
  // Usuario actual
  user: ReturnType<typeof useSupabaseStable>['user']
  // Estado de carga
  loading: boolean
  // Error de conexión
  error: string | null
  // Reconectar manualmente
  reconnect: () => Promise<void>
  // Verificar estado de la conexión
  checkConnection: () => Promise<boolean>
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined)

export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error('useSupabase debe usarse dentro de SupabaseProvider')
  }
  return context
}

interface SupabaseProviderProps {
  children: ReactNode
  // Opciones de configuración
  keepAlive?: boolean
  retryDelay?: number
  maxRetries?: number
  useReadOnlyForQueries?: boolean
}

export function SupabaseProvider({ 
  children, 
  keepAlive = true,
  retryDelay = 5000,
  maxRetries = 3,
  useReadOnlyForQueries = true
}: SupabaseProviderProps) {
  const supabaseData = useSupabaseStable({
    keepAlive,
    retryDelay,
    maxRetries,
    useReadOnlyForQueries
  })

  return (
    <SupabaseContext.Provider value={supabaseData}>
      {children}
    </SupabaseContext.Provider>
  )
}
