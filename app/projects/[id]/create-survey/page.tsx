"use client"

import { Switch } from "@/components/ui/switch"
import type React from "react"
import dynamic from "next/dynamic"
import "react-quill/dist/quill.snow.css"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import ClientLayout from "../../../client-layout"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft,
  ArrowRight,
  Grip,
  Plus,
  Save,
  Trash2,
  Loader2,
  Building2,
  FolderOpen,
  Users,
  MapPin,
  SheetIcon as Section,
  ArrowUpDown,
  MessageSquare,
  MessageSquareText,
  MoreHorizontal,
  Map,
  Eye,
  X,
  Copy,
  BarChart3,
  Edit,
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase-browser"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { generateUUID } from "@/lib/utils"
import { AssignSurveyorsModal } from "@/components/assign-surveyors-modal"
import { EditSurveySettingsModal } from "@/components/edit-survey-settings-modal"
import { MultiSelectZones } from "@/components/multi-select-zones"
import { ZoneSurveyorAssignment } from "@/components/zone-surveyor-assignment"
import type { Zone } from "@/types/zone"
import type { Surveyor } from "@/types/surveyor"
import type { GeoJSON } from "geojson"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useState, useEffect, useCallback } from "react"

// Utilidad para limpiar etiquetas HTML
function stripHtml(html: string): string {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}
import { QuestionEditor } from "@/components/question-editor"
import { AdvancedRichTextEditor } from "@/components/ui/advanced-rich-text-editor"
import { arrayMove } from "@dnd-kit/sortable"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SectionOrganizer } from "@/components/section-organizer"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SurveyLogoUpload } from "@/components/ui/survey-logo-upload"

const MapWithDrawing = dynamic(() => import("@/components/map-with-drawing"), {
  ssr: false,
})

// Tipos para la lógica de secciones y preguntas
interface Question {
  id: string
  type: string
  text: string
  options: string[]
  required: boolean
  image?: string | null
  matrixRows?: string[]
  matrixCols?: string[]
  ratingScale?: number
  config?: {
    dropdownMulti?: boolean
    matrixCellType?: string
    scaleMin?: number
    scaleMax?: number
    scaleLabels?: string[]
    allowOther?: boolean
    otherText?: string
    randomizeOptions?: boolean
    ratingEmojis?: boolean
    displayLogic?: {
      enabled: boolean
      conditions: Array<{
        questionId: string
        operator: string
        value: string
      }>
    }
    skipLogic?: {
      enabled: boolean
      rules: Array<{
        condition: string // e.g., "answer === 'Yes'" or "answer.includes('Option A')"
        targetSectionId: string // ID of the section to jump to
        targetQuestionId?: string // ID of the question to jump to (optional)
        targetQuestionText?: string // Text of the question to jump to (optional)
        enabled?: boolean // Whether this rule is enabled
      }>
    }
    validation?: {
      required?: boolean
      minLength?: number
      maxLength?: number
      pattern?: string
      customMessage?: string
    }
    [key: string]: any
  }
}

interface SectionSkipLogic {
  enabled: boolean
  targetSectionId?: string
  targetQuestionId?: string
  targetQuestionText?: string
  action: "next_section" | "specific_section" | "specific_question" | "end_survey"
}

interface SurveySection {
  id: string
  title: string
  description?: string
  order_num: number
  questions: Question[]
  skipLogic?: SectionSkipLogic // Added skip logic to section interface
}

interface SurveySettings {
  collectLocation: boolean
  allowAudio: boolean
  offlineMode: boolean
  distributionMethods: string[]
  theme?: {
    primaryColor: string
    backgroundColor: string
    textColor: string
  }
  branding?: {
    showLogo: boolean
    logoPosition: string
    logo?: string | null // Add logo field here
  }
  security?: {
    passwordProtected: boolean
    password?: string
    preventMultipleSubmissions: boolean
  }
  notifications?: {
    emailOnSubmission: boolean
  }
  assignedUsers?: string[]
  assignedZones?: string[]
}

// Componente SortableSection
interface SortableSectionProps {
  section: SurveySection
  index: number
  onRemoveSection: (sectionId: string) => void
  onUpdateSection: (sectionId: string, field: keyof SurveySection, value: any) => void
  onAddQuestion: (sectionId: string) => void
  onRemoveQuestion: (sectionId: string, questionId: string) => void
  onUpdateQuestion: (sectionId: string, questionId: string, field: keyof Question, value: any) => void
  onDuplicateQuestion: (sectionId: string, questionId: string) => void
  allSections: SurveySection[] // Pass all sections for skip logic targets
}

function SortableSection({
  section,
  index,
  onRemoveSection,
  onUpdateSection,
  onAddQuestion,
  onRemoveQuestion,
  onUpdateQuestion,
  onDuplicateQuestion,
  allSections,
  sections,
  setSections,
}: SortableSectionProps & {
  sections: SurveySection[]
  setSections: React.Dispatch<React.SetStateAction<SurveySection[]>>
}) {
  // Estado local para el editor enriquecido del título de la sección
  const [localSectionTitle, setLocalSectionTitle] = useState(section.title || "");

  // Sincronizar el estado local si cambia el título desde fuera (por ejemplo, al duplicar o cargar)
  useEffect(() => {
    setLocalSectionTitle(section.title || "");
  }, [section.title]);

  // Guardar el valor HTML en el estado global al cambiar
  const handleSectionTitleChange = (html: string) => {
    setLocalSectionTitle(html);
    onUpdateSection(section.id, "title", html);
  };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : "auto",
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
  } as React.CSSProperties

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))

  const [showSkipLogicModal, setShowSkipLogicModal] = useState(false)

  const handleSkipLogicUpdate = (skipLogic: SectionSkipLogic) => {
    updateSectionSkipLogic(section.id, skipLogic, setSections, sections)
    setShowSkipLogicModal(false)
  }

  const handleRemoveSkipLogic = () => {
    removeSectionSkipLogic(section.id, setSections, sections)
  }

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg bg-card mb-6 overflow-hidden">
      <div className="bg-muted/30 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-2">
              <Grip className="h-4 w-4 text-muted-foreground cursor-move" {...listeners} {...attributes} />
              <Badge variant="secondary" className="text-xs">
                Sección {index + 1}
              </Badge>
              {section.skipLogic?.enabled && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  Salto configurado
                </Badge>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <AdvancedRichTextEditor
                value={localSectionTitle}
                onChange={handleSectionTitleChange}
                placeholder="Título de la sección (ej: Datos Personales)"
                immediatelyRender={false}
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Opciones de Sección</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowSkipLogicModal(true)}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  {section.skipLogic?.enabled ? "Editar Lógica de Salto" : "Configurar Lógica de Salto"}
                </DropdownMenuItem>
                {section.skipLogic?.enabled && (
                  <DropdownMenuItem onClick={handleRemoveSkipLogic} className="text-orange-600">
                    <X className="h-4 w-4 mr-2" />
                    Remover Lógica de Salto
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    const newSection = {
                      ...section,
                      id: generateUUID(), // ✅ UUID real en lugar de timestamp
                      title: `${section.title} (Copia)`,
                      questions: section.questions.map((q) => ({
                        ...q,
                        id: generateUUID(), // ✅ UUID real en lugar de timestamp
                      })),
                    }
                    setSections([...sections, newSection])
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicar Sección
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              onClick={() => onRemoveSection(section.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {section.skipLogic?.enabled && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-blue-800">
              <ArrowRight className="h-4 w-4" />
              <span className="font-medium">Al finalizar esta sección:</span>
              {section.skipLogic.action === "end_survey" && <span>Finalizar encuesta</span>}
              {section.skipLogic.action === "next_section" && <span>Continuar a la siguiente sección</span>}
              {section.skipLogic.action === "specific_section" && (
                <span>
                  Saltar a:{" "}
                  {allSections.find((s) => s.id === section.skipLogic?.targetSectionId)?.title ||
                    "Sección no encontrada"}
                </span>
              )}
              {section.skipLogic.action === "specific_question" && <span>Saltar a pregunta específica</span>}
            </div>
          </div>
        )}

        <Textarea
          value={section.description || ""}
          onChange={(e) => onUpdateSection(section.id, "description", e.target.value)}
          placeholder="Descripción opcional de la sección..."
          className="mt-2 border-none bg-transparent px-0 focus-visible:ring-0 resize-none"
          rows={2}
        />
      </div>

      <Dialog open={showSkipLogicModal} onOpenChange={setShowSkipLogicModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              Configurar Lógica de Salto - {section.title}
            </DialogTitle>
            <DialogDescription>Define qué sucede cuando el usuario completa esta sección</DialogDescription>
          </DialogHeader>

          <SectionSkipLogicConfig
            section={section}
            allSections={sections.filter((s) => s.id !== section.id)}
            onSave={handleSkipLogicUpdate}
            onCancel={() => setShowSkipLogicModal(false)}
          />
        </DialogContent>
      </Dialog>

      <div className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">PREGUNTAS</h3>
              <Badge variant="outline" className="text-xs">
                {section.questions.length}
              </Badge>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-transparent"
              onClick={() => onAddQuestion(section.id)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Agregar pregunta
            </Button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => {
              const { active, over } = event
              if (active.id !== over?.id) {
                const oldIndex = section.questions.findIndex((q) => q.id === active.id)
                const newIndex = section.questions.findIndex((q) => q.id === over?.id)
                if (oldIndex !== -1 && newIndex !== -1) {
                  const newQuestions = arrayMove(section.questions, oldIndex, newIndex)
                  onUpdateSection(section.id, "questions", newQuestions)
                }
              }
            }}
          >
            <SortableContext items={section.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
              {section.questions.length > 0 ? (
                <>
                  {section.questions.map((question, qIndex) => (
                    <div key={question.id} className="relative">
                      <div className="absolute -left-3 top-4 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium z-10">
                        {qIndex + 1}
                      </div>
                      <QuestionEditor
                        question={question}
                        sectionId={section.id}
                        onRemoveQuestion={onRemoveQuestion}
                        onUpdateQuestion={onUpdateQuestion}
                        onDuplicateQuestion={onDuplicateQuestion}
                        allSections={sections}
                        qIndex={qIndex}
                      />
                    </div>
                  ))}
                  <div className="border-2 border-dashed border-muted/50 rounded-lg p-4 text-center hover:border-primary/30 transition-colors mt-4">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-primary"
                      onClick={() => onAddQuestion(section.id)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar otra pregunta
                    </Button>
                  </div>
                </>
              ) : (
                <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <MessageSquare className="h-8 w-8" />
                    <p className="text-sm">Esta sección no tiene preguntas</p>
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => onAddQuestion(section.id)}>
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar la primera pregunta
                    </Button>
                  </div>
                </div>
              )}
            </SortableContext>
            <DragOverlay>
              {section.questions.find((q) => q.id === (sensors[0] as any)?.active?.id) ? (
                <div className="p-4 border rounded-md bg-white shadow-lg opacity-80">
                  <h3 className="text-lg font-semibold">
                    {section.questions
                      .find((q) => q.id === (sensors[0] as any)?.active?.id)
                      ?.text.replace(/<[^>]*>/g, "") || "Pregunta"}
                  </h3>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  )
}

const updateSectionSkipLogic = (
  sectionId: string,
  skipLogic: SectionSkipLogic,
  setSections: React.Dispatch<React.SetStateAction<SurveySection[]>>,
  sections: SurveySection[],
) => {
  setSections(sections.map((section) => (section.id === sectionId ? { ...section, skipLogic } : section)))
}

const removeSectionSkipLogic = (
  sectionId: string,
  setSections: React.Dispatch<React.SetStateAction<SurveySection[]>>,
  sections: SurveySection[],
) => {
  setSections(sections.map((section) => (section.id === sectionId ? { ...section, skipLogic: undefined } : section)))
}

// Función para actualizar referencias en la lógica de salto cuando cambian los IDs
const updateSkipLogicReferences = (sections: SurveySection[], oldId: string, newId: string) => {
  console.log(`🔄 Actualizando referencias de lógica de salto: ${oldId} -> ${newId}`)

  // Crear una copia profunda de las secciones para no mutar el estado directamente
  const updatedSections = sections.map((section) => ({
    ...section,
    skipLogic: section.skipLogic ? { ...section.skipLogic } : undefined,
    questions: section.questions.map((question) => ({
      ...question,
      config: question.config
        ? {
            ...question.config,
            skipLogic: question.config.skipLogic ? { ...question.config.skipLogic } : undefined,
          }
        : undefined,
    })),
  }))

  updatedSections.forEach((section) => {
    // Actualizar referencias en secciones
    if (section.skipLogic?.enabled && section.skipLogic.targetSectionId === oldId) {
      section.skipLogic.targetSectionId = newId
      console.log(`✅ Referencia actualizada en sección "${section.title}": ${oldId} -> ${newId}`)
    }

    // Actualizar referencias en preguntas
    section.questions.forEach((question) => {
      if (question.config?.skipLogic?.enabled && question.config.skipLogic.rules) {
        question.config.skipLogic.rules.forEach((rule) => {
          if (rule.targetSectionId === oldId) {
            rule.targetSectionId = newId
            console.log(
              `✅ Referencia actualizada en pregunta "${question.text.substring(0, 50)}...": ${oldId} -> ${newId}`,
            )
          }
        })
      }
    })
  })

  return updatedSections
}

// Función para actualizar referencias de preguntas en la lógica de salto
const updateSkipLogicReferencesWithQuestionMapping = (
  sections: SurveySection[],
  questionIdMapping: { [oldId: string]: string },
) => {
  console.log("🔄 Actualizando referencias de preguntas en lógica de salto con mapeo de IDs...")
  console.log("📋 Mapeo de IDs disponible:", questionIdMapping)

  // Crear una copia profunda de las secciones para no mutar el estado directamente
  const updatedSections = sections.map((section) => ({
    ...section,
    skipLogic: section.skipLogic ? { ...section.skipLogic } : undefined,
    questions: section.questions.map((question) => ({
      ...question,
      config: question.config
        ? {
            ...question.config,
            skipLogic: question.config.skipLogic ? { ...question.config.skipLogic } : undefined,
          }
        : undefined,
    })),
  }))

  let updatedReferences = 0
  let skippedReferences = 0

  updatedSections.forEach((section) => {
    // Actualizar referencias en secciones
    if (section.skipLogic?.enabled && section.skipLogic.targetQuestionId) {
      const oldQuestionId = section.skipLogic.targetQuestionId
      console.log(`🔍 Verificando referencia de pregunta en sección "${section.title}": ${oldQuestionId}`)

      if (questionIdMapping[oldQuestionId]) {
        const newQuestionId = questionIdMapping[oldQuestionId]
        section.skipLogic.targetQuestionId = newQuestionId
        console.log(
          `✅ Referencia de pregunta actualizada en sección "${section.title}": ${oldQuestionId} -> ${newQuestionId}`,
        )
        updatedReferences++
      } else {
        console.log(`⚠️ No se encontró mapeo para pregunta ID: ${oldQuestionId} en sección "${section.title}"`)
        console.log(`💡 Esto puede indicar que la pregunta ya tiene un ID válido o que no se procesó correctamente`)
        skippedReferences++
      }
    }

    // Actualizar referencias en preguntas
    section.questions.forEach((question) => {
      if (question.config?.skipLogic?.enabled && question.config.skipLogic.rules) {
        question.config.skipLogic.rules.forEach((rule, ruleIndex) => {
          // Actualizar referencias de sección
          if (rule.targetSectionId) {
            // Esto ya se maneja en updateSkipLogicReferences
          }

          // Actualizar referencias de pregunta específica
          if (rule.targetQuestionId) {
            const oldQuestionId = rule.targetQuestionId
            console.log(
              `🔍 Verificando referencia de pregunta en regla ${ruleIndex + 1} de "${question.text.substring(0, 50)}...": ${oldQuestionId}`,
            )

            if (questionIdMapping[oldQuestionId]) {
              const newQuestionId = questionIdMapping[oldQuestionId]
              rule.targetQuestionId = newQuestionId
              console.log(
                `✅ Referencia de pregunta actualizada en regla ${ruleIndex + 1}: ${oldQuestionId} -> ${newQuestionId}`,
              )
              updatedReferences++
            } else {
              console.log(`⚠️ No se encontró mapeo para pregunta ID: ${oldQuestionId} en regla ${ruleIndex + 1}`)
              console.log(
                `💡 Esto puede indicar que la pregunta ya tiene un ID válido o que no se procesó correctamente`,
              )
              skippedReferences++
            }
          }
        })
      }
    })
  })

  console.log(
    `📊 Resumen de actualización: ${updatedReferences} referencias actualizadas, ${skippedReferences} referencias omitidas`,
  )

  return updatedSections
}

// Función para validar y corregir referencias de preguntas en la lógica de salto al cargar datos
const validateAndFixSkipLogicReferences = (sections: SurveySection[]): SurveySection[] => {
  console.log("🔍 Validando referencias de preguntas en lógica de salto...")

  // Crear una copia profunda de las secciones
  const validatedSections = sections.map((section) => ({
    ...section,
    skipLogic: section.skipLogic ? { ...section.skipLogic } : undefined,
    questions: section.questions.map((question) => ({
      ...question,
      config: question.config
        ? {
            ...question.config,
            skipLogic: question.config.skipLogic ? { ...question.config.skipLogic } : undefined,
          }
        : undefined,
    })),
  }))

  // Crear un mapa de todas las preguntas disponibles por ID
  const allQuestionsMap: { [questionId: string]: { sectionId: string; questionText: string } } = {}
  validatedSections.forEach((section) => {
    section.questions.forEach((question) => {
      allQuestionsMap[question.id] = {
        sectionId: section.id,
        questionText: question.text,
      }
    })
  })

  let fixedReferences = 0

  validatedSections.forEach((section) => {
    // Validar referencias en secciones
    if (section.skipLogic?.enabled && section.skipLogic.targetQuestionId) {
      const targetQuestionId = section.skipLogic.targetQuestionId
      if (!allQuestionsMap[targetQuestionId]) {
        console.log(`⚠️ Referencia de pregunta inválida en sección "${section.title}": ${targetQuestionId}`)

        // Buscar una pregunta similar por texto
        const targetQuestionText = section.skipLogic.targetQuestionText || ""
        if (targetQuestionText) {
          const similarQuestion = Object.entries(allQuestionsMap).find(
            ([id, question]) =>
              question.questionText.toLowerCase().includes(targetQuestionText.toLowerCase()) ||
              targetQuestionText.toLowerCase().includes(question.questionText.toLowerCase()),
          )

          if (similarQuestion) {
            const [newQuestionId, questionInfo] = similarQuestion
            section.skipLogic.targetQuestionId = newQuestionId
            console.log(
              `✅ Referencia corregida: ${targetQuestionId} -> ${newQuestionId} (${questionInfo.questionText})`,
            )
            fixedReferences++
          } else {
            // Si no se encuentra una pregunta similar, resetear la referencia
            console.log(`❌ No se pudo encontrar pregunta similar, reseteando referencia`)
            section.skipLogic.targetQuestionId = undefined
            section.skipLogic.action = "next_section"
            section.skipLogic.enabled = false
          }
        } else {
          // Si no hay texto de referencia, resetear
          section.skipLogic.targetQuestionId = undefined
          section.skipLogic.action = "next_section"
          section.skipLogic.enabled = false
        }
      }
    }

    // Validar referencias en preguntas
    section.questions.forEach((question) => {
      if (question.config?.skipLogic?.enabled && question.config.skipLogic.rules) {
        question.config.skipLogic.rules.forEach((rule) => {
          // Validar referencias de pregunta específica
          if (rule.targetQuestionId) {
            const targetQuestionId = rule.targetQuestionId
            if (!allQuestionsMap[targetQuestionId]) {
              console.log(
                `⚠️ Referencia de pregunta inválida en regla de "${question.text.substring(0, 50)}...": ${targetQuestionId}`,
              )

              // Buscar pregunta similar por texto
              const targetQuestionText = rule.targetQuestionText || ""
              if (targetQuestionText) {
                const similarQuestion = Object.entries(allQuestionsMap).find(
                  ([id, questionInfo]) =>
                    questionInfo.questionText.toLowerCase().includes(targetQuestionText.toLowerCase()) ||
                    targetQuestionText.toLowerCase().includes(questionInfo.questionText.toLowerCase()),
                )

                if (similarQuestion) {
                  const [newQuestionId, questionInfo] = similarQuestion
                  rule.targetQuestionId = newQuestionId
                  console.log(
                    `✅ Referencia corregida en regla: ${targetQuestionId} -> ${newQuestionId} (${questionInfo.questionText})`,
                  )
                  fixedReferences++
                } else {
                  // Si no se encuentra, deshabilitar la regla
                  console.log(`❌ No se pudo encontrar pregunta similar, deshabilitando regla`)
                  rule.targetQuestionId = undefined
                  rule.enabled = false
                }
              } else {
                // Si no hay texto de referencia, deshabilitar la regla
                rule.targetQuestionId = undefined
                rule.enabled = false
              }
            }
          }
        })
      }
    })
  })

  if (fixedReferences > 0) {
    console.log(`✅ Se corrigieron ${fixedReferences} referencias de preguntas inválidas`)
  } else {
    console.log("✅ Todas las referencias de preguntas son válidas")
  }

  return validatedSections
}

interface SectionSkipLogicConfigProps {
  section: SurveySection
  allSections: SurveySection[]
  onSave: (skipLogic: SectionSkipLogic) => void
  onCancel: () => void
}

function SectionSkipLogicConfig({ section, allSections, onSave, onCancel }: SectionSkipLogicConfigProps) {
  const [enabled, setEnabled] = useState(section.skipLogic?.enabled || false)
  const [action, setAction] = useState<SectionSkipLogic["action"]>(section.skipLogic?.action || "next_section")
  const [targetSectionId, setTargetSectionId] = useState(section.skipLogic?.targetSectionId || "")
  const [targetQuestionId, setTargetQuestionId] = useState(section.skipLogic?.targetQuestionId || "")

  const handleSave = () => {
    const skipLogic: SectionSkipLogic = {
      enabled,
      action,
      targetSectionId: action === "specific_section" || action === "specific_question" ? targetSectionId : undefined,
      targetQuestionId: action === "specific_question" ? targetQuestionId : undefined,
    }
    onSave(skipLogic)
  }

  const selectedSection = allSections.find((s) => s.id === targetSectionId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Lógica de Salto de Sección</h3>
          <p className="text-sm text-muted-foreground">Controla el flujo cuando el usuario completa esta sección</p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {enabled && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Acción al completar la sección</Label>
            <Select value={action} onValueChange={(value: SectionSkipLogic["action"]) => setAction(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="next_section">Continuar a la siguiente sección</SelectItem>
                <SelectItem value="specific_section">Saltar a una sección específica</SelectItem>
                <SelectItem value="specific_question">Saltar a una pregunta específica</SelectItem>
                <SelectItem value="end_survey">Finalizar la encuesta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(action === "specific_section" || action === "specific_question") && (
            <div className="space-y-2">
              <Label>Sección destino</Label>
              <Select value={targetSectionId} onValueChange={setTargetSectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sección..." />
                </SelectTrigger>
                <SelectContent>
                  {allSections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title || `Sección ${allSections.indexOf(s) + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {action === "specific_question" && selectedSection && (
            <div className="space-y-2">
              <Label>Pregunta específica</Label>
              <Select value={targetQuestionId} onValueChange={setTargetQuestionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar pregunta..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedSection.questions.map((q, index) => (
                    <SelectItem key={q.id} value={q.id}>
                      Pregunta {index + 1}: {q.text.replace(/<[^>]*>/g, "").substring(0, 50)}...
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Preview */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Vista previa del flujo:</h4>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline">{section.title}</Badge>
              <ArrowRight className="h-4 w-4" />
              {action === "next_section" && <Badge variant="secondary">Siguiente sección</Badge>}
              {action === "end_survey" && <Badge variant="destructive">Fin de encuesta</Badge>}
              {action === "specific_section" && selectedSection && (
                <Badge variant="default">{selectedSection.title}</Badge>
              )}
              {action === "specific_question" && selectedSection && (
                <Badge variant="default">{selectedSection.title} - Pregunta específica</Badge>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={handleSave}>Guardar Configuración</Button>
      </div>
    </div>
  )
}

function CreateSurveyForProjectPageContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const projectId = params.id as string
  const surveyIdParam = searchParams.get("surveyId")

  const [projectData, setProjectData] = useState<any>(null)
  const [projectLoading, setProjectLoading] = useState<boolean>(true)
  const [initialLoading, setInitialLoading] = useState<boolean>(true)
  const [isEditMode, setIsEditMode] = useState(!!surveyIdParam)
  const [currentSurveyId, setCurrentSurveyId] = useState<string | null>(surveyIdParam)

  const [activeTab, setActiveTab] = useState<string>("details")
  const [surveyTitle, setSurveyTitle] = useState<string>("")
  const [surveyDescription, setSurveyDescription] = useState<string>("")
  const [startDate, setStartDate] = useState<string>("")
  const [deadline, setDeadline] = useState<string>("")
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [isSavingSection, setIsSavingSection] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [sections, setSections] = useState<SurveySection[]>([])
  const [sectionSaveStates, setSectionSaveStates] = useState<{ [key: string]: "saved" | "not-saved" | "error" }>({})

  const handleSaveSection = async (sectionId: string) => {
    if (!sections.length || !sectionId) return

    setIsSavingSection(true)
    try {
      let workingSurveyId = currentSurveyId

      // Si no hay surveyId, necesitamos crear primero la encuesta
      if (!workingSurveyId) {
        console.log("🆕 Creando encuesta antes de guardar sección...")

        if (!surveyTitle.trim()) {
          throw new Error("El título de la encuesta es obligatorio para guardar secciones")
        }

        const surveyData = {
          title: surveyTitle,
          description: surveyDescription,
          project_id: projectId,
          created_by: user?.id,
          status: "draft",
          settings: settings || {
            collectLocation: true,
            allowAudio: false,
            offlineMode: true,
            distributionMethods: ["app"],
          },
        }

        const { data: newSurvey, error: surveyError } = await supabase
          .from("surveys")
          .insert([surveyData])
          .select()
          .single()

        if (surveyError) throw surveyError

        workingSurveyId = newSurvey.id
        setCurrentSurveyId(workingSurveyId)
        setIsEditMode(true)

        console.log("✅ Encuesta creada con ID:", workingSurveyId)
      }

      const section = sections.find((s) => s.id === sectionId)
      if (!section) throw new Error("Sección no encontrada")

      const sectionData = {
        survey_id: workingSurveyId,
        title: section.title.trim(),
        description: section.description || "",
        order_num: sections.findIndex((s) => s.id === sectionId),
        skip_logic: section.skipLogic || null,
      }

      let savedSection

      if (
        section.id &&
        section.id !== "temp-id" &&
        section.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      ) {
        // Valid UUID - try to update existing section
        const { data, error: updateError } = await supabase
          .from("survey_sections")
          .update(sectionData)
          .eq("id", section.id)
          .select()
          .single()

        if (updateError) {
          // If update fails, try insert with new ID
          console.log("⚠️ Update failed, creating new section:", updateError.message)
          const { data: insertData, error: insertError } = await supabase
            .from("survey_sections")
            .insert([sectionData])
            .select()
            .single()

          if (insertError) throw insertError
          savedSection = insertData

          // Update section ID in local state
          setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, id: savedSection.id } : s)))
        } else {
          savedSection = data
        }
      } else {
        // No valid ID - create new section
        const { data: insertData, error: insertError } = await supabase
          .from("survey_sections")
          .insert([sectionData])
          .select()
          .single()

        if (insertError) throw insertError
        savedSection = insertData

        // Update section ID in local state
        setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, id: savedSection.id } : s)))
      }

      if (section.questions.length > 0) {
        // Delete existing questions for this section to avoid duplicates
        await supabase.from("questions").delete().eq("section_id", savedSection.id)

        const questionsToInsert = section.questions.map((q, index) => ({
          survey_id: workingSurveyId,
          section_id: savedSection.id,
          type: q.type,
          text: q.text.trim(),
          options: q.options || [],
          required: q.required || false,
          order_num: index,
          settings: {
            ...q.config,
            matrixRows: q.matrixRows,
            matrixCols: q.matrixCols,
            ratingScale: q.ratingScale,
          },
          matrix_rows: q.matrixRows || [],
          matrix_cols: q.matrixCols || [],
          rating_scale: q.ratingScale || null,
          file_url: q.image || null,
          skip_logic: q.config?.skipLogic || null,
          display_logic: q.config?.displayLogic || null,
          validation_rules: q.config?.validation || null,
        }))

        const { error: questionsError } = await supabase.from("questions").insert(questionsToInsert)

        if (questionsError) throw questionsError
      }

      // Actualizar estado de guardado
      setSectionSaveStates((prev) => ({
        ...prev,
        [savedSection.id]: "saved",
      }))

      toast({
        title: "Sección guardada",
        description: "Los cambios han sido guardados exitosamente",
      })
    } catch (error: any) {
      console.error("Error al guardar la sección:", error)
      setSectionSaveStates((prev) => ({
        ...prev,
        [sectionId]: "error",
      }))
      toast({
        title: "Error al guardar",
        description: error.message || "Ocurrió un error al guardar la sección",
        variant: "destructive",
      })
    } finally {
      setIsSavingSection(false)
    }
  }

  const [activeSectionIndex, setActiveSectionIndex] = useState<number>(0)

  const [settings, setSettings] = useState<SurveySettings>({
    collectLocation: true,
    allowAudio: false,
    offlineMode: true,
    distributionMethods: ["app"],
    theme: {
      primaryColor: "#18b0a4",
      backgroundColor: "#ffffff",
      textColor: "#1f2937",
    },
    branding: {
      showLogo: true,
      logoPosition: "top",
      logo: null, // Initialize logo as null
    },
    security: {
      passwordProtected: false,
      preventMultipleSubmissions: true,
    },
    notifications: {
      emailOnSubmission: false,
    },
    assignedUsers: [],
    assignedZones: [],
  })
  const [surveyStatus, setSurveyStatus] = useState<string>("draft")

  const [allSurveyors, setAllSurveyors] = useState<Surveyor[]>([])
  const [allZones, setAllZones] = useState<Zone[]>([])
  const [surveyorsLoading, setSurveyorsLoading] = useState<boolean>(true)
  const [zonesLoading, setZonesLoading] = useState<boolean>(true)
  const [showAssignSurveyorsModal, setShowAssignSurveyorsModal] = useState(false)
  const [showEditSettingsModal, setShowEditSettingsModal] = useState(false)
  const [displayedZoneGeometry, setDisplayedZoneGeometry] = useState<GeoJSON | null>(null)

  // New state to manage surveyor assignments per zone
  const [assignedZoneSurveyors, setAssignedZoneSurveyors] = useState<{ [zoneId: string]: string[] }>({})

  const [showSectionOrganizer, setShowSectionOrganizer] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))

  const [selectedZoneForPreview, setSelectedZoneForPreview] = useState<string | null>(null)

  const handleDragEnd = (event: any) => {
    const { active, over } = event

    if (active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id)
      const newIndex = sections.findIndex((s) => s.id === over.id)

      const newOrder = arrayMove(sections, oldIndex, newIndex)
      newOrder.forEach((s, idx) => {
        s.order_num = idx
      })
      setSections(newOrder)
    }
  }

  const updateSection = useCallback((sectionId: string, field: keyof SurveySection, value: any): void => {
    setSections((prevSections) => prevSections.map((s) => (s.id === sectionId ? { ...s, [field]: value } : s)))
    // Marcar la sección como no guardada cuando se realiza un cambio
    setSectionSaveStates((prev) => ({
      ...prev,
      [sectionId]: "not-saved",
    }))
  }, [])

  const addQuestionToSection = (sectionId: string): void => {
    const newQuestion: Question = {
      id: generateUUID(), // ✅ UUID real en lugar de timestamp
      type: "text",
      text: "",
      options: [],
      required: false,
      image: null,
      matrixRows: ["Fila 1"],
      matrixCols: ["Columna 1"],
      ratingScale: 5,
      config: {
        // Configuraciones básicas
        allowOther: false,
        randomizeOptions: false,
        ratingEmojis: true,
        scaleMin: 1,
        scaleMax: 5,

        // Configuración Likert inicializada como null
        likertScale: null,

        // Lógica de visualización y salto
        displayLogic: { enabled: false, conditions: [] },
        skipLogic: { enabled: false, rules: [] },
        validation: { required: false },
      },
    }
    setSections((prevSections) =>
      prevSections.map((s) => (s.id === sectionId ? { ...s, questions: [...s.questions, newQuestion] } : s)),
    )
  }

  const removeQuestionFromSection = (sectionId: string, questionId: string): void => {
    setSections((prevSections) =>
      prevSections.map((s) =>
        s.id === sectionId ? { ...s, questions: s.questions.filter((q) => q.id !== questionId) } : s,
      ),
    )
  }

  const updateQuestionInSection = useCallback(
    (sectionId: string, questionId: string, field: keyof Question, value: any): void => {
      setSections((prevSections) =>
        prevSections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                questions: s.questions.map((q) => (q.id === questionId ? { ...q, [field]: value } : q)),
              }
            : s,
        ),
      )
    },
    [],
  )

  const handleAssignSurveyorsSave = (assignedIds: string[]) => {
    setSettings((prev) => ({
      ...prev,
      assignedUsers: assignedIds,
    }))
    setShowAssignSurveyorsModal(false)
  }

  const handleZoneSelectionChange = (selectedIds: string[]) => {
    setSettings((prev) => ({
      ...prev,
      assignedZones: selectedIds,
    }))

    // Update assignedZoneSurveyors: keep existing assignments for selected zones, remove for deselected
    setAssignedZoneSurveyors((prevAssignments) => {
      const newAssignments: { [zoneId: string]: string[] } = {}
      selectedIds.forEach((zoneId) => {
        newAssignments[zoneId] = prevAssignments[zoneId] || [] // Keep existing or initialize empty
      })
      return newAssignments
    })

    if (selectedIds.length > 0) {
      const firstSelectedZone = allZones.find((z) => z.id === selectedIds[0])
      setDisplayedZoneGeometry(firstSelectedZone?.geometry || null)
      setSelectedZoneForPreview(selectedIds[0])
    } else {
      setDisplayedZoneGeometry(null)
      setSelectedZoneForPreview(null)
    }
  }

  const handleZonePreviewChange = (zoneId: string) => {
    const selectedZone = allZones.find((z) => z.id === zoneId)
    if (selectedZone) {
      setDisplayedZoneGeometry(selectedZone.geometry)
      setSelectedZoneForPreview(zoneId)
    }
  }

  // New handler for surveyor assignment to a specific zone
  const handleZoneSurveyorAssignmentChange = useCallback((zoneId: string, newAssignedSurveyorIds: string[]) => {
    setAssignedZoneSurveyors((prev) => ({
      ...prev,
      [zoneId]: newAssignedSurveyorIds,
    }))
  }, [])

  const handlePreview = () => {
    const sectionsWithSkipLogic = sections.map((section) => ({
      ...section,
      skip_logic: section.skipLogic || null,
      questions: section.questions.map((question) => ({
        ...question,
        config: {
          ...question.config,
          skipLogic: question.config?.skipLogic
            ? {
                enabled: question.config.skipLogic.enabled,
                rules: question.config.skipLogic.rules.map((rule) => ({
                  ...rule,
                  questionId: question.id, // Add missing questionId
                  condition: rule.value || "", // Add missing condition field
                  enabled: rule.enabled !== false, // Ensure enabled is boolean
                  operator: rule.operator || "equals",
                  value: rule.value || "",
                  targetSectionId: rule.targetSectionId || "",
                  targetQuestionId: rule.targetQuestionId || undefined,
                  targetQuestionText: rule.targetQuestionText || "",
                })),
              }
            : { enabled: false, rules: [] },
          displayLogic: question.config?.displayLogic || { enabled: false, conditions: [] },
          validation: question.config?.validation || { required: question.required || false },
        },
      })),
    }))

    const previewData = {
      title: surveyTitle,
      description: surveyDescription,
      startDate: startDate,
      deadline: deadline,
      sections: sectionsWithSkipLogic,
      settings: settings || {},
      projectData: projectData,
      assignedZoneSurveyors: assignedZoneSurveyors,
    }

    console.log("🔍 Datos de preview con lógica de salto:", previewData)
    localStorage.setItem("surveyPreviewData", JSON.stringify(previewData))
    window.open("/preview/survey", "_blank")
  }

  const handleSave = async () => {
    if (!surveyTitle.trim()) {
      toast({
        title: "Error",
        description: "El título de la encuesta es obligatorio",
        variant: "destructive",
      })
      setActiveTab("details")
      return
    }

    if (sections.length === 0) {
      toast({
        title: "Error",
        description: "Debes agregar al menos una sección",
        variant: "destructive",
      })
      setActiveTab("questions")
      return
    }

    const totalQuestions = sections.reduce((acc, section) => acc + section.questions.length, 0)
    if (totalQuestions === 0) {
      toast({
        title: "Error",
        description: "Debes agregar al menos una pregunta en alguna sección",
        variant: "destructive",
      })
      setActiveTab("questions")
      return
    }

    const invalidQuestions = sections.some((section) => section.questions.some((q) => !q.text.trim()))
    if (invalidQuestions) {
      toast({
        title: "Error",
        description: "Todas las preguntas deben tener un texto",
        variant: "destructive",
      })
      setActiveTab("questions")
      return
    }

    const invalidOptions = sections.some((section) =>
      section.questions.some(
        (q) => (q.type === "multiple_choice" || q.type === "checkbox" || q.type === "dropdown") && q.options.length < 1,
      ),
    )
    if (invalidOptions) {
      toast({
        title: "Error",
        description: "Las preguntas de opción múltiple deben tener al menos 1 opción",
        variant: "destructive",
      })
      setActiveTab("questions")
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      console.log("🔄 Iniciando proceso de guardado...")
      console.log("📊 Datos de la encuesta:", { surveyTitle, surveyDescription, sections: sections.length })

      // Validar que el usuario esté autenticado
      if (!user?.id) {
        throw new Error("Usuario no autenticado")
      }

      // Derive overall assigned_surveyors from assignedZoneSurveyors for the surveys table
      const allAssignedSurveyors = Array.from(new Set(Object.values(assignedZoneSurveyors).flat())).filter(
        Boolean,
      ) as string[]

      console.log("👥 Encuestadores asignados:", allAssignedSurveyors)
      console.log("🗺️ Zonas asignadas:", settings.assignedZones)

      const surveyData = {
        title: surveyTitle,
        description: surveyDescription,
        settings: settings || {},
        start_date: startDate || null,
        deadline: deadline || null,
        project_id: projectId,
        created_by: user.id,
        status: surveyStatus,
        assigned_surveyors: allAssignedSurveyors || [],
        assigned_zones: settings.assignedZones || [],
        logo: settings.branding?.logo || null,
        theme_config: settings.theme || null,
        security_config: settings.security || null,
        notification_config: settings.notifications || null,
        branding_config: settings.branding || null,
      }

      let surveyResult
      if (isEditMode && currentSurveyId) {
        console.log("✏️ Modo edición - Actualizando encuesta existente...")
        const { data, error: surveyError } = await supabase
          .from("surveys")
          .update(surveyData)
          .eq("id", currentSurveyId)
          .select()
          .single()
        if (surveyError) {
          console.error("❌ Error al actualizar encuesta:", surveyError)
          throw surveyError
        }
        surveyResult = data
        console.log("✅ Encuesta actualizada:", surveyResult.id)

        // Para edición, implementar lógica de upsert inteligente para preservar IDs
        console.log("🔄 Implementando lógica de upsert inteligente para preservar IDs...")

        // Eliminar preguntas existentes (esto se mantiene igual)
        const { error: deleteQuestionsError } = await supabase
          .from("questions")
          .delete()
          .eq("survey_id", currentSurveyId)
        if (deleteQuestionsError) {
          console.error("❌ Error al eliminar preguntas existentes:", deleteQuestionsError)
          throw deleteQuestionsError
        }
        console.log("✅ Preguntas existentes eliminadas")

        // En lugar de eliminar secciones, vamos a hacer upsert inteligente
        console.log("🔄 Procesando secciones con upsert inteligente...")

        // Crear un mapa de secciones existentes para referencia rápida
        const existingSectionsMap: { [key: string]: { id: string; title: string } } = {}
        const { data: existingSections } = await supabase
          .from("survey_sections")
          .select("id, title")
          .eq("survey_id", currentSurveyId)

        if (existingSections) {
          existingSections.forEach((section) => {
            existingSectionsMap[section.id] = section
          })
        }

        // Crear un mapa de secciones por título para evitar duplicados
        const sectionsByTitle: { [key: string]: SurveySection } = {}
        sections.forEach((section) => {
          if (section.title.trim()) {
            sectionsByTitle[section.title.trim()] = section
          }
        })

        // Mapa para mantener correspondencia entre IDs antiguos y nuevos de preguntas
        const questionIdMapping: { [oldId: string]: string } = {}

        // PRIMER PASO: Guardar todas las preguntas para obtener IDs permanentes
        console.log("🔄 PRIMER PASO: Guardando preguntas para obtener IDs permanentes...")

        for (const [secIndex, section] of sections.entries()) {
          console.log(`📋 Procesando sección ${secIndex + 1}: "${section.title}"`)

          // Validar que la sección tenga datos válidos
          if (!section.title || !section.title.trim()) {
            throw new Error(`La sección ${secIndex + 1} debe tener un título válido`)
          }

          // Preparar datos de la sección
          const sectionData = {
            survey_id: currentSurveyId,
            title: section.title.trim(),
            description: section.description || "",
            order_num: secIndex,
            skip_logic: section.skipLogic || null,
          }

          let newSection

          // ESTRATEGIA MEJORADA: Priorizar preservación de IDs existentes
          if (section.id && section.id !== "" && section.id !== "temp-id" && existingSectionsMap[section.id]) {
            // La sección existe en la BD con el mismo ID, hacer UPDATE
            console.log(`📝 Actualizando sección existente "${section.title}" con ID: ${section.id}`)

            try {
              const { data, error: updateError } = await supabase
                .from("survey_sections")
                .update(sectionData)
                .eq("id", section.id)
                .select()
                .single()

              if (updateError) {
                console.log(`⚠️ Error en update de sección ${section.id}:`, updateError.message)
                // Si falla el update, verificar si es por conflicto de título
                if (updateError.code === "23505") {
                  // Unique constraint violation
                  console.log(`🔄 Conflicto de título detectado, buscando sección existente...`)
                  // Buscar si ya existe una sección con este título
                  const { data: existingSection } = await supabase
                    .from("survey_sections")
                    .select("id, title")
                    .eq("survey_id", currentSurveyId)
                    .eq("title", section.title.trim())
                    .single()

                  if (existingSection) {
                    // Usar la sección existente
                    newSection = existingSection
                    section.id = existingSection.id
                    console.log(`✅ Reutilizando sección existente "${section.title}" con ID: ${existingSection.id}`)
                  } else {
                    throw new Error(`No se pudo actualizar ni encontrar la sección "${section.title}"`)
                  }
                } else {
                  throw updateError
                }
              } else {
                // Update exitoso, mantener ID original
                newSection = data
                console.log(`✅ Sección "${section.title}" actualizada manteniendo ID: ${newSection.id}`)
              }
            } catch (error) {
              console.error(`❌ Error crítico al procesar sección "${section.title}":`, error)
              throw new Error(
                `Error al procesar la sección "${section.title}": ${error instanceof Error ? error.message : "Error desconocido"}`,
              )
            }
          } else if (section.id && section.id !== "" && section.id !== "temp-id") {
            // La sección tiene un ID que no está en la BD (posiblemente eliminada)
            // Buscar si existe una sección con el mismo título
            console.log(`🔍 Sección con ID ${section.id} no encontrada, buscando por título...`)

            const { data: existingSection } = await supabase
              .from("survey_sections")
              .select("id, title")
              .eq("survey_id", currentSurveyId)
              .eq("title", section.title.trim())
              .single()

            if (existingSection) {
              // Reutilizar la sección existente
              newSection = existingSection
              const oldId = section.id
              section.id = existingSection.id
              console.log(`✅ Reutilizando sección existente "${section.title}" con ID: ${existingSection.id}`)

              // Actualizar referencias en la lógica de salto
              const updatedSections = updateSkipLogicReferences(sections, oldId, existingSection.id)
              setSections(updatedSections)
            } else {
              // Crear nueva sección
              console.log(`📝 Creando nueva sección "${section.title}"...`)
              const { data: insertData, error: insertError } = await supabase
                .from("survey_sections")
                .insert([sectionData])
                .select()
                .single()

              if (insertError) {
                console.error("❌ Error al insertar sección:", insertError)
                throw new Error(`Error al crear la sección "${section.title}": ${insertError.message}`)
              }

              newSection = insertData
              const oldId = section.id
              section.id = newSection.id
              console.log(`✅ Nueva sección "${section.title}" creada con ID: ${newSection.id}`)

              // Actualizar referencias en la lógica de salto
              const updatedSections = updateSkipLogicReferences(sections, oldId, newSection.id)
              setSections(updatedSections)
            }
          } else {
            // Si la sección no tiene ID o es temporal, hacer insert
            console.log(`📝 Insertando nueva sección "${section.title}"...`)

            const { data, error: insertError } = await supabase
              .from("survey_sections")
              .insert([sectionData])
              .select()
              .single()

            if (insertError) {
              console.error("❌ Error al insertar sección:", insertError)
              throw new Error(`Error al crear la sección "${section.title}": ${insertError.message}`)
            }

            newSection = data
            console.log(`✅ Nueva sección "${section.title}" creada con ID: ${newSection.id}`)

            // Actualizar el ID en el estado local para mantener referencias
            section.id = newSection.id
          }

          // Validar y preparar preguntas para inserción
          console.log(`❓ Procesando ${section.questions.length} preguntas de la sección "${section.title}"...`)

          for (const [qIndex, q] of section.questions.entries()) {
            // Validar que la pregunta tenga datos válidos
            if (!q.text || !q.text.trim()) {
              throw new Error(`La pregunta ${qIndex + 1} de la sección "${section.title}" debe tener un texto válido`)
            }

            // Guardar el ID antiguo para el mapeo
            const oldQuestionId = q.id

            // Extraer la configuración de la pregunta y mantener las configuraciones existentes
            const questionConfig = {
              ...(q.config || {}),
              // Preservar la configuración Likert si existe
              likertScale: q.config?.likertScale || q.config?.settings?.likertScale || null,
            } // Preparar los datos para la base de datos
            const questionData = {
              survey_id: currentSurveyId,
              section_id: newSection.id,
              type: q.type || "text",
              text: q.text.trim(),
              options: q.options || [],
              required: q.required === true,
              order_num: qIndex,

              // Campo settings - incluye todas las configuraciones
              settings: {
                allowOther: questionConfig.allowOther || false,
                randomizeOptions: questionConfig.randomizeOptions || false,
                ratingEmojis: questionConfig.ratingEmojis !== undefined ? questionConfig.ratingEmojis : true,
                scaleMin: questionConfig.scaleMin || 1,
                scaleMax: questionConfig.scaleMax || 5,
                matrixCellType: questionConfig.matrixCellType || null,
                scaleLabels: questionConfig.scaleLabels || [],
                otherText: questionConfig.otherText || "",
                dropdownMulti: questionConfig.dropdownMulti || false,
                likertScale: questionConfig.likertScale || null,
                // MATRIZ: guardar todas las configuraciones relevantes
                matrixColOptions: questionConfig.matrixColOptions || [],
                matrixRows: q.matrixRows || [],
                matrixCols: q.matrixCols || [],
                matrixRatingScale: questionConfig.matrixRatingScale || null,
                matrix: questionConfig.matrix || null,
              },

              // Campos específicos de la base de datos
              matrix_rows: q.matrixRows || [],
              matrix_cols: q.matrixCols || [],
              rating_scale: q.ratingScale || null,
              file_url: q.image || null,

              // Lógica de visualización - campo específico
              display_logic: questionConfig.displayLogic || null,

              // Lógica de salto - campo específico
              skip_logic: questionConfig.skipLogic || null,

              // Reglas de validación - campo específico
              validation_rules: questionConfig.validation || null,

              // Configuración específica de la pregunta - campo específico
              question_config: questionConfig.questionConfig || null,

              // Configuraciones de matriz
              matrix: questionConfig.matrix || null,

              // Configuraciones de comentarios y estilo
              comment_box: questionConfig.commentBox === true,
              style: questionConfig.style || {},
              parent_id: questionConfig.parentId || null,
            }

            console.log(`🔧 Datos de pregunta preparados para BD:`, questionData)

            const { data, error: insertError } = await supabase
              .from("questions")
              .insert([questionData])
              .select()
              .single()

            if (insertError) {
              console.error("❌ Error al insertar pregunta:", insertError)
              throw new Error(`Error al crear la pregunta "${q.text.substring(0, 50)}...": ${insertError.message}`)
            }

            console.log(`✅ Nueva pregunta "${q.text.substring(0, 50)}..." creada con ID: ${data.id}`)

            // Actualizar el ID de la pregunta en el estado local para mantener referencias
            q.id = data.id

            // Guardar el mapeo de ID antiguo a nuevo
            if (oldQuestionId && oldQuestionId !== "temp-id") {
              questionIdMapping[oldQuestionId] = data.id
              console.log(`🔄 Mapeo de ID de pregunta: ${oldQuestionId} -> ${data.id}`)
            }
          }
        }

        // SEGUNDO PASO: Actualizar referencias de lógica de salto con los nuevos IDs
        console.log("🔄 SEGUNDO PASO: Actualizando referencias de lógica de salto con nuevos IDs de preguntas...")
        const updatedSectionsWithNewIds = updateSkipLogicReferencesWithQuestionMapping(sections, questionIdMapping)
        setSections(updatedSectionsWithNewIds)

        // TERCER PASO: Actualizar las preguntas con la lógica de salto corregida
        console.log("🔄 TERCER PASO: Actualizando preguntas con lógica de salto corregida...")

        for (const section of updatedSectionsWithNewIds) {
          for (const [qIndex, q] of section.questions.entries()) {
            // Preparar datos actualizados de la pregunta
            const questionConfig = q.config || {}

            const updatedQuestionData = {
              // Solo actualizar los campos que pueden haber cambiado
              skip_logic: (questionConfig as any).skipLogic || null,
              display_logic: (questionConfig as any).displayLogic || null,
              validation_rules: (questionConfig as any).validation || null,
              question_config: (questionConfig as any).questionConfig || null,
              matrix: (questionConfig as any).matrix || null,
              style: (questionConfig as any).style || {},
            }

            console.log(`🔄 Actualizando pregunta "${q.text.substring(0, 50)}..." con lógica corregida...`)

            const { error: updateError } = await supabase.from("questions").update(updatedQuestionData).eq("id", q.id)

            if (updateError) {
              console.error("❌ Error al actualizar pregunta con lógica corregida:", updateError)
              // No lanzar error aquí, solo log
              console.warn(`⚠️ No se pudo actualizar la lógica de salto de la pregunta "${q.text.substring(0, 50)}..."`)
            } else {
              console.log(`✅ Pregunta "${q.text.substring(0, 50)}..." actualizada con lógica corregida`)
            }
          }
        }

        // Eliminar asignaciones encuestador-zona existentes para reemplazarlas
        const { error: deleteAssignmentsError } = await supabase
          .from("survey_surveyor_zones")
          .delete()
          .eq("survey_id", currentSurveyId)
        if (deleteAssignmentsError) {
          console.error("❌ Error al eliminar asignaciones existentes:", deleteAssignmentsError)
          throw deleteAssignmentsError
        }
        console.log("✅ Asignaciones existentes eliminadas")

        console.log("🔄 Continuando con inserción de nuevas secciones y preguntas...")
      } else {
        console.log("🆕 Modo creación - Insertando nueva encuesta...")
        const { data, error: surveyError } = await supabase.from("surveys").insert([surveyData]).select().single()
        if (surveyError) throw surveyError
        surveyResult = data
        console.log("✅ Nueva encuesta creada:", surveyResult.id)

        // Para creación, insertar secciones y preguntas
        console.log(`📝 Insertando ${sections.length} secciones para nueva encuesta...`)

        for (const [secIndex, section] of sections.entries()) {
          console.log(`📋 Procesando sección ${secIndex + 1}: "${section.title}"`)

          // Validar que la sección tenga datos válidos
          if (!section.title || !section.title.trim()) {
            throw new Error(`La sección ${secIndex + 1} debe tener un título válido`)
          }

          console.log(`📋 Insertando sección "${section.title}"...`)

          const { data: newSection, error: sectionError } = await supabase
            .from("survey_sections")
            .insert([
              {
                survey_id: surveyResult.id,
                title: section.title.trim(),
                description: section.description || "",
                order_num: secIndex,
                skip_logic: section.skipLogic || null,
              },
            ])
            .select()
            .single()
          if (sectionError) {
            console.error("❌ Error al insertar sección:", sectionError)
            throw new Error(`Error al crear la sección "${section.title}": ${sectionError.message}`)
          }
          console.log(`✅ Sección "${section.title}" creada con ID: ${newSection.id}`)

          // Validar y preparar preguntas para inserción
          console.log(`❓ Procesando ${section.questions.length} preguntas de la sección "${section.title}"...`)

          const questionsToInsert = section.questions.map((q, qIndex) => {
            // Validar que la pregunta tenga datos válidos
            if (!q.text || !q.text.trim()) {
              throw new Error(`La pregunta ${qIndex + 1} de la sección "${section.title}" debe tener un texto válido`)
            }

            // Extraer la configuración de la pregunta
            const questionConfig = q.config || {}

            // Preparar los datos para la base de datos
            const questionData = {
              survey_id: surveyResult.id,
              section_id: newSection.id,
              type: q.type || "text",
              text: q.text.trim(),
              options: q.options || [],
              required: q.required === true,
              order_num: qIndex,

              // Campo settings - incluye todas las configuraciones
              settings: {
                ...questionConfig,
                allowOther: questionConfig.allowOther || false,
                randomizeOptions: questionConfig.randomizeOptions || false,
                ratingEmojis: questionConfig.ratingEmojis !== undefined ? questionConfig.ratingEmojis : true,
                scaleMin: questionConfig.scaleMin || 1,
                scaleMax: questionConfig.scaleMax || 5,
                matrixCellType: questionConfig.matrixCellType || null,
                scaleLabels: questionConfig.scaleLabels || [],
                otherText: questionConfig.otherText || "",
                dropdownMulti: questionConfig.dropdownMulti || false,
                likertScale: questionConfig.likertScale || null, // Preservar configuración Likert
              },

              // Campos específicos de la base de datos
              matrix_rows: q.matrixRows || [],
              matrix_cols: q.matrixCols || [],
              rating_scale: q.ratingScale || null,
              file_url: q.image || null,

              // Lógica de visualización - campo específico
              display_logic: questionConfig.displayLogic || null,

              // Lógica de salto - campo específico
              skip_logic: questionConfig.skipLogic || null,

              // Reglas de validación - campo específico
              validation_rules: questionConfig.validation || null,

              // Configuración específica de la pregunta - campo específico
              question_config: questionConfig.questionConfig || null,

              // Configuraciones de matriz
              matrix: questionConfig.matrix || null,

              // Configuraciones de comentarios y estilo
              comment_box: questionConfig.commentBox === true,
              style: questionConfig.style || {},
              parent_id: questionConfig.parentId || null,
            }

            console.log(`🔧 Datos de pregunta preparados para BD:`, questionData)

            return questionData
          })

          if (questionsToInsert.length > 0) {
            console.log(`❓ Insertando ${questionsToInsert.length} preguntas en la sección "${section.title}"...`)
            const { error: questionsError } = await supabase.from("questions").insert(questionsToInsert)
            if (questionsError) {
              console.error("❌ Error al insertar preguntas:", questionsError)
              throw new Error(
                `Error al crear las preguntas de la sección "${section.title}": ${questionsError.message}`,
              )
            }
            console.log(
              `✅ ${questionsToInsert.length} preguntas insertadas correctamente en la sección "${section.title}"`,
            )
          } else {
            console.log(`ℹ️ No hay preguntas para insertar en la sección "${section.title}"`)
          }
        }
      }

      // Insert surveyor-zone assignments
      const surveyorZoneAssignmentsToInsert: {
        survey_id: string
        surveyor_id: string
        zone_id: string
      }[] = []

      for (const zoneId of settings.assignedZones || []) {
        const surveyorsForZone = assignedZoneSurveyors[zoneId] || []
        for (const surveyorId of surveyorsForZone) {
          if (surveyorId && zoneId) {
            // Validar que ambos IDs existan
            surveyorZoneAssignmentsToInsert.push({
              survey_id: surveyResult.id,
              surveyor_id: surveyorId,
              zone_id: zoneId,
            })
          }
        }
      }

      if (surveyorZoneAssignmentsToInsert.length > 0) {
        const { error: insertAssignmentsError } = await supabase
          .from("survey_surveyor_zones")
          .insert(surveyorZoneAssignmentsToInsert)
        if (insertAssignmentsError) {
          console.error("Error al insertar asignaciones:", insertAssignmentsError)
          throw new Error(`Error al asignar encuestadores a zonas: ${insertAssignmentsError.message}`)
        }
      }

      // Mensaje de éxito y redirección (tanto para creación como edición)
      const successMessage = isEditMode ? "Encuesta actualizada exitosamente" : "Encuesta guardada exitosamente"
      const successDescription = isEditMode
        ? "Tu encuesta, secciones, preguntas y asignaciones han sido actualizadas exitosamente."
        : "Tu encuesta, secciones, preguntas y asignaciones han sido guardadas exitosamente."

      toast({
        title: successMessage,
        description: successDescription,
      })

      console.log("🎉 ¡" + successMessage + "!")
      console.log("🔄 Redirigiendo a la lista de encuestas...")

      router.push(`/surveys?projectId=${projectId}`)
    } catch (err: any) {
      console.error("Error completo al guardar:", err)
      console.error("Tipo de error:", typeof err)
      console.error("Claves del error:", Object.keys(err))

      // Error más específico para debugging de Supabase
      let errorMessage = "Error al guardar la encuesta"

      if (err && typeof err === "object") {
        if (err.message) {
          errorMessage = err.message
        } else if (err.error && err.error.message) {
          errorMessage = err.error.message
        } else if (err.error && typeof err.error === "string") {
          errorMessage = err.error
        } else if (err.details) {
          errorMessage = err.details
        } else if (err.hint) {
          errorMessage = `Error: ${err.hint}`
        } else if (err.code) {
          errorMessage = `Error ${err.code}: ${err.message || "Error de base de datos"}`
        } else {
          // Si no hay mensaje específico, mostrar la estructura del error
          errorMessage = `Error desconocido: ${JSON.stringify(err, null, 2)}`
        }
      } else if (typeof err === "string") {
        errorMessage = err
      }

      setError(errorMessage)
      toast({
        title: "Error al guardar",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const fetchSurveyForEdit = useCallback(async () => {
    if (!currentSurveyId) {
      setInitialLoading(false)
      return
    }
    setIsEditMode(true)
    setInitialLoading(true)
    setError(null)

    try {
      const { data: surveyData, error: surveyError } = await supabase
        .from("surveys")
        .select(
          `
          id,
          title,
          description,
          status,
          deadline,
          start_date,
          settings,
          project_id,
          assigned_surveyors,
          assigned_zones,
          logo,
          theme_config,
          security_config,
          notification_config,
          branding_config,
          projects (
            id,
            name,
            companies (
              id,
              name,
              logo
            )
          )
        `,
        )
        .eq("id", currentSurveyId)
        .single()

      if (surveyError) throw surveyError
      if (!surveyData) {
        setError("Encuesta no encontrada.")
        return
      }

      let parsedAssignedZones: string[] = []
      if (surveyData.assigned_zones) {
        if (Array.isArray(surveyData.assigned_zones)) {
          parsedAssignedZones = surveyData.assigned_zones as string[]
        } else if (typeof surveyData.assigned_zones === "string") {
          try {
            const parsed = JSON.parse(surveyData.assigned_zones)
            if (Array.isArray(parsed)) {
              parsedAssignedZones = parsed
            } else {
              parsedAssignedZones = [surveyData.assigned_zones]
            }
          } catch (e) {
            parsedAssignedZones = [surveyData.assigned_zones]
          }
        }
      }

      setSurveyTitle(surveyData.title)
      setSurveyDescription(surveyData.description || "")
      setStartDate(surveyData.start_date ? surveyData.start_date.split("T")[0] : "")
      setDeadline(surveyData.deadline ? surveyData.deadline.split("T")[0] : "")
      setSurveyStatus(surveyData.status || "draft")

      console.log("📊 Datos de la encuesta cargados:", {
        title: surveyData.title,
        assigned_surveyors: surveyData.assigned_surveyors,
        assigned_zones: surveyData.assigned_zones,
        parsedAssignedZones,
      })

      setSettings((prevSettings) => ({
        ...prevSettings,
        ...surveyData.settings,
        assignedUsers: surveyData.assigned_surveyors || [],
        assignedZones: parsedAssignedZones,
        theme: surveyData.theme_config || prevSettings.theme,
        security: surveyData.security_config || prevSettings.security,
        notifications: surveyData.notification_config || prevSettings.notifications,
        branding: {
          ...prevSettings.branding,
          ...surveyData.branding_config,
          logo: surveyData.logo || surveyData.branding_config?.logo || surveyData.settings?.branding?.logo || null,
        },
      }))
      setProjectData(surveyData.projects)

      // Fetch surveyor-zone assignments
      const { data: surveyorZoneData, error: surveyorZoneError } = await supabase
        .from("survey_surveyor_zones")
        .select("surveyor_id, zone_id")
        .eq("survey_id", currentSurveyId)

      if (surveyorZoneError) throw surveyorZoneError

      console.log("🔍 Datos de asignación encuestador-zona:", surveyorZoneData)

      const newAssignedZoneSurveyors: { [zoneId: string]: string[] } = {}
      surveyorZoneData.forEach((assignment) => {
        if (!newAssignedZoneSurveyors[assignment.zone_id]) {
          newAssignedZoneSurveyors[assignment.zone_id] = []
        }
        newAssignedZoneSurveyors[assignment.zone_id].push(assignment.surveyor_id)
      })

      console.log("👥 Encuestadores asignados por zona:", newAssignedZoneSurveyors)
      setAssignedZoneSurveyors(newAssignedZoneSurveyors)

      // Configurar zonas después de cargar los datos
      if (parsedAssignedZones.length > 0 && allZones.length > 0) {
        const firstAssignedZone = allZones.find((z) => z.id === parsedAssignedZones[0])
        setDisplayedZoneGeometry(firstAssignedZone?.geometry || null)
        setSelectedZoneForPreview(parsedAssignedZones[0])
        console.log("🗺️ Zona seleccionada para preview:", parsedAssignedZones[0])
        console.log("🗺️ Geometría de la zona:", firstAssignedZone?.geometry)
      } else {
        setDisplayedZoneGeometry(null)
        setSelectedZoneForPreview(null)
        console.log("ℹ️ No hay zonas asignadas o no se han cargado las zonas")
      }

      // Fetch sections and their questions
      console.log("🔍 Buscando secciones para survey_id:", currentSurveyId)

      const { data: sectionsData, error: sectionsError } = await supabase
        .from("survey_sections")
        .select(
          `
         id,
         title,
         description,
         order_num,
         skip_logic,
         questions (
           id,
           type,
           text,
           options,
           required,
           order_num,
           file_url,
           matrix_rows,
           matrix_cols,
           rating,
           settings,
           display_logic,
           skip_logic,
           validation_rules,
           question_config,
           matrix,
           comment_box,
           style,
           parent_id
         )
       `,
        )
        .eq("survey_id", currentSurveyId)
        .order("order_num", { ascending: true })

      if (sectionsError) {
        console.error("❌ Error al cargar secciones:", sectionsError)
        console.error("❌ Detalles del error:", JSON.stringify(sectionsError, null, 2))
        throw sectionsError
      }

      console.log("📋 Datos de secciones cargados:", sectionsData)
      console.log("📋 Número de secciones:", sectionsData?.length || 0)

      // Verificar si hay secciones pero sin preguntas
      if (sectionsData && sectionsData.length > 0) {
        sectionsData.forEach((section, index) => {
          console.log(`📋 Sección ${index + 1}: "${section.title}"`)
          console.log(`📋 ID de sección: ${section.id}`)
          console.log(`📋 Preguntas en sección: ${section.questions?.length || 0}`)
          if (section.questions && section.questions.length > 0) {
            section.questions.forEach((q, qIndex) => {
              console.log(`  ❓ Pregunta ${qIndex + 1}: "${q.text}" (tipo: ${q.type})`)
            })
          } else {
            console.log(`  ⚠️ Esta sección no tiene preguntas`)
          }
        })
      } else {
        console.log("⚠️ No se encontraron secciones para este survey")
      }

      const formattedSections: SurveySection[] = sectionsData.map((s) => {
        console.log(`📋 Procesando sección: "${s.title}" con ${s.questions?.length || 0} preguntas`)
        return {
          id: s.id,
          title: s.title,
          description: s.description || "",
          order_num: s.order_num,
          skipLogic: s.skip_logic ? s.skip_logic : undefined,
          questions:
            s.questions
              ?.sort((a, b) => a.order_num - b.order_num)
              .map((q) => {
                console.log(`❓ Procesando pregunta: "${q.text}" (tipo: ${q.type})`)
                console.log(`❓ Datos de pregunta:`, {
                  id: q.id,
                  type: q.type,
                  text: q.text,
                  options: q.options,
                  required: q.required,
                  rating: q.rating,
                  settings: q.settings,
                  display_logic: q.display_logic,
                  skip_logic: q.skip_logic,
                  validation_rules: q.validation_rules,
                  question_config: q.question_config,
                  matrix: q.matrix,
                  comment_box: q.comment_box,
                  style: q.style,
                })

                // Construir la configuración completa de la pregunta
                const questionConfig = {
                  // Configuraciones generales del campo settings
                  ...q.settings,

                  // Preservar configuración Likert si existe
                  likertScale: q.settings?.likertScale || null,

                  // Configuraciones específicas de la pregunta
                  matrixRows: q.matrix_rows || [],
                  matrixCols: q.matrix_cols || [],
                  ratingScale: q.rating_scale || q.rating || 5,

                  // Lógica de visualización - desde campo específico
                  displayLogic: q.display_logic || { enabled: false, conditions: [] },

                  // Lógica de salto - desde campo específico
                  skipLogic: q.skip_logic || { enabled: false, rules: [] },

                  // Reglas de validación - desde campo específico
                  validation: q.validation_rules || { required: q.required || false },

                  // Configuración específica de la pregunta - desde campo específico
                  questionConfig: q.question_config || {},

                  // Configuraciones de matriz
                  matrix: q.matrix || null,

                  // Configuraciones de comentarios y estilo
                  commentBox: q.comment_box || false,
                  style: q.style || {},
                  parentId: q.parent_id || null,

                  // Configuraciones adicionales
                  allowOther: q.settings?.allowOther || false,
                  randomizeOptions: q.settings?.randomizeOptions || false,
                  ratingEmojis: q.settings?.ratingEmojis !== undefined ? q.settings.ratingEmojis : true,
                  scaleMin: q.settings?.scaleMin || 1,
                  scaleMax: q.settings?.scaleMax || 5,
                }

                // Depuración de configuración
                console.log(`📝 Configuración cargada para pregunta "${q.text.substring(0, 30)}...":`, {
                  id: q.id,
                  likertScale: questionConfig.likertScale,
                  settings: q.settings,
                })

                console.log(`🔧 Configuración avanzada para pregunta "${q.text}":`, questionConfig)

                return {
                  id: q.id,
                  type: q.type || "text",
                  text: q.text.trim(),
                  options: q.options || [],
                  required: q.required,
                  image: q.file_url,
                  matrixRows: q.matrix_rows || [],
                  matrixCols: q.matrix_cols || [],
                  ratingScale: q.rating_scale || q.rating || 5,
                  config: questionConfig,
                }
              }) || [],
        }
      })

      console.log("📋 Secciones formateadas:", formattedSections)

      // Validar y corregir referencias de preguntas en la lógica de salto
      const validatedSections = validateAndFixSkipLogicReferences(formattedSections)

      setSections(validatedSections)
    } catch (err: any) {
      console.error("Error fetching survey for edit:", err)
      setError(err.message || "No se pudo cargar la encuesta para editar.")
      toast({
        title: "Error",
        description: err.message || "No se pudo cargar la encuesta para editar",
        variant: "destructive",
      })
    } finally {
      setInitialLoading(false)
    }
  }, [currentSurveyId, toast])

  useEffect(() => {
    async function fetchProject() {
      setProjectLoading(true)
      const { data, error } = await supabase
        .from("projects")
        .select(
          `
      id,
      name,
      companies (
        id,
        name,
        logo
      )
    `,
        )
        .eq("id", projectId)
        .single()
      if (!error && data) {
        setProjectData(data)
      }
      setProjectLoading(false)
    }
    if (projectId) fetchProject()
  }, [projectId])

  useEffect(() => {
    async function fetchSurveyorsAndZones() {
      setSurveyorsLoading(true)
      setZonesLoading(true)
      const { data: surveyorsData, error: surveyorsError } = await supabase.from("surveyors").select("id, name, email")
      if (surveyorsData) setAllSurveyors(surveyorsData)
      if (surveyorsError) console.error("Error fetching surveyors:", surveyorsError)
      setSurveyorsLoading(false)

      const { data: zonesData, error: zonesError } = await supabase
        .from("zones")
        .select("id, name, geometry, map_snapshot, description")
      if (zonesData) setAllZones(zonesData)
      if (zonesError) console.error("Error fetching zones:", zonesError)
      setZonesLoading(false)
    }
    fetchSurveyorsAndZones()
  }, [])

  useEffect(() => {
    if (!authLoading && user && projectId) {
      if (currentSurveyId) {
        fetchSurveyForEdit()
      } else {
        setInitialLoading(false)
      }
    }
  }, [authLoading, user, projectId, currentSurveyId, fetchSurveyForEdit])

  const addSection = (): void => {
    const newSection: SurveySection = {
      id: generateUUID(), // ✅ UUID real en lugar de timestamp
      title: `Nueva Sección ${sections.length + 1}`,
      description: "",
      order_num: sections.length,
      questions: [],
      skipLogic: undefined,
    }
    setSections([...sections, newSection])
  }

  const removeSection = async (sectionId: string) => {
    try {
      console.log(`🗑️ Iniciando eliminación de sección "${sectionId}"...`)

      // Validar que el sectionId sea un UUID válido
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

      if (!uuidRegex.test(sectionId)) {
        console.error("❌ Error: sectionId no es un UUID válido:", sectionId)
        toast({
          title: "Error de formato",
          description: "El ID de la sección no tiene el formato correcto. Contacta al administrador.",
          variant: "destructive",
        })
        return
      }

      // Si estamos en modo edición y la sección tiene un ID válido en la base de datos
      if (isEditMode && sectionId && sectionId !== "" && sectionId !== "temp-id" && currentSurveyId) {
        console.log("🔄 PASO 1: Limpiando referencias en la lógica de salto...")

        // Limpiar referencias en secciones existentes (usando el estado local)
        for (const section of sections) {
          if (
            section.id !== sectionId &&
            section.skipLogic?.enabled &&
            section.skipLogic.targetSectionId === sectionId
          ) {
            console.log(`⚠️ Limpiando referencia en sección "${section.title}"`)

            // Validar que el ID de la sección sea un UUID válido antes de actualizar
            if (uuidRegex.test(section.id)) {
              // Actualizar en la base de datos
              const { error: updateError } = await supabase
                .from("survey_sections")
                .update({
                  skip_logic: { enabled: false, action: "next_section" },
                })
                .eq("id", section.id)

              if (updateError) {
                console.error("❌ Error al limpiar lógica de sección:", updateError)
              }
            } else {
              console.warn("⚠️ Sección con ID inválido encontrada:", section.id)
            }
          }
        }

        // Limpiar referencias en preguntas existentes (usando el estado local)
        for (const section of sections) {
          if (section.id !== sectionId) {
            for (const question of section.questions) {
              if (question.config?.skipLogic?.enabled && question.config.skipLogic.rules) {
                const hasInvalidReferences = question.config.skipLogic.rules.some((rule: any) => {
                  return (
                    rule.targetSectionId === sectionId ||
                    (rule.targetQuestionId &&
                      sections.find(
                        (s) => s.id === sectionId && s.questions.some((q) => q.id === rule.targetQuestionId),
                      ))
                  )
                })

                if (hasInvalidReferences) {
                  console.log(`⚠️ Limpiando lógica de pregunta "${question.text.substring(0, 50)}..."`)

                  // Validar que el ID de la pregunta sea un UUID válido antes de actualizar
                  if (uuidRegex.test(question.id)) {
                    const { error: updateError } = await supabase
                      .from("questions")
                      .update({
                        question_config: {
                          ...question.config,
                          skipLogic: { enabled: false, rules: [] },
                        },
                      })
                      .eq("id", question.id)

                    if (updateError) {
                      console.error("❌ Error al limpiar lógica de pregunta:", updateError)
                    }
                  } else {
                    console.warn("⚠️ Pregunta con ID inválido encontrada:", question.id)
                  }
                }
              }
            }
          }
        }

        console.log("✅ Referencias limpiadas exitosamente")

        // PASO 2: Eliminar preguntas de la sección
        console.log("🗑️ PASO 2: Eliminando preguntas de la sección...")

        // Primero verificar si hay preguntas en la sección
        const { data: questionsInSection, error: checkError } = await supabase
          .from("questions")
          .select("id, text")
          .eq("section_id", sectionId)

        if (checkError) {
          console.error("❌ Error al verificar preguntas de la sección:", checkError)
          throw new Error(`Error al verificar preguntas: ${checkError.message}`)
        }

        console.log(`📊 Sección tiene ${questionsInSection?.length || 0} preguntas`)

        if (questionsInSection && questionsInSection.length > 0) {
          // Intentar eliminar las preguntas
          const { error: deleteQuestionsError } = await supabase.from("questions").delete().eq("section_id", sectionId)

          if (deleteQuestionsError) {
            console.error("❌ Error al eliminar preguntas:", deleteQuestionsError)
            console.error("❌ Detalles del error:", {
              code: deleteQuestionsError.code,
              message: deleteQuestionsError.message,
              details: deleteQuestionsError.details,
              hint: deleteQuestionsError.hint,
            })

            // Intentar obtener más información sobre el error
            if (deleteQuestionsError.code === "23503") {
              throw new Error(
                "No se pueden eliminar las preguntas porque están referenciadas por otras partes del sistema (restricción de clave foránea)",
              )
            } else if (deleteQuestionsError.code === "42501") {
              throw new Error("No tienes permisos para eliminar preguntas en esta encuesta")
            } else if (deleteQuestionsError.code === "22P02") {
              throw new Error("Error de formato: Los IDs de las preguntas no tienen el formato correcto (UUID)")
            } else {
              throw new Error(`Error al eliminar preguntas: ${deleteQuestionsError.message}`)
            }
          }

          console.log("✅ Preguntas eliminadas exitosamente")
        } else {
          console.log("ℹ️ No hay preguntas que eliminar en esta sección")
        }

        // PASO 3: Eliminar la sección
        console.log("🗑️ PASO 3: Eliminando sección...")

        const { error: deleteSectionError } = await supabase.from("survey_sections").delete().eq("id", sectionId)

        if (deleteSectionError) {
          console.error("❌ Error al eliminar sección:", deleteSectionError)
          throw new Error(`Error al eliminar sección: ${deleteSectionError.message}`)
        }

        console.log("✅ Sección eliminada exitosamente")

        // PASO 4: Actualizar estado local
        console.log("🔄 PASO 4: Actualizando estado local...")
        setSections((prevSections) => prevSections.filter((s) => s.id !== sectionId))
      } else {
        // Modo creación o sección temporal - solo actualizar estado local
        console.log("📝 Modo creación - eliminando solo del estado local")
        setSections(sections.filter((s) => s.id !== sectionId))
      }

      console.log("🎉 Eliminación completada exitosamente")

      toast({
        title: "Sección eliminada",
        description:
          "La sección y sus preguntas han sido eliminadas exitosamente. Todas las referencias en la lógica de salto han sido limpiadas.",
        variant: "default",
      })
    } catch (error) {
      console.error("❌ Error crítico al eliminar sección:", error)

      // Mostrar error específico al usuario
      const errorMessage = error instanceof Error ? error.message : "Error desconocido"

      toast({
        title: "Error al eliminar sección",
        description: `No se pudo eliminar la sección: ${errorMessage}`,
        variant: "destructive",
      })
    }
  }

  const handleDuplicateQuestion = (sectionId: string, questionId: string): void => {
    setSections((prevSections) =>
      prevSections.map((s) => {
        if (s.id === sectionId) {
          const questionToDuplicate = s.questions.find((q) => q.id === questionId)
          if (questionToDuplicate) {
            const newQuestion = {
              ...questionToDuplicate,
              id: generateUUID(), // ✅ UUID real en lugar de timestamp
              text: `${questionToDuplicate.text} (Copia)`,
            }
            const questionIndex = s.questions.findIndex((q) => q.id === questionId)
            const newQuestions = [...s.questions]
            newQuestions.splice(questionIndex + 1, 0, newQuestion)
            return { ...s, questions: newQuestions }
          }
        }
        return s
      }),
    )
  }

  const handleBrandingChange = (field: string, value: any) => {
    setSettings((prevSettings) => ({
      ...prevSettings,
      branding: {
        ...prevSettings.branding,
        [field]: value,
      },
    }))
  }

  const handleSectionsChange = (newSections: SurveySection[]) => {
    setSections(newSections)
  }

  // Redirect to login if no user
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  if (authLoading || projectLoading || surveyorsLoading || zonesLoading || initialLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <ClientLayout>
      <DashboardLayout>
        <div className="p-4 sm:p-6">
          <div className="flex items-center mb-6">
            <Button variant="ghost" size="icon" className="mr-3" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                {isEditMode ? "Editar Encuesta" : "Crear Encuesta"}
              </h1>
              {projectData && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="font-medium">{projectData.companies?.name}</span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    <span className="font-medium">{projectData.name}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Botón Vista Previa movido al bloque 'Trabajando en:' */}
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {showSectionOrganizer && (
            <SectionOrganizer
              sections={sections}
              onSectionsChange={(newSections) => {
                setSections(newSections)
                // Marcar todas las secciones como no guardadas después de reorganizar
                const newSaveStates = newSections.reduce(
                  (acc, section) => ({
                    ...acc,
                    [section.id]: "not-saved",
                  }),
                  {},
                )
                setSectionSaveStates(newSaveStates)
                setShowSectionOrganizer(false)
              }}
              onClose={() => setShowSectionOrganizer(false)}
            />
          )}
          <div className="flex-1 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="details">Detalles</TabsTrigger>
                <TabsTrigger value="questions">Preguntas</TabsTrigger>
                <TabsTrigger value="assignment">Asignación</TabsTrigger>
                <TabsTrigger value="settings">Configuración</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6">
                {/* ... existing details content ... */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">Información básica de la encuesta</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-base font-medium">
                        Título de la encuesta *
                      </Label>
                      <Input
                        id="title"
                        value={surveyTitle}
                        onChange={(e) => setSurveyTitle(e.target.value)}
                        placeholder="Ej: Encuesta de satisfacción del cliente"
                        className="text-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-base font-medium">
                        Descripción
                      </Label>
                      <Textarea
                        id="description"
                        value={surveyDescription}
                        onChange={(e) => setSurveyDescription(e.target.value)}
                        placeholder="Describe el propósito de esta encuesta y cualquier información relevante para los participantes"
                        rows={4}
                        className="resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="startDate" className="text-base font-medium">
                        Fecha de inicio
                      </Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-fit"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deadline" className="text-base font-medium">
                        Fecha límite
                      </Label>
                      <Input
                        id="deadline"
                        type="date"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        className="w-fit"
                      />
                      <p className="text-sm text-muted-foreground">
                        Si estableces una fecha límite, la encuesta se cerrará automáticamente
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="survey-status" className="text-base font-medium">
                        Estado de la encuesta
                      </Label>
                      <Select value={surveyStatus} onValueChange={setSurveyStatus}>
                        <SelectTrigger id="survey-status" className="w-fit">
                          <SelectValue placeholder="Selecciona el estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Borrador</SelectItem>
                          <SelectItem value="active">Activa</SelectItem>
                          <SelectItem value="completed">Completada</SelectItem>
                          <SelectItem value="archived">Archivada</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">Define el estado inicial de la encuesta.</p>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="ml-auto gap-2 bg-primary hover:bg-primary/90 text-white rounded-full"
                      style={{ backgroundColor: "#18b0a4" }}
                      onClick={() => setActiveTab("questions")}
                    >
                      Siguiente: Crear preguntas <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>

              <TabsContent value="questions" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <MessageSquareText className="h-5 w-5" />
                          Secciones y Preguntas
                        </CardTitle>
                        <CardDescription>
                          Organiza tu encuesta en secciones temáticas y agrega preguntas específicas
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {/* Botón Organizar movido al bloque 'Trabajando en:' */}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {sections.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                          <Section className="h-4 w-4" />
                          <span>
                            {sections.length} sección{sections.length !== 1 ? "es" : ""}
                          </span>
                          <span>•</span>
                          <span>
                            {sections.reduce((total, section) => total + section.questions.length, 0)} pregunta
                            {sections.reduce((total, section) => total + section.questions.length, 0) !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}

                      {sections.length > 0 ? (
                        <div className="space-y-6">
                          {/* Selector de secciones */}
                          <div className="sticky top-0 z-50 flex items-center justify-between p-4 bg-muted/30 rounded-lg border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
                            <div className="flex items-center gap-4">
                              <Label className="text-sm font-medium">Trabajando en:</Label>
                              <Select
                                value={activeSectionIndex.toString()}
                                onValueChange={(value) => setActiveSectionIndex(Number.parseInt(value))}
                              >
                                <SelectTrigger className="w-[400px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {sections.map((section, index) => (
                                    <SelectItem key={section.id} value={index.toString()}>
                                      <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="text-xs">
                                          {index + 1}
                                        </Badge>
                                        <span>{stripHtml(section.title) || `Sección ${index + 1}`}</span>
                                        <span className="text-muted-foreground">
                                          ({section.questions.length} pregunta
                                          {section.questions.length !== 1 ? "s" : ""})
                                        </span>
                                        {sectionSaveStates[section.id] && (
                                          <Badge
                                            variant={
                                              sectionSaveStates[section.id] === "saved" ? "default" : "destructive"
                                            }
                                            className="ml-2 text-xs"
                                          >
                                            {sectionSaveStates[section.id] === "saved"
                                              ? "Guardado"
                                              : sectionSaveStates[section.id] === "error"
                                                ? "Error"
                                                : "Sin guardar"}
                                          </Badge>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSaveSection(sections[activeSectionIndex].id)}
                                disabled={isSavingSection}
                              >
                                {isSavingSection ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                    Guardando...
                                  </>
                                ) : (
                                  <>
                                    <Save className="h-4 w-4 mr-1" />
                                    Guardar Sección
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  for (const section of sections) {
                                    if (sectionSaveStates[section.id] !== "saved") {
                                      await handleSaveSection(section.id);
                                    }
                                  }
                                }}
                                disabled={isSavingSection}
                              >
                                <Save className="h-4 w-4 mr-1" />
                                Guardar todas las secciones
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newSection: SurveySection = {
                                    id: generateUUID(),
                                    title: `Nueva Sección ${sections.length + 1}`,
                                    description: "",
                                    order_num: sections.length,
                                    questions: [],
                                    skipLogic: undefined,
                                  }
                                  setSections([...sections, newSection])
                                  setActiveSectionIndex(sections.length) // Cambiar a la nueva sección
                                }}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Nueva Sección
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePreview}
                                className="gap-2 bg-transparent"
                                disabled={sections.length === 0}
                              >
                                <Eye className="h-4 w-4" />
                                Vista Previa
                              </Button>
                              <Button
                                onClick={() => setShowSectionOrganizer(true)}
                                variant="outline"
                                size="sm"
                                disabled={sections.length === 0}
                              >
                                <ArrowUpDown className="h-4 w-4 mr-2" />
                                Organizar
                              </Button>
                            </div>
                          </div>

                          {/* Sección activa */}
                          {sections[activeSectionIndex] && (
                            <SortableSection
                              key={sections[activeSectionIndex].id}
                              section={sections[activeSectionIndex]}
                              index={activeSectionIndex}
                              onRemoveSection={(sectionId) => {
                                removeSection(sectionId)
                                // Ajustar el índice activo si es necesario
                                if (activeSectionIndex >= sections.length - 1) {
                                  setActiveSectionIndex(Math.max(0, sections.length - 2))
                                }
                              }}
                              onUpdateSection={updateSection}
                              onAddQuestion={addQuestionToSection}
                              onRemoveQuestion={removeQuestionFromSection}
                              onUpdateQuestion={updateQuestionInSection}
                              onDuplicateQuestion={handleDuplicateQuestion}
                              allSections={sections}
                              sections={sections}
                              setSections={setSections}
                            />
                          )}

                          {/* Navegación entre secciones */}
                          <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActiveSectionIndex(Math.max(0, activeSectionIndex - 1))}
                              disabled={activeSectionIndex === 0}
                            >
                              <ArrowLeft className="h-4 w-4 mr-1" />
                              Sección Anterior
                            </Button>

                            <div className="text-sm text-muted-foreground">
                              Sección {activeSectionIndex + 1} de {sections.length}
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setActiveSectionIndex(Math.min(sections.length - 1, activeSectionIndex + 1))
                              }
                              disabled={activeSectionIndex === sections.length - 1}
                            >
                              Sección Siguiente
                              <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // Estado vacío cuando no hay secciones
                        <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                              <Section className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div>
                              <h3 className="font-medium">Agregar primera sección</h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                Organiza tus preguntas en bloques temáticos
                              </p>
                            </div>
                            <Button variant="outline" onClick={addSection} className="mt-2 bg-transparent">
                              <Plus className="h-4 w-4 mr-2" />
                              Crear sección
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between gap-4 pt-6 border-t">
                      <Button
                        variant="outline"
                        className="gap-2 bg-transparent"
                        onClick={() => setActiveTab("details")}
                      >
                        <ArrowLeft className="h-4 w-4" /> Anterior: Detalles
                      </Button>
                      <Button className="gap-2" onClick={() => setActiveTab("assignment")}>
                        Siguiente: Asignación <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
<TabsContent value="assignment" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          Seleccionar Zonas
                        </CardTitle>
                        <CardDescription>Elige las zonas geográficas donde se realizará la encuesta</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <MultiSelectZones
                          zones={allZones}
                          selectedZoneIds={settings.assignedZones || []}
                          onSelectionChange={handleZoneSelectionChange}
                          placeholder="Buscar y seleccionar zonas..."
                        />
                      </CardContent>
                    </Card>

                    {settings.assignedZones && settings.assignedZones.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          Asignación por Zona ({settings.assignedZones.length})
                        </h3>

                        <div className="grid grid-cols-1 gap-4">
                          {settings.assignedZones.map((zoneId) => {
                            const zone = allZones.find((z) => z.id === zoneId)
                            if (!zone) return null

                            const assignedCount = assignedZoneSurveyors[zone.id]?.length || 0

                            return (
                              <Card key={zone.id} className="overflow-hidden">
                                <div className="flex">
                                  <div className="w-32 h-32 flex-shrink-0 relative bg-gray-100">
                                    {zone.map_snapshot ? (
                                      <img
                                        src={zone.map_snapshot || "/placeholder.svg"}
                                        alt={`Vista de ${zone.name}`}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50">
                                        <MapPin className="h-8 w-8 text-gray-400" />
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/10"></div>
                                  </div>

                                  <div className="flex-1 p-4">
                                    <div className="flex items-start justify-between mb-3">
                                      <div>
                                        <h4 className="font-semibold text-lg">{zone.name}</h4>
                                        {zone.description && (
                                          <p className="text-sm text-muted-foreground mt-1">{zone.description}</p>
                                        )}
                                      </div>
                                      <Badge variant={assignedCount > 0 ? "default" : "secondary"}>
                                        {assignedCount} encuestador{assignedCount !== 1 ? "es" : ""}
                                      </Badge>
                                    </div>

                                    <ZoneSurveyorAssignment
                                      zoneId={zone.id}
                                      zoneName={zone.name}
                                      allSurveyors={allSurveyors}
                                      assignedSurveyorIds={assignedZoneSurveyors[zone.id] || []}
                                      onAssignmentChange={handleZoneSurveyorAssignmentChange}
                                    />
                                  </div>
                                </div>
                              </Card>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {(!settings.assignedZones || settings.assignedZones.length === 0) && (
                      <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-12">
                          <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
                          <h3 className="text-lg font-semibold mb-2">No hay zonas seleccionadas</h3>
                          <p className="text-muted-foreground text-center mb-4">
                            Selecciona las zonas donde se realizará la encuesta para poder asignar encuestadores
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Users className="h-4 w-4" />
                          Asignación General
                        </CardTitle>
                        <CardDescription className="text-sm">
                          Encuestadores con acceso a todas las zonas
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Button
                          variant="outline"
                          className="w-full gap-2 bg-transparent"
                          onClick={() => setShowAssignSurveyorsModal(true)}
                        >
                          <Users className="h-4 w-4" />
                          {(settings.assignedUsers?.length ?? 0) > 0 ? "Editar" : "Asignar"} Encuestadores
                        </Button>

                        {(settings.assignedUsers?.length ?? 0) > 0 ? (
                          <div className="space-y-2">
                            {settings.assignedUsers?.slice(0, 3).map((userId) => {
                              const assignedUser = allSurveyors.find((u) => u.id === userId)
                              return assignedUser ? (
                                <div key={userId} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-xs">
                                      {assignedUser.name
                                        ? assignedUser.name.substring(0, 2).toUpperCase()
                                        : assignedUser.email.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">
                                      {assignedUser.name || assignedUser.email}
                                    </p>
                                  </div>
                                </div>
                              ) : null
                            })}
                            {settings.assignedUsers && settings.assignedUsers.length > 3 && (
                              <p className="text-xs text-muted-foreground text-center">
                                +{(settings.assignedUsers?.length ?? 0) - 3} más
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Sin encuestadores asignados</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <BarChart3 className="h-4 w-4" />
                          Resumen
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Zonas seleccionadas</span>
                          <Badge variant="outline">{settings.assignedZones?.length || 0}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Encuestadores generales</span>
                          <Badge variant="outline">{settings.assignedUsers?.length || 0}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Asignaciones por zona</span>
                          <Badge variant="outline">
                            {Object.values(assignedZoneSurveyors).reduce(
                              (total, surveyors) => total + surveyors.length,
                              0,
                            )}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    {displayedZoneGeometry && settings.assignedZones && settings.assignedZones.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Map className="h-4 w-4" />
                            Vista de Zona
                          </CardTitle>
                          {settings.assignedZones.length > 1 && (
                            <div className="mt-2">
                              <Select value={selectedZoneForPreview || ""} onValueChange={handleZonePreviewChange}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Seleccionar zona para vista previa" />
                                </SelectTrigger>
                                <SelectContent>
                                  {settings.assignedZones.map((zoneId) => {
                                    const zone = allZones.find((z) => z.id === zoneId)
                                    return zone ? (
                                      <SelectItem key={zone.id} value={zone.id}>
                                        {zone.name}
                                      </SelectItem>
                                    ) : null
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="relative w-full h-48 overflow-hidden rounded-b-lg z-0">
                            <MapWithDrawing
                              initialGeometry={displayedZoneGeometry}
                              onGeometryChange={() => {}}
                              readOnly={true}
                              key={`zone-preview-${selectedZoneForPreview}-${generateUUID()}`}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between gap-4 pt-6 border-t">
                  <Button variant="outline" className="gap-2 bg-transparent" onClick={() => setActiveTab("questions")}>
                    <ArrowLeft className="h-4 w-4" /> Anterior: Configuración
                  </Button>
                  <Button variant="outline" className="gap-2 bg-transparent" onClick={() => setActiveTab("settings")}>
                    Siguiente: Configuración <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>

               <TabsContent value="settings" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Configuración de la Encuesta</CardTitle>
                    <CardDescription>Administra la configuración de esta encuesta</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Distribución</h3>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span>Enlace público</span>
                            <Badge
                              variant={settings.distributionMethods?.includes("public_link") ? "default" : "outline"}
                            >
                              {settings.distributionMethods?.includes("public_link") ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Código QR</span>
                            <Badge variant={settings.distributionMethods?.includes("qr_code") ? "default" : "outline"}>
                              {settings.distributionMethods?.includes("qr_code") ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Email</span>
                            <Badge variant={settings.distributionMethods?.includes("email") ? "default" : "outline"}>
                              {settings.distributionMethods?.includes("email") ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>WhatsApp</span>
                            <Badge variant={settings.distributionMethods?.includes("whatsapp") ? "default" : "outline"}>
                              {settings.distributionMethods?.includes("whatsapp") ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Recolección de Datos</h3>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span>Modo offline</span>
                            <Badge variant={settings.offlineMode ? "default" : "outline"}>
                              {settings.offlineMode ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Geolocalización</span>
                            <Badge variant={settings.collectLocation ? "default" : "outline"}>
                              {settings.collectLocation ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Grabación de audio</span>
                            <Badge variant={settings.allowAudio ? "default" : "outline"}>
                              {settings.allowAudio ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Tiempo de encuesta</span>
                            <Badge variant="default">Activo</Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        className="gap-2 bg-transparent"
                        onClick={() => setShowEditSettingsModal(true)}
                      >
                        <Edit className="h-4 w-4 mr-2" /> Editar Configuración
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Marca (Branding)</CardTitle>
                    <CardDescription>Personaliza la apariencia de tu encuesta</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="survey-logo" className="text-base font-medium">
                        Logo de la Encuesta
                      </Label>
                      <SurveyLogoUpload
                        value={settings.branding?.logo || null}
                        onChange={(value) => handleBrandingChange("logo", value)}
                      />
                      <p className="text-sm text-muted-foreground">
                        Sube un logo para tu encuesta
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-logo">Mostrar Logo</Label>
                      <Switch
                        id="show-logo"
                        checked={settings.branding?.showLogo}
                        onCheckedChange={(checked) => handleBrandingChange("showLogo", checked)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="logo-position">Posición del Logo</Label>
                      <Select
                        value={settings.branding?.logoPosition || "top"}
                        onValueChange={(value) => handleBrandingChange("logoPosition", value)}
                      >
                        <SelectTrigger id="logo-position">
                          <SelectValue placeholder="Seleccionar posición" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top">Superior</SelectItem>
                          <SelectItem value="bottom">Inferior</SelectItem>
                          <SelectItem value="left">Izquierda</SelectItem>
                          <SelectItem value="right">Derecha</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex flex-col sm:flex-row justify-between gap-4 pt-6 border-t">
                  <Button variant="outline" className="gap-2 bg-transparent" onClick={() => setActiveTab("assignment")}>
                    <ArrowLeft className="h-4 w-4" /> Anterior: Preguntas
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="gap-2 bg-primary hover:bg-primary/90 text-white rounded-full"
                    style={{ backgroundColor: "#18b0a4" }}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> {isEditMode ? "Actualizando..." : "Guardando..."}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" /> {isEditMode ? "Actualizar Encuesta" : "Crear Encuesta"}
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Modals */}
          {showAssignSurveyorsModal && (
            <AssignSurveyorsModal
              surveyors={allSurveyors}
              assignedSurveyorIds={settings.assignedUsers || []}
              onSave={handleAssignSurveyorsSave}
              onCancel={() => setShowAssignSurveyorsModal(false)}
            />
          )}

          {showEditSettingsModal && (
            <EditSurveySettingsModal
              isOpen={showEditSettingsModal}
              onClose={() => setShowEditSettingsModal(false)}
              currentSettings={settings}
              onSave={(newSettings) => {
                setSettings(newSettings)
                setShowEditSettingsModal(false)
              }}
            />
          )}

          <SectionOrganizer
            isOpen={showSectionOrganizer}
            sections={sections}
            onSectionsChange={(newSections) => {
              const updatedSections = newSections.map((s, index) => ({
                ...s,
                order_num: index,
              }))
              setSections(updatedSections)
              // Marcar todas las secciones como no guardadas
              const newSaveStates: { [key: string]: "saved" | "not-saved" | "error" } = {}
              newSections.forEach((section) => {
                newSaveStates[section.id] = "not-saved"
              })
              setSectionSaveStates((prev) => ({ ...prev, ...newSaveStates }))
              setShowSectionOrganizer(false)
            }}
            onClose={() => setShowSectionOrganizer(false)}
          />
        </div>
      </DashboardLayout>
    </ClientLayout>
  )
}

export default function CreateSurveyForProjectPage() {
  return <CreateSurveyForProjectPageContent />
}
