"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react"
import { supabase } from "@/lib/supabase-browser"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        throw error
      }

      setIsSuccess(true)
      toast({
        title: "Correo enviado",
        description: "Hemos enviado un enlace para restablecer tu contraseña.",
      })
    } catch (err) {
      console.error("Error resetting password:", err)
      setError(err instanceof Error ? err.message : "Error al enviar el correo de recuperación")
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Error al enviar el correo de recuperación",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Recuperar contraseña</CardTitle>
          <CardDescription>
            Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
          </CardDescription>
        </CardHeader>
        {isSuccess ? (
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Correo enviado</AlertTitle>
              <AlertDescription>
                Hemos enviado un enlace para restablecer tu contraseña a {email}. Por favor, revisa tu bandeja de
                entrada.
              </AlertDescription>
            </Alert>
            <div className="text-sm text-muted-foreground">
              <p>Si no recibes el correo en unos minutos:</p>
              <ul className="list-disc pl-5 mt-1">
                <li>Revisa tu carpeta de spam o correo no deseado</li>
                <li>Verifica que hayas ingresado el correo electrónico correcto</li>
                <li>Intenta nuevamente en unos minutos</li>
              </ul>
            </div>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
                  </>
                ) : (
                  "Enviar enlace de recuperación"
                )}
              </Button>
              <div className="mt-4 text-center">
                <Link href="/login" className="text-sm text-primary hover:underline inline-flex items-center">
                  <ArrowLeft className="mr-1 h-3 w-3" /> Volver a inicio de sesión
                </Link>
              </div>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}
