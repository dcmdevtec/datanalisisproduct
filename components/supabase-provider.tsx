"use client"

import { supabase, supabaseReadOnly, supabaseWrite } from "@/lib/supabase/client"
import { useState, useCallback } from "react"

// Minimal provider hook for connection-status component
export function useSupabase() {
  const [isConnected, setIsConnected] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const { error } = await supabase.from("surveys").select("id").limit(1)
      const ok = !error
      setIsConnected(ok)
      return ok
    } catch {
      setIsConnected(false)
      return false
    }
  }, [])

  const reconnect = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const ok = await checkConnection()
      if (!ok) setError("No se pudo restablecer la conexión")
    } finally {
      setLoading(false)
    }
  }, [checkConnection])

  return { supabase, supabaseReadOnly, supabaseWrite, isConnected, loading, error, reconnect, checkConnection }
}
