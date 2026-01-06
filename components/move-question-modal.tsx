"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowUpDown, ArrowRight } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

// Utility: strip HTML tags safely
function stripHtml(html?: string | null): string {
  if (!html) return "";
  try {
    const tmp = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (tmp) {
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || "";
    }
  } catch (e) {
    return html.replace(/<[^>]*>/g, "");
  }
  return html.replace(/<[^>]*>/g, "");
}

interface Question {
  id: string
  type: string
  text: string
  text_html?: string
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
  title_html?: string
  description?: string
  order_num: number
  questions: Question[]
}

interface MoveQuestionModalProps {
  isOpen: boolean
  onClose: () => void
  question: Question | null
  currentSectionId: string
  sections: SurveySection[]
  onMoveQuestion: (questionId: string, fromSectionId: string, toSectionId: string, targetIndex: number) => void
}

export function MoveQuestionModal({
  isOpen,
  onClose,
  question,
  currentSectionId,
  sections,
  onMoveQuestion
}: MoveQuestionModalProps) {
  const { toast } = useToast()
  
  const [targetSectionId, setTargetSectionId] = useState<string>("")
  const [targetQuestionPosition, setTargetQuestionPosition] = useState<string>("")
  const [questionMoveMode, setQuestionMoveMode] = useState<"before" | "after" | "end">("after")
  const [moveToAnotherSection, setMoveToAnotherSection] = useState(false)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setTargetSectionId(currentSectionId)
      setTargetQuestionPosition("")
      setQuestionMoveMode("after")
      setMoveToAnotherSection(false)
    }
  }, [isOpen, currentSectionId])

  const handleMove = () => {
    if (!question || !targetSectionId) return

    const targetSection = sections.find(s => s.id === targetSectionId)
    if (!targetSection) return

    let targetIndex: number

    if (questionMoveMode === "end") {
      targetIndex = targetSection.questions.length
    } else {
      const referenceQuestionIndex = Number(targetQuestionPosition)
      if (questionMoveMode === "before") {
        targetIndex = referenceQuestionIndex
      } else { // after
        targetIndex = referenceQuestionIndex + 1
      }
    }

    onMoveQuestion(question.id, currentSectionId, targetSectionId, targetIndex)

    toast({
      title: "Pregunta movida",
      description: "La pregunta se ha movido correctamente a su nueva posición.",
    })

    onClose()
  }

  const currentSection = sections.find(s => s.id === currentSectionId)
  const targetSection = sections.find(s => s.id === targetSectionId)
  const isSameSection = targetSectionId === currentSectionId
  
  // Get questions for position selection (exclude the question being moved)
  const availableQuestions = targetSection?.questions.filter(q => q.id !== question?.id) || []

  if (!question || !currentSection) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Mover Pregunta
          </DialogTitle>
          <DialogDescription>
            Mueve la pregunta a una nueva posición dentro de la misma sección o a otra sección.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Pregunta a mover */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2 text-sm">Pregunta a mover:</h4>
            <p className="text-sm text-muted-foreground">
              {stripHtml(question.text_html || question.text) || "Pregunta sin título"}
            </p>
          </div>

          {/* Selector de sección destino */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Sección destino</label>
            <Select value={targetSectionId} onValueChange={(value) => {
              setTargetSectionId(value)
              setTargetQuestionPosition("")
              setMoveToAnotherSection(value !== currentSectionId)
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    <div className="flex items-center gap-2">
                      <span>{stripHtml(section.title_html || section.title) || "Sección sin título"}</span>
                      {section.id === currentSectionId && (
                        <Badge variant="outline" className="text-xs">actual</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Modo de posicionamiento */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Posición</label>
            <Select value={questionMoveMode} onValueChange={(value: "before" | "after" | "end") => {
              setQuestionMoveMode(value)
              if (value === "end") {
                setTargetQuestionPosition("")
              }
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="end">Al final de la sección</SelectItem>
                {availableQuestions.length > 0 && (
                  <>
                    <SelectItem value="before">Antes de una pregunta específica</SelectItem>
                    <SelectItem value="after">Después de una pregunta específica</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Selector de pregunta de referencia */}
          {questionMoveMode !== "end" && availableQuestions.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Pregunta de referencia
              </label>
              <Select value={targetQuestionPosition} onValueChange={setTargetQuestionPosition}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una pregunta" />
                </SelectTrigger>
                <SelectContent>
                  {availableQuestions.map((q, index) => (
                    <SelectItem key={q.id} value={index.toString()}>
                      <div className="text-left">
                        <div className="font-medium">
                          {stripHtml(q.text_html || q.text).substring(0, 40)}
                          {stripHtml(q.text_html || q.text).length > 40 ? "..." : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Tipo: {q.type} • Posición: {index + 1}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {availableQuestions.length === 0 && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  {targetSection?.questions.length === 1 ? 
                    "Esta sección solo tiene una pregunta. La pregunta se moverá al final." :
                    "No hay preguntas disponibles como referencia en la sección destino."
                  }
                </div>
              )}
            </div>
          )}

          {/* Vista previa del movimiento */}
          {targetSectionId && (questionMoveMode === "end" || targetQuestionPosition !== "") && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium mb-2 text-blue-800">Vista previa del movimiento:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">De:</span>
                  <Badge variant="outline">{stripHtml(currentSection.title_html || currentSection.title)}</Badge>
                  <ArrowRight className="h-3 w-3 text-blue-600" />
                  <Badge variant="default">{stripHtml(targetSection?.title_html || targetSection?.title || "Sección destino")}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">Posición:</span>
                  <Badge variant="secondary">
                    {(() => {
                      if (questionMoveMode === "end") return "Al final de la sección";
                      const referenceQuestion = availableQuestions[Number(targetQuestionPosition)];
                      const referenceText = stripHtml(referenceQuestion?.text_html || referenceQuestion?.text) || `Pregunta ${Number(targetQuestionPosition) + 1}`;
                      return `${questionMoveMode === "before" ? "Antes" : "Después"} de: ${referenceText.substring(0, 30)}${referenceText.length > 30 ? "..." : ""}`;
                    })()}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button onClick={onClose} variant="outline">
            Cancelar
          </Button>
          <Button 
            onClick={handleMove} 
            disabled={!targetSectionId || (questionMoveMode !== "end" && !targetQuestionPosition)} 
            className="gap-2"
          >
            <ArrowUpDown className="h-4 w-4" />
            Mover Pregunta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}