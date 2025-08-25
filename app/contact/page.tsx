"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Send } from "lucide-react"

export default function ContactPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Simulamos el envío del formulario
      await new Promise((resolve) => setTimeout(resolve, 1500))

      toast({
        title: "Mensaje enviado",
        description: "Hemos recibido tu mensaje. Te responderemos lo antes posible.",
      })

      // Limpiar el formulario
      setName("")
      setEmail("")
      setSubject("")
      setMessage("")
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo enviar tu mensaje. Por favor, intenta de nuevo más tarde.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Contacto</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Información de Contacto</h2>
          <div className="space-y-4">
            <p className="flex items-center">
              <span className="font-medium mr-2">Dirección:</span>
              <span>Av. Ejemplo 1234, Ciudad, País</span>
            </p>
            <p className="flex items-center">
              <span className="font-medium mr-2">Teléfono:</span>
              <span>+1 (555) 123-4567</span>
            </p>
            <p className="flex items-center">
              <span className="font-medium mr-2">Email:</span>
              <span>soporte@surveypro.com</span>
            </p>
            <p className="flex items-center">
              <span className="font-medium mr-2">Horario:</span>
              <span>Lunes a Viernes, 9:00 AM - 6:00 PM</span>
            </p>
          </div>

          <h2 className="text-xl font-semibold mt-8 mb-4">Preguntas Frecuentes</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">¿Cómo puedo crear una encuesta?</h3>
              <p className="text-muted-foreground">
                Inicia sesión en tu cuenta y haz clic en "Crear Encuesta" en el panel de control.
              </p>
            </div>
            <div>
              <h3 className="font-medium">¿Puedo recopilar datos sin conexión a internet?</h3>
              <p className="text-muted-foreground">
                Sí, nuestra aplicación móvil permite recopilar datos sin conexión y sincronizarlos cuando vuelvas a
                estar en línea.
              </p>
            </div>
            <div>
              <h3 className="font-medium">¿Cómo puedo exportar mis datos?</h3>
              <p className="text-muted-foreground">
                En la sección de Reportes, puedes exportar tus datos en varios formatos como Excel, CSV o PDF.
              </p>
            </div>
          </div>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Envíanos un Mensaje</CardTitle>
              <CardDescription>Completa el formulario y te responderemos lo antes posible.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Asunto</Label>
                  <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Mensaje</Label>
                  <Textarea
                    id="message"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" /> Enviar Mensaje
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
