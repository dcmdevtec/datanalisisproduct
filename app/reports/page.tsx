"use client"

import { useEffect, useState, useCallback, useMemo, Suspense } from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  BarChart3, Download, Loader2, PieChart as PieChartIcon, TrendingUp, TrendingDown, AlertCircle,
  Clock, Calendar, Zap, Target, BookOpen, ArrowUpRight, ArrowDownRight, Minus,
  CheckCircle2, AlertTriangle, XCircle, Users2, ChartPie, ChartNoAxesColumn, ChartBarBig, LineChart as LineChartIcon, Table2, Tags, Grid3x3,
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { exportSummary, exportResponses, exportPerformance, exportGeographic } from "@/app/lib/export-report"
import { QuestionChart, type ChartType } from "@/components/reports/question-chart"
import { IndividualResponsesTab } from "@/components/reports/individual-responses-tab"
import { SortablePerformanceTable, type SurveyorPerformanceRow } from "@/components/reports/sortable-performance-table"

// Dynamic import del mapa para evitar problemas SSR con Leaflet
const ReportsGeoMap = dynamic(() => import("@/components/reports-geo-map"), {
  ssr: false,
  loading: () => <div className="w-full rounded-xl bg-muted animate-pulse" style={{ height: 460 }} />,
})

interface ReportData {
  companies: { id: string; name: string }[]
  projects: { id: string; name: string; companyId: string }[]
  surveys: { id: string; title: string; projectId: string }[]
  surveyors: { id: string; name: string; supervisorId: string | null }[]
  // Slide 19: jerarquía Encuestador -> Supervisor -> Coordinador.
  supervisors?: { id: string; name: string }[]
  coordinators?: { id: string; name: string }[]
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
    efectivas: number
    incidencias: number
    abandonadas: number
    tasaRespuestasEfectivas: number
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
      timeline?: { date: string; count: number }[]
    }[]
    // Preguntas usables para el filtro avanzado (slide 21), con sus valores posibles.
    filterableQuestions?: { questionId: string; text: string; values: string[] }[]
    // Tablas cruzadas (slide 21): cruce de respuestas entre dos preguntas.
    crosstab?: {
      rowQuestion: string; colQuestion: string
      rows: string[]; cols: string[]; matrix: number[][]
      rowTotals: number[]; colTotals: number[]; total: number
    } | null
  }
  performance: {
    surveyorPerformance: {
      name: string
      supervisorId: string | null
      totalAssignments: number
      completedAssignments: number
      completionRate: number
      efectivas: number
      incidencias: number
      abandonadas: number
      totalRegistros: number
      tasaRespuestas: number
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
      outcome?: "efectiva" | "incidencia" | "abandonada" | null
      createdAt: string
      surveyorName?: string | null
      respondentName?: string | null
      durationSecs?: number | null
      source?: string
    }[]
  }
}

function formatGrowth(value: number): string {
  if (value === 0) return "Sin cambios"
  const sign = value > 0 ? "+" : ""
  return `${sign}${value}% vs período anterior`
}

const chartTypeOptions: { value: ChartType; label: string; icon: typeof ChartPie }[] = [
  { value: "pie", label: "Torta", icon: ChartPie },
  { value: "donut", label: "Anillo", icon: PieChartIcon },
  { value: "barsV", label: "Barras verticales", icon: ChartBarBig },
  { value: "barsH", label: "Barras horizontales", icon: ChartNoAxesColumn },
  { value: "trend", label: "Tendencia", icon: LineChartIcon },
]

function ReportsPageContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<string | null>(null)
  const [data, setData] = useState<ReportData | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<string>("all")
  const [selectedProject, setSelectedProject] = useState<string>("all")
  const [selectedSurvey, setSelectedSurvey] = useState<string>("all")
  const [selectedSurveyor, setSelectedSurveyor] = useState<string>("all")
  // Slide 19: filtros de jerarquía. Elegir un coordinador ya incluye a todos
  // los supervisores/encuestadores debajo de él (ver resolución en la API).
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("all")
  const [selectedCoordinator, setSelectedCoordinator] = useState<string>("all")
  const [selectedTipo, setSelectedTipo] = useState<string>("all")
  // Rango de fechas real (pptx slide 19), reemplaza el selector de "período" fijo.
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")

  // Estado del selector de gráficos en "Análisis de resultados" (slide 21)
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("")
  const [chartType, setChartType] = useState<ChartType>("barsV")
  const [showDataTable, setShowDataTable] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  // Galería de archivos: se carga cuando la pregunta seleccionada es de tipo file/image_upload
  const [fileGallery, setFileGallery] = useState<{ answerId: string; path: string; name: string; type: string; url: string }[]>([])
  const [fileGalleryLoading, setFileGalleryLoading] = useState(false)

  // Filtro avanzado (slide 21): "filtrar las gráficas según lo que contestaron
  // en una pregunta en particular". Se aplica a todo el reporte vía filterParams.
  const [advancedFilterQuestionId, setAdvancedFilterQuestionId] = useState<string>("")
  const [advancedFilterValue, setAdvancedFilterValue] = useState<string>("")

  // Tablas cruzadas (slide 21): cruce de dos preguntas de tipo choice/rating.
  const [crossRowQuestionId, setCrossRowQuestionId] = useState<string>("")
  const [crossColQuestionId, setCrossColQuestionId] = useState<string>("")

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  // Preseleccionar encuesta desde la URL (ej. ?survey=<id>) — usado por el
  // botón "Reporte" en app/surveys/page.tsx para llevar directo al reporte
  // de una encuesta puntual en vez de aterrizar en el filtro "Todas".
  useEffect(() => {
    const surveyParam = searchParams.get("survey")
    if (surveyParam) {
      setSelectedSurvey(surveyParam)
    }
  }, [searchParams])

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

  // Query string de filtros globales, reutilizado por el fetch principal y por
  // la pestaña de Respuestas Individuales (que pagina por su cuenta).
  const filterParams = useMemo(() => {
    const params = new URLSearchParams({
      company: selectedCompany,
      project: selectedProject,
      survey: selectedSurvey,
      surveyor: selectedSurveyor,
      supervisor: selectedSupervisor,
      coordinator: selectedCoordinator,
      tipo: selectedTipo,
    })
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)
    if (advancedFilterQuestionId && advancedFilterValue) {
      params.set("filterQuestionId", advancedFilterQuestionId)
      params.set("filterValue", advancedFilterValue)
    }
    if (crossRowQuestionId && crossColQuestionId) {
      params.set("crossRowQuestionId", crossRowQuestionId)
      params.set("crossColQuestionId", crossColQuestionId)
    }
    return params
  }, [selectedCompany, selectedProject, selectedSurvey, selectedSurveyor, selectedSupervisor, selectedCoordinator, selectedTipo, dateFrom, dateTo, advancedFilterQuestionId, advancedFilterValue, crossRowQuestionId, crossColQuestionId])

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await fetch(`/api/reports?${filterParams}`)
      if (!res.ok) throw new Error("fetch failed")
      const json = await res.json()
      setData(json)
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar los reportes", variant: "destructive" })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filterParams.toString(), toast])

  const handleExport = async (tab: string) => {
    if (!data) return
    setExporting(tab)
    try {
      const periodLabel = dateFrom || dateTo ? `${dateFrom || "inicio"}_a_${dateTo || "hoy"}` : "todo"
      switch (tab) {
        case "summary":
          await exportSummary(data, periodLabel)
          break
        case "responses":
          await exportResponses(data, periodLabel)
          break
        case "performance":
          await exportPerformance(data, periodLabel)
          break
        case "geographic":
          await exportGeographic(data, periodLabel)
          break
      }
      toast({ title: "Exportado", description: "El reporte se descargó correctamente" })
    } catch {
      toast({ title: "Error", description: "No se pudo exportar el reporte", variant: "destructive" })
    } finally {
      setExporting(null)
    }
  }

  // Compartir link público de resultados (slide 21: "compartir un link para que la
  // persona que lo tenga pueda verlo en línea"). El link apunta a la vista pública
  // de resultados de la encuesta seleccionada.
  const handleShareLink = async () => {
    if (selectedSurvey === "all") {
      toast({ title: "Selecciona una encuesta", description: "Para compartir resultados primero elige una encuesta específica en los filtros", variant: "destructive" })
      return
    }
    const url = `${window.location.origin}/reports/public/${selectedSurvey}`
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: "Link copiado", description: "El enlace de resultados públicos se copió al portapapeles" })
    } catch {
      toast({ title: "Link de resultados", description: url })
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

  const questionBreakdowns = data?.responses?.questionBreakdowns ?? []
  const selectedQuestion = questionBreakdowns.find((q) => q.questionId === selectedQuestionId) ?? questionBreakdowns[0]

  // Carga galería de archivos cuando la pregunta seleccionada es file/image_upload
  useEffect(() => {
    if (!selectedQuestion || !["file", "image_upload"].includes(selectedQuestion.type)) {
      setFileGallery([])
      return
    }
    let cancelled = false
    setFileGalleryLoading(true)
    setFileGallery([])
    const params = new URLSearchParams({ questionId: selectedQuestion.questionId })
    if (selectedSurvey !== "all") params.set("survey", selectedSurvey)
    fetch(`/api/response-files/signed-urls?${params}`)
      .then((r) => r.json())
      .then((json) => { if (!cancelled) setFileGallery(json.files || []) })
      .catch(() => { if (!cancelled) setFileGallery([]) })
      .finally(() => { if (!cancelled) setFileGalleryLoading(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuestion?.questionId, selectedSurvey])

  const surveyorRows: SurveyorPerformanceRow[] = (data?.performance?.surveyorPerformance ?? []).map((s) => ({
    name: s.name,
    supervisorId: s.supervisorId,
    totalRegistros: s.totalRegistros,
    incidencias: s.incidencias,
    abandonadas: s.abandonadas,
    efectivas: s.efectivas,
    tasaRespuestas: s.tasaRespuestas,
    completionRate: s.completionRate,
  }))

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Reportes y Análisis</h1>
            <p className="text-muted-foreground">Visualiza y analiza los datos recopilados</p>
          </div>

          {/* ── Filtros globales (pptx slide 19): aplican a las 5 pestañas ── */}
          <div className="flex flex-col sm:flex-row gap-2 flex-wrap items-end">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Empresa</Label>
              <Select value={selectedCompany} onValueChange={handleCompanyChange}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las empresas</SelectItem>
                  {data?.companies?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Proyecto</Label>
              <Select value={selectedProject} onValueChange={handleProjectChange}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Proyecto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los proyectos</SelectItem>
                  {filteredProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Encuesta</Label>
              <Select value={selectedSurvey} onValueChange={setSelectedSurvey}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Encuesta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las encuestas</SelectItem>
                  {filteredSurveys.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Encuestador</Label>
              <Select value={selectedSurveyor} onValueChange={setSelectedSurveyor}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Encuestador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {data?.surveyors?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Supervisor</Label>
              <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Supervisor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {data?.supervisors?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Coordinador</Label>
              <Select value={selectedCoordinator} onValueChange={setSelectedCoordinator}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Coordinador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {data?.coordinators?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Tipo de encuesta</Label>
              <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="efectiva">Efectiva</SelectItem>
                  <SelectItem value="incidencia">Incidencia</SelectItem>
                  <SelectItem value="abandonada">Abandonada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Desde</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full sm:w-[150px]" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Hasta</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full sm:w-[150px]" />
            </div>
            {(dateFrom || dateTo || selectedSurveyor !== "all" || selectedSupervisor !== "all" || selectedCoordinator !== "all" || selectedTipo !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setDateFrom(""); setDateTo(""); setSelectedSurveyor("all"); setSelectedSupervisor("all"); setSelectedCoordinator("all"); setSelectedTipo("all") }}
              >
                Limpiar filtros
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Tags className="h-3 w-3" />
            &quot;Efectiva / Incidencia / Abandonada&quot; se calcula automáticamente a partir del estado de la respuesta mientras la app no envíe la clasificación completa (ver nota en Resumen).
          </p>
        </div>

        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="summary">Resumen</TabsTrigger>
            <TabsTrigger value="responses">Análisis de resultados</TabsTrigger>
            <TabsTrigger value="individual">Respuestas Individuales</TabsTrigger>
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

                {/* ── Fila 1: KPIs de tipo de encuesta (pptx slide 20) ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-export-chart>
                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#18b0a4]/5 to-transparent pointer-events-none" />
                    <CardHeader className="pb-1 pt-4 px-4">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <BarChart3 className="h-3.5 w-3.5 text-[#18b0a4]" /> Total Registros
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

                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#18b0a4]/5 to-transparent pointer-events-none" />
                    <CardHeader className="pb-1 pt-4 px-4">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#18b0a4]" /> Encuestas Efectivas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-3xl font-bold text-[#18b0a4]">{summary?.efectivas?.toLocaleString() ?? "0"}</div>
                      <p className="text-xs text-muted-foreground mt-1">{summary?.tasaRespuestasEfectivas ?? 0}% del total</p>
                    </CardContent>
                  </Card>

                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />
                    <CardHeader className="pb-1 pt-4 px-4">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Incidencias
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-3xl font-bold text-red-500">{summary?.incidencias?.toLocaleString() ?? "0"}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(summary?.totalResponses ?? 0) > 0 ? Math.round(((summary?.incidencias ?? 0) / (summary?.totalResponses || 1)) * 100) : 0}% del total
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
                    <CardHeader className="pb-1 pt-4 px-4">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5 text-amber-500" /> Encuestas Abandonadas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-3xl font-bold text-amber-500">{summary?.abandonadas?.toLocaleString() ?? "0"}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(summary?.totalResponses ?? 0) > 0 ? Math.round(((summary?.abandonadas ?? 0) / (summary?.totalResponses || 1)) * 100) : 0}% del total
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {!(data?.summary?.incidencias) && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-3 border border-dashed">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                      &quot;Incidencias&quot; siempre muestra 0 hasta que la APK empiece a enviar la clasificación de cada respuesta
                      (pantalla previa a la encuesta). Mientras tanto, &quot;Efectivas&quot; y &quot;Abandonadas&quot; se calculan a partir
                      del estado actual de la respuesta como una aproximación razonable.
                    </span>
                  </div>
                )}

                {/* ── Fila 2: KPIs principales ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-export-chart>
                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#18b0a4]/5 to-transparent pointer-events-none" />
                    <CardHeader className="pb-1 pt-4 px-4">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5 text-[#18b0a4]" /> Tasa de Respuestas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 flex items-center gap-3">
                      <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                          <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                          <circle cx="18" cy="18" r="14" fill="none" stroke="#18b0a4" strokeWidth="4"
                            strokeDasharray={`${(summary?.tasaRespuestasEfectivas ?? 0) * 0.879} 87.9`}
                            strokeLinecap="round" />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                          {summary?.tasaRespuestasEfectivas ?? 0}%
                        </span>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{summary?.tasaRespuestasEfectivas ?? 0}%</div>
                        <p className="text-xs text-muted-foreground">efectivas / total</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#18b0a4]/5 to-transparent pointer-events-none" />
                    <CardHeader className="pb-1 pt-4 px-4">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-[#18b0a4]" /> Tiempo Promedio
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-3xl font-bold font-mono">{summary?.avgTime || "—"}</div>
                      <p className="text-xs text-muted-foreground mt-1">min:seg por encuesta efectiva</p>
                    </CardContent>
                  </Card>

                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#18b0a4]/5 to-transparent pointer-events-none" />
                    <CardHeader className="pb-1 pt-4 px-4">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <Users2 className="h-3.5 w-3.5 text-[#18b0a4]" /> Total Encuestadores
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-3xl font-bold">{data?.performance?.surveyorPerformance?.length ?? 0}</div>
                      <p className="text-xs text-muted-foreground mt-1">con registros en el período</p>
                    </CardContent>
                  </Card>

                  <Card className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#18b0a4]/5 to-transparent pointer-events-none" />
                    <CardHeader className="pb-1 pt-4 px-4">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-[#18b0a4]" /> Preguntas Analizadas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="text-3xl font-bold">{questionBreakdowns.length}</div>
                      <p className="text-xs text-muted-foreground mt-1">con al menos 1 respuesta</p>
                    </CardContent>
                  </Card>
                </div>

                {/* ── Fila 3: Evolución de respuestas (tendencia por día) ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2" data-export-chart>
                    <CardHeader>
                      <CardTitle className="text-base">Evolución de Respuestas</CardTitle>
                      <CardDescription>Tendencia de respuestas recibidas por día</CardDescription>
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

                  {/* Donut de tipo de encuesta */}
                  <Card data-export-chart>
                    <CardHeader>
                      <CardTitle className="text-base">Distribución por Tipo</CardTitle>
                      <CardDescription>Efectivas vs Incidencias vs Abandonadas</CardDescription>
                    </CardHeader>
                    {/* min-h en vez de h-56 fijo: con leyenda + donut el contenido real
                        mide más que 224px, y con altura fija el SVG se salía por arriba
                        y quedaba montado sobre el título de la tarjeta. */}
                    <CardContent className="flex flex-col items-center justify-center min-h-56 gap-3 py-6">
                      {summary && summary.totalResponses > 0 ? (
                        <QuestionChart
                          type="donut"
                          showLabels={true}
                          distribution={[
                            { label: "Efectivas", count: summary.efectivas, percentage: Math.round((summary.efectivas / summary.totalResponses) * 100) },
                            { label: "Incidencias", count: summary.incidencias, percentage: Math.round((summary.incidencias / summary.totalResponses) * 100) },
                            { label: "Abandonadas", count: summary.abandonadas, percentage: Math.round((summary.abandonadas / summary.totalResponses) * 100) },
                          ]}
                        />
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <PieChartIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Sin respuestas aún</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* ── Fila 4: Hora del día + Insights ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                          {summary?.peakDay && (
                            <li className="flex gap-2">
                              <Calendar className="h-4 w-4 text-[#18b0a4] flex-shrink-0 mt-0.5" />
                              <span className="text-muted-foreground">
                                Día más activo: <strong className="text-foreground">{summary.peakDay.date.slice(5)}</strong> con {summary.peakDay.count} respuestas
                              </span>
                            </li>
                          )}
                          <li className="flex gap-2">
                            <Clock className="h-4 w-4 text-[#18b0a4] flex-shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">
                              Mayor actividad a las <strong className="text-foreground">{formatHour(summary?.peakHour ?? 0)}</strong>
                            </span>
                          </li>
                          <li className="flex gap-2">
                            <Target className="h-4 w-4 flex-shrink-0 mt-0.5 text-[#18b0a4]" />
                            <span className="text-muted-foreground">
                              {summary?.tasaRespuestasEfectivas === 100
                                ? <><strong className="text-[#18b0a4]">100%</strong> de respuestas efectivas</>
                                : summary?.tasaRespuestasEfectivas && summary.tasaRespuestasEfectivas >= 80
                                ? <><strong className="text-[#18b0a4]">{summary.tasaRespuestasEfectivas}%</strong> de respuestas efectivas — muy buena tasa</>
                                : <><strong className="text-amber-500">{summary?.tasaRespuestasEfectivas}%</strong> de respuestas efectivas — revisar campo</>
                              }
                            </span>
                          </li>
                          <li className="flex gap-2">
                            <BarChart3 className="h-4 w-4 text-[#18b0a4] flex-shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">
                              Promedio de <strong className="text-foreground">{summary?.avgPerDay ?? 0} resp/día</strong> en {summary?.activeDays ?? 0} días activos
                            </span>
                          </li>
                          <li className="flex gap-2">
                            <BookOpen className="h-4 w-4 text-[#18b0a4] flex-shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">
                              <strong className="text-foreground">{questionBreakdowns.length} preguntas</strong> con datos en este período
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

          {/* ==================== ANÁLISIS DE RESULTADOS (antes "Respuestas") ==================== */}
          <TabsContent value="responses" className="space-y-6">
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleShareLink}>
                Compartir link
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport("responses")} disabled={exporting === "responses"}>
                {exporting === "responses" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {/* OJO: este export genera un .xlsx real (ExcelJS), no un PDF — el
                    botón decía "Descargar PDF" pero descargaba Excel, lo cual es
                    engañoso. Se corrige la etiqueta; generar un PDF de verdad
                    queda pendiente como pedido aparte. */}
                {exporting === "responses" ? "Exportando..." : "Descargar Excel"}
              </Button>
            </div>
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : questionBreakdowns.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No hay datos de respuestas para los filtros seleccionados</p>
                </CardContent>
              </Card>
            ) : (
              <Card id="export-responses" data-export-chart>
                <CardHeader>
                  <CardTitle>Análisis de Resultados</CardTitle>
                  <CardDescription>Selecciona una pregunta y el tipo de gráfico para visualizarla ({questionBreakdowns.length} preguntas con respuestas)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Selector de pregunta + tipo de gráfico + toggles (slide 21) */}
                  <div className="flex flex-col lg:flex-row gap-3 lg:items-end pb-4 border-b">
                    <div className="flex-1 min-w-0">
                      <Label className="text-xs text-muted-foreground mb-1 block">Pregunta a graficar</Label>
                      <Select value={selectedQuestion?.questionId ?? ""} onValueChange={setSelectedQuestionId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecciona una pregunta" />
                        </SelectTrigger>
                        <SelectContent>
                          {questionBreakdowns.map((q) => (
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

                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="rounded" />
                      Mostrar etiquetas
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={showDataTable} onChange={(e) => setShowDataTable(e.target.checked)} className="rounded" />
                      <Table2 className="h-3.5 w-3.5" /> Mostrar tabla de datos
                    </label>
                  </div>

                  {/* Filtro avanzado (slide 21): filtra TODO el reporte (no solo esta
                      pestaña) según lo que se contestó en otra pregunta puntual. */}
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <Tags className="h-3.5 w-3.5" /> Filtro avanzado
                      <span className="text-xs font-normal text-muted-foreground">— muestra solo respuestas que contestaron algo específico en otra pregunta</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Select
                        value={advancedFilterQuestionId || "none"}
                        onValueChange={(v) => { setAdvancedFilterQuestionId(v === "none" ? "" : v); setAdvancedFilterValue("") }}
                      >
                        <SelectTrigger className="sm:w-64">
                          <SelectValue placeholder="Pregunta condición" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin filtro</SelectItem>
                          {(data?.responses?.filterableQuestions ?? []).map((q) => (
                            <SelectItem key={q.questionId} value={q.questionId}>{q.text}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={advancedFilterValue || "none"}
                        onValueChange={(v) => setAdvancedFilterValue(v === "none" ? "" : v)}
                        disabled={!advancedFilterQuestionId}
                      >
                        <SelectTrigger className="sm:w-64">
                          <SelectValue placeholder="Valor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Selecciona un valor</SelectItem>
                          {(data?.responses?.filterableQuestions ?? [])
                            .find((q) => q.questionId === advancedFilterQuestionId)
                            ?.values.map((v) => (
                              <SelectItem key={v} value={v}>{v}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {advancedFilterQuestionId && advancedFilterValue && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setAdvancedFilterQuestionId(""); setAdvancedFilterValue("") }}
                        >
                          Limpiar filtro
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Tablas cruzadas (slide 21): cruza las respuestas de dos preguntas
                      y muestra cuántas respuestas cayeron en cada combinación. */}
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <Grid3x3 className="h-3.5 w-3.5" /> Tabla cruzada
                      <span className="text-xs font-normal text-muted-foreground">— cruza las respuestas de dos preguntas</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Select
                        value={crossRowQuestionId || "none"}
                        onValueChange={(v) => setCrossRowQuestionId(v === "none" ? "" : v)}
                      >
                        <SelectTrigger className="sm:w-64">
                          <SelectValue placeholder="Pregunta (filas)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Selecciona pregunta</SelectItem>
                          {(data?.responses?.filterableQuestions ?? [])
                            .filter((q) => q.questionId !== crossColQuestionId)
                            .map((q) => (
                              <SelectItem key={q.questionId} value={q.questionId}>{q.text}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={crossColQuestionId || "none"}
                        onValueChange={(v) => setCrossColQuestionId(v === "none" ? "" : v)}
                      >
                        <SelectTrigger className="sm:w-64">
                          <SelectValue placeholder="Pregunta (columnas)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Selecciona pregunta</SelectItem>
                          {(data?.responses?.filterableQuestions ?? [])
                            .filter((q) => q.questionId !== crossRowQuestionId)
                            .map((q) => (
                              <SelectItem key={q.questionId} value={q.questionId}>{q.text}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {(crossRowQuestionId || crossColQuestionId) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setCrossRowQuestionId(""); setCrossColQuestionId("") }}
                        >
                          Limpiar
                        </Button>
                      )}
                    </div>

                    {data?.responses?.crosstab && (
                      <div className="overflow-x-auto pt-2">
                        <table className="text-sm border-collapse w-full">
                          <thead>
                            <tr>
                              <th className="border p-2 bg-muted/50 text-left align-bottom">
                                <div className="text-xs text-muted-foreground font-normal">{data.responses.crosstab.rowQuestion}</div>
                                <div className="text-xs text-muted-foreground font-normal">↓ / {data.responses.crosstab.colQuestion} →</div>
                              </th>
                              {data.responses.crosstab.cols.map((c) => (
                                <th key={c} className="border p-2 bg-muted/50 text-center font-medium whitespace-nowrap">{c}</th>
                              ))}
                              <th className="border p-2 bg-muted/50 text-center font-semibold">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.responses.crosstab.rows.map((r, ri) => (
                              <tr key={r}>
                                <td className="border p-2 font-medium whitespace-nowrap">{r}</td>
                                {data.responses.crosstab!.matrix[ri].map((v, ci) => (
                                  <td key={ci} className="border p-2 text-center">{v}</td>
                                ))}
                                <td className="border p-2 text-center font-semibold bg-muted/20">{data.responses.crosstab!.rowTotals[ri]}</td>
                              </tr>
                            ))}
                            <tr>
                              <td className="border p-2 font-semibold bg-muted/20">Total</td>
                              {data.responses.crosstab.colTotals.map((v, ci) => (
                                <td key={ci} className="border p-2 text-center font-semibold bg-muted/20">{v}</td>
                              ))}
                              <td className="border p-2 text-center font-bold bg-muted/30">{data.responses.crosstab.total}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                    {data?.responses?.crosstab && data.responses.crosstab.total === 0 && (
                      <p className="text-xs text-amber-600 pt-1">
                        Ninguna respuesta contestó ambas preguntas a la vez (todas las celdas dan 0). Esto suele pasar
                        cuando las dos preguntas pertenecen a encuestas distintas, o cuando el &quot;Filtro avanzado&quot;
                        de arriba ya redujo las respuestas a un subconjunto que no tocó estas preguntas. Prueba
                        seleccionando una &quot;Encuesta&quot; específica en los filtros de arriba, o limpiando el filtro avanzado.
                      </p>
                    )}
                    {crossRowQuestionId && crossColQuestionId && !data?.responses?.crosstab && (
                      <p className="text-xs text-muted-foreground pt-1">No hay respuestas suficientes para cruzar estas dos preguntas.</p>
                    )}
                  </div>

                  {selectedQuestion && (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="text-lg font-medium">{selectedQuestion.text}</h3>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{selectedQuestion.totalAnswers} respuestas</span>
                      </div>
                      {selectedQuestion.average && (
                        <p className="text-sm text-muted-foreground">Promedio: <span className="font-semibold text-foreground">{selectedQuestion.average}</span></p>
                      )}

                      {/* Galería de archivos para preguntas tipo archivo/foto */}
                      {(selectedQuestion.type === "file" || selectedQuestion.type === "image_upload") ? (
                        <div className="space-y-3">
                          {fileGalleryLoading ? (
                            <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                              <Loader2 className="h-5 w-5 animate-spin" /> Cargando archivos…
                            </div>
                          ) : fileGallery.length === 0 ? (
                            <div className="py-10 text-center text-sm text-muted-foreground">
                              No hay archivos subidos para esta pregunta
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-3">
                              {fileGallery.map((f, idx) =>
                                f.type?.startsWith("image/") ? (
                                  <a key={idx} href={f.url} target="_blank" rel="noreferrer" title={f.name} className="block group">
                                    <img src={f.url} alt={f.name} className="h-24 w-24 object-cover rounded-lg border group-hover:opacity-90 transition-opacity" />
                                    <p className="text-xs text-muted-foreground mt-1 w-24 truncate text-center">{f.name}</p>
                                  </a>
                                ) : (
                                  <a key={idx} href={f.url} target="_blank" rel="noreferrer"
                                    className="flex flex-col items-center gap-1.5 p-3 border rounded-lg bg-muted/30 hover:bg-muted transition-colors w-24 text-center">
                                    <Download className="h-6 w-6 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground truncate w-full">{f.name}</span>
                                  </a>
                                )
                              )}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {fileGallery.length} archivo{fileGallery.length !== 1 ? "s" : ""} · Las URLs expiran en 1 hora
                          </p>
                        </div>
                      ) : (
                        <>
                          <QuestionChart
                            type={chartType}
                            distribution={selectedQuestion.distribution ?? []}
                            timeline={selectedQuestion.timeline ?? []}
                            showLabels={showLabels}
                          />

                          {showDataTable && (selectedQuestion.distribution?.length ?? 0) > 0 && (
                            <div className="rounded-md border overflow-hidden mt-4">
                              <div className="grid grid-cols-3 p-2 text-xs font-semibold text-muted-foreground uppercase bg-muted/50 border-b">
                                <div>Opción</div>
                                <div className="text-center">Respuestas</div>
                                <div className="text-center">Porcentaje</div>
                              </div>
                              <div className="divide-y">
                                {selectedQuestion.distribution!.map((d, i) => (
                                  <div key={i} className="grid grid-cols-3 p-2 text-sm items-center">
                                    <div className="truncate">{d.label}</div>
                                    <div className="text-center">{d.count}</div>
                                    <div className="text-center">{d.percentage}%</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {selectedQuestion.sampleAnswers && selectedQuestion.sampleAnswers.length > 0 && (
                            <div className="space-y-2">
                              {selectedQuestion.sampleAnswers.map((ans, i) => (
                                <div key={i} className="p-3 border rounded-md">
                                  <p className="text-sm text-muted-foreground">&ldquo;{ans}&rdquo;</p>
                                </div>
                              ))}
                              {selectedQuestion.totalAnswers > 5 && (
                                <p className="text-xs text-muted-foreground">Mostrando 5 de {selectedQuestion.totalAnswers} respuestas</p>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ==================== RESPUESTAS INDIVIDUALES ==================== */}
          <TabsContent value="individual" className="space-y-6">
            <IndividualResponsesTab filterParams={filterParams} />
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
                      <div className="text-3xl font-bold" style={{ color: "#18b0a4" }}>{summary?.tasaRespuestasEfectivas ?? 0}%</div>
                      <p className="text-xs text-muted-foreground mt-1">respuestas efectivas</p>
                    </CardContent>
                  </Card>
                </div>

                {/* ── Rendimiento por encuestador (slide 23: tabla ordenable) ── */}
                <Card data-export-chart>
                  <CardHeader>
                    <CardTitle>Rendimiento por Encuestador</CardTitle>
                    <CardDescription>Click en cualquier columna para ordenar. Supervisor pendiente de asignación en el módulo de usuarios.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SortablePerformanceTable rows={surveyorRows} />
                  </CardContent>
                </Card>

                {/* ── Rendimiento por encuesta (se mantiene, ya existía) ── */}
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
                          Visualización geográfica de zonas y puntos de respuesta (individuales)
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

export default function ReportsPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <ReportsPageContent />
    </Suspense>
  )
}
