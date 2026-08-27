"use client"

import { useEffect, useState, useCallback, useMemo, Suspense, useRef } from "react"
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
  CheckCircle2, AlertTriangle, XCircle, Users2, Table2, Tags, Grid3x3,
  ChevronDown, ChevronUp, Filter, Share2,
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Combobox } from "@/components/ui/combobox"
import { exportSummary, exportResponses, exportPerformance, exportGeographic } from "@/app/lib/export-report"
import { SummaryContent } from "@/components/reports/summary-content"
import { QuestionChart, type ChartType } from "@/components/reports/question-chart"
import { QuestionCard } from "@/components/reports/question-card"
import { IndividualResponsesTab } from "@/components/reports/individual-responses-tab"
import { SortablePerformanceTable, type SurveyorPerformanceRow } from "@/components/reports/sortable-performance-table"
import { ShareReportModal } from "@/components/reports/share-report-modal"
import type { ReportData } from "./shared"
import { formatPercent } from "@/lib/format"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Cell,
} from "recharts"

// Dynamic import del mapa para evitar problemas SSR con Leaflet
const ReportsGeoMap = dynamic(() => import("@/components/reports-geo-map"), {
  ssr: false,
  loading: () => <div className="w-full rounded-xl bg-muted animate-pulse" style={{ height: 460 }} />,
})

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
  // Lazy initializer (no useEffect) para evitar el fetch inicial con
  // survey="all" que competía en carrera con el fetch ya filtrado disparado
  // por el useEffect de abajo — si la respuesta "todas" llegaba después de
  // la filtrada, pisaba los datos correctos y el reporte mostraba todo en
  // vez de la encuesta seleccionada desde "Ver reporte".
  const [selectedSurvey, setSelectedSurvey] = useState<string>(() => searchParams.get("survey") || "all")
  const [selectedSurveyor, setSelectedSurveyor] = useState<string>("all")
  // Slide 19: filtros de jerarquía. Elegir un coordinador ya incluye a todos
  // los supervisores/encuestadores debajo de él (ver resolución en la API).
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("all")
  const [selectedCoordinator, setSelectedCoordinator] = useState<string>("all")
  const [selectedTipo, setSelectedTipo] = useState<string>("all")
  // Rango de fechas real (pptx slide 19), reemplaza el selector de "período" fijo.
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")

  // Constructor de informes: configuración por pregunta (tipo gráfica, etiquetas, tabla)
  const [questionSettings, setQuestionSettings] = useState<Record<string, { chartType: ChartType; showLabels: boolean; showTable: boolean }>>({})
  // "Análisis de resultados": vacío por defecto, el usuario agrega preguntas a
  // mano con el buscador y esa selección se guarda en surveys.settings, así
  // no hay que re-elegir preguntas cada vez que se abre "Compartir link".
  const [reportQuestionIds, setReportQuestionIds] = useState<string[]>([])
  // Orden elegido en la tabla de cada pregunta (ver QuestionCard) — se guarda
  // junto con reportQuestionIds para que "Compartir link" muestre las
  // gráficas en el MISMO orden que dejó armado el admin, no en el orden por
  // defecto (descendente por cantidad) que usa el servidor.
  const [questionSortConfig, setQuestionSortConfig] = useState<Record<string, { key: "label" | "count" | "percentage"; dir: "asc" | "desc" }>>({})
  const surveySettingsRef = useRef<Record<string, any>>({})
  const reportQuestionIdsLoadedForRef = useRef<string | null>(null)
  // Panel de herramientas avanzadas (filtro + tabla cruzada) — colapsable
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false)

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

  // Carga la selección de preguntas guardada para "Análisis de resultados"
  // cuando se elige una encuesta puntual. Con "Todas" no aplica (la
  // configuración es por encuesta) — se vacía y no se persiste nada.
  useEffect(() => {
    if (selectedSurvey === "all") {
      setReportQuestionIds([])
      setQuestionSortConfig({})
      setQuestionSettings({})
      surveySettingsRef.current = {}
      reportQuestionIdsLoadedForRef.current = null
      return
    }
    reportQuestionIdsLoadedForRef.current = null
    ;(async () => {
      try {
        const res = await fetch(`/api/surveys/${selectedSurvey}`)
        if (!res.ok) return
        const survey = await res.json()
        surveySettingsRef.current = survey?.settings || {}
        setReportQuestionIds(Array.isArray(survey?.settings?.reportAnalysisQuestionIds) ? survey.settings.reportAnalysisQuestionIds : [])
        setQuestionSortConfig(survey?.settings?.reportQuestionSort && typeof survey.settings.reportQuestionSort === "object" ? survey.settings.reportQuestionSort : {})
        // Tipo de gráfica elegido por pregunta (ej. "Barras horizontales" en
        // vez del "Torta" por defecto) — sin esto, "Compartir link" siempre
        // mostraba el gráfico por defecto (por cantidad de opciones) sin
        // importar lo que el admin eligió acá.
        setQuestionSettings(survey?.settings?.reportQuestionChartSettings && typeof survey.settings.reportQuestionChartSettings === "object" ? survey.settings.reportQuestionChartSettings : {})
      } catch {
        // Si falla la carga, arranca vacío en vez de trabar el tab.
        setReportQuestionIds([])
        setQuestionSortConfig({})
        setQuestionSettings({})
      } finally {
        reportQuestionIdsLoadedForRef.current = selectedSurvey
      }
    })()
  }, [selectedSurvey])

  // Guarda la selección + el orden por pregunta (debounced) — solo después de
  // haber cargado la config existente de ESTA encuesta, para no pisarla con
  // [] en el primer render.
  useEffect(() => {
    if (reportQuestionIdsLoadedForRef.current !== selectedSurvey) return
    if (selectedSurvey === "all") return
    const timer = setTimeout(async () => {
      try {
        await fetch(`/api/surveys/${selectedSurvey}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            settings: { ...surveySettingsRef.current, reportAnalysisQuestionIds: reportQuestionIds, reportQuestionSort: questionSortConfig, reportQuestionChartSettings: questionSettings },
          }),
        })
      } catch {
        // Autosave silencioso — igual que el resto de los autosaves del módulo.
      }
    }, 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportQuestionIds, questionSortConfig, questionSettings, selectedSurvey])

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
      if (!res.ok) {
        // AUDITORÍA (2026-08-17): /api/reports exige rol admin/supervisor
        // (requireRole) pero cualquier falla —incluida una denegación de
        // permiso— caía en el mismo mensaje genérico. El checklist pide que
        // una falta de autorización se indique explícitamente en vez de
        // fallar en silencio.
        if (res.status === 401 || res.status === 403) {
          throw new Error("No tienes permiso para ver estos reportes.")
        }
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || `No se pudieron cargar los reportes (HTTP ${res.status}).`)
      }
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "No se pudieron cargar los reportes", variant: "destructive" })
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
    } catch (err: any) {
      // AUDITORÍA (2026-08-17): la exportación (ExcelJS/html2canvas) corre
      // client-side sobre `data` ya cargado — no hace llamadas de red propias,
      // así que un fallo aquí nunca es de permisos (eso ya se filtra en
      // fetchData). Se conserva el mensaje real del error en vez de
      // descartarlo, para poder diagnosticar fallas puntuales (p.ej. un
      // gráfico que no pudo capturarse).
      toast({
        title: "Error",
        description: err?.message ? `No se pudo exportar el reporte: ${err.message}` : "No se pudo exportar el reporte",
        variant: "destructive",
      })
    } finally {
      setExporting(null)
    }
  }

  // Modal de compartir reporte (tipo SurveyMonkey)
  const [shareModalOpen, setShareModalOpen] = useState(false)

  const handleShareLink = () => {
    setShareModalOpen(true)
  }

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ⚠️ POSICIÓN CRÍTICA: estas constantes DEBEN estar ANTES del early return de
  // authLoading. Regla: todos los hooks antes de cualquier return.
  const questionBreakdowns = data?.responses?.questionBreakdowns ?? []

  // Función para obtener/inicializar la config de una pregunta concreta
  const getQSettings = (q: { questionId: string; type: string }) => {
    return questionSettings[q.questionId] ?? {
      chartType: (["rating", "nps", "likert", "scale"].includes(q.type) ? "barsV" : "barsH") as ChartType,
      showLabels: true,
      showTable: false,
    }
  }

  const updateQSettings = (questionId: string, patch: Partial<{ chartType: ChartType; showLabels: boolean; showTable: boolean }>) => {
    setQuestionSettings((prev) => ({
      ...prev,
      [questionId]: { ...getQSettings({ questionId, type: "" }), ...prev[questionId], ...patch },
    }))
  }

  // Early return DESPUÉS de todos los hooks — nunca antes
  if (authLoading || !user) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }

  const summary = data?.summary
  const maxDailyCount = Math.max(...(data?.performance?.dailyDistribution?.map((d) => d.count) || [1]))
  const maxZoneResponses = Math.max(...(data?.geographic?.zoneBreakdown?.map((z) => z.responseCount) || [1]))

  const surveyorRows: SurveyorPerformanceRow[] = (data?.performance?.surveyorPerformance ?? []).map((s) => ({
    name: s.name,
    supervisorId: s.supervisorId ?? null,
    supervisorName: s.supervisorName ?? null,
    totalRegistros: s.totalRegistros,
    incidencias: s.incidencias,
    abandonadas: s.abandonadas,
    efectivas: s.efectivas,
    tasaRespuestas: s.tasaRespuestas,
    avgTime: s.avgTime ?? "—",
    completionRate: s.completionRate,
  }))

  // Si se llegó desde "Ver reporte" de una encuesta puntual (?survey=<id>),
  // ya está decidida — no mostrar los filtros de Empresa/Proyecto/Encuesta, y
  // el nombre de esa encuesta pasa a ser el encabezado principal de TODA la
  // página (las 5 pestañas), no solo de una tabla puntual.
  const isScoped = !!searchParams.get("survey")
  const scopedSurveyTitle = isScoped ? data?.surveys?.find((s) => s.id === selectedSurvey)?.title : null

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">{scopedSurveyTitle || "Reportes y Análisis"}</h1>
            <p className="text-muted-foreground">
              {isScoped ? "Reportes de esta encuesta" : "Visualiza y analiza los datos recopilados"}
            </p>
          </div>

          {/* ── Filtros globales (pptx slide 19): aplican a las 5 pestañas ── */}
          <div className="flex flex-col sm:flex-row gap-2 flex-wrap items-end">
            {!isScoped && (
              <>
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
              </>
            )}
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
                {exporting === "summary" ? "Exportando..." : "Descargar PDF"}
              </Button>
            </div>
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div id="export-summary">
                <SummaryContent data={data} />
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
                {exporting === "responses" ? "Exportando..." : "Descargar PDF"}
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
              <div id="export-responses" className="space-y-4">
                {/* ── Herramientas avanzadas: filtro + tabla cruzada ── */}
                <div className="border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowAdvancedPanel((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      Filtros avanzados y tabla cruzada
                      {(advancedFilterQuestionId || crossRowQuestionId) && (
                        <span className="text-xs bg-[#18b0a4]/10 text-[#18b0a4] px-2 py-0.5 rounded-full font-medium">Activo</span>
                      )}
                    </span>
                    {showAdvancedPanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {showAdvancedPanel && (
                    <div className="px-4 py-4 space-y-4 border-t">
                      {/* Filtro avanzado */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <Tags className="h-3.5 w-3.5" /> Filtro avanzado
                          <span className="text-xs font-normal text-muted-foreground">— filtra todo el reporte según lo contestado en una pregunta</span>
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
                            <Button variant="ghost" size="sm" onClick={() => { setAdvancedFilterQuestionId(""); setAdvancedFilterValue("") }}>
                              Limpiar
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Tabla cruzada */}
                      <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <Grid3x3 className="h-3.5 w-3.5" /> Tabla cruzada
                          <span className="text-xs font-normal text-muted-foreground">— cruza respuestas de dos preguntas</span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Select value={crossRowQuestionId || "none"} onValueChange={(v) => setCrossRowQuestionId(v === "none" ? "" : v)}>
                            <SelectTrigger className="sm:w-64"><SelectValue placeholder="Pregunta (filas)" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Selecciona pregunta</SelectItem>
                              {(data?.responses?.filterableQuestions ?? []).filter((q) => q.questionId !== crossColQuestionId).map((q) => (
                                <SelectItem key={q.questionId} value={q.questionId}>{q.text}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={crossColQuestionId || "none"} onValueChange={(v) => setCrossColQuestionId(v === "none" ? "" : v)}>
                            <SelectTrigger className="sm:w-64"><SelectValue placeholder="Pregunta (columnas)" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Selecciona pregunta</SelectItem>
                              {(data?.responses?.filterableQuestions ?? []).filter((q) => q.questionId !== crossRowQuestionId).map((q) => (
                                <SelectItem key={q.questionId} value={q.questionId}>{q.text}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {(crossRowQuestionId || crossColQuestionId) && (
                            <Button variant="ghost" size="sm" onClick={() => { setCrossRowQuestionId(""); setCrossColQuestionId("") }}>Limpiar</Button>
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
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Análisis de resultados: vacío por defecto, se arma a mano ── */}
                {selectedSurvey === "all" ? (
                  <Card>
                    <CardContent className="py-10 text-center">
                      <p className="text-muted-foreground text-sm">
                        Selecciona una encuesta específica en el filtro "Encuesta" para armar su análisis
                        (la selección de preguntas se guarda por encuesta).
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm text-muted-foreground">
                        {reportQuestionIds.length} pregunta{reportQuestionIds.length !== 1 ? "s" : ""} en el informe
                      </p>
                      <div className="w-full sm:w-72">
                        <Combobox
                          value=""
                          onValueChange={(qId) => setReportQuestionIds((prev) => prev.includes(qId) ? prev : [...prev, qId])}
                          placeholder="+ Agregar pregunta al informe"
                          searchPlaceholder="Buscar pregunta..."
                          emptyMessage="No hay más preguntas para agregar"
                          options={questionBreakdowns
                            .filter((q) => !reportQuestionIds.includes(q.questionId))
                            .map((q) => ({ value: q.questionId, label: q.text }))}
                        />
                      </div>
                    </div>

                    {reportQuestionIds.length === 0 ? (
                      <Card>
                        <CardContent className="py-16 text-center">
                          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                          <p className="text-muted-foreground">
                            Todavía no agregaste preguntas a este informe. Usa el buscador de arriba para agregarlas.
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        {reportQuestionIds
                          .map((qId) => questionBreakdowns.find((q) => q.questionId === qId))
                          .filter((q): q is typeof questionBreakdowns[number] => !!q)
                          .map((q, idx) => (
                            <QuestionCard
                              key={q.questionId}
                              question={q}
                              index={idx}
                              settings={getQSettings(q)}
                              onSettingsChange={(patch) => updateQSettings(q.questionId, patch)}
                              onHide={() => setReportQuestionIds((prev) => prev.filter((id) => id !== q.questionId))}
                              hideLabel="Quitar"
                              surveyId={selectedSurvey !== "all" ? selectedSurvey : undefined}
                              sortConfig={questionSortConfig[q.questionId] ?? null}
                              onSortChange={(next) => setQuestionSortConfig((prev) => {
                                if (!next) {
                                  const { [q.questionId]: _omit, ...rest } = prev
                                  return rest
                                }
                                return { ...prev, [q.questionId]: next }
                              })}
                            />
                          ))
                        }
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </TabsContent>

          {/* ==================== RESPUESTAS INDIVIDUALES ==================== */}
          {/* El título de la encuesta ya se muestra como encabezado global de
              toda la página (arriba, cuando isScoped) — no se repite acá. */}
          <TabsContent value="individual" className="space-y-6">
            <IndividualResponsesTab filterParams={filterParams} />
          </TabsContent>

          {/* ==================== RENDIMIENTO ==================== */}
          <TabsContent value="performance" className="space-y-6">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport("performance")} disabled={exporting === "performance"}>
                {exporting === "performance" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exporting === "performance" ? "Exportando..." : "Descargar PDF"}
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
                      <div className="text-3xl font-bold" style={{ color: "#18b0a4" }}>{formatPercent(summary?.tasaRespuestasEfectivas ?? 0)}</div>
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
                                    {formatPercent(s.completionRate)}
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
                {exporting === "geographic" ? "Exportando..." : "Descargar PDF"}
              </Button>
            </div>
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div id="export-geographic" className="space-y-6">
                {/* ── Mapa interactivo ── */}
                {/* El filtro por color (Incidencias/Efectivas/Abandonadas) y su leyenda
                    ya viven DENTRO de ReportsGeoMap (esquina superior derecha del mapa
                    y leyenda inferior izquierda) — no se duplica acá. */}
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

                {/* ── Actividad de encuestadores (siempre visible si hay puntos GPS) ── */}
                {(() => {
                  const hasZones = (data?.geographic?.zoneBreakdown?.length ?? 0) > 0
                  const points   = data?.geographic?.responsePoints ?? []

                  // Resumir actividad por encuestador a partir de los puntos de ubicación
                  const byName: Record<string, { pings: number; last: string; isSurveyor: boolean }> = {}
                  for (const p of points) {
                    const name = p.surveyorName || "Sin nombre"
                    if (!byName[name]) byName[name] = { pings: 0, last: p.createdAt, isSurveyor: p.source === "surveyor" }
                    byName[name].pings++
                    if (new Date(p.createdAt) > new Date(byName[name].last)) byName[name].last = p.createdAt
                  }
                  const surveyorActivity = Object.entries(byName)
                    .map(([name, v]) => ({ name, ...v }))
                    .sort((a, b) => b.pings - a.pings)
                    .slice(0, 20)

                  const formatAgo = (iso: string) => {
                    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
                    if (mins < 1)   return "hace menos de 1 min"
                    if (mins < 60)  return `hace ${mins} min`
                    const h = Math.floor(mins / 60)
                    if (h < 24)    return `hace ${h}h`
                    return `hace ${Math.floor(h / 24)}d`
                  }

                  const statusDot = (iso: string) => {
                    const mins = (Date.now() - new Date(iso).getTime()) / 60000
                    if (mins <= 5)  return "bg-green-500"
                    if (mins <= 30) return "bg-yellow-500"
                    return "bg-gray-400"
                  }

                  if (hasZones) {
                    // Con zonas configuradas: mostrar las dos tarjetas originales
                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card data-export-chart>
                          <CardHeader>
                            <CardTitle>Respuestas por Zona</CardTitle>
                            <CardDescription>Distribución de asignaciones por zona geográfica</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {data!.geographic.zoneBreakdown.map((z, i) => (
                                <div key={i} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{z.zone}</span>
                                    <span className="text-sm text-muted-foreground">{z.responseCount} asignaciones</span>
                                  </div>
                                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.max((z.responseCount / maxZoneResponses) * 100, 2)}%` }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                        <Card data-export-chart>
                          <CardHeader>
                            <CardTitle>Comparativa por Zona</CardTitle>
                            <CardDescription>Tasa de finalización por zona</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="rounded-md border">
                              <div className="grid grid-cols-4 p-3 font-medium border-b text-sm">
                                <div>Zona</div>
                                <div className="text-center">Asignaciones</div>
                                <div className="text-center">Completadas</div>
                                <div className="text-center">Tasa</div>
                              </div>
                              <div className="divide-y">
                                {data!.geographic.zoneBreakdown.map((z, i) => (
                                  <div key={i} className="grid grid-cols-4 p-3 items-center text-sm">
                                    <div>{z.zone}</div>
                                    <div className="text-center">{z.responseCount}</div>
                                    <div className="text-center">{z.completedCount}</div>
                                    <div className="text-center">
                                      <span className={z.completionRate >= 80 ? "text-green-600 font-medium" : z.completionRate >= 50 ? "text-orange-500 font-medium" : "text-red-500 font-medium"}>
                                        {formatPercent(z.completionRate)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )
                  }

                  // Sin zonas configuradas: mostrar actividad de encuestadores en su lugar
                  if (surveyorActivity.length === 0) return null

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Tarjeta 1: Encuestadores activos */}
                      <Card data-export-chart>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            Encuestadores en Campo
                            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              {surveyorActivity.length} encuestadores
                            </span>
                          </CardTitle>
                          <CardDescription>Última ubicación GPS recibida por encuestador</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="divide-y max-h-72 overflow-y-auto">
                            {surveyorActivity.map((s, i) => (
                              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(s.last)}`} />
                                <span className="flex-1 text-sm font-medium truncate">{s.name}</span>
                                <div className="text-right flex-shrink-0">
                                  <div className="text-xs font-semibold tabular-nums">{s.pings} pings</div>
                                  <div className="text-[10px] text-muted-foreground">{formatAgo(s.last)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="px-4 py-2 border-t text-[10px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1 mr-3"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>≤5 min — activo</span>
                            <span className="inline-flex items-center gap-1 mr-3"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"/>≤30 min — reciente</span>
                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block"/>&gt;30 min — inactivo</span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Tarjeta 2: Distribución de pings por hora */}
                      <Card data-export-chart>
                        <CardHeader>
                          <CardTitle>Actividad por Hora del Día</CardTitle>
                          <CardDescription>Número de ubicaciones GPS registradas según la hora</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {(() => {
                            const byHour: number[] = Array(24).fill(0)
                            for (const p of points) {
                              const h = new Date(p.createdAt).getHours()
                              byHour[h]++
                            }
                            const max = Math.max(...byHour, 1)
                            const workHours = byHour.map((v, h) => ({ h, v })).filter(({ h }) => h >= 6 && h <= 21)
                            return (
                              <div className="space-y-1">
                                {workHours.map(({ h, v }) => (
                                  <div key={h} className="flex items-center gap-2 text-xs">
                                    <span className="w-8 text-right text-muted-foreground tabular-nums">{String(h).padStart(2, "0")}h</span>
                                    <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                                      {v > 0 && (
                                        <div
                                          className="h-full rounded"
                                          style={{ width: `${(v / max) * 100}%`, background: "hsl(var(--primary))" }}
                                        />
                                      )}
                                    </div>
                                    <span className="w-8 tabular-nums text-muted-foreground">{v > 0 ? v : ""}</span>
                                  </div>
                                ))}
                              </div>
                            )
                          })()}
                        </CardContent>
                      </Card>
                    </div>
                  )
                })()}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de compartir reporte */}
      <ShareReportModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        selectedSurvey={selectedSurvey}
        // Reutiliza la selección ya armada y guardada en "Análisis de
        // resultados" — así compartir el link no vuelve a pedir elegir
        // preguntas; si el usuario no armó ninguna, cae de vuelta a todas.
        questions={(
          reportQuestionIds.length > 0
            ? reportQuestionIds
                .map((id) => (data?.responses?.questionBreakdowns ?? []).find((q) => q.questionId === id))
                .filter((q): q is NonNullable<typeof q> => !!q)
            : (data?.responses?.questionBreakdowns ?? [])
        ).map((q) => ({
          questionId: q.questionId,
          text: q.text,
          type: q.type,
          totalAnswers: q.totalAnswers,
        }))}
        currentFilters={{
          surveyorId: selectedSurveyor !== "all" ? selectedSurveyor : undefined,
          supervisorId: selectedSupervisor !== "all" ? selectedSupervisor : undefined,
          coordinatorId: selectedCoordinator !== "all" ? selectedCoordinator : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          tipo: selectedTipo !== "all" ? selectedTipo : undefined,
        }}
      />
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
