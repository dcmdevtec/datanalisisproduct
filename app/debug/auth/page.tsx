"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react"
import { supabase } from "@/lib/supabase-browser"
import DashboardLayout from "@/components/dashboard-layout"

export default function AuthDebugPage() {
  const { user, session, loading, error } = useAuth()
  const [authStatus, setAuthStatus] = useState<any>(null)
  const [checkingAuth, setCheckingAuth] = useState(false)
  const [sessionDetails, setSessionDetails] = useState<any>(null)
  const [jwtDetails, setJwtDetails] = useState<any>(null)
  const [permissionsTest, setPermissionsTest] = useState<any>(null)
  const [testingPermissions, setTestingPermissions] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    setCheckingAuth(true)
    try {
      // Verificar sesión actual
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        throw sessionError
      }

      setSessionDetails(sessionData.session)

      if (sessionData.session) {
        // Decodificar JWT
        try {
          const jwt = sessionData.session.access_token
          const parts = jwt.split(".")
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]))
            setJwtDetails(payload)
          }
        } catch (e) {
          console.error("Error decodificando JWT:", e)
        }
      }

      setAuthStatus({
        success: !!sessionData.session,
        message: sessionData.session ? "Sesión activa" : "No hay sesión activa",
      })
    } catch (error) {
      console.error("Error verificando autenticación:", error)
      setAuthStatus({
        success: false,
        message: `Error: ${error.message}`,
      })
    } finally {
      setCheckingAuth(false)
    }
  }

  const testPermissions = async () => {
    setTestingPermissions(true)
    try {
      // Test 1: Leer encuestas
      const { data: surveyData, error: surveyError } = await supabase.from("surveys").select("id, title").limit(1)

      // Test 2: Intentar crear una encuesta de prueba
      const testId = `test-${crypto.randomUUID()}`
      const { data: createData, error: createError } = await supabase
        .from("surveys")
        .insert({
          id: testId,
          title: "Test Permission Survey",
          description: "Testing admin permissions",
          created_by: user?.id,
          status: "draft",
        })
        .select()

      // Limpiar datos de prueba si se creó
      if (!createError && createData) {
        await supabase.from("surveys").delete().eq("id", testId)
      }

      setPermissionsTest({
        read: {
          success: !surveyError,
          message: surveyError ? surveyError.message : "Lectura exitosa",
          data: surveyData,
        },
        create: {
          success: !createError,
          message: createError ? createError.message : "Creación exitosa",
          data: createData,
        },
      })
    } catch (error) {
      console.error("Error probando permisos:", error)
      setPermissionsTest({
        error: error.message,
      })
    } finally {
      setTestingPermissions(false)
    }
  }

  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error) throw error

      alert("Sesión actualizada correctamente")
      window.location.reload()
    } catch (error) {
      console.error("Error al actualizar sesión:", error)
      alert(`Error al actualizar sesión: ${error.message}`)
    }
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-6">
        <h1 className="text-3xl font-bold">Diagnóstico de Autenticación</h1>

        <Card>
          <CardHeader>
            <CardTitle>Estado de autenticación</CardTitle>
            <CardDescription>Información sobre tu sesión actual</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Cargando información de usuario...</span>
              </div>
            ) : (
              <>
                <Alert variant={user ? "default" : "destructive"}>
                  <AlertTitle>Estado de usuario</AlertTitle>
                  <AlertDescription>
                    {user ? (
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Usuario autenticado</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span>No autenticado</span>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>

                {error && (
                  <Alert variant="destructive">
                    <AlertTitle>Error de autenticación</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {user && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Datos de usuario:</h3>
                    <pre className="bg-muted p-4 rounded-md overflow-auto text-sm">{JSON.stringify(user, null, 2)}</pre>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={checkAuth} disabled={checkingAuth}>
                    {checkingAuth ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" /> Verificar autenticación
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="session">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="session">Sesión</TabsTrigger>
            <TabsTrigger value="jwt">JWT</TabsTrigger>
            <TabsTrigger value="permissions">Permisos</TabsTrigger>
          </TabsList>

          <TabsContent value="session" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Detalles de sesión</CardTitle>
                <CardDescription>Información sobre tu sesión actual en Supabase</CardDescription>
              </CardHeader>
              <CardContent>
                {authStatus ? (
                  <div className="space-y-4">
                    <Alert variant={authStatus.success ? "default" : "destructive"}>
                      <AlertTitle>Estado de sesión</AlertTitle>
                      <AlertDescription>{authStatus.message}</AlertDescription>
                    </Alert>

                    {sessionDetails && (
                      <div className="space-y-2">
                        <h3 className="text-lg font-medium">Datos de sesión:</h3>
                        <pre className="bg-muted p-4 rounded-md overflow-auto text-sm">
                          {JSON.stringify(
                            {
                              user: sessionDetails.user,
                              expires_at: sessionDetails.expires_at,
                              refresh_token_expires_at: sessionDetails.refresh_token_expires_at,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <Button onClick={checkAuth} disabled={checkingAuth}>
                      {checkingAuth ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" /> Verificar sesión
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button variant="outline" onClick={refreshSession}>
                  Actualizar sesión
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="jwt" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Detalles del JWT</CardTitle>
                <CardDescription>Información decodificada del token JWT</CardDescription>
              </CardHeader>
              <CardContent>
                {jwtDetails ? (
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Payload del JWT:</h3>
                    <pre className="bg-muted p-4 rounded-md overflow-auto text-sm">
                      {JSON.stringify(jwtDetails, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <Alert>
                    <AlertTitle>No hay información JWT disponible</AlertTitle>
                    <AlertDescription>
                      No se pudo obtener o decodificar el token JWT. Asegúrate de estar autenticado.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Prueba de permisos</CardTitle>
                <CardDescription>Verifica los permisos de tu usuario actual</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={testPermissions} disabled={testingPermissions}>
                  {testingPermissions ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Probando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" /> Probar permisos
                    </>
                  )}
                </Button>

                {permissionsTest && (
                  <div className="space-y-4">
                    {permissionsTest.error ? (
                      <Alert variant="destructive">
                        <AlertTitle>Error en prueba de permisos</AlertTitle>
                        <AlertDescription>{permissionsTest.error}</AlertDescription>
                      </Alert>
                    ) : (
                      <>
                        <Alert variant={permissionsTest.read.success ? "default" : "destructive"}>
                          <AlertTitle>Permiso de lectura</AlertTitle>
                          <AlertDescription>
                            {permissionsTest.read.success ? (
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span>Lectura permitida</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span>{permissionsTest.read.message}</span>
                              </div>
                            )}
                          </AlertDescription>
                        </Alert>

                        <Alert variant={permissionsTest.create.success ? "default" : "destructive"}>
                          <AlertTitle>Permiso de creación</AlertTitle>
                          <AlertDescription>
                            {permissionsTest.create.success ? (
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span>Creación permitida</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span>{permissionsTest.create.message}</span>
                              </div>
                            )}
                          </AlertDescription>
                        </Alert>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
