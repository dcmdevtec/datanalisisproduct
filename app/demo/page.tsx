"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, ArrowRight, Check } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function DemoPage() {
  const [step, setStep] = useState(1)
  const [satisfaction, setSatisfaction] = useState("")
  const [improvements, setImprovements] = useState("")
  const [features, setFeatures] = useState<string[]>([])
  const [email, setEmail] = useState("")
  const [completed, setCompleted] = useState(false)
  const { toast } = useToast()

  const totalSteps = 4

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1)
    } else {
      setCompleted(true)
      toast({
        title: "Encuesta completada",
        description: "Gracias por completar la encuesta de demostración.",
      })
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleFeatureToggle = (feature: string) => {
    setFeatures((prev) => (prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]))
  }

  const handleReset = () => {
    setSatisfaction("")
    setImprovements("")
    setFeatures([])
    setEmail("")
    setStep(1)
    setCompleted(false)
  }

  return (
    <div className="min-h-screen bg-muted/50 flex flex-col">
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            SurveyPro Demo
          </Link>
          <Link href="/">
            <Button variant="ghost">Volver al Inicio</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 container py-10">
        {!completed ? (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Encuesta de Demostración</CardTitle>
              <CardDescription>
                Esta es una encuesta de demostración para mostrar las capacidades de SurveyPro
              </CardDescription>
              <div className="w-full bg-muted h-2 rounded-full mt-4">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${(step / totalSteps) * 100}%` }}
                />
              </div>
            </CardHeader>
            <CardContent>
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">¿Cómo calificarías tu experiencia con nuestra plataforma?</h2>
                  <RadioGroup value={satisfaction} onValueChange={setSatisfaction}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="muy-satisfecho" id="muy-satisfecho" />
                      <Label htmlFor="muy-satisfecho">Muy satisfecho</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="satisfecho" id="satisfecho" />
                      <Label htmlFor="satisfecho">Satisfecho</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="neutral" id="neutral" />
                      <Label htmlFor="neutral">Neutral</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="insatisfecho" id="insatisfecho" />
                      <Label htmlFor="insatisfecho">Insatisfecho</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="muy-insatisfecho" id="muy-insatisfecho" />
                      <Label htmlFor="muy-insatisfecho">Muy insatisfecho</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">¿Qué características te gustaría ver mejoradas?</h2>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="feature1"
                        checked={features.includes("interfaz")}
                        onCheckedChange={() => handleFeatureToggle("interfaz")}
                      />
                      <Label htmlFor="feature1">Interfaz de usuario</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="feature2"
                        checked={features.includes("rendimiento")}
                        onCheckedChange={() => handleFeatureToggle("rendimiento")}
                      />
                      <Label htmlFor="feature2">Rendimiento</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="feature3"
                        checked={features.includes("funcionalidades")}
                        onCheckedChange={() => handleFeatureToggle("funcionalidades")}
                      />
                      <Label htmlFor="feature3">Funcionalidades</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="feature4"
                        checked={features.includes("soporte")}
                        onCheckedChange={() => handleFeatureToggle("soporte")}
                      />
                      <Label htmlFor="feature4">Soporte técnico</Label>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">¿Tienes alguna sugerencia adicional?</h2>
                  <Textarea
                    placeholder="Escribe tus comentarios aquí..."
                    value={improvements}
                    onChange={(e) => setImprovements(e.target.value)}
                    rows={5}
                  />
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">¿Te gustaría recibir actualizaciones sobre nuestro producto?</h2>
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo electrónico (opcional)</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@correo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={handleBack} disabled={step === 1}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Anterior
              </Button>
              <Button onClick={handleNext}>
                {step === totalSteps ? "Completar" : "Siguiente"}{" "}
                {step < totalSteps && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card className="max-w-2xl mx-auto text-center">
            <CardHeader>
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>¡Gracias por completar la encuesta!</CardTitle>
              <CardDescription>
                Tu feedback es muy valioso para nosotros y nos ayuda a mejorar nuestra plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p>
                  Esta ha sido una demostración de las capacidades básicas de SurveyPro. En una implementación real,
                  podrías:
                </p>
                <ul className="text-left list-disc pl-5 space-y-1">
                  <li>Crear encuestas personalizadas con múltiples tipos de preguntas</li>
                  <li>Recopilar datos online y offline</li>
                  <li>Visualizar resultados en tiempo real</li>
                  <li>Exportar datos para análisis detallados</li>
                  <li>Asignar encuestadores a zonas geográficas específicas</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter className="flex justify-center gap-4">
              <Button variant="outline" onClick={handleReset}>
                Reiniciar Demo
              </Button>
              <Link href="/login">
                <Button>Iniciar Sesión</Button>
              </Link>
            </CardFooter>
          </Card>
        )}
      </main>

      <footer className="border-t py-6 bg-background">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">© 2024 SurveyPro. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <Link href="#" className="text-sm text-muted-foreground hover:underline">
              Términos
            </Link>
            <Link href="#" className="text-sm text-muted-foreground hover:underline">
              Privacidad
            </Link>
            <Link href="#" className="text-sm text-muted-foreground hover:underline">
              Contacto
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
