"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase-browser"

import { Loader2, CheckCircle, XCircle, Database } from "lucide-react"

export default function SupabaseConnectionTest() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<"authenticated" | "unauthenticated" | "unknown">("unknown")
  const [user, setUser] = useState<any>(null)

  const testConnection = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const userResponse = await supabase.auth.getUser()
      setIsConnected(!!userResponse.data.user)

      // Verificar autenticación
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession()

      if (authError) {
        throw authError
      }

      if (session) {
        setAuthStatus("authenticated")
        setUser(session.user)

        // Probar inserción de datos
        const testId = `test-${Date.now()}`
        const { error: insertError } = await supabase.from("sync_records").insert({
          id: testId,
          user_id: session.user.id,
          type: "test",
          status: "success",
          items: 0,
          details: { test: true },
          created_at: new Date().toISOString(),
        })

        if (insertError) {
          throw new Error(`Error al insertar datos de prueba: ${insertError.message}`)
        }

        // Eliminar el registro de prueba
        await supabase.from("sync_records").delete().eq("id", testId)
      } else {
        setAuthStatus("unauthenticated")
      }
    } catch (err) {
      console.error("Error testing connection:", err)
      setError(err.message || "Error desconocido")
      setIsConnected(false)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    testConnection()
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Prueba de conexión a Supabase
        </CardTitle>
        <CardDescription>Verifica la conexión a Supabase y la capacidad de guardar datos</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
            <span>Verificando conexión...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="font-medium">Estado de conexión:</span>
              {isConnected === null ? (
                <span>No verificado</span>
              ) : isConnected ? (
                <span className="flex items-center text-green-600">
                  <CheckCircle className="h-5 w-5 mr-1" /> Conectado
                </span>
              ) : (
                <span className="flex items-center text-red-600">
                  <XCircle className="h-5 w-5 mr-1" /> Desconectado
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="font-medium">Estado de autenticación:</span>
              {authStatus === "unknown" ? (
                <span>Desconocido</span>
              ) : authStatus === "authenticated" ? (
                <span className="flex items-center text-green-600">
                  <CheckCircle className="h-5 w-5 mr-1" /> Autenticado
                </span>
              ) : (
                <span className="flex items-center text-red-600">
                  <XCircle className="h-5 w-5 mr-1" /> No autenticado
                </span>
              )}
            </div>

            {user && (
              <div>
                <span className="font-medium">Usuario:</span>
                <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto">
                  {JSON.stringify(
                    {
                      id: user.id,
                      email: user.email,
                      role: user.role,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isConnected && authStatus === "authenticated" && !error && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Conexión exitosa</AlertTitle>
                <AlertDescription>
                  La conexión a Supabase está funcionando correctamente y puedes guardar datos.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={testConnection} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...
            </>
          ) : (
            "Verificar conexión"
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
