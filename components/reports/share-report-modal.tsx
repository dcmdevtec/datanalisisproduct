"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Loader2, Copy, Check, ExternalLink, AlertCircle,
  Globe, BarChart3, Users, ListChecks, Clock,
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export interface ShareQuestion {
  questionId: string
  text: string
  type: string
  totalAnswers: number
}

interface ShareReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedSurvey: string
  questions: ShareQuestion[]
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
  { value: "never", label: "Sin expiración" },
  { value: "7",     label: "7 días" },
  { value: "30",    label: "30 días" },
  { value: "365",   label: "1 año" },
]

export function ShareReportModal({
  open, onOpenChange, selectedSurvey, questions, currentFilters,
}: ShareReportModalProps) {
  const { toast } = useToast()

  const [generating, setGenerating] = useState(false)
  const [copied, setCopied]         = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)

  const [sections, setSections] = useState({
    resumen:     true,
    analisis:    true,
    rendimiento: false,
  })
  const [expiry, setExpiry] = useState("never")

  // null = todas las preguntas seleccionadas
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null)

  const noSurveySelected = !selectedSurvey || selectedSurvey === "all"

  const isSelected = (id: string) => selectedIds === null || selectedIds.has(id)

  const toggleQuestion = (id: string) => {
    if (selectedIds === null) {
      // todas → desmarcar esta
      const next = new Set(questions.map((q) => q.questionId))
      next.delete(id)
      setSelectedIds(next)
    } else {
      const next = new Set(selectedIds)
      if (next.has(id)) {
        next.delete(id)
        setSelectedIds(next)
      } else {
        next.add(id)
        if (next.size === questions.length) setSelectedIds(null) // volvemos a "todas"
        else setSelectedIds(next)
      }
    }
  }

  const selectAll  = () => setSelectedIds(null)
  const selectNone = () => setSelectedIds(new Set())

  const selectedCount = selectedIds === null ? questions.length : selectedIds.size

  const nothingSelected =
    !sections.resumen && !sections.analisis && !sections.rendimiento

  const handleGenerate = async () => {
    if (noSurveySelected) return
    setGenerating(true)
    setGeneratedLink(null)
    try {
      const questionIds =
        sections.analisis
          ? selectedIds === null
            ? null
            : [...selectedIds]
          : null

      const res = await fetch("/api/shared-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyId: selectedSurvey,
          config: { filters: currentFilters, sections, questionIds },
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
      toast({ title: "Error de conexión", description: "Intenta de nuevo.", variant: "destructive" })
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
      toast({ title: "Copiado", description: "Link copiado al portapapeles." })
    } catch {
      toast({ title: "No se pudo copiar", description: "Copia el link manualmente.", variant: "destructive" })
    }
  }

  const handleClose = (v: boolean) => {
    if (!v) { setGeneratedLink(null); setCopied(false) }
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">

        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-[#18b0a4]" />
            Compartir reporte
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Genera un link público. Quien lo abra ve el reporte sin iniciar sesión.
          </p>
        </DialogHeader>

        {/* ── Body (scrollable) ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Aviso encuesta no seleccionada */}
          {noSurveySelected && (
            <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Selecciona una <strong>encuesta específica</strong> en el filtro de Reportes antes de compartir.</span>
            </div>
          )}

          {/* ── Secciones ── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">¿Qué incluir?</p>

            {/* Resumen */}
            <SectionRow
              icon={<BarChart3 className="h-4 w-4" />}
              title="Resumen general"
              description="KPIs, efectivas, tendencia diaria"
              checked={sections.resumen}
              onChange={(v) => setSections((p) => ({ ...p, resumen: v }))}
            />

            {/* Análisis */}
            <SectionRow
              icon={<ListChecks className="h-4 w-4" />}
              title="Análisis de resultados"
              description={
                sections.analisis && questions.length > 0
                  ? `${selectedCount} de ${questions.length} pregunta${questions.length !== 1 ? "s" : ""} seleccionada${selectedCount !== 1 ? "s" : ""}`
                  : "Gráficas por pregunta"
              }
              checked={sections.analisis}
              onChange={(v) => setSections((p) => ({ ...p, analisis: v }))}
            >
              {sections.analisis && questions.length > 0 && (
                <div className="mt-3 rounded-xl border bg-muted/30 overflow-hidden">
                  {/* Barra de control */}
                  <div className="flex items-center justify-between px-3 py-2 border-b bg-background/60">
                    <span className="text-xs text-muted-foreground">
                      {selectedCount === questions.length ? "Todas seleccionadas" : `${selectedCount} seleccionadas`}
                    </span>
                    <div className="flex gap-3">
                      <button
                        onClick={selectAll}
                        className="text-xs text-[#18b0a4] hover:underline font-medium"
                      >
                        Seleccionar todas
                      </button>
                      <span className="text-muted-foreground/40">·</span>
                      <button
                        onClick={selectNone}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        Ninguna
                      </button>
                    </div>
                  </div>

                  {/* Lista de preguntas */}
                  <div className="divide-y max-h-52 overflow-y-auto">
                    {questions.map((q) => {
                      const checked = isSelected(q.questionId)
                      return (
                        <label
                          key={q.questionId}
                          className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                            checked
                              ? "bg-[#18b0a4]/5 hover:bg-[#18b0a4]/10"
                              : "hover:bg-muted/40"
                          }`}
                        >
                          {/* Checkbox visual */}
                          <div
                            className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                              checked
                                ? "bg-[#18b0a4] border-[#18b0a4]"
                                : "border-border bg-background"
                            }`}
                            onClick={() => toggleQuestion(q.questionId)}
                          >
                            {checked && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                                <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0" onClick={() => toggleQuestion(q.questionId)}>
                            <p className={`text-sm leading-snug line-clamp-2 ${checked ? "text-foreground" : "text-muted-foreground"}`}>
                              {q.text || "Sin texto"}
                            </p>
                            <p className="text-xs text-muted-foreground/60 mt-0.5">
                              {q.totalAnswers} respuesta{q.totalAnswers !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {sections.analisis && questions.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2 px-1">
                  No hay preguntas con respuestas para esta encuesta con los filtros actuales.
                </p>
              )}
            </SectionRow>

            {/* Rendimiento */}
            <SectionRow
              icon={<Users className="h-4 w-4" />}
              title="Rendimiento por encuestador"
              description="Tabla con efectivas, incidencias y tasas"
              checked={sections.rendimiento}
              onChange={(v) => setSections((p) => ({ ...p, rendimiento: v }))}
            />
          </div>

          {/* ── Expiración ── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Expiración del link
            </p>
            <div className="grid grid-cols-4 gap-2">
              {EXPIRY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setExpiry(opt.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    expiry === opt.value
                      ? "bg-[#18b0a4] text-white border-[#18b0a4]"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Link generado ── */}
          {generatedLink && (
            <div className="rounded-xl border border-[#18b0a4]/30 bg-[#18b0a4]/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#18b0a4] animate-pulse" />
                <p className="text-sm font-semibold text-[#18b0a4]">Link listo</p>
                <span className="text-xs text-muted-foreground">
                  · {selectedCount} pregunta{selectedCount !== 1 ? "s" : ""}
                  {expiry !== "never" ? ` · expira en ${EXPIRY_OPTIONS.find((o) => o.value === expiry)?.label}` : " · sin expiración"}
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  value={generatedLink}
                  readOnly
                  className="text-xs font-mono bg-white dark:bg-black/30 flex-1 h-9"
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 shrink-0"
                  onClick={handleCopy}
                  title="Copiar"
                >
                  {copied
                    ? <Check className="h-4 w-4 text-emerald-500" />
                    : <Copy className="h-4 w-4" />
                  }
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 shrink-0"
                  onClick={() => window.open(generatedLink, "_blank")}
                  title="Abrir"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-between shrink-0">
          <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>
            Cerrar
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={
              noSurveySelected ||
              nothingSelected ||
              generating ||
              (sections.analisis && questions.length > 0 && selectedCount === 0)
            }
            className="bg-[#18b0a4] hover:bg-[#14918a] text-white gap-2"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generando…</>
            ) : (
              <><Globe className="h-4 w-4" /> {generatedLink ? "Nuevo link" : "Generar link"}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ── Subcomponente SectionRow ── */
interface SectionRowProps {
  icon: React.ReactNode
  title: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  children?: React.ReactNode
}

function SectionRow({ icon, title, description, checked, onChange, children }: SectionRowProps) {
  return (
    <div
      className={`rounded-xl border transition-all ${
        checked
          ? "border-[#18b0a4]/30 bg-[#18b0a4]/5"
          : "border-border bg-background"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className={`p-1.5 rounded-lg flex-shrink-0 ${
            checked
              ? "bg-[#18b0a4]/10 text-[#18b0a4]"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${checked ? "text-foreground" : "text-muted-foreground"}`}>
            {title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
        </div>
        <Switch
          checked={checked}
          onCheckedChange={onChange}
          className="shrink-0"
        />
      </div>
      {children && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}
