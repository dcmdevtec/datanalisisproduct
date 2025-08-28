"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, ArrowRight, Check, Loader2, MapPin, Mic, Save } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

type Question = {
  id: string
  type: string
  text: string
  options: string[]
  required: boolean
}

type Survey = {
  id: string
  title: string
  description: string
  status: string
  questions: Question[]
}

export default function CollectDataPage() {
  const { user, loading: authLoading } = useAuth()
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [progress, setProgress] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const surveyId = params.id as string

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    } else if (!authLoading && user && user.role !== "surveyor" && user.role !== "admin") {
      router.push("/surveys")
      toast({
        title: "Acceso restringid",
        description: "Solo los encuestadores pueden recolectar datos",
        variant: "destructive",
      })
    }
  }, [user, authLoading, router, toast])

  useEffect(() => {
    const fetchSurvey = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/surveys/${surveyId}`)
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Error al cargar la encuesta")
        }

        const data = await response.json()

        if (!data) {
          throw new Error("Encuesta no encontrada")
        }

        if (data.status !== "active") {
          throw new Error("Esta encuesta no está activa para recolección de datos")
        }

        setSurvey(data)

        // Inicializar respuestas
        const initialAnswers: Record<string, any> = {}
        data.questions.forEach((question: Question) => {
          if (question.type === "multiple_choice" || question.type === "text" || question.type === "date") {
            initialAnswers[question.id] = ""
          } else if (question.type === "checkbox") {
            initialAnswers[question.id] = []
          } else if (question.type === "scale") {
            initialAnswers[question.id] = 5
          }
        })
        setAnswers(initialAnswers)

        // Obtener ubicación
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              })
            },
            (error) => {
              console.error("Error getting location:", error)
            },
          )
        }

        // Verificar estado de conexión
        setIsOffline(!navigator.onLine)
        window.addEventListener("online", () => setIsOffline(false))
        window.addEventListener("offline", () => setIsOffline(true))
      } catch (error) {
        console.error("Error fetching survey:", error)
        setError(error.message || "No se pudo cargar la encuesta")
        toast({
          title: "Error",
          description: error.message || "No se pudo cargar la encuesta",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (user && surveyId) {
      fetchSurvey()
    }

    return () => {
      window.removeEventListener("online", () => setIsOffline(false))
      window.removeEventListener("offline", () => setIsOffline(true))
    }
  }, [user, surveyId, router, toast])

  useEffect(() => {
    if (survey && survey.questions.length > 0) {
      setProgress(Math.round((currentStep / survey.questions.length) * 100))
    }
  }, [currentStep, survey])

  const handleNext = () => {
    if (!survey) return

    const currentQuestion = survey.questions[currentStep]

    // Validar respuesta si es requerida
    if (currentQuestion.required) {
      const answer = answers[currentQuestion.id]
      if (answer === "" || (Array.isArray(answer) && answer.length === 0)) {
        toast({
          title: "Respuesta requerida",
          description: "Por favor, responde esta pregunta antes de continuar",
          variant: "destructive",
        })
        return
      }
    }

    if (currentStep < survey.questions.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }))
  }

  const handleCheckboxChange = (questionId: string, option: string, checked: boolean) => {
    setAnswers((prev) => {
      const currentAnswers = [...(prev[questionId] || [])]
      if (checked) {
        return {
          ...prev,
          [questionId]: [...currentAnswers, option],
        }
      } else {
        return {
          ...prev,
          [questionId]: currentAnswers.filter((item) => item !== option),
        }
      }
    })
  }

  const handleSubmit = async () => {
    if (!survey) return

    // Validar última respuesta si es requerida
    const lastQuestion = survey.questions[currentStep]
    if (lastQuestion.required) {
      const answer = answers[lastQuestion.id]
      if (answer === "" || (Array.isArray(answer) && answer.length === 0)) {
        toast({
          title: "Respuesta requerida",
          description: "Por favor, responde esta pregunta antes de continuar",
          variant: "destructive",
        })
        return
      }
    }

    setIsSubmitting(true)

    try {
      // Preparar datos para enviar
      const responseData = {
        survey_id: surveyId,
        answers: Object.entries(answers).map(([questionId, value]) => ({
          question_id: questionId,
          value: value,
        })),
        location: location,
        timestamp: new Date().toISOString(),
        user_id: user?.id,
      }

      // En modo offline, guardar localmente
      if (isOffline) {
        // Simulación de guardado local
        localStorage.setItem(`survey_response_${crypto.randomUUID()}`, JSON.stringify(responseData))

        toast({
          title: "Respuesta guardada localmente",
          description: "Los datos se sincronizarán cuando vuelvas a estar en línea",
        })
      } else {
        // Enviar al servidor
        const response = await fetch("/api/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(responseData),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Error al enviar respuestas")
        }

        toast({
          title: "Respuesta enviada",
          description: "Los datos han sido enviados correctamente",
        })
      }

      // Redirigir a la lista de encuestas
      router.push("/surveys")
    } catch (error) {
      console.error("Error submitting survey:", error)
      toast({
        title: "Error",
        description: "No se pudieron enviar las respuestas. Intenta nuevamente.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleRecording = () => {
    setIsRecording(!isRecording)
    // En una aplicación real, aquí iniciaríamos o detendríamos la grabación de audio
    if (!isRecording) {
      toast({
        title: "Grabación iniciada",
        description: "Se está grabando audio...",
      })
    } else {
      toast({
        title: "Grabación detenida",
        description: "La grabación de audio ha finalizado",
      })
    }
  }

  const renderQuestion = (question: Question) => {
    switch (question.type) {
      case "text":
        return (
          <div className="space-y-2">
            <Textarea
              placeholder="Escribe tu respuesta aquí..."
              value={answers[question.id] || ""}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              rows={5}
              className="w-full"
            />
          </div>
        )
      case "multiple_choice":
        return (
          <div className="space-y-2">
            <RadioGroup
              value={answers[question.id] || ""}
              onValueChange={(value) => handleAnswerChange(question.id, value)}
            >
              {question.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`option-${question.id}-${index}`} />
                  <Label htmlFor={`option-${question.id}-${index}`}>{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )
      case "checkbox":
        return (
          <div className="space-y-2">
            {question.options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox
                  id={`checkbox-${question.id}-${index}`}
                  checked={(answers[question.id] || []).includes(option)}
                  onCheckedChange={(checked) => handleCheckboxChange(question.id, option, checked as boolean)}
                />
                <Label htmlFor={`checkbox-${question.id}-${index}`}>{option}</Label>
              </div>
            ))}
          </div>
        )
      case "scale":
        return (
          <div className="space-y-4">
            <Slider
              value={[answers[question.id] || 5]}
              min={1}
              max={10}
              step={1}
              onValueChange={(value) => handleAnswerChange(question.id, value[0])}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
              <span>6</span>
              <span>7</span>
              <span>8</span>
              <span>9</span>
              <span>10</span>
            </div>
            <div className="text-center font-medium">Valor seleccionado: {answers[question.id] || 5}</div>
          </div>
        )
      case "date":
        return (
          <div className="space-y-2">
            <Input
              type="date"
              value={answers[question.id] || ""}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              className="w-full"
            />
          </div>
        )
      default:
        return <div>Tipo de pregunta no soportado</div>
    }
  }

  if (authLoading || !user) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="flex items-center mb-6">
            <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.push("/surveys")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold">Error</h1>
          </div>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button className="mt-4" onClick={() => router.push("/surveys")}>
            Volver a encuestas
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  if (!survey) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="flex items-center mb-6">
            <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.push("/surveys")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold">Encuesta no encontrada</h1>
          </div>
          <p>La encuesta que estás buscando no existe o ha sido eliminada.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.push("/surveys")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Recolectar Datos</h1>
            <p className="text-muted-foreground">{survey.title}</p>
          </div>
        </div>

        {isOffline && (
          <Alert className="mb-6">
            <MapPin className="h-4 w-4" />
            <AlertTitle>Modo Offline</AlertTitle>
            <AlertDescription>
              Estás trabajando sin conexión. Los datos se guardarán localmente y se sincronizarán cuando vuelvas a estar
              en línea.
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span>
              Pregunta {currentStep + 1} de {survey.questions.length}
            </span>
            <span>{progress}% completado</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <CardTitle className="text-xl">{survey.questions[currentStep].text}</CardTitle>
              {survey.questions[currentStep].required && (
                <Badge variant="outline" className="text-destructive border-destructive w-fit">
                  Obligatorio
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>{renderQuestion(survey.questions[currentStep])}</CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between gap-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="w-full sm:w-auto"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Anterior
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="icon"
                className={isRecording ? "bg-red-100 text-red-600 border-red-200" : ""}
                onClick={toggleRecording}
              >
                <Mic className="h-4 w-4" />
              </Button>
              {currentStep === survey.questions.length - 1 ? (
                <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" /> Finalizar
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={handleNext} className="w-full">
                  Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>

        {location && (
          <Card>
            <CardHeader>
              <CardTitle>Ubicación</CardTitle>
              <CardDescription>Datos de geolocalización</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
                  </span>
                </div>
                <div className="h-40 bg-muted/50 rounded-md flex items-center justify-center">
                  <p className="text-muted-foreground">Mapa de ubicación</p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setLocation(null)}>
                <Save className="h-4 w-4" /> Guardar ubicación
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
