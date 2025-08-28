"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, ArrowRight, Grip, Plus, Save, Trash2, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function CreateSurveyPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("details")
  const [surveyTitle, setSurveyTitle] = useState("")
  const [surveyDescription, setSurveyDescription] = useState("")
  const [deadline, setDeadline] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState([
    {
      id: "1",
      type: "multiple_choice",
      text: "¿Qué tan satisfecho estás con nuestro servicio?",
      options: ["Muy satisfecho", "Satisfecho", "Neutral", "Insatisfecho", "Muy insatisfecho"],
      required: true,
    },
  ])
  const [settings, setSettings] = useState({
    collectLocation: true,
    allowAudio: false,
    offlineMode: true,
    distributionMethods: ["app"],
  })

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    router.push("/login")
    return null
  }

  const addQuestion = () => {
    const newQuestion = {
      id: crypto.randomUUID(), // ✅ UUID real en lugar de timestamp
      type: "text",
      text: "",
      options: [],
      required: false,
    }
    setQuestions([...questions, newQuestion])
  }

  const updateQuestion = (id, field, value) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, [field]: value } : q)))
  }

  const removeQuestion = (id) => {
    setQuestions(questions.filter((q) => q.id !== id))
  }

  const addOption = (questionId) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId ? { ...q, options: [...q.options, `Opción ${q.options.length + 1}`] } : q,
      ),
    )
  }

  const updateOption = (questionId, optionIndex, value) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.map((opt, idx) => (idx === optionIndex ? value : opt)),
            }
          : q,
      ),
    )
  }

  const removeOption = (questionId, optionIndex) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.filter((_, idx) => idx !== optionIndex),
            }
          : q,
      ),
    )
  }

  const updateSettings = (field, value) => {
    setSettings({ ...settings, [field]: value })
  }

  const handleSave = async () => {
    // Validar datos
    if (!surveyTitle.trim()) {
      toast({
        title: "Error",
        description: "El título de la encuesta es obligatorio",
        variant: "destructive",
      })
      setActiveTab("details")
      return
    }

    if (questions.length === 0) {
      toast({
        title: "Error",
        description: "Debes agregar al menos una pregunta",
        variant: "destructive",
      })
      setActiveTab("questions")
      return
    }

    // Validar que todas las preguntas tengan texto
    const invalidQuestions = questions.filter((q) => !q.text.trim())
    if (invalidQuestions.length > 0) {
      toast({
        title: "Error",
        description: "Todas las preguntas deben tener un texto",
        variant: "destructive",
      })
      setActiveTab("questions")
      return
    }

    // Validar que las preguntas de opción múltiple tengan opciones
    const invalidOptions = questions.filter(
      (q) => (q.type === "multiple_choice" || q.type === "checkbox") && q.options.length < 2,
    )
    if (invalidOptions.length > 0) {
      toast({
        title: "Error",
        description: "Las preguntas de opción múltiple deben tener al menos 2 opciones",
        variant: "destructive",
      })
      setActiveTab("questions")
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      // Preparar datos para guardar
      const surveyData = {
        title: surveyTitle,
        description: surveyDescription,
        settings,
        deadline: deadline || null,
        questions: questions.map((q) => ({
          type: q.type,
          text: q.text,
          options: q.options || [],
          required: q.required || false,
          settings: {},
        })),
      }

      

      // Enviar a la API
      const response = await fetch("/api/surveys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(surveyData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Error al guardar la encuesta")
      }

      const data = await response.json()

      toast({
        title: "Encuesta guardada",
        description: "Tu encuesta ha sido guardada exitosamente.",
      })

      // Redirigir a la lista de encuestas
      router.push("/surveys")
    } catch (err) {
      console.error("Error al guardar encuesta:", err)
      setError(err.message || "Error al guardar la encuesta")
      toast({
        title: "Error",
        description: err.message || "Error al guardar la encuesta",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const renderQuestionEditor = (question) => {
    return (
      <Card key={question.id} className="mb-6">
        <CardHeader className="pb-3 flex flex-row items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <Grip className="h-5 w-5 text-muted-foreground cursor-move" />
              <Select value={question.type} onValueChange={(value) => updateQuestion(question.id, "type", value)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Tipo de pregunta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="multiple_choice">Opción múltiple</SelectItem>
                  <SelectItem value="checkbox">Casillas de verificación</SelectItem>
                  <SelectItem value="date">Fecha</SelectItem>
                  <SelectItem value="time">Hora</SelectItem>
                  <SelectItem value="scale">Escala</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => removeQuestion(question.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`question-${question.id}`}>Pregunta</Label>
            <Input
              id={`question-${question.id}`}
              value={question.text}
              onChange={(e) => updateQuestion(question.id, "text", e.target.value)}
              placeholder="Escribe tu pregunta"
            />
          </div>

          {(question.type === "multiple_choice" || question.type === "checkbox") && (
            <div className="space-y-3">
              <Label>Opciones</Label>
              {question.options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={option}
                    onChange={(e) => updateOption(question.id, index, e.target.value)}
                    placeholder={`Opción ${index + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(question.id, index)}
                    disabled={question.options.length <= 2}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="mt-2" onClick={() => addOption(question.id)}>
                <Plus className="h-4 w-4 mr-2" /> Agregar opción
              </Button>
            </div>
          )}

          {question.type === "scale" && (
            <div className="space-y-2">
              <Label>Rango de escala</Label>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Input type="number" placeholder="Mínimo" className="w-full sm:w-24" defaultValue={1} />
                <span className="hidden sm:inline">a</span>
                <Input type="number" placeholder="Máximo" className="w-full sm:w-24" defaultValue={5} />
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id={`required-${question.id}`}
              checked={question.required}
              onCheckedChange={(checked) => updateQuestion(question.id, "required", checked)}
            />
            <Label htmlFor={`required-${question.id}`}>Obligatorio</Label>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.push("/surveys")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold">Crear Encuesta</h1>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Detalles</TabsTrigger>
            <TabsTrigger value="questions">Preguntas</TabsTrigger>
            <TabsTrigger value="settings">Configuración</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Detalles de la encuesta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    value={surveyTitle}
                    onChange={(e) => setSurveyTitle(e.target.value)}
                    placeholder="Ingresa el título de la encuesta"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={surveyDescription}
                    onChange={(e) => setSurveyDescription(e.target.value)}
                    placeholder="Ingresa la descripción de la encuesta"
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline">Fecha límite</Label>
                  <div className="flex items-center">
                    <Input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="ml-auto gap-2" onClick={() => setActiveTab("questions")}>
                  Siguiente <ArrowRight className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="questions" className="space-y-6">
            <div className="space-y-4">
              {questions.map((question) => renderQuestionEditor(question))}

              <Button variant="outline" className="w-full py-8 border-dashed" onClick={addQuestion}>
                <Plus className="h-5 w-5 mr-2" /> Agregar pregunta
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setActiveTab("details")}>
                <ArrowLeft className="h-4 w-4" /> Anterior
              </Button>
              <Button className="gap-2" onClick={() => setActiveTab("settings")}>
                Siguiente <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de la encuesta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="collect-location"
                      checked={settings.collectLocation}
                      onCheckedChange={(checked) => updateSettings("collectLocation", checked)}
                    />
                    <Label htmlFor="collect-location">Recopilar datos de ubicación</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="allow-audio"
                      checked={settings.allowAudio}
                      onCheckedChange={(checked) => updateSettings("allowAudio", checked)}
                    />
                    <Label htmlFor="allow-audio">Permitir grabación de audio</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="offline-mode"
                      checked={settings.offlineMode}
                      onCheckedChange={(checked) => updateSettings("offlineMode", checked)}
                    />
                    <Label htmlFor="offline-mode">Habilitar modo sin conexión</Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="distribution">Métodos de distribución</Label>
                    <Select
                      value={settings.distributionMethods[0]}
                      onValueChange={(value) => updateSettings("distributionMethods", [value])}
                    >
                      <SelectTrigger id="distribution">
                        <SelectValue placeholder="Selecciona métodos de distribución" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los métodos</SelectItem>
                        <SelectItem value="link">Enlace público</SelectItem>
                        <SelectItem value="email">Correo electrónico</SelectItem>
                        <SelectItem value="qr">Código QR</SelectItem>
                        <SelectItem value="app">Solo aplicación móvil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row justify-between gap-2">
                <Button variant="outline" className="gap-2" onClick={() => setActiveTab("questions")}>
                  <ArrowLeft className="h-4 w-4" /> Anterior
                </Button>
                <Button className="gap-2" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" /> Guardar encuesta
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
