"use client"

import { useState } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowUpDown, GripVertical, Plus, Trash2, Copy, Edit3, Save, Hash } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

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
}

interface SortableSectionCardProps {
  section: SurveySection
  index: number
  totalSections: number
  onEdit: (section: SurveySection) => void
  onDuplicate: (section: SurveySection) => void
  onDelete: (sectionId: string) => void
  onMoveToPosition: (sectionId: string) => void
}

function SortableSectionCard({
  section,
  index,
  totalSections,
  onEdit,
  onDuplicate,
  onDelete,
  onMoveToPosition,
}: SortableSectionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

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

  return (
    <div ref={setNodeRef} style={style} className="mb-4">
      <Card className={`transition-all duration-200 ${isDragging ? "shadow-lg" : "hover:shadow-md"}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    Posición {index + 1}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {section.questions.length} pregunta{section.questions.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <h3 className="font-semibold text-lg">{section.title || `Sección ${index + 1}`}</h3>
                {section.description && <p className="text-sm text-muted-foreground mt-1">{section.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {totalSections > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onMoveToPosition(section.id)}
                  className="h-8 w-8 p-0"
                  title="Mover a posición específica"
                >
                  <Hash className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => onEdit(section)} className="h-8 w-8 p-0">
                <Edit3 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDuplicate(section)} className="h-8 w-8 p-0">
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(section.id)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {section.questions.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Preguntas:</h4>
              <div className="grid gap-2">
                {section.questions.slice(0, 3).map((question, qIndex) => (
                  <div key={question.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                    <span className="text-lg">{getQuestionTypeIcon(question.type)}</span>
                    <span className="flex-1 truncate">
                      {question.text.replace(/<[^>]*>/g, "") || `Pregunta ${qIndex + 1}`}
                    </span>
                    {question.required && (
                      <Badge variant="destructive" className="text-xs">
                        Obligatorio
                      </Badge>
                    )}
                  </div>
                ))}
                {section.questions.length > 3 && (
                  <div className="text-xs text-muted-foreground text-center py-1">
                    +{section.questions.length - 3} pregunta{section.questions.length - 3 !== 1 ? "s" : ""} más
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">No hay preguntas en esta sección</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function SectionOrganizer({ isOpen, onClose, sections, onSectionsChange }: SectionOrganizerProps) {
  const { toast } = useToast()
  const [localSections, setLocalSections] = useState<SurveySection[]>(sections)
  const [editingSection, setEditingSection] = useState<SurveySection | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [activeId, setActiveId] = useState<string | null>(null)
  const [movingSection, setMovingSection] = useState<SurveySection | null>(null)
  const [targetPosition, setTargetPosition] = useState<string>("")
  const [moveMode, setMoveMode] = useState<"before" | "after" | "exact">("exact")

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = (event: any) => {
    const { active, over } = event
    setActiveId(null)

    if (active.id !== over?.id) {
      const oldIndex = localSections.findIndex((section) => section.id === active.id)
      const newIndex = localSections.findIndex((section) => section.id === over.id)

      const newSections = arrayMove(localSections, oldIndex, newIndex)
      const updatedSections = newSections.map((section, index) => ({
        ...section,
        order_num: index,
      }))
      setLocalSections(updatedSections)
    }
  }

  const handleMoveToPosition = (sectionId: string) => {
    const section = localSections.find((s) => s.id === sectionId)
    if (section) {
      setMovingSection(section)
      setTargetPosition("")
      setMoveMode("exact")
    }
  }

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
      const newSections = arrayMove(localSections, currentIndex, newIndex)
      const updatedSections = newSections.map((section, index) => ({
        ...section,
        order_num: index,
      }))
      setLocalSections(updatedSections)

      toast({
        title: "Sección movida",
        description: `La sección se ha movido a la posición ${newIndex + 1}.`,
      })
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
      section.id === editingSection.id ? { ...section, title: editTitle, description: editDescription } : section,
    )
    setLocalSections(updatedSections)
    setEditingSection(null)
    setEditTitle("")
    setEditDescription("")

    toast({
      title: "Sección actualizada",
      description: "Los cambios se han guardado correctamente.",
    })
  }

  const handleDuplicate = (section: SurveySection) => {
    const newSection: SurveySection = {
      ...section,
      id: `${Date.now()}`,
      title: `${section.title} (Copia)`,
      order_num: localSections.length,
      questions: section.questions.map((q) => ({
        ...q,
        id: `${Date.now()}_${Math.random()}`,
      })),
    }
    setLocalSections([...localSections, newSection])

    toast({
      title: "Sección duplicada",
      description: "Se ha creado una copia de la sección.",
    })
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
      id: `${Date.now()}`,
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
    setLocalSections(sections) // Reset to original
    setEditingSection(null)
    setMovingSection(null)
    onClose()
  }

  const draggedSection = activeId ? localSections.find((section) => section.id === activeId) : null

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleCancel}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5" />
              Organizar Secciones de la Encuesta
            </DialogTitle>
            <DialogDescription>
              Arrastra y suelta las secciones para cambiar su orden.
              {localSections.length > 5 &&
                " Para encuestas largas, usa el botón # para mover a posiciones específicas."}
            </DialogDescription>
          </DialogHeader>

          {localSections.length > 0 && (
            <div className="flex items-center justify-between px-1 py-2 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">
                Total: {localSections.length} sección{localSections.length !== 1 ? "es" : ""}
              </span>
              {localSections.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  <Hash className="h-3 w-3 mr-1" />
                  Usa # para mover rápido
                </Badge>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-1">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={localSections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {localSections.map((section, index) => (
                  <SortableSectionCard
                    key={section.id}
                    section={section}
                    index={index}
                    totalSections={localSections.length}
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                    onMoveToPosition={handleMoveToPosition}
                  />
                ))}
              </SortableContext>
              <DragOverlay>
                {draggedSection && (
                  <Card className="opacity-90 shadow-lg">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <h3 className="font-semibold">{draggedSection.title}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {draggedSection.questions.length} pregunta{draggedSection.questions.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                )}
              </DragOverlay>
            </DndContext>

            {localSections.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No hay secciones creadas</p>
                <Button onClick={handleAddSection} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primera sección
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button onClick={handleAddSection} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Sección
            </Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Sección</DialogTitle>
            <DialogDescription>Modifica el título y descripción de la sección.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título de la sección</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Ej: Datos Personales"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descripción (opcional)</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Descripción de la sección..."
                rows={3}
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
                  {localSections.map((section, index) => {
                    if (section.id === movingSection?.id) return null
                    return (
                      <SelectItem key={section.id} value={(index + 1).toString()}>
                        {moveMode === "exact" ? `Posición ${index + 1}` : `${index + 1}. ${section.title}`}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            {targetPosition && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  {moveMode === "exact" && `La sección se moverá a la posición ${targetPosition}.`}
                  {moveMode === "before" && `La sección se moverá antes de la posición ${targetPosition}.`}
                  {moveMode === "after" && `La sección se moverá después de la posición ${targetPosition}.`}
                </p>
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
