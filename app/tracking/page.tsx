"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { 
  MapPin, Battery, BatteryLow, BatteryCharging, Wifi, WifiOff, 
  Users, RefreshCw, Map, List, Clock, AlertTriangle, CheckCircle2,
  Loader2
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import dynamic from "next/dynamic"

// Importar el mapa dinámicamente (sin SSR)
const TrackingMap = dynamic(() => import("@/components/tracking-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[500px] w-full flex items-center justify-center bg-muted rounded-lg">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="ml-2">Cargando mapa...</span>
    </div>
  ),
})

// Tipos
interface SurveyorLocation {
  id: string
  name: string
  email: string
  phone_number: string
  status: "active" | "inactive" | "offline"
  current_location: {
    latitude: number
    longitude: number
    accuracy: number | null
    battery_level: number | null
    is_charging: boolean
    is_in_zone: boolean
    zone: { id: string; name: string } | null
    active_survey: { id: string; title: string } | null
    recorded_at: string
    minutes_ago: number
  } | null
}

interface Zone {
  id: string
  name: string
  geometry: any
  status: string
  zone_color: string
}

interface Survey {
  id: string
  title: string
  status: string
}

interface TrackingStats {
  total: number
  active: number
  inactive: number
  offline: number
  in_zone: number
  out_of_zone: number
  low_battery: number
}

interface TrackingResponse {
  surveyors: SurveyorLocation[]
  stats: TrackingStats
  zones: Zone[]
  last_update: string
}

export default function TrackingPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  // Estados
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState<TrackingResponse | null>(null)
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("all")
  const [selectedZoneId, setSelectedZoneId] = useState<string>("all")
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [viewMode, setViewMode] = useState<"map" | "list">("map")
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Redirigir si no está autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  // Cargar encuestas para el filtro
  const fetchSurveys = async () => {
    try {
      const response = await fetch("/api/surveys")
      if (response.ok) {
        const data = await response.json()
        setSurveys(data.filter((s: Survey) => s.status === "active"))
      }
    } catch (error) {
      console.error("Error fetching surveys:", error)
    }
  }

  // Cargar datos de tracking
  const fetchTrackingData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    
    try {
      const params = new URLSearchParams()
      if (selectedSurveyId && selectedSurveyId !== "all") {
        params.append("survey_id", selectedSurveyId)
      }
      if (selectedZoneId && selectedZoneId !== "all") {
        params.append("zone_id", selectedZoneId)
      }
      params.append("minutes", "60")

      const response = await fetch(`/api/tracking?${params.toString()}`)
      if (!response.ok) throw new Error("Error fetching tracking data")

      const trackingData: TrackingResponse = await response.json()
      setData(trackingData)
    } catch (error: any) {
      console.error("Error fetching tracking data:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos de tracking.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedSurveyId, selectedZoneId, toast])

  // Cargar datos iniciales
  useEffect(() => {
    if (user) {
      fetchSurveys()
      fetchTrackingData()
    }
  }, [user])

  // Actualizar cuando cambien los filtros
  useEffect(() => {
    if (user) {
      fetchTrackingData()
    }
  }, [selectedSurveyId, selectedZoneId])

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    if (!autoRefresh || !user) return

    const interval = setInterval(() => {
      fetchTrackingData()
    }, 30000)

    return () => clearInterval(interval)
  }, [autoRefresh, user, fetchTrackingData])

  // Formatear tiempo
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
  }

  // Obtener color del badge de estado
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500 hover:bg-green-600">Activo</Badge>
      case "inactive":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Inactivo</Badge>
      default:
        return <Badge variant="secondary">Offline</Badge>
    }
  }

  // Obtener icono de batería
  const getBatteryIcon = (level: number | null, isCharging: boolean) => {
    if (level === null) return <Battery className="h-4 w-4 text-muted-foreground" />
    if (isCharging) return <BatteryCharging className="h-4 w-4 text-green-500" />
    if (level < 20) return <BatteryLow className="h-4 w-4 text-red-500" />
    return <Battery className="h-4 w-4 text-green-500" />
  }

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <MapPin className="h-8 w-8 text-primary" />
              Seguimiento de Encuestadores
            </h1>
            <p className="text-muted-foreground">
              Monitorea la ubicación en tiempo real de tus encuestadores
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchTrackingData(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
            </Button>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{data?.stats.total || 0}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-500">{data?.stats.active || 0}</p>
                  <p className="text-xs text-muted-foreground">Activos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold text-yellow-500">{data?.stats.inactive || 0}</p>
                  <p className="text-xs text-muted-foreground">Inactivos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <WifiOff className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-2xl font-bold text-gray-500">{data?.stats.offline || 0}</p>
                  <p className="text-xs text-muted-foreground">Offline</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{data?.stats.in_zone || 0}</p>
                  <p className="text-xs text-muted-foreground">En Zona</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold text-orange-500">{data?.stats.out_of_zone || 0}</p>
                  <p className="text-xs text-muted-foreground">Fuera de Zona</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BatteryLow className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-500">{data?.stats.low_battery || 0}</p>
                  <p className="text-xs text-muted-foreground">Batería Baja</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Filtrar por Encuesta</label>
                <Select value={selectedSurveyId} onValueChange={setSelectedSurveyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las encuestas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las encuestas</SelectItem>
                    {surveys.map((survey) => (
                      <SelectItem key={survey.id} value={survey.id}>
                        {survey.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Filtrar por Zona</label>
                <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las zonas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las zonas</SelectItem>
                    {data?.zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zone.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <div className="flex border rounded-lg overflow-hidden">
                  <Button
                    variant={viewMode === "map" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("map")}
                    className="rounded-none"
                  >
                    <Map className="h-4 w-4 mr-2" />
                    Mapa
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="rounded-none"
                  >
                    <List className="h-4 w-4 mr-2" />
                    Lista
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contenido principal con Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="all">
              Todos los Encuestadores
              <Badge variant="secondary" className="ml-2">
                {data?.surveyors.length || 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="by-survey">
              Por Encuesta
            </TabsTrigger>
            <TabsTrigger value="by-zone">
              Por Zona
            </TabsTrigger>
          </TabsList>

          {/* Tab: Todos los encuestadores */}
          <TabsContent value="all">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : viewMode === "map" ? (
              <Card>
                <CardContent className="p-0">
                  <TrackingMap 
                    surveyors={data?.surveyors || []}
                    zones={data?.zones || []}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Lista de Encuestadores</CardTitle>
                  <CardDescription>
                    Última actualización: {data?.last_update ? formatTime(data.last_update) : "N/A"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {data?.surveyors.map((surveyor) => (
                        <div
                          key={surveyor.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-medium">
                                  {surveyor.name.substring(0, 2).toUpperCase()}
                                </span>
                              </div>
                              <div className="absolute -bottom-1 -right-1">
                                {surveyor.status === "active" ? (
                                  <div className="h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                                ) : surveyor.status === "inactive" ? (
                                  <div className="h-3 w-3 rounded-full bg-yellow-500 border-2 border-background" />
                                ) : (
                                  <div className="h-3 w-3 rounded-full bg-gray-400 border-2 border-background" />
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="font-medium">{surveyor.name}</p>
                              <p className="text-sm text-muted-foreground">{surveyor.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {surveyor.current_location && (
                              <>
                                <div className="text-right">
                                  <p className="text-sm">
                                    {surveyor.current_location.zone?.name || "Sin zona"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    hace {surveyor.current_location.minutes_ago} min
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  {getBatteryIcon(
                                    surveyor.current_location.battery_level,
                                    surveyor.current_location.is_charging
                                  )}
                                  <span className="text-xs">
                                    {surveyor.current_location.battery_level ?? "--"}%
                                  </span>
                                </div>
                              </>
                            )}
                            {getStatusBadge(surveyor.status)}
                          </div>
                        </div>
                      ))}
                      {data?.surveyors.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          No hay encuestadores para mostrar
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab: Por Encuesta */}
          <TabsContent value="by-survey">
            <Card>
              <CardHeader>
                <CardTitle>Encuestadores por Encuesta</CardTitle>
                <CardDescription>
                  Selecciona una encuesta para ver los encuestadores asignados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Select value={selectedSurveyId} onValueChange={setSelectedSurveyId}>
                    <SelectTrigger className="w-full md:w-[300px]">
                      <SelectValue placeholder="Seleccionar encuesta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las encuestas</SelectItem>
                      {surveys.map((survey) => (
                        <SelectItem key={survey.id} value={survey.id}>
                          {survey.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedSurveyId !== "all" ? (
                  viewMode === "map" ? (
                    <TrackingMap 
                      surveyors={data?.surveyors || []}
                      zones={data?.zones || []}
                    />
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {data?.surveyors.map((surveyor) => (
                          <div
                            key={surveyor.id}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-medium">
                                  {surveyor.name.substring(0, 2).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium">{surveyor.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {surveyor.current_location?.zone?.name || "Sin zona asignada"}
                                </p>
                              </div>
                            </div>
                            {getStatusBadge(surveyor.status)}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Selecciona una encuesta para ver los encuestadores asignados
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Por Zona */}
          <TabsContent value="by-zone">
            <Card>
              <CardHeader>
                <CardTitle>Encuestadores por Zona</CardTitle>
                <CardDescription>
                  Selecciona una zona para ver los encuestadores en esa área
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
                    <SelectTrigger className="w-full md:w-[300px]">
                      <SelectValue placeholder="Seleccionar zona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las zonas</SelectItem>
                      {data?.zones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedZoneId !== "all" ? (
                  viewMode === "map" ? (
                    <TrackingMap 
                      surveyors={data?.surveyors || []}
                      zones={data?.zones?.filter(z => z.id === selectedZoneId) || []}
                      centerOnZone={selectedZoneId}
                    />
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {data?.surveyors.map((surveyor) => (
                          <div
                            key={surveyor.id}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-medium">
                                  {surveyor.name.substring(0, 2).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium">{surveyor.name}</p>
                                <div className="flex items-center gap-2">
                                  {surveyor.current_location?.is_in_zone ? (
                                    <Badge className="bg-green-500">En zona</Badge>
                                  ) : (
                                    <Badge variant="destructive">Fuera de zona</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            {getStatusBadge(surveyor.status)}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Selecciona una zona para ver los encuestadores en esa área
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer con última actualización */}
        <div className="text-center text-sm text-muted-foreground">
          Última actualización: {data?.last_update ? new Date(data.last_update).toLocaleString("es-CO") : "N/A"}
          {autoRefresh && " • Actualizando cada 30 segundos"}
        </div>
      </div>
    </DashboardLayout>
  )
}
