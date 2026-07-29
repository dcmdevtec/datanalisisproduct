"use client"

// Vista PÚBLICA de resultados de una encuesta (pptx slide 21: "compartir un
// link para que la persona que lo tenga pueda verlo en línea", al estilo de
// la página de resultados de SurveyMonkey). Sin auth, sin DashboardLayout
// (nada de sidebar/menú admin) — es lo que abre cualquiera con el link que
// genera el botón "Compartir link" en /reports.
//
// Consume /api/reports/public/[id], que solo expone agregados por pregunta
// (nunca respuestas individuales con nombre/documento/ubicación/audio).

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Logo } from "@/components/ui/logo"
import { Loader2, AlertCircle, ChartPie, PieChart as PieChartIcon, ChartBarBig, ChartNoAxesColumn, LineChart as LineChartIcon, Table2, Users2 } from "lucide-react"
import { QuestionChart, type ChartType } from "@/components/reports/question-chart"

interface PublicQuestionBreakdown {
  questionId: string
  text: string
  type: string
  totalAnswers: number
  average?: string
  distribution: { label: string; count: number; percentage: number }[]
  timeline: { date: string; count: number }[]
}

interface PublicReportData {
  survey: { id: string; title: string; description: string | null }
  totalResponses: number
  questionBreakdowns: PublicQuestionBreakdown[]
}

const chartTypeOptions: { value: ChartType; label: string; icon: typeof ChartPie }[] = [
  { value: "pie", label: "Torta", icon: ChartPie },
  { value: "donut", label: "Anillo", icon: PieChartIcon },
  { value: "barsV", label: "Barras verticales", icon: ChartBarBig },
  { value: "barsH", label: "Barras horizontales", icon: ChartNoAxesColumn },
  { value: "trend", label: "Tendencia", icon: LineChartIcon },
]

export default function PublicSurveyResultsPage() {
  const params = useParams<{ id: string }>()
  const surveyId = params.id as string

  const [data, setData] = useState<PublicReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("")
  const [chartType, setChartType] = useState<ChartType>("barsV")
  const [showDataTable, setShowDataTable] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reports/public/${surveyId}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || "No se pudo cargar la encuesta")
      }
      const json: PublicReportData = await res.json()
      setData(json)
      if (json.questionBreakdowns.length > 0) {
        setSelectedQuestionId(json.questionBreakdowns[0].questionId)
      }
    } catch (err: any) {
      setError(err.message || "No se pudo cargar la encuesta")
    } finally {
      setLoading(false)
    }
  }, [surveyId])

  useEffect(() => {
    if (surveyId) fetchData()
  }, [surveyId, fetchData])

  const selectedQuestion = data?.questionBreakdowns.find((q) => q.questionId === selectedQuestionId) ?? null

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-background border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Logo size="sm" showText={false} />
          <span className="text-sm font-medium text-muted-foreground">Resultados de encuesta</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error || !data ? (
          <Card>
            <CardContent className="py-16 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">{error || "Encuesta no encontrada"}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold">{data.survey.title}</h1>
              {data.survey.description && (
                <p className="text-muted-foreground mt-1">{data.survey.description}</p>
              )}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
                <Users2 className="h-4 w-4" /> {data.totalResponses.toLocaleString()} respuestas
              </div>
            </div>

            {data.questionBreakdowns.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Todavía no hay respuestas para mostrar.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Análisis de Resultados</CardTitle>
                  <CardDescription>Selecciona una pregunta y el tipo de gráfico para visualizarla ({data.questionBreakdowns.length} preguntas con respuestas)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col lg:flex-row gap-3 lg:items-end pb-4 border-b">
                    <div className="flex-1 min-w-0">
                      <Select value={selectedQuestionId} onValueChange={setSelectedQuestionId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecciona una pregunta" />
                        </SelectTrigger>
                        <SelectContent>
                          {data.questionBreakdowns.map((q) => (
                            <SelectItem key={q.questionId} value={q.questionId}>{q.text}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {chartTypeOptions.map((opt) => {
                        const Icon = opt.icon
                        return (
                          <button
                            key={opt.value}
                            onClick={() => setChartType(opt.value)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border transition-all ${chartType === opt.value ? "bg-[#18b0a4] text-white border-[#18b0a4]" : "bg-background text-muted-foreground border-border hover:bg-muted"}`}
                            title={opt.label}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{opt.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-sm w-fit">
                    <input type="checkbox" checked={showDataTable} onChange={(e) => setShowDataTable(e.target.checked)} className="rounded" />
                    <Table2 className="h-3.5 w-3.5" /> Mostrar tabla de datos
                  </label>

                  {selectedQuestion && (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="text-lg font-medium">{selectedQuestion.text}</h3>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{selectedQuestion.totalAnswers} respuestas</span>
                      </div>
                      {selectedQuestion.average && (
                        <p className="text-sm text-muted-foreground">Promedio: <span className="font-semibold text-foreground">{selectedQuestion.average}</span></p>
                      )}

                      <QuestionChart
                        type={chartType}
                        distribution={selectedQuestion.distribution}
                        timeline={selectedQuestion.timeline}
                        showLabels={true}
                      />

                      {showDataTable && selectedQuestion.distribution.length > 0 && (
                        <div className="rounded-md border overflow-hidden mt-4">
                          <div className="grid grid-cols-3 p-2 text-xs font-semibold text-muted-foreground uppercase bg-muted/50 border-b">
                            <div>Opción</div>
                            <div className="text-center">Respuestas</div>
                            <div className="text-center">Porcentaje</div>
                          </div>
                          <div className="divide-y">
                            {selectedQuestion.distribution.map((d, i) => (
                              <div key={i} className="grid grid-cols-3 p-2 text-sm">
                                <div className="truncate" title={d.label}>{d.label}</div>
                                <div className="text-center">{d.count}</div>
                                <div className="text-center">{d.percentage}%</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
