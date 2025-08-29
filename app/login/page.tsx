"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import ClientLayout from "../client-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { Logo } from "@/components/ui/logo"

function LoginPageContent() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signIn, loading: authLoading, user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Debug: mostrar estado actual
  useEffect(() => {
    console.log('🔍 LoginPage - Estado actual:', { user: !!user, loading: authLoading, pathname: window.location.pathname })
  }, [user, authLoading])

  // Si ya hay usuario autenticado, redirigir al dashboard
  useEffect(() => {
    if (user && !authLoading) {
      console.log('🚀 LoginPage - Usuario autenticado, redirigiendo a dashboard')
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    
    try {
  
      await signIn(email, password)
      
      
      // Mostrar mensaje de éxito
      setError(null)
      
      // El hook useAuthRedirect se encargará de la redirección
      // No necesitamos el setTimeout manual
      
    } catch (error) {
      console.error('❌ Error en login:', error)
      setError(error instanceof Error ? error.message : "Error al iniciar sesión")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Mostrar loading si está autenticando o redirigiendo
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-sm sm:max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-center text-muted-foreground">
              Verificando sesión...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-sm sm:max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <Logo size="lg" showText={false} />
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold">Iniciar sesión en Datanalisis</CardTitle>
          <CardDescription className="text-sm sm:text-base">Ingresa tu correo y contraseña para acceder a tu cuenta</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm sm:text-base">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
                className="text-sm sm:text-base"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm sm:text-base">Contraseña</Label>
                <Link href="/forgot-password" className="text-xs sm:text-sm text-primary hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isSubmitting}
                className="text-sm sm:text-base"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col">
            <Button 
              type="submit" 
              className="w-full text-sm sm:text-base" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                "Iniciar sesión"
              )}
            </Button>
            
            <div className="mt-4 text-center space-y-2">
              <p className="text-xs sm:text-sm text-muted-foreground">
                ¿No tienes una cuenta?{" "}
                <Link href="/register" className="text-primary hover:underline">
                  Regístrate
                </Link>
              </p>
                             <div className="flex justify-center">
                 <Link 
                   href="/" 
                   className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-lg transition-all duration-200 border border-transparent hover:border-muted-foreground/20"
                 >
                   <span className="text-lg">←</span>
                   Volver a la página principal
                 </Link>
               </div>
              <p className="text-xs text-muted-foreground">Versión 1.0.0</p>
            </div>
          </CardFooter>
         </form>
       </Card>
     </div>
   )
 }

export default function LoginPage() {
  return (
    <ClientLayout>
      <LoginPageContent />
    </ClientLayout>
  )
}
