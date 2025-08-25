"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
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
import { supabase } from "@/lib/supabase-browser"
import FullTiptapEditor from "@/components/ui/FullTiptapEditor"

import { Dialog } from "@/components/ui/dialog"
import dynamic from "next/dynamic"
const TiptapEditor = dynamic(() => import("@/components/ui/tiptap-editor"), { ssr: false });

type Question = {
  id: string
  type: string
  text: string
  options: string[]
  required: boolean
  image?: string | null
  matrixCols?: string[]
  config?: {
    dropdownMulti?: boolean;
    matrixCellType?: string;
    [key: string]: any;
  }
}
type Settings = {
  collectLocation: boolean
  allowAudio: boolean
  offlineMode: boolean
  distributionMethods: string[]
}

export default function EditSurveyPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<string>("details")
  const [surveyTitle, setSurveyTitle] = useState<string>("")
  const [surveyDescription, setSurveyDescription] = useState<string>("")
  const [deadline, setDeadline] = useState<string>("")
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [settings, setSettings] = useState<Settings>({
    collectLocation: true,
    allowAudio: false,
    offlineMode: true,
    distributionMethods: ["app"],
  })
  const [showQuill, setShowQuill] = useState<{ [id: string]: boolean }>({})
  const [showConfig, setShowConfig] = useState<{ [id: string]: boolean }>({})

  useEffect(() => {
    const fetchSurvey = async () => {
      const { id } = params
      const { data: survey, error: surveyError } = await supabase
        .from("surveys")
        .select("*")
        .eq("id", id)
        .single()
      if (surveyError) {
        setError(surveyError.message)
        return
      }
      setSurveyTitle(survey.title)
      setSurveyDescription(survey.description)
      setDeadline(survey.deadline || "")
      if (survey.settings) setSettings(survey.settings)
      // Cargar preguntas
      const { data: questionsData } = await supabase
        .from("questions")
        .select("*")
        .eq("survey_id", id)
        .order("order_num", { ascending: true })
      setQuestions(
        (questionsData || []).map((q: any) => ({
          id: q.id,
          type: q.type,
          text: q.text,
          options: q.options || [],
          required: q.required,
          image: q.file_url || null,
          matrixCols: q.matrix || [],
          config: q.settings || {},
        }))
      )
    }
    if (user && params.id) fetchSurvey()
  }, [user, params.id])

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }
  if (!user) {
    router.push("/login")
    return null
  }

  const addQuestion = (): void => {
    const newQuestion: Question = {
      id: `${Date.now()}`,
      type: "text",
      text: "",
      options: [],
      required: false,
      image: null,
      matrixCols: ["Columna 1"],
    }
    setQuestions([...questions, newQuestion])
  }
  const updateQuestion = (id: string, field: keyof Question, value: any): void => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, [field]: value } : q)))
  }
  const removeQuestion = (id: string): void => {
    setQuestions(questions.filter((q) => q.id !== id))
  }
  const addOption = (questionId: string): void => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId ? { ...q, options: [...q.options, `Opción ${q.options.length + 1}`] } : q,
      ),
    )
  }
  const updateOption = (questionId: string, optionIndex: number, value: string): void => {
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
  const removeOption = (questionId: string, optionIndex: number): void => {
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
  const updateSettings = (field: keyof Settings, value: any): void => {
    setSettings({ ...settings, [field]: value })
  }

  const handleSave = async () => {
    // Validaciones igual que en create
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
      // Actualizar encuesta
      const { error: surveyError } = await supabase
        .from("surveys")
        .update({
          title: surveyTitle,
          description: surveyDescription,
          deadline,
          settings,
        })
        .eq("id", params.id)
      if (surveyError) throw surveyError
      // Actualizar preguntas: borrar y reinsertar (simple)
      await supabase.from("questions").delete().eq("survey_id", params.id)
      const questionsToInsert = questions.map((q, idx) => ({
        survey_id: params.id,
        type: q.type,
        text: q.text,
        options: q.options && q.options.length > 0 ? q.options : null,
        required: q.required,
        order_num: idx + 1,
        settings: q.config ? q.config : {},
        matrix: q.matrixCols ? q.matrixCols : null,
        comment_box: q.type === 'comment_box' ? true : false,
        rating: q.type === 'rating' && typeof q.rating === 'number' ? q.rating : null,
        file_url: q.image || null,
        style: {},
        parent_id: null,
      }))
      if (questionsToInsert.length > 0) {
        const { error: questionsError } = await supabase
          .from("questions")
          .insert(questionsToInsert)
        if (questionsError) throw questionsError
      }
      toast({
        title: "Encuesta actualizada",
        description: "Los cambios han sido guardados.",
      })
      router.push(`/surveys/${params.id}`)
    } catch (err: any) {
      setError(err.message || "Error al guardar cambios")
      toast({
        title: "Error",
        description: err.message || "Error al guardar cambios",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const renderQuestionEditor = (question: Question): React.ReactElement => {
    // Imagen
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          updateQuestion(question.id, "image", ev.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    };
    const matrixRows = question.options?.length ? question.options : ["Fila 1"];
    const matrixCols = question.matrixCols?.length ? question.matrixCols : ["Columna 1"];
    const dropdownOptions = question.options?.length ? question.options : ["Opción 1", "Opción 2"];
    return (
      <Card key={question.id} className="mb-6">
        <CardHeader className="pb-3 flex flex-row items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <Grip className="h-5 w-5 text-muted-foreground cursor-move" />
              <Select value={question.type} onValueChange={(value) => updateQuestion(question.id, "type", value)}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Tipo de pregunta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="multiple_choice">Opción múltiple única</SelectItem>
                  <SelectItem value="checkbox">Opción múltiple múltiple (Check Box)</SelectItem>
                  <SelectItem value="scale">Escala</SelectItem>
                  <SelectItem value="date">Fecha</SelectItem>
                  <SelectItem value="time">Hora</SelectItem>
                  <SelectItem value="matrix">Matriz / Tabla</SelectItem>
                  <SelectItem value="rating">Valoración</SelectItem>
                  <SelectItem value="file">Archivo</SelectItem>
                  <SelectItem value="comment_box">Comentario</SelectItem>
                  <SelectItem value="dropdown">Dropdown</SelectItem>
                  <SelectItem value="likert">Likert</SelectItem>
                  <SelectItem value="conditional">Condicional / Lógica</SelectItem>
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
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <div className="border rounded p-2 bg-background text-foreground min-h-[48px]" dangerouslySetInnerHTML={{ __html: question.text || '<span class="text-muted-foreground">Haz click en editar formato</span>' }} />
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowQuill(prev => ({ ...prev, [question.id]: true }))}>Editar formato</Button>
              <Button size="sm" variant="secondary" onClick={() => setShowConfig(prev => ({ ...prev, [question.id]: true }))}>Configuración avanzada</Button>
            </div>
            <Dialog open={!!showQuill[question.id]} onOpenChange={open => setShowQuill(prev => ({ ...prev, [question.id]: open }))}>
              {showQuill[question.id] && (
                <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center">
                  <div className="rounded-lg shadow-lg p-6 w-full max-w-2xl bg-background text-foreground">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-lg font-bold">Editor de formato avanzado</h2>
                    </div>
                    <FullTiptapEditor
                      value={question.text}
                      onChange={html => updateQuestion(question.id, "text", html)}
                      autofocus
                    />
                    <div className="flex justify-end mt-4">
                      <Button onClick={() => setShowQuill(prev => ({ ...prev, [question.id]: false }))}>Cerrar</Button>
                    </div>
                  </div>
                </div>
              )}
            </Dialog>
            <Dialog open={!!showConfig[question.id]} onOpenChange={open => setShowConfig(prev => ({ ...prev, [question.id]: open }))}>
              {showConfig[question.id] && (
                <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
                  <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg">
                    <h2 className="text-lg font-bold mb-4">Configuración avanzada</h2>
                    {/* Configuración para Dropdown */}
                    {question.type === "dropdown" && (
                      <div className="mb-4">
                        <Label>Tipo de selección</Label>
                        <div className="flex gap-4 mt-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={!question.config?.dropdownMulti}
                              onChange={() => updateQuestion(question.id, "config", { ...question.config, dropdownMulti: false })}
                            />
                            Selección única
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={!!question.config?.dropdownMulti}
                              onChange={() => updateQuestion(question.id, "config", { ...question.config, dropdownMulti: true })}
                            />
                            Selección múltiple (checkbox)
                          </label>
                        </div>
                      </div>
                    )}
                    {/* Configuración para Matriz */}
                    {question.type === "matrix" && (
                      <div className="mb-4">
                        <Label>Tipo de celda</Label>
                        <select
                          className="border rounded px-2 py-1 mt-2"
                          value={question.config?.matrixCellType || "text"}
                          onChange={e => updateQuestion(question.id, "config", { ...question.config, matrixCellType: e.target.value })}
                        >
                          <option value="text">Texto</option>
                          <option value="number">Número</option>
                          <option value="option">Opción</option>
                          <option value="checkbox">Checkbox</option>
                        </select>
                      </div>
                    )}
                    {/* Aquí puedes agregar más configuraciones para otros tipos */}
                    <div className="flex justify-end mt-4">
                      <Button onClick={() => setShowConfig(prev => ({ ...prev, [question.id]: false }))}>Cerrar</Button>
                    </div>
                  </div>
                </div>
              )}
            </Dialog>
            <div className="flex items-center gap-2 mt-2">
              {/* Imagen en editor enriquecido, botón removido */}
            </div>
          </div>

          {question.type === "matrix" && (
            <div className="space-y-2">
              <Label>Matriz / Tabla</Label>
              <div className="flex gap-4">
                <div>
                  <Label>Filas</Label>
                  {matrixRows.map((row, idx) => (
                    <Input key={idx} value={row} onChange={e => {
                      const newRows = [...matrixRows];
                      newRows[idx] = e.target.value;
                      updateQuestion(question.id, "options", newRows);
                    }} placeholder={`Fila ${idx + 1}`} />
                  ))}
                  <Button size="sm" className="mt-2" onClick={() => {
                    updateQuestion(question.id, "options", [...matrixRows, `Fila ${matrixRows.length + 1}`]);
                  }}>Agregar fila</Button>
                </div>
                <div>
                  <Label>Columnas</Label>
                  {matrixCols.map((col, idx) => (
                    <Input key={idx} value={col} onChange={e => {
                      const newCols = [...matrixCols];
                      newCols[idx] = e.target.value;
                      updateQuestion(question.id, "matrixCols", newCols);
                    }} placeholder={`Columna ${idx + 1}`} />
                  ))}
                  <Button size="sm" className="mt-2" onClick={() => {
                    updateQuestion(question.id, "matrixCols", [...matrixCols, `Columna ${matrixCols.length + 1}`]);
                  }}>Agregar columna</Button>
                </div>
              </div>
              <div className="mt-4">
                <Label>Vista previa</Label>
                <table className="border w-full">
                  <thead>
                    <tr>
                      <th></th>
                      {matrixCols.map((col, idx) => <th key={idx}>{col}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixRows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td>{row}</td>
                        {matrixCols.map((_, cIdx) => <td key={cIdx}><Input disabled placeholder="Respuesta" /></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {question.type === "dropdown" && (
            <div className="space-y-3">
              <Label>Opciones (Dropdown)</Label>
              {dropdownOptions.map((option: string, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...dropdownOptions];
                      newOptions[index] = e.target.value;
                      updateQuestion(question.id, "options", newOptions);
                    }}
                    placeholder={`Opción ${index + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const newOptions = dropdownOptions.filter((_, idx) => idx !== index);
                      updateQuestion(question.id, "options", newOptions);
                    }}
                    disabled={dropdownOptions.length <= 2}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="mt-2" onClick={() => {
                updateQuestion(question.id, "options", [...dropdownOptions, `Opción ${dropdownOptions.length + 1}`]);
              }}>
                <Plus className="h-4 w-4 mr-2" /> Agregar opción
              </Button>
              <div className="mt-2">
                <Label>Vista previa</Label>
                <select className="w-full border rounded px-2 py-1">
                  {dropdownOptions.map((opt, idx) => <option key={idx}>{opt}</option>)}
                </select>
              </div>
            </div>
          )}

          {(question.type === "multiple_choice" || question.type === "checkbox") && (
            <div className="space-y-3">
              <Label>Opciones</Label>
              {question.options.map((option: string, index: number) => (
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
                <Plus className="h-5 w-5 mr-2" /> Agregar opción
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
          <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.push(`/surveys/${params.id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold">Editar Encuesta</h1>
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
                <Button className="ml-auto gap-2" onClick={() => setActiveTab("questions")}>Siguiente <ArrowRight className="h-4 w-4" /></Button>
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
              <Button variant="outline" className="gap-2" onClick={() => setActiveTab("details")}> <ArrowLeft className="h-4 w-4" /> Anterior </Button>
              <Button className="gap-2" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" /> Guardar cambios
                  </>
                )}
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
                <Button variant="outline" className="gap-2" onClick={() => setActiveTab("questions")}> <ArrowLeft className="h-4 w-4" /> Anterior </Button>
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
