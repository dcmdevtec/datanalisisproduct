"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowUpDown, GripVertical, Plus, Trash2, Copy, Edit3, Save, Hash, ArrowDown, ArrowUp } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { generateUUID } from "@/lib/utils"
import { RichTextEditor } from "@/components/rich-text-editor"

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

interface SortableSectionCardProps {
  section: SurveySection
  index: number
  totalSections: number
  onEdit: (section: SurveySection) => void
  onDuplicate: (section: SurveySection) => void
  onDelete: (sectionId: string) => void
  onMoveToPosition: (sectionId: string) => void
  selectedQuestions: Set<string>
  onQuestionSelect: (e: React.MouseEvent, section: SurveySection, question: Question) => void
  onQuestionMove: (question: Question, sectionId: string, currentIndex: number) => void
  allSections: SurveySection[]
}

function SortableSectionCard({
  section,
  index,
  totalSections,
  onEdit,
  onDuplicate,
  onDelete,
  onMoveToPosition,
  selectedQuestions,
  onQuestionSelect,
  onQuestionMove,
  allSections,
}: SortableSectionCardProps) {
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
    <div className="mb-4">
      <Card className="transition-all duration-200 hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    Posición {index + 1}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {section.questions.length} pregunta{section.questions.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                {/* Utilidad robusta para limpiar etiquetas HTML */}
                <>
                  {/* Mostrar HTML estilado si existe, si no mostrar texto plano */}
                  <div
                    className="font-semibold text-lg"
                    dangerouslySetInnerHTML={{ __html: section.title_html || stripHtml(section.title) || `Sección ${index + 1}` }}
                  />
                  {section.description && <p className="text-sm text-muted-foreground mt-1">{stripHtml(section.description)}</p>}
                </>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onMoveToPosition(section.id)} className="gap-1 h-8">
                <Hash className="h-4 w-4" />
                <span>Mover</span>
              </Button>
              <div className="flex gap-1">
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
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {section.questions.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Preguntas:</h4>
              <div className="grid gap-2 p-2 rounded-lg">
                {section.questions.map((question, qIndex) => {
                  return (
                    <div
                      key={`${section.id}-${question.id}`}
                      className={`flex items-center gap-2 p-2 bg-white border shadow-sm rounded-lg text-sm transition-all cursor-pointer
                        ${selectedQuestions.has(`${section.id}-${question.id}`) ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}`}
                      onClick={(e) => onQuestionSelect(e, section, question)}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <span className="text-lg">{getQuestionTypeIcon(question.type)}</span>
                        <span className="truncate flex-1">
                          {stripHtml(question.text) || `Pregunta ${qIndex + 1}`}
                        </span>
                        {question.required && (
                          <Badge variant="destructive" className="text-xs mr-2">
                            Obligatorio
                          </Badge>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onQuestionMove(question, section.id, qIndex);
                          }}
                          className="gap-1 h-7 px-2"
                        >
                          <Hash className="h-3 w-3" />
                          <span className="text-xs">Mover</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 border-2 border-dashed rounded-lg border-muted">
              <p className="text-sm text-muted-foreground">No hay preguntas en esta sección</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function SectionOrganizer({ isOpen, onClose, sections, onSectionsChange }: SectionOrganizerProps) {
  const { toast } = useToast()
  const [localSections, setLocalSections] = useState<SurveySection[]>([])
  const [editingSection, setEditingSection] = useState<SurveySection | null>(null)
  const [editTitle, setEditTitle] = useState("")

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
      setEditTitle(editingSection.title_html ?? editingSection.title ?? "")
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
    setEditTitle(section.title_html || section.title)
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
        newConfig.displayLogic.conditions = newConfig.displayLogic.conditions.map(condition => ({
          ...condition,
          questionId: idMap.get(condition.questionId) || condition.questionId
        }));
      }

      // Update references in skip logic
      if (newConfig?.skipLogic?.rules) {
        newConfig.skipLogic.rules = newConfig.skipLogic.rules.map(rule => ({
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
    const baseTitle = section.title_html ? stripHtml(section.title_html) : section.title
    const newTitleText = `${baseTitle} (Copia)`
    const newTitleHtml = `<h1>${newTitleText}</h1>`

    const newSection: SurveySection = {
      ...section,
      id: generateUUID(),
      title: newTitleText,
      title_html: newTitleHtml,
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
      title_html: `<h1>Nueva Sección ${localSections.length + 1}</h1>`,
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
    // No llamar a onClose aquí, ya que se maneja en onOpenChange
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
  <Dialog open={isOpen} onOpenChange={open => { if (!open) handleCancel(); }}>
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
                selectedQuestions={selectedQuestions}
                onQuestionSelect={(e, section, question) => {
                  if (e.ctrlKey || e.metaKey) {
                    // Toggle individual selection
                    const questionKey = `${section.id}-${question.id}`;
                    const newSelected = new Set(selectedQuestions);
                    if (newSelected.has(questionKey)) {
                      newSelected.delete(questionKey);
                    } else {
                      newSelected.add(questionKey);
                    }
                    setSelectedQuestions(newSelected);
                  } else if (e.shiftKey && selectedQuestions.size > 0) {
                    // Range selection
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
                    // Single selection
                    setSelectedQuestions(new Set([`${section.id}-${question.id}`]));
                  }
                }}
                onQuestionMove={(question, sectionId, currentIndex) => {
                  setMovingQuestion({ question, sectionId, currentIndex });
                  setBulkMoveSection({
                    fromSectionId: sectionId,
                    toSectionId: sectionId // Default to same section
                  });
                  setTargetQuestionPosition("");
                  setQuestionMoveMode("after");
                }}
                allSections={localSections}
              />
            ))}

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
              <RichTextEditor
                value={editTitle}
                onChange={setEditTitle}
                placeholder="Ej: Datos Personales"
                compact={true}
                className="min-h-[60px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descripción (opcional)</label>
              <RichTextEditor
                value={editDescription}
                onChange={setEditDescription}
                placeholder="Descripción de la sección..."
                className="min-h-[120px]"
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

   
      <Dialog open={!!movingQuestion} onOpenChange={() => setMovingQuestion(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Mover Pregunta
            </DialogTitle>
            <DialogDescription>
              Selecciona la sección destino y la posición específica donde quieres mover la pregunta
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

            {/* Target section selection */}
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
                  {localSections.map((section) => (
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

            {/* Position selection mode */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Tipo de posicionamiento</label>
              <Select value={questionMoveMode} onValueChange={(value: "before" | "after" | "end") => setQuestionMoveMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">
                    <div className="flex items-center gap-2"><ArrowUp className="h-4 w-4" />Antes de una pregunta específica</div>
                  </SelectItem>
                  <SelectItem value="after">
                    <div className="flex items-center gap-2"><ArrowDown className="h-4 w-4" />Después de una pregunta específica</div>
                  </SelectItem>
                  <SelectItem value="end">
                    <div className="flex items-center gap-2"><Plus className="h-4 w-4" />Al final de la sección</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Question position selection (only if not "end") */}
            {questionMoveMode !== "end" && bulkMoveSection && (
              <div className="space-y-3">
                <label className="text-sm font-medium">Selecciona la pregunta de referencia</label>
                <Select value={targetQuestionPosition} onValueChange={setTargetQuestionPosition}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una pregunta..." />
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
            }} variant="outline">Cancelar</Button>
            <Button onClick={handleQuestionMove} disabled={!bulkMoveSection || (questionMoveMode !== "end" && !targetQuestionPosition)} className="gap-2">
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
                  {localSections.map((section, index) => {
                    if (section.id === movingSection?.id) return null
                    return (
                      <SelectItem key={section.id} value={(index + 1).toString()}>
                        {moveMode === "exact" ? `Posición ${index + 1}` : `${index + 1}. ${stripHtml(section.title)}`}
                      </SelectItem>
                    )
                  })}
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