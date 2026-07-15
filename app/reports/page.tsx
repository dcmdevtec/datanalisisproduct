"use client"

import { useEffect, useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart3, Download, Loader2, PieChart, TrendingUp, AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { exportSummary, exportResponses, exportPerformance, exportGeographic } from "@/app/lib/export-report"

// Dynamic import del mapa para evitar problemas SSR con Leaflet
const ReportsGeoMap = dynamic(() => import("@/components/reports-geo-map"), {
  ssr: false,
  loading: () => <div className="w-full rounded-xl bg-muted animate-pulse" style={{ height: 460 }} />,
})

interface ReportData {
  companies: { id: string; name: string }[]
  projects: { id: string; name: string; companyId: string }[]
  surveys: { id: string; title: string; projectId: string }[]
  summary: {
    totalResponses: number
    completionRate: number
    avgTime: string
    nps: number | null
    responseGrowth: number
    responsesTimeline: { date: string; count: number }[]
  }
  responses: {
    questionBreakdowns: {
      questionId: string
      text: string
      type: string
      totalAnswers: number
      average?: string
      distribution?: { label: string; count: number; percentage: number }[]
      sampleAnswers?: string[]
    }[]
  }
  performance: {
    surveyorPerformance: {
      name: string
      totalAssignments: number
      completedAssignments: number
      completionRate: number
    }[]
    dailyDistribution: { day: string; count: number }[]
  }
  geographic: {
    zoneBreakdown: {
      zone: string
      responseCount: number
      completedCount: number
      percentage: number
      completionRate: number
    }[]
    zonePolygons: {
      id: string
      name: string
      geometry: any
      zoneColor: string
      responseCount: number
      completedCount: number
      completionRate: number
    }[]
    responsePoints: {
      lat: number
      lng: number
      status: string
      createdAt: string
      source?: string
    }[]
  }
}

function formatGrowth(value: number): string {
  if (value === 0) return "Sin cambios"
  const sign = value > 0 ? "+" : ""
  return `${sign}${value}% vs período anterior`
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<string | null>(null)
  const [data, setData] = useState<ReportData | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<string>("all")
  const [selectedProject, setSelectedProject] = useState<string>("all")
  const [selectedSurvey, setSelectedSurvey] = useState<string>("all")
  const [selectedPeriod, setSelectedPeriod] = useState<string>("month")

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  // Reset cascading filters when parent changes
  const handleCompanyChange = (v: string) => {
    setSelectedCompany(v)
    setSelectedProject("all")
    setSelectedSurvey("all")
  }
  const handleProjectChange = (v: string) => {
    setSelectedProject(v)
    setSelectedSurvey("all")
  }

  // Filtered dropdown options based on cascading selection
  const filteredProjects = data?.projects?.filter(
    (p) => selectedCompany === "all" || p.companyId === selectedCompany
  ) ?? []
  const filteredSurveys = data?.surveys?.filter(
    (s) => {
      if (selectedSurvey !== "all") return true // show all when a specific survey is selected
      if (selectedProject !== "all") return s.projectId === selectedProject
      if (selectedCompany !== "all") {
        const projIds = filteredProjects.map((p) => p.id)
        return projIds.includes(s.projectId)
      }
      return true
    }
  ) ?? []

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        company: selectedCompany,
        project: selectedProject,
        survey: selectedSurvey,
        period: selectedPeriod,
      })
      const res = await fetch(`/api/reports?${params}`)
      if (!res.ok) throw new Error("fetch failed")
      const json = await res.json()
      setData(json)
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar los reportes", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [user, selectedCompany, selectedProject, selectedSurvey, selectedPeriod, toast])

  const handleExport = async (tab: string) => {
    if (!data) return
    setExporting(tab)
    try {
      switch (tab) {
        case "summary":
          await exportSummary(data, selectedPeriod)
          break
        case "responses":
          await exportResponses(data, selectedPeriod)
          break
        case "performance":
          await exportPerformance(data, selectedPeriod)
          break
        case "geographic":
          await exportGeographic(data, selectedPeriod)
          break
      }
      toast({ title: "Exportado", description: "El reporte se descargó correctamente" })
    } catch {
      toast({ title: "Error", description: "No se pudo exportar el reporte", variant: "destructive" })
    } finally {
      setExporting(null)
    }
  }

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (authLoading || !user) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }

  const summary = data?.summary
  const maxTimelineCount = Math.max(...(summary?.responsesTimeline?.map((d) => d.count) || [1]))
  const maxDailyCount = Math.max(...(data?.performance?.dailyDistribution?.map((d) => d.count) || [1]))
  const maxZoneResponses = Math.max(...(data?.geographic?.zoneBreakdown?.map((z) => z.responseCount) || [1]))

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Reportes y Análisis</h1>
            <p className="text-muted-foreground">Visualiza y analiza los datos recopilados</p>
          </div>
          <div className="mt-10 flex flex-col sm:flex-row gap-2 flex-wrap">
            <Select value={selectedCompany} onValueChange={handleCompanyChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las empresas</SelectItem>
                {data?.companies?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedProject} onValueChange={handleProjectChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Proyecto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los proyectos</SelectItem>
                {filteredProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedSurvey} onValueChange={setSelectedSurvey}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Encuesta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las encuestas</SelectItem>
                {filteredSurveys.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Seleccionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Última semana</SelectItem>
                <SelectItem value="month">Último mes</SelectItem>
                <SelectItem value="quarter">Último trimestre</SelectItem>
                <SelectItem value="year">Último año</SelectItem>
                <SelectItem value="all">Todo el tiempo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList>
            <TabsTrigger value="summary">Resumen</TabsTrigger>
            <TabsTrigger value="responses">Respuestas</TabsTrigger>
            <TabsTrigger value="performance">Rendimiento</TabsTrigger>
            <TabsTrigger value="geographic">Geográfico</TabsTrigger>
          </TabsList>

          {/* ==================== RESUMEN ==================== */}
          <TabsContent value="summary" className="space-y-6">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport("summary")} disabled={exporting === "summary"}>
                {exporting === "summary" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exporting === "summary" ? "Exportando..." : "Exportar Resumen"}
              </Button>
            </div>
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div id="export-summary">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-export-chart>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Total de Respuestas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{summary?.totalResponses?.toLocaleString() ?? "0"}</div>
                      <p className="text-xs text-muted-foreground">{summary ? formatGrowth(summary.responseGrowth) : ""}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Tasa de Finalización</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{summary?.completionRate ?? 0}%</div>
                      <p className="text-xs text-muted-foreground">Encuestas completadas vs iniciadas</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{summary?.avgTime || "—"}</div>
                      <p className="text-xs text-muted-foreground">Minutos:segundos por encuesta</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">NPS</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{summary?.nps ?? "—"}</div>
                      <p className="text-xs text-muted-foreground">{summary?.nps !== null ? "Net Promoter Score" : "Sin datos de NPS"}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card data-export-chart>
                    <CardHeader>
                      <CardTitle>Respuestas por Tiempo</CardTitle>
                      <CardDescription>Evolución de respuestas en el período</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(summary?.responsesTimeline?.length ?? 0) === 0 ? (
                        <div className="h-80 flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No hay datos para el período seleccionado</p>
                          </div>
                        </div>
                      ) : (
                        <div className="h-80 flex items-end gap-1 pt-4">
                          {summary!.responsesTimeline.map((d, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                              <span className="text-xs text-muted-foreground mb-1">{d.count}</span>
                              <div
                                className="w-full bg-primary rounded-t-sm min-h-[4px]"
                                style={{ height: `${Math.max((d.count / maxTimelineCount) * 100, 2)}%` }}
                              />
                              {summary!.responsesTimeline.length <= 14 && (
                                <span className="text-[10px] text-muted-foreground mt-1 truncate w-full text-center">
                                  {d.date.slice(5)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card data-export-chart>
                    <CardHeader>
                      <CardTitle>Distribución por Estado</CardTitle>
                      <CardDescription>Estado de las respuestas</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80 flex items-center justify-center">
                      {summary && summary.totalResponses > 0 ? (
                        <div className="w-full space-y-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Completadas</span>
                              <span className="font-medium">{summary.completionRate}%</span>
                            </div>
                            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full" style={{ width: `${summary.completionRate}%` }} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Incompletas</span>
                              <span className="font-medium">{100 - summary.completionRate}%</span>
                            </div>
                            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-orange-400 rounded-full" style={{ width: `${100 - summary.completionRate}%` }} />
                            </div>
                          </div>
                          <div className="pt-4 text-center text-sm text-muted-foreground">
                            {summary.totalResponses.toLocaleString()} respuestas totales
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <PieChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No hay respuestas</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ==================== RESPUESTAS ==================== */}
          <TabsContent value="responses" className="space-y-6">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport("responses")} disabled={exporting === "responses"}>
                {exporting === "responses" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exporting === "responses" ? "Exportando..." : "Exportar Respuestas"}
              </Button>
            </div>
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (data?.responses?.questionBreakdowns?.length ?? 0) === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No hay datos de respuestas para el período y encuesta seleccionados</p>
                </CardContent>
              </Card>
            ) : (
              <Card id="export-responses" data-export-chart>
                <CardHeader>
                  <CardTitle>Análisis de Respuestas</CardTitle>
                  <CardDescription>Desglose detallado por pregunta ({data!.responses.questionBreakdowns.length} preguntas con respuestas)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  {data!.responses.questionBreakdowns.map((qb) => (
                    <div key={qb.questionId} className="space-y-4 pb-6 border-b last:border-0">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="text-lg font-medium">{qb.text || "Pregunta sin texto"}</h3>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{qb.totalAnswers} respuestas</span>
                      </div>

                      {qb.distribution && qb.distribution.length > 0 ? (
                        <>
                          {qb.average && (
                            <p className="text-sm text-muted-foreground">Promedio: <span className="font-semibold text-foreground">{qb.average}</span></p>
                          )}
                          <div className="space-y-2">
                            {qb.distribution.map((d, i) => (
                              <div key={i} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="truncate max-w-[60%]">{d.label}</span>
                                  <span className="text-muted-foreground">{d.count} ({d.percentage}%)</span>
                                </div>
                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full" style={{ width: `${d.percentage}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : qb.sampleAnswers && qb.sampleAnswers.length > 0 ? (
                        <div className="space-y-2">
                          {qb.sampleAnswers.map((ans, i) => (
                            <div key={i} className="p-3 border rounded-md">
                              <p className="text-sm text-muted-foreground">&ldquo;{ans}&rdquo;</p>
                            </div>
                          ))}
                          {qb.totalAnswers > 5 && (
                            <p className="text-xs text-muted-foreground">Mostrando 5 de {qb.totalAnswers} respuestas</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sin datos para mostrar</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ==================== RENDIMIENTO ==================== */}
          <TabsContent value="performance" className="space-y-6">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport("performance")} disabled={exporting === "performance"}>
                {exporting === "performance" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exporting === "performance" ? "Exportando..." : "Exportar Rendimiento"}
              </Button>
            </div>
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div id="export-performance">
                <Card data-export-chart>
                  <CardHeader>
                    <CardTitle>Rendimiento de Encuestadores</CardTitle>
                    <CardDescription>Métricas de productividad por encuestador</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(data?.performance?.surveyorPerformance?.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground py-8 text-center">No hay datos de encuestadores</p>
                    ) : (
                      <div className="space-y-4">
                        <div className="rounded-md border">
                          <div className="grid grid-cols-4 p-3 font-medium border-b">
                            <div>Encuestador</div>
                            <div className="text-center">Asignaciones</div>
                            <div className="text-center">Completadas</div>
                            <div className="text-center">Tasa de Finalización</div>
                          </div>
                          <div className="divide-y">
                            {data!.performance.surveyorPerformance.map((s, i) => (
                              <div key={i} className="grid grid-cols-4 p-3 items-center">
                                <div className="font-medium">{s.name}</div>
                                <div className="text-center">{s.totalAssignments}</div>
                                <div className="text-center">{s.completedAssignments}</div>
                                <div className="text-center">
                                  <span className={s.completionRate >= 80 ? "text-green-600" : s.completionRate >= 50 ? "text-orange-500" : "text-red-500"}>
                                    {s.completionRate}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card data-export-chart>
                    <CardHeader>
                      <CardTitle>Respuestas por Día de la Semana</CardTitle>
                      <CardDescription>Distribución semanal de respuestas</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 flex items-end gap-3 pt-4">
                        {data?.performance?.dailyDistribution?.map((d, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                            <span className="text-xs text-muted-foreground mb-1">{d.count}</span>
                            <div
                              className="w-full bg-primary rounded-t-sm min-h-[4px]"
                              style={{ height: `${Math.max((d.count / maxDailyCount) * 100, 2)}%` }}
                            />
                            <span className="text-xs text-muted-foreground mt-1">{d.day}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card data-export-chart>
                    <CardHeader>
                      <CardTitle>Resumen General</CardTitle>
                      <CardDescription>Indicadores clave de rendimiento</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Total encuestadores</span>
                        <span className="text-2xl font-bold">{data?.performance?.surveyorPerformance?.length ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Promedio de finalización</span>
                        <span className="text-2xl font-bold">
                          {data?.performance?.surveyorPerformance && data.performance.surveyorPerformance.length > 0
                            ? Math.round(data.performance.surveyorPerformance.reduce((s, p) => s + p.completionRate, 0) / data.performance.surveyorPerformance.length)
                            : 0}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Total respuestas período</span>
                        <span className="text-2xl font-bold">{summary?.totalResponses?.toLocaleString() ?? 0}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ==================== GEOGRÁFICO ==================== */}
          <TabsContent value="geographic" className="space-y-6">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport("geographic")} disabled={exporting === "geographic"}>
                {exporting === "geographic" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exporting === "geographic" ? "Exportando..." : "Exportar Geográfico"}
              </Button>
            </div>
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div id="export-geographic" className="space-y-6">
                {/* ── Mapa interactivo ── */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">Mapa de Respuestas</CardTitle>
                        <CardDescription>
                          Visualización geográfica de zonas y puntos de respuesta
                        </CardDescription>
                      </div>
                      {(data?.geographic?.responsePoints?.length ?? 0) > 0 && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                          {data!.geographic.responsePoints.length.toLocaleString()} puntos
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <ReportsGeoMap
                      zonePolygons={data?.geographic?.zonePolygons ?? []}
                      responsePoints={data?.geographic?.responsePoints ?? []}
                    />
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card data-export-chart>
                    <CardHeader>
                      <CardTitle>Respuestas por Zona</CardTitle>
                      <CardDescription>Distribución de asignaciones por zona geográfica</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(data?.geographic?.zoneBreakdown?.length ?? 0) === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">No hay datos de zonas disponibles</p>
                      ) : (
                        <div className="space-y-4">
                          {data!.geographic.zoneBreakdown.map((z, i) => (
                            <div key={i} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{z.zone}</span>
                                <span className="text-sm text-muted-foreground">{z.responseCount} asignaciones</span>
                              </div>
                              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${Math.max((z.responseCount / maxZoneResponses) * 100, 2)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card data-export-chart>
                    <CardHeader>
                      <CardTitle>Comparativa por Zona</CardTitle>
                      <CardDescription>Tasa de finalización por zona</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(data?.geographic?.zoneBreakdown?.length ?? 0) === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">No hay datos de zonas</p>
                      ) : (
                        <div className="rounded-md border">
                          <div className="grid grid-cols-4 p-3 font-medium border-b">
                            <div>Zona</div>
                            <div className="text-center">Asignaciones</div>
                            <div className="text-center">Completadas</div>
                            <div className="text-center">Tasa</div>
                          </div>
                          <div className="divide-y">
                            {data!.geographic.zoneBreakdown.map((z, i) => (
                              <div key={i} className="grid grid-cols-4 p-3 items-center">
                                <div>{z.zone}</div>
                                <div className="text-center">{z.responseCount}</div>
                                <div className="text-center">{z.completedCount}</div>
                                <div className="text-center">
                                  <span className={z.completionRate >= 80 ? "text-green-600" : z.completionRate >= 50 ? "text-orange-500" : "text-red-500"}>
                                    {z.completionRate}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
