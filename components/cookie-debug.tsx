"use client"

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { usePathname } from 'next/navigation'

export function CookieDebug() {
  const { user, session, loading } = useAuth()
  const [cookies, setCookies] = useState<string>('')
  const [localStorageData, setLocalStorageData] = useState<string>('')
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMounted(true)
    
    if (typeof window !== 'undefined') {
      // Obtener cookies
      setCookies(document.cookie)
      
      // Obtener localStorage
      const authData = window.localStorage.getItem('sb-access-token') || 'No hay datos'
      setLocalStorageData(authData)
    }
  }, [session])

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  // Evitar renderizado durante SSR para prevenir hidratación
  if (!mounted) {
    return (
      <div className="fixed top-4 left-4 z-50 w-80">
        <Card className="bg-white/95 backdrop-blur-sm border-2 border-red-200 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🍪 Debug de Cookies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-gray-500">Cargando...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed top-4 left-4 z-50 w-80 max-h-96 overflow-y-auto">
      <Card className="bg-white/95 backdrop-blur-sm border-2 border-red-200 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            🍪 Debug de Cookies
            <Badge variant={session ? "default" : "destructive"}>
              {session ? "Autenticado" : "No autenticado"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="space-y-1">
            <div className="font-semibold text-blue-600">Estado:</div>
            <div>👤 Usuario: {user ? user.email : 'No autenticado'}</div>
            <div>🔑 Sesión: {session ? 'Activa' : 'No activa'}</div>
            <div>⏳ Cargando: {loading ? 'Sí' : 'No'}</div>
          </div>

          <div className="space-y-1">
            <div className="font-semibold text-green-600">Cookies del navegador:</div>
            <div className="break-all text-xs bg-gray-100 p-2 rounded">
              {cookies || 'No hay cookies'}
            </div>
          </div>

          <div className="space-y-1">
            <div className="font-semibold text-purple-600">localStorage:</div>
            <div className="break-all text-xs bg-gray-100 p-2 rounded">
              {localStorageData.substring(0, 200)}...
            </div>
          </div>

          <div className="text-xs text-gray-500 pt-2 border-t">
            🛣️ Ruta: {pathname || 'N/A'}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
