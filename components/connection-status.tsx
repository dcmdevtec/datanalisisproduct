"use client"

import { useState, useEffect } from 'react'
import { useSupabase } from '@/components/supabase-provider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface ConnectionStatusProps {
  // Si es true, muestra el componente completo
  showFull?: boolean
  // Si es true, muestra solo el badge
  showBadgeOnly?: boolean
  // Posición del componente
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  // Si es true, se oculta automáticamente cuando la conexión es estable
  autoHide?: boolean
}

export function ConnectionStatus({ 
  showFull = false, 
  showBadgeOnly = false,
  position = 'top-right',
  autoHide = true
}: ConnectionStatusProps) {
  const { isConnected, loading, error, reconnect, checkConnection } = useSupabase()
  const { toast } = useToast()
  const [showStatus, setShowStatus] = useState(true)
  const [lastCheck, setLastCheck] = useState<Date>(new Date())

  // Ocultar automáticamente si la conexión es estable
  useEffect(() => {
    if (autoHide && isConnected && !error && !loading) {
      const timer = setTimeout(() => {
        setShowStatus(false)
      }, 3000)
      return () => clearTimeout(timer)
    } else {
      setShowStatus(true)
    }
  }, [isConnected, error, loading, autoHide])

  // Verificar conexión periódicamente
  useEffect(() => {
    const interval = setInterval(async () => {
      await checkConnection()
      setLastCheck(new Date())
    }, 60000) // Cada minuto

    return () => clearInterval(interval)
  }, [checkConnection])

  // Manejar reconexión manual
  const handleReconnect = async () => {
    try {
      await reconnect()
      toast({
        title: "Reconexión exitosa",
        description: "La conexión se ha restablecido correctamente",
      })
    } catch (error) {
      toast({
        title: "Error de reconexión",
        description: "No se pudo restablecer la conexión",
        variant: "destructive",
      })
    }
  }

  // Si solo mostrar badge
  if (showBadgeOnly) {
    return (
      <Badge 
        variant={isConnected ? "default" : "destructive"}
        className="fixed z-50 cursor-pointer"
        style={{
          top: position.includes('top') ? '1rem' : 'auto',
          bottom: position.includes('bottom') ? '1rem' : 'auto',
          left: position.includes('left') ? '1rem' : 'auto',
          right: position.includes('right') ? '1rem' : 'auto',
        }}
        onClick={() => setShowStatus(!showStatus)}
      >
        {isConnected ? (
          <>
            <Wifi className="w-3 h-3 mr-1" />
            Conectado
          </>
        ) : (
          <>
            <WifiOff className="w-3 h-3 mr-1" />
            Desconectado
          </>
        )}
      </Badge>
    )
  }

  // Si no mostrar estado o conexión estable
  if (!showStatus || (!error && isConnected && !loading)) {
    return null
  }

  return (
    <div 
      className="fixed z-50 p-4 max-w-sm"
      style={{
        top: position.includes('top') ? '1rem' : 'auto',
        bottom: position.includes('bottom') ? '1rem' : 'auto',
        left: position.includes('left') ? '1rem' : 'auto',
        right: position.includes('right') ? '1rem' : 'auto',
      }}
    >
      <Alert className={isConnected ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <div>
              <h4 className="font-medium text-sm">
                {isConnected ? "Conexión estable" : "Problema de conexión"}
              </h4>
              {error && (
                <AlertDescription className="text-xs text-red-600 mt-1">
                  {error}
                </AlertDescription>
              )}
              {loading && (
                <AlertDescription className="text-xs text-blue-600 mt-1">
                  Verificando conexión...
                </AlertDescription>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Última verificación: {lastCheck.toLocaleTimeString()}
              </p>
            </div>
          </div>
          
          {!isConnected && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleReconnect}
              disabled={loading}
              className="ml-2"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Reconectar
            </Button>
          )}
        </div>
      </Alert>
    </div>
  )
}

// Hook para usar el estado de conexión en otros componentes
export function useConnectionStatus() {
  const { isConnected, loading, error, reconnect, checkConnection } = useSupabase()
  
  return {
    isConnected,
    loading,
    error,
    reconnect,
    checkConnection,
    // Utilidades
    isStable: isConnected && !error && !loading,
    needsAttention: !isConnected || error,
    canRetry: !isConnected && !loading
  }
}
