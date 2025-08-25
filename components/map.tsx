"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, MapPin, Users, FileText, Loader2, Edit } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { CreateEditZoneModal } from "@/components/create-edit-zone-modal" // Import the new modal
import dynamic from "next/dynamic"
import type { Zone } from "@/types/zone" // Import the Zone type

const MapWithChoropleth = dynamic(() => import("@/components/map-with-choropleth"), {
  ssr: false,
})

export default function ZonesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingZone, setEditingZone] = useState<Zone | null>(null)

  const fetchZones = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/zones")
      if (!response.ok) {
        throw new Error("Error al cargar zonas")
      }
      const data = await response.json()
      setZones(data)
    } catch (error: any) {
      console.error("Error fetching zones:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudieron cargar las zonas",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    } else if (!authLoading && user && !["admin", "supervisor"].includes(user.role)) {
      router.push("/dashboard")
      toast({
        title: "Acceso restringido",
        description: "No tienes permisos para acceder a esta página",
        variant: "destructive",
      })
    } else if (user && ["admin", "supervisor"].includes(user.role)) {
      fetchZones()
    }
  }, [user, authLoading, router, toast])

  const handleCreateZone = () => {
    setEditingZone(null) // Clear any previous editing state
    setIsModalOpen(true)
  }

  const handleEditZone = (zone: Zone) => {
    setEditingZone(zone)
    setIsModalOpen(true)
  }

  const handleSaveZone = async (zoneData: Partial<Zone>) => {
    try {
      const method = zoneData.id ? "PUT" : "POST"
      const response = await fetch("/api/zones", {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...zoneData, created_by: user?.id }), // Pass created_by for new zones
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Error al guardar la zona")
      }

      toast({
        title: "Zona guardada",
        description: `La zona "${zoneData.name}" ha sido ${zoneData.id ? "actualizada" : "creada"} exitosamente.`,
      })
      fetchZones() // Re-fetch zones to update the list
    } catch (error: any) {
      console.error("Error saving zone:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la zona.",
        variant: "destructive",
      })
      throw error // Re-throw to keep modal open on error
    }
  }

  const filteredZones = zones.filter(
    (zone) =>
      zone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      zone.description.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (authLoading || !user) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }

  if (!["admin", "supervisor"].includes(user.role)) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Zonas</h1>
            <p className="text-muted-foreground">Gestiona las zonas geográficas para encuestas</p>
          </div>
          <div className="mt-10 flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar zonas..."
                className="pl-8 w-full sm:w-[250px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button className="gap-2" onClick={handleCreateZone}>
              <Plus className="h-4 w-4" /> Crear Zona
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredZones.length === 0 ? (
          <div className="text-center p-8 border rounded-lg bg-muted/50">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay zonas disponibles</h3>
            <p className="text-muted-foreground mb-4">No se encontraron zonas para mostrar.</p>
            <Button onClick={handleCreateZone}>
              <Plus className="h-4 w-4 mr-2" /> Crear tu primera zona
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredZones.map((zone) => (
              <Card key={zone.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{zone.name}</CardTitle>
                    <Badge variant={zone.status === "active" ? "default" : "secondary"} className="capitalize">
                      {zone.status === "active" ? "Activa" : "Inactiva"}
                    </Badge>
                  </div>
                  <CardDescription>{zone.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-40 bg-muted/50 rounded-md flex items-center justify-center mb-4">
                    {zone.geometry ? (
                      zone.map_snapshot ? (
                        <img
                          src={zone.map_snapshot || "/placeholder.svg"}
                          alt={`Mapa de ${zone.name}`}
                          className="w-full h-full object-cover rounded-md"
                        />
                      ) : (
                        <div className="w-full h-full">
                          <MapWithChoropleth
                            initialGeometry={zone.geometry}
                            onGeometryChange={() => {}}
                            readOnly={true}
                            zoneColor={zone.zone_color || "#3388ff"}
                            selectedNeighborhoods={zone.selected_neighborhoods || []}
                          />
                        </div>
                      )
                    ) : (
                      <MapPin className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center text-sm">
                      <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{zone.surveyors.length} encuestadores asignados</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{zone.surveys.length} encuestas activas</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/50 pt-3">
                  <div className="flex justify-between w-full">
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/zones/${zone.id}`)}>
                      Ver Detalles
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEditZone(zone)}>
                      <Edit className="h-4 w-4 mr-2" /> Editar
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        <CreateEditZoneModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveZone}
          initialZone={editingZone}
        />
      </div>
    </DashboardLayout>
  )
}
