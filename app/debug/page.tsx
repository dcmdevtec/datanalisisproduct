"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase/client"
import DebugSupabase from "@/components/debug-supabase"
import { SupabaseDebug } from "@/components/supabase-debug"
import { Loader2, Bug, Database, Shield } from "lucide-react"

export default function DebugPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("connection")
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [browserInfo, setBrowserInfo] = useState<any>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }

    // Recopilar información del navegador
    setBrowserInfo({
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      online: navigator.onLine,
    })
  }, [user, authLoading, router])

  const checkTables = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const tables = [
        "surveys",
        "questions",
        "responses",
        "answers",
        "users",
        "media_files",
        "sync_records",
        "zones",
        "assignments",
        "messages",
      ]

      const results = {}

      for (const table of tables) {
        const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true })

        results[table] = {
          exists: !error,
          count: count || 0,
          error: error ? error.message : null,
        }
      }

      setResults(results)
    } catch (err) {
      console.error("Error checking tables:", err)
      setError(err.message || "Error desconocido")
    } finally {
      setIsLoading(false)
    }
  }

  const checkPolicies = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Esta consulta requiere permisos de administrador
      const { data, error } = await supabase.rpc("get_policies")

      if (error) throw error

      setResults(data)
    } catch (err) {
      console.error("Error checking policies:", err)
      setError(
        err.message || "Error desconocido al verificar políticas. Es posible que necesites permisos de administrador.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading || !user) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center mb-6">
          <h1 className="text-3xl font-bold">Herramientas de Depuración</h1>
        </div>

        <Alert className="mb-6">
          <Bug className="h-4 w-4" />
          <AlertTitle>Modo de depuración</AlertTitle>
          <AlertDescription>
            Esta página contiene herramientas para diagnosticar y solucionar problemas con la aplicación.
          </AlertDescription>
        </Alert>

        <DebugSupabase />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-1 sm:grid-cols-4">
            <TabsTrigger value="connection">Conexión</TabsTrigger>
            <TabsTrigger value="tables">Tablas</TabsTrigger>
            <TabsTrigger value="browser">Navegador</TabsTrigger>
            <TabsTrigger value="supabase-debug">Supabase Debug</TabsTrigger>
          </TabsList>

          <TabsContent value="connection">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Información de Conexión
                </CardTitle>
                <CardDescription>Detalles sobre la conexión a Supabase y la configuración</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">URL de Supabase:</h3>
                    <code className="bg-muted p-2 rounded block overflow-x-auto">
                      {process.env.NEXT_PUBLIC_SUPABASE_URL || "No configurada"}
                    </code>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">Estado de autenticación:</h3>
                    <p>
                      {user ? (
                        <span className="text-green-600">Autenticado como {user.email}</span>
                      ) : (
                        <span className="text-red-600">No autenticado</span>
                      )}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">Rol de usuario:</h3>
                    <p>{user?.role || "N/A"}</p>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">Estado de conexión a internet:</h3>
                    <p>
                      {navigator.onLine ? (
                        <span className="text-green-600">Conectado</span>
                      ) : (
                        <span className="text-red-600">Desconectado</span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tables">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Verificación de Tablas
                </CardTitle>
                <CardDescription>
                  Verifica la existencia y el número de registros en las tablas de Supabase
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                    <span>Verificando tablas...</span>
                  </div>
                ) : results ? (
                  <div className="space-y-4">
                    <div className="rounded-md border">
                      <div className="grid grid-cols-3 p-3 font-medium border-b">
                        <div>Tabla</div>
                        <div>Estado</div>
                        <div>Registros</div>
                      </div>
                      <div className="divide-y">
                        {Object.entries(results).map(([table, info]) => (
                          <div key={table} className="grid grid-cols-3 p-3 items-center">
                            <div className="font-medium">{table}</div>
                            <div>
                              {info.exists ? (
                                <span className="text-green-600">Existe</span>
                              ) : (
                                <span className="text-red-600">No existe</span>
                              )}
                            </div>
                            <div>
                              {info.exists ? info.count : "-"}
                              {info.error && <p className="text-xs text-red-600">{info.error}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-4">
                    <p className="mb-4">Haz clic en el botón para verificar las tablas de Supabase.</p>
                    <Button onClick={checkTables}>Verificar Tablas</Button>
                  </div>
                )}

                {error && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="browser">
            <Card>
              <CardHeader>
                <CardTitle>Información del Navegador</CardTitle>
                <CardDescription>Detalles sobre el navegador y el dispositivo que estás utilizando</CardDescription>
              </CardHeader>
              <CardContent>
                {browserInfo && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-medium mb-2">User Agent:</h3>
                        <p className="text-sm break-words">{browserInfo.userAgent}</p>
                      </div>

                      <div>
                        <h3 className="font-medium mb-2">Plataforma:</h3>
                        <p>{browserInfo.platform}</p>
                      </div>

                      <div>
                        <h3 className="font-medium mb-2">Idioma:</h3>
                        <p>{browserInfo.language}</p>
                      </div>

                      <div>
                        <h3 className="font-medium mb-2">Conexión:</h3>
                        <p>
                          {browserInfo.online ? (
                            <span className="text-green-600">Online</span>
                          ) : (
                            <span className="text-red-600">Offline</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">Resolución de pantalla:</h3>
                      <p>
                        {browserInfo.screenWidth} x {browserInfo.screenHeight} (Pixel Ratio:{" "}
                        {browserInfo.devicePixelRatio})
                      </p>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">Tamaño de ventana:</h3>
                      <p>
                        {browserInfo.viewportWidth} x {browserInfo.viewportHeight}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="supabase-debug">
            <Card>
              <CardHeader>
                <CardTitle>Debug de Supabase 2025</CardTitle>
                <CardDescription>Diagnóstico completo de la conexión y configuración de Supabase</CardDescription>
              </CardHeader>
              <CardContent>
                <SupabaseDebug />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
