"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Loader2, Copy, Check, ExternalLink, AlertCircle, Globe } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface ShareConfig {
  filters: {
    surveyorId?: string
    supervisorId?: string
    coordinatorId?: string
    dateFrom?: string
    dateTo?: string
    tipo?: string
  }
  sections: {
    resumen: boolean
    analisis: boolean
    rendimiento: boolean
  }
}

interface ShareReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedSurvey: string        // "all" or a specific survey UUID
  currentFilters: {
    surveyorId?: string
    supervisorId?: string
    coordinatorId?: string
    dateFrom?: string
    dateTo?: string
    tipo?: string
  }
}

const EXPIRY_OPTIONS = [
  { value: "never", label: "Nunca (permanente)" },
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "365", label: "1 año" },
]

export function ShareReportModal({ open, onOpenChange, selectedSurvey, currentFilters }: ShareReportModalProps) {
  const { toast } = useToast()
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)

  // Config state
  const [sections, setSections] = useState({
    resumen: true,
    analisis: true,
    rendimiento: false,
  })
  const [expiry, setExpiry] = useState<string>("never")

  const handleGenerate = async () => {
    if (!selectedSurvey || selectedSurvey === "all") return

    setGenerating(true)
    setGeneratedLink(null)

    try {
      const config: ShareConfig = {
        filters: currentFilters,
        sections,
      }

      const res = await fetch("/api/shared-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyId: selectedSurvey,
          config,
          expiryDays: expiry === "never" ? null : parseInt(expiry),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({ title: "Error", description: data.error || "No se pudo generar el link.", variant: "destructive" })
        return
      }

      const origin = typeof window !== "undefined" ? window.location.origin : ""
      setGeneratedLink(`${origin}/results/${data.token}`)
    } catch (err) {
      toast({ title: "Error", description: "Error de conexión al generar el link.", variant: "destructive" })
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!generatedLink) return
    try {
      await navigator.clipboard.writeText(generatedLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: "¡Copiado!", description: "El link fue copiado al portapapeles." })
    } catch {
      toast({ title: "No se pudo copiar", description: "Copia el link manualmente.", variant: "destructive" })
    }
  }

  const toggleSection = (key: keyof typeof sections) =>
    setSections((prev) => ({ ...prev, [key]: !prev[key] }))

  const noSurveySelected = !selectedSurvey || selectedSurvey === "all"
  const nothingSelected = !sections.resumen && !sections.analisis && !sections.rendimiento

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) { setGeneratedLink(null); setCopied(false) }
      onOpenChange(v)
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-[#18b0a4]" />
            Compartir reporte
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Survey warning */}
          {noSurveySelected && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Selecciona una encuesta específica en el filtro de Reportes antes de compartir.</span>
            </div>
          )}

          {/* Sections to share */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-3 block">¿Qué incluir en el reporte?</Label>
            <div className="space-y-3">
              {[
                { key: "resumen" as const, label: "Resumen", desc: "KPIs, totales y tendencia por día" },
                { key: "analisis" as const, label: "Análisis de resultados", desc: "Gráficas por pregunta" },
                { key: "rendimiento" as const, label: "Rendimiento", desc: "Tabla por encuestador" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                  </div>
                  <Switch
                    checked={sections[item.key]}
                    onCheckedChange={() => toggleSection(item.key)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Expiry */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Expiración del link</Label>
            <Select value={expiry} onValueChange={setExpiry}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Generated link */}
          {generatedLink && (
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Link generado</Label>
              <div className="flex gap-2">
                <Input
                  value={generatedLink}
                  readOnly
                  className="text-xs font-mono bg-gray-50 flex-1"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopy}
                  className="flex-shrink-0"
                  title="Copiar link"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="flex-shrink-0"
                  title="Abrir en nueva pestaña"
                  onClick={() => window.open(generatedLink, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Cualquier persona con este link puede ver el reporte sin iniciar sesión.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={noSurveySelected || nothingSelected || generating}
            className="bg-[#18b0a4] hover:bg-[#14918a] text-white"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generando...</>
            ) : (
              <><Globe className="h-4 w-4 mr-2" /> {generatedLink ? "Generar nuevo link" : "Generar link"}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
