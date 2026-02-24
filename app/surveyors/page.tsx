"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, Edit, Trash2, UserPlus, MapPin, RefreshCw, Users, Radio } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Surveyor } from "@/types/surveyor"
import dynamic from "next/dynamic"

// Importar el mapa de tracking dinámicamente
const TrackingMap = dynamic(() => import("@/components/tracking-map"), {
  ssr: false,
})

// Tipos para tracking
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
}

export default function SurveyorsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  // Estados para encuestadores
  const [surveyors, setSurveyors] = useState<Surveyor[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSurveyor, setEditingSurveyor] = useState<Surveyor | null>(null)
  const [surveyorName, setSurveyorName] = useState("")
  const [surveyorEmail, setSurveyorEmail] = useState("")
  const [surveyorPhone, setSurveyorPhone] = useState("")
  const [surveyorPassword, setSurveyorPassword] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)
  const [surveyorToDelete, setSurveyorToDelete] = useState<Surveyor | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  // Estados para geolocalización
  const [surveyorLocations, setSurveyorLocations] = useState<SurveyorLocation[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  
  // Filtros
  const [filterSurveyId, setFilterSurveyId] = useState<string>("all")
  const [filterZoneId, setFilterZoneId] = useState<string>("all")
  const [filterSurveyorId, setFilterSurveyorId] = useState<string>("all")
  const [surveySearch, setSurveySearch] = useState("")
  const [showSurveyDropdown, setShowSurveyDropdown] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  const fetchSurveyors = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/surveyors")
      if (!response.ok) {
        throw new Error("Error fetching surveyors")
      }
      const data: Surveyor[] = await response.json()
      setSurveyors(data)
    } catch (error: any) {
      console.error("Error fetching surveyors:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudieron cargar los encuestadores.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Cargar zonas y encuestas para filtros
  const fetchFiltersData = async () => {
    try {
      const [zonesRes, surveysRes] = await Promise.all([
        fetch("/api/zones"),
        fetch("/api/surveys"),
      ])
      
      if (zonesRes.ok) {
        const zonesData = await zonesRes.json()
        setZones(zonesData.map((z: any) => ({
          id: z.id,
          name: z.name,
          geometry: z.geometry,
          status: z.status || "active",
          zone_color: z.zone_color || "#18b0a4"
        })))
      }
      
      if (surveysRes.ok) {
        const surveysData = await surveysRes.json()
        console.log("Surveys data:", surveysData)
        // La API devuelve directamente un array de encuestas
        if (Array.isArray(surveysData)) {
          setSurveys(surveysData.map((s: any) => ({
            id: s.id,
            title: s.title
          })))
        } else if (surveysData.surveys) {
          setSurveys(surveysData.surveys.map((s: any) => ({
            id: s.id,
            title: s.title
          })))
        } else {
          setSurveys([])
        }
      }
    } catch (error) {
      console.error("Error fetching filters data:", error)
    }
  }

  // Cargar ubicaciones de encuestadores
  const fetchSurveyorLocations = useCallback(async () => {
    setLoadingLocations(true)
    try {
      const body: any = { minutes: 120 }
      
      if (filterSurveyorId && filterSurveyorId !== "all") {
        body.surveyor_ids = [filterSurveyorId]
      }
      
      if (filterSurveyId && filterSurveyId !== "all") {
        body.survey_id = filterSurveyId
      }
      
      if (filterZoneId && filterZoneId !== "all") {
        body.zone_id = filterZoneId
      }

      const response = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
  }, [filterSurveyorId, filterSurveyId, filterZoneId])

  useEffect(() => {
    if (user) {
      fetchSurveyors()
      fetchFiltersData()
    }
  }, [user])

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = () => setShowSurveyDropdown(false)
    if (showSurveyDropdown) {
      document.addEventListener("click", handleClickOutside)
    }
    return () => {
      document.removeEventListener("click", handleClickOutside)
    }
  }, [showSurveyDropdown])

  // Cargar ubicaciones cuando cambian los filtros
  useEffect(() => {
    fetchSurveyorLocations()
  }, [fetchSurveyorLocations])

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchSurveyorLocations, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchSurveyorLocations])

  const handleAddSurveyor = () => {
    setEditingSurveyor(null)
    setSurveyorName("")
    setSurveyorEmail("")
    setSurveyorPhone("")
    setSurveyorPassword("")
    setIsModalOpen(true)
  }

  const handleEditSurveyor = (surveyor: Surveyor) => {
    setEditingSurveyor(surveyor)
    setSurveyorName(surveyor.name)
    setSurveyorEmail(surveyor.email)
    setSurveyorPhone(surveyor.phone_number || "")
    setIsModalOpen(true)
  }

  const handleSaveSurveyor = async () => {
    setIsSaving(true)

    if (!surveyorName.trim() || !surveyorEmail.trim()) {
      toast({
        title: "Error",
        description: "Nombre y correo son obligatorios.",
        variant: "destructive",
      })
      setIsSaving(false)
      return
    }

    if (!editingSurveyor && !surveyorPassword.trim()) {
      toast({
        title: "Error",
        description: "La contraseña es obligatoria para nuevos encuestadores.",
        variant: "destructive",
      })
      setIsSaving(false)
      return
    }

    const payload = {
      name: surveyorName,
      email: surveyorEmail,
      phone_number: surveyorPhone || null,
      ...(surveyorPassword && { password: surveyorPassword }),
    }

    try {
      const url = editingSurveyor ? `/api/surveyors?id=${editingSurveyor.id}` : "/api/surveyors"
      const method = editingSurveyor ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      let result = null
      try {
        const text = await response.text()
        if (text) {
          result = JSON.parse(text)
        }
      } catch (e) {
        console.error("Could not parse response as JSON on surveyor save", e)
      }

      if (!response.ok) {
        throw new Error(result?.error || "Error al guardar encuestador.")
      }

      toast({
        title: "Éxito",
        description: `Encuestador ${editingSurveyor ? "actualizado" : "añadido"} correctamente.`,
      })

      fetchSurveyors()
      setIsModalOpen(false)
    } catch (error: any) {
      console.error("Error saving surveyor:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el encuestador.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSurveyor = (surveyor: Surveyor) => {
    setSurveyorToDelete(surveyor)
    setIsConfirmDeleteOpen(true)
  }

  const confirmDeleteSurveyor = async () => {
    if (!surveyorToDelete) return
    setIsSaving(true)
    try {
      const response = await fetch(`/api/surveyors?id=${surveyorToDelete.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        let errorMessage = "Error al eliminar encuestador."
        try {
          const errorData = await response.json()
          if (errorData && errorData.error) {
            errorMessage = errorData.error
          }
        } catch (e) {}
        throw new Error(errorMessage)
      }

      toast({
        title: "Éxito",
        description: "Encuestador eliminado correctamente.",
      })
      fetchSurveyors()
      setIsConfirmDeleteOpen(false)
      setSurveyorToDelete(null)
    } catch (error: any) {
      console.error("Error deleting surveyor:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el encuestador.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const filteredSurveyors = surveyors.filter(
    (surveyor) =>
      surveyor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      surveyor.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Filtrar zonas para el mapa
  const filteredZones = filterZoneId && filterZoneId !== "all" 
    ? zones.filter(z => z.id === filterZoneId)
    : zones

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Encuestadores</h1>
            <p className="text-muted-foreground">Gestiona los perfiles de los encuestadores y su ubicación.</p>
          </div>
        </div>

        <Tabs defaultValue="surveyors" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="surveyors" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Encuestadores
            </TabsTrigger>
            <TabsTrigger value="geolocation" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Geolocalización
            </TabsTrigger>
          </TabsList>

          {/* Tab de Encuestadores */}
          <TabsContent value="surveyors">
            <div className="flex flex-col sm:flex-row gap-2 mb-4 justify-end">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar encuestador..."
                  className="pl-8 w-full sm:w-[250px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button className="gap-2" onClick={handleAddSurveyor}>
                <UserPlus className="h-4 w-4" /> Añadir Encuestador
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>Lista de Encuestadores</CardTitle>
                  <CardDescription>Una lista de todos los encuestadores registrados en tu plataforma.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-primary-tableHeader">
                        <TableRow className="border-b border-border">
                          <TableHead className="w-[50px] py-3 px-4">Avatar</TableHead>
                          <TableHead className="py-3 px-4 min-w-[150px]">Nombre</TableHead>
                          <TableHead className="py-3 px-4 min-w-[200px]">Correo</TableHead>
                          <TableHead className="hidden md:table-cell py-3 px-4">Teléfono</TableHead>
                          <TableHead className="hidden sm:table-cell py-3 px-4">Estado</TableHead>
                          <TableHead className="hidden lg:table-cell py-3 px-4">Creado en</TableHead>
                          <TableHead className="text-right py-3 px-4">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSurveyors.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                              No se encontraron encuestadores.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredSurveyors.map((surveyor) => (
                            <TableRow key={surveyor.id} className="border-b border-border hover:bg-muted/50">
                              <TableCell className="py-3 px-4">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback>
                                    {surveyor.name
                                      ? surveyor.name.substring(0, 2).toUpperCase()
                                      : surveyor.email.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              </TableCell>
                              <TableCell className="font-medium py-3 px-4">
                                <div className="truncate max-w-[150px]" title={surveyor.name}>
                                  {surveyor.name}
                                </div>
                              </TableCell>
                              <TableCell className="py-3 px-4">
                                <div className="truncate max-w-[200px]" title={surveyor.email}>
                                  {surveyor.email}
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell py-3 px-4">
                                <span className="whitespace-nowrap">
                                  {surveyor.phone_number || "N/A"}
                                </span>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell capitalize py-3 px-4">
                                <span className="whitespace-nowrap">{surveyor.status}</span>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell py-3 px-4">
                                <span className="whitespace-nowrap">
                                  {surveyor.created_at ? new Date(surveyor.created_at).toLocaleDateString() : "N/A"}
                                </span>
                              </TableCell>
                              <TableCell className="text-right py-3 px-4">
                                <Button variant="ghost" size="sm" onClick={() => handleEditSurveyor(surveyor)}>
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Editar</span>
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteSurveyor(surveyor)}>
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Eliminar</span>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab de Geolocalización */}
          <TabsContent value="geolocation">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Radio className="h-5 w-5" /> Ubicación en Tiempo Real
                    </CardTitle>
                    <CardDescription>
                      Visualiza la ubicación de tus encuestadores en el mapa.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchSurveyorLocations}
                      disabled={loadingLocations}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${loadingLocations ? "animate-spin" : ""}`} />
                      Actualizar
                    </Button>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
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
                {/* Filtros */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 relative z-50">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Encuesta</label>
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <Input
                        type="text"
                        placeholder="Buscar encuesta..."
                        value={surveySearch || (filterSurveyId !== "all" ? surveys.find(s => s.id === filterSurveyId)?.title || "" : "")}
                        onChange={(e) => {
                          setSurveySearch(e.target.value)
                          setShowSurveyDropdown(true)
                        }}
                        onFocus={() => setShowSurveyDropdown(true)}
                        className="w-full"
                      />
                      {filterSurveyId !== "all" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-8 top-0 h-full px-2"
                          onClick={() => {
                            setFilterSurveyId("all")
                            setSurveySearch("")
                          }}
                        >
                          ×
                        </Button>
                      )}
                      {/* Dropdown con lista de encuestas */}
                      {showSurveyDropdown && (
                        <div 
                          className="absolute z-[9999] w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            className={`px-3 py-2 cursor-pointer hover:bg-muted ${
                              filterSurveyId === "all" ? "bg-muted" : ""
                            }`}
                            onClick={() => {
                              setFilterSurveyId("all")
                              setSurveySearch("")
                              setShowSurveyDropdown(false)
                            }}
                          >
                            Todas las encuestas
                          </div>
                          {surveys
                            .filter(s => !surveySearch || s.title.toLowerCase().includes(surveySearch.toLowerCase()))
                            .length > 0 ? (
                            surveys
                              .filter(s => !surveySearch || s.title.toLowerCase().includes(surveySearch.toLowerCase()))
                              .map((survey) => (
                                <div
                                  key={survey.id}
                                  className={`px-3 py-2 cursor-pointer hover:bg-muted ${
                                    filterSurveyId === survey.id ? "bg-muted" : ""
                                  }`}
                                  onClick={() => {
                                    setFilterSurveyId(survey.id)
                                    setSurveySearch("")
                                    setShowSurveyDropdown(false)
                                  }}
                                >
                                  {survey.title}
                                </div>
                              ))
                          ) : (
                            <div className="px-3 py-2 text-muted-foreground text-sm">
                              No se encontraron encuestas
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Zona</label>
                    <Select value={filterZoneId} onValueChange={setFilterZoneId}>
                      <SelectTrigger className="relative z-[100]">
                        <SelectValue placeholder="Todas las zonas" />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        <SelectItem value="all">Todas las zonas</SelectItem>
                        {zones.map((zone) => (
                          <SelectItem key={zone.id} value={zone.id}>
                            {zone.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Encuestador</label>
                    <Select value={filterSurveyorId} onValueChange={setFilterSurveyorId}>
                      <SelectTrigger className="relative z-[100]">
                        <SelectValue placeholder="Todos los encuestadores" />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        <SelectItem value="all">Todos los encuestadores</SelectItem>
                        {surveyors.map((surveyor) => (
                          <SelectItem key={surveyor.id} value={surveyor.id}>
                            {surveyor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Estadísticas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {surveyorLocations.filter(s => s.status === "active" && s.current_location?.is_in_zone).length}
                    </div>
                    <div className="text-xs text-muted-foreground">En zona</div>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {surveyorLocations.filter(s => s.current_location && !s.current_location?.is_in_zone).length}
                    </div>
                    <div className="text-xs text-muted-foreground">Fuera de zona</div>
                  </div>
                  <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {surveyorLocations.filter(s => s.status === "inactive").length}
                    </div>
                    <div className="text-xs text-muted-foreground">Inactivos</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-950 text-center">
                    <div className="text-2xl font-bold text-gray-600">
                      {surveyorLocations.filter(s => s.status === "offline").length}
                    </div>
                    <div className="text-xs text-muted-foreground">Offline</div>
                  </div>
                </div>

                {/* Mapa */}
                <div className="h-[500px] rounded-lg overflow-hidden border relative z-0">
                  {loadingLocations && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  )}
                  <TrackingMap
                    surveyors={surveyorLocations}
                    zones={filteredZones}
                    centerOnZone={filterZoneId !== "all" ? filterZoneId : "all"}
                  />
                </div>

                {/* Lista de encuestadores con ubicación */}
                {surveyorLocations.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium mb-2">Última ubicación reportada</h3>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {surveyorLocations.map((surveyor) => (
                        <div
                          key={surveyor.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-3 h-3 rounded-full ${
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
                              <p className="font-medium">{surveyor.name}</p>
                              <p className="text-xs text-muted-foreground">{surveyor.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {surveyor.current_location && (
                              <>
                                <div className="text-right hidden sm:block">
                                  <p className="text-xs text-muted-foreground">Zona</p>
                                  <p className="text-sm font-medium">
                                    {surveyor.current_location.zone?.name || "Sin zona"}
                                  </p>
                                </div>
                                <div className="text-right hidden md:block">
                                  <p className="text-xs text-muted-foreground">Última vez</p>
                                  <p className="text-sm font-medium">
                                    hace {surveyor.current_location.minutes_ago} min
                                  </p>
                                </div>
                                {surveyor.current_location.battery_level !== null && (
                                  <div className="text-right">
                                    <p className="text-xs text-muted-foreground">Batería</p>
                                    <p className="text-sm font-medium">
                                      {surveyor.current_location.battery_level}%
                                    </p>
                                  </div>
                                )}
                              </>
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
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Surveyor Add/Edit Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingSurveyor ? "Editar Encuestador" : "Añadir Nuevo Encuestador"}</DialogTitle>
              <DialogDescription>
                {editingSurveyor
                  ? "Realiza cambios en la información del encuestador."
                  : "Registra un nuevo perfil de encuestador."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Nombre
                </Label>
                <Input
                  id="name"
                  value={surveyorName}
                  onChange={(e) => setSurveyorName(e.target.value)}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Correo
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={surveyorEmail}
                  onChange={(e) => setSurveyorEmail(e.target.value)}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">
                  Teléfono
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={surveyorPhone}
                  onChange={(e) => setSurveyorPhone(e.target.value)}
                  className="col-span-3"
                />
              </div>
              {!editingSurveyor && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="password" className="text-right">
                    Contraseña
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={surveyorPassword}
                    onChange={(e) => setSurveyorPassword(e.target.value)}
                    className="col-span-3"
                    required={!editingSurveyor}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveSurveyor} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingSurveyor ? "Guardar cambios" : "Añadir encuestador"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Eliminación</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que quieres eliminar al encuestador{" "}
                <span className="font-semibold">{surveyorToDelete?.name}</span>? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsConfirmDeleteOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmDeleteSurveyor} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
