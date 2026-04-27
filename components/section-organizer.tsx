"use client"

import { useState, useEffect } from "react"
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent, DragOverlay, type DragStartEvent
} from "@dnd-kit/core"
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowUpDown, GripVertical, Plus, Trash2, Copy, Edit3, Save, Hash, Layers, MessageSquareText } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { generateUUID } from "@/lib/utils"
import { RichTextEditor } from "@/components/rich-text-editor"
import { CompactRichTextEditor } from "@/components/ui/compact-rich-text-editor"

// Utility: strip HTML tags safely in browser (returns plain text)
function stripHtml(html?: string | null): string {
  if (!html) return "";
  try {
    const tmp = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (tmp) {
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || "";
    }
  } catch (e) {
    // Fallback: remove tags with regex
    return html.replace(/<[^>]*>/g, "");
  }
  return html.replace(/<[^>]*>/g, "");
}

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
  config?: any
}

interface SurveySection {
  id: string
  title: string
  description?: string
  order_num: number
  questions: Question[]
}

interface SectionOrganizerProps {
  isOpen: boolean
  onClose: () => void
  sections: SurveySection[]
  onSectionsChange: (sections: SurveySection[]) => void
  onMoveQuestion?: (questionId: string, fromSectionId: string, toSectionId: string, newIndex?: number) => void
}

// ── Sortable Section Card ─────────────────────────────────────────────────────
function SortableSectionCard({
  section, index, onEdit, onDuplicate, onDelete, onMoveToPosition
}: {
  section: SurveySection; index: number
  onEdit: (s: SurveySection) => void
  onDuplicate: (s: SurveySection) => void
  onDelete: (id: string) => void
  onMoveToPosition: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`transition-all duration-150 ${isDragging ? "shadow-xl ring-2 ring-primary/30" : "hover:shadow-md"}`}>
        <CardHeader className="pb-3 pt-3 px-4">
          <div className="flex items-center gap-3">
            {/* Drag handle */}
            <button
              {...listeners} {...attributes}
              className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground rounded touch-none"
              title="Arrastrar para reordenar"
            >
              <GripVertical className="h-5 w-5" />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs shrink-0">Posición {index + 1}</Badge>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {section.questions.length} pregunta{section.questions.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="font-semibold text-base truncate">
                {stripHtml(section.title) || `Sección ${index + 1}`}
              </div>
              {section.description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{stripHtml(section.description)}</p>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button variant="outline" size="sm" onClick={() => onMoveToPosition(section.id)} className="gap-1 h-7 px-2 text-xs">
                <Hash className="h-3 w-3" /><span className="hidden sm:inline">Mover</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onEdit(section)} className="h-7 w-7 p-0" title="Editar">
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDuplicate(section)} className="h-7 w-7 p-0" title="Duplicar">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(section.id)}
                className="h-7 w-7 p-0 text-destructive/60 hover:text-destructive" title="Eliminar">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  )
}

interface SectionsTabProps {
  localSections: SurveySection[]
  onSectionsReorder: (sections: SurveySection[]) => void
  onEdit: (section: SurveySection) => void
  onDuplicate: (section: SurveySection) => void
  onDelete: (sectionId: string) => void
  onMoveToPosition: (sectionId: string) => void
}

function SectionsTab({ localSections, onSectionsReorder, onEdit, onDuplicate, onDelete, onMoveToPosition }: SectionsTabProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const handleDragStart = (event: DragStartEvent) => setActiveDragId(String(event.active.id))
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = localSections.findIndex(s => s.id === active.id)
    const newIdx = localSections.findIndex(s => s.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = arrayMove(localSections, oldIdx, newIdx).map((s, i) => ({ ...s, order_num: i }))
    onSectionsReorder(reordered)
  }

  const activeSection = activeDragId ? localSections.find(s => s.id === activeDragId) : null

  if (localSections.length === 0) {
    return (
      <div className="text-center py-12 flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Layers className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium text-muted-foreground">No hay secciones creadas</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Gestión de Secciones
        </h3>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <GripVertical className="h-3 w-3" /> Arrastra para reordenar
        </span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={localSections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="flex-1 overflow-y-auto overscroll-contain space-y-2 pr-1" style={{ maxHeight: "55vh" }}>
            {localSections.map((section, index) => (
              <SortableSectionCard
                key={section.id}
                section={section}
                index={index}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onMoveToPosition={onMoveToPosition}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeSection && (
            <div className="bg-white border-2 border-primary/40 rounded-lg px-4 py-3 shadow-xl opacity-95">
              <span className="font-medium text-sm">{stripHtml(activeSection.title) || "Sección"}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

// ── Sortable Question Row ─────────────────────────────────────────────────────
function SortableQuestionRow({
  question, index, sectionId, selected, onSelect, onMove, getTypeIcon
}: {
  question: Question; index: number; sectionId: string
  selected: boolean
  onSelect: (e: React.MouseEvent) => void
  onMove: () => void
  getTypeIcon: (type: string) => string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${sectionId}-${question.id}`
  })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all
        ${selected ? "bg-primary/[0.06] border-primary/30" : "bg-white border-gray-100 hover:bg-gray-50/80"}
        ${isDragging ? "shadow-lg" : "shadow-sm"}`}
      onClick={onSelect}
    >
      <button
        {...listeners} {...attributes}
        className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground shrink-0 touch-none"
        onClick={e => e.stopPropagation()}
        title="Arrastrar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Badge variant="outline" className="text-xs shrink-0 w-6 h-6 flex items-center justify-center p-0">{index + 1}</Badge>
      <span className="text-base shrink-0">{getTypeIcon(question.type)}</span>
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-sm">{stripHtml(question.text) || `Pregunta ${index + 1}`}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Badge variant="secondary" className="text-[10px] h-4 px-1">{question.type}</Badge>
          {question.required && <Badge variant="destructive" className="text-[10px] h-4 px-1">Req</Badge>}
        </div>
      </div>
      <Button
        variant="outline" size="sm"
        onClick={e => { e.stopPropagation(); onMove(); }}
        className="h-6 px-2 text-xs shrink-0 gap-1"
        title="Mover a otra sección"
      >
        <Hash className="h-3 w-3" />
        <span className="hidden sm:inline">Mover</span>
      </Button>
    </div>
  )
}

interface QuestionsTabProps {
  localSections: SurveySection[]
  onSectionsChange: (sections: SurveySection[]) => void
  selectedQuestions: Set<string>
  onQuestionSelect: (e: React.MouseEvent, section: SurveySection, question: Question) => void
  onQuestionMove: (question: Question, sectionId: string, currentIndex: number) => void
}

function QuestionsTab({
  localSections, onSectionsChange,
  selectedQuestions, onQuestionSelect, onQuestionMove
}: QuestionsTabProps) {
  const [selectedSectionId, setSelectedSectionId] = useState<string>("all")

  const getQuestionTypeIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      text: "📝",
      textarea: "📄",
      multiple_choice: "🔘",
      checkbox: "☑️",
      dropdown: "📋",
      scale: "📊",
      matrix: "📋",
      ranking: "🔢",
      date: "📅",
      time: "🕐",
      email: "📧",
      phone: "📞",
      number: "🔢",
      rating: "⭐",
      file: "📎",
      image_upload: "🖼️",
      signature: "✍️",
      likert: "📈",
      net_promoter: "📊",
      slider: "🎚️",
    }
    return icons[type] || "❓"
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const filteredSections = selectedSectionId === "all"
    ? localSections
    : localSections.filter(s => s.id === selectedSectionId)

  const totalQuestions = localSections.reduce((t, s) => t + s.questions.length, 0)
  const visibleQuestions = filteredSections.reduce((t, s) => t + s.questions.length, 0)

  const handleSectionDragEnd = (sectionId: string) => (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const sectionIdx = localSections.findIndex(s => s.id === sectionId)
    if (sectionIdx === -1) return
    const questions = localSections[sectionIdx].questions
    const activeKey = String(active.id)
    const overKey = String(over.id)
    const oldIdx = questions.findIndex(q => `${sectionId}-${q.id}` === activeKey)
    const newIdx = questions.findIndex(q => `${sectionId}-${q.id}` === overKey)
    if (oldIdx === -1 || newIdx === -1) return
    const newSections = localSections.map((s, i) =>
      i === sectionIdx ? { ...s, questions: arrayMove(questions, oldIdx, newIdx) } : s
    )
    onSectionsChange(newSections)
  }

  return (
    <div className="space-y-3 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <MessageSquareText className="h-4 w-4" />
          Gestión de Preguntas
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <GripVertical className="h-3 w-3" /> Arrastra para reordenar
          </span>
          <span className="text-xs text-muted-foreground">
            {visibleQuestions} / {totalQuestions}
          </span>
        </div>
      </div>

      {/* Selector de sección */}
      <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las secciones ({totalQuestions} preguntas)</SelectItem>
          {localSections.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {stripHtml(s.title) || `Sección ${s.order_num + 1}`} ({s.questions.length})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {visibleQuestions === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">No hay preguntas en esta vista</div>
      ) : (
        <div className="flex-1 overflow-y-auto overscroll-contain space-y-5 pr-1" style={{ maxHeight: "52vh" }}>
          {filteredSections.map(section => {
            if (section.questions.length === 0) return null
            const itemIds = section.questions.map(q => `${section.id}-${q.id}`)
            return (
              <div key={section.id} className="space-y-2">
                {selectedSectionId === "all" && (
                  <div className="flex items-center gap-2 pb-1 border-b">
                    <Badge variant="outline" className="text-xs">{section.questions.length}p</Badge>
                    <h4 className="text-sm font-medium text-muted-foreground truncate">
                      {stripHtml(section.title) || `Sección ${section.order_num + 1}`}
                    </h4>
                  </div>
                )}

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSectionDragEnd(section.id)}
                >
                  <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1.5">
                      {section.questions.map((question, qIndex) => (
                        <SortableQuestionRow
                          key={question.id}
                          question={question}
                          index={qIndex}
                          sectionId={section.id}
                          selected={selectedQuestions.has(`${section.id}-${question.id}`)}
                          onSelect={(e) => onQuestionSelect(e, section, question)}
                          onMove={() => onQuestionMove(question, section.id, qIndex)}
                          getTypeIcon={getQuestionTypeIcon}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function SectionOrganizer({ isOpen, onClose, sections, onSectionsChange }: SectionOrganizerProps) {
  const { toast } = useToast()
  const [localSections, setLocalSections] = useState<SurveySection[]>([])
  const [editingSection, setEditingSection] = useState<SurveySection | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [activeTab, setActiveTab] = useState("sections")

  // Actualizar las secciones locales solo cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setLocalSections(JSON.parse(JSON.stringify(sections))) // Crear una copia profunda
    }
  }, [isOpen, sections])
  
  const [editDescription, setEditDescription] = useState("")
  const [movingSection, setMovingSection] = useState<SurveySection | null>(null)
  const [targetPosition, setTargetPosition] = useState<string>("")
  const [moveMode, setMoveMode] = useState<"before" | "after" | "exact">("exact")
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [bulkMoveSection, setBulkMoveSection] = useState<{
    fromSectionId: string;
    toSectionId: string;
  } | null>(null)
  const [movingQuestion, setMovingQuestion] = useState<{
    question: Question;
    sectionId: string;
    currentIndex: number;
  } | null>(null)
  const [targetQuestionPosition, setTargetQuestionPosition] = useState<string>("")
  const [questionMoveMode, setQuestionMoveMode] = useState<"before" | "after" | "end">("after")
  const [moveToAnotherSection, setMoveToAnotherSection] = useState(false)

  const handleMoveToPosition = (sectionId: string) => {
    const section = localSections.find((s) => s.id === sectionId)
    if (section) {
      setMovingSection(section)
      setTargetPosition("")
      setMoveMode("exact")
    }
  }

  // Ensure the rich editor is populated with the saved HTML title when a section is selected for editing.
  useEffect(() => {
    if (editingSection) {
  setEditTitle(editingSection.title ?? "")
      setEditDescription(editingSection.description ?? "")
    }
  }, [editingSection])

  const handleConfirmMove = () => {
    if (!movingSection || !targetPosition) return

    const currentIndex = localSections.findIndex((s) => s.id === movingSection.id)
    let newIndex: number

    if (moveMode === "exact") {
      newIndex = Number.parseInt(targetPosition) - 1 // Convert to 0-based index
      newIndex = Math.max(0, Math.min(newIndex, localSections.length - 1))
    } else {
      const targetSectionIndex = Number.parseInt(targetPosition) - 1
      if (moveMode === "before") {
        newIndex = Math.max(0, targetSectionIndex)
      } else {
        // after
        newIndex = Math.min(localSections.length - 1, targetSectionIndex + 1)
      }
    }

    if (currentIndex !== newIndex) {
      const newSections = [...localSections];
      const [movedSection] = newSections.splice(currentIndex, 1);
      newSections.splice(newIndex, 0, movedSection);

      const updatedSections = newSections.map((section, index) => ({
        ...section,
        order_num: index,
      }));

      setLocalSections(updatedSections);

      toast({
        title: "Sección movida",
        description: `La sección se ha movido a la posición ${newIndex + 1}.`,
      });
    }

    setMovingSection(null)
    setTargetPosition("")
  }

  const handleEdit = (section: SurveySection) => {
    setEditingSection(section)
  setEditTitle(section.title)
    setEditDescription(section.description || "")
  }

  const handleSaveEdit = () => {
    if (!editingSection) return

    const updatedSections = localSections.map((section) =>
      section.id === editingSection.id
        ? { ...section, title_html: editTitle, title: stripHtml(editTitle), description: editDescription }
        : section,
    )
    setLocalSections(updatedSections)
    // Also propagate immediately to parent so external state/store can persist and reflect the HTML
    try {
      onSectionsChange(updatedSections)
    } catch (e) {
      console.debug("onSectionsChange failed in handleSaveEdit", e)
    }
    // Helpful debug log to inspect what HTML was saved in local state
    console.debug("Saved section title_html:", editTitle)
    setEditingSection(null)
    setEditTitle("")
    setEditDescription("")

    toast({
      title: "Sección actualizada",
      description: "Los cambios se han guardado correctamente.",
    })
  }

  const handleDuplicate = (section: SurveySection) => {
    // Create a map to store old question IDs to new IDs
    const idMap = new Map<string, string>();

    // First pass: Create new IDs for all questions
    section.questions.forEach(q => {
      const newId = generateUUID();
      idMap.set(q.id, newId);
    });

    // Second pass: Create questions with updated references
    const newQuestions = section.questions.map(q => {
      const newId = idMap.get(q.id) || generateUUID();
      
      // Create a copy of the question config
      const newConfig = q.config ? { ...q.config } : undefined;

      // Update references in display logic
      if (newConfig?.displayLogic?.conditions) {
        newConfig.displayLogic.conditions = newConfig.displayLogic.conditions.map((condition: any) => ({
          ...condition,
          questionId: idMap.get(condition.questionId) || condition.questionId
        }));
      }

      // Update references in skip logic
      if (newConfig?.skipLogic?.rules) {
        newConfig.skipLogic.rules = newConfig.skipLogic.rules.map((rule: any) => ({
          ...rule,
          targetQuestionId: idMap.get(rule.targetQuestionId) || rule.targetQuestionId
        }));
      }

      // Create the new question with updated config
      return {
        ...q,
        id: newId,
        config: {
          ...newConfig,
          originalId: q.id // Store the original ID for reference
        }
      };
    });

    // Create the new section (preserve HTML title if exists)
  const baseTitle = section.title
  const newTitleText = `${baseTitle} (Copia)`

    const newSection: SurveySection = {
      ...section,
      id: generateUUID(),
      title: newTitleText,
      order_num: localSections.length,
      questions: newQuestions,
    };

    setLocalSections([...localSections, newSection]);

    toast({
      title: "Sección duplicada",
      description: "Se ha creado una copia de la sección con referencias actualizadas.",
    });
  }

  const handleDelete = (sectionId: string) => {
    const updatedSections = localSections
      .filter((section) => section.id !== sectionId)
      .map((section, index) => ({ ...section, order_num: index }))

    setLocalSections(updatedSections)

    toast({
      title: "Sección eliminada",
      description: "La sección ha sido eliminada correctamente.",
    })
  }

  const handleAddSection = () => {
    const newSection: SurveySection = {
      id: generateUUID(),
      title: `Nueva Sección ${localSections.length + 1}`,
      description: "",
      order_num: localSections.length,
      questions: [],
    }
    setLocalSections([...localSections, newSection])

    toast({
      title: "Sección agregada",
      description: "Se ha creado una nueva sección.",
    })
  }

  const handleSave = () => {
    onSectionsChange(localSections)
    onClose()

    toast({
      title: "Cambios guardados",
      description: "La organización de secciones se ha actualizado.",
    })
  }

  const handleCancel = () => {
    setLocalSections(sections) // Reset to original solo si se cancela
    setEditingSection(null)
    setMovingSection(null)
    setMovingQuestion(null)
    setMoveToAnotherSection(false)
    onClose() // Cerrar el modal
  }

  const handleQuestionMove = () => {
    if (!movingQuestion || !bulkMoveSection) return;

    // Copia profunda de las secciones
    const newSections = localSections.map(section => ({
      ...section,
      questions: [...section.questions],
    }));

    // Encuentra índices de origen y destino
    const fromSectionIdx = newSections.findIndex(s => s.id === bulkMoveSection.fromSectionId);
    const toSectionIdx = newSections.findIndex(s => s.id === bulkMoveSection.toSectionId);
    if (fromSectionIdx === -1 || toSectionIdx === -1) return;

    // Encuentra la pregunta a mover
    const questionIdx = newSections[fromSectionIdx].questions.findIndex(q => q.id === movingQuestion.question.id);
    if (questionIdx === -1) return;
    const [questionToMove] = newSections[fromSectionIdx].questions.splice(questionIdx, 1);

    // Calcula el índice de inserción en destino
    let targetIndex: number;
    if (questionMoveMode === "end") {
      targetIndex = newSections[toSectionIdx].questions.length;
    } else {
      const referenceQuestionIndex = Number(targetQuestionPosition);
      if (questionMoveMode === "before") {
        targetIndex = referenceQuestionIndex;
      } else { // after
        targetIndex = referenceQuestionIndex + 1;
      }
    }
    // Inserta la pregunta en la posición destino
    newSections[toSectionIdx].questions.splice(targetIndex, 0, questionToMove);

    setLocalSections(newSections);
    // No propagues al padre aquí, solo al guardar
    setMovingQuestion(null);
    setBulkMoveSection(null);
    setTargetQuestionPosition("");
    setQuestionMoveMode("after");

    toast({
      title: "Pregunta movida",
      description: "La pregunta se ha movido correctamente a su nueva posición.",
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { 
        if (!open) {
          handleCancel()
        }
      }}>
    <DialogContent className="max-w-6xl max-h-[95vh] overflow-auto flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5" />
              Organizar Encuesta
            </DialogTitle>
            <DialogDescription>
              Gestiona las secciones y preguntas de tu encuesta de forma separada y organizada.
            </DialogDescription>
          </DialogHeader>

          {localSections.length > 0 && (
            <div className="flex items-center justify-between px-1 py-2 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">
                Total: {localSections.length} sección{localSections.length !== 1 ? "es" : ""} • {' '}
                {localSections.reduce((total, section) => total + section.questions.length, 0)} pregunta{localSections.reduce((total, section) => total + section.questions.length, 0) !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          <div className="flex-1 overflow-auto">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sections" className="gap-2">
                  <Layers className="h-4 w-4" />
                  Secciones
                </TabsTrigger>
                <TabsTrigger value="questions" className="gap-2">
                  <MessageSquareText className="h-4 w-4" />
                  Preguntas
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sections" className="flex-1 mt-4 overflow-auto">
                <SectionsTab
                  localSections={localSections}
                  onSectionsReorder={setLocalSections}
                  onEdit={handleEdit}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  onMoveToPosition={handleMoveToPosition}
                />
              </TabsContent>

              <TabsContent value="questions" className="flex-1 mt-4 overflow-hidden">
                <QuestionsTab
                  localSections={localSections}
                  onSectionsChange={setLocalSections}
                  selectedQuestions={selectedQuestions}
                  onQuestionSelect={(e, section, question) => {
                    if (e.ctrlKey || e.metaKey) {
                      const questionKey = `${section.id}-${question.id}`;
                      const newSelected = new Set(selectedQuestions);
                      if (newSelected.has(questionKey)) {
                        newSelected.delete(questionKey);
                      } else {
                        newSelected.add(questionKey);
                      }
                      setSelectedQuestions(newSelected);
                    } else if (e.shiftKey && selectedQuestions.size > 0) {
                      const lastSelected = Array.from(selectedQuestions).pop()!;
                      const [lastSectionId, lastQuestionId] = lastSelected.split('-');
                      
                      if (lastSectionId === section.id) {
                        const questions = section.questions;
                        const lastIndex = questions.findIndex(q => q.id === lastQuestionId);
                        const currentIndex = questions.findIndex(q => q.id === question.id);
                        
                        const startIndex = Math.min(lastIndex, currentIndex);
                        const endIndex = Math.max(lastIndex, currentIndex);
                        
                        const newSelected = new Set(selectedQuestions);
                        for (let i = startIndex; i <= endIndex; i++) {
                          newSelected.add(`${section.id}-${questions[i].id}`);
                        }
                        setSelectedQuestions(newSelected);
                      }
                    } else {
                      setSelectedQuestions(new Set([`${section.id}-${question.id}`]));
                    }
                  }}
                  onQuestionMove={(question, sectionId, currentIndex) => {
                    setMovingQuestion({ question, sectionId, currentIndex });
                    setBulkMoveSection({
                      fromSectionId: sectionId,
                      toSectionId: sectionId
                    });
                    setTargetQuestionPosition("");
                    setQuestionMoveMode("after");
                    setMoveToAnotherSection(false);
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {activeTab === "sections" && "Gestiona las secciones de tu encuesta"}
              {activeTab === "questions" && "Organiza las preguntas dentro de las secciones"}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCancel} variant="outline">
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Guardar Cambios
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Section Modal */}
      <Dialog open={!!editingSection} onOpenChange={() => setEditingSection(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Editar Sección</DialogTitle>
            <DialogDescription>
              Modifica el título y descripción de la sección con formato enriquecido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título de la sección</label>
              <CompactRichTextEditor
                value={editTitle}
                onChange={setEditTitle}
                placeholder="Ej: Datos Personales"
                minHeight="60px"
                compact={true}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descripción (opcional)</label>
              <CompactRichTextEditor
                value={editDescription}
                onChange={setEditDescription}
                placeholder="Descripción de la sección..."
                minHeight="80px"
                compact={true}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditingSection(null)} variant="outline">
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

   
      <Dialog open={!!movingQuestion} onOpenChange={() => {
        setMovingQuestion(null)
        setMoveToAnotherSection(false)
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Mover Pregunta
            </DialogTitle>
            <DialogDescription>
              Configura donde quieres mover la pregunta seleccionada
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Question to move preview */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <span className="text-lg">
                  {(() => {
                    const icons: { [key: string]: string } = {
                      text: "📝", textarea: "📄", multiple_choice: "🔘", checkbox: "☑️",
                      dropdown: "📋", scale: "📊", matrix: "📋", ranking: "🔢", date: "📅",
                      time: "🕐", email: "📧", phone: "📞", number: "🔢", rating: "⭐",
                      file: "📎", image_upload: "🖼️", signature: "✍️", likert: "📈",
                      net_promoter: "📊", slider: "🎚️",
                    }
                    return icons[movingQuestion?.question.type || "text"] || "❓"
                  })()}
                </span>
                Pregunta a mover:
              </h4>
              <div className="text-sm text-muted-foreground bg-white p-3 rounded border">
                {movingQuestion?.question.text.replace(/<[^>]*>/g, "") || "Pregunta sin título"}
                {movingQuestion?.question.required && (
                  <Badge variant="destructive" className="text-xs ml-2">Obligatorio</Badge>
                )}
              </div>
            </div>

            {/* Section origin info */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Sección origen</label>
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {localSections.find(s => s.id === movingQuestion?.sectionId)?.questions.length || 0} preguntas
                  </Badge>
                  <span className="font-medium">
                    {stripHtml(localSections.find(s => s.id === movingQuestion?.sectionId)?.title || "Sección origen")}
                  </span>
                </div>
              </div>
            </div>

            {/* Checkbox to move to another section */}
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="moveToAnotherSection" 
                checked={moveToAnotherSection}
                onCheckedChange={(checked) => {
                  setMoveToAnotherSection(!!checked)
                  if (!checked) {
                    setBulkMoveSection({
                      fromSectionId: movingQuestion?.sectionId || "",
                      toSectionId: movingQuestion?.sectionId || "",
                    })
                  }
                }}
              />
              <label htmlFor="moveToAnotherSection" className="text-sm font-medium cursor-pointer">
                Mover a otra sección
              </label>
            </div>

            {/* Target section selection (only if checkbox is checked) */}
            {moveToAnotherSection && (
              <div className="space-y-3">
                <label className="text-sm font-medium">Sección destino</label>
                <Select
                  value={bulkMoveSection?.toSectionId}
                  onValueChange={(sectionId) => setBulkMoveSection({
                    fromSectionId: movingQuestion?.sectionId || "",
                    toSectionId: sectionId,
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona la sección destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {localSections
                      .filter(section => section.id !== movingQuestion?.sectionId)
                      .map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{section.questions.length} preguntas</Badge>
                            <span>{stripHtml(section.title) || `Sección ${section.order_num + 1}`}</span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Position selection mode */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Tipo de posicionamiento</label>
              <Select value={questionMoveMode} onValueChange={(value: "before" | "after" | "end") => setQuestionMoveMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">Antes de la pregunta</SelectItem>
                  <SelectItem value="after">Después de la pregunta</SelectItem>
                  <SelectItem value="end">Al final de la sección</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Question position selection (only if not "end") */}
            {questionMoveMode !== "end" && bulkMoveSection && (
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  {questionMoveMode === "before" ? "Antes de la pregunta" : "Después de la pregunta"}
                </label>
                <Select value={targetQuestionPosition} onValueChange={setTargetQuestionPosition}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una pregunta de referencia..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {localSections
                      .find(s => s.id === bulkMoveSection.toSectionId)
                      ?.questions.filter(q => q.id !== movingQuestion?.question.id)
                      .map((question, index) => (
                        <SelectItem key={question.id} value={index.toString()}>
                          <div className="flex items-center gap-2 max-w-[400px]">
                            <Badge variant="outline" className="text-xs shrink-0">{index + 1}</Badge>
                            <span className="text-lg shrink-0">{(() => {
                              const icons: { [key: string]: string } = {
                                text: "📝", textarea: "📄", multiple_choice: "🔘", checkbox: "☑️",
                                dropdown: "📋", scale: "📊", matrix: "📋", ranking: "🔢", date: "📅",
                                time: "🕐", email: "📧", phone: "📞", number: "🔢", rating: "⭐",
                                file: "📎", image_upload: "🖼️", signature: "✍️", likert: "📈",
                                net_promoter: "📊", slider: "🎚️",
                              }
                              return icons[question.type] || "❓"
                            })()}</span>
                            <span className="truncate">{question.text.replace(/<[^>]*>/g, "") || `Pregunta ${index + 1}`}</span>
                            {question.required && <Badge variant="destructive" className="text-xs shrink-0">Req</Badge>}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                <div className="text-xs text-muted-foreground">
                  {(() => {
                    const targetSection = localSections.find(s => s.id === bulkMoveSection.toSectionId);
                    const availableQuestions = targetSection?.questions.filter(q => q.id !== movingQuestion?.question.id).length || 0;
                    return `${availableQuestions} pregunta${availableQuestions !== 1 ? 's' : ''} disponible${availableQuestions !== 1 ? 's' : ''} como referencia`;
                  })()}
                </div>
              </div>
            )}

            {/* Preview of the move */}
            {bulkMoveSection && (questionMoveMode === "end" || targetQuestionPosition !== "") && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium mb-2 text-blue-800">Vista previa del movimiento:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600">De:</span>
                    <Badge variant="outline">{stripHtml(localSections.find(s => s.id === bulkMoveSection.fromSectionId)?.title || "Sección origen")}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600">A:</span>
                    <Badge variant="default">{stripHtml(localSections.find(s => s.id === bulkMoveSection.toSectionId)?.title || "Sección destino")}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600">Posición:</span>
                    <Badge variant="secondary">{(() => {
                      if (questionMoveMode === "end") return "Al final de la sección";
                      const targetSection = localSections.find(s => s.id === bulkMoveSection.toSectionId);
                      const referenceQuestion = targetSection?.questions[Number(targetQuestionPosition)];
                      const referenceText = referenceQuestion?.text.replace(/<[^>]*>/g, "") || `Pregunta ${Number(targetQuestionPosition) + 1}`;
                      return `${questionMoveMode === "before" ? "Antes" : "Después"} de: ${referenceText.substring(0, 30)}${referenceText.length > 30 ? "..." : ""}`;
                    })()}</Badge>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button onClick={() => {
              setMovingQuestion(null);
              setBulkMoveSection(null);
              setTargetQuestionPosition("");
              setQuestionMoveMode("after");
              setMoveToAnotherSection(false);
            }} variant="outline">Cancelar</Button>
            <Button 
              onClick={handleQuestionMove} 
              disabled={!bulkMoveSection || (questionMoveMode !== "end" && !targetQuestionPosition)} 
              className="gap-2"
            >
              <ArrowUpDown className="h-4 w-4" />Mover Pregunta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Move Section Modal */}
      <Dialog open={!!movingSection} onOpenChange={() => setMovingSection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Mover Sección a Posición Específica
            </DialogTitle>
            <DialogDescription>
              Mueve "{movingSection?.title}" a una posición específica en la encuesta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de movimiento</label>
              <Select value={moveMode} onValueChange={(value: "before" | "after" | "exact") => setMoveMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">Mover a posición exacta</SelectItem>
                  <SelectItem value="before">Mover antes de la sección</SelectItem>
                  <SelectItem value="after">Mover después de la sección</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {moveMode === "exact"
                  ? "Posición destino"
                  : moveMode === "before"
                    ? "Antes de la sección"
                    : "Después de la sección"}
              </label>
              <Select value={targetPosition} onValueChange={setTargetPosition}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      moveMode === "exact"
                        ? "Selecciona posición (1-" + localSections.length + ")"
                        : "Selecciona sección de referencia"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {moveMode === "exact" ? (
                    // Offer explicit positions 1..N so users can move to any index
                    Array.from({ length: localSections.length }).map((_, idx) => {
                      const sec = localSections[idx]
                      return (
                        <SelectItem key={`pos-${idx + 1}`} value={(idx + 1).toString()}>
                          {`Posición ${idx + 1} — ${stripHtml(sec?.title) || `Sección ${idx + 1}`}`}
                        </SelectItem>
                      )
                    })
                  ) : (
                    localSections
                      .filter(section => section.id !== movingSection?.id)
                      .map((section, index) => (
                        <SelectItem key={section.id} value={(index + 1).toString()}>
                          {`${index + 1}. ${stripHtml(section.title)}`}
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {targetPosition && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2 text-blue-800">Vista previa del movimiento:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600">Sección a mover:</span>
                    <Badge variant="outline">
                      {movingSection?.title || "Sección sin título"}
                    </Badge>
                  </div>
                  {moveMode !== "exact" && (
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600">Referencia:</span>
                      <Badge variant="default">
                        {(() => {
                          const refSection = localSections.filter(s => s.id !== movingSection?.id)[Number(targetPosition) - 1];
                          return refSection?.title || "Sección de referencia";
                        })()}
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600">Posición:</span>
                    <Badge variant="secondary">
                      {moveMode === "exact"
                        ? "A la posición " + targetPosition
                        : moveMode === "before"
                          ? "Antes de la sección " + targetPosition
                          : "Después de la sección " + targetPosition}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setMovingSection(null)} variant="outline">
              Cancelar
            </Button>
            <Button onClick={handleConfirmMove} disabled={!targetPosition}>
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Mover Sección
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}