"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Loader2, User, Clock, ChevronLeft, ChevronRight, FileAudio, Download, AlertCircle } from "lucide-react"

// Pestaña "Respuestas Individuales" (pptx slide 22): lista de encuestas
// respondidas + vista de detalle con preguntas/respuestas y audio si existe.

interface ListItem {
  id: string
  surveyId: string
  surveyTitle: string
  surveyorName: string | null
  respondentName: string | null
  createdAt: string
  completedAt: string | null
  durationSecs: number | null
  status: string
  outcome: "efectiva" | "incidencia" | "abandonada"
  incidenceType: string | null
  hasLocation: boolean
}

interface DetailQuestion {
  questionId: string
  text: string
  type: string
  answer: string
  audioUrl: string | null
}

interface DetailResponse {
  id: string
  surveyTitle: string
  surveyorName: string | null
  respondentName: string | null
  createdAt: string
  completedAt: string | null
  durationSecs: number | null
  outcome: "efectiva" | "incidencia" | "abandonada"
  incidenceType: string | null
  questions: DetailQuestion[]
}

const outcomeBadge: Record<string, { label: string; className: string }> = {
  efectiva: { label: "Efectiva", className: "bg-[#18b0a4]/10 text-[#18b0a4] border-[#18b0a4]/30" },
  incidencia: { label: "Incidencia", className: "bg-red-50 text-red-600 border-red-200" },
  abandonada: { label: "Abandonada", className: "bg-amber-50 text-amber-600 border-amber-200" },
}

function formatDuration(secs: number | null): string {
  if (secs === null) return "—"
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

interface IndividualResponsesTabProps {
  // Query string ya armado con los filtros globales (empresa/proyecto/encuesta/encuestador/tipo/fechas)
  filterParams: URLSearchParams
}

export function IndividualResponsesTab({ filterParams }: IndividualResponsesTabProps) {
  const [items, setItems] = useState<ListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const pageSize = 20

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams(filterParams)
      params.set("page", String(page))
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
  }, [filterParams.toString(), page])

  useEffect(() => { fetchList() }, [fetchList])
  // Si cambian los filtros globales, vuelve a página 1
  useEffect(() => { setPage(1) }, [filterParams.toString()])

  const openDetail = async (id: string) => {
    setSelectedId(id)
    setDetail(null)
    setDetailLoading(true)
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Respuestas Individuales</CardTitle>
          <CardDescription>Detalle de encuesta por encuesta ({total.toLocaleString()} en total)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No hay respuestas para los filtros seleccionados</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-hidden">
                <div className="grid grid-cols-12 p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/50 border-b">
                  <div className="col-span-3">Encuestador</div>
                  <div className="col-span-3">Encuestado</div>
                  <div className="col-span-2">Fecha</div>
                  <div className="col-span-2 text-center">Duración</div>
                  <div className="col-span-2 text-center">Tipo</div>
                </div>
                <div className="divide-y">
                  {items.map((item) => {
                    const badge = outcomeBadge[item.outcome]
                    return (
                      <button
                        key={item.id}
                        onClick={() => openDetail(item.id)}
                        className="w-full grid grid-cols-12 px-3 py-3 items-center text-left hover:bg-muted/30 transition-colors"
                      >
                        <div className="col-span-3 flex items-center gap-2 min-w-0">
                          <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm font-medium truncate">{item.surveyorName || "Sin asignar"}</span>
                        </div>
                        <div className="col-span-3 text-sm truncate pr-2">{item.respondentName || "Anónimo"}</div>
                        <div className="col-span-2 text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                        </div>
                        <div className="col-span-2 text-center text-xs text-muted-foreground font-mono flex items-center justify-center gap-1">
                          <Clock className="h-3 w-3" /> {formatDuration(item.durationSecs)}
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Paginación */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  Página {page} de {totalPages} — {total.toLocaleString()} respuestas
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Siguiente <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalle */}
      <Dialog open={selectedId !== null} onOpenChange={(open) => { if (!open) { setSelectedId(null); setDetail(null) } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : detail ? (
            <>
              <DialogHeader>
                <DialogTitle>{detail.surveyTitle}</DialogTitle>
                <DialogDescription>
                  {detail.respondentName || "Anónimo"} · {detail.surveyorName || "Sin encuestador asignado"} ·{" "}
                  {new Date(detail.createdAt).toLocaleString("es-CO")}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className={outcomeBadge[detail.outcome].className}>
                  {outcomeBadge[detail.outcome].label}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatDuration(detail.durationSecs)}
                </span>
                {detail.incidenceType && (
                  <span className="text-xs text-muted-foreground">· Motivo: {detail.incidenceType}</span>
                )}
              </div>

              <div className="space-y-5">
                {detail.questions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sin respuestas registradas para esta encuesta</p>
                ) : (
                  detail.questions.map((q) => (
                    <div key={q.questionId} className="border-b pb-4 last:border-0">
                      <p className="text-sm font-medium mb-1.5">{q.text}</p>
                      <p className="text-sm text-muted-foreground">{q.answer || <span className="italic">Sin respuesta</span>}</p>
                      {q.audioUrl && (
                        <div className="mt-2 flex items-center gap-2 bg-muted/40 rounded-md p-2">
                          <FileAudio className="h-4 w-4 text-[#18b0a4] flex-shrink-0" />
                          <audio controls src={q.audioUrl} className="h-8 flex-1 min-w-0" />
                          <a href={q.audioUrl} download className="flex-shrink-0">
                            <Button variant="ghost" size="sm" className="h-8 px-2">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No se pudo cargar el detalle</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
