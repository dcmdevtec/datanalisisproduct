

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
import { SectionSkipLogicConfig } from "@/components/survey/SectionSkipLogicConfig"
const AdvancedRichTextEditor = dynamic(() => import("@/components/ui/advanced-rich-text-editor").then((mod) => mod.AdvancedRichTextEditor), {
  ssr: false,
  loading: () => <div className="h-20 bg-muted animate-pulse rounded" />,
})
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
const SurveyLogoUpload = dynamic(async () => {
  const mod = await import("@/components/ui/survey-logo-upload")
  return mod.SurveyLogoUpload
}, {
  ssr: false,
  loading: () => <div className="h-32 bg-muted animate-pulse rounded" />,
})




const MapWithDrawing = dynamic(() => import("@/components/map-with-drawing").then(mod => mod.default), {
  ssr: false,
  loading: () => <div className="h-48 bg-muted animate-pulse rounded flex items-center justify-center"><Map className="h-8 w-8 text-muted-foreground" /></div>,
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
  publicLink?: string; // Add this new field
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
  currentSurveyId,
}: SortableSectionProps & {
  sections: SurveySection[]
  setSections: React.Dispatch<React.SetStateAction<SurveySection[]>>
  currentSurveyId: string | null
}) {
  // Estado local para el editor enriquecido del título de la sección (usa title_html como fuente principal)
  const [localSectionTitle, setLocalSectionTitle] = useState(section.title_html || "");

  // Sincronizar el estado local SOLO con title_html
  useEffect(() => {
    setLocalSectionTitle(section.title_html || "");
  }, [section.title_html]);

  // Guardar el valor HTML en el estado global al cambiar
  const handleSectionTitleChange = (html: string) => {
    setLocalSectionTitle(html);
    // Extraer texto plano del HTML
    const plain = stripHtml(html);
    onUpdateSection(section.id, "title", plain);
    onUpdateSection(section.id, "title_html", html);
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

        <div className="mt-4">
          <label className="block text-sm font-medium text-muted-foreground mb-1">Descripción de la sección</label>
          <div className="rounded-lg border border-muted bg-white/70 p-2 shadow-sm transition focus-within:ring-2 focus-within:ring-primary/30">
            <AdvancedRichTextEditor
              value={section.description || ""}
              onChange={(html) => onUpdateSection(section.id, "description", html)}
              placeholder="Descripción opcional de la sección..."
              className="min-h-[80px] border-none bg-transparent px-0 focus-visible:ring-0"
            />
          </div>
        </div>
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
              disabled={
                !section.id ||
                section.id === "temp-id" ||
                !section.id.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)
              }
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
                        question={question as Question}
                        sectionId={section.id}
                        surveyId={currentSurveyId || ""}
                        onRemoveQuestion={onRemoveQuestion}
                        onUpdateQuestion={onUpdateQuestion as any}
                        onDuplicateQuestion={onDuplicateQuestion}
                        allSections={sections as SurveySection[]}
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
                      disabled={
                        !section.id ||
                        section.id === "temp-id" ||
                        !section.id.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)
                      }
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
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => onAddQuestion(section.id)}
                      disabled={
                        !section.id ||
                        section.id === "temp-id" ||
                        !section.id.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)
                      }
                    >
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
// --- AUTO SAVE DE PREGUNTAS ---
/**
 * Guarda automáticamente una pregunta en Supabase (upsert) si la sección tiene un ID real.
 * @param {string} sectionId - ID real de la sección
 * @param {object} question - Objeto pregunta (con id, type, text, etc.)
 * @param {string} surveyId - ID de la encuesta
 * @returns {Promise<'saved'|'error'>}
 */
async function autoSaveQuestion(sectionId: string, question: Question, surveyId: string) {
  // Validar que la sección tenga un ID real (UUID v4)
  if (!sectionId || sectionId === 'temp-id' || !sectionId.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)) {
    console.warn('autoSaveQuestion: sección sin ID real, no se guarda');
    return 'error';
  }
  if (!surveyId) {
    console.warn('autoSaveQuestion: encuesta sin ID, no se guarda');
    return 'error';
  }
  // Preparar datos para upsert
  const questionData = {
    id: question.id,
    survey_id: surveyId,
    section_id: sectionId,
    type: question.type,
    text: question.text.trim(),
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
  };
  try {
    // Upsert (insert/update) en Supabase
  const { error } = await (supabase as any).from('questions').upsert([questionData], { onConflict: 'id' });
    if (error) {
      console.error('autoSaveQuestion error:', error);
      return 'error';
    }
    console.log('autoSaveQuestion: pregunta guardada', questionData);
    return 'saved';
  } catch (err) {
    console.error('autoSaveQuestion error:', err);
    return 'error';
  }
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

// SectionSkipLogicConfig component moved to @/components/survey/SectionSkipLogicConfig

export function CreateSurveyForProjectPageContent() {
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
  // State to show generated preview URL as a visible fallback
  const [generatedPreviewUrl, setGeneratedPreviewUrl] = useState<string | null>(null)
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
          start_date: startDate || null,
          deadline: deadline || null,
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
        title_html: section.title_html || "",
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
        // Upsert (insert/update) cada pregunta individualmente para compatibilidad con auto-save
        for (const [index, q] of section.questions.entries()) {
          const questionData = {
            id: q.id,
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
          };
          const { error: upsertError } = await supabase.from("questions").upsert([questionData], { onConflict: "id" });
          if (upsertError) throw upsertError;
        }
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

  const addQuestionToSection = async (sectionId: string): Promise<void> => {
    const newQuestion: Question = {
      id: generateUUID(),
      type: "text",
      text: "",
      options: [],
      required: false,
      image: null,
      matrixRows: ["Fila 1"],
      matrixCols: ["Columna 1"],
      ratingScale: 5,
      config: {
        allowOther: false,
        randomizeOptions: false,
        ratingEmojis: true,
        scaleMin: 1,
        scaleMax: 5,
        likertScale: null,
        displayLogic: { enabled: false, conditions: [] },
        skipLogic: { enabled: false, rules: [] },
        validation: { required: false },
      },
    };

    // Actualiza el estado local inmediatamente para mostrar la pregunta
    setSections((prevSections) =>
      prevSections.map((s) =>
        s.id === sectionId ? { ...s, questions: [...s.questions, newQuestion] } : s
      )
    );

    // Si la sección tiene un ID real y la encuesta también, guarda la pregunta en Supabase y sincroniza el ID
    if (
      sectionId &&
      sectionId !== "temp-id" &&
      sectionId.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i) &&
      currentSurveyId
    ) {
      try {
        const questionData = {
          id: newQuestion.id,
          survey_id: currentSurveyId,
          section_id: sectionId,
          type: newQuestion.type,
          text: newQuestion.text,
          options: newQuestion.options,
          required: newQuestion.required,
          order_num: 0, // Puedes ajustar el orden si es necesario
          settings: { ...newQuestion.config },
          matrix_rows: newQuestion.matrixRows,
          matrix_cols: newQuestion.matrixCols,
          rating_scale: newQuestion.ratingScale,
          file_url: newQuestion.image,
          skip_logic: newQuestion.config?.skipLogic || null,
          display_logic: newQuestion.config?.displayLogic || null,
          validation_rules: newQuestion.config?.validation || null,
        };
        const { data, error } = await supabase.from("questions").upsert([questionData], { onConflict: "id" }).select().single();
        if (!error && data && data.id && data.id !== newQuestion.id) {
          // Si el ID cambia (por triggers o por la BD), actualiza el estado local
          setSections((prevSections) =>
            prevSections.map((s) =>
              s.id === sectionId
                ? {
                    ...s,
                    questions: s.questions.map((q) =>
                      q.id === newQuestion.id ? { ...q, id: data.id } : q
                    ),
                  }
                : s
            )
          );
        }
      } catch (err) {
        console.error("Error al guardar la nueva pregunta:", err);
      }
    }
  }

  const removeQuestionFromSection = async (sectionId: string, questionId: string): Promise<void> => {
    // Verifica si el ID es un UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(questionId)) {
      try {
        const { error } = await supabase.from("questions").delete().eq("id", questionId);
        if (error) {
          console.error("Error al eliminar la pregunta de Supabase:", error);
        }
      } catch (err) {
        console.error("Error inesperado al eliminar la pregunta:", err);
      }
    }
    setSections((prevSections) =>
      prevSections.map((s) =>
        s.id === sectionId ? { ...s, questions: s.questions.filter((q) => q.id !== questionId) } : s,
      ),
    );
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

    ;(async () => {
      try {
        // Ensure we have a surveyId to build a shareable link
        let surveyIdToUse = currentSurveyId

        if (!surveyIdToUse) {
          // Create a minimal draft survey so the preview link can include an ID
          if (!surveyTitle || !surveyTitle.trim()) {
            toast({ title: 'Título requerido', description: 'Por favor ingresa un título antes de crear el link de preview', variant: 'destructive' })
            return
          }

          const surveyDataForCreate = {
            title: surveyTitle,
            description: surveyDescription,
            project_id: projectId,
            created_by: user?.id || null,
            status: 'draft',
            settings: settings || {},
          }

          const { data: newSurvey, error: newSurveyError } = await supabase
            .from('surveys')
            .insert([surveyDataForCreate])
            .select()
            .single()

          if (newSurveyError) {
            console.error('Error creando draft para preview:', newSurveyError)
            toast({ title: 'Error', description: 'No se pudo crear la encuesta para preview', variant: 'destructive' })
            return
          }

          surveyIdToUse = newSurvey.id
          setCurrentSurveyId(surveyIdToUse)
          setIsEditMode(true)
          toast({ title: 'Borrador creado', description: 'Se creó un borrador para generar el link de preview' })
        }

        // Build full URL and copy to clipboard
        const origin = typeof window !== 'undefined' ? window.location.origin : ''
        const previewUrl = `${origin}/preview/survey/${surveyIdToUse}`
        try {
          await navigator.clipboard.writeText(previewUrl)
          toast({ title: 'Link copiado', description: 'El link de preview fue copiado al porta-papeles' })
          // Also set visible link for users to confirm
          setGeneratedPreviewUrl(previewUrl)
        } catch (err) {
          // Fallback: not allowed to write clipboard — show visible link so user can copy manually
          console.warn('No se pudo copiar al portapapeles', err)
          toast({ title: 'Link listo', description: 'No se pudo copiar automáticamente; usa el link mostrado debajo', variant: 'default' })
          setGeneratedPreviewUrl(previewUrl)
        }

        // Open preview in a new tab/window regardless
        window.open(previewUrl, '_blank')
      } catch (err) {
        console.error('Error preparando preview:', err)
        toast({ title: 'Error', description: 'Error preparando el preview', variant: 'destructive' })
      }
    })()
  }

 const handleSave = async () => {
  if (!surveyTitle.trim()) {
    toast({
      title: "Error",
      description: "El título de la encuesta es obligatorio",
      variant: "destructive",
    });
    setActiveTab("details");
    return;
  }

  setIsSaving(true);
  setError(null);

  try {
    // Validar usuario
    if (!user?.id) throw new Error("Usuario no autenticado");

    // Derivar encuestadores asignados
    const allAssignedSurveyors = Array.from(new Set(Object.values(assignedZoneSurveyors).flat())).filter(Boolean) as string[];

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
    };

    let surveyResult;
    if (isEditMode && currentSurveyId) {
      const { data, error: surveyError } = await supabase
        .from("surveys")
        .update(surveyData)
        .eq("id", currentSurveyId)
        .select()
        .single();
      if (surveyError) throw surveyError;
      surveyResult = data;
    } else {
      const { data, error: surveyError } = await supabase
        .from("surveys")
        .insert([surveyData])
        .select()
        .single();
      if (surveyError) throw surveyError;
      surveyResult = data;
    }

    // Guardar asignaciones de encuestador-zona
    const surveyId = surveyResult.id;
    // 1. Eliminar asignaciones existentes
    await supabase
      .from("survey_surveyor_zones")
      .delete()
      .eq("survey_id", surveyId);

    // 2. Insertar nuevas asignaciones
    const surveyorZoneAssignmentsToInsert: {
      survey_id: string;
      surveyor_id: string;
      zone_id: string;
    }[] = [];

    for (const zoneId of settings.assignedZones || []) {
      const surveyorsForZone = assignedZoneSurveyors[zoneId] || [];
      for (const surveyorId of surveyorsForZone) {
        if (surveyorId && zoneId) {
          surveyorZoneAssignmentsToInsert.push({
            survey_id: surveyId,
            surveyor_id: surveyorId,
            zone_id: zoneId,
          });
        }
      }
    }

    if (surveyorZoneAssignmentsToInsert.length > 0) {
      const { error: insertAssignmentsError } = await supabase
        .from("survey_surveyor_zones")
        .insert(surveyorZoneAssignmentsToInsert);
      if (insertAssignmentsError) {
        throw new Error(`Error al asignar encuestadores a zonas: ${insertAssignmentsError.message}`);
      }
    }

    toast({
      title: isEditMode ? "Encuesta actualizada exitosamente" : "Encuesta guardada exitosamente",
      description: "La información general y las asignaciones han sido guardadas.",
    });

    router.push(`/surveys?projectId=${projectId}`);
  } catch (err: any) {
    let errorMessage = "Error al guardar la encuesta";
    if (err && typeof err === "object") {
      if (err.message) errorMessage = err.message;
      else if (err.error && err.error.message) errorMessage = err.error.message;
      else if (err.error && typeof err.error === "string") errorMessage = err.error;
      else if (err.details) errorMessage = err.details;
      else if (err.hint) errorMessage = `Error: ${err.hint}`;
      else if (err.code) errorMessage = `Error ${err.code}: ${err.message || "Error de base de datos"}`;
      else errorMessage = `Error desconocido: ${JSON.stringify(err, null, 2)}`;
    } else if (typeof err === "string") {
      errorMessage = err;
    }
    setError(errorMessage);
    toast({
      title: "Error al guardar",
      description: errorMessage,
      variant: "destructive",
    });
  } finally {
    setIsSaving(false);
  }
};

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
         title_html,
         description,
         order_num,
         skip_logic,
         questions (
           id,
           type,
           text,
           text_html,
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
          title_html: s.title_html || "",
          description: s.description || "",
          order_num: s.order_num,
          skipLogic: s.skip_logic ? s.skip_logic : undefined,
          questions:
            s.questions
              ?.sort((a, b) => a.order_num - b.order_num)
              .map((q) => {
                // Construir la configuración completa de la pregunta
                const questionConfig = {
                  ...q.settings,
                  likertScale: q.settings?.likertScale || null,
                  matrixRows: q.matrix_rows || [],
                  matrixCols: q.matrix_cols || [],
                  ratingScale: q.rating_scale || q.rating || 5,
                  displayLogic: q.display_logic || { enabled: false, conditions: [] },
                  skipLogic: q.skip_logic || { enabled: false, rules: [] },
                  validation: q.validation_rules || { required: q.required || false },
                  questionConfig: q.question_config || {},
                  matrix: q.matrix || null,
                  commentBox: q.comment_box || false,
                  style: q.style || {},
                  parentId: q.parent_id || null,
                  allowOther: q.settings?.allowOther || false,
                  randomizeOptions: q.settings?.randomizeOptions || false,
                  ratingEmojis: q.settings?.ratingEmojis !== undefined ? q.settings.ratingEmojis : true,
                  scaleMin: q.settings?.scaleMin || 1,
                  scaleMax: q.settings?.scaleMax || 5,
                }
                return {
                  id: q.id,
                  type: q.type || "text",
                  text: q.text ? q.text.trim() : "",
                  text_html: q.text_html || "",
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
        // Si es una encuesta nueva, crear la sección y pregunta de contacto por defecto
        const contactQuestion: Question = {
          id: generateUUID(),
          type: "contact_info",
          text: "Información de Contacto",
          options: [],
          required: true,
          config: {},
        };
        const defaultSection: SurveySection = {
          id: generateUUID(),
          title: "Información del Encuestado",
          description: "Por favor, proporciona tus datos de contacto.",
          order_num: 0,
          questions: [contactQuestion],
        };
        setSections([defaultSection]);
        setInitialLoading(false);
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
              onSectionsChange={async (newSections) => {
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

                // Persistir movimientos de preguntas (section_id y order_num) en Supabase
                if (currentSurveyId) {
                  // Mapeo de ids antiguos a nuevos
                  let idMapping: Record<string, string> = {};
                  let updatedSections = [...newSections];
                  for (const section of newSections) {
                    for (const [qIndex, question] of section.questions.entries()) {
                      if (question.id && section.id && section.id !== "temp-id") {
                        // Hacer upsert y obtener el id real
                        const { data, error } = await supabase
                          .from("questions")
                          .upsert([
                            {
                              ...question,
                              section_id: section.id,
                              order_num: qIndex,
                              survey_id: currentSurveyId,
                            },
                          ], { onConflict: "id" })
                          .select()
                          .single();
                        if (!error && data && data.id && data.id !== question.id) {
                          idMapping[question.id] = data.id;
                          // Actualizar el id en el estado local
                          updatedSections = updatedSections.map((s) =>
                            s.id === section.id
                              ? {
                                  ...s,
                                  questions: s.questions.map((q) =>
                                    q.id === question.id ? { ...q, id: data.id } : q
                                  ),
                                }
                              : s
                          );
                        }
                      }
                    }
                  }
                  // Si hubo cambios de id, actualizar el estado global
                  if (Object.keys(idMapping).length > 0) {
                    setSections(updatedSections);
                  }
                }
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
                          <SelectItem value="draft">Prueba</SelectItem>
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
                              {/* preview link moved to Configuración modal */}
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
                              currentSurveyId={currentSurveyId}
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
                    
                  </CardContent>
                </Card>
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
              previewUrl={generatedPreviewUrl}
              onCopyPreview={async () => {
                if (!generatedPreviewUrl) return
                try {
                  await navigator.clipboard.writeText(generatedPreviewUrl)
                  toast({ title: 'Link copiado', description: 'El link de preview fue copiado al porta-papeles' })
                } catch (err) {
                  toast({ title: 'Error', description: 'No se pudo copiar el link automáticamente', variant: 'destructive' })
                }
              }}
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
