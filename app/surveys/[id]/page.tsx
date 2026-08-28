"use client"

import { Alert, AlertTitle } from "@/components/ui/alert"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  ArrowLeft,
  Edit,
  Trash2,
  Loader2,
  Users,
  MapPin,
  FileText,
  Settings,
  Building2,
  FolderOpen,
  Plus,
  RefreshCw,
  Radio,
  Mic,
  Download,
  Search,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase-browser"
import { format } from "date-fns"
import dynamic from "next/dynamic"
import type { GeoJSON } from "geojson"
import type { Surveyor } from "@/types/surveyor"
import type { Zone } from "@/types/zone"

const MapWithDrawing = dynamic(() => import("@/components/map-with-drawing"), {
  ssr: false,
})

// Importar el mapa de tracking dinámicamente
const TrackingMap = dynamic(() => import("@/components/tracking-map"), {
  ssr: false,
})

type Survey = {
  id: string
  title: string
  description: string | null
  status: string
  start_date: string | null // New field
  deadline: string | null
  settings: {
    collectLocation: boolean
    allowAudio: boolean
    offlineMode: boolean
    distributionMethods: string[]
    assignedUsers?: string[]
    assignedZones?: string[]
    [key: string]: any
  } | null
  project_id: string | null
  assigned_surveyors: string[] | null
  assigned_zones: string[] | string | null // Can be string or string[]
  projects: {
    id: string
    name: string
    companies: {
      name: string
      logo: string | null
    } | null
  } | null
}

export default function SurveyDetailsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()

  const surveyId = params.id as string
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allSurveyors, setAllSurveyors] = useState<Surveyor[]>([])
  const [allZones, setAllZones] = useState<Zone[]>([])
  const [selectedZoneGeometry, setSelectedZoneGeometry] = useState<GeoJSON | null>(null)
  const [displayedZoneId, setDisplayedZoneId] = useState<string | null>(null)
  const [mapKey, setMapKey] = useState<string>("")
  
  // Estados para tracking de encuestadores
  const [surveyorLocations, setSurveyorLocations] = useState<any[]>([])
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Estados para grabaciones de audio del portal de encuestador (ver
  // app/api/surveys/[id]/recordings/route.ts) — segmentos scope='survey'
  // ligados a las respuestas de esta encuesta específica.
  const [recordings, setRecordings] = useState<any[]>([])
  const [loadingRecordings, setLoadingRecordings] = useState(false)
  const [recordingsError, setRecordingsError] = useState<string | null>(null)
  const [recordingsDiagnostic, setRecordingsDiagnostic] = useState<any>(null)
  const [deletingRecordingId, setDeletingRecordingId] = useState<string | null>(null)
  // Búsqueda por nombre de encuestador dentro de la sección de grabaciones
  // (feedback 2026-07-29: "van a haber muchos encuestadores... eso se debe
  // ver mejor organizado" — con decenas de encuestadores y varios audios
  // cada uno por encuesta, una lista plana se vuelve inmanejable).
  const [recordingsSearch, setRecordingsSearch] = useState("")

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const { data: surveyData, error: surveyError } = await (supabase as any)
          .from("surveys")
          .select(
            `
            *,
            assigned_surveyors,
            assigned_zones,
            projects (
              id,
              name,
              companies (
                name,
                logo
              )
            )
          `,
          )
          .eq("id", surveyId)
          .single()

        if (surveyError) throw surveyError
        if (!surveyData) {
          setError("Encuesta no encontrada.")
          return
        }

        let parsedAssignedZones: string[] = []
        if (surveyData.assigned_zones) {
          try {
            parsedAssignedZones =
              typeof surveyData.assigned_zones === "string"
                ? JSON.parse(surveyData.assigned_zones)
                : surveyData.assigned_zones
          } catch (e) {
            console.error("Error parsing assigned_zones:", e)
            parsedAssignedZones = []
          }
        }

        setSurvey({ ...(surveyData as any), assigned_zones: parsedAssignedZones })

        const { data: surveyorsData, error: surveyorsError } = await supabase
          .from("surveyors")
          .select("id, name, email")
        if (surveyorsError) console.error("Error fetching surveyors:", surveyorsError)
        if (surveyorsData) setAllSurveyors(surveyorsData)

        const { data: zonesData, error: zonesError } = await supabase.from("zones").select("id, name, geometry")
        if (zonesError) console.error("Error fetching zones:", zonesError)
        if (zonesData) setAllZones(zonesData as any)

        if (parsedAssignedZones.length > 0 && zonesData) {
          const firstZoneId = parsedAssignedZones[0]
          setDisplayedZoneId(firstZoneId)
          const zone = zonesData.find((z) => z.id === firstZoneId)
          if (zone && zone.geometry) {
            setSelectedZoneGeometry(zone.geometry as any)
            setMapKey(`zone-${firstZoneId}-${crypto.randomUUID()}`)
          }
        }
      } catch (err: any) {
        console.error("Error fetching survey details:", err)
        setError(err.message || "No se pudo cargar los detalles de la encuesta.")
        toast({
          title: "Error",
          description: err.message || "No se pudo cargar los detalles de la encuesta",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (user && surveyId) {
      fetchData()
    }
  }, [user, surveyId, toast])

  // Función para cargar ubicaciones de encuestadores
  const fetchSurveyorLocations = useCallback(async () => {
    if (!survey?.assigned_surveyors || survey.assigned_surveyors.length === 0) {
      return
    }

    setLoadingLocations(true)
    try {
      const response = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyor_ids: survey.assigned_surveyors,
          minutes: 60,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setSurveyorLocations(data.surveyors || [])
      }
    } catch (error) {
      console.error("Error fetching surveyor locations:", error)
    } finally {
      setLoadingLocations(false)
    }
  }, [survey?.assigned_surveyors])

  // Cargar ubicaciones cuando cambia la encuesta
  useEffect(() => {
    if (survey && survey.assigned_surveyors && survey.assigned_surveyors.length > 0) {
      fetchSurveyorLocations()
    }
  }, [survey, fetchSurveyorLocations])

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    if (!autoRefresh || !survey?.assigned_surveyors || survey.assigned_surveyors.length === 0) {
      return
    }

    const interval = setInterval(fetchSurveyorLocations, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, survey?.assigned_surveyors, fetchSurveyorLocations])

  // Carga las grabaciones de audio del portal de encuestador para esta
  // encuesta. Las URLs firmadas expiran a la hora, así que se re-piden en
  // cada carga de la página (no se cachean entre sesiones).
  const fetchRecordings = useCallback(async () => {
    if (!surveyId) return
    setLoadingRecordings(true)
    setRecordingsError(null)
    try {
      const response = await fetch(`/api/surveys/${surveyId}/recordings`)
      const data = await response.json()
      if (!response.ok) throw new Error(data?.diagnostic || data?.details || data?.error || "No se pudieron cargar las grabaciones")
      setRecordings(data.recordings || [])
      setRecordingsDiagnostic(data.diagnostic || null)
    } catch (err: any) {
      console.error("Error fetching recordings:", err)
      setRecordingsError(err.message || "No se pudieron cargar las grabaciones")
    } finally {
      setLoadingRecordings(false)
    }
  }, [surveyId])

  useEffect(() => {
    if (surveyId) fetchRecordings()
  }, [surveyId, fetchRecordings])

  const handleDeleteRecording = useCallback(async (recordingId: string) => {
    if (!confirm("¿Eliminar esta grabación de audio? Esta acción no se puede deshacer.")) return
    setDeletingRecordingId(recordingId)
    try {
      const response = await fetch(`/api/surveys/${surveyId}/recordings/${recordingId}`, { method: "DELETE" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.details || data?.error || "No se pudo eliminar la grabación")
      setRecordings((prev) => prev.filter((r) => r.id !== recordingId))
      toast({ title: "Grabación eliminada" })
    } catch (err: any) {
      console.error("Error deleting recording:", err)
      toast({ title: "Error", description: err.message || "No se pudo eliminar la grabación", variant: "destructive" })
    } finally {
      setDeletingRecordingId(null)
    }
  }, [surveyId, toast])

  // Agrupa las grabaciones por encuestador (surveyorId — no por nombre, ver
  // comentario en app/api/surveys/[id]/recordings/route.ts) y aplica el
  // filtro de búsqueda. Cada grupo conserva el orden ya-descendente por
  // fecha que devuelve la API. Los grupos se ordenan por la grabación más
  // reciente de cada encuestador, para que quien tuvo actividad hace poco
  // aparezca primero — eso es lo que un admin normalmente quiere ver.
  const recordingGroups = useMemo(() => {
    const bySurveyor = new Map<string, { surveyorId: string; surveyorName: string; items: any[] }>()
    for (const rec of recordings) {
      const key = rec.surveyorId || rec.surveyorName || "desconocido"
      if (!bySurveyor.has(key)) {
        bySurveyor.set(key, { surveyorId: key, surveyorName: rec.surveyorName || "Encuestador desconocido", items: [] })
      }
      bySurveyor.get(key)!.items.push(rec)
    }
    const query = recordingsSearch.trim().toLowerCase()
    const groups = Array.from(bySurveyor.values())
      .filter((g) => !query || g.surveyorName.toLowerCase().includes(query))
      .sort((a, b) => {
        const aLatest = a.items[0]?.startedAt ? new Date(a.items[0].startedAt).getTime() : 0
        const bLatest = b.items[0]?.startedAt ? new Date(b.items[0].startedAt).getTime() : 0
        return bLatest - aLatest
      })
    return groups
  }, [recordings, recordingsSearch])

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    router.push("/login")
    return null
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6">
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <p>{error}</p>
          </Alert>
          <Button onClick={() => router.back()} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  if (!survey) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 text-center text-muted-foreground">
          <p>No se encontró la encuesta.</p>
          <Button onClick={() => router.back()} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const assignedSurveyors =
    survey.assigned_surveyors?.map((id) => allSurveyors.find((s) => s.id === id)).filter(Boolean) || []
  const assignedZones = survey.assigned_zones ? allZones.filter((z) => (survey.assigned_zones as any[]).includes(z.id)) : []
  const displayedZone = displayedZoneId ? allZones.find((z) => z.id === displayedZoneId) : null

  const formatDuration = (secs: number | null) => {
    if (secs === null || secs === undefined) return "—"
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  const outcomeLabel = (outcome: string | null) => {
    if (outcome === "efectiva") return { label: "Efectiva", variant: "default" as const }
    if (outcome === "abandonada") return { label: "Abandonada", variant: "secondary" as const }
    if (outcome === "incidencia") return { label: "Incidencia", variant: "outline" as const }
    if (outcome === "descalificado") return { label: "Descalificado", variant: "outline" as const }
    return { label: "Sin definir", variant: "outline" as const }
  }

  const handleZoneChange = (zoneId: string) => {
    setDisplayedZoneId(zoneId)
    const zone = allZones.find((z) => z.id === zoneId)
    if (zone && zone.geometry) {
      setSelectedZoneGeometry(zone.geometry)
              setMapKey(`zone-${zoneId}-${crypto.randomUUID()}`)
    } else {
      setSelectedZoneGeometry(null)
      setMapKey("")
    }
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" className="mr-3" onClick={() => router.push("/surveys")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">{survey.title}</h1>
            {survey.projects && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">{survey.projects.companies?.name}</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  <span className="font-medium">{survey.projects.name}</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/projects/${survey.project_id}/create-survey?fromSurvey=${survey.id}`)}
              className="text-[#18b0a4] hover:text-[#139488] hover:bg-[#18b0a4]/10"
            >
              <Plus className="h-4 w-4 mr-2" /> Nueva Encuesta
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/projects/${survey.project_id}/create-survey?surveyId=${survey.id}`)}
            >
              <Edit className="h-4 w-4 mr-2" /> Editar
            </Button>
            <Button variant="destructive" size="sm" onClick={() => {}}>
              <Trash2 className="h-4 w-4 mr-2" /> Eliminar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Detalles de la Encuesta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Descripción</p>
                  <p className="text-base">{survey.description || "No hay descripción."}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Estado</p>
                    <Badge variant={survey.status === "active" ? "default" : "secondary"}>{survey.status}</Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Fecha de Inicio</p>
                    <p className="text-base">
                      {survey.start_date ? format(new Date(survey.start_date), "dd/MM/yyyy") : "No definida"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Fecha Límite</p>
                    <p className="text-base">
                      {survey.deadline ? format(new Date(survey.deadline), "dd/MM/yyyy") : "No definida"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" /> Configuración
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Corrección 2026-07-29: originalmente estos badges eran
                      decorativos (el motor de grabación/tracking los
                      ignoraba, siempre grababa todo). El usuario pidió que
                      SÍ fueran funcionales de verdad — ahora
                      settings.allowAudio/collectLocation realmente pausan la
                      grabación de audio y el reporte de ubicación mientras
                      el encuestador está DENTRO de esta encuesta puntual
                      (ver lib/portal-encuestador/use-shift-recording.ts y
                      use-location-tracking.ts). Fuera de una encuesta, el
                      turno completo del encuestador se sigue grabando y
                      ubicando siempre, sin excepción — esto solo afecta el
                      segmento específico de esta encuesta. */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Recolección de Ubicación</p>
                    <Badge variant={survey.settings?.collectLocation ? "default" : "outline"}>
                      {survey.settings?.collectLocation ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Grabación de Audio</p>
                    <Badge variant={survey.settings?.allowAudio ? "default" : "outline"}>
                      {survey.settings?.allowAudio ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Modo Offline</p>
                    <Badge variant={survey.settings?.offlineMode ? "default" : "outline"}>
                      {survey.settings?.offlineMode ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Métodos de Distribución</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {survey.settings?.distributionMethods?.map((method) => (
                        <Badge key={method} variant="secondary">
                          {method}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" /> Encuestadores Asignados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {assignedSurveyors.length > 0 ? (
                  assignedSurveyors.map((surveyor: any) => (
                    <div key={surveyor.id} className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>
                          {surveyor.name
                            ? surveyor.name.substring(0, 2).toUpperCase()
                            : surveyor.email.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{surveyor.name || surveyor.email}</p>
                        <p className="text-xs text-muted-foreground">{surveyor.email}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No hay encuestadores asignados.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" /> {assignedZones.length > 1 ? "Zonas Asignadas" : "Zona Asignada"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {assignedZones.length > 0 ? (
                  <>
                    {assignedZones.length > 1 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Seleccionar zona:</label>
                        <select
                          value={displayedZoneId || ""}
                          onChange={(e) => handleZoneChange(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                          {assignedZones.map((zone) => (
                            <option key={zone.id} value={zone.id}>
                              {zone.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {displayedZone && (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{displayedZone.name}</p>
                          {assignedZones.length > 1 && (
                            <Badge variant="outline" className="text-xs">
                              {assignedZones.findIndex((z) => z.id === displayedZoneId) + 1} de {assignedZones.length}
                            </Badge>
                          )}
                        </div>
                        <div className="relative w-full h-[250px] overflow-hidden rounded-lg border">
                          {selectedZoneGeometry && mapKey ? (
                            <MapWithDrawing
                              key={mapKey}
                              initialGeometry={selectedZoneGeometry}
                              onGeometryChange={() => {}}
                              readOnly={true}
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                              <MapPin className="h-8 w-8 mr-2" />
                              {selectedZoneGeometry ? "Cargando mapa..." : "No se pudo cargar la geometría de la zona."}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No hay zonas asignadas.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sección de Tracking de Encuestadores */}
        {assignedSurveyors.length > 0 && (
          <div className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Radio className="h-5 w-5" /> Ubicación de Encuestadores en Tiempo Real
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={fetchSurveyorLocations}
                      disabled={loadingLocations}
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingLocations ? "animate-spin" : ""}`} />
                    </Button>
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                        className="rounded"
                      />
                      Auto-actualizar
                    </label>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingLocations && surveyorLocations.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : surveyorLocations.length > 0 ? (
                  <div className="space-y-4">
                    {/* Estadísticas rápidas */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950">
                        <div className="text-lg font-bold text-green-600">
                          {surveyorLocations.filter(s => s.status === "active" && s.current_location?.is_in_zone).length}
                        </div>
                        <div className="text-xs text-muted-foreground">En zona</div>
                      </div>
                      <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950">
                        <div className="text-lg font-bold text-red-600">
                          {surveyorLocations.filter(s => s.current_location && !s.current_location?.is_in_zone).length}
                        </div>
                        <div className="text-xs text-muted-foreground">Fuera</div>
                      </div>
                      <div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950">
                        <div className="text-lg font-bold text-yellow-600">
                          {surveyorLocations.filter(s => s.status === "inactive").length}
                        </div>
                        <div className="text-xs text-muted-foreground">Inactivos</div>
                      </div>
                      <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-950">
                        <div className="text-lg font-bold text-gray-600">
                          {surveyorLocations.filter(s => s.status === "offline").length}
                        </div>
                        <div className="text-xs text-muted-foreground">Offline</div>
                      </div>
                    </div>

                    {/* Mapa */}
                    <div className="h-[400px] rounded-lg overflow-hidden border">
                      <TrackingMap
                        surveyors={surveyorLocations}
                        zones={assignedZones.map(z => ({
                          id: z.id,
                          name: z.name,
                          geometry: z.geometry,
                          status: "active",
                          zone_color: "#18b0a4"
                        }))}
                        centerOnZone={displayedZoneId || "all"}
                      />
                    </div>

                    {/* Lista de encuestadores con estado */}
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {surveyorLocations.map((surveyor) => (
                        <div
                          key={surveyor.id}
                          className="flex items-center justify-between p-2 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                surveyor.status === "active"
                                  ? surveyor.current_location?.is_in_zone
                                    ? "bg-green-500"
                                    : "bg-red-500"
                                  : surveyor.status === "inactive"
                                  ? "bg-yellow-500"
                                  : "bg-gray-400"
                              }`}
                            />
                            <div>
                              <p className="text-sm font-medium">{surveyor.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {surveyor.current_location
                                  ? `hace ${surveyor.current_location.minutes_ago} min`
                                  : "Sin ubicación"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {surveyor.current_location?.battery_level !== null && surveyor.current_location?.battery_level !== undefined && (
                              <span className="text-xs text-muted-foreground">
                                {surveyor.current_location.battery_level}%
                              </span>
                            )}
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                surveyor.status === "active"
                                  ? "border-green-500 text-green-600"
                                  : surveyor.status === "inactive"
                                  ? "border-yellow-500 text-yellow-600"
                                  : "border-gray-400 text-gray-500"
                              }`}
                            >
                              {surveyor.status === "active"
                                ? "Activo"
                                : surveyor.status === "inactive"
                                ? "Inactivo"
                                : "Offline"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                    <MapPin className="h-12 w-12 mb-2 opacity-50" />
                    <p className="text-sm">No hay ubicaciones registradas</p>
                    <p className="text-xs mt-1">Los encuestadores aparecerán cuando activen su ubicación en la APK</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Sección de Grabaciones de Audio (portal de encuestador) —
            agrupadas por encuestador (feedback 2026-07-29: con muchos
            encuestadores y varios audios cada uno por encuesta, la lista
            plana anterior se volvía imposible de recorrer). */}
        <div className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" /> Grabaciones de Audio
                  {recordings.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      · {recordingGroups.length} encuestador{recordingGroups.length !== 1 ? "es" : ""} · {recordings.length} grabación{recordings.length !== 1 ? "es" : ""}
                    </span>
                  )}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={fetchRecordings} disabled={loadingRecordings}>
                  <RefreshCw className={`h-4 w-4 ${loadingRecordings ? "animate-spin" : ""}`} />
                </Button>
              </div>
              {recordings.length > 0 && (
                <div className="relative mt-2 max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={recordingsSearch}
                    onChange={(e) => setRecordingsSearch(e.target.value)}
                    placeholder="Buscar encuestador..."
                    className="pl-8 h-9"
                  />
                </div>
              )}
            </CardHeader>
            <CardContent>
              {loadingRecordings && recordings.length === 0 ? (
                <div className="flex items-center justify-center h-[150px]">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : recordingsError ? (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <p>{recordingsError}</p>
                </Alert>
              ) : recordings.length > 0 ? (
                recordingGroups.length > 0 ? (
                  <Accordion type="multiple" className="w-full">
                    {recordingGroups.map((group) => (
                      <AccordionItem key={group.surveyorId} value={group.surveyorId}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-2 text-left">
                            <span className="text-sm font-medium">{group.surveyorName}</span>
                            <Badge variant="secondary" className="text-xs">
                              {group.items.length} grabación{group.items.length !== 1 ? "es" : ""}
                            </Badge>
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                              Última: {group.items[0]?.startedAt ? format(new Date(group.items[0].startedAt), "dd/MM/yyyy HH:mm") : "—"}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3">
                            {group.items.map((rec) => {
                              const outcome = outcomeLabel(rec.outcome)
                              return (
                                <div key={rec.id} className="flex flex-col gap-2 p-3 rounded-lg border bg-card sm:flex-row sm:items-center sm:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant={outcome.variant} className="text-xs">{outcome.label}</Badge>
                                      {rec.incidenceType && (
                                        <span className="text-xs text-muted-foreground">({rec.incidenceType})</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {rec.startedAt ? format(new Date(rec.startedAt), "dd/MM/yyyy HH:mm") : "Fecha desconocida"}
                                      {" · "}Duración: {formatDuration(rec.durationSecs)}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {rec.audioUrl ? (
                                      <>
                                        <audio controls preload="none" src={rec.audioUrl} className="h-9 max-w-[220px]" />
                                        <Button variant="outline" size="icon" asChild>
                                          <a href={rec.audioUrl} download={rec.fileName} title="Descargar audio">
                                            <Download className="h-4 w-4" />
                                          </a>
                                        </Button>
                                      </>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">Audio no disponible</span>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="text-destructive hover:text-destructive"
                                      disabled={deletingRecordingId === rec.id}
                                      onClick={() => handleDeleteRecording(rec.id)}
                                      title="Eliminar grabación"
                                    >
                                      {deletingRecordingId === rec.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[100px] text-muted-foreground">
                    <p className="text-sm">Ningún encuestador coincide con "{recordingsSearch}"</p>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-3">
                  <Mic className="h-10 w-10 opacity-40" />
                  <p className="text-sm font-medium">No hay grabaciones para esta encuesta</p>
                  {recordingsDiagnostic && (
                    <div className="max-w-md text-center space-y-1">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {recordingsDiagnostic.hint || recordingsDiagnostic}
                      </p>
                      {(recordingsDiagnostic.failedRecordingsCount > 0 || recordingsDiagnostic.pendingRecordingsCount > 0) && (
                        <div className="flex gap-3 justify-center mt-2 text-xs">
                          {recordingsDiagnostic.failedRecordingsCount > 0 && (
                            <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">
                              {recordingsDiagnostic.failedRecordingsCount} fallidas
                            </span>
                          )}
                          {recordingsDiagnostic.pendingRecordingsCount > 0 && (
                            <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
                              {recordingsDiagnostic.pendingRecordingsCount} pendientes
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
