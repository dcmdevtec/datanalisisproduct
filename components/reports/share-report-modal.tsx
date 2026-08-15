"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Loader2, Copy, Check, ExternalLink, AlertCircle, Globe, ChevronDown, ChevronUp } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface SurveyQuestion {
  id: string
  text: string
  type: string
  section_id: string | null
}

interface ShareReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedSurvey: string
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

  // UI state
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [questions, setQuestions] = useState<SurveyQuestion[]>([])
  const [showQuestionPicker, setShowQuestionPicker] = useState(false)

  // Config state
  const [sections, setSections] = useState({ resumen: true, analisis: true, rendimiento: false })
  const [expiry, setExpiry] = useState("never")
  // null = todas las preguntas, array = selección específica
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[] | null>(null)

  const noSurveySelected = !selectedSurvey || selectedSurvey === "all"
  const nothingSelected = !sections.resumen && !sections.analisis && !sections.rendimiento

  // Fetch questions when survey changes and modal is open
  useEffect(() => {
    if (!open || noSurveySelected || !sections.analisis) {
      setQuestions([])
      setSelectedQuestionIds(null)
      return
    }
    setLoadingQuestions(true)
    fetch(`/api/survey-questions?surveyId=${selectedSurvey}`)
      .then((r) => r.json())
      .then((data) => {
        const qs: SurveyQuestion[] = data.questions || []
        setQuestions(qs)
        // Por defecto todas seleccionadas (null = todas)
        setSelectedQuestionIds(null)
      })
      .catch(() => setQuestions([]))
      .finally(() => setLoadingQuestions(false))
  }, [open, selectedSurvey, sections.analisis, noSurveySelected])

  const handleToggleQuestion = (id: string) => {
    if (selectedQuestionIds === null) {
      // estaban todas → deseleccionar esta
      setSelectedQuestionIds(questions.map((q) => q.id).filter((qid) => qid !== id))
    } else if (selectedQuestionIds.includes(id)) {
      const next = selectedQuestionIds.filter((qid) => qid !== id)
      setSelectedQuestionIds(next.length === questions.length ? null : next)
    } else {
      const next = [...selectedQuestionIds, id]
      setSelectedQuestionIds(next.length === questions.length ? null : next)
    }
  }

  const isQuestionSelected = (id: string) =>
    selectedQuestionIds === null || selectedQuestionIds.includes(id)

  const selectedCount = selectedQuestionIds === null ? questions.length : selectedQuestionIds.length

  const handleSelectAll = () => setSelectedQuestionIds(null)
  const handleSelectNone = () => setSelectedQuestionIds([])

  const handleGenerate = async () => {
    if (noSurveySelected) return
    setGenerating(true)
    setGeneratedLink(null)
    try {
      const config = {
        filters: currentFilters,
        sections,
        // Si null → la API incluye todas; si array → solo las seleccionadas
        questionIds: selectedQuestionIds,
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
    } catch {
      toast({ title: "Error", description: "Error de conexión.", variant: "destructive" })
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

  const handleClose = (v: boolean) => {
    if (!v) { setGeneratedLink(null); setCopied(false); setShowQuestionPicker(false) }
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-[#18b0a4]" />
            Compartir reporte
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Genera un link público que cualquier persona puede abrir sin iniciar sesión.
          </p>
        </DialogHeader>

        <div className="space-y-5 py-1">

          {/* Warning: no survey */}
          {noSurveySelected && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              Selecciona una encuesta específica en el filtro de Reportes antes de compartir.
            </div>
          )}

          {/* Sections */}
          <div>
            <Label className="text-sm font-semibold text-gray-800 mb-3 block">¿Qué secciones incluir?</Label>
            <div className="space-y-3">

              {/* Resumen */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Resumen general</p>
                  <p className="text-xs text-gray-400">Totales, KPIs, efectivas, tendencia diaria</p>
                </div>
                <Switch
                  checked={sections.resumen}
                  onCheckedChange={(v) => setSections((p) => ({ ...p, resumen: v }))}
                />
              </div>

              {/* Análisis */}
              <div className="border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Análisis de resultados</p>
                    <p className="text-xs text-gray-400">
                      {sections.analisis
                        ? loadingQuestions
                          ? "Cargando preguntas..."
                          : `Gráficas de ${selectedCount} de ${questions.length} preguntas`
                        : "Gráficas por pregunta"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {sections.analisis && questions.length > 0 && (
                      <button
                        onClick={() => setShowQuestionPicker((v) => !v)}
                        className="text-xs text-[#18b0a4] hover:underline flex items-center gap-0.5"
                      >
                        Elegir
                        {showQuestionPicker ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    )}
                    <Switch
                      checked={sections.analisis}
                      onCheckedChange={(v) => {
                        setSections((p) => ({ ...p, analisis: v }))
                        if (!v) setShowQuestionPicker(false)
                      }}
                    />
                  </div>
                </div>

                {/* Question picker */}
                {sections.analisis && showQuestionPicker && (
                  <div className="border-t bg-gray-50 px-3 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600">
                        {selectedCount} de {questions.length} seleccionadas
                      </span>
                      <div className="flex gap-2">
                        <button onClick={handleSelectAll} className="text-xs text-[#18b0a4] hover:underline">Todas</button>
                        <span className="text-gray-300">·</span>
                        <button onClick={handleSelectNone} className="text-xs text-gray-400 hover:underline">Ninguna</button>
                      </div>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {loadingQuestions ? (
                        <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
                          <Loader2 className="h-3 w-3 animate-spin" /> Cargando...
                        </div>
                      ) : questions.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2">No hay preguntas con respuestas.</p>
                      ) : (
                        questions.map((q) => (
                          <label
                            key={q.id}
                            className="flex items-start gap-2.5 cursor-pointer group"
                          >
                            <Checkbox
                              checked={isQuestionSelected(q.id)}
                              onCheckedChange={() => handleToggleQuestion(q.id)}
                              className="mt-0.5 flex-shrink-0"
                            />
                            <span className="text-xs text-gray-700 group-hover:text-gray-900 leading-snug line-clamp-2">
                              {q.text || "Sin texto"}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Rendimiento */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Rendimiento por encuestador</p>
                  <p className="text-xs text-gray-400">Tabla con efectivas, incidencias, tasas</p>
                </div>
                <Switch
                  checked={sections.rendimiento}
                  onCheckedChange={(v) => setSections((p) => ({ ...p, rendimiento: v }))}
                />
              </div>
            </div>
          </div>

          {/* Expiry */}
          <div>
            <Label className="text-sm font-semibold text-gray-800 mb-1.5 block">Expiración del link</Label>
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
            <div className="bg-[#18b0a4]/5 border border-[#18b0a4]/20 rounded-xl p-3">
              <p className="text-xs font-medium text-[#18b0a4] mb-2">✓ Link generado</p>
              <div className="flex gap-2">
                <Input
                  value={generatedLink}
                  readOnly
                  className="text-xs font-mono bg-white flex-1"
                />
                <Button size="icon" variant="outline" onClick={handleCopy} title="Copiar">
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="outline" onClick={() => window.open(generatedLink, "_blank")} title="Abrir">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Accesible sin login · incluye {selectedCount} pregunta{selectedCount !== 1 ? "s" : ""}
                {expiry !== "never" && ` · expira en ${EXPIRY_OPTIONS.find(o => o.value === expiry)?.label}`}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)}>Cerrar</Button>
          <Button
            onClick={handleGenerate}
            disabled={noSurveySelected || nothingSelected || generating || (sections.analisis && selectedCount === 0)}
            className="bg-[#18b0a4] hover:bg-[#14918a] text-white"
          >
            {generating
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generando...</>
              : <><Globe className="h-4 w-4 mr-2" /> {generatedLink ? "Nuevo link" : "Generar link"}</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
