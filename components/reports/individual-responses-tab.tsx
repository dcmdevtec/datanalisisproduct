"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatPercent } from "@/lib/format"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Loader2, User, Clock, ChevronLeft, ChevronRight, FileAudio, Download,
  AlertCircle, Trash2, Search, MapPin, CheckCircle2, Circle, FileImage,
  FileText, X, ClipboardList, Paperclip, Mail, Check, Pencil, Save
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

// ─── Pestaña "Respuestas Individuales" — Rediseño Char UX ───────────────────
// Lista paginada con encuesta visible + detalle como Sheet lateral full-height.
// Maneja encuestas con muchas preguntas sin perder contexto del encabezado.
// ────────────────────────────────────────────────────────────────────────────

interface ListItem {
  id: string
  surveyId: string
  surveyTitle: string
  surveyorName: string | null
  surveyorEmail: string | null
  respondentName: string | null
  createdAt: string
  startedAt?: string | null
  completedAt: string | null
  durationSecs: number | null
  status: string
  outcome: "efectiva" | "incidencia" | "abandonada"
  incidenceType: string | null
  hasLocation: boolean
  ciudad?: string | null
  barrio?: string | null
}

interface DetailQuestion {
  questionId: string
  text: string
  type: string
  answer: string
  rawAnswer?: any
  matrixRows?: string[] | null
  matrixCols?: string[] | null
  audioUrl: string | null
  fileUrls?: { name: string; url: string | null; type: string; path?: string }[]
  answerId?: string
}

interface DetailResponse {
  id: string
  surveyTitle: string
  surveyorName: string | null
  surveyorEmail: string | null
  respondentName: string | null
  respondentContact?: { email?: string; phone?: string; documentType?: string; documentNumber?: string } | null
  createdAt: string
  completedAt: string | null
  durationSecs: number | null
  outcome: "efectiva" | "incidencia" | "abandonada"
  incidenceType: string | null
  location?: any
  surveyorRecording?: { audioUrl: string | null; durationSecs: number | null; startedAt: string | null } | null
  questions: DetailQuestion[]
}

// Columnas de la tabla (reunión 2026-08-27): Encuestador, Encuestado, Fecha,
// Hora inicio, Duración, Barrio, Ciudad/Municipio, Tipo — más columnas de las
// que caben en una sola pantalla, así que el contenedor scrollea horizontal
// en vez de apretar cada celda.
const ROW_GRID = "180px 170px 110px 90px 90px 130px 150px 110px"
const ROW_MIN_WIDTH = "1030px"

// ── Estilos de outcome ────────────────────────────────────────────────────────
const outcomeBadge: Record<string, { label: string; className: string }> = {
  efectiva:   { label: "Efectiva",   className: "bg-emerald-50   text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" },
  incidencia: { label: "Incidencia", className: "bg-red-50       text-red-600     border-red-200     dark:bg-red-900/20     dark:text-red-400     dark:border-red-800"     },
  abandonada: { label: "Abandonada", className: "bg-amber-50     text-amber-600   border-amber-200   dark:bg-amber-900/20   dark:text-amber-400   dark:border-amber-800"  },
  descalificado: { label: "Descalificado", className: "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800" },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDuration(secs: number | null): string {
  if (secs === null) return "—"
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function formatDate(iso: string, withTime = false): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit", month: "short", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  })
}

const PAGE_SIZE_OPTIONS = [20, 50, 100]

// ── Skeleton de fila de tabla ─────────────────────────────────────────────────
function RowSkeleton() {
  return (
    <div className="grid grid-cols-12 px-3 py-3 items-center animate-pulse">
      <div className="col-span-2 h-3 bg-muted rounded w-3/4" />
      <div className="col-span-2 h-3 bg-muted rounded w-4/5" />
      <div className="col-span-3 h-3 bg-muted rounded w-2/3" />
      <div className="col-span-2 h-3 bg-muted rounded w-1/2" />
      <div className="col-span-1 h-3 bg-muted rounded w-4/5" />
      <div className="col-span-2 h-5 bg-muted rounded-full w-20 mx-auto" />
    </div>
  )
}

// ── Chip de stat para el header del sheet ─────────────────────────────────────
function StatChip({ icon: Icon, value, label, color = "default" }: {
  icon: React.ElementType; value: number; label: string; color?: "green" | "blue" | "amber" | "default"
}) {
  const colorMap = {
    green:   "text-emerald-600 bg-emerald-50   dark:text-emerald-400 dark:bg-emerald-900/20",
    blue:    "text-blue-600    bg-blue-50      dark:text-blue-400    dark:bg-blue-900/20",
    amber:   "text-amber-600   bg-amber-50     dark:text-amber-400   dark:bg-amber-900/20",
    default: "text-muted-foreground bg-muted/50",
  }
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${colorMap[color]}`}>
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="tabular-nums font-semibold">{value}</span>
      <span className="opacity-75">{label}</span>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface IndividualResponsesTabProps {
  filterParams: URLSearchParams
}

// ═════════════════════════════════════════════════════════════════════════════
export function IndividualResponsesTab({ filterParams }: IndividualResponsesTabProps) {
  // ── List state ──────────────────────────────────────────────────────────────
  const [items,   setItems]   = useState<ListItem[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)

  // ── Detail / Sheet state ────────────────────────────────────────────────────
  const [selectedId,    setSelectedId]    = useState<string | null>(null)
  const [detail,        setDetail]        = useState<DetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deletingPath,  setDeletingPath]  = useState<string | null>(null)
  const [deletingResponse, setDeletingResponse] = useState(false)
  // ── Editar respuesta a una pregunta puntual (reunión 2026-08-27) ────────────
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState("")
  const [savingAnswer, setSavingAnswer] = useState(false)

  // ── Search within sheet questions ───────────────────────────────────────────
  const [qSearch,        setQSearch]        = useState("")
  const [showOnlyAnswered, setShowOnlyAnswered] = useState(false)

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // ── Fetch list ───────────────────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams(filterParams)
      params.set("page",     String(page))
      params.set("pageSize", String(pageSize))
      const res = await fetch(`/api/reports/individual?${params}`)
      if (!res.ok) throw new Error("fetch failed")
      const json = await res.json()
      setItems(json.items || [])
      setTotal(json.total || 0)
    } catch {
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterParams.toString(), page, pageSize])

  useEffect(() => { fetchList() }, [fetchList])
  useEffect(() => { setPage(1)  }, [filterParams.toString(), pageSize])

  // ── Delete file ──────────────────────────────────────────────────────────────
  const handleDeleteFile = async (answerId: string, path: string) => {
    if (!confirm("¿Eliminar este archivo? Esta acción no se puede deshacer.")) return
    setDeletingPath(path)
    try {
      const res = await fetch("/api/response-files/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId, path }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast({ title: "Error al eliminar", description: body?.error || "No se pudo eliminar el archivo", variant: "destructive" })
        return
      }
      setDetail((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          questions: prev.questions.map((q) =>
            q.answerId === answerId
              ? { ...q, fileUrls: (q.fileUrls || []).filter((f) => f.path !== path) }
              : q
          ),
        }
      })
      toast({ title: "Archivo eliminado" })
    } catch {
      toast({ title: "Error de red", description: "No se pudo eliminar el archivo", variant: "destructive" })
    } finally {
      setDeletingPath(null)
    }
  }

  // ── Eliminar la respuesta individual completa (reunión 2026-08-27) ──────────
  const handleDeleteResponse = async (id: string) => {
    if (!confirm("¿Eliminar esta encuesta individual por completo? Esta acción no se puede deshacer.")) return
    setDeletingResponse(true)
    try {
      const res = await fetch(`/api/reports/individual/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast({ title: "Error al eliminar", description: body?.error || "No se pudo eliminar la encuesta", variant: "destructive" })
        return
      }
      toast({ title: "Encuesta eliminada" })
      setSelectedId(null)
      setDetail(null)
      fetchList()
    } catch {
      toast({ title: "Error de red", description: "No se pudo eliminar la encuesta", variant: "destructive" })
    } finally {
      setDeletingResponse(false)
    }
  }

  // ── Guardar edición de una respuesta puntual ─────────────────────────────────
  const handleSaveAnswer = async (responseId: string, answerId: string) => {
    setSavingAnswer(true)
    try {
      const res = await fetch(`/api/reports/individual/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId, value: editingValue }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast({ title: "Error al guardar", description: body?.error || "No se pudo guardar el cambio", variant: "destructive" })
        return
      }
      setDetail((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          questions: prev.questions.map((q) =>
            q.answerId === answerId ? { ...q, answer: editingValue, rawAnswer: editingValue } : q
          ),
        }
      })
      toast({ title: "Respuesta actualizada" })
      setEditingAnswerId(null)
    } catch {
      toast({ title: "Error de red", description: "No se pudo guardar el cambio", variant: "destructive" })
    } finally {
      setSavingAnswer(false)
    }
  }

  // ── Open detail ───────────────────────────────────────────────────────────────
  const openDetail = async (id: string) => {
    setSelectedId(id)
    setDetail(null)
    setDetailLoading(true)
    setQSearch("")
    setShowOnlyAnswered(false)
    try {
      const res = await fetch(`/api/reports/individual/${id}`)
      if (!res.ok) throw new Error("fetch failed")
      const json = await res.json()
      setDetail(json)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  // ── Filtros locales sobre la página cargada ──────────────────────────────────
  const [tableSearch,      setTableSearch]      = useState("")
  const [surveyorFilter,   setSurveyorFilter]   = useState("all")

  // Resetear filtros cuando cambia la página global
  useEffect(() => { setTableSearch(""); setSurveyorFilter("all") }, [filterParams.toString()])

  // Lista única de encuestadores de la página actual (para el select rápido)
  const surveyorsInPage = Array.from(
    new Map(
      items
        .filter((i) => i.surveyorName || i.surveyorEmail)
        .map((i) => [i.surveyorName ?? i.surveyorEmail!, { name: i.surveyorName, email: i.surveyorEmail }])
    ).values()
  ).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))

  // Aplicar filtros locales
  const visibleItems = items.filter((item) => {
    const matchSurveyor = surveyorFilter === "all"
      || item.surveyorName === surveyorFilter
      || item.surveyorEmail === surveyorFilter
    const search = tableSearch.toLowerCase()
    const matchSearch = !search
      || item.respondentName?.toLowerCase().includes(search)
      || item.surveyorName?.toLowerCase().includes(search)
      || item.surveyTitle.toLowerCase().includes(search)
    return matchSurveyor && matchSearch
  })

  // ── Computed ──────────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const stats = detail
    ? {
        total:     detail.questions.length,
        answered:  detail.questions.filter((q) => q.answer?.trim()).length,
        withFiles: detail.questions.filter((q) => q.fileUrls && q.fileUrls.length > 0).length,
        withAudio: detail.questions.filter((q) => q.audioUrl).length,
      }
    : null

  const filteredQuestions = detail?.questions.filter((q) => {
    const matchSearch = !qSearch ||
      q.text.toLowerCase().includes(qSearch.toLowerCase()) ||
      q.answer.toLowerCase().includes(qSearch.toLowerCase())
    const matchAnswered = !showOnlyAnswered || q.answer?.trim()
    return matchSearch && matchAnswered
  }) ?? []

  const scrollToQuestion = (qId: string) => {
    const el = scrollAreaRef.current?.querySelector(`[data-qid="${qId}"]`)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">
      {/* ── Lista principal ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Respuestas Individuales</CardTitle>
              <CardDescription className="mt-1">
                Detalle encuesta por encuesta · {total.toLocaleString()} en total
              </CardDescription>
            </div>
            {/* Selector de page size */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-xs text-muted-foreground">Mostrar</span>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <Button
                  key={n}
                  variant={pageSize === n ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setPageSize(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* ── Barra de búsqueda + filtro encuestador ───────────────────────── */}
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar encuestado, encuestador o encuesta…"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="h-8 pl-8 pr-8 text-xs"
              />
              {tableSearch && (
                <button
                  onClick={() => setTableSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <select
              value={surveyorFilter}
              onChange={(e) => setSurveyorFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-[160px]"
            >
              <option value="all">Todos los encuestadores</option>
              {surveyorsInPage.map((s) => (
                <option key={s.name ?? s.email} value={s.name ?? s.email ?? ""}>
                  {s.name ?? s.email}
                </option>
              ))}
            </select>
            {(tableSearch || surveyorFilter !== "all") && (
              <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => { setTableSearch(""); setSurveyorFilter("all") }}>
                <X className="h-3.5 w-3.5 mr-1" /> Limpiar
              </Button>
            )}
          </div>

          {loading ? (
            <div className="overflow-x-auto">
              {/* Header de columnas skeleton */}
              <div className="grid px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/50 border-y" style={{ gridTemplateColumns: ROW_GRID, minWidth: ROW_MIN_WIDTH }}>
                <div>Encuestador</div>
                <div>Encuestado</div>
                <div>Fecha</div>
                <div className="text-center">Hora inicio</div>
                <div className="text-center">Duración</div>
                <div>Barrio</div>
                <div>Ciudad / Municipio</div>
                <div className="text-center">Tipo</div>
              </div>
              <div className="divide-y">
                {Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="py-20 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground text-sm">No hay respuestas para los filtros seleccionados</p>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              {/* Header de columnas */}
              <div className="grid px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/50 border-y" style={{ gridTemplateColumns: ROW_GRID, minWidth: ROW_MIN_WIDTH }}>
                <div>Encuestador</div>
                <div>Encuestado</div>
                <div>Fecha</div>
                <div className="text-center">Hora inicio</div>
                <div className="text-center">Duración</div>
                <div>Barrio</div>
                <div>Ciudad / Municipio</div>
                <div className="text-center">Tipo</div>
              </div>

              {/* Filas */}
              <div className="divide-y" style={{ minWidth: ROW_MIN_WIDTH }}>
                {visibleItems.length === 0 && (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Sin resultados para "{tableSearch || surveyorFilter}"
                  </div>
                )}
                {visibleItems.map((item) => {
                  // Fallback defensivo: si en el futuro aparece un outcome
                  // nuevo sin agregar acá, que se vea como "Sin clasificar"
                  // en vez de romper toda la tabla (ver bug de "descalificado").
                  const badge = outcomeBadge[item.outcome] ?? { label: item.outcome || "Sin clasificar", className: "bg-muted text-muted-foreground border-border" }
                  return (
                    <button
                      key={item.id}
                      onClick={() => openDetail(item.id)}
                      className="w-full grid px-3 py-3 items-center text-left hover:bg-muted/30 transition-colors group"
                      style={{ gridTemplateColumns: ROW_GRID }}
                    >
                      {/* Encuestador */}
                      <div className="flex items-center gap-1.5 min-w-0 pr-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm truncate leading-tight">
                            {item.surveyorName || (item.surveyorEmail
                              ? <span className="text-xs text-muted-foreground">{item.surveyorEmail}</span>
                              : <span className="text-muted-foreground italic text-xs">Sin asignar</span>
                            )}
                          </p>
                          {item.surveyorName && item.surveyorEmail && (
                            <p className="text-[11px] text-muted-foreground truncate">{item.surveyorEmail}</p>
                          )}
                        </div>
                      </div>

                      {/* Encuestado */}
                      <div className="text-sm truncate pr-2 text-foreground">
                        {item.respondentName
                          ? item.respondentName
                          : <span className="text-muted-foreground italic text-xs">Sin asignar</span>
                        }
                      </div>

                      {/* Fecha */}
                      <div className="text-xs text-muted-foreground truncate pr-2">
                        {formatDate(item.createdAt)}
                      </div>

                      {/* Hora inicio */}
                      <div className="text-center text-xs text-muted-foreground font-mono">
                        {item.startedAt
                          ? new Date(item.startedAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </div>

                      {/* Duración */}
                      <div className="text-center text-xs text-muted-foreground font-mono">
                        {formatDuration(item.durationSecs)}
                      </div>

                      {/* Barrio */}
                      <div className="text-xs text-muted-foreground truncate pr-2">
                        {item.barrio || "—"}
                      </div>

                      {/* Ciudad / Municipio */}
                      <div className="text-xs text-muted-foreground truncate pr-2">
                        {item.ciudad || "—"}
                      </div>

                      {/* Tipo */}
                      <div className="flex justify-center overflow-hidden">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 whitespace-nowrap truncate max-w-full ${badge.className}`}>
                          {badge.label}
                        </Badge>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

              {/* Paginación */}
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  Página {page} de {totalPages} · {total.toLocaleString()} respuestas
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Dialog de detalle (modal centrado) ──────────────────────────────── */}
      <Dialog open={selectedId !== null} onOpenChange={(open) => { if (!open) { setSelectedId(null); setDetail(null) } }}>
        <DialogContent
          className="max-w-3xl w-full p-0 flex flex-col gap-0 overflow-hidden max-h-[95vh]"
        >
          {detailLoading ? (
            // ── Skeleton de carga ──────────────────────────────────────────────
            <div className="flex flex-col gap-4 p-6">
              <div className="h-5 bg-muted rounded w-2/3 animate-pulse" />
              <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
              <div className="flex gap-2 mt-2">
                {[80, 100, 70, 90].map((w, i) => (
                  <div key={i} className={`h-7 bg-muted rounded-lg animate-pulse`} style={{ width: w }} />
                ))}
              </div>
              <div className="mt-4 space-y-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-2 animate-pulse">
                    <div className="h-3 bg-muted rounded w-4/5" />
                    <div className="h-3 bg-muted/60 rounded w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          ) : !detail ? (
            // ── Error ──────────────────────────────────────────────────────────
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center p-10">
              <AlertCircle className="h-12 w-12 text-destructive/50" />
              <p className="text-sm text-muted-foreground">No se pudo cargar el detalle de esta respuesta</p>
              <Button variant="outline" size="sm" onClick={() => selectedId && openDetail(selectedId)}>
                Reintentar
              </Button>
            </div>
          ) : (
            <>
              {/* ── Header fijo ─────────────────────────────────────────────── */}
              <div className="flex-shrink-0 border-b bg-background">

                {/* ── Encuestado — fila compacta horizontal ──────────────────── */}
                <div className="flex items-center gap-3 px-4 pt-3 pb-3 border-b border-dashed">
                  {/* Avatar / inicial */}
                  <div className="w-10 h-10 flex-shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                    {detail.respondentName
                      ? <span className="text-base font-bold text-primary">{detail.respondentName.charAt(0).toUpperCase()}</span>
                      : <User className="h-5 w-5 text-muted-foreground" />
                    }
                  </div>
                  {/* Nombre + contacto */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold leading-tight truncate">
                        {detail.respondentName || (
                          <span className="font-mono text-muted-foreground text-sm">#{detail.id.slice(0, 8)}</span>
                        )}
                      </h2>
                      <Badge variant="outline" className={`${(outcomeBadge[detail.outcome] ?? outcomeBadge.abandonada).className} text-[10px] py-0`}>
                        {outcomeBadge[detail.outcome]?.label ?? detail.outcome}
                      </Badge>
                      {detail.incidenceType && (
                        <span className="text-[10px] text-muted-foreground">{detail.incidenceType}</span>
                      )}
                    </div>
                    {detail.respondentContact && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0 text-[11px] text-muted-foreground mt-0.5">
                        {detail.respondentContact.documentType && detail.respondentContact.documentNumber && (
                          <span>{detail.respondentContact.documentType}: {detail.respondentContact.documentNumber}</span>
                        )}
                        {detail.respondentContact.email && <span>{detail.respondentContact.email}</span>}
                        {detail.respondentContact.phone && <span>{detail.respondentContact.phone}</span>}
                      </div>
                    )}
                  </div>
                  {/* Eliminar encuesta individual (reunión 2026-08-27) */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={deletingResponse}
                    onClick={() => handleDeleteResponse(detail.id)}
                    title="Eliminar esta encuesta individual"
                  >
                    {deletingResponse ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>

                {/* ── Grabación de audio del encuestador (compacto) ──────────── */}
                {detail.surveyorRecording?.audioUrl && (() => {
                  const url = detail.surveyorRecording.audioUrl!
                  // Detectar formato .amr (antiguo, no reproducible en browsers)
                  // vs .m4a / .webm (formatos modernos compatibles)
                  const isAmr = url.includes('.amr') || url.includes('%2Famr') || url.includes('audio%2Famr')
                  const mimeType = url.includes('.m4a') ? 'audio/mp4'
                    : url.includes('.webm') ? 'audio/webm'
                    : url.includes('.mp3') ? 'audio/mpeg'
                    : url.includes('.ogg') ? 'audio/ogg'
                    : undefined

                  return (
                    <div className="px-4 py-2 border-b bg-amber-50/50 dark:bg-amber-900/10">
                      <div className="flex items-center gap-2">
                        <FileAudio className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                        <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex-shrink-0">
                          Grabación
                          {detail.surveyorRecording!.durationSecs
                            ? ` · ${formatDuration(detail.surveyorRecording!.durationSecs)} min`
                            : ""}
                        </span>
                        {isAmr ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <span className="text-[10px] text-amber-600 dark:text-amber-400">
                              Formato AMR — no compatible con el navegador.
                            </span>
                            <a
                              href={url}
                              download
                              className="text-[10px] underline text-amber-700 dark:text-amber-300 hover:opacity-80"
                            >
                              Descargar
                            </a>
                          </div>
                        ) : (
                          <audio
                            src={url}
                            controls
                            className="flex-1 h-7 min-w-0"
                            style={{ accentColor: "#d97706" }}
                          >
                            {mimeType && <source src={url} type={mimeType} />}
                          </audio>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* ── Survey metadata + stats en una sola fila ───────────────── */}
                <div className="px-4 py-2 border-b">
                  <DialogHeader className="mb-1 p-0">
                    <DialogTitle className="text-xs font-semibold leading-tight text-muted-foreground">
                      {detail.surveyTitle}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {(detail.surveyorName || detail.surveyorEmail) && (
                      <span className="flex items-center gap-1">
                        <ClipboardList className="h-3 w-3" />
                        {detail.surveyorName || detail.surveyorEmail}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(detail.createdAt, true)}
                    </span>
                    {detail.durationSecs !== null && (
                      <span className="font-mono">{formatDuration(detail.durationSecs)} min</span>
                    )}
                    {detail.location && (
                      <span className="flex items-center gap-1 text-blue-500">
                        <MapPin className="h-3 w-3" /> Con ubicación
                      </span>
                    )}
                  </div>
                  {/* Stats + progress bar inline */}
                  {stats && stats.total > 0 && (
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <StatChip icon={ClipboardList} value={stats.total}     label="preguntas"   color="default" />
                        <StatChip icon={CheckCircle2}  value={stats.answered}  label="respondidas" color="green"   />
                        {stats.withFiles > 0 && (
                          <StatChip icon={Paperclip}   value={stats.withFiles} label="archivos"    color="blue"    />
                        )}
                        {stats.withAudio > 0 && (
                          <StatChip icon={FileAudio}   value={stats.withAudio} label="audios"      color="amber"   />
                        )}
                      </div>
                      <div className="flex-1 min-w-[80px]">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${(stats.answered / stats.total) * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold text-muted-foreground tabular-nums flex-shrink-0">
                            {formatPercent(Math.round((stats.answered / stats.total) * 1000) / 10)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Búsqueda + filtro */}
                <div className="flex items-center gap-2 px-4 py-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar pregunta o respuesta…"
                      value={qSearch}
                      onChange={(e) => setQSearch(e.target.value)}
                      className="h-7 pl-8 pr-8 text-xs"
                    />
                    {qSearch && (
                      <button
                        onClick={() => setQSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Button
                    variant={showOnlyAnswered ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs flex-shrink-0"
                    onClick={() => setShowOnlyAnswered((v) => !v)}
                  >
                    Solo respondidas
                  </Button>
                </div>
              </div>

              {/* ── Cuerpo scrollable — preguntas ────────────────────────────── */}
              <div
                ref={scrollAreaRef}
                className="flex-1 overflow-y-auto"
              >
                {filteredQuestions.length === 0 ? (
                  <div className="py-20 text-center">
                    <Search className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-40" />
                    <p className="text-sm text-muted-foreground">
                      {qSearch ? "Sin resultados para esa búsqueda" : "Sin preguntas respondidas"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredQuestions.map((q, idx) => {
                      const hasAnswer = q.answer?.trim()
                      const globalIdx = detail.questions.findIndex((dq) => dq.questionId === q.questionId)
                      return (
                        <div
                          key={q.questionId}
                          data-qid={q.questionId}
                          className="px-4 py-3 scroll-mt-4"
                        >
                          {/* Número + texto de pregunta */}
                          <div className="flex items-start gap-3 mb-3">
                            <span className={`
                              flex-shrink-0 inline-flex items-center justify-center
                              w-6 h-6 rounded-full text-[11px] font-bold tabular-nums
                              ${hasAnswer
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground"
                              }
                            `}>
                              {globalIdx + 1}
                            </span>
                            <p className="text-sm font-medium leading-snug text-foreground pt-0.5 flex-1">
                              {q.text}
                            </p>
                            {/* Editar respuesta (reunión 2026-08-27) — solo para
                                tipos de valor simple; matrix/location/file
                                necesitan su propio editor, fuera de alcance acá. */}
                            {q.answerId && !["matrix", "location", "file", "image_upload"].includes(q.type) && editingAnswerId !== q.answerId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={() => { setEditingAnswerId(q.answerId!); setEditingValue(q.answer || "") }}
                                title="Editar respuesta"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>

                          {/* Respuesta */}
                          <div className="ml-9">
                            {editingAnswerId === q.answerId ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  rows={3}
                                  className="text-sm"
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    disabled={savingAnswer}
                                    onClick={() => handleSaveAnswer(detail.id, q.answerId!)}
                                  >
                                    {savingAnswer ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                                    Guardar
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingAnswerId(null)} disabled={savingAnswer}>
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                            <>
                            {/* Renderer especial: tipo location (GPS) */}
                            {q.type === "location" && q.rawAnswer && typeof q.rawAnswer === "object" && !Array.isArray(q.rawAnswer) && q.rawAnswer.lat != null ? (
                              <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20 p-3 space-y-2">
                                <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5 uppercase tracking-wide">
                                  <MapPin className="h-3.5 w-3.5" /> Ubicación GPS
                                </p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                  {[
                                    { label: "Ciudad",       val: q.rawAnswer.ciudad },
                                    { label: "Barrio",       val: q.rawAnswer.barrio },
                                    { label: "Localidad",    val: q.rawAnswer.localidad },
                                    { label: "Departamento", val: q.rawAnswer.departamento },
                                    { label: "País",         val: q.rawAnswer.pais },
                                  ].filter(f => f.val).map(f => (
                                    <div key={f.label}>
                                      <span className="text-[11px] text-muted-foreground">{f.label}: </span>
                                      <span className="font-medium text-foreground">{f.val}</span>
                                    </div>
                                  ))}
                                </div>
                                <a
                                  href={`https://www.google.com/maps?q=${q.rawAnswer.lat},${q.rawAnswer.lng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
                                >
                                  <MapPin className="h-3 w-3" />
                                  {Number(q.rawAnswer.lat).toFixed(5)}, {Number(q.rawAnswer.lng).toFixed(5)} — Ver en mapa
                                </a>
                              </div>
                            ) : q.type === "matrix" && q.matrixRows?.length && q.matrixCols?.length && q.rawAnswer && typeof q.rawAnswer === "object" ? (
                              <div className="overflow-x-auto rounded-lg border">
                                <table className="w-full text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-muted/50">
                                      <th className="text-left font-medium px-2 py-1.5 border-b"> </th>
                                      {q.matrixCols.map((col) => (
                                        <th key={col} className="text-center font-medium px-2 py-1.5 border-b border-l whitespace-nowrap">
                                          {col}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {q.matrixRows.map((row) => {
                                      const cellValue = (q.rawAnswer as Record<string, string | string[]>)[row]
                                      const selected = Array.isArray(cellValue) ? cellValue : cellValue ? [cellValue] : []
                                      return (
                                        <tr key={row} className="even:bg-muted/20">
                                          <td className="px-2 py-1.5 border-b font-medium text-foreground/80">{row}</td>
                                          {q.matrixCols!.map((col) => (
                                            <td key={col} className="text-center px-2 py-1.5 border-b border-l">
                                              {selected.includes(col) ? <Check className="h-3.5 w-3.5 mx-auto text-emerald-600" /> : null}
                                            </td>
                                          ))}
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : hasAnswer ? (
                              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                {q.answer}
                              </p>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full italic">
                                <Circle className="h-3 w-3" /> Sin respuesta
                              </span>
                            )}
                            </>
                            )}

                            {/* Audio */}
                            {q.audioUrl && (
                              <div className="mt-3 flex items-center gap-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                                <FileAudio className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                <audio controls src={q.audioUrl} className="h-8 flex-1 min-w-0" />
                                <a href={q.audioUrl} download>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                </a>
                              </div>
                            )}

                            {/* Archivos / imágenes */}
                            {q.fileUrls && q.fileUrls.length > 0 && (
                              <div className="mt-3">
                                <p className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wide font-medium">
                                  {q.fileUrls.length === 1 ? "1 archivo adjunto" : `${q.fileUrls.length} archivos adjuntos`}
                                </p>
                                <div className="flex flex-wrap gap-3">
                                  {q.fileUrls.map((f, fi) =>
                                    f.url ? (
                                      f.type?.startsWith("image/") ? (
                                        // Imagen: miniatura grande con hover delete
                                        <div key={fi} className="relative group rounded-xl overflow-hidden border bg-muted/30">
                                          <a href={f.url} target="_blank" rel="noreferrer" title={f.name}>
                                            <img
                                              src={f.url}
                                              alt={f.name}
                                              className="h-36 w-36 object-cover"
                                            />
                                          </a>
                                          {/* Overlay con nombre en hover */}
                                          <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1.5 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                            {f.name}
                                          </div>
                                          {/* Botón eliminar */}
                                          {q.answerId && f.path && (
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteFile(q.answerId!, f.path!)}
                                              disabled={deletingPath === f.path}
                                              className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-600 text-white rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                              title="Eliminar"
                                            >
                                              {deletingPath === f.path
                                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                                : <Trash2 className="h-3 w-3" />
                                              }
                                            </button>
                                          )}
                                        </div>
                                      ) : (
                                        // PDF / otro archivo
                                        <div key={fi} className="flex items-center gap-2 bg-muted/40 border rounded-xl px-3 py-2.5 text-xs">
                                          <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                          <a
                                            href={f.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="hover:underline max-w-[140px] truncate"
                                            title={f.name}
                                          >
                                            {f.name}
                                          </a>
                                          <a href={f.url} download>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                              <Download className="h-3 w-3" />
                                            </Button>
                                          </a>
                                          {q.answerId && f.path && (
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteFile(q.answerId!, f.path!)}
                                              disabled={deletingPath === f.path}
                                              className="text-muted-foreground hover:text-destructive transition-colors"
                                              title="Eliminar"
                                            >
                                              {deletingPath === f.path
                                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                                : <Trash2 className="h-3 w-3" />
                                              }
                                            </button>
                                          )}
                                        </div>
                                      )
                                    ) : (
                                      <span key={fi} className="text-xs text-muted-foreground italic">
                                        {f.name} (URL no disponible)
                                      </span>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Resultado de búsqueda */}
                {qSearch && filteredQuestions.length > 0 && (
                  <div className="px-6 py-3 text-xs text-muted-foreground border-t bg-muted/20 text-center">
                    {filteredQuestions.length} de {detail.questions.length} preguntas
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
