"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Plus, Trash2, Copy, ChevronDown, ChevronUp, Type, Palette, Settings } from "lucide-react"
import { Dialog } from "@/components/ui/dialog"
import FullTiptapEditor from "@/components/ui/FullTiptapEditor"
import { Badge } from "@/components/ui/badge"
import { useDebounce } from "use-debounce"
import { useToast } from "@/components/ui/use-toast"
import { AdvancedQuestionConfig } from "@/components/advanced-question-config"
import type { Question, SurveySection } from "@/types-updated"

const MapWithDrawing = dynamic(() => import("@/components/map-with-drawing"), {
  ssr: false,
})

interface QuestionEditorProps {
  question: Question
  sectionId: string
  onRemoveQuestion: (sectionId: string, questionId: string) => void
  onUpdateQuestion: (sectionId: string, questionId: string, field: keyof Question, value: any) => void
  onDuplicateQuestion: (sectionId: string, questionId: string) => void
  allSections: SurveySection[] // For skip logic targets
  qIndex: number // To display question number
}

export function QuestionEditor({
  question,
  sectionId,
  onRemoveQuestion,
  onUpdateQuestion,
  onDuplicateQuestion,
  allSections,
  qIndex,
}: QuestionEditorProps) {
  const { toast } = useToast()

  const [showQuill, setShowQuill] = useState<boolean>(false)
  const [showConfig, setShowConfig] = useState<boolean>(false)

  // Funciones para manejar el estado de los modales de manera segura
  const openQuillEditor = () => {
    setShowQuill(true)
  }

  const closeQuillEditor = () => {
    setShowQuill(false)
  }

  const openConfigEditor = () => {
    setShowConfig(true)
  }

  const closeConfigEditor = () => {
    setShowConfig(false)
  }
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const [isEditingText, setIsEditingText] = useState<boolean>(false)
  const [localQuestionText, setLocalQuestionText] = useState<string>(question.text.replace(/<[^>]*>/g, ""))
  const [isQuestionTextValid, setIsQuestionTextValid] = useState<boolean>(true)

  const [debouncedLocalQuestionText] = useDebounce(localQuestionText, 300)

  useEffect(() => {
    // Ensure debouncedLocalQuestionText is a string before calling trim()
    const currentDebouncedText = debouncedLocalQuestionText || ""

    // Validate question text
    const isValid = currentDebouncedText.trim().length > 0
    setIsQuestionTextValid(isValid)

    // Only update the parent state if the debounced text is different from the actual question text
    // and not empty (to avoid clearing text while typing)
    if (question.text.replace(/<[^>]*>/g, "") !== currentDebouncedText && currentDebouncedText.trim() !== "") {
      onUpdateQuestion(sectionId, question.id, "text", currentDebouncedText)
    }
  }, [debouncedLocalQuestionText, question.id, question.text, onUpdateQuestion, sectionId])

  // Update local text if parent question text changes (e.g., on initial load or duplicate)
  useEffect(() => {
    const cleanText = question.text.replace(/<[^>]*>/g, "")
    setLocalQuestionText(cleanText)
    setIsQuestionTextValid(cleanText.trim().length > 0)
  }, [question.text])

  const toggleQuestionExpansion = () => {
    setIsExpanded((prev) => !prev)
  }

  const handlePasteOptions = (pastedText: string, currentOptions: string[]) => {
    const lines = pastedText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (lines.length > 1) {
      onUpdateQuestion(sectionId, question.id, "options", lines)
      toast({
        title: "Opciones agregadas",
        description: `Se agregaron ${lines.length} opciones.`,
      })
      return true
    }
    return false
  }

  const getRatingEmojis = (scale: number) => {
    const emojiSets = {
      3: ["😞", "😐", "😊"],
      4: ["😞", "😐", "🙂", "😊"],
      5: ["😞", "😕", "😐", "🙂", "😊"],
      6: ["😞", "😕", "😐", "🙂", "😊", "😍"],
      7: ["😞", "😕", "😐", "🙂", "😊", "😍", "🤩"],
      10: ["😞", "😕", "😐", "🙂", "😊", "😍", "🤩", "🥰", "😘", "🤗"],
    }
    return emojiSets[scale as keyof typeof emojiSets] || emojiSets[5]
  }

  const handleAdvancedConfigSave = (newConfig: any) => {
    onUpdateQuestion(sectionId, question.id, "config", newConfig)
  }

  const matrixRows = question.matrixRows?.length ? question.matrixRows : ["Fila 1"]
  const matrixCols = question.matrixCols?.length ? question.matrixCols : ["Columna 1"]

  return (
    <Card className="mb-6 border-l-4 ">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Grip icon for drag handle - assuming it's handled by parent SortableContext */}
            <Select
              value={question.type}
              onValueChange={(value) => onUpdateQuestion(sectionId, question.id, "type", value)}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Tipo de pregunta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">📝 Texto corto *</SelectItem>
                <SelectItem value="textarea">📄 Texto largo *</SelectItem>
                <SelectItem value="multiple_choice">🔘 Opción múltiple *</SelectItem>
                <SelectItem value="checkbox">☑️ Casillas de verificación *</SelectItem>
                <SelectItem value="dropdown">📋 Lista desplegable *</SelectItem>
                <SelectItem value="scale">📊 Escala de calificación *</SelectItem>
                <SelectItem value="matrix">📋 Matriz/Tabla</SelectItem>
                <SelectItem value="ranking">🔢 Clasificación</SelectItem>
                <SelectItem value="date">📅 Fecha *</SelectItem>
                <SelectItem value="time">🕐 Hora *</SelectItem>
                <SelectItem value="email">📧 Email *</SelectItem>
                <SelectItem value="phone">📞 Teléfono *</SelectItem>
                <SelectItem value="number">🔢 Número *</SelectItem>
                <SelectItem value="rating">⭐ Valoración *</SelectItem>
                <SelectItem value="file">📎 Archivo *</SelectItem>
                <SelectItem value="image_upload">🖼️ Subir imagen *</SelectItem>
                <SelectItem value="signature">✍️ Firma *</SelectItem>
                <SelectItem value="likert">📈 Escala Likert</SelectItem>
                <SelectItem value="net_promoter">📊 Net Promoter Score *</SelectItem>
                <SelectItem value="slider">🎚️ Control deslizante *</SelectItem>
                <SelectItem value="comment_box">💬 Caja de comentarios *</SelectItem>
                <SelectItem value="star_rating">⭐ Calificación con estrellas *</SelectItem>
                <SelectItem value="demographic">👤 Demográfica *</SelectItem>
                <SelectItem value="contact_info">📧 Información de contacto *</SelectItem>
                <SelectItem value="single_textbox">📝 Una sola caja de texto *</SelectItem>
                <SelectItem value="multiple_textboxes">📝 Múltiples cajas de texto *</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant={question.required ? "destructive" : "secondary"}>
              {question.required ? "Obligatorio" : "Opcional"}
            </Badge>
          </div>
          
          {/* Nota explicativa sobre el asterisco */}
          <div className="text-xs text-muted-foreground mt-1">
            <span className="text-green-600 font-medium">*</span> Preguntas listas para usar en vista previa
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleQuestionExpansion}>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDuplicateQuestion(sectionId, question.id)}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onRemoveQuestion(sectionId, question.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`question-${question.id}`}>Pregunta</Label>

          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                variant={!isEditingText ? "default" : "outline"}
                size="sm"
                onClick={() => setIsEditingText(false)}
              >
                <Type className="h-4 w-4 mr-1" />
                Texto simple
              </Button>
              <Button variant={isEditingText ? "default" : "outline"} size="sm" onClick={() => setIsEditingText(true)}>
                <Palette className="h-4 w-4 mr-1" />
                Formato avanzado
              </Button>
            </div>

            {!isEditingText ? (
              <div className="space-y-2">
                <Input
                  value={localQuestionText}
                  onChange={(e) => setLocalQuestionText(e.target.value)}
                  placeholder="Escribe tu pregunta aquí..."
                  className={`text-lg ${!isQuestionTextValid ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                />
                {!isQuestionTextValid && (
                  <p className="text-sm text-red-500">La pregunta no puede estar vacía</p>
                )}
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <div
                    className="border rounded p-3 bg-background text-foreground min-h-[60px]"
                    dangerouslySetInnerHTML={{
                      __html:
                        question.text ||
                        '<span class="text-muted-foreground">Haz click en "Editar formato" para escribir tu pregunta</span>',
                    }}
                  />
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowQuill(true)}>
                  Editar formato
                </Button>
              </div>
            )}
          </div>

          <Dialog open={showQuill} onOpenChange={setShowQuill}>
            {showQuill && (
              <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-[999] flex items-center justify-center">
                <div className="rounded-lg shadow-lg p-6 w-full max-w-4xl bg-background text-foreground max-h-[90vh] overflow-y-auto">
                  <div className=" items-center justify-between mb-20">
                    <Button variant="ghost" onClick={() => setShowQuill(false)} className="float-right">
                      ✕
                    </Button>
                  </div>
                  <FullTiptapEditor
                    value={question.text}
                    onChange={(html) => onUpdateQuestion(sectionId, question.id, "text", html)}
                    autofocus
                  />
                  <div className="flex justify-end mt-4 gap-2">
                    <Button variant="outline" onClick={closeQuillEditor}>
                      Cancelar
                    </Button>
                    <Button onClick={closeQuillEditor}>Guardar</Button>
                  </div>
                </div>
              </div>
            )}
          </Dialog>
        </div>

        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center space-x-2">
            <Switch
              checked={question.required}
              onCheckedChange={(checked) => onUpdateQuestion(sectionId, question.id, "required", checked)}
            />

            <Label htmlFor={`required-${question.id}`}>Pregunta obligatoria</Label>
          </div>
          <Button variant="outline" size="sm" onClick={openConfigEditor}>
            <Settings className="h-4 w-4 mr-2" />
            Configuración avanzada
          </Button>
        </div>

        <AdvancedQuestionConfig
          isOpen={showConfig}
          onClose={closeConfigEditor}
          question={question}
          allSections={allSections}
          allQuestions={allSections.flatMap((s) => s.questions)}
          onSave={handleAdvancedConfigSave}
        />

        {question.type === "matrix" && (
          <div className="space-y-4 p-4 border rounded-lg">
            <Label className="text-lg font-semibold">Configuración de Matriz</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="font-medium">Filas (Preguntas)</Label>
                {matrixRows.map((row, idx) => (
                  <div key={idx} className="flex gap-2 mt-2">
                    <Input
                      value={row}
                      onChange={(e) => {
                        const newRows = [...matrixRows]
                        newRows[idx] = e.target.value
                        onUpdateQuestion(sectionId, question.id, "matrixRows", newRows)
                      }}
                      placeholder={`Fila ${idx + 1}`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newRows = matrixRows.filter((_, i) => i !== idx)
                        onUpdateQuestion(sectionId, question.id, "matrixRows", newRows)
                      }}
                      disabled={matrixRows.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 bg-transparent"
                  onClick={() => {
                    onUpdateQuestion(sectionId, question.id, "matrixRows", [
                      ...matrixRows,
                      `Fila ${matrixRows.length + 1}`,
                    ])
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" /> Agregar fila
                </Button>
              </div>
              <div>
                <Label className="font-medium">Columnas (Opciones)</Label>
                {matrixCols.map((col, idx) => (
                  <div key={idx} className="flex gap-2 mt-2">
                    <Input
                      value={col}
                      onChange={(e) => {
                        const newCols = [...matrixCols]
                        newCols[idx] = e.target.value
                        onUpdateQuestion(sectionId, question.id, "matrixCols", newCols)
                      }}
                      placeholder={`Columna ${idx + 1}`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newCols = matrixCols.filter((_, i) => i !== idx)
                        onUpdateQuestion(sectionId, question.id, "matrixCols", newCols)
                      }}
                      disabled={matrixCols.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 bg-transparent"
                  onClick={() => {
                    onUpdateQuestion(sectionId, question.id, "matrixCols", [
                      ...matrixCols,
                      `Columna ${matrixCols.length + 1}`,
                    ])
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" /> Agregar columna
                </Button>
              </div>
            </div>
            <div className="mt-4">
              <Label className="font-medium">Vista previa</Label>
              <div className="mt-2 overflow-x-auto">
                <table className="border w-full min-w-[500px]">
                  <thead>
                    <tr className="bg-muted">
                      <th className="border p-2 text-left"></th>
                      {matrixCols.map((col, idx) => (
                        <th key={idx} className="border p-2 text-center font-medium">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixRows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td className="border p-2 font-medium">{row}</td>
                        {matrixCols.map((_, cIdx) => (
                          <td key={cIdx} className="border p-2 text-center">
                            <input type="radio" disabled className="cursor-not-allowed" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {question.type === "rating" && (
          <div className="space-y-4 p-4 border rounded-lg">
            <Label className="text-lg font-semibold">Configuración de Valoración</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Escala de valoración</Label>
                <Select
                  value={question.ratingScale?.toString() || "5"}
                  onValueChange={(value) =>
                    onUpdateQuestion(sectionId, question.id, "ratingScale", Number.parseInt(value))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">1 a 3</SelectItem>
                    <SelectItem value="4">1 a 4</SelectItem>
                    <SelectItem value="5">1 a 5</SelectItem>
                    <SelectItem value="6">1 a 6</SelectItem>
                    <SelectItem value="7">1 a 7</SelectItem>
                    <SelectItem value="10">1 a 10</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={question.config?.ratingEmojis !== false}
                  onCheckedChange={(checked) =>
                    onUpdateQuestion(sectionId, question.id, "config", {
                      ...question.config,
                      ratingEmojis: checked,
                    })
                  }
                />
                <Label>Mostrar emojis</Label>
              </div>
            </div>

            <div className="mt-4">
              <Label className="font-medium">Vista previa</Label>
              <div className="flex gap-2 mt-2 p-4 border rounded-lg bg-muted/20">
                {Array.from({ length: question.ratingScale || 5 }, (_, i) => {
                  const emojis = getRatingEmojis(question.ratingScale || 5)
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      {question.config?.ratingEmojis !== false && <span className="text-2xl">{emojis[i]}</span>}
                      <button className="w-8 h-8 rounded-full border-2 border-primary hover:bg-primary hover:text-primary-foreground transition-colors">
                        {i + 1}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {question.type === "net_promoter" && (
          <div className="space-y-4 p-4 border rounded-lg">
            <Label className="text-lg font-semibold">Net Promoter Score (NPS)</Label>
            <div className="mt-4">
              <Label className="font-medium">Vista previa</Label>
              <div className="mt-2 p-4 border rounded-lg bg-muted/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Muy poco probable</span>
                  <span className="text-sm text-muted-foreground">Extremadamente probable</span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 11 }, (_, i) => (
                    <button
                      key={i}
                      className="w-8 h-8 rounded border-2 border-primary hover:bg-primary hover:text-primary-foreground transition-colors text-sm"
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {question.type === "slider" && (
          <div className="space-y-4 p-4 border rounded-lg">
            <Label className="text-lg font-semibold">Control Deslizante</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor mínimo</Label>
                <Input
                  type="number"
                  value={question.config?.scaleMin || 0}
                  onChange={(e) =>
                    onUpdateQuestion(sectionId, question.id, "config", {
                      ...question.config,
                      scaleMin: Number.parseInt(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label>Valor máximo</Label>
                <Input
                  type="number"
                  value={question.config?.scaleMax || 100}
                  onChange={(e) =>
                    onUpdateQuestion(sectionId, question.id, "config", {
                      ...question.config,
                      scaleMax: Number.parseInt(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <div className="mt-4">
              <Label className="font-medium">Vista previa</Label>
              <div className="mt-2 p-4 border rounded-lg bg-muted/20">
                <input
                  type="range"
                  min={question.config?.scaleMin || 0}
                  max={question.config?.scaleMax || 100}
                  defaultValue={(question.config?.scaleMin || 0) + (question.config?.scaleMax || 100) / 2}
                  className="w-full"
                  disabled
                />
                <div className="flex justify-between text-sm text-muted-foreground mt-1">
                  <span>{question.config?.scaleMin || 0}</span>
                  <span>{question.config?.scaleMax || 100}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {(question.type === "multiple_choice" || question.type === "checkbox" || question.type === "dropdown") && (
          <div className="space-y-3 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">Opciones de respuesta</Label>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={question.config?.allowOther || false}
                    onCheckedChange={(checked) =>
                      onUpdateQuestion(sectionId, question.id, "config", {
                        ...question.config,
                        allowOther: checked,
                      })
                    }
                  />
                  <Label className="text-sm">Permitir "Otro"</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={question.config?.randomizeOptions || false}
                    onCheckedChange={(checked) =>
                      onUpdateQuestion(sectionId, question.id, "config", {
                        ...question.config,
                        randomizeOptions: checked,
                      })
                    }
                  />
                  <Label className="text-sm">Aleatorizar</Label>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <Label className="text-sm font-medium">Pegar opciones (una por línea)</Label>
              <Textarea
                placeholder="Opción 1&#10;Opción 2&#10;Opción 3&#10;..."
                className="mt-1"
                onPaste={(e) => {
                  const pastedText = e.clipboardData.getData("text")
                  handlePasteOptions(pastedText, question.options)
                  e.preventDefault()
                }}
                onChange={(e) => {
                  const text = e.target.value
                  if (text.includes("\n")) {
                    handlePasteOptions(text, question.options)
                    e.target.value = ""
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Puedes pegar múltiples opciones separadas por saltos de línea
              </p>
            </div>

            {question.options.map((option: string, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-6 h-6 flex items-center justify-center">
                  {question.type === "multiple_choice" ? "○" : question.type === "checkbox" ? "☐" : `${index + 1}.`}
                </div>
                <Input
                  value={option}
                  onChange={(e) =>
                    onUpdateQuestion(
                      sectionId,
                      question.id,
                      "options",
                      question.options.map((opt, idx) => (idx === index ? e.target.value : opt)),
                    )
                  }
                  placeholder={`Opción ${index + 1}`}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onUpdateQuestion(
                      sectionId,
                      question.id,
                      "options",
                      question.options.filter((_, idx) => idx !== index),
                    )
                  }
                  disabled={question.options.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onUpdateQuestion(sectionId, question.id, "options", [
                  ...question.options,
                  `Opción ${question.options.length + 1}`,
                ])
              }
            >
              <Plus className="h-4 w-4 mr-2" /> Agregar opción
            </Button>

            {question.config?.allowOther && (
              <div className="flex items-center gap-2 mt-2">
                <div className="w-6 h-6 flex items-center justify-center">
                  {question.type === "multiple_choice" ? "○" : "☐"}
                </div>
                <Input
                  value={question.config?.otherText || "Otro (especificar)"}
                  onChange={(e) =>
                    onUpdateQuestion(sectionId, question.id, "config", {
                      ...question.config,
                      otherText: e.target.value,
                    })
                  }
                  placeholder="Texto para opción 'Otro'"
                  className="flex-1"
                />
              </div>
            )}
          </div>
        )}

        {question.type === "scale" && (
          <div className="space-y-4 p-4 border rounded-lg">
            <Label className="text-lg font-semibold">Configuración de Escala</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor mínimo</Label>
                <Input
                  type="number"
                  value={question.config?.scaleMin || 1}
                  onChange={(e) =>
                    onUpdateQuestion(sectionId, question.id, "config", {
                      ...question.config,
                      scaleMin: Number.parseInt(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label>Valor máximo</Label>
                <Input
                  type="number"
                  value={question.config?.scaleMax || 5}
                  onChange={(e) =>
                    onUpdateQuestion(sectionId, question.id, "config", {
                      ...question.config,
                      scaleMax: Number.parseInt(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Etiquetas de escala (opcional)</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Etiqueta mínima"
                  value={question.config?.scaleLabels?.[0] || ""}
                  onChange={(e) => {
                    const labels = question.config?.scaleLabels || ["", ""]
                    labels[0] = e.target.value
                    onUpdateQuestion(sectionId, question.id, "config", {
                      ...question.config,
                      scaleLabels: labels,
                    })
                  }}
                />
                <Input
                  placeholder="Etiqueta máxima"
                  value={question.config?.scaleLabels?.[1] || ""}
                  onChange={(e) => {
                    const labels = question.config?.scaleLabels || ["", ""]
                    labels[1] = e.target.value
                    onUpdateQuestion(sectionId, question.id, "config", {
                      ...question.config,
                      scaleLabels: labels,
                    })
                  }}
                />
              </div>
            </div>

            <div className="mt-4">
              <Label className="font-medium">Vista previa</Label>
              <div className="flex items-center gap-2 mt-2 p-4 border rounded-lg bg-muted/20">
                <span className="text-sm">{question.config?.scaleLabels?.[0] || question.config?.scaleMin || 1}</span>
                                    {Array.from(
                      { length: (question.config?.scaleMax || 5) - (question.config?.scaleMin || 1) + 1 },
                      (_: any, i: number) => (
                        <button
                          key={i}
                          className="w-8 h-8 rounded border-2 border-primary hover:bg-primary hover:text-primary-foreground transition-colors text-sm"
                        >
                          {(question.config?.scaleMin || 1) + i}
                        </button>
                      ),
                    )}
                <span className="text-sm">{question.config?.scaleLabels?.[1] || question.config?.scaleMax || 5}</span>
              </div>
            </div>
          </div>
        )}

        {question.type === "likert" && (
          <div className="space-y-4 p-4 border rounded-lg bg-gradient-to-br from-blue-50/50 to-indigo-100/50 border-blue-200">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold text-blue-800">📈 Escala Likert - Configuración</Label>
              <Badge variant="outline" className="border-blue-300 text-blue-700">
                Configura en "Configuración Avanzada"
              </Badge>
            </div>
            
                         {/* Debug info */}
             <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
               <p className="text-sm text-yellow-700">
                 🔍 <strong>Debug:</strong> Configuración actual: {JSON.stringify(question.config?.likertScale || 'No configurada')}
               </p>
             </div>
            
            <div className="space-y-4">
                             {/* Información de la configuración actual */}
               <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                 <h4 className="font-medium text-blue-800 mb-2">Configuración Actual:</h4>
                 <div className="grid grid-cols-2 gap-4 text-sm">
                   <div>
                     <span className="font-medium text-blue-700">Rango:</span>
                     <span className="ml-2 text-blue-600">
                       {question.config?.likertScale?.min || 1} - {question.config?.likertScale?.max || 5}
                     </span>
                   </div>
                   <div>
                     <span className="font-medium text-blue-700">Paso:</span>
                     <span className="ml-2 text-blue-600">
                       {question.config?.likertScale?.step || 1}
                     </span>
                   </div>
                   <div>
                     <span className="font-medium text-blue-700">Posición inicial:</span>
                     <span className="ml-2 text-blue-600">
                       {question.config?.likertScale?.startPosition === 'left' ? 'Izquierda' : 
                        question.config?.likertScale?.startPosition === 'center' ? 'Centro' : 'Derecha'}
                     </span>
                   </div>
                   <div>
                     <span className="font-medium text-blue-700">Opción "0":</span>
                     <span className="ml-2 text-blue-600">
                       {question.config?.likertScale?.showZero ? 'Sí' : 'No'}
                     </span>
                   </div>
                 </div>
               </div>

                             {/* Etiquetas configuradas */}
               {(question.config?.likertScale?.labels?.left || question.config?.likertScale?.labels?.right) && (
                 <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                   <h4 className="font-medium text-blue-800 mb-2">Etiquetas Configuradas:</h4>
                   <div className="grid grid-cols-3 gap-4 text-sm">
                     <div className="text-center">
                       <div className="font-medium text-blue-700">Izquierda</div>
                       <div className="text-blue-600">{question.config?.likertScale?.labels?.left || 'No configurada'}</div>
                     </div>
                     <div className="text-center">
                       <div className="font-medium text-blue-700">Centro</div>
                       <div className="text-blue-600">{question.config?.likertScale?.labels?.center || 'No configurada'}</div>
                     </div>
                     <div className="text-center">
                       <div className="font-medium text-blue-700">Derecha</div>
                       <div className="text-blue-600">{question.config?.likertScale?.labels?.right || 'No configurada'}</div>
                     </div>
                   </div>
                 </div>
               )}

              {/* Vista previa del control deslizante */}
              <div className="p-4 bg-white rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-3">Vista Previa del Control Deslizante:</h4>
                <div className="space-y-4">
                                     <div className="px-2">
                     <Slider
                       defaultValue={[Math.ceil((question.config?.likertScale?.max || 5) / 2)]}
                       min={question.config?.likertScale?.showZero ? 0 : (question.config?.likertScale?.min || 1)}
                       max={question.config?.likertScale?.max || 5}
                       step={question.config?.likertScale?.step || 1}
                       disabled
                       className="w-full"
                     />
                   </div>
                   <div className="flex justify-between text-xs text-blue-600 px-2">
                     {question.config?.likertScale?.showZero && (
                       <span className="text-center">
                         <div className="font-medium">0</div>
                         <div className="text-xs">{question.config?.likertScale?.zeroLabel || 'No Sabe / No Responde'}</div>
                       </span>
                     )}
                     <span className="text-center">
                       <div className="font-medium">{question.config?.likertScale?.min || 1}</div>
                       <div className="text-xs">{question.config?.likertScale?.labels?.left || 'Mínimo'}</div>
                     </span>
                     <span className="text-center font-medium">
                       Valor: {Math.ceil((question.config?.likertScale?.max || 5) / 2)}
                     </span>
                     <span className="text-center">
                       <div className="font-medium">{question.config?.likertScale?.max || 5}</div>
                       <div className="text-xs">{question.config?.likertScale?.labels?.right || 'Máximo'}</div>
                     </span>
                   </div>
                </div>
                
                                 {/* Mensaje si no hay configuración */}
                 {!question.config?.likertScale && (
                   <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                     <p className="text-sm text-yellow-700">
                       ⚠️ <strong>No hay configuración de escala Likert.</strong> Ve a "Configuración Avanzada" → "Escala Likert" para configurar tu escala.
                     </p>
                   </div>
                 )}
              </div>

              {/* Mensaje de ayuda */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">
                  💡 <strong>Para configurar completamente tu escala Likert:</strong> Ve a la pestaña "Configuración Avanzada" 
                  y selecciona "Escala Likert". Allí podrás definir rangos, etiquetas y opciones avanzadas.
                </p>
              </div>
            </div>
          </div>
        )}

        {question.type === "star_rating" && (
          <div className="space-y-4 p-4 border rounded-lg">
            <Label className="text-lg font-semibold">Configuración de Calificación con Estrellas</Label>
            <div className="space-y-4">
              <div>
                <Label>Número de estrellas</Label>
                <Select
                  value={question.config?.starCount?.toString() || "5"}
                  onValueChange={(value) =>
                    onUpdateQuestion(sectionId, question.id, "config", {
                      ...question.config,
                      starCount: Number.parseInt(value),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 estrellas</SelectItem>
                    <SelectItem value="4">4 estrellas</SelectItem>
                    <SelectItem value="5">5 estrellas</SelectItem>
                    <SelectItem value="7">7 estrellas</SelectItem>
                    <SelectItem value="10">10 estrellas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={question.config?.showLabels !== false}
                  onCheckedChange={(checked) =>
                    onUpdateQuestion(sectionId, question.id, "config", {
                      ...question.config,
                      showLabels: checked,
                    })
                  }
                />
                <Label>Mostrar etiquetas numéricas</Label>
              </div>
              <div className="mt-4">
                <Label className="font-medium">Vista previa</Label>
                <div className="mt-2 p-4 border rounded-lg bg-muted/20">
                  <div className="flex gap-1">
                    {Array.from({ length: question.config?.starCount || 5 }, (_, i) => (
                      <div key={i} className="flex flex-col items-center">
                        <span className="text-2xl text-yellow-400 cursor-pointer hover:text-yellow-500">★</span>
                        {question.config?.showLabels !== false && (
                          <span className="text-xs text-muted-foreground">{i + 1}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {question.type === "demographic" && (
          <div className="space-y-4 p-4 border rounded-lg">
            <Label className="text-lg font-semibold">Configuración Demográfica</Label>
            <div className="space-y-4">
              <div>
                <Label>Tipo de información demográfica</Label>
                <Select
                  value={question.config?.demographicType || "age"}
                  onValueChange={(value) =>
                    onUpdateQuestion(sectionId, question.id, "config", {
                      ...question.config,
                      demographicType: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="age">Edad</SelectItem>
                    <SelectItem value="gender">Género</SelectItem>
                    <SelectItem value="education">Nivel educativo</SelectItem>
                    <SelectItem value="income">Ingresos</SelectItem>
                    <SelectItem value="occupation">Ocupación</SelectItem>
                    <SelectItem value="location">Ubicación</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-4">
                <Label className="font-medium">Vista previa</Label>
                <div className="mt-2 p-4 border rounded-lg bg-muted/20">
                  {(() => {
                    const type = question.config?.demographicType || "age"
                    const options = {
                      age: ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
                      gender: ["Masculino", "Femenino", "No binario", "Prefiero no decir"],
                      education: ["Secundaria", "Técnico", "Universitario", "Postgrado"],
                      income: ["Menos de $500k", "$500k-$1M", "$1M-$2M", "$2M-$5M", "Más de $5M"],
                      occupation: ["Estudiante", "Empleado", "Independiente", "Empresario", "Jubilado"],
                      location: ["Urbana", "Suburbana", "Rural"],
                    }

                    return (
                      <div className="space-y-2">
                        {options[type as keyof typeof options].map((option, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <input type="radio" disabled className="cursor-not-allowed" />
                            <span className="text-sm">{option}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {question.type === "contact_info" && (
          <div className="space-y-4 p-4 border rounded-lg">
            <Label className="text-lg font-semibold">Configuración de Información de Contacto</Label>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={question.config?.includeFirstName !== false}
                    onCheckedChange={(checked) =>
                      onUpdateQuestion(sectionId, question.id, "config", {
                        ...question.config,
                        includeFirstName: checked,
                      })
                    }
                  />
                  <Label>Nombre</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={question.config?.includeLastName !== false}
                    onCheckedChange={(checked) =>
                      onUpdateQuestion(sectionId, question.id, "config", {
                        ...question.config,
                        includeLastName: checked,
                      })
                    }
                  />
                  <Label>Apellido</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={question.config?.includeEmail !== false}
                    onCheckedChange={(checked) =>
                      onUpdateQuestion(sectionId, question.id, "config", {
                        ...question.config,
                        includeEmail: checked,
                      })
                    }
                  />
                  <Label>Email</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={question.config?.includePhone || false}
                    onCheckedChange={(checked) =>
                      onUpdateQuestion(sectionId, question.id, "config", {
                        ...question.config,
                        includePhone: checked,
                      })
                    }
                  />
                  <Label>Teléfono</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={question.config?.includeCompany || false}
                    onCheckedChange={(checked) =>
                      onUpdateQuestion(sectionId, question.id, "config", {
                        ...question.config,
                        includeCompany: checked,
                      })
                    }
                  />
                  <Label>Empresa</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={question.config?.includeAddress || false}
                    onCheckedChange={(checked) =>
                      onUpdateQuestion(sectionId, question.id, "config", {
                        ...question.config,
                        includeAddress: checked,
                      })
                    }
                  />
                  <Label>Dirección</Label>
                </div>
              </div>
              <div className="mt-4">
                <Label className="font-medium">Vista previa</Label>
                <div className="mt-2 p-4 border rounded-lg bg-muted/20 space-y-3">
                  {question.config?.includeFirstName !== false && <Input placeholder="Nombre" disabled />}
                  {question.config?.includeLastName !== false && <Input placeholder="Apellido" disabled />}
                  {question.config?.includeEmail !== false && <Input placeholder="Email" type="email" disabled />}
                  {question.config?.includePhone && <Input placeholder="Teléfono" type="tel" disabled />}
                  {question.config?.includeCompany && <Input placeholder="Empresa" disabled />}
                  {question.config?.includeAddress && <Textarea placeholder="Dirección" disabled rows={2} />}
                </div>
              </div>
            </div>
          </div>
        )}

        {question.type === "multiple_textboxes" && (
          <div className="space-y-4 p-4 border rounded-lg">
            <Label className="text-lg font-semibold">Configuración de Múltiples Cajas de Texto</Label>
            <div className="space-y-4">
              <div>
                <Label>Etiquetas de las cajas de texto</Label>
                {(question.config?.textboxLabels || ["Etiqueta 1"]).map((label: string, index: number) => (
                  <div key={index} className="flex gap-2 mt-2">
                    <Input
                      value={label}
                      onChange={(e) => {
                        const newLabels = [...(question.config?.textboxLabels || [])]
                        newLabels[index] = e.target.value
                        onUpdateQuestion(sectionId, question.id, "config", {
                          ...question.config,
                          textboxLabels: newLabels,
                        })
                      }}
                      placeholder={`Etiqueta ${index + 1}`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newLabels = (question.config?.textboxLabels || []).filter((_, i) => i !== index)
                        onUpdateQuestion(sectionId, question.id, "config", {
                          ...question.config,
                          textboxLabels: newLabels.length > 0 ? newLabels : ["Etiqueta 1"],
                        })
                      }}
                      disabled={(question.config?.textboxLabels || []).length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 bg-transparent"
                  onClick={() => {
                    const currentLabels = question.config?.textboxLabels || ["Etiqueta 1"]
                    onUpdateQuestion(sectionId, question.id, "config", {
                      ...question.config,
                      textboxLabels: [...currentLabels, `Etiqueta ${currentLabels.length + 1}`],
                    })
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" /> Agregar caja de texto
                </Button>
              </div>
              <div className="mt-4">
                <Label className="font-medium">Vista previa</Label>
                <div className="mt-2 p-4 border rounded-lg bg-muted/20 space-y-3">
                  {(question.config?.textboxLabels || ["Etiqueta 1"]).map((label: string, i: number) => (
                    <div key={i} className="space-y-1">
                      <Label className="text-sm">{label}</Label>
                      <Input placeholder={`Ingresa ${label.toLowerCase()}`} disabled />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {question.type === "text" && (
          <div className="p-4 border rounded-lg bg-muted/20">
            <Label className="font-medium">Vista previa</Label>
            <Input placeholder="Respuesta de texto corto..." disabled className="mt-2" />
          </div>
        )}

        {question.type === "textarea" && (
          <div className="p-4 border rounded-lg bg-muted/20">
            <Label className="font-medium">Vista previa</Label>
            <Textarea placeholder="Respuesta de texto largo..." disabled className="mt-2" rows={3} />
          </div>
        )}

        {question.type === "date" && (
          <div className="p-4 border rounded-lg bg-muted/20">
            <Label className="font-medium">Vista previa</Label>
            <Input type="date" disabled className="mt-2 w-fit" />
          </div>
        )}

        {question.type === "time" && (
          <div className="p-4 border rounded-lg bg-muted/20">
            <Label className="font-medium">Vista previa</Label>
            <Input type="time" disabled className="mt-2 w-fit" />
          </div>
        )}

        {question.type === "email" && (
          <div className="p-4 border rounded-lg bg-muted/20">
            <Label className="font-medium">Vista previa</Label>
            <Input type="email" placeholder="ejemplo@correo.com" disabled className="mt-2" />
          </div>
        )}

        {question.type === "phone" && (
          <div className="p-4 border rounded-lg bg-muted/20">
            <Label className="font-medium">Vista previa</Label>
            <Input type="tel" placeholder="+1 (555) 123-4567" disabled className="mt-2" />
          </div>
        )}

        {question.type === "number" && (
          <div className="p-4 border rounded-lg bg-muted/20">
            <Label className="font-medium">Vista previa</Label>
            <Input type="number" placeholder="123" disabled className="mt-2" />
          </div>
        )}

        {question.type === "file" && (
          <div className="p-4 border rounded-lg bg-muted/20">
            <Label className="font-medium">Vista previa</Label>
            <Input type="file" disabled className="mt-2" />
          </div>
        )}

        {question.type === "image_upload" && (
          <div className="p-4 border rounded-lg bg-muted/20">
            <Label className="font-medium">Vista previa</Label>
            <Input type="file" accept="image/*" disabled className="mt-2" />
          </div>
        )}

        {question.type === "signature" && (
          <div className="p-4 border rounded-lg bg-muted/20">
            <Label className="font-medium">Vista previa</Label>
            <div className="mt-2 border-2 border-dashed border-muted-foreground/50 rounded p-8 text-center text-muted-foreground">
              Área de firma digital
            </div>
          </div>
        )}

        {question.type === "comment_box" && (
          <div className="p-4 border rounded-lg bg-muted/20">
            <Label className="font-medium">Vista previa</Label>
            <Textarea placeholder="Deja tu comentario aquí..." disabled className="mt-2" rows={4} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
