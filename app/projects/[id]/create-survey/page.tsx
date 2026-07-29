

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase-browser"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { generateUUID, cn } from "@/lib/utils"
import { EditSurveySettingsModal } from "@/components/edit-survey-settings-modal"
import { MultiSelectZones } from "@/components/multi-select-zones"
import { ZoneSurveyorAssignment } from "@/components/zone-surveyor-assignment"
import { GeneralSurveyorAssignment } from "@/components/general-surveyor-assignment"
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
import { useState, useEffect, useCallback, useRef } from "react"
import { stripHtml } from "@/lib/stripHtml"
import { debugLog, debugWarn } from "@/lib/debug-log"
import { QuestionEditor } from "@/components/question-editor"
import { SectionSkipLogicConfig } from "@/components/survey/SectionSkipLogicConfig"
const AdvancedRichTextEditor = dynamic(() => import("@/components/ui/advanced-rich-text-editor").then((mod) => mod.AdvancedRichTextEditor), {
  ssr: false,
  loading: () => <div className="h-20 bg-muted animate-pulse rounded" />,
})

const CompactRichTextEditor = dynamic(() => import("@/components/ui/compact-rich-text-editor").then((mod) => mod.CompactRichTextEditor), {
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
  return mod.default
}, {
  ssr: false,
  loading: () => <div className="h-32 bg-muted animate-pulse rounded" />,
})




const MapWithDrawing = dynamic(() => import("@/components/map-with-drawing").then(mod => mod.default), {
  ssr: false,
  loading: () => <div className="h-48 bg-muted animate-pulse rounded flex items-center justify-center"><Map className="h-8 w-8 text-muted-foreground" /></div>,
})

// Tipos importados desde la fuente de verdad compartida web↔APK
import type {
  Question,
  SurveySection,
  SurveySettings,
  SectionSkipLogic,
} from "@/types-updated"

// ── SectionPickerBar ─────────────────────────────────────────────────────────
// Barra de navegación de secciones que escala a cualquier cantidad (1–100+).
// Diseño: [← prev] [Sección N de M  ▼] [→ next] | [Guardar] [Guardar todas] | [+ Nueva] [👁] [⇅]
// El botón central abre un Popover con lista buscable de todas las secciones.
// ─────────────────────────────────────────────────────────────────────────────
interface SectionPickerBarProps {
  sections: SurveySection[]
  activeSectionIndex: number
  onSelectSection: (index: number) => void
  sectionSaveStates: Record<string, string>
  isSavingSection: boolean
  onSaveCurrent: () => void
  onSaveAll: () => void
  onAddSection: () => void
  onPreview: () => void
  onOrganize: () => void
}

function SectionPickerBar({
  sections,
  activeSectionIndex,
  onSelectSection,
  sectionSaveStates,
  isSavingSection,
  onSaveCurrent,
  onSaveAll,
  onAddSection,
  onPreview,
  onOrganize,
}: SectionPickerBarProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const activeItemRef = useRef<HTMLButtonElement>(null)

  // Scroll al item activo cuando se abre el popover
  useEffect(() => {
    if (open && !search) {
      // pequeño delay para que el DOM esté listo
      const t = setTimeout(() => activeItemRef.current?.scrollIntoView({ block: "nearest" }), 60)
      return () => clearTimeout(t)
    }
  }, [open, search])

  const activeSection = sections[activeSectionIndex]
  const activeLabel = activeSection
    ? stripHtml(activeSection.title_html || activeSection.title) || `Sección ${activeSectionIndex + 1}`
    : "Sin secciones"

  const filtered = search.trim()
    ? sections.filter((s, i) => {
        const label = stripHtml(s.title_html || s.title) || `Sección ${i + 1}`
        return label.toLowerCase().includes(search.toLowerCase()) || String(i + 1).includes(search)
      })
    : sections

  const saveStateDot = (sectionId: string) => {
    const state = sectionSaveStates[sectionId]
    if (!state) return null
    if (state === "saved") return <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
    if (state === "error") return <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
    return <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
  }

  return (
    <div className="sticky top-0 z-50 bg-white/97 backdrop-blur supports-[backdrop-filter]:bg-white/90 rounded-xl border shadow-sm">
      {/* Fila principal */}
      <div className="flex items-center gap-1.5 px-2 py-2">
        {/* Prev */}
        <Button
          variant="ghost" size="sm"
          className="h-8 w-8 p-0 shrink-0"
          onClick={() => onSelectSection(Math.max(0, activeSectionIndex - 1))}
          disabled={activeSectionIndex === 0}
          title="Sección anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Selector central — abre popover */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button className="flex-1 flex items-center gap-2 h-8 px-3 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors text-left min-w-0 group">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-xs font-bold shrink-0">
                {activeSectionIndex + 1}
              </span>
              <span className="flex-1 truncate text-sm font-medium">{activeLabel}</span>
              <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                {activeSectionIndex + 1} / {sections.length}
              </span>
              {saveStateDot(activeSection?.id ?? "")}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-data-[state=open]:rotate-180 transition-transform" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-0" style={{ width: "min(92vw, 480px)" }} align="start" sideOffset={4}>
            {/* Buscador */}
            <div className="flex items-center gap-2 px-3 py-2 border-b">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                placeholder="Buscar sección..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {/* Lista */}
            <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: "18rem" }}>
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin resultados</p>
              ) : (
                <div className="py-1">
                  {filtered.map((section, _) => {
                    const realIndex = sections.indexOf(section)
                    const label = stripHtml(section.title_html || section.title) || `Sección ${realIndex + 1}`
                    const isActive = realIndex === activeSectionIndex
                    const nQ = section.questions?.length ?? 0
                    return (
                      <button
                        key={section.id}
                        ref={isActive ? activeItemRef : undefined}
                        onClick={() => { onSelectSection(realIndex); setOpen(false); setSearch("") }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50",
                          isActive
                            ? "bg-primary/[0.08] border-l-2 border-primary"
                            : "border-l-2 border-transparent"
                        )}
                      >
                        {/* Número */}
                        <span className={cn(
                          "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0",
                          isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                        )}>
                          {realIndex + 1}
                        </span>

                        {/* Título — ocupa todo el espacio, trunca con … */}
                        <span
                          className={cn(
                            "flex-1 text-left text-sm leading-snug overflow-hidden",
                            isActive ? "font-semibold text-primary" : "text-foreground"
                          )}
                          style={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                        >
                          {label}
                        </span>

                        {/* Contador de preguntas + estado */}
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-muted-foreground">{nQ}p</span>
                          {saveStateDot(section.id)}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            {/* Footer del popover */}
            <div className="border-t px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{sections.length} sección{sections.length !== 1 ? "es" : ""}</span>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => { onAddSection(); setOpen(false) }}>
                <Plus className="h-3 w-3" /> Nueva sección
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Next */}
        <Button
          variant="ghost" size="sm"
          className="h-8 w-8 p-0 shrink-0"
          onClick={() => onSelectSection(Math.min(sections.length - 1, activeSectionIndex + 1))}
          disabled={activeSectionIndex === sections.length - 1}
          title="Siguiente sección"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="w-px h-5 bg-border mx-0.5 shrink-0" />

        {/* Guardar actual */}
        <Button
          variant="outline" size="sm"
          className="h-8 px-2 text-xs gap-1 shrink-0"
          onClick={onSaveCurrent}
          disabled={isSavingSection}
          title="Guardar sección actual"
        >
          {isSavingSection ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">Guardar</span>
        </Button>

        {/* Guardar todas */}
        <Button
          variant="ghost" size="sm"
          className="h-8 px-2 text-xs gap-1 shrink-0 text-muted-foreground"
          onClick={onSaveAll}
          disabled={isSavingSection}
          title="Guardar todas las secciones"
        >
          <Save className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Todas</span>
        </Button>

        <div className="w-px h-5 bg-border mx-0.5 shrink-0" />

        {/* Nueva sección */}
        <Button
          variant="outline" size="sm"
          className="h-8 px-2 text-xs gap-1 shrink-0"
          onClick={onAddSection}
          title="Agregar sección"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Nueva</span>
        </Button>

        {/* Vista previa */}
        <Button
          variant="ghost" size="sm"
          className="h-8 w-8 p-0 shrink-0 text-muted-foreground"
          onClick={onPreview}
          title="Vista previa"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>

        {/* Organizar */}
        <Button
          variant="ghost" size="sm"
          className="h-8 w-8 p-0 shrink-0 text-muted-foreground"
          onClick={onOrganize}
          disabled={sections.length <= 1}
          title="Organizar secciones"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Barra de progreso de secciones (dots compactos) */}
      {sections.length > 1 && (
        <div className="flex items-center gap-1 px-3 pb-1.5 overflow-x-auto scrollbar-hide">
          {sections.map((s, i) => (
            <button
              key={s.id}
              onClick={() => onSelectSection(i)}
              title={stripHtml(s.title_html || s.title) || `Sección ${i + 1}`}
              className={cn(
                "shrink-0 h-1 rounded-full transition-all duration-200",
                i === activeSectionIndex
                  ? "bg-primary w-6"
                  : sectionSaveStates[s.id] === "error"
                  ? "bg-red-400 w-2 hover:w-3"
                  : sectionSaveStates[s.id] === "saved"
                  ? "bg-green-400 w-2 hover:w-3"
                  : "bg-muted-foreground/30 w-2 hover:bg-muted-foreground/60 hover:w-3"
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Props del componente SortableSection
interface SortableSectionProps {
  section: SurveySection
  index: number
  onRemoveSection: (sectionId: string) => void
  onUpdateSection: (sectionId: string, field: keyof SurveySection, value: any) => void
  onAddQuestion: (sectionId: string) => void
  onRemoveQuestion: (sectionId: string, questionId: string) => void
  onUpdateQuestion: (sectionId: string, questionId: string, field: keyof Question, value: any) => void
  onDuplicateQuestion: (sectionId: string, questionId: string) => void
  onMoveQuestion?: (questionId: string, fromSectionId: string, toSectionId: string, newIndex?: number) => void
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
  onMoveQuestion,
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
  // Estado para controlar la visibilidad del campo de descripción
  // Solo mostrar por defecto si ya existe descripción (modo edición)
  const [showDescription, setShowDescription] = useState(Boolean(section.description));

  // Sincronizar el estado local SOLO con title_html
  useEffect(() => {
    setLocalSectionTitle(section.title_html || "");
  }, [section.title_html]);

  // Sincronizar showDescription con la existencia de descripción solo al cargar
  useEffect(() => {
    setShowDescription(Boolean(section.description));
  }, [section.id]); // Solo cuando cambia la sección, no cada vez que cambia la descripción

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )

  const [showSkipLogicModal, setShowSkipLogicModal] = useState(false)

  const handleSkipLogicUpdate = (skipLogic: SectionSkipLogic) => {
    updateSectionSkipLogic(section.id, skipLogic, setSections, sections)
    setShowSkipLogicModal(false)
  }

  const handleRemoveSkipLogic = () => {
    removeSectionSkipLogic(section.id, setSections, sections)
  }

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg bg-card mb-4 sm:mb-6 overflow-hidden">
      <div className="bg-muted/30 border-b px-3 sm:px-4 py-2 sm:py-3">
        <div className="flex items-start sm:items-center justify-between gap-2">
          <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0 pt-1 sm:pt-0">
              <Grip className="h-4 w-4 text-muted-foreground cursor-move" {...listeners} {...attributes} />
              <Badge variant="secondary" className="text-xs whitespace-nowrap">
                {index + 1}
              </Badge>
              {section.skipLogic?.enabled && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 hidden sm:inline-flex">
                  Salto
                </Badge>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <CompactRichTextEditor
                value={localSectionTitle}
                onChange={handleSectionTitleChange}
                placeholder="Título de la sección (ej: Datos Personales)"
                minHeight="60px"
                compact={true}
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
                    // Crear copia de la sección con nuevos IDs para sección y preguntas
                    const newSection = {
                      ...section,
                      id: generateUUID(),
                      title: `${section.title} (Copia)`,
                      questions: section.questions.map((q) => ({
                        ...q,
                        id: generateUUID(),
                        required: true,
                      })),
                    } as SurveySection

                    setSections((prev) => [...prev, newSection])
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

        {showDescription ? (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-muted-foreground">Descripción de la sección</label>
              <Button
                variant="ghost" 
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  setShowDescription(false);
                  onUpdateSection(section.id, "description", "");
                }}
                title="Ocultar descripción y borrar contenido"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CompactRichTextEditor
              value={section.description || ""}
              onChange={(html) => onUpdateSection(section.id, "description", html)}
              placeholder="Descripción opcional de la sección..."
              minHeight="60px"
              compact={true}
            />
          </div>
        ) : (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              className="text-muted-foreground hover:text-foreground hover:border-primary/50 border-dashed h-8 px-3"
              onClick={() => setShowDescription(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar descripción opcional
            </Button>
          </div>
        )}
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
             
            </div>
            
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => {
              const { active, over } = event
              if (!active || !over || active.id === over.id) return

              const activeId = String(active.id)
              const overId = String(over.id)

              // Find which section each question belongs to
              const originSectionIndex = sections.findIndex((s) => s.questions.some((q) => q.id === activeId))
              const destSectionIndex = sections.findIndex((s) => s.questions.some((q) => q.id === overId))

              if (originSectionIndex === -1) return

              if (originSectionIndex === destSectionIndex) {
                // Reorder within same section
                const sectionQuestions = sections[originSectionIndex].questions
                const oldIndex = sectionQuestions.findIndex((q) => q.id === activeId)
                const newIndex = sectionQuestions.findIndex((q) => q.id === overId)
                if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                  onUpdateSection(section.id, "questions", arrayMove(sectionQuestions, oldIndex, newIndex))
                }
              } else if (destSectionIndex !== -1) {
                // Move between sections — immutable splice
                const originQuestions = [...sections[originSectionIndex].questions]
                const destQuestions = [...sections[destSectionIndex].questions]

                const qIdx = originQuestions.findIndex((q) => q.id === activeId)
                if (qIdx === -1) return
                const [moved] = originQuestions.splice(qIdx, 1)

                const insertAt = destQuestions.findIndex((q) => q.id === overId)
                destQuestions.splice(insertAt === -1 ? destQuestions.length : insertAt, 0, moved)

                setSections(sections.map((s, i) => {
                  if (i === originSectionIndex) return { ...s, questions: originQuestions }
                  if (i === destSectionIndex) return { ...s, questions: destQuestions }
                  return s
                }))
              }
            }}
          >
            <SortableContext items={section.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
              {section.questions.length > 0 ? (
                <>
                  {section.questions.map((question, qIndex) => (
                    <div key={question.id}>
                      <QuestionEditor
                        question={question as Question}
                        sectionId={section.id}
                        surveyId={currentSurveyId || ""}
                        onRemoveQuestion={onRemoveQuestion}
                        onUpdateQuestion={onUpdateQuestion as any}
                        onDuplicateQuestion={onDuplicateQuestion}
                        onMoveQuestion={onMoveQuestion}
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
    debugWarn('autoSaveQuestion: sección sin ID real, no se guarda');
    return 'error';
  }
  if (!surveyId) {
    debugWarn('autoSaveQuestion: encuesta sin ID, no se guarda');
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
    // Guardar vía API route (bypasa RLS de questions — igual que handleSaveSection)
    const res = await fetch(`/api/surveys/${surveyId}/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: {
          id: sectionId,
          title: 'auto-save',
          order_num: 0,
        },
        questions: [questionData],
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      console.error('autoSaveQuestion error:', json);
      return 'error';
    }
    debugLog('autoSaveQuestion: pregunta guardada', questionData);
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
  debugLog(`🔄 Actualizando referencias de lógica de salto: ${oldId} -> ${newId}`)

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
      debugLog(`✅ Referencia actualizada en sección "${section.title}": ${oldId} -> ${newId}`)
    }

    // Actualizar referencias en preguntas
    section.questions.forEach((question) => {
      if (question.config?.skipLogic?.enabled && question.config.skipLogic.rules) {
        question.config.skipLogic.rules.forEach((rule) => {
          if (rule.targetSectionId === oldId) {
            rule.targetSectionId = newId
            debugLog(
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
  debugLog("🔄 Actualizando referencias de preguntas en lógica de salto con mapeo de IDs...")
  debugLog("📋 Mapeo de IDs disponible:", questionIdMapping)

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
      debugLog(`🔍 Verificando referencia de pregunta en sección "${section.title}": ${oldQuestionId}`)

      if (questionIdMapping[oldQuestionId]) {
        const newQuestionId = questionIdMapping[oldQuestionId]
        section.skipLogic.targetQuestionId = newQuestionId
        debugLog(
          `✅ Referencia de pregunta actualizada en sección "${section.title}": ${oldQuestionId} -> ${newQuestionId}`,
        )
        updatedReferences++
      } else {
        debugLog(`⚠️ No se encontró mapeo para pregunta ID: ${oldQuestionId} en sección "${section.title}"`)
        debugLog(`💡 Esto puede indicar que la pregunta ya tiene un ID válido o que no se procesó correctamente`)
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
            debugLog(
              `🔍 Verificando referencia de pregunta en regla ${ruleIndex + 1} de "${question.text.substring(0, 50)}...": ${oldQuestionId}`,
            )

            if (questionIdMapping[oldQuestionId]) {
              const newQuestionId = questionIdMapping[oldQuestionId]
              rule.targetQuestionId = newQuestionId
              debugLog(
                `✅ Referencia de pregunta actualizada en regla ${ruleIndex + 1}: ${oldQuestionId} -> ${newQuestionId}`,
              )
              updatedReferences++
            } else {
              debugLog(`⚠️ No se encontró mapeo para pregunta ID: ${oldQuestionId} en regla ${ruleIndex + 1}`)
              debugLog(
                `💡 Esto puede indicar que la pregunta ya tiene un ID válido o que no se procesó correctamente`,
              )
              skippedReferences++
            }
          }
        })
      }
    })
  })

  debugLog(
    `📊 Resumen de actualización: ${updatedReferences} referencias actualizadas, ${skippedReferences} referencias omitidas`,
  )

  return updatedSections
}

// Función para validar y corregir referencias de preguntas en la lógica de salto al cargar datos
const validateAndFixSkipLogicReferences = (sections: SurveySection[]): SurveySection[] => {
  debugLog("🔍 Validando referencias de preguntas en lógica de salto...")

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
        debugLog(`⚠️ Referencia de pregunta inválida en sección "${section.title}": ${targetQuestionId}`)

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
            debugLog(
              `✅ Referencia corregida: ${targetQuestionId} -> ${newQuestionId} (${questionInfo.questionText})`,
            )
            fixedReferences++
          } else {
            // Si no se encuentra una pregunta similar, resetear la referencia
            debugLog(`❌ No se pudo encontrar pregunta similar, reseteando referencia`)
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
              debugLog(
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
                  debugLog(
                    `✅ Referencia corregida en regla: ${targetQuestionId} -> ${newQuestionId} (${questionInfo.questionText})`,
                  )
                  fixedReferences++
                } else {
                  // Si no se encuentra, deshabilitar la regla
                  debugLog(`❌ No se pudo encontrar pregunta similar, deshabilitando regla`)
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
    debugLog(`✅ Se corrigieron ${fixedReferences} referencias de preguntas inválidas`)
  } else {
    debugLog("✅ Todas las referencias de preguntas son válidas")
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
  // Ref para el guard de concurrencia: el state React es async y no bloquea
  // correctamente cuando handleSaveSection se llama en un for-loop (onSaveAll).
  const isSavingSectionRef = useRef(false)
  // State to show generated preview URL as a visible fallback
  const [generatedPreviewUrl, setGeneratedPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sections, setSections] = useState<SurveySection[]>([])
  const [sectionSaveStates, setSectionSaveStates] = useState<{ [key: string]: "saved" | "not-saved" | "error" }>({})
  // Autosave con debounce (auditoría 2026-07-29): antes de esto, secciones y
  // preguntas solo se guardaban al presionar "Actualizar/Crear Encuesta" —
  // cerrar la pestaña o perder conexión en el medio perdía todo el trabajo,
  // aunque sectionSaveStates ya sabía perfectamente qué quedaba pendiente
  // ("not-saved"). autoSaveStatus alimenta el indicador junto al botón
  // principal; autoSaveTimerRef es el debounce (ver efecto más abajo, junto
  // a handleSaveSection).
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSaveSection = async (sectionId: string, overrideSurveyId?: string, options?: { silent?: boolean }) => {
    if (!sections.length || !sectionId) return

    // Usar ref (no state) para el guard — el state es async y no bloquea en for-loops
    if (isSavingSectionRef.current) return
    isSavingSectionRef.current = true
    setIsSavingSection(true)
    try {
      // overrideSurveyId permite llamar desde handleSave sin depender del state async
      let workingSurveyId = overrideSurveyId || currentSurveyId

      // Si no hay surveyId, necesitamos crear primero la encuesta
      if (!workingSurveyId) {
        debugLog("🆕 Creando encuesta antes de guardar sección...")

        if (!surveyTitle || !surveyTitle.trim()) {
          throw new Error("El título de la encuesta es obligatorio para guardar secciones")
        }

        const surveyData = {
          title: surveyTitle,
          description: surveyDescription,
          project_id: projectId,
          created_by: user?.id || null,
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

        debugLog("📝 Intentando crear encuesta con datos:", JSON.stringify(surveyData, null, 2))

        const { data: newSurvey, error: surveyError } = await supabase
          .from("surveys")
          .insert([surveyData])
          .select()

        if (surveyError) {
          console.error("❌ Error al crear la encuesta:", JSON.stringify(surveyError, null, 2))
          throw new Error(surveyError.message || surveyError.details || surveyError.hint || JSON.stringify(surveyError) || "Error al crear la encuesta")
        }

        if (!newSurvey || newSurvey.length === 0) {
          throw new Error("No se pudo crear la encuesta - no se retornaron datos")
        }

        workingSurveyId = newSurvey[0].id
        setCurrentSurveyId(workingSurveyId)
        setIsEditMode(true)

        debugLog("✅ Encuesta creada con ID:", workingSurveyId)
      }

      const section = sections.find((s) => s.id === sectionId)
      if (!section) throw new Error("Sección no encontrada")

      // Validar que el ID sea un UUID válido
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!section.id || !uuidRegex.test(section.id)) {
        debugWarn(`⚠️ ID de sección inválido detectado: ${section.id}. Generando uno nuevo.`)
        const newId = generateUUID()
        // Actualizar el ID en el estado local para que coincida con el que vamos a guardar
        setSections(prev => prev.map(s => s.id === sectionId ? { ...s, id: newId } : s))
        section.id = newId
      }

      // ── Preparar preguntas para el payload ─────────────────────────────────
      const uuidRegex2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      const questionsPayload = section.questions.map((q, index) => {
        // Asegurar UUID válido
        const qId = (!q.id || !uuidRegex2.test(q.id)) ? generateUUID() : q.id
        return {
          id: qId,
          type: q.type,
          text: (q.text || '').trim(),
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
        }
      })

      // ── Llamar API route server-side (usa service_role, bypasa RLS) ─────────
      // El cliente browser recibe 403 en survey_sections/questions porque RLS
      // solo tiene política SELECT. La API route usa createAdminClient().
      debugLog("💾 Enviando sección a /api/surveys/.../sections:", section.id)

      const apiRes = await fetch(`/api/surveys/${workingSurveyId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: {
            id: section.id,
            title: (section.title || 'Sin título').trim(),
            title_html: section.title_html || '',
            description: section.description || '',
            order_num: sections.findIndex((s) => s.id === sectionId),
            skip_logic: section.skipLogic || null,
          },
          questions: questionsPayload,
        }),
      })

      const apiJson = await apiRes.json().catch(() => ({}))

      if (!apiRes.ok || apiJson.error) {
        const errMsg = apiJson.error || `HTTP ${apiRes.status}`
        console.error("❌ Error API sections:", errMsg)
        throw new Error(errMsg)
      }

      const savedSectionData = apiJson.section

      // Actualizar estado de guardado
      setSectionSaveStates((prev) => ({
        ...prev,
        [savedSectionData.id]: "saved",
      }))

      // Autosave (auditoría 2026-07-29): no mostrar el toast de éxito en
      // cada ciclo automático — sería ruido constante mientras la persona
      // sigue editando. El indicador "Guardado automáticamente" junto al
      // botón principal ya cubre ese feedback. El guardado manual (botón
      // por sección / "Guardar todas") sí sigue mostrando el toast.
      if (!options?.silent) {
        toast({
          title: "Sección guardada",
          description: "Los cambios han sido guardados exitosamente",
        })
      }
      return true
    } catch (error: any) {
      console.error("Error detallado al guardar la sección:", error)
      setSectionSaveStates((prev) => ({
        ...prev,
        [sectionId]: "error",
      }))

      const errorMessage = error.message || (typeof error === 'object' ? JSON.stringify(error) : String(error))

      // A diferencia del éxito, sí avisamos de errores incluso en modo
      // silencioso (autoguardado) — que algo no se guardó es información
      // que la persona necesita, no ruido.
      toast({
        title: options?.silent ? "No se pudo autoguardar" : "Error al guardar",
        description: errorMessage || "Ocurrió un error al guardar la sección",
        variant: "destructive",
      })
      return false
    } finally {
      isSavingSectionRef.current = false
      setIsSavingSection(false)
    }
  }

  // Efecto de autosave: se re-arma en cada cambio de `sections` (nueva
  // referencia en cada edición) o `sectionSaveStates`, y espera 2.5s de
  // inactividad antes de disparar. Si el usuario sigue escribiendo, el
  // cleanup cancela el timer anterior — así no se autoguarda a cada tecla,
  // solo cuando hay una pausa real.
  useEffect(() => {
    const hasPending = sections.some((s) => sectionSaveStates[s.id] !== "saved")
    if (!hasPending) return
    // Sin título todavía no se puede crear/actualizar nada en el backend
    // (handleSaveSection lo exige para crear la encuesta la primera vez).
    // Se espera en silencio a que la persona escriba un título en vez de
    // mostrarle un error de autoguardado por algo que aún no ha llenado.
    if (!surveyTitle.trim()) return

    const timer = setTimeout(async () => {
      // No pisar un guardado manual (botón "Guardar sección" / "Guardar
      // todas" / "Actualizar Encuesta") que ya esté en curso.
      if (isSavingSectionRef.current || isSaving) return
      const pending = sections.filter((s) => sectionSaveStates[s.id] !== "saved")
      if (pending.length === 0) return

      setAutoSaveStatus("saving")
      let hadError = false
      for (const section of pending) {
        isSavingSectionRef.current = false
        const ok = await handleSaveSection(section.id, currentSurveyId || undefined, { silent: true })
        if (!ok) hadError = true
      }
      setAutoSaveStatus(hadError ? "error" : "saved")
    }, 2500)

    autoSaveTimerRef.current = timer
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, sectionSaveStates, surveyTitle, isSaving, currentSurveyId])

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
  const [showEditSettingsModal, setShowEditSettingsModal] = useState(false)
  const [displayedZoneGeometry, setDisplayedZoneGeometry] = useState<GeoJSON | null>(null)

  // New state to manage surveyor assignments per zone
  const [assignedZoneSurveyors, setAssignedZoneSurveyors] = useState<{ [zoneId: string]: string[] }>({})

  // State to manage general surveyor assignments (without specific zones)
  const [assignedGeneralSurveyors, setAssignedGeneralSurveyors] = useState<string[]>([])

  const [showSectionOrganizer, setShowSectionOrganizer] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )

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
      required: true,
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
        validation: { required: true },
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
        // Usar API route para bypasear RLS de questions
        const newQRes = await fetch(`/api/surveys/${currentSurveyId}/sections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section: { id: sectionId, title: 'auto-save', order_num: 0 },
            questions: [questionData],
          }),
        });
        const newQJson = await newQRes.json().catch(() => ({}));
        const data = newQJson.questions || [];
        const error = newQJson.error || (!newQRes.ok ? `HTTP ${newQRes.status}` : null);
        if (error) {
          console.error("❌ Error al guardar la nueva pregunta:", error);
        } else if (data && data.length > 0 && data[0].id && data[0].id !== newQuestion.id) {
          // Si el ID cambia (por triggers o por la BD), actualiza el estado local
          setSections((prevSections) =>
            prevSections.map((s) =>
              s.id === sectionId
                ? {
                  ...s,
                  questions: s.questions.map((q) =>
                    q.id === newQuestion.id ? { ...q, id: data[0].id } : q
                  ),
                }
                : s
            )
          );
        }
      } catch (err) {
        console.error("Error inesperado al guardar la nueva pregunta:", err);
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
    // F0.5: Limpia referencias a la pregunta borrada en skipLogic.rules / displayLogic.conditions
    // de OTRAS preguntas y en la skipLogic de secciones. Sin esto quedan reglas huérfanas
    // que se persisten en el próximo save y pueden romper el renderer.
    setSections((prevSections) =>
      prevSections
        // 1. Quitar la pregunta de la sección indicada.
        .map((s) =>
          s.id === sectionId ? { ...s, questions: s.questions.filter((q) => q.id !== questionId) } : s,
        )
        // 2. Limpiar referencias a questionId en cualquier sección y cualquier pregunta restante.
        .map((s) => {
          // 2a. Limpiar skipLogic a nivel sección si apuntaba a la pregunta borrada.
          let nextSection: SurveySection = s
          if (s.skipLogic?.targetQuestionId === questionId) {
            nextSection = {
              ...s,
              skipLogic: {
                ...s.skipLogic,
                enabled: false,
                targetQuestionId: undefined,
                targetQuestionText: undefined,
              },
            }
          }

          // 2b. Limpiar skipLogic.rules y displayLogic.conditions en cada pregunta restante.
          const nextQuestions = nextSection.questions.map((q) => {
            const currentConfig = q.config
            if (!currentConfig) return q

            let nextConfig = currentConfig
            let changed = false

            // Filtrar reglas de skipLogic que apuntan a la pregunta borrada.
            if (currentConfig.skipLogic?.rules?.length) {
              const filteredRules = currentConfig.skipLogic.rules.filter(
                (rule) => rule.targetQuestionId !== questionId,
              )
              if (filteredRules.length !== currentConfig.skipLogic.rules.length) {
                nextConfig = {
                  ...nextConfig,
                  skipLogic: {
                    ...currentConfig.skipLogic,
                    rules: filteredRules,
                    enabled: filteredRules.length > 0 ? currentConfig.skipLogic.enabled : false,
                  },
                }
                changed = true
              }
            }

            // Filtrar conditions de displayLogic que referencian la pregunta borrada.
            if (currentConfig.displayLogic?.conditions?.length) {
              const filteredConds = currentConfig.displayLogic.conditions.filter(
                (cond) => cond.questionId !== questionId,
              )
              if (filteredConds.length !== currentConfig.displayLogic.conditions.length) {
                nextConfig = {
                  ...nextConfig,
                  displayLogic: {
                    ...currentConfig.displayLogic,
                    conditions: filteredConds,
                    enabled: filteredConds.length > 0 ? currentConfig.displayLogic.enabled : false,
                  },
                }
                changed = true
              }
            }

            return changed ? { ...q, config: nextConfig } : q
          })

          return nextQuestions === nextSection.questions
            ? nextSection
            : { ...nextSection, questions: nextQuestions }
        }),
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
      // BUGFIX: marcar la sección como no guardada cuando se edita una pregunta.
      // Sin esto, el usuario podía editar texto/opciones sin que se marcara como dirty
      // y el botón "Guardar" final omitía guardar sus cambios.
      setSectionSaveStates((prev) => ({
        ...prev,
        [sectionId]: "not-saved",
      }))
    },
    [],
  )

  const handleMoveQuestion = useCallback(
    (questionId: string, fromSectionId: string, toSectionId: string, targetIndex?: number): void => {
      setSections((prevSections) => {
        const fromSection = prevSections.find(s => s.id === fromSectionId)
        const questionToMove = fromSection?.questions.find(q => q.id === questionId)
        if (!questionToMove) return prevSections
        return prevSections.map(section => {
          if (section.id === fromSectionId) {
            return { ...section, questions: section.questions.filter(q => q.id !== questionId) }
          } else if (section.id === toSectionId) {
            const newQuestions = [...section.questions]
            const insertIndex = targetIndex !== undefined ? targetIndex : newQuestions.length
            newQuestions.splice(insertIndex, 0, questionToMove)
            return { ...section, questions: newQuestions }
          }
          return section
        })
      })
      // BUGFIX: marcar ambas secciones como no guardadas al mover una pregunta
      setSectionSaveStates((prev) => ({
        ...prev,
        [fromSectionId]: "not-saved",
        [toSectionId]: "not-saved",
      }))
    },
    [],
  )

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

  // Handler for general surveyor assignment (no specific zone)
  const handleGeneralSurveyorAssignmentChange = useCallback((newAssignedSurveyorIds: string[]) => {
    setAssignedGeneralSurveyors(newAssignedSurveyorIds)
    // Also update the settings for backwards compatibility
    setSettings((prev) => ({
      ...prev,
      assignedUsers: newAssignedSurveyorIds,
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

    debugLog("🔍 Datos de preview con lógica de salto:", previewData)
    localStorage.setItem("surveyPreviewData", JSON.stringify(previewData))

      ; (async () => {
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

            if (newSurveyError) {
              console.error('Error creando draft para preview:', newSurveyError)
              toast({ title: 'Error', description: 'No se pudo crear la encuesta para preview', variant: 'destructive' })
              return
            }

            if (!newSurvey || newSurvey.length === 0) {
              toast({ title: 'Error', description: 'No se pudo crear la encuesta para preview', variant: 'destructive' })
              return
            }

            surveyIdToUse = newSurvey[0].id
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
            debugWarn('No se pudo copiar al portapapeles', err)
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
          .select();
        if (surveyError) throw surveyError;
        if (!data || data.length === 0) {
          throw new Error("No se encontró la encuesta para actualizar");
        }
        surveyResult = data[0];
      } else {
        const { data, error: surveyError } = await supabase
          .from("surveys")
          .insert([surveyData])
          .select();
        if (surveyError) throw surveyError;
        if (!data || data.length === 0) {
          throw new Error("No se pudo crear la encuesta");
        }
        surveyResult = data[0];
      }

      const surveyId = surveyResult.id;

      // ── BUGFIX CRÍTICO: guardar todas las secciones/preguntas pendientes ──────
      // handleSave solo guardaba metadata; las secciones con "not-saved" se perdían.
      // Pasamos surveyId directamente para no depender del state React (que es async).
      const pendingSections = sections.filter(s => sectionSaveStates[s.id] !== "saved")
      if (pendingSections.length > 0) {
        debugLog(`💾 handleSave: guardando ${pendingSections.length} sección(es) pendientes...`)
        for (const section of pendingSections) {
          // Liberar el ref antes de cada llamada (handleSaveSection lo vuelve a tomar)
          isSavingSectionRef.current = false
          await handleSaveSection(section.id, surveyId)
        }
      }

      // Guardar asignaciones de encuestador-zona
      // 1. Eliminar asignaciones existentes
      await supabase
        .from("survey_surveyor_zones")
        .delete()
        .eq("survey_id", surveyId);

      // 2. Insertar nuevas asignaciones
      const surveyorZoneAssignmentsToInsert: {
        survey_id: string;
        surveyor_id: string;
        zone_id?: string | null;
        general_status?: boolean | null;
      }[] = [];

      // Insertar asignaciones por zona específica
      for (const zoneId of settings.assignedZones || []) {
        const surveyorsForZone = assignedZoneSurveyors[zoneId] || [];
        for (const surveyorId of surveyorsForZone) {
          if (surveyorId && zoneId) {
            surveyorZoneAssignmentsToInsert.push({
              survey_id: surveyId,
              surveyor_id: surveyorId,
              zone_id: zoneId,
              general_status: null,
            });
          }
        }
      }

      // Insertar asignaciones generales (sin zona específica)
      for (const surveyorId of assignedGeneralSurveyors) {
        if (surveyorId) {
          surveyorZoneAssignmentsToInsert.push({
            survey_id: surveyId,
            surveyor_id: surveyorId,
            zone_id: null,
            general_status: true,
          });
        }
      }

      if (surveyorZoneAssignmentsToInsert.length > 0) {
        const { error: insertAssignmentsError } = await supabase
          .from("survey_surveyor_zones")
          .insert(surveyorZoneAssignmentsToInsert);
        if (insertAssignmentsError) {
          throw new Error(`Error al asignar encuestadores: ${insertAssignmentsError.message}`);
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
        .maybeSingle()

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

      debugLog("📊 Datos de la encuesta cargados:", {
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
        .select("surveyor_id, zone_id, general_status")
        .eq("survey_id", currentSurveyId)

      if (surveyorZoneError) throw surveyorZoneError

      debugLog("🔍 Datos de asignación encuestador-zona:", surveyorZoneData)

      const newAssignedZoneSurveyors: { [zoneId: string]: string[] } = {}
      const newAssignedGeneralSurveyors: string[] = []

      surveyorZoneData.forEach((assignment) => {
        if (assignment.general_status === true && assignment.zone_id === null) {
          // Asignación general
          newAssignedGeneralSurveyors.push(assignment.surveyor_id)
        } else if (assignment.zone_id) {
          // Asignación específica por zona
          if (!newAssignedZoneSurveyors[assignment.zone_id]) {
            newAssignedZoneSurveyors[assignment.zone_id] = []
          }
          newAssignedZoneSurveyors[assignment.zone_id].push(assignment.surveyor_id)
        }
      })

      debugLog("👥 Encuestadores asignados por zona:", newAssignedZoneSurveyors)
      debugLog("👥 Encuestadores generales:", newAssignedGeneralSurveyors)
      setAssignedZoneSurveyors(newAssignedZoneSurveyors)
      setAssignedGeneralSurveyors(newAssignedGeneralSurveyors)

      // Update settings to maintain backwards compatibility
      setSettings((prevSettings) => ({
        ...prevSettings,
        assignedUsers: newAssignedGeneralSurveyors,
      }))

      // Configurar zonas después de cargar los datos
      if (parsedAssignedZones.length > 0 && allZones.length > 0) {
        const firstAssignedZone = allZones.find((z) => z.id === parsedAssignedZones[0])
        setDisplayedZoneGeometry(firstAssignedZone?.geometry || null)
        setSelectedZoneForPreview(parsedAssignedZones[0])
        debugLog("🗺️ Zona seleccionada para preview:", parsedAssignedZones[0])
        debugLog("🗺️ Geometría de la zona:", firstAssignedZone?.geometry)
      } else {
        setDisplayedZoneGeometry(null)
        setSelectedZoneForPreview(null)
        debugLog("ℹ️ No hay zonas asignadas o no se han cargado las zonas")
      }

      // Fetch sections and their questions
      debugLog("🔍 Buscando secciones para survey_id:", currentSurveyId)

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

      debugLog("📋 Datos de secciones cargados:", sectionsData)
      debugLog("📋 Número de secciones:", sectionsData?.length || 0)

      // Verificar si hay secciones pero sin preguntas
      if (sectionsData && sectionsData.length > 0) {
        sectionsData.forEach((section, index) => {
          debugLog(`📋 Sección ${index + 1}: "${section.title}"`)
          debugLog(`📋 ID de sección: ${section.id}`)
          debugLog(`📋 Preguntas en sección: ${section.questions?.length || 0}`)
          if (section.questions && section.questions.length > 0) {
            section.questions.forEach((q, qIndex) => {
              debugLog(`  ❓ Pregunta ${qIndex + 1}: "${q.text}" (tipo: ${q.type})`)
            })
          } else {
            debugLog(`  ⚠️ Esta sección no tiene preguntas`)
          }
        })
      } else {
        debugLog("⚠️ No se encontraron secciones para este survey")
      }

      const formattedSections: SurveySection[] = sectionsData.map((s) => {
        debugLog(`📋 Procesando sección: "${s.title}" con ${s.questions?.length || 0} preguntas`)
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

      debugLog("📋 Secciones formateadas:", formattedSections)

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

  // fetchProject y fetchSurveyorsAndZones consolidados en los useEffects de abajo (F0.3)

  useEffect(() => {
    if (!authLoading && user && projectId) {
      if (currentSurveyId) {
        fetchSurveyForEdit()
      } else {
        // Si es una encuesta nueva, crear una sección vacía por defecto
        const defaultSection: SurveySection = {
          id: generateUUID(),
          title: "Sección 1",
          description: "",
          order_num: 0,
          questions: [],
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
      debugLog(`🗑️ Iniciando eliminación de sección "${sectionId}"...`)

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
        debugLog("🔄 PASO 1: Limpiando referencias en la lógica de salto...")

        // Limpiar referencias en secciones existentes (usando el estado local)
        for (const section of sections) {
          if (
            section.id !== sectionId &&
            section.skipLogic?.enabled &&
            section.skipLogic.targetSectionId === sectionId
          ) {
            debugLog(`⚠️ Limpiando referencia en sección "${section.title}"`)

            // Validar que el ID de la sección sea un UUID válido antes de actualizar
            if (uuidRegex.test(section.id) && currentSurveyId) {
              // Limpiar skip_logic vía API route (bypasa RLS)
              fetch(`/api/surveys/${currentSurveyId}/sections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  section: {
                    id: section.id,
                    title: section.title || 'Sin título',
                    order_num: section.order_num ?? 0,
                    skip_logic: { enabled: false, action: "next_section" },
                  },
                  questions: [],
                }),
              }).catch(e => console.error("❌ Error al limpiar lógica de sección:", e))
            } else {
              debugWarn("⚠️ Sección con ID inválido encontrada:", section.id)
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
                  debugLog(`⚠️ Limpiando lógica de pregunta "${question.text.substring(0, 50)}..."`)

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
                    debugWarn("⚠️ Pregunta con ID inválido encontrada:", question.id)
                  }
                }
              }
            }
          }
        }

        debugLog("✅ Referencias limpiadas exitosamente")

        // PASO 2: Eliminar preguntas de la sección
        debugLog("🗑️ PASO 2: Eliminando preguntas de la sección...")

        // PASO 2 y 3: Eliminar preguntas + sección vía API route (bypasa RLS)
        debugLog("🗑️ PASO 2-3: Eliminando sección vía API route...")

        const delRes = await fetch(
          `/api/surveys/${currentSurveyId}/sections?sectionId=${sectionId}`,
          { method: 'DELETE' }
        )
        const delJson = await delRes.json().catch(() => ({}))
        if (!delRes.ok || delJson.error) {
          throw new Error(delJson.error || `Error al eliminar sección (HTTP ${delRes.status})`)
        }

        debugLog("✅ Sección eliminada exitosamente")

        // PASO 4: Actualizar estado local
        debugLog("🔄 PASO 4: Actualizando estado local...")
        setSections((prevSections) => prevSections.filter((s) => s.id !== sectionId))
      } else {
        // Modo creación o sección temporal - solo actualizar estado local
        debugLog("📝 Modo creación - eliminando solo del estado local")
        setSections(sections.filter((s) => s.id !== sectionId))
      }

      // F0.6: limpiar entrada de sectionSaveStates para evitar memory leak
      setSectionSaveStates((prev) => {
        const next = { ...prev }
        delete next[sectionId]
        return next
      })

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
              required: true,
              // Ensure duplicated question's validation also marks it required
              config: {
                ...(questionToDuplicate.config || {}),
                validation: {
                  ...((questionToDuplicate.config && questionToDuplicate.config.validation) || {}),
                  required: true,
                },
              },
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
        showLogo: false,
        logoPosition: "top",
        ...prevSettings.branding,
        [field]: value,
      } as SurveySettings["branding"],
    }))
  }

  const handleSectionsChange = (newSections: SurveySection[]) => {
    setSections(newSections)
  }

  // Load project data (create and edit modes)
  useEffect(() => {
    if (!user || !projectId) return

    const fetchProjectData = async () => {
      setProjectLoading(true)
      try {
        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select(`
            id,
            name,
            companies (
              id,
              name,
              logo
            )
          `)
          .eq("id", projectId)
          .maybeSingle()

        if (projectError) {
          console.error("Error loading project data:", projectError)
          throw projectError
        }

        if (!projectData) {
          setError("Proyecto no encontrado.")
          return
        }

        debugLog("✅ Datos del proyecto cargados:", projectData)
        setProjectData(projectData)
      } catch (err: any) {
        console.error("Error fetching project data:", err)
        setError(err.message || "No se pudo cargar la información del proyecto.")
        toast({
          title: "Error",
          description: err.message || "No se pudo cargar la información del proyecto",
          variant: "destructive",
        })
      } finally {
        setProjectLoading(false)
      }
    }

    fetchProjectData()
  }, [user, projectId, toast])

  // Load surveyors data
  useEffect(() => {
    if (!user) return

    const fetchSurveyors = async () => {
      setSurveyorsLoading(true)
      try {
        const { data: surveyorsData, error: surveyorsError } = await supabase
          .from("surveyors")
          .select("id, name, email")
          .order("name", { ascending: true })

        if (surveyorsError) {
          console.error("Error loading surveyors:", surveyorsError)
          throw surveyorsError
        }

        setAllSurveyors(surveyorsData || [])
      } catch (err: any) {
        console.error("Error fetching surveyors:", err)
        toast({
          title: "Error",
          description: "No se pudieron cargar los encuestadores",
          variant: "destructive",
        })
      } finally {
        setSurveyorsLoading(false)
      }
    }

    fetchSurveyors()
  }, [user, toast])

  // Load zones data
  useEffect(() => {
    if (!user) return

    const fetchZones = async () => {
      setZonesLoading(true)
      try {
        const { data: zonesData, error: zonesError } = await supabase
          .from("zones")
          .select("id, name, geometry")
          .order("name", { ascending: true })

        if (zonesError) {
          console.error("Error loading zones:", zonesError)
          throw zonesError
        }

        setAllZones(zonesData || [])
      } catch (err: any) {
        console.error("Error fetching zones:", err)
        toast({
          title: "Error",
          description: "No se pudieron cargar las zonas",
          variant: "destructive",
        })
      } finally {
        setZonesLoading(false)
      }
    }

    fetchZones()
  }, [user, toast])

  // Complete initialization when creating new survey (no surveyId)
  useEffect(() => {
    if (!user || currentSurveyId || projectLoading || surveyorsLoading || zonesLoading) {
      return
    }

    // If we're creating a new survey and all data is loaded
    setInitialLoading(false)
    debugLog("✅ Inicialización completada para nueva encuesta")
  }, [user, currentSurveyId, projectLoading, surveyorsLoading, zonesLoading])

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

          {/* SectionOrganizer mounted below with isOpen prop; removed duplicate conditional render to avoid double mount */}
          <div className="flex-1 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                <TabsTrigger value="details" className="text-xs sm:text-sm">Detalles</TabsTrigger>
                <TabsTrigger value="questions" className="text-xs sm:text-sm">Preguntas</TabsTrigger>
                <TabsTrigger value="assignment" className="text-xs sm:text-sm">Asignación</TabsTrigger>
                <TabsTrigger value="settings" className="text-xs sm:text-sm">Config.</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6">
                {/* ... existing details content ... */}
                <Card className="border-0 shadow-none sm:border sm:shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">Información básica de la encuesta</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 sm:space-y-6 px-3 sm:px-6">
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
                <Card className="border-0 shadow-none sm:border sm:shadow-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <MessageSquareText className="h-5 w-5" />
                          Secciones y Preguntas
                        </CardTitle>
                      </div>
                      <div className="flex gap-2">
                        {/* Botón Organizar movido al bloque 'Trabajando en:' */}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6">
                    <div className="space-y-4">
                      

                      {sections.length > 0 ? (
                        <div className="space-y-4">
                          {/* ── SectionPicker — funciona con 1 o 100 secciones ── */}
                          <SectionPickerBar
                            sections={sections}
                            activeSectionIndex={activeSectionIndex}
                            onSelectSection={setActiveSectionIndex}
                            sectionSaveStates={sectionSaveStates}
                            isSavingSection={isSavingSection}
                            onSaveCurrent={() => handleSaveSection(sections[activeSectionIndex].id)}
                            onSaveAll={async () => {
                              for (const s of sections) {
                                if (sectionSaveStates[s.id] !== "saved") await handleSaveSection(s.id)
                              }
                            }}
                            onAddSection={() => {
                              const newSection: SurveySection = {
                                id: generateUUID(),
                                title: `Nueva Sección ${sections.length + 1}`,
                                description: "",
                                order_num: sections.length,
                                questions: [],
                                skipLogic: undefined,
                              }
                              setSections([...sections, newSection])
                              setActiveSectionIndex(sections.length)
                            }}
                            onPreview={handlePreview}
                            onOrganize={() => setShowSectionOrganizer(true)}
                          />

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
                              onMoveQuestion={handleMoveQuestion}
                              allSections={sections}
                              sections={sections}
                              setSections={setSections}
                              currentSurveyId={currentSurveyId}
                            />
                          )}

                          {/* Botón rápido para agregar otra sección */}
                          <div className="flex justify-center pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs border-dashed text-muted-foreground hover:text-primary hover:border-primary bg-transparent"
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
                                setActiveSectionIndex(sections.length)
                              }}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Agregar otra sección
                            </Button>
                          </div>

                          {/* Navegación inferior prev / next */}
                          <div className="flex items-center justify-between px-1 pt-1">
                            <Button
                              variant="ghost" size="sm"
                              className="h-8 gap-1 text-xs text-muted-foreground"
                              onClick={() => setActiveSectionIndex(Math.max(0, activeSectionIndex - 1))}
                              disabled={activeSectionIndex === 0}
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Anterior</span>
                            </Button>
                            <span className="text-xs text-muted-foreground">
                              {activeSectionIndex + 1} / {sections.length}
                            </span>
                            <Button
                              variant="ghost" size="sm"
                              className="h-8 gap-1 text-xs text-muted-foreground"
                              onClick={() => setActiveSectionIndex(Math.min(sections.length - 1, activeSectionIndex + 1))}
                              disabled={activeSectionIndex === sections.length - 1}
                            >
                              <span className="hidden sm:inline">Siguiente</span>
                              <ChevronRight className="h-3.5 w-3.5" />
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
                    <Card className="border-0 shadow-none sm:border sm:shadow-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          Seleccionar Zonas
                        </CardTitle>
                        <CardDescription>Elige las zonas geográficas donde se realizará la encuesta</CardDescription>
                      </CardHeader>
                      <CardContent className="px-3 sm:px-6">
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
                    <GeneralSurveyorAssignment
                      allSurveyors={allSurveyors}
                      assignedSurveyorIds={assignedGeneralSurveyors}
                      onAssignmentChange={handleGeneralSurveyorAssignmentChange}
                    />

                    <Card className="border-0 shadow-none sm:border sm:shadow-sm">
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
                          <Badge variant="outline">{assignedGeneralSurveyors?.length || 0}</Badge>
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
                      <Card className="border-0 shadow-none sm:border sm:shadow-sm">
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
                              onGeometryChange={() => { }}
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
                <Card className="border-0 shadow-none sm:border sm:shadow-sm">
                  <CardHeader>
                    <CardTitle>Configuración de la Encuesta</CardTitle>
                    <CardDescription>Administra la configuración de esta encuesta</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 sm:space-y-6 px-3 sm:px-6">
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
                <Card className="border-0 shadow-none sm:border sm:shadow-sm">
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
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t">
                  <Button variant="outline" className="gap-2 bg-transparent" onClick={() => setActiveTab("assignment")}>
                    <ArrowLeft className="h-4 w-4" /> Anterior: Preguntas
                  </Button>
                  <div className="flex items-center gap-3">
                    {/* Indicador de autoguardado (auditoría 2026-07-29) */}
                    {autoSaveStatus !== "idle" && !isSaving && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        {autoSaveStatus === "saving" && (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Autoguardando...</>
                        )}
                        {autoSaveStatus === "saved" && (
                          <span className="text-emerald-600">Guardado automáticamente</span>
                        )}
                        {autoSaveStatus === "error" && (
                          <span className="text-red-600">No se pudo autoguardar — revisa tu conexión</span>
                        )}
                      </span>
                    )}
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
                </div>
              </TabsContent>

            </Tabs>
          </div>

          {/* Modals */}
          {showEditSettingsModal && (
            <EditSurveySettingsModal
              isOpen={showEditSettingsModal}
              onClose={() => setShowEditSettingsModal(false)}
              currentSettings={settings as any}
              surveyId={currentSurveyId || undefined}
              previewUrl={generatedPreviewUrl ?? undefined}
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
            sections={sections as any}
            onSectionsChange={(newSections: any[]) => {
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
