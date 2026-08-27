"use client"

// El Dashboard muestra el mismo contenido que el tab "Resumen" de /reports
// (mismo componente compartido SummaryContent) — filtros + KPIs + gráficos.
// Es una página independiente (no comparte estado con /reports) porque cada
// una filtra y hace fetch de forma autónoma — /reports sigue necesitando su
// propio estado de filtros para sus otras 4 pestañas.

import { useEffect, useState, useCallback, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, Loader2, Tags } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { exportSummary } from "@/app/lib/export-report"
import { SummaryContent } from "@/components/reports/summary-content"
import type { ReportData } from "@/app/reports/shared"

function DashboardContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [data, setData] = useState<ReportData | null>(null)

  // Si se llegó desde "Ver reporte" de una encuesta puntual (?survey=<id>),
  // esa encuesta ya está decidida — no tiene sentido mostrar los filtros de
  // Empresa/Proyecto/Encuesta (ni dejar que se cambien), y el nombre de la
  // encuesta se muestra como encabezado principal de la página.
  const scopedSurveyId = searchParams.get("survey")
  const isScoped = !!scopedSurveyId

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

  if (authLoading || !user) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }

  const scopedSurveyTitle = isScoped ? data?.surveys?.find((s) => s.id === scopedSurveyId)?.title : null

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">{scopedSurveyTitle || "Dashboard"}</h1>
            <p className="text-muted-foreground">
              {isScoped ? "Resumen de esta encuesta" : "Visualiza y analiza los datos recopilados"}
            </p>
          </div>

          {/* ── Filtros globales — Empresa/Proyecto/Encuesta se ocultan cuando
              ya se llegó con una encuesta puntual decidida (?survey=) ── */}
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
            &quot;Efectiva / Incidencia / Abandonada&quot; se calcula automáticamente a partir del estado de la respuesta mientras la app no envíe la clasificación completa.
          </p>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? "Exportando..." : "Descargar PDF"}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div id="export-summary" className="mt-6">
            <SummaryContent data={data} />
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
