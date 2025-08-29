"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase-browser"
import { useAuth } from "@/components/auth-provider"
import SupabaseConnectionTest from "@/components/supabase-connection-test"
import { Loader2, ShieldCheck, Table } from "lucide-react"

export default function DiagnosticoPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState("connection")
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Diagnóstico de Supabase</h1>
      <p className="text-muted-foreground mb-8">
        Utiliza esta herramienta para diagnosticar problemas con la conexión a Supabase y la configuración de la base de
        datos.
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="connection">Conexión</TabsTrigger>
          <TabsTrigger value="tables">Tablas</TabsTrigger>
          <TabsTrigger value="policies">Políticas</TabsTrigger>
        </TabsList>

        <TabsContent value="connection">
          <SupabaseConnectionTest />
        </TabsContent>

        <TabsContent value="tables">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Table className="h-5 w-5" />
                Verificación de Tablas
              </CardTitle>
              <CardDescription>
                Verifica la existencia y el número de registros en las tablas de Supabase
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!user ? (
                <Alert>
                  <AlertTitle>Autenticación requerida</AlertTitle>
                  <AlertDescription>Debes iniciar sesión para verificar las tablas.</AlertDescription>
                </Alert>
              ) : isLoading ? (
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

        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Verificación de Políticas
              </CardTitle>
              <CardDescription>Verifica las políticas de seguridad (RLS) configuradas en Supabase</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                  <span>Verificando políticas...</span>
                </div>
              ) : results ? (
                <div className="space-y-4">
                  <div className="rounded-md border">
                    <div className="grid grid-cols-4 p-3 font-medium border-b">
                      <div>Tabla</div>
                      <div>Política</div>
                      <div>Operación</div>
                      <div>Roles</div>
                    </div>
                    <div className="divide-y">
                      {results.map((policy, index) => (
                        <div key={index} className="grid grid-cols-4 p-3 items-center">
                          <div>{policy.table}</div>
                          <div>{policy.name}</div>
                          <div>{policy.action}</div>
                          <div>{policy.roles.join(", ")}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center p-4">
                  <p className="mb-4">Haz clic en el botón para verificar las políticas de seguridad.</p>
                  <Button onClick={checkPolicies}>Verificar Políticas</Button>
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
      </Tabs>
    </div>
  )
}
