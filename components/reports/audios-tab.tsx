"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Download, FileAudio, AlertCircle, Play, ChevronDown, ChevronRight } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

// Pestaña "Audios" (reunión 2026-08-27): descarga en un solo ZIP todas las
// grabaciones de la encuesta, organizadas en carpetas
// Proyecto/Encuesta/Fecha/Encuestador/archivo — ver
// app/api/surveys/[id]/audios/zip/route.ts.
//
// Ítem #34 (acta 07/09/2026): "solo tengo la opción de descargar todos los
// audios... con más de mil audios, ¿cuánto demorará?". Ítem 09/09/2026:
// "crear un repositorio jerárquico para descargar audios — estructura
// sugerida: encuesta → fecha → encuestador → audios. Permitir seleccionar
// mediante casillas exactamente qué carpetas o audios descargar — necesario
// para proyectos con miles de encuestas; 'Descargar todo' no es práctico".
// La lista plana agrupada por encuestador (fix anterior, #34) se convierte
// acá en un árbol Fecha → Encuestador → grabación, con casillas en cascada
// en cada nivel — marcar una fecha marca todos sus encuestadores/audios, y
// viceversa hacia arriba (parcial = indeterminado).
interface Recording {
  id: string
  surveyorId: string | null
  surveyorName: string
  // outcome (09/09/2026): "debe quedar claro a qué encuesta o intento
  // pertenece cada audio — esto puede ocurrir porque el encuestador entra,
  // sale o abandona varias veces". Ya venía en la respuesta de la API, solo
  // no se mostraba — es lo único que distingue, para un mismo encuestador,
  // el audio de un intento abandonado del de la encuesta que sí completó.
  outcome: "efectiva" | "incidencia" | "abandonada" | "descalificado" | null
  startedAt: string | null
  durationSecs: number | null
  audioUrl: string | null
  fileName: string
}

const OUTCOME_LABEL: Record<string, string> = {
  efectiva: "Efectiva", incidencia: "Incidencia", abandonada: "Abandonada", descalificado: "Descalificada",
}
const OUTCOME_CLASS: Record<string, string> = {
  efectiva: "bg-emerald-100 text-emerald-700",
  incidencia: "bg-red-100 text-red-700",
  abandonada: "bg-amber-100 text-amber-700",
  descalificado: "bg-purple-100 text-purple-700",
}

interface AudiosTabProps {
  surveyId: string
}

function formatDuration(secs: number | null): string {
  if (!secs || secs <= 0) return "—"
  const m = Math.floor(secs / 60)
  const s = Math.round(secs % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

// Estado de una casilla contenedora (fecha, o encuestador dentro de una
// fecha) según cuántos de sus descendientes están marcados.
function groupCheckState(ids: string[], selected: Set<string>): boolean | "indeterminate" {
  if (ids.length === 0) return false
  const selectedCount = ids.filter((id) => selected.has(id)).length
  if (selectedCount === 0) return false
  if (selectedCount === ids.length) return true
  return "indeterminate"
}

export function AudiosTab({ surveyId }: AudiosTabProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [hint, setHint] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [filterSurveyorId, setFilterSurveyorId] = useState<string>("all")
  // Ítem #36 (acta 07/09/2026): formato del ZIP — "webm" (el que grabó el
  // navegador, sin recodificar) o "mp3" (más compatible, requiere ffmpeg en
  // el servidor; si la conversión falla para algún archivo, ese queda en su
  // formato original en vez de perderse).
  const [format, setFormat] = useState<"webm" | "mp3">("webm")
  // Árbol: qué grabaciones están marcadas para el ZIP, y qué fechas están
  // expandidas (todas por defecto — con pocas fechas es lo más cómodo).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setHint(null)
    fetch(`/api/surveys/${surveyId}/recordings`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        setRecordings(json.recordings ?? [])
        setHint(json.diagnostic?.hint ?? null)
      })
      .catch(() => { if (!cancelled) setRecordings([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [surveyId])

  const availableSurveyors = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of recordings) if (r.surveyorId) map.set(r.surveyorId, r.surveyorName)
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [recordings])

  const filteredRecordings = useMemo(() => {
    return recordings.filter((r) => filterSurveyorId === "all" || r.surveyorId === filterSurveyorId)
  }, [recordings, filterSurveyorId])

  // Árbol Fecha → Encuestador → grabaciones (orden: fecha más reciente
  // primero, encuestador alfabético dentro de cada fecha).
  const tree = useMemo(() => {
    const byDate = new Map<string, Map<string, Recording[]>>()
    for (const r of filteredRecordings) {
      const dateKey = (r.startedAt || "").slice(0, 10) || "Sin fecha"
      const surveyorKey = r.surveyorName || "Sin asignar"
      if (!byDate.has(dateKey)) byDate.set(dateKey, new Map())
      const bySurveyor = byDate.get(dateKey)!
      if (!bySurveyor.has(surveyorKey)) bySurveyor.set(surveyorKey, [])
      bySurveyor.get(surveyorKey)!.push(r)
    }
    return Array.from(byDate.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, bySurveyor]) => ({
        date,
        surveyors: Array.from(bySurveyor.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([surveyorName, recs]) => ({ surveyorName, recordings: recs })),
      }))
  }, [filteredRecordings])

  const toggleIds = (ids: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  const toggleDateCollapsed = (date: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev)
      next.has(date) ? next.delete(date) : next.add(date)
      return next
    })
  }

  const selectAllVisible = () => toggleIds(filteredRecordings.map((r) => r.id), true)
  const clearSelection = () => toggleIds(filteredRecordings.map((r) => r.id), false)

  const handleDownloadZip = async () => {
    if (selectedIds.size === 0) {
      toast({ title: "Nada seleccionado", description: "Marca al menos una fecha, encuestador o grabación para descargar.", variant: "destructive" })
      return
    }
    setDownloading(true)
    const loadingToast = toast({ title: "Generando ZIP...", description: "Descargando y empaquetando los audios, puede tardar unos segundos." })
    try {
      const qs = new URLSearchParams()
      qs.set("recordingIds", Array.from(selectedIds).join(","))
      if (format === "mp3") qs.set("format", "mp3")
      const res = await fetch(`/api/surveys/${surveyId}/audios/zip?${qs.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        toast({ title: "No se pudo descargar", description: body?.error || "Error al generar el ZIP de audios.", variant: "destructive" })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `audios_${surveyId}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      toast({ title: "No se pudo descargar", description: err?.message || "Error de conexión.", variant: "destructive" })
    } finally {
      loadingToast.dismiss()
      setDownloading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileAudio className="h-5 w-5 text-[#18b0a4]" /> Audios de la encuesta
        </CardTitle>
        <CardDescription>
          Reproduce grabaciones puntuales, o marca casillas por fecha, encuestador o audio individual y descarga
          exactamente esa selección en un ZIP organizado por Proyecto / Encuesta / Fecha / Encuestador.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando grabaciones...
          </div>
        ) : recordings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-center py-10 text-muted-foreground">
            <AlertCircle className="h-8 w-8 opacity-40" />
            <p className="text-sm">No hay grabaciones de audio para esta encuesta todavía.</p>
            {hint && <p className="text-xs max-w-md">{hint}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{selectedIds.size}</span> seleccionada
                {selectedIds.size !== 1 ? "s" : ""} de{" "}
                <span className="font-semibold text-foreground">{filteredRecordings.length}</span> grabación
                {filteredRecordings.length !== 1 ? "es" : ""}.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={filterSurveyorId} onValueChange={setFilterSurveyorId}>
                  <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Encuestador" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los encuestadores</SelectItem>
                    {availableSurveyors.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={format} onValueChange={(v) => setFormat(v as "webm" | "mp3")}>
                  <SelectTrigger className="h-8 w-[90px] text-xs" title="Formato del archivo dentro del ZIP"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webm">WebM</SelectItem>
                    <SelectItem value="mp3">MP3</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={selectAllVisible} className="text-xs">Seleccionar todo</Button>
                <Button variant="ghost" size="sm" onClick={clearSelection} className="text-xs">Limpiar</Button>
                <Button onClick={handleDownloadZip} disabled={downloading || selectedIds.size === 0} size="sm" className="gap-2">
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {downloading ? "Generando ZIP..." : `Descargar selección (${selectedIds.size})`}
                </Button>
              </div>
            </div>

            <div className="rounded-md border divide-y max-h-[32rem] overflow-y-auto">
              {tree.map(({ date, surveyors }) => {
                const dateIds = surveyors.flatMap((s) => s.recordings.map((r) => r.id))
                const dateState = groupCheckState(dateIds, selectedIds)
                const collapsed = collapsedDates.has(date)
                return (
                  <div key={date}>
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 text-sm font-semibold">
                      <button type="button" onClick={() => toggleDateCollapsed(date)} className="text-muted-foreground hover:text-foreground">
                        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <Checkbox checked={dateState} onCheckedChange={(v) => toggleIds(dateIds, v === true)} />
                      <span>{date}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        · {dateIds.length} grabación{dateIds.length !== 1 ? "es" : ""}
                      </span>
                    </div>
                    {!collapsed && surveyors.map(({ surveyorName, recordings: recs }) => {
                      const surveyorIds = recs.map((r) => r.id)
                      const surveyorState = groupCheckState(surveyorIds, selectedIds)
                      return (
                        <div key={`${date}-${surveyorName}`}>
                          <div className="flex items-center gap-2 pl-8 pr-3 py-1.5 bg-muted/25 text-xs font-semibold text-muted-foreground">
                            <Checkbox checked={surveyorState} onCheckedChange={(v) => toggleIds(surveyorIds, v === true)} />
                            <span>{surveyorName}</span>
                            <span className="font-normal">· {recs.length} grabación{recs.length !== 1 ? "es" : ""}</span>
                          </div>
                          {recs.map((r) => (
                            <div key={r.id} className="flex items-center gap-3 pl-14 pr-3 py-2 text-sm">
                              <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={(v) => toggleIds([r.id], v === true)} />
                              <Play className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="text-xs text-muted-foreground w-16 flex-shrink-0">
                                {r.startedAt ? new Date(r.startedAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "—"}
                              </span>
                              {/* A qué intento pertenece — ver comentario en la interfaz Recording */}
                              {r.outcome && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${OUTCOME_CLASS[r.outcome] || "bg-muted text-muted-foreground"}`}>
                                  {OUTCOME_LABEL[r.outcome] || r.outcome}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground w-14 flex-shrink-0 font-mono">{formatDuration(r.durationSecs)}</span>
                              {r.audioUrl ? (
                                <audio controls src={r.audioUrl} className="h-8 flex-1 min-w-0" />
                              ) : (
                                <span className="text-xs text-muted-foreground italic flex-1">Sin archivo disponible</span>
                              )}
                              {r.audioUrl && (
                                <a href={r.audioUrl} download={r.fileName} title="Descargar esta grabación">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0"><Download className="h-3.5 w-3.5" /></Button>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
