"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase-browser"
import { Loader2 } from "lucide-react"

export default function DebugSupabase() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testSupabase = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      // Verificar conexión
      console.log("Verificando conexión a Supabase...")
      const { data: pingData, error: pingError } = await supabase.from("surveys").select("count").limit(1)

      if (pingError) throw pingError

      console.log("Conexión exitosa, intentando crear un registro de prueba...")

      // Verificar autenticación
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession()

      if (authError) throw authError

      if (!session) {
        setResult({
          connection: "OK",
          auth: "No hay sesión activa",
          message: "Debes iniciar sesión para probar la creación de registros",
        })
        return
      }

      // Intentar crear un registro de prueba
      const testId = crypto.randomUUID() // ✅ UUID real en lugar de timestamp
      const { data: insertData, error: insertError } = await supabase
        .from("sync_records")
        .insert({
          id: testId,
          user_id: session.user.id,
          type: "test",
          status: "success",
          items: 0,
          details: { test: true, timestamp: new Date().toISOString() },
          created_at: new Date().toISOString(),
        })
        .select()

      if (insertError) throw insertError

      // Eliminar el registro de prueba
      await supabase.from("sync_records").delete().eq("id", testId)

      setResult({
        connection: "OK",
        auth: "OK",
        user: {
          id: session.user.id,
          email: session.user.email,
        },
        insert: "OK",
        message: "Conexión y autenticación correctas. Se pudo crear y eliminar un registro de prueba.",
      })
    } catch (err) {
      console.error("Error testing Supabase:", err)
      setError(err.message || "Error desconocido")
      setResult({
        connection: "ERROR",
        message: "No se pudo conectar a Supabase o realizar operaciones",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Depuración de Supabase</CardTitle>
        <CardDescription>Verifica la conexión y autenticación con Supabase</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
            <span>Verificando conexión...</span>
          </div>
        ) : result ? (
          <div className="space-y-4">
            <div>
              <span className="font-medium">Estado de conexión:</span>{" "}
              <span className={result.connection === "OK" ? "text-green-600" : "text-red-600"}>
                {result.connection}
              </span>
            </div>

            {result.auth && (
              <div>
                <span className="font-medium">Estado de autenticación:</span>{" "}
                <span className={result.auth === "OK" ? "text-green-600" : "text-amber-600"}>{result.auth}</span>
              </div>
            )}

            {result.user && (
              <div>
                <span className="font-medium">Usuario:</span>
                <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto">
                  {JSON.stringify(result.user, null, 2)}
                </pre>
              </div>
            )}

            {result.insert && (
              <div>
                <span className="font-medium">Prueba de inserción:</span>{" "}
                <span className={result.insert === "OK" ? "text-green-600" : "text-red-600"}>{result.insert}</span>
              </div>
            )}

            <div>
              <span className="font-medium">Mensaje:</span> <span>{result.message}</span>
            </div>
          </div>
        ) : (
          <div className="text-center p-4">
            <p className="mb-4">Haz clic en el botón para verificar la conexión a Supabase.</p>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={testSupabase} disabled={isLoading}>
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
