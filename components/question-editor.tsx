"use client"

import type React from "react"
import { useToast } from "@/components/ui/use-toast"
import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import EmojiPicker from "./EmojiPicker"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Plus, Trash2, Copy, ChevronDown, ChevronUp, Type, Settings } from "lucide-react"
import { Dialog } from "@/components/ui/dialog"
import { AdvancedRichTextEditor } from "@/components/ui/advanced-rich-text-editor"
import { Badge } from "@/components/ui/badge"
import { useDebounce } from "use-debounce"
import { AdvancedQuestionConfig } from "@/components/advanced-question-config"
import type {  SurveySection } from "@/types-updated"
import { supabase } from "@/lib/supabase-browser";
import type { Question } from "@/types-updated";
import { ContactInfoQuestion } from "./contact-info-question";

const MapWithDrawing = dynamic(() => import("@/components/map-with-drawing"), {
  ssr: false,
})


export async function autoSaveQuestionHelper(question: Question, sectionId: string, surveyId: string) {
  if (
    sectionId &&
    sectionId !== "temp-id" &&
    sectionId.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i) &&
    question.id
  ) {
    // Construir el objeto questionData igual que en page.tsx
    const questionData = {
      id: question.id,
      survey_id: surveyId, // Usar el argumento obligatorio
      section_id: sectionId,
      type: question.type,
      // Guardar texto plano y HTML enriquecido
      text: (question.text_html || question.text || "").replace(/<[^>]*>/g, "").trim(),
      text_html: question.text_html || question.text || "",
      options: question.options || [],
      required: question.required || false,
      order_num: question.order_num || 0,
      settings: {
        ...question.config,
        matrixRows: question.matrixRows,
        matrixCols: question.matrixCols,
        ratingScale: question.ratingScale,
      },
      matrix_rows: question.matrixRows || [],
      matrix_cols: question.matrixCols || [],
      rating_scale: question.ratingScale || null,
      file_url: question.image || null,
      skip_logic: question.config?.skipLogic || null,
      display_logic: question.config?.displayLogic || null,
      validation_rules: question.config?.validation || null,
      style: question.style || {},
      comment_box: question.comment_box || false,
      matrix: question.matrix || [],
      question_config: question.question_config || null,
    };
    try {
      // Forzar el tipo any para evitar error de generics en el upsert
      const { error, data } = await (supabase as any).from("questions").upsert([questionData], { onConflict: "id" });
      console.log("Guardado en supabase:", { error, data, questionData });
      if (error) {
        // Mostrar el error completo y los datos enviados
        console.error("Error al guardar pregunta:", error, questionData);
      }
    } catch (err) {
      console.error("Error inesperado al guardar pregunta:", err);
    }
  } else {
    console.warn("No se guardó: sectionId o question.id inválidos", { sectionId, question });
  }
}

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


interface QuestionEditorProps {
  question: Question
  sectionId: string
  surveyId: string
  onRemoveQuestion: (sectionId: string, questionId: string) => void
  onUpdateQuestion: (sectionId: string, questionId: string, field: keyof Question, value: any) => void
  onDuplicateQuestion: (sectionId: string, questionId: string) => void
  onMoveQuestion?: (questionId: string, fromSectionId: string, toSectionId: string, newIndex?: number) => void
  allSections: SurveySection[] // For skip logic targets
  qIndex: number // To display question number
  isDragging?: boolean
}

export function QuestionEditor({
  question,
  sectionId,
  surveyId,
  onRemoveQuestion,
  onUpdateQuestion,
  onDuplicateQuestion,
  allSections,
  qIndex,
}: QuestionEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  // Estado para mostrar/ocultar el textarea de pegado masivo de opciones
  const [showPasteOptions, setShowPasteOptions] = useState(false)
  const [showConfig, setShowConfig] = useState<boolean>(false)
  // tabs removed: configuration moved to AdvancedQuestionConfig. Show inline controls instead.

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
  }
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  // Estado para mostrar el picker de emoji por índice
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null)
  // Índice de opción que se está editando con editor enriquecido (FullTiptapEditor)
  const [editingOptionRichIndex, setEditingOptionRichIndex] = useState<number | null>(null)
  // Editor enriquecido para enunciado de pregunta (usa text_html si existe, nunca el texto plano si hay HTML)
  const [localQuestionTextHtml, setLocalQuestionTextHtml] = useState(question.text_html ?? "");

  // Sincronizar el estado local SOLO con text_html (nunca con text plano)
  useEffect(() => {
    setLocalQuestionTextHtml(question.text_html ?? "");
  }, [question.text_html]);

  // Guardar el valor HTML en el estado global al cambiar
  const handleQuestionTextChange = (html: string) => {
    setLocalQuestionTextHtml(html);
    // Extraer texto plano del HTML
    const plain = html.replace(/<[^>]*>/g, "").trim();
    onUpdateQuestion(sectionId, question.id, "text", plain);
    onUpdateQuestion(sectionId, question.id, "text_html", html);
  };

  const toggleQuestionExpansion = () => {
    setIsExpanded((prev) => !prev)
  }

  const handlePasteOptions = (pastedText: string, currentOptions: any[]) => {
    const lines = pastedText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (lines.length > 1) {
      onUpdateQuestion(sectionId, question.id, "options", lines)
      return true
    }
    return false
  }

  // Emoji sets para valoración
  const RATING_EMOJI_SETS = [
    { key: "caras", label: "Caras", emojis: ["😞", "😐", "😊"] },
    { key: "estrellas", label: "Estrellas", emojis: ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"] },
    { key: "corazones", label: "Corazones", emojis: ["�", "�", "❤️"] },
    { key: "pulgares", label: "Pulgares", emojis: ["�", "�"] },
    { key: "fuegos", label: "Fuegos", emojis: ["�", "�🔥", "�🔥🔥", "�🔥🔥🔥", "🔥🔥🔥🔥🔥"] },
    { key: "caritas_varias", label: "Caritas Variadas", emojis: ["�", "�", "�", "�", "😍"] },
  ];

  // Devuelve el set de emojis seleccionado o el default (caras)
  const getRatingEmojis = (scale: number, emojiSetKey?: string) => {
    const set = RATING_EMOJI_SETS.find(s => s.key === emojiSetKey) || RATING_EMOJI_SETS[0];
    // Si el set tiene menos emojis que el scale, repite el último
    if (set.emojis.length >= scale) return set.emojis.slice(0, scale);
    if (set.emojis.length === 1) return Array(scale).fill(set.emojis[0]);
    // Rellena con el último emoji si faltan
    return [...set.emojis, ...Array(scale - set.emojis.length).fill(set.emojis[set.emojis.length - 1])];
  };

  const handleAdvancedConfigSave = (newConfig: any) => {
    onUpdateQuestion(sectionId, question.id, "config", newConfig)
    // Guardar inmediatamente en Supabase al guardar la configuración avanzada
    // Usar el helper ya existente
    autoSaveQuestionHelper({
      ...question,
      config: newConfig
    }, sectionId, surveyId)
  }

  const matrixRows = question.matrixRows?.length ? question.matrixRows : ["Fila 1"]
  const matrixCols = question.matrixCols?.length ? question.matrixCols : ["Columna 1"]

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Helpers for option shapes (string | {value,label,image,...})
  const getOptionLabel = (opt: any) => {
    if (opt && typeof opt === 'object') return opt.label ?? opt.value ?? String(opt)
    return String(opt ?? '')
  }
  const getOptionValue = (opt: any) => {
    if (opt && typeof opt === 'object') return opt.value ?? opt.label ?? String(opt)
    return String(opt ?? '')
  }

  // Local state + dnd-kit setup for reordering options in multiple_choice / checkbox / dropdown
  const [optItems, setOptItems] = useState<any[]>(question.options || [])
  useEffect(() => {
    setOptItems(question.options || [])
  }, [question.options])

  const sensors = useSensors(useSensor(PointerSensor))

  const handleOptionsDragEnd = (event: any) => {
    const { active, over } = event
    if (!over) return
    // ids are in the form `${question.id}-opt-${index}`
    const from = Number(String(active.id).split("-opt-").pop())
    const to = Number(String(over.id).split("-opt-").pop())
    if (!isNaN(from) && !isNaN(to) && from !== to) {
      const newOptions = arrayMove(optItems, from, to)
      setOptItems(newOptions)
      onUpdateQuestion(sectionId, question.id, "options", newOptions)
    }
  }

  // Sortable item component for options
  function SortableOption({ id, index, option }: { id: string; index: number; option: any }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
    const style: any = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1,
    }

    const isObj = option && typeof option === 'object'
    const label = isObj ? (option.label ?? option.value ?? '') : String(option ?? '')
    // detect image in object or string
    const imageFromObj = isObj ? (option.image || option.url || option.src || '') : ''
    const s = String(option ?? '')
    const imgTagMatch = s.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
    const urlMatch = s.match(/https?:\/\/[^\s"']+\.(png|jpe?g|gif|webp|svg)(\?[^\s"']*)?/i)
    const imageUrl = imageFromObj || (imgTagMatch ? imgTagMatch[1] : urlMatch ? urlMatch[0] : '')

    return (
      <div ref={setNodeRef} style={style} className="flex items-start gap-3 w-full p-2 rounded hover:bg-muted" {...attributes}>
        <div className="w-6 h-6 flex items-center justify-center mt-2" {...listeners}>
          {/* Drag handle */}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-muted-foreground cursor-grab">
            <circle cx="9" cy="12" r="1"/>
            <circle cx="9" cy="5" r="1"/>
            <circle cx="9" cy="19" r="1"/>
            <circle cx="15" cy="12" r="1"/>
            <circle cx="15" cy="5" r="1"/>
            <circle cx="15" cy="19" r="1"/>
          </svg>
        </div>
        <div className="flex-1 space-y-2">
          {editingOptionRichIndex === index ? (
            <div>
              <AdvancedRichTextEditor
                value={label}
                onChange={(html) => {
                  const newOptions = optItems.map((opt: any, idx: number) => {
                    if (idx !== index) return opt
                    if (isObj) return { ...opt, label: html }
                    return html
                  })
                  setOptItems(newOptions)
                  onUpdateQuestion(sectionId, question.id, "options", newOptions)
                }}
                placeholder={`Opción ${index + 1}`}
                immediatelyRender={false}
              />
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => setEditingOptionRichIndex(null)}>Cerrar</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div
                className="flex-1 w-full min-h-[40px] flex items-center border rounded-md px-3 py-2 text-sm bg-background cursor-text"
                onClick={() => setEditingOptionRichIndex(index)}
                dangerouslySetInnerHTML={{ __html: label || `Opción ${index + 1}` }}
              />
              <Button variant="ghost" size="sm" onClick={() => setEditingOptionRichIndex(index)} title="Editar formato">
                <Type className="h-4 w-4" />
              </Button>
            </div>
          )}

          {question.type !== 'dropdown' && (
            <div className="flex items-center gap-3">
              <input
                id={`file-input-${question.id}-${index}`}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0]
                  if (!f) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    const dataUrl = reader.result
                    const newOptions = optItems.map((opt: any, idx: number) => {
                      if (idx !== index) return opt
                      if (isObj) return { ...opt, image: dataUrl }
                      return { label: label || '', image: dataUrl }
                    })
                    setOptItems(newOptions)
                    onUpdateQuestion(sectionId, question.id, 'options', newOptions)
                  }
                  reader.readAsDataURL(f)
                }}
              />

              <Button size="sm" variant="ghost" onClick={() => document.getElementById(`file-input-${question.id}-${index}`)?.click()}>
                Subir imagen
              </Button>

              {imageUrl && (
                <Button size="sm" variant="ghost" onClick={() => {
                  const newOptions = optItems.map((opt: any, idx: number) => {
                    if (idx !== index) return opt
                    if (opt && typeof opt === 'object' && (opt.style || opt.color || opt.font)) {
                      const copy = { ...opt }
                      delete copy.style
                      delete copy.color
                      delete copy.font
                      return copy
                    }
                    if (opt && typeof opt === 'object') {
                      const copy = { ...opt }
                      delete copy.image
                      delete copy.url
                      delete copy.src
                      return copy
                    }
                    const plain = String(opt ?? '')
                    const cleaned = plain.replace(/<img[^>]*>/ig, '').trim()
                    return cleaned || `Opción ${index + 1}`
                  })
                  setOptItems(newOptions)
                  onUpdateQuestion(sectionId, question.id, 'options', newOptions)
                }} title="Quitar estilo / Eliminar imagen">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const newOptions = optItems.filter((_: any, idx: number) => idx !== index)
              const final = newOptions.length > 0 ? newOptions : [`Opción ${question.options.length > 0 ? question.options.length : 1}`]
              setOptItems(final)
              onUpdateQuestion(sectionId, question.id, "options", final)
            }}
            disabled={optItems.length <= 1}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  // NOTE: Selection limits UI moved to AdvancedQuestionConfig – keep editor minimal.

  // compute whether any option contains an image url/data (used by preview rendering)
  const hasOptionImage = (question.options || []).some((option: any) => {
    const isObj = option && typeof option === 'object'
    const imgFromObj = isObj ? (option.image || option.url || option.src || '') : ''
    const s = String(option ?? '')
    const imgTagMatch = s.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
    const urlMatch = s.match(/https?:\/\/[^\s"']+\.(png|jpe?g|gif|webp|svg)(\?[^\s"']*)?/i)
    const imageUrl = imgFromObj || (imgTagMatch ? imgTagMatch[1] : urlMatch ? urlMatch[0] : '')
    return Boolean(imageUrl)
  })

  return (
    <Card ref={setNodeRef} style={style} className="mb-6 border-l-4">
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-wrap">
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
            <Select
              value={question.type}
              onValueChange={(value) => onUpdateQuestion(sectionId, question.id, "type", value)}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Tipo de pregunta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">📝 Texto simple</SelectItem>
                <SelectItem value="textarea">📄 Texto largo</SelectItem>
                <SelectItem value="multiple_choice">🔘 Opción múltiple</SelectItem>
                <SelectItem value="checkbox">☑️ Casillas de verificación</SelectItem>
                <SelectItem value="dropdown">📋 Lista desplegable</SelectItem>
                <SelectItem value="scale">📊 Escala de calificación</SelectItem>
                <SelectItem value="matrix">📋 Matriz/Tabla</SelectItem>
                <SelectItem value="ranking">🔢 Clasificación</SelectItem>
                <SelectItem value="date">📅 Fecha</SelectItem>
                <SelectItem value="time">🕐 Hora</SelectItem>
                <SelectItem value="email">📧 Email</SelectItem>
                <SelectItem value="phone">📞 Teléfono</SelectItem>
                <SelectItem value="number">🔢 Número</SelectItem>
                <SelectItem value="rating">⭐ Valoración</SelectItem>
                <SelectItem value="file">📎 Archivo</SelectItem>
                <SelectItem value="signature">✍️ Firma</SelectItem>
                <SelectItem value="likert">📈 Escala Likert</SelectItem>
                <SelectItem value="net_promoter">📊 Net Promoter Score</SelectItem>
                <SelectItem value="comment_box">💬 Caja de comentarios</SelectItem>
                <SelectItem value="demographic">👤 Demográfica</SelectItem>
                <SelectItem value="contact_info">📧 Información de contacto</SelectItem>
                <SelectItem value="multiple_textboxes">📝 Múltiples cajas de texto</SelectItem>
              </SelectContent>
            </Select>
            {/* Switch para marcar como obligatoria la pregunta */}
            <div className="flex items-center gap-2">
              <span className="text-sm">Obligatoria</span>
              <Switch
                checked={question.required}
                onCheckedChange={(checked) => onUpdateQuestion(sectionId, question.id, "required", checked)}
                id={`required-switch-${question.id}`}
              />
            </div>
           
            <Button variant="ghost" size="sm" onClick={() => onDuplicateQuestion(sectionId, question.id)} title="Copiar pregunta">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onRemoveQuestion(sectionId, question.id)} title="Borrar pregunta">
              <Trash2 className="h-4 w-4" />
            </Button>
            {/* Botón para mover pregunta (preparado, requiere implementación de onMoveQuestion) */}
            {/* <Button variant="ghost" size="sm" onClick={() => onMoveQuestion && onMoveQuestion(question.id, sectionId, 'destSectionId')}>Mover</Button> */}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span className="text-green-600 font-medium">*</span> Preguntas listas para usar en vista previa
            <Button variant="outline" size="sm" onClick={openConfigEditor} className="ml-2">
              <Settings className="h-4 w-4 mr-2" />
              Configuración avanzada
            </Button>
          </div>
        </div>
      </CardHeader>
 <AdvancedQuestionConfig
          isOpen={showConfig}
          onClose={closeConfigEditor}
          question={question}
          allSections={allSections}
          allQuestions={allSections.flatMap((s) => s.questions)}
          onSave={handleAdvancedConfigSave}
        />
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`question-${question.id}`}>Enunciado de la pregunta</Label>
          <div className="flex flex-col md:flex-row gap-2 hidden">
            <Button
              type="button"
              variant={!isEditing ? "default" : "outline"}
              size="sm"
              onClick={() => setIsEditing(false)}
              disabled={!isEditing}
            >
              Texto simple
            </Button>
            <Button
              type="button"
              variant={isEditing ? "default" : "outline"}
              size="sm"
              onClick={() => setIsEditing(true)}
              disabled={isEditing}
            >
              Formato avanzado
            </Button>
          </div>
          <div className="flex-1 mt-2">
            {!isEditing ? (
              <textarea
                readOnly
                className="text-lg cursor-pointer bg-background border rounded-lg w-full resize-none min-h-[48px] whitespace-pre-line focus:outline-none break-words"
                value={question.text_html ? question.text_html.replace(/<[^>]+>/g, "") : ""}
                placeholder="Escribe tu pregunta aquí..."
                onClick={() => setIsEditing(true)}
                rows={1}
                style={{ height: 'auto', overflow: 'hidden' }}
                ref={el => {
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = el.scrollHeight + 'px';
                  }
                }}
                onInput={e => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = target.scrollHeight + 'px';
                }}
              />
            ) : (
              <div className="border rounded-lg overflow-hidden p-2 bg-background">
                <AdvancedRichTextEditor
                  value={localQuestionTextHtml}
                  onChange={handleQuestionTextChange}
                  placeholder="Escribe tu pregunta aquí..."
                  immediatelyRender={false}
                />
                <div className="flex justify-end mt-2 gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      // Al guardar, sincroniza ambos campos
                      const plain = localQuestionTextHtml.replace(/<[^>]*>/g, "").trim();
                      onUpdateQuestion(sectionId, question.id, "text", plain);
                      onUpdateQuestion(sectionId, question.id, "text_html", localQuestionTextHtml);
                      autoSaveQuestionHelper({ ...question, text: plain, text_html: localQuestionTextHtml }, sectionId, surveyId);
                      setIsEditing(false);
                    }}
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {question.type === "ranking" && (
          <div className="space-y-4 p-4 border rounded-lg">
            <Label className="text-lg font-semibold">Opciones para Rankear</Label>
            <div className="space-y-4">
              <div>
                <Label className="font-medium">Opciones</Label>
                {(question.options || ["Opción 1"]).map((option: any, idx: number) => (
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
                      value={getOptionLabel(option)}
                      onChange={(e) => {
                        const newOptions = [...question.options]
                        newOptions[idx] = typeof option === 'object' ? { ...option, label: e.target.value } : e.target.value
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
                      <div className="flex-1" dangerouslySetInnerHTML={{ __html: getOptionLabel(option) }} />
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
            {/* Mostrar límites solo si es checkbox - moved to advanced configuration modal */}
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
                <Label>Escala</Label>
                <div className="flex gap-2 items-center">
                  <span>Min:</span>
                  <Input
                    type="number"
                    min={0}
                    max={question.config?.ratingMax || 10}
                    value={question.config?.ratingMin ?? 1}
                    onChange={e => {
                      const min = Number(e.target.value);
                      const max = question.config?.ratingMax ?? 5;
                      let emojis: string[] = Array.isArray(question.config?.ratingEmojis) ? question.config.ratingEmojis : [];
                      if (max - min + 1 !== emojis.length) {
                        // Ajustar el array de emojis
                        const defaultEmojis = ["😞", "😐", "😊", "😁", "😍", "🤩", "🥳", "😡", "😭", "😱"];
                        emojis = Array.from({length: max - min + 1}, (_, i) => emojis[i] || defaultEmojis[i] || "⭐");
                      }
                      const newConfig = { ...question.config, ratingMin: min, ratingMax: max, ratingEmojis: emojis };
                      onUpdateQuestion(sectionId, question.id, "config", newConfig);
                      autoSaveQuestionHelper({ ...question, config: newConfig }, sectionId, surveyId);
                    }}
                    className="w-16"
                  />
                  <span>Max:</span>
                  <Input
                    type="number"
                    min={question.config?.ratingMin ?? 1}
                    max={20}
                    value={question.config?.ratingMax ?? 5}
                    onChange={e => {
                      const max = Number(e.target.value);
                      const min = question.config?.ratingMin ?? 1;
                      let emojis: string[] = Array.isArray(question.config?.ratingEmojis) ? question.config.ratingEmojis : [];
                      if (max - min + 1 !== emojis.length) {
                        // Ajustar el array de emojis
                        const defaultEmojis = ["😞", "😐", "😊", "😁", "😍", "🤩", "🥳", "😡", "😭", "😱"];
                        emojis = Array.from({length: max - min + 1}, (_, i) => emojis[i] || defaultEmojis[i] || "⭐");
                      }
                      const newConfig = { ...question.config, ratingMin: min, ratingMax: max, ratingEmojis: emojis };
                      onUpdateQuestion(sectionId, question.id, "config", newConfig);
                      autoSaveQuestionHelper({ ...question, config: newConfig }, sectionId, surveyId);
                    }}
                    className="w-16"
                  />
                </div>
              </div>
              <div>
                <Label>Emojis de la escala</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(Array.isArray(question.config?.ratingEmojis)
                    ? question.config.ratingEmojis
                    : Array.from({length: (question.config?.ratingMax ?? 5) - (question.config?.ratingMin ?? 1) + 1}, (_, i) => ["😞", "😐", "😊", "😁", "😍"][i] || "⭐")
                  ).map((emoji, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                      <button
                        type="button"
                        className="text-3xl bg-white border rounded-lg shadow px-2 py-1 hover:bg-blue-50"
                        onClick={() => setShowEmojiPicker(idx)}
                      >
                        {emoji}
                      </button>
                      <span className="text-xs text-muted-foreground">{(question.config?.ratingMin ?? 1) + idx}</span>
                      {showEmojiPicker === idx && (
                        <div className="absolute z-50 mt-2">
                          <EmojiPicker
                            onSelect={selectedEmoji => {
                              const emojis = Array.isArray(question.config?.ratingEmojis) ? [...question.config.ratingEmojis] : [];
                              emojis[idx] = selectedEmoji;
                              const newConfig = { ...question.config, ratingEmojis: emojis };
                              onUpdateQuestion(sectionId, question.id, "config", newConfig);
                              autoSaveQuestionHelper({ ...question, config: newConfig }, sectionId, surveyId);
                              setShowEmojiPicker(null);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2 items-center">
              <span className="text-muted-foreground text-sm mr-2">Vista previa:</span>
              {(Array.isArray(question.config?.ratingEmojis)
                ? question.config.ratingEmojis
                : Array.from({length: (question.config?.ratingMax ?? 5) - (question.config?.ratingMin ?? 1) + 1}, (_, i) => ["😞", "😐", "😊", "😁", "😍"][i] || "⭐")
              ).map((emoji, idx) => (
                <span key={idx} style={{ fontSize: 28 }}>{emoji}</span>
              ))}
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
          <div className="space-y-4 p-4 bg-white border rounded-lg">
            <div className="flex gap-4 items-center mb-2">
                  <Switch
                    checked={showPasteOptions}
                    onCheckedChange={setShowPasteOptions}
                    id={`show-paste-options-${question.id}`}
                  />
                  <Label htmlFor={`show-paste-options-${question.id}`}>Mostrar respuesta en cantidad</Label>
                  {/* For multiple_choice we show tab buttons instead of the allow/randomize switches here */}
                  {/* Configuración trasladada a 'Configuración avanzada' — no mostrar controles aquí */}
                </div>
            {showPasteOptions && (
              <div>
                <Label className="text-lg font-semibold">Opciones de respuesta</Label>
                <Label>Pegar opciones (una por línea)</Label>
                <Textarea
                  placeholder="Opción 1\nOpción 2\nOpción 3 ..."
                  className="mb-2"
                  onPaste={(e) => {
                    if (handlePasteOptions(e.clipboardData.getData("text"), question.options || [])) {
                      e.preventDefault()
                    }
                  }}
                />
                <div className="text-xs text-muted-foreground mb-2">Puedes pegar múltiples opciones separadas por saltos de línea</div>
              </div>
            )}
            
            {/* Límites y opciones avanzadas ahora en el modal de Configuración avanzada; no se muestran aquí */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleOptionsDragEnd}>
              <SortableContext items={optItems.map((_: any, i: number) => `${question.id}-opt-${i}`)} strategy={verticalListSortingStrategy}>
                {optItems.map((option: any, index: number) => (
                  <SortableOption key={`${question.id}-opt-${index}`} id={`${question.id}-opt-${index}`} index={index} option={option} />
                ))}
              </SortableContext>
            </DndContext>
            <Button variant="outline" size="sm" onClick={() => onUpdateQuestion(sectionId, question.id, "options", [...(question.options || []), `Opción ${(question.options || []).length + 1}`])}>
              <Plus className="h-4 w-4 mr-2" /> Agregar opción
            </Button>

            {/* Vista previa grande de opciones con imágenes. Oculta para tipo 'dropdown' o cuando no hay imágenes */}
            {question.type !== 'dropdown' && hasOptionImage && (
              <div className="mt-4">
                <Label className="font-medium">Vista previa de opciones</Label>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {question.options.map((option: any, idx: number) => {
                    const isObj = option && typeof option === 'object'
                    const label = isObj ? (option.label ?? option.value ?? '') : String(option ?? '')
                    const imgFromObj = isObj ? (option.image || option.url || option.src || '') : ''
                    const s = String(option ?? '')
                    const imgTagMatch = s.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
                    const urlMatch = s.match(/https?:\/\/[^\s"']+\.(png|jpe?g|gif|webp|svg)(\?[^\s"']*)?/i)
                    const imageUrl = imgFromObj || (imgTagMatch ? imgTagMatch[1] : urlMatch ? urlMatch[0] : '')

                    return (
                      <div key={idx} className="border rounded-lg overflow-hidden bg-white shadow-sm relative">
                        {imageUrl ? (
                          <div className="w-full h-40 bg-gray-100 relative">
                            <img src={imageUrl} alt={label || `Opción ${idx + 1}`} className="w-full h-full object-cover" />
                            <div className="absolute top-1 right-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const newOptions = question.options.map((opt: any, i: number) => {
                                    if (i !== idx) return opt
                                    if (opt && typeof opt === 'object' && (opt.style || opt.color || opt.font)) {
                                      const copy = { ...opt }
                                      delete copy.style
                                      delete copy.color
                                      delete copy.font
                                      return copy
                                    }
                                    if (opt && typeof opt === 'object') {
                                      const copy = { ...opt }
                                      delete copy.image
                                      delete copy.url
                                      delete copy.src
                                      return copy
                                    }
                                    const plain = String(opt ?? '')
                                    const cleaned = plain.replace(/<img[^>]*>/ig, '').trim()
                                    return cleaned || `Opción ${idx + 1}`
                                  })
                                  onUpdateQuestion(sectionId, question.id, 'options', newOptions)
                                }}
                                title="Quitar estilo / Eliminar imagen"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-40 flex items-center justify-center bg-gray-50 text-gray-400">No image</div>
                        )}
                        <div className="p-3">
                          <div className="text-sm text-emerald-900" dangerouslySetInnerHTML={{ __html: label || `Opción ${idx + 1}` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
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
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={question.config?.includeDocument || false}
                    onCheckedChange={(checked) =>
                      onUpdateQuestion(sectionId, question.id, "config", {
                        ...question.config,
                        includeDocument: checked,
                      })
                    }
                  />
                  <Label>Documento</Label>
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
                  {question.config?.includeDocument && (
                    <div className="flex gap-2">
                      <Select disabled>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                      </Select>
                      <Input placeholder="Número de Documento" disabled />
                    </div>
                  )}
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
          <div className="space-y-4 p-4 border rounded-lg">
            <Label className="text-lg font-semibold">Configuración de Hora</Label>
            <div className="grid grid-cols-2 gap-4 items-end">
              <div>
                <Label>Formato de hora</Label>
                <Select
                  value={question.config?.timeFormat || "24"}
                  onValueChange={val => {
                    const newConfig = { ...question.config, timeFormat: val };
                    onUpdateQuestion(sectionId, question.id, "config", newConfig);
                    autoSaveQuestionHelper({
                      ...question,
                      config: newConfig,
                      order_num: question.order_num ?? qIndex ?? 0
                    }, sectionId, surveyId);
                  }}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Formato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 horas</SelectItem>
                    <SelectItem value="12">12 horas (AM/PM)</SelectItem>
                  </SelectContent>
                               </Select>
              </div>
              {question.config?.timeFormat === "12" && (
                <div>
                  <Label>AM / PM</Label>
                  <Select
                    value={question.config?.ampm || "AM"}
                    onValueChange={val => {
                      const newConfig = { ...question.config, ampm: val };
                      onUpdateQuestion(sectionId, question.id, "config", newConfig);
                      autoSaveQuestionHelper({
                        ...question,
                        config: newConfig,
                        order_num: question.order_num ?? qIndex ?? 0
                      }, sectionId, surveyId);
                    }}
                  >
                    <SelectTrigger className="w-[80px]">
                      <SelectValue placeholder="AM/PM" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="mt-4">
              <Label className="font-medium">Vista previa</Label>
              <div className="mt-2 flex items-center gap-2 p-4 border rounded-lg bg-muted/20">
                {question.config?.timeFormat === "12" ? (
                  <>
                    <Input type="number" min={1} max={12} defaultValue={12} className="w-16" disabled />
                    <span>:</span>
                    <Input type="number" min={0} max={59} defaultValue={0} className="w-16" disabled />
                    <Select value={question.config?.ampm || "AM"} disabled>
                      <SelectTrigger className="w-[80px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AM">AM</SelectItem>
                        <SelectItem value="PM">PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <>
                    <Input type="number" min={0} max={23} defaultValue={23} className="w-16" disabled />
                    <span>:</span>
                    <Input type="number" min={0} max={59} defaultValue={0} className="w-16" disabled />
                  </>
                )}
              </div>
            </div>
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
