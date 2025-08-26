"use client"

import { useAuth } from '@/components/auth-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function UserDebug() {
  const { user, session } = useAuth()

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-96 max-h-96 overflow-y-auto">
      <Card className="bg-white/95 backdrop-blur-sm border-2 border-blue-200 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            👤 Debug de Usuario
            <Badge variant={session ? "default" : "destructive"}>
              {session ? "Sesión Activa" : "Sin Sesión"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="space-y-1">
            <div className="font-semibold text-blue-600">Información Básica:</div>
            <div>🆔 ID: {user?.id || 'N/A'}</div>
            <div>📧 Email: {user?.email || 'N/A'}</div>
            <div>📱 Phone: {user?.phone || 'N/A'}</div>
          </div>

          <div className="space-y-1">
            <div className="font-semibold text-green-600">User Metadata:</div>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
              {JSON.stringify(user?.user_metadata, null, 2)}
            </pre>
          </div>

          <div className="space-y-1">
            <div className="font-semibold text-purple-600">App Metadata:</div>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
              {JSON.stringify(user?.app_metadata, null, 2)}
            </pre>
          </div>

          <div className="space-y-1">
            <div className="font-semibold text-orange-600">Rol Detectado:</div>
            <div>👑 User Metadata Role: {user?.user_metadata?.role || 'No definido'}</div>
            <div>⚙️ App Metadata Role: {user?.app_metadata?.role || 'No definido'}</div>
            <div>🎯 Rol Final: {user?.user_metadata?.role || user?.app_metadata?.role || 'user'}</div>
          </div>

          <div className="space-y-1">
            <div className="font-semibold text-red-600">Permisos:</div>
            <div>📊 Dashboard: {['admin', 'supervisor', 'user'].includes(user?.user_metadata?.role || user?.app_metadata?.role || 'user') ? '✅' : '❌'}</div>
            <div>🏢 Companies: {['admin', 'supervisor', 'user'].includes(user?.user_metadata?.role || user?.app_metadata?.role || 'user') ? '✅' : '❌'}</div>
            <div>📁 Projects: {['admin', 'supervisor', 'user'].includes(user?.user_metadata?.role || user?.app_metadata?.role || 'user') ? '✅' : '❌'}</div>
            <div>📝 Surveys: {['admin', 'supervisor', 'user'].includes(user?.user_metadata?.role || user?.app_metadata?.role || 'user') ? '✅' : '❌'}</div>
            <div>👥 Surveyors: {['admin', 'supervisor'].includes(user?.user_metadata?.role || user?.app_metadata?.role || 'user') ? '✅' : '❌'}</div>
            <div>👤 Users: {['admin'].includes(user?.user_metadata?.role || user?.app_metadata?.role || 'user') ? '✅' : '❌'}</div>
            <div>🗺️ Zones: {['admin', 'supervisor'].includes(user?.user_metadata?.role || user?.app_metadata?.role || 'user') ? '✅' : '❌'}</div>
            <div>📈 Reports: {['admin', 'supervisor', 'user'].includes(user?.user_metadata?.role || user?.app_metadata?.role || 'user') ? '✅' : '❌'}</div>
            <div>💬 Messages: {['admin', 'supervisor', 'user'].includes(user?.user_metadata?.role || user?.app_metadata?.role || 'user') ? '✅' : '❌'}</div>
            <div>⚙️ Settings: {['admin'].includes(user?.user_metadata?.role || user?.app_metadata?.role || 'user') ? '✅' : '❌'}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
