"use client"

import { useState, useEffect } from 'react'
import { useSupabase } from './supabase-provider'
import { checkDatabaseConnection, checkTableAccess, checkUserPermissions } from '@/lib/supabase/db-check'

export function SupabaseDebug() {
  const { supabase, isConnected, session, user, isSSRReady, error } = useSupabase()
  const [dbStatus, setDbStatus] = useState<any>(null)
  const [tableStatus, setTableStatus] = useState<any>(null)
  const [userStatus, setUserStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const runDiagnostics = async () => {
    setLoading(true)
    try {
      console.log('🔍 Iniciando diagnóstico completo de Supabase...')
      
      // Verificar conexión a la base de datos
      const dbResult = await checkDatabaseConnection()
      setDbStatus(dbResult)
      
      // Verificar acceso a tablas
      const tableResult = await checkTableAccess()
      setTableStatus(tableResult)
      
      // Verificar permisos de usuario
      const userResult = await checkUserPermissions()
      setUserStatus(userResult)
      
      console.log('✅ Diagnóstico completo completado')
    } catch (err) {
      console.error('❌ Error en diagnóstico:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isSSRReady) {
      runDiagnostics()
    }
  }, [isSSRReady])

  if (!isSSRReady) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-yellow-400 rounded-full animate-pulse"></div>
          <span className="text-yellow-800">Esperando inicialización de SSR...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">🔍 Debug de Supabase</h3>
        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Ejecutando...' : 'Ejecutar Diagnóstico'}
        </button>
      </div>

      {/* Estado de Conexión */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Estado de Conexión</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>Conexión: {isConnected ? 'Conectado' : 'Desconectado'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isSSRReady ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span>SSR: {isSSRReady ? 'Listo' : 'No listo'}</span>
            </div>
            {error && (
              <div className="text-red-600">
                Error: {error}
              </div>
            )}
          </div>
        </div>

        {/* Estado de Autenticación */}
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Estado de Autenticación</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${session ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>Sesión: {session ? 'Activa' : 'Inactiva'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${user ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>Usuario: {user ? 'Autenticado' : 'No autenticado'}</span>
            </div>
            {user && (
              <div className="text-gray-600">
                Email: {user.email}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Estado de Base de Datos */}
      {dbStatus && (
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Estado de Base de Datos</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${dbStatus.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>Conexión: {dbStatus.success ? 'Exitosa' : 'Fallida'}</span>
            </div>
            {dbStatus.error && (
              <div className="text-red-600">
                Error: {dbStatus.error}
              </div>
            )}
            {dbStatus.data && (
              <div className="text-gray-600">
                Datos de prueba: {JSON.stringify(dbStatus.data)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Estado de Tablas */}
      {tableStatus && (
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Estado de Tablas</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${tableStatus.surveyors?.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>Surveyors</span>
              </div>
              {tableStatus.surveyors?.error && (
                <div className="text-red-600 text-xs">{tableStatus.surveyors.error}</div>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${tableStatus.zones?.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>Zones</span>
              </div>
              {tableStatus.zones?.error && (
                <div className="text-red-600 text-xs">{tableStatus.zones.error}</div>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${tableStatus.surveys?.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>Surveys</span>
              </div>
              {tableStatus.surveys?.error && (
                <div className="text-red-600 text-xs">{tableStatus.surveys.error}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Estado de Usuario */}
      {userStatus && (
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Estado de Usuario</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${userStatus.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>Autenticación: {userStatus.success ? 'Exitosa' : 'Fallida'}</span>
            </div>
            {userStatus.error && (
              <div className="text-red-600">
                Error: {userStatus.error}
              </div>
            )}
            {userStatus.user && (
              <div className="text-gray-600">
                <div>ID: {userStatus.user.id}</div>
                <div>Email: {userStatus.user.email}</div>
              </div>
            )}
            {userStatus.session && (
              <div className="text-gray-600">
                <div>Expira: {new Date(userStatus.session.expires_at! * 1000).toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Información de Variables de Entorno */}
      <div className="p-4 bg-white border border-gray-200 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Variables de Entorno</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Configurada' : 'No configurada'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>SUPABASE_ANON_KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Configurada' : 'No configurada'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
