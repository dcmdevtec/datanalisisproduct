"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

// Tipos replicados de la página principal para claridad
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
  questions: any[] // No necesitamos el detalle de las preguntas aquí
  skipLogic?: SectionSkipLogic
}

interface SectionSkipLogicConfigProps {
  section: SurveySection
  allSections: SurveySection[]
  onSave: (skipLogic: SectionSkipLogic) => void
  onCancel: () => void
}

export function SectionSkipLogicConfig({
  section,
  allSections,
  onSave,
  onCancel,
}: SectionSkipLogicConfigProps) {
  const [action, setAction] = useState<SectionSkipLogic["action"]>(
    section.skipLogic?.action || "next_section"
  )
  const [targetSectionId, setTargetSectionId] = useState<string | undefined>(
    section.skipLogic?.targetSectionId
  )

  useEffect(() => {
    // Si la acción no es 'specific_section', limpiar el target
    if (action !== "specific_section") {
      setTargetSectionId(undefined)
    }
  }, [action])

  const handleSave = () => {
    const newSkipLogic: SectionSkipLogic = {
      enabled: true,
      action,
      targetSectionId: action === "specific_section" ? targetSectionId : undefined,
    }
    onSave(newSkipLogic)
  }

  return (
    <div className="space-y-6 p-4">
      <p className="text-sm text-muted-foreground">
        Define qué sucederá después de que un encuestado complete esta sección.
        Por defecto, continuará a la siguiente sección en orden.
      </p>

      <RadioGroup value={action} onValueChange={(value) => setAction(value as SectionSkipLogic["action"])} className="space-y-4">
        <div className="flex items-center space-x-3">
          <RadioGroupItem value="next_section" id="next_section" />
          <Label htmlFor="next_section" className="font-normal">
            <span className="font-semibold">Continuar a la siguiente sección</span>
            <p className="text-xs text-muted-foreground">Comportamiento por defecto.</p>
          </Label>
        </div>

        <div className="flex items-center space-x-3">
          <RadioGroupItem value="specific_section" id="specific_section" />
          <Label htmlFor="specific_section" className="font-normal">
            <span className="font-semibold">Saltar a una sección específica</span>
             <p className="text-xs text-muted-foreground">Redirigir al encuestado a otra sección.</p>
          </Label>
        </div>

        {action === "specific_section" && (
          <div className="pl-8">
            <Select value={targetSectionId} onValueChange={setTargetSectionId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona una sección de destino..." />
              </SelectTrigger>
              <SelectContent>
                {allSections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title || `Sección ${s.order_num + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center space-x-3">
          <RadioGroupItem value="end_survey" id="end_survey" />
          <Label htmlFor="end_survey" className="font-normal">
            <span className="font-semibold">Finalizar la encuesta</span>
            <p className="text-xs text-muted-foreground">Marcar la encuesta como completada.</p>
          </Label>
        </div>
      </RadioGroup>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={action === "specific_section" && !targetSectionId}>
          Guardar Lógica
        </Button>
      </div>
    </div>
  )
}
