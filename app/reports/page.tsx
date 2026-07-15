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
import { BarChart3, Download, Loader2, PieChart, TrendingUp, TrendingDown, AlertCircle, Clock, Calendar, Zap, Target, BookOpen, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react"
// Note: PieChart kept for empty state icon
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
    responsesByHour: { hour: number; count: number }[]
    peakHour: number
    activeDays: number
    avgPerDay: number
    surveysWithData: number
    trendPct: number
    peakDay: { date: string; count: number } | null
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
    surveyPerformance: {
      title: string
      totalResponses: number
      completedResponses: number
      completionRate: number
      avgTime: string
    }[]
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
  const maxHourCount = Math.max(...(summary?.responsesByHour?.map((h) => h.count) || [1]))

  const formatHour = (h: number) => {
    const ampm = h < 12 ? "AM" : "PM"
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${display}:00 ${ampm}`
  }


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
              <div id="export-summary" className="space-y-6">

                {/* ── Fila 1: KPIs principales ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-export-chart>
                  {/* Total Respuestas */}
                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#18b0a4]/5 to-transparent pointer-events-none" />
                    <CardHeader className="pb-1 pt-4 px-4">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <BarChart3 className="h-3.5 w-3.5 text-[#18b0a4]" /> Total Respuestas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-3xl font-bold text-foreground">{summary?.totalResponses?.toLocaleString() ?? "0"}</div>
                      <div className="flex items-center gap-1 mt-1">
                        {(summary?.responseGrowth ?? 0) > 0 ? (
                          <ArrowUpRight className="h-3.5 w-3.5 text-[#18b0a4]" />
                        ) : (summary?.responseGrowth ?? 0) < 0 ? (
                          <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                        ) : (
                          <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <p className={`text-xs font-medium ${(summary?.responseGrowth ?? 0) > 0 ? "text-[#18b0a4]" : (summary?.responseGrowth ?? 0) < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                          {summary ? formatGrowth(summary.responseGrowth) : ""}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tasa Finalización — Donut */}
                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#18b0a4]/5 to-transparent pointer-events-none" />
                    <CardHeader className="pb-1 pt-4 px-4">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5 text-[#18b0a4]" /> Tasa de Finalización
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 flex items-center gap-3">
                      <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                          <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                          <circle cx="18" cy="18" r="14" fill="none" stroke="#18b0a4" strokeWidth="4"
                            strokeDasharray={`${(summary?.completionRate ?? 0) * 0.879} 87.9`}
                            strokeLinecap="round" />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                          {summary?.completionRate ?? 0}%
                        </span>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{summary?.completionRate ?? 0}%</div>
                        <p className="text-xs text-muted-foreground">
                          {Math.round(((summary?.completionRate ?? 0) / 100) * (summary?.totalResponses ?? 0))} completadas
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tiempo Promedio */}
                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#18b0a4]/5 to-transparent pointer-events-none" />
                    <CardHeader className="pb-1 pt-4 px-4">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-[#18b0a4]" /> Tiempo Promedio
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-3xl font-bold font-mono">{summary?.avgTime || "—"}</div>
                      <p className="text-xs text-muted-foreground mt-1">min:seg por encuesta</p>
                    </CardContent>
                  </Card>

                  {/* Preguntas Analizadas */}
                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#18b0a4]/5 to-transparent pointer-events-none" />
                    <CardHeader className="pb-1 pt-4 px-4">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-[#18b0a4]" /> Preguntas Analizadas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-3xl font-bold">{data?.responses?.questionBreakdowns?.length ?? 0}</div>
                      <p className="text-xs text-muted-foreground mt-1">con al menos 1 respuesta</p>
                    </CardContent>
                  </Card>
                </div>

                {/* ── Fila 2: KPIs secundarios ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Card className="border-dashed">
                    <CardContent className="pt-4 px-4 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Promedio / día</span>
                      </div>
                      <div className="text-2xl font-bold">{summary?.avgPerDay ?? 0}</div>
                      <p className="text-xs text-muted-foreground">{summary?.activeDays ?? 0} días activos</p>
                    </CardContent>
                  </Card>

                  <Card className="border-dashed">
                    <CardContent className="pt-4 px-4 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Hora pico</span>
                      </div>
                      <div className="text-2xl font-bold">
                        {summary?.totalResponses ? formatHour(summary.peakHour) : "—"}
                      </div>
                      <p className="text-xs text-muted-foreground">mayor actividad</p>
                    </CardContent>
                  </Card>

                  <Card className="border-dashed">
                    <CardContent className="pt-4 px-4 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Encuestas</span>
                      </div>
                      <div className="text-2xl font-bold">{summary?.surveysWithData ?? 0}</div>
                      <p className="text-xs text-muted-foreground">con respuestas</p>
                    </CardContent>
                  </Card>

                  <Card className="border-dashed">
                    <CardContent className="pt-4 px-4 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        {(summary?.trendPct ?? 0) >= 0
                          ? <TrendingUp className="h-4 w-4 text-[#18b0a4]" />
                          : <TrendingDown className="h-4 w-4 text-red-500" />}
                        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Tendencia</span>
                      </div>
                      <div className={`text-2xl font-bold ${(summary?.trendPct ?? 0) >= 0 ? "text-[#18b0a4]" : "text-red-500"}`}>
                        {(summary?.trendPct ?? 0) > 0 ? "+" : ""}{summary?.trendPct ?? 0}%
                      </div>
                      <p className="text-xs text-muted-foreground">2ª mitad vs 1ª mitad</p>
                    </CardContent>
                  </Card>
                </div>

                {/* ── Fila 3: Gráficos principales ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Timeline — ocupa 2 columnas */}
                  <Card className="lg:col-span-2" data-export-chart>
                    <CardHeader>
                      <CardTitle className="text-base">Evolución de Respuestas</CardTitle>
                      <CardDescription>Número de respuestas recibidas por día</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(summary?.responsesTimeline?.length ?? 0) === 0 ? (
                        <div className="h-56 flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No hay datos para el período</p>
                          </div>
                        </div>
                      ) : (
                        <div className="h-56 flex items-end gap-0.5 pt-6 relative">
                          {/* Grid lines */}
                          {[25, 50, 75].map((pct) => (
                            <div key={pct} className="absolute left-0 right-0 border-t border-dashed border-muted" style={{ bottom: `${pct}%` }} />
                          ))}
                          {summary!.responsesTimeline.map((d, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                              {/* Tooltip on hover */}
                              <div className="hidden group-hover:flex flex-col items-center absolute mb-1 z-10">
                                <div className="bg-foreground text-background text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap">
                                  {d.date.slice(5)}: {d.count}
                                </div>
                              </div>
                              <span className="text-[10px] text-muted-foreground mb-0.5 group-hover:text-primary transition-colors">{d.count > 0 ? d.count : ""}</span>
                              <div
                                className="w-full bg-primary/80 hover:bg-primary rounded-t-sm min-h-[3px] transition-all cursor-default"
                                style={{ height: `${Math.max((d.count / maxTimelineCount) * 100, 2)}%` }}
                              />
                              {summary!.responsesTimeline.length <= 18 && (
                                <span className="text-[9px] text-muted-foreground mt-1 truncate w-full text-center">
                                  {d.date.slice(5)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Donut grande completación */}
                  <Card data-export-chart>
                    <CardHeader>
                      <CardTitle className="text-base">Estado de Respuestas</CardTitle>
                      <CardDescription>Distribución completadas vs pendientes</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center h-56 gap-4">
                      {summary && summary.totalResponses > 0 ? (
                        <>
                          <div className="relative" style={{ width: 120, height: 120 }}>
                            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                              <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--muted))" strokeWidth="3.5" />
                              <circle cx="18" cy="18" r="14" fill="none" stroke="#18b0a4" strokeWidth="3.5"
                                strokeDasharray={`${summary.completionRate * 0.879} 87.9`}
                                strokeLinecap="round" className="transition-all duration-700" />
                              {(100 - summary.completionRate) > 0 && (
                                <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="3.5"
                                  strokeDasharray={`${(100 - summary.completionRate) * 0.879} 87.9`}
                                  strokeDashoffset={`${-summary.completionRate * 0.879}`}
                                  strokeLinecap="round" className="transition-all duration-700" />
                              )}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-2xl font-bold">{summary.completionRate}%</span>
                              <span className="text-[10px] text-muted-foreground">completadas</span>
                            </div>
                          </div>
                          <div className="w-full space-y-1.5 text-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "#18b0a4" }} />
                                <span className="text-muted-foreground">Completadas</span>
                              </div>
                              <span className="font-semibold">{Math.round((summary.completionRate / 100) * summary.totalResponses)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-slate-200 flex-shrink-0" />
                                <span className="text-muted-foreground">Incompletas</span>
                              </div>
                              <span className="font-semibold">{Math.round(((100 - summary.completionRate) / 100) * summary.totalResponses)}</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <PieChart className="h-10 w-10 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Sin respuestas aún</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* ── Fila 4: Hora del día + Insights ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Distribución por hora */}
                  <Card className="lg:col-span-2" data-export-chart>
                    <CardHeader>
                      <CardTitle className="text-base">Actividad por Hora del Día</CardTitle>
                      <CardDescription>¿A qué hora responden más las personas?</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(summary?.totalResponses ?? 0) === 0 ? (
                        <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
                      ) : (
                        <div className="h-40 flex items-end gap-px pt-4">
                          {(summary?.responsesByHour ?? []).map((h, i) => {
                            const isPeak = h.hour === summary?.peakHour && h.count > 0
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                                {h.count > 0 && (
                                  <div className="hidden group-hover:block absolute bottom-full mb-1 z-10 bg-foreground text-background text-[9px] px-1 py-0.5 rounded whitespace-nowrap">
                                    {formatHour(h.hour)}: {h.count}
                                  </div>
                                )}
                                <div
                                  className={`w-full rounded-t-sm min-h-[2px] transition-all ${isPeak ? "bg-primary" : "bg-primary/30 hover:bg-primary/60"}`}
                                  style={{ height: `${Math.max((h.count / maxHourCount) * 100, h.count > 0 ? 4 : 0)}%` }}
                                />
                                {i % 6 === 0 && (
                                  <span className="text-[9px] text-muted-foreground mt-1">{i}h</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {summary && summary.totalResponses > 0 && (
                        <p className="text-xs text-muted-foreground mt-3 text-center">
                          Pico de actividad: <span className="font-semibold text-primary">{formatHour(summary.peakHour)}</span>
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Insights automáticos */}
                  <Card className="bg-muted/30">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Zap className="h-4 w-4 text-yellow-500" />
                        Insights
                      </CardTitle>
                      <CardDescription>Análisis automático del período</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(summary?.totalResponses ?? 0) === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin datos para analizar</p>
                      ) : (
                        <ul className="space-y-3 text-sm">
                          {/* Tendencia */}
                          <li className="flex gap-2">
                            {(summary?.trendPct ?? 0) >= 0
                              ? <TrendingUp className="h-4 w-4 text-[#18b0a4] flex-shrink-0 mt-0.5" />
                              : <TrendingDown className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />}
                            <span className="text-muted-foreground">
                              Las respuestas <strong className={(summary?.trendPct ?? 0) >= 0 ? "text-[#18b0a4]" : "text-red-500"}>
                                {(summary?.trendPct ?? 0) >= 0 ? "subieron" : "bajaron"} {Math.abs(summary?.trendPct ?? 0)}%
                              </strong> en la segunda mitad del período
                            </span>
                          </li>
                          {/* Día más activo */}
                          {summary?.peakDay && (
                            <li className="flex gap-2">
                              <Calendar className="h-4 w-4 text-[#18b0a4] flex-shrink-0 mt-0.5" />
                              <span className="text-muted-foreground">
                                Día más activo: <strong className="text-foreground">{summary.peakDay.date.slice(5)}</strong> con {summary.peakDay.count} respuestas
                              </span>
                            </li>
                          )}
                          {/* Hora pico */}
                          <li className="flex gap-2">
                            <Clock className="h-4 w-4 text-[#18b0a4] flex-shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">
                              Mayor actividad a las <strong className="text-foreground">{formatHour(summary?.peakHour ?? 0)}</strong>
                            </span>
                          </li>
                          {/* Tasa finalización */}
                          <li className="flex gap-2">
                            <Target className="h-4 w-4 flex-shrink-0 mt-0.5 text-[#18b0a4]" />
                            <span className="text-muted-foreground">
                              {summary?.completionRate === 100
                                ? <><strong className="text-[#18b0a4]">100%</strong> de finalización — sin abandonos</>
                                : summary?.completionRate && summary.completionRate >= 80
                                ? <><strong className="text-[#18b0a4]">{summary.completionRate}%</strong> de finalización — muy buena tasa</>
                                : <><strong className="text-amber-500">{summary?.completionRate}%</strong> de finalización — revisar preguntas</>
                              }
                            </span>
                          </li>
                          {/* Velocidad */}
                          <li className="flex gap-2">
                            <BarChart3 className="h-4 w-4 text-[#18b0a4] flex-shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">
                              Promedio de <strong className="text-foreground">{summary?.avgPerDay ?? 0} resp/día</strong> en {summary?.activeDays ?? 0} días activos
                            </span>
                          </li>
                          {/* Preguntas */}
                          <li className="flex gap-2">
                            <BookOpen className="h-4 w-4 text-[#18b0a4] flex-shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">
                              <strong className="text-foreground">{data?.responses?.questionBreakdowns?.length ?? 0} preguntas</strong> con datos en este período
                            </span>
                          </li>
                        </ul>
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
              <div id="export-performance" className="space-y-6">

                {/* ── KPIs de rendimiento ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4 px-4 pb-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Total Respuestas</p>
                      <div className="text-3xl font-bold">{summary?.totalResponses?.toLocaleString() ?? 0}</div>
                      <p className="text-xs text-muted-foreground mt-1">en el período</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 px-4 pb-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Encuestas Activas</p>
                      <div className="text-3xl font-bold">{data?.performance?.surveyPerformance?.length ?? 0}</div>
                      <p className="text-xs text-muted-foreground mt-1">con respuestas</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 px-4 pb-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Encuestadores</p>
                      <div className="text-3xl font-bold">{data?.performance?.surveyorPerformance?.length ?? 0}</div>
                      <p className="text-xs text-muted-foreground mt-1">con asignaciones</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 px-4 pb-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Tasa Global</p>
                      <div className="text-3xl font-bold" style={{ color: "#18b0a4" }}>{summary?.completionRate ?? 0}%</div>
                      <p className="text-xs text-muted-foreground mt-1">finalización</p>
                    </CardContent>
                  </Card>
                </div>

                {/* ── Rendimiento por encuesta (siempre visible) ── */}
                <Card data-export-chart>
                  <CardHeader>
                    <CardTitle>Rendimiento por Encuesta</CardTitle>
                    <CardDescription>Respuestas, completación y tiempo promedio por encuesta</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(data?.performance?.surveyPerformance?.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground py-8 text-center">No hay respuestas registradas</p>
                    ) : (
                      <div className="rounded-md border overflow-hidden">
                        <div className="grid grid-cols-12 p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/50 border-b">
                          <div className="col-span-5">Encuesta</div>
                          <div className="col-span-2 text-center">Respuestas</div>
                          <div className="col-span-2 text-center">Completadas</div>
                          <div className="col-span-2 text-center">Tasa</div>
                          <div className="col-span-1 text-center">Tiempo</div>
                        </div>
                        <div className="divide-y">
                          {data!.performance.surveyPerformance.map((s, i) => (
                            <div key={i} className="grid grid-cols-12 px-3 py-3 items-center hover:bg-muted/20 transition-colors">
                              <div className="col-span-5 font-medium text-sm truncate pr-3" title={s.title}>{s.title}</div>
                              <div className="col-span-2 text-center text-sm">{s.totalResponses}</div>
                              <div className="col-span-2 text-center text-sm">{s.completedResponses}</div>
                              <div className="col-span-2 text-center">
                                <span className="inline-flex items-center gap-1">
                                  <span
                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{ background: s.completionRate >= 80 ? "#18b0a4" : s.completionRate >= 50 ? "#f59e0b" : "#ef4444" }}
                                  />
                                  <span className="text-sm font-semibold" style={{ color: s.completionRate >= 80 ? "#18b0a4" : s.completionRate >= 50 ? "#f59e0b" : "#ef4444" }}>
                                    {s.completionRate}%
                                  </span>
                                </span>
                              </div>
                              <div className="col-span-1 text-center text-xs text-muted-foreground font-mono">{s.avgTime}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* ── Rendimiento por encuestador (si hay assignments) ── */}
                {(data?.performance?.surveyorPerformance?.length ?? 0) > 0 && (
                  <Card data-export-chart>
                    <CardHeader>
                      <CardTitle>Rendimiento por Encuestador</CardTitle>
                      <CardDescription>Asignaciones completadas vs pendientes por encuestador</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border overflow-hidden">
                        <div className="grid grid-cols-4 p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/50 border-b">
                          <div>Encuestador</div>
                          <div className="text-center">Asignaciones</div>
                          <div className="text-center">Completadas</div>
                          <div className="text-center">Tasa</div>
                        </div>
                        <div className="divide-y">
                          {data!.performance.surveyorPerformance.map((s, i) => (
                            <div key={i} className="grid grid-cols-4 p-3 items-center hover:bg-muted/20 transition-colors">
                              <div className="font-medium text-sm">{s.name}</div>
                              <div className="text-center text-sm">{s.totalAssignments}</div>
                              <div className="text-center text-sm">{s.completedAssignments}</div>
                              <div className="text-center">
                                <span className="text-sm font-semibold" style={{ color: s.completionRate >= 80 ? "#18b0a4" : s.completionRate >= 50 ? "#f59e0b" : "#ef4444" }}>
                                  {s.completionRate}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── Distribución semanal ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card data-export-chart>
                    <CardHeader>
                      <CardTitle className="text-base">Actividad por Día de la Semana</CardTitle>
                      <CardDescription>¿Qué días se reciben más respuestas?</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-48 flex items-end gap-3 pt-4">
                        {data?.performance?.dailyDistribution?.map((d, i) => {
                          const isMax = d.count === maxDailyCount && d.count > 0
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                              <span className="text-xs text-muted-foreground mb-1">{d.count > 0 ? d.count : ""}</span>
                              <div
                                className="w-full rounded-t-sm min-h-[4px] transition-all"
                                style={{
                                  height: `${Math.max((d.count / maxDailyCount) * 100, d.count > 0 ? 3 : 0)}%`,
                                  background: isMax ? "#18b0a4" : "#18b0a420",
                                }}
                              />
                              <span className="text-xs text-muted-foreground mt-1.5 font-medium">{d.day}</span>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-export-chart>
                    <CardHeader>
                      <CardTitle className="text-base">Velocidad de Campo</CardTitle>
                      <CardDescription>Ritmo de recolección de respuestas</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 pt-2">
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground">Respuestas totales</span>
                        <span className="text-xl font-bold">{summary?.totalResponses?.toLocaleString() ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground">Días con actividad</span>
                        <span className="text-xl font-bold">{summary?.activeDays ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground">Promedio diario</span>
                        <span className="text-xl font-bold" style={{ color: "#18b0a4" }}>{summary?.avgPerDay ?? 0} resp/día</span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-muted-foreground">Tiempo promedio</span>
                        <span className="text-xl font-bold font-mono">{summary?.avgTime || "—"}</span>
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
