"use client"

import { Alert, AlertTitle } from "@/components/ui/alert"

import { useEffect, useState } from "react"
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
} from "lucide-react"
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

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const { data: surveyData, error: surveyError } = await supabase
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

        setSurvey({ ...surveyData, assigned_zones: parsedAssignedZones })

        const { data: surveyorsData, error: surveyorsError } = await supabase
          .from("surveyors")
          .select("id, name, email")
        if (surveyorsError) console.error("Error fetching surveyors:", surveyorsError)
        if (surveyorsData) setAllSurveyors(surveyorsData)

        const { data: zonesData, error: zonesError } = await supabase.from("zones").select("id, name, geometry")
        if (zonesError) console.error("Error fetching zones:", zonesError)
        if (zonesData) setAllZones(zonesData)

        if (parsedAssignedZones.length > 0 && zonesData) {
          const firstZoneId = parsedAssignedZones[0]
          setDisplayedZoneId(firstZoneId)
          const zone = zonesData.find((z) => z.id === firstZoneId)
          if (zone && zone.geometry) {
            setSelectedZoneGeometry(zone.geometry)
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
  const assignedZones = survey.assigned_zones ? allZones.filter((z) => survey.assigned_zones.includes(z.id)) : []
  const displayedZone = displayedZoneId ? allZones.find((z) => z.id === displayedZoneId) : null

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
                  assignedSurveyors.map((surveyor) => (
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
      </div>
    </DashboardLayout>
  )
}
