"use client"

import { useState, useEffect, type ChangeEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Loader2, Copy, Check, ExternalLink, AlertCircle,
  Globe, BarChart3, Users, ListChecks, Clock, Lock, Tag,
  Image as ImageIcon, X,
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
  const [expiry, setExpiry]         = useState("never")
  const [customTitle, setCustomTitle] = useState("")
  const [password, setPassword]     = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  // null = todas las preguntas seleccionadas
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null)

  const noSurveySelected = !selectedSurvey || selectedSurvey === "all"

  // Reunión 2026-08-27: "todo cambio que se haga debe reflejarse en el link
  // enviado" — si esta encuesta YA tiene un link creado por este usuario, se
  // precarga su configuración y "Generar link" pasa a ACTUALIZARLO (PATCH,
  // mismo token/URL) en vez de crear uno nuevo. `existingToken` es lo que
  // distingue ambos modos.
  const [existingToken, setExistingToken] = useState<string | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)

  useEffect(() => {
    if (!open || noSurveySelected) return
    let cancelled = false
    // Por si el modal cambia de encuesta sin cerrarse (poco común, pero
    // evita arrastrar el existingToken de la encuesta anterior si esta no
    // tiene link todavía).
    setExistingToken(null)
    setLoadingExisting(true)
    fetch("/api/shared-reports")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        const link = (json.links || []).find((l: any) => l.survey_id === selectedSurvey)
        if (!link) return
        const cfg = link.config || {}
        setExistingToken(link.token)
        if (cfg.sections) setSections(cfg.sections)
        setSelectedIds(
          Array.isArray(cfg.questionIds) ? new Set<string>(cfg.questionIds) : null,
        )
        setCustomTitle(cfg.customTitle || "")
        setPreviewImageUrl(cfg.imageUrl || null)
        const origin = typeof window !== "undefined" ? window.location.origin : ""
        setGeneratedLink(`${origin}/results/${link.token}`)
      })
      .catch(() => { /* si falla la precarga, el modal simplemente ofrece crear un link nuevo */ })
      .finally(() => { if (!cancelled) setLoadingExisting(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedSurvey])

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

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/shared-reports/upload-image", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "No se pudo subir la imagen", description: data.error || "Intenta de nuevo.", variant: "destructive" })
        return
      }
      setPreviewImageUrl(data.url)
    } catch {
      toast({ title: "Error de conexión", description: "No se pudo subir la imagen.", variant: "destructive" })
    } finally {
      setUploadingImage(false)
    }
  }

  const handleGenerate = async () => {
    if (noSurveySelected) return
    setGenerating(true)
    setGeneratedLink(null)
    try {
      // "null" acá dentro del modal significa "todas las de `questions`" (el
      // set con el que se abrió el modal — ya viene acotado por el padre a lo
      // que el usuario armó en "Análisis de resultados"). Server-side, en
      // cambio, questionIds=null significa "sin restricción: todas las
      // preguntas de la encuesta" — enviar null ahí ignoraba la selección
      // guardada y el link compartido mostraba TODO. Se manda siempre la
      // lista explícita de `questions` (o el subset marcado) para que ambos
      // lados coincidan.
      const questionIds =
        sections.analisis
          ? (selectedIds === null ? questions.map((q) => q.questionId) : [...selectedIds])
          : null

      const isUpdate = !!existingToken
      const res = await fetch(
        isUpdate ? `/api/shared-reports?token=${existingToken}` : "/api/shared-reports",
        {
          method: isUpdate ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            surveyId: selectedSurvey,
            config: { filters: currentFilters, sections, questionIds },
            expiryDays: expiry === "never" ? null : parseInt(expiry),
            customTitle: customTitle.trim() || null,
            imageUrl: previewImageUrl,
            password: password.trim() || null,
          }),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Error", description: data.error || "No se pudo guardar el link.", variant: "destructive" })
        return
      }
      const origin = typeof window !== "undefined" ? window.location.origin : ""
      setGeneratedLink(`${origin}/results/${data.token}`)
      if (isUpdate) {
        toast({ title: "Link actualizado", description: "Los cambios ya se reflejan en el link que enviaste." })
      } else {
        setExistingToken(data.token)
      }
    } catch {
      toast({ title: "Error de conexión", description: "Intenta de nuevo.", variant: "destructive" })
    } finally {
      setGenerating(false)
    }
  }

  // Descarta la precarga y vuelve al modo "crear un link nuevo" (nueva URL,
  // no toca el link existente).
  const handleStartNewLink = () => {
    setExistingToken(null)
    setGeneratedLink(null)
    setCustomTitle("")
    setPreviewImageUrl(null)
    setSelectedIds(null)
    setPassword("")
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
    if (!v) {
      setGeneratedLink(null)
      setCopied(false)
      setPreviewImageUrl(null)
      setCustomTitle("")
      setExistingToken(null)
    }
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

          {/* ── Título personalizado ── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" /> Título del reporte (opcional)
            </p>
            <Input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Ej: Resultados Q3 2026 — Equipo Norte"
              className="text-sm"
            />
          </div>

          {/* ── Imagen de vista previa (rich preview / Open Graph) ── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" /> Imagen de vista previa (opcional)
            </p>
            <p className="text-xs text-muted-foreground -mt-1">
              Se muestra junto con el título cuando alguien pega el link en WhatsApp, Slack, etc.
            </p>
            <div className="flex items-center gap-3">
              {previewImageUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewImageUrl} alt="" className="h-16 w-28 object-cover rounded-lg border" />
                  <button
                    onClick={() => setPreviewImageUrl(null)}
                    className="absolute -top-1.5 -right-1.5 bg-background border rounded-full p-0.5 shadow-sm hover:bg-muted"
                    title="Quitar imagen"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 border border-dashed rounded-lg px-3 py-2 text-xs text-muted-foreground cursor-pointer hover:bg-muted/40 transition-colors">
                  {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                  {uploadingImage ? "Subiendo..." : "Elegir imagen (JPG/PNG, máx 5MB)"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploadingImage}
                    onChange={handleImageSelect}
                  />
                </label>
              )}
            </div>
          </div>

          {/* ── Contraseña ── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Contraseña (opcional)
            </p>
            <div className="flex gap-2">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Dejar vacío para acceso libre"
                className="text-sm flex-1"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="px-3 rounded-lg border text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                {showPassword ? "Ocultar" : "Ver"}
              </button>
            </div>
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

          {/* ── Link ya existente para esta encuesta ── */}
          {existingToken && !generatedLink && loadingExisting && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando un link ya creado para esta encuesta…
            </div>
          )}
          {existingToken && (
            <div className="flex items-start gap-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p>Ya existe un link para esta encuesta — se precargó su configuración. "Guardar cambios" actualiza <strong>ese mismo link</strong> (misma URL), no crea uno nuevo.</p>
                <button onClick={handleStartNewLink} className="text-xs font-medium underline mt-1">
                  Crear un link nuevo en su lugar
                </button>
              </div>
            </div>
          )}

          {/* ── Link generado ── */}
          {generatedLink && (
            <div className="rounded-xl border border-[#18b0a4]/30 bg-[#18b0a4]/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#18b0a4] animate-pulse" />
                <p className="text-sm font-semibold text-[#18b0a4]">{existingToken ? "Link" : "Link listo"}</p>
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
              <><Loader2 className="h-4 w-4 animate-spin" /> {existingToken ? "Guardando…" : "Generando…"}</>
            ) : (
              <><Globe className="h-4 w-4" /> {existingToken ? "Guardar cambios" : "Generar link"}</>
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
