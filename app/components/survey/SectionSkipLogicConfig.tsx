"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ArrowRight } from "lucide-react"

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
  questions: any[]
  skipLogic?: SectionSkipLogic
  title_html?: string
}

interface SectionSkipLogicConfigProps {
  section: SurveySection
  allSections: SurveySection[]
  onSave: (skipLogic: SectionSkipLogic) => void
  onCancel: () => void
}

export function SectionSkipLogicConfig({ section, allSections, onSave, onCancel }: SectionSkipLogicConfigProps) {
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
