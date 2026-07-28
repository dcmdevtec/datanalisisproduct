"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, AlertTriangle, PlayCircle } from "lucide-react"

// Pantalla previa a TODAS las encuestas del portal (pptx slide 3). Si el
// encuestador selecciona un motivo, se registra como outcome='incidencia' y
// NUNCA se entra a las preguntas. Si elige "Inicia encuesta", se procede
// normal. Vive como wrapper antes del renderer, no dentro de él, para no
// acoplar esta lógica al motor de encuestas compartido con el flujo público.
export const INCIDENCE_REASONS = [
  "Vivienda cerrada",
  "Vivienda desocupada (se vende, se arrienda, lote)",
  "Señales de ocupación pero nadie atiende",
  "Atendieron, pero hubo rechazo",
  "Menor de edad sin adulto",
  "Negocio / local comercial",
  "Propiedad horizontal sin acceso",
  "Idioma / discapacidad / imposibilidad de encuesta",
  "No cumple cuota de género / edad",
  "Otro (especifique)",
] as const

interface IncidenceScreenProps {
  surveyTitle: string
  zoneName?: string | null
  onStartSurvey: () => void
  onReportIncidence: (reason: string) => Promise<void> | void
}

export function IncidenceScreen({ surveyTitle, zoneName, onStartSurvey, onReportIncidence }: IncidenceScreenProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [otherDetail, setOtherDetail] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const isOther = selected === "Otro (especifique)"
  const canSubmit = !!selected && (!isOther || otherDetail.trim().length > 0)

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      const reason = isOther ? `Otro: ${otherDetail.trim()}` : (selected as string)
      await onReportIncidence(reason)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-muted/30 p-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-lg">{surveyTitle}</CardTitle>
          {zoneName && <CardDescription>Zona: {zoneName}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-sm font-medium mb-1">¿Se puede realizar la encuesta?</p>
            <p className="text-xs text-muted-foreground">
              Si hay algún impedimento, selecciona el motivo antes de continuar. Si no hay ningún
              impedimento, pulsa &quot;Inicia encuesta&quot; sin seleccionar nada.
            </p>
          </div>

          <RadioGroup value={selected ?? ""} onValueChange={setSelected} className="gap-3">
            {INCIDENCE_REASONS.map((reason) => (
              <div key={reason} className="flex items-start gap-2">
                <RadioGroupItem value={reason} id={reason} className="mt-0.5" />
                <Label htmlFor={reason} className="font-normal text-sm leading-snug cursor-pointer">
                  {reason}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {isOther && (
            <Textarea
              placeholder="Especifica el motivo"
              value={otherDetail}
              onChange={(e) => setOtherDetail(e.target.value)}
              rows={3}
            />
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={onStartSurvey} disabled={submitting} className="w-full">
              <PlayCircle className="h-4 w-4 mr-2" />
              Inicia encuesta
            </Button>
            <Button
              variant="outline"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full text-amber-700 border-amber-300 hover:bg-amber-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4 mr-2" />
              )}
              Registrar incidencia
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
