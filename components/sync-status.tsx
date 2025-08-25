"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, WifiOff, RefreshCw } from "lucide-react"
import { offlineSync } from "@/lib/offline-sync"
import { useToast } from "@/components/ui/use-toast"

export default function SyncStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Verificar estado de conexión
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Verificar elementos pendientes
    const checkPendingItems = () => {
      const pendingItems = offlineSync.getPendingItems()
      setPendingCount(pendingItems.length)
    }

    checkPendingItems()
    const interval = setInterval(checkPendingItems, 30000) // Verificar cada 30 segundos

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      clearInterval(interval)
    }
  }, [])

  // Sincronizar automáticamente cuando vuelve a estar en línea
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      handleSync()
    }
  }, [isOnline, pendingCount])

  const handleSync = async () => {
    if (!isOnline || pendingCount === 0 || isSyncing) return

    setIsSyncing(true)
    try {
      const result = await offlineSync.syncWithServer()

      if (result.success) {
        toast({
          title: "Sincronización completada",
          description: `Se sincronizaron ${result.syncedCount} elementos correctamente.`,
        })
        setPendingCount(offlineSync.getPendingItems().length)
      } else {
        toast({
          title: "Error de sincronización",
          description: "No se pudieron sincronizar todos los elementos.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error during sync:", error)
      toast({
        title: "Error de sincronización",
        description: "Ocurrió un error durante la sincronización.",
        variant: "destructive",
      })
    } finally {
      setIsSyncing(false)
    }
  }

  if (pendingCount === 0) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-background border rounded-lg shadow-lg p-3 flex items-center gap-3">
        {!isOnline ? (
          <Badge variant="outline" className="gap-1 text-yellow-600 bg-yellow-50 border-yellow-200">
            <WifiOff className="h-3 w-3" /> Sin conexión
          </Badge>
        ) : isSyncing ? (
          <Badge variant="outline" className="gap-1 text-blue-600 bg-blue-50 border-blue-200">
            <Loader2 className="h-3 w-3 animate-spin" /> Sincronizando...
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-orange-600 bg-orange-50 border-orange-200">
            <RefreshCw className="h-3 w-3" /> Pendiente
          </Badge>
        )}

        <span className="text-sm">
          {pendingCount} {pendingCount === 1 ? "elemento" : "elementos"} sin sincronizar
        </span>

        <Button size="sm" variant="outline" onClick={handleSync} disabled={!isOnline || isSyncing}>
          {isSyncing ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Sincronizando
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3 mr-1" /> Sincronizar
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
