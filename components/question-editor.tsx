"use client"

import type React from "react"
import { AdvancedRichTextEditor } from "@/components/ui/advanced-rich-text-editor"

// MatrixOptionInput for matrix column options (debounced, allows empty string)
type MatrixOptionInputProps = {
  value: string
  onChange: (val: string) => void
  placeholder: string
}
const MatrixOptionInput: React.FC<MatrixOptionInputProps> = ({ value, onChange, placeholder }) => {
  const [localValue, setLocalValue] = useState(value)
  const timeoutRef = useRef<any>(null)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLocalValue(e.target.value)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => {
      onChange(e.target.value)
    }, 200)
  }

  return <Input value={localValue} onChange={handleChange} placeholder={placeholder} />
}

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
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
  onMoveQuestion?: (questionId: string, fromSectionId: string, toSectionId: string, newIndex?: number) => void
  allSections: SurveySection[] // For skip logic targets
  qIndex: number // To display question number
  isDragging?: boolean
  onSaveSection?: (sectionId: string) => void // Nueva prop opcional
}

export function QuestionEditor({
  question,
  sectionId,
  onRemoveQuestion,
  onUpdateQuestion,
  onDuplicateQuestion,
  allSections,
  qIndex,
  onSaveSection,
}: QuestionEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const { toast } = useToast()
  const [showConfig, setShowConfig] = useState<boolean>(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: `${sectionId}-${question.id}`,
    data: {
      type: 'question',
      question,
      sectionId
    }
  })

  const openConfigEditor = () => {
    setShowConfig(true)
  }

  const closeConfigEditor = () => {
    setShowConfig(false)
    // Guardar la sección al cerrar el modal si la función está disponible
    if (onSaveSection) {
      onSaveSection(sectionId)
    }
  }
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  // Solo editor enriquecido, sin input simple ni debounce

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
    if (onSaveSection) {
      onSaveSection(sectionId)
    }
  }

  const matrixRows = question.matrixRows?.length ? question.matrixRows : ["Fila 1"]
  const matrixCols = question.matrixCols?.length ? question.matrixCols : ["Columna 1"]

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Card ref={setNodeRef} style={style} className="mb-6 border-l-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-muted-foreground"
              >
                <circle cx="9" cy="12" r="1"/>
                <circle cx="9" cy="5" r="1"/>
                <circle cx="9" cy="19" r="1"/>
                <circle cx="15" cy="12" r="1"/>
                <circle cx="15" cy="5" r="1"/>
                <circle cx="15" cy="19" r="1"/>
              </svg>
            </div>
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

          <div className="flex-1">
            {!isEditing ? (
              <Input
                readOnly
                className="text-lg cursor-pointer bg-background border rounded-lg"
                value={question.text ? question.text.replace(/<[^>]+>/g, "") : ""}
                placeholder="Escribe tu pregunta aquí..."
                onClick={() => setIsEditing(true)}
              />
            ) : (
              <div className="border rounded-lg overflow-hidden p-2 bg-background">
                <AdvancedRichTextEditor
                  value={question.text}
                  onChange={(html) => onUpdateQuestion(sectionId, question.id, "text", html)}
                  placeholder="Escribe tu pregunta aquí..."
                  immediatelyRender={false}
                  autoFocus
                />
                <div className="flex justify-end mt-2 gap-2">
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                    Guardar
                  </Button>
                </div>
              </div>
            )}
          </div>
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

        {question.type === "ranking" && (
          <div className="space-y-4 p-4 border rounded-lg">
            <Label className="text-lg font-semibold">Opciones para Rankear</Label>
            <div className="space-y-4">
              <div>
                <Label className="font-medium">Opciones</Label>
                {(question.options || ["Opción 1"]).map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2 mt-2">
                    <div className="flex items-center justify-center gap-1 w-16">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (idx > 0) {
                            const newOptions = [...question.options]
                            const temp = newOptions[idx]
                            newOptions[idx] = newOptions[idx - 1]
                            newOptions[idx - 1] = temp
                            onUpdateQuestion(sectionId, question.id, "options", newOptions)
                          }
                        }}
                        disabled={idx === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (idx < question.options.length - 1) {
                            const newOptions = [...question.options]
                            const temp = newOptions[idx]
                            newOptions[idx] = newOptions[idx + 1]
                            newOptions[idx + 1] = temp
                            onUpdateQuestion(sectionId, question.id, "options", newOptions)
                          }
                        }}
                        disabled={idx === question.options.length - 1}
                      >
                        ↓
                      </Button>
                    </div>
                    <div className="w-8 text-center">{idx + 1}</div>
                    <Input
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...question.options]
                        newOptions[idx] = e.target.value
                        onUpdateQuestion(sectionId, question.id, "options", newOptions)
                      }}
                      placeholder={`Opción ${idx + 1}`}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newOptions = question.options.filter((_, i) => i !== idx)
                        onUpdateQuestion(
                          sectionId,
                          question.id,
                          "options",
                          newOptions.length > 0 ? newOptions : ["Opción 1"],
                        )
                      }}
                      disabled={question.options.length <= 1}
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
                    const newOptions = [...(question.options || []), `Opción ${(question.options || []).length + 1}`]
                    onUpdateQuestion(sectionId, question.id, "options", newOptions)
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" /> Agregar opción
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={question.config?.rankingRequireAll !== false}
                    onCheckedChange={(checked) =>
                      onUpdateQuestion(sectionId, question.id, "config", {
                        ...question.config,
                        rankingRequireAll: checked,
                      })
                    }
                  />
                  <Label>Requerir ranking completo</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  {question.config?.rankingRequireAll !== false
                    ? "El usuario debe ordenar todas las opciones"
                    : "El usuario puede dejar opciones sin ordenar"}
                </p>
              </div>

              <div className="mt-4">
                <Label className="font-medium">Vista previa</Label>
                <div className="mt-2 p-4 border rounded-lg bg-muted/20">
                  {(question.options || ["Opción 1"]).map((option, idx) => (
                    <div key={idx} className="flex items-center gap-2 py-2 border-b last:border-b-0">
                      <div className="w-8 text-center font-medium">{idx + 1}</div>
                      <div className="flex-1">{option}</div>
                      <div className="flex gap-1">
                        <button className="px-2 py-1 text-sm bg-muted/50 rounded cursor-not-allowed">↑</button>
                        <button className="px-2 py-1 text-sm bg-muted/50 rounded cursor-not-allowed">↓</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

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
                {/* Hide add column button if cell type is 'ranking' */}
                {question.config?.matrixCellType !== "ranking" && (
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
                )}
              </div>
            </div>
            {/* Configuración del tipo de celda */}
            <div className="space-y-2">
              <Label className="font-medium">Tipo de celda</Label>
              <Select
                value={question.config?.matrixCellType || "radio"}
                onValueChange={(value) =>
                  onUpdateQuestion(sectionId, question.id, "config", {
                    ...question.config,
                    matrixCellType: value,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccione el tipo de celda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="radio">🔘 Opción única (Radio)</SelectItem>
                  <SelectItem value="checkbox">☑️ Casilla de verificación</SelectItem>
                  <SelectItem value="text">📝 Texto corto</SelectItem>
                  <SelectItem value="number">🔢 Número</SelectItem>
                  <SelectItem value="select">📋 Lista desplegable</SelectItem>
                  <SelectItem value="rating">⭐ Valoración</SelectItem>
                  <SelectItem value="ranking">🔢 Ranking</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Selecciona cómo los usuarios responderán en cada celda de la matriz
              </p>
            </div>

            {/* Opciones para celdas tipo 'select' - per-column options */}
            {question.config?.matrixCellType === "select" && (
              <div className="space-y-2 mt-4">
                <Label className="font-medium">Opciones para cada columna</Label>
                {matrixCols.map((col, colIdx) => {
                  // Memoize unique option sets for reuse
                  const allColOptions = question.config?.matrixColOptions || []
                  const uniqueOptionSets = allColOptions
                    .map((opts: string[], idx: number) => ({ opts, idx }))
                    .filter(
                      (item: { opts: string[]; idx: number }, idx: number, arr: { opts: string[]; idx: number }[]) =>
                        arr.findIndex(
                          (x: { opts: string[]; idx: number }) => JSON.stringify(x.opts) === JSON.stringify(item.opts),
                        ) === idx,
                    )
                  const colOptions = allColOptions[colIdx] || ["Opción 1"]
                  const isDefault = colOptions.length === 1 && colOptions[0] === "Opción 1"
                  return (
                    <div key={colIdx} className="mb-2">
                      <div className="font-medium mb-1">{col}</div>
                      {/* Selector para reutilizar opciones */}
                      {uniqueOptionSets.length > 1 && (
                        <div className="mb-2">
                          <Label>Usar opciones de otra columna:</Label>
                          <Select
                            value={
                              uniqueOptionSets
                                .find(
                                  (u: { opts: string[]; idx: number }) =>
                                    JSON.stringify(u.opts) === JSON.stringify(colOptions),
                                )
                                ?.idx?.toString() ?? ""
                            }
                            onValueChange={(val) => {
                              const idx = Number.parseInt(val, 10)
                              if (!isNaN(idx)) {
                                const newColOptions = [...allColOptions]
                                newColOptions[colIdx] = [...(allColOptions[idx] || ["Opción 1"])]
                                onUpdateQuestion(sectionId, question.id, "config", {
                                  ...question.config,
                                  matrixColOptions: newColOptions,
                                })
                              }
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Seleccionar set de opciones..." />
                            </SelectTrigger>
                            <SelectContent>
                              {uniqueOptionSets.map((set: { opts: string[]; idx: number }, idx: number) => (
                                <SelectItem
                                  key={idx}
                                  value={set.idx.toString()}
                                >{`Set ${set.idx + 1}: ${set.opts.filter(Boolean).join(", ")}`}</SelectItem>
                              ))}
                              <SelectItem value="new">Crear nuevo set</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {/* Edición de opciones */}
                      {(!uniqueOptionSets.length ||
                        uniqueOptionSets.find(
                          (u: { opts: string[]; idx: number }) => JSON.stringify(u.opts) === JSON.stringify(colOptions),
                        )?.idx === colIdx ||
                        isDefault) && (
                        <>
                          {colOptions.map((option: string, optIdx: number) => (
                            <div key={optIdx} className="flex items-center gap-2 mb-1">
                              <MatrixOptionInput
                                value={option}
                                onChange={(val) => {
                                  const newColOptions = allColOptions ? [...allColOptions] : []
                                  while (newColOptions.length <= colIdx) newColOptions.push(["Opción 1"])
                                  const opts = [...(newColOptions[colIdx] || ["Opción 1"])]
                                  opts[optIdx] = val
                                  newColOptions[colIdx] = opts
                                  onUpdateQuestion(sectionId, question.id, "config", {
                                    ...question.config,
                                    matrixColOptions: newColOptions,
                                  })
                                }}
                                placeholder={`Opción ${optIdx + 1}`}
                              />

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newColOptions = allColOptions ? [...allColOptions] : []
                                  while (newColOptions.length <= colIdx) newColOptions.push(["Opción 1"])
                                  const opts = [...(newColOptions[colIdx] || ["Opción 1"])]
                                  opts.splice(optIdx, 1)
                                  newColOptions[colIdx] = opts.length > 0 ? opts : ["Opción 1"]
                                  onUpdateQuestion(sectionId, question.id, "config", {
                                    ...question.config,
                                    matrixColOptions: newColOptions,
                                  })
                                }}
                                disabled={colOptions.length <= 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const newColOptions = allColOptions ? [...allColOptions] : []
                              while (newColOptions.length <= colIdx) newColOptions.push(["Opción 1"])
                              const opts = [
                                ...(newColOptions[colIdx] || ["Opción 1"]),
                                `Opción ${(newColOptions[colIdx]?.length || 1) + 1}`,
                              ]
                              newColOptions[colIdx] = opts
                              onUpdateQuestion(sectionId, question.id, "config", {
                                ...question.config,
                                matrixColOptions: newColOptions,
                              })
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" /> Agregar opción
                          </Button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Opciones para celdas tipo 'rating' */}
            {question.config?.matrixCellType === "rating" && (
              <div className="space-y-2 mt-4">
                <Label className="font-medium">Configuración de valoración</Label>
                <Select
                  value={question.config?.matrixRatingScale?.toString() || "5"}
                  onValueChange={(value) =>
                    onUpdateQuestion(sectionId, question.id, "config", {
                      ...question.config,
                      matrixRatingScale: Number(value),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">1 a 3 estrellas</SelectItem>
                    <SelectItem value="5">1 a 5 estrellas</SelectItem>
                    <SelectItem value="10">1 a 10 estrellas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Opciones para celdas tipo 'ranking' */}
            {question.config?.matrixCellType === "ranking" && (
              <div className="space-y-2 mt-4">
                <Label className="font-medium">Configuración de ranking</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={question.config?.rankingRequireAll !== false}
                      onCheckedChange={(checked) =>
                        onUpdateQuestion(sectionId, question.id, "config", {
                          ...question.config,
                          rankingRequireAll: checked,
                        })
                      }
                    />
                    <Label>Requerir ranking completo</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {question.config?.rankingRequireAll !== false
                      ? "El usuario debe asignar un ranking a todas las opciones"
                      : "El usuario puede dejar opciones sin rankear"}
                  </p>
                </div>
              </div>
            )}

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
                            {(() => {
                              switch (question.config?.matrixCellType) {
                                case "checkbox":
                                  return <input type="checkbox" disabled className="cursor-not-allowed" />
                                case "text":
                                  return <Input disabled className="w-full" placeholder="Texto..." />
                                case "number":
                                  return <Input type="number" disabled className="w-full" placeholder="0" />
                                case "select": {
                                  // Use per-column options if available
                                  const colOptions = question.config?.matrixColOptions?.[cIdx] || ["Opción 1"]
                                  return (
                                    <Select disabled>
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Seleccionar..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {colOptions.map((opt: string, i: number) => (
                                          <SelectItem key={i} value={opt && opt.trim() !== "" ? opt : `__empty_${i}`}>
                                            {opt && opt.trim() !== "" ? (
                                              opt
                                            ) : (
                                              <span className="text-muted-foreground italic">(vacío)</span>
                                            )}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )
                                }
                                case "rating":
                                  return (
                                    <div className="flex justify-center gap-1">
                                      {Array.from(
                                        { length: Number(question.config?.matrixRatingScale || 5) },
                                        (_, i) => (
                                          <span key={i} className="text-yellow-400 cursor-not-allowed">
                                            ★
                                          </span>
                                        ),
                                      )}
                                    </div>
                                  )
                                case "ranking":
                                  return (
                                    <div className="flex items-center gap-1">
                                      <div className="w-8 text-center">{rIdx + 1}</div>
                                      <div className="flex gap-1">
                                        <button className="px-2 py-1 text-sm bg-muted/50 rounded cursor-not-allowed">
                                          ↑
                                        </button>
                                        <button className="px-2 py-1 text-sm bg-muted/50 rounded cursor-not-allowed">
                                          ↓
                                        </button>
                                      </div>
                                    </div>
                                  )
                                default: // radio
                                  return <input type="radio" disabled className="cursor-not-allowed" />
                              }
                            })()}
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

            {question.type === "checkbox" && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                <Label className="text-sm font-medium text-blue-800">Límites de selección</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-blue-700">Mínimo de respuestas</Label>
                    <Input
                      type="number"
                      min="0"
                      max={question.options.length}
                      value={question.config?.minSelections || 0}
                      onChange={(e) =>
                        onUpdateQuestion(sectionId, question.id, "config", {
                          ...question.config,
                          minSelections: Number.parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="0"
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-blue-700">Máximo de respuestas</Label>
                    <Input
                      type="number"
                      min="1"
                      max={question.options.length}
                      value={question.config?.maxSelections || question.options.length}
                      onChange={(e) =>
                        onUpdateQuestion(sectionId, question.id, "config", {
                          ...question.config,
                          maxSelections: Number.parseInt(e.target.value) || question.options.length,
                        })
                      }
                      placeholder={question.options.length.toString()}
                      className="h-8"
                    />
                  </div>
                </div>
                <div className="text-xs text-blue-600">
                  {question.config?.minSelections > 0 && question.config?.maxSelections && (
                    <>
                      {question.config.minSelections === question.config.maxSelections
                        ? `El usuario debe seleccionar exactamente ${question.config.minSelections} opción${question.config.minSelections > 1 ? "es" : ""}`
                        : `El usuario debe seleccionar entre ${question.config.minSelections} y ${question.config.maxSelections} opciones`}
                    </>
                  )}
                  {question.config?.minSelections === 0 &&
                    question.config?.maxSelections &&
                    `El usuario puede seleccionar hasta ${question.config.maxSelections} opción${question.config.maxSelections > 1 ? "es" : ""}`}
                  {(!question.config?.minSelections || question.config.minSelections === 0) &&
                    (!question.config?.maxSelections || question.config.maxSelections === question.options.length) &&
                    "Sin límites de selección"}
                </div>
              </div>
            )}

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

            <div className="space-y-4">
              {/* Vista previa rápida */}
              <div className="p-4 bg-white rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-3">Vista Previa Rápida:</h4>
                <div className="space-y-4">
                  <div className="px-2">
                    <Slider
                      defaultValue={[Math.ceil((question.config?.likertScale?.max || 5) / 2)]}
                      min={question.config?.likertScale?.showZero ? 0 : question.config?.likertScale?.min || 1}
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
                        <div className="text-xs">
                          {question.config?.likertScale?.zeroLabel || "No Sabe / No Responde"}
                        </div>
                      </span>
                    )}
                    <span className="text-center">
                      <div className="font-medium">1</div>
                      <div className="text-xs">
                        {question.config?.likertScale?.labels?.left || "Totalmente en desacuerdo"}
                      </div>
                    </span>
                    <span className="text-center">
                      <div className="font-medium">{question.config?.likertScale?.max || 5}</div>
                      <div className="text-xs">
                        {question.config?.likertScale?.labels?.right || "Totalmente de acuerdo"}
                      </div>
                    </span>
                  </div>
                </div>
              </div>

              {/* Botones de acceso rápido */}
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  onClick={() =>
                    onUpdateQuestion(sectionId, question.id, "config", {
                      ...question.config,
                      likertScale: {
                        min: 1,
                        max: 5,
                        step: 1,
                        labels: {
                          left: "Totalmente en desacuerdo",
                          right: "Totalmente de acuerdo",
                        },
                        showZero: true,
                        zeroLabel: "No Sabe / No Responde",
                        startPosition: "left",
                      },
                    })
                  }
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                >
                  🎯 Usar Escala Estándar (1-5)
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    onUpdateQuestion(sectionId, question.id, "config", {
                      ...question.config,
                      likertScale: {
                        min: 1,
                        max: 7,
                        step: 1,
                        labels: {
                          left: "Completamente en desacuerdo",
                          center: "Neutral",
                          right: "Completamente de acuerdo",
                        },
                        showZero: true,
                        zeroLabel: "No Sabe / No Responde",
                        startPosition: "center",
                      },
                    })
                  }
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                >
                  🎯 Usar Escala Extendida (1-7)
                </Button>
              </div>

              {/* Mensaje de ayuda */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">
                  💡 <strong>Para configuración avanzada:</strong> Usa el botón "Configuración avanzada" arriba y
                  selecciona la pestaña "Escala Likert". Allí podrás personalizar completamente tu escala.
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
                        const newLabels = (question.config?.textboxLabels || []).filter(
                          (_: string, i: number) => i !== index,
                        )
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
