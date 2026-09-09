"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Download, FileAudio, AlertCircle, Play } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

// Pestaña "Audios" (reunión 2026-08-27): descarga en un solo ZIP todas las
// grabaciones de la encuesta, organizadas en carpetas
// Proyecto/Encuesta/Fecha/Encuestador/archivo — ver
// app/api/surveys/[id]/audios/zip/route.ts.
//
// Ítem #34 (acta 07/09/2026): "solo tengo la opción de descargar todos los
// audios... con más de mil audios, ¿cuánto demorará?". Antes solo se
// mostraba el conteo total y un botón "descargar todo". Ahora se listan las
// grabaciones reales (ya venían con URL firmada individual desde
// /api/surveys/[id]/recordings, solo no se usaban), agrupadas por
// encuestador, con reproducción/descarga individual y filtros de
// fecha/encuestador para el ZIP — así se puede pedir un subconjunto
// manejable en vez de todo de una vez.
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

export function AudiosTab({ surveyId }: AudiosTabProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [hint, setHint] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [filterDate, setFilterDate] = useState<string>("all")
  const [filterSurveyorId, setFilterSurveyorId] = useState<string>("all")
  // Ítem #36 (acta 07/09/2026): formato del ZIP — "webm" (el que grabó el
  // navegador, sin recodificar) o "mp3" (más compatible, requiere ffmpeg en
  // el servidor; si la conversión falla para algún archivo, ese queda en su
  // formato original en vez de perderse).
  const [format, setFormat] = useState<"webm" | "mp3">("webm")

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

  // Opciones de filtro derivadas de las grabaciones reales — solo se ofrecen
  // fechas/encuestadores que efectivamente tienen audios.
  const availableDates = useMemo(() => {
    const dates = new Set(recordings.map((r) => (r.startedAt || "").slice(0, 10)).filter(Boolean))
    return Array.from(dates).sort().reverse()
  }, [recordings])

  const availableSurveyors = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of recordings) if (r.surveyorId) map.set(r.surveyorId, r.surveyorName)
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [recordings])

  const filteredRecordings = useMemo(() => {
    return recordings.filter((r) => {
      const matchDate = filterDate === "all" || (r.startedAt || "").slice(0, 10) === filterDate
      const matchSurveyor = filterSurveyorId === "all" || r.surveyorId === filterSurveyorId
      return matchDate && matchSurveyor
    })
  }, [recordings, filterDate, filterSurveyorId])

  // Agrupadas por encuestador para que la lista sea manejable con cientos de
  // grabaciones (mismo criterio de agrupación que ya usaba el conteo).
  const groupedBySurveyor = useMemo(() => {
    const groups = new Map<string, Recording[]>()
    for (const r of filteredRecordings) {
      const key = r.surveyorName || "Sin asignar"
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredRecordings])

  const handleDownloadZip = async () => {
    setDownloading(true)
    const loadingToast = toast({ title: "Generando ZIP...", description: "Descargando y empaquetando los audios, puede tardar unos segundos." })
    try {
      const qs = new URLSearchParams()
      if (filterDate !== "all") qs.set("date", filterDate)
      if (filterSurveyorId !== "all") qs.set("surveyorId", filterSurveyorId)
      if (format === "mp3") qs.set("format", "mp3")
      const res = await fetch(`/api/surveys/${surveyId}/audios/zip${qs.toString() ? `?${qs.toString()}` : ""}`)
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

  const hasFilter = filterDate !== "all" || filterSurveyorId !== "all"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileAudio className="h-5 w-5 text-[#18b0a4]" /> Audios de la encuesta
        </CardTitle>
        <CardDescription>
          Reproduce o descarga grabaciones puntuales, o descárgalas todas (o por fecha/encuestador) en un ZIP
          organizado por Proyecto / Encuesta / Fecha / Encuestador.
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
                <span className="font-semibold text-foreground">{filteredRecordings.length}</span> de{" "}
                <span className="font-semibold text-foreground">{recordings.length}</span> grabación
                {recordings.length !== 1 ? "es" : ""}
                {hasFilter ? " (con el filtro aplicado)" : ""}.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={filterDate} onValueChange={setFilterDate}>
                  <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Fecha" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las fechas</SelectItem>
                    {availableDates.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                <Button onClick={handleDownloadZip} disabled={downloading} size="sm" className="gap-2">
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {downloading ? "Generando ZIP..." : hasFilter ? "Descargar filtrado (ZIP)" : "Descargar todos (ZIP)"}
                </Button>
              </div>
            </div>

            <div className="rounded-md border divide-y max-h-96 overflow-y-auto">
              {groupedBySurveyor.map(([surveyorName, recs]) => (
                <div key={surveyorName}>
                  <div className="px-3 py-1.5 bg-muted/40 text-xs font-semibold text-muted-foreground">
                    {surveyorName} · {recs.length} grabación{recs.length !== 1 ? "es" : ""}
                  </div>
                  {recs.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <Play className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground w-32 flex-shrink-0">
                        {r.startedAt ? new Date(r.startedAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—"}
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
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
