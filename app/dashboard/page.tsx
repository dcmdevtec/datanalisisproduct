"use client"

// El Dashboard reemplaza al panel de KPIs simple anterior por el contenido
// del tab "Resumen" que vivía en /reports — mismos filtros, mismas tarjetas y
// gráficos. El resto de pestañas (Análisis de resultados, Respuestas
// Individuales, Rendimiento, Geográfico) siguen viviendo en /reports.
// Es una página independiente (no comparte estado con /reports) porque cada
// una filtra y hace fetch de forma autónoma — /reports sigue necesitando su
// propio estado de filtros para sus 4 pestañas restantes.

import { useEffect, useState, useCallback, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  BarChart3, Download, Loader2, PieChart as PieChartIcon, TrendingUp, TrendingDown, AlertCircle,
  Clock, Calendar, Zap, Target, BookOpen, ArrowUpRight, ArrowDownRight, Minus,
  CheckCircle2, AlertTriangle, XCircle, Users2, Tags,
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { exportSummary } from "@/app/lib/export-report"
import { QuestionChart } from "@/components/reports/question-chart"
import type { ReportData } from "@/app/reports/shared"
import { formatGrowth } from "@/app/reports/shared"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Cell,
} from "recharts"

function DashboardContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [data, setData] = useState<ReportData | null>(null)

  const [selectedCompany, setSelectedCompany] = useState<string>("all")
  const [selectedProject, setSelectedProject] = useState<string>("all")
  // Lazy initializer para no disparar un fetch inicial con survey="all" que
  // compita en carrera con el fetch filtrado (ver misma corrección en /reports).
  const [selectedSurvey, setSelectedSurvey] = useState<string>(() => searchParams.get("survey") || "all")
  const [selectedSurveyor, setSelectedSurveyor] = useState<string>("all")
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("all")
  const [selectedCoordinator, setSelectedCoordinator] = useState<string>("all")
  const [selectedTipo, setSelectedTipo] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const surveyParam = searchParams.get("survey")
    if (surveyParam) setSelectedSurvey(surveyParam)
  }, [searchParams])

  const handleCompanyChange = (v: string) => {
    setSelectedCompany(v)
    setSelectedProject("all")
    setSelectedSurvey("all")
  }
  const handleProjectChange = (v: string) => {
    setSelectedProject(v)
    setSelectedSurvey("all")
  }

  const filteredProjects = data?.projects?.filter(
    (p) => selectedCompany === "all" || p.companyId === selectedCompany
  ) ?? []
  const filteredSurveys = data?.surveys?.filter((s) => {
    if (selectedSurvey !== "all") return true
    if (selectedProject !== "all") return s.projectId === selectedProject
    if (selectedCompany !== "all") {
      const projIds = filteredProjects.map((p) => p.id)
      return projIds.includes(s.projectId)
    }
    return true
  }) ?? []

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
    return params
  }, [selectedCompany, selectedProject, selectedSurvey, selectedSurveyor, selectedSupervisor, selectedCoordinator, selectedTipo, dateFrom, dateTo])

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await fetch(`/api/reports?${filterParams}`)
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("No tienes permiso para ver estos reportes.")
        }
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || `No se pudieron cargar los datos (HTTP ${res.status}).`)
      }
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "No se pudieron cargar los datos", variant: "destructive" })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filterParams.toString(), toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleExport = async () => {
    if (!data) return
    setExporting(true)
    try {
      const periodLabel = dateFrom || dateTo ? `${dateFrom || "inicio"}_a_${dateTo || "hoy"}` : "todo"
      await exportSummary(data, periodLabel)
      toast({ title: "Exportado", description: "El resumen se descargó correctamente" })
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message ? `No se pudo exportar: ${err.message}` : "No se pudo exportar el resumen",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const questionBreakdowns = data?.responses?.questionBreakdowns ?? []

  if (authLoading || !user) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }

  const summary = data?.summary

  const formatHour = (h: number) => {
    const ampm = h < 12 ? "AM" : "PM"
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${display}:00 ${ampm}`
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Visualiza y analiza los datos recopilados</p>
          </div>

          {/* ── Filtros globales ── */}
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
            &quot;Efectiva / Incidencia / Abandonada&quot; se calcula automáticamente a partir del estado de la respuesta mientras la app no envíe la clasificación completa.
          </p>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? "Exportando..." : "Exportar Resumen"}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div id="export-summary" className="space-y-6 mt-6">

            {/* ── Fila 1: KPIs de tipo de encuesta ── */}
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
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#18b0a4]" /> Efectivas
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
                    <XCircle className="h-3.5 w-3.5 text-amber-500" /> Abandonadas
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

            {/* ── Fila 3: Evolución de respuestas ── */}
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
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart
                        data={summary!.responsesTimeline.map((d) => ({ ...d, label: d.date.slice(5) }))}
                        margin={{ top: 8, right: 8, left: -8, bottom: 48 }}
                      >
                        <defs>
                          <linearGradient id="timelineGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#18b0a4" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#18b0a4" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          angle={-35}
                          textAnchor="end"
                          interval={Math.max(0, Math.floor((summary?.responsesTimeline?.length ?? 1) / 8) - 1)}
                        />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                        <ReTooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--background))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            fontSize: 12,
                            color: "hsl(var(--foreground))",
                          }}
                          formatter={(value: any) => [value, "Respuestas"]}
                          labelFormatter={(label) => `Fecha: ${label}`}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="#18b0a4"
                          strokeWidth={2.5}
                          fill="url(#timelineGrad)"
                          dot={{ r: 3, fill: "#18b0a4", strokeWidth: 0 }}
                          activeDot={{ r: 5, fill: "#18b0a4" }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card data-export-chart>
                <CardHeader>
                  <CardTitle className="text-base">Distribución por Tipo</CardTitle>
                  <CardDescription>Efectivas vs Incidencias vs Abandonadas</CardDescription>
                </CardHeader>
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
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart
                        data={(summary?.responsesByHour ?? []).map((h) => ({
                          ...h,
                          label: `${h.hour}:00`,
                          isPeak: h.hour === summary?.peakHour && h.count > 0,
                        }))}
                        margin={{ top: 4, right: 4, left: -16, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                          interval={5}
                        />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                        <ReTooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--background))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            fontSize: 12,
                            color: "hsl(var(--foreground))",
                          }}
                          formatter={(value: any) => [value, "Respuestas"]}
                          labelFormatter={(label) => `Hora: ${label}`}
                          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                        />
                        <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={24}>
                          {(summary?.responsesByHour ?? []).map((h, i) => (
                            <Cell
                              key={i}
                              fill={h.hour === summary?.peakHour && h.count > 0 ? "#18b0a4" : "#18b0a480"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  {summary && summary.totalResponses > 0 && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Pico de actividad: <span className="font-semibold text-primary">{formatHour(summary.peakHour)}</span>
                    </p>
                  )}
                </CardContent>
              </Card>

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
      </div>
    </DashboardLayout>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <DashboardContent />
    </Suspense>
  )
}
