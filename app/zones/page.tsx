"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, MapPin, Users, FileText, Loader2, Edit, Trash2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { CreateEditZoneModal } from "@/components/create-edit-zone-modal"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog" // Import ConfirmationDialog
import dynamic from "next/dynamic"
import type { Zone } from "@/types/zone"

const MapWithDrawing = dynamic(() => import("@/components/map-with-drawing"), {
  ssr: false,
})

export default function ZonesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingZone, setEditingZone] = useState<Zone | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  // State for confirmation dialog
  const [showConfirmDeleteDialog, setShowConfirmDeleteDialog] = useState(false)
  const [zoneToDeleteId, setZoneToDeleteId] = useState<string | null>(null)

  // Use a ref to store map instances for invalidation
  const mapRefs = useRef<{ [key: string]: any }>({})

  const fetchZones = async () => {
    console.log("Fetching zones...")

    try {
      const response = await fetch("/api/zones")

      if (!response.ok) {
        console.error("Response not OK:", response.status, response.statusText)
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("Zones fetched successfully:", data.length, "zones")
      setZones(data)
    } catch (error: any) {
      console.error("Error fetching zones:", error.message)
      setZones([])
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

  // Invalidate map sizes when modal closes or zones update
  useEffect(() => {
    if (!isModalOpen) {
      Object.values(mapRefs.current).forEach((mapInstance) => {
        if (mapInstance && mapInstance.invalidateMapSize) {
          mapInstance.invalidateMapSize()
        }
      })
    }
  }, [isModalOpen, zones])

  const handleCreateZone = () => {
    setEditingZone(null)
    setIsModalOpen(true)
  }

  const handleEditZone = (zone: Zone) => {
    setEditingZone(zone)
    setIsModalOpen(true)
  }

  // Function to initiate delete confirmation
  const handleDeleteZone = (zoneId: string) => {
    setZoneToDeleteId(zoneId)
    setShowConfirmDeleteDialog(true)
  }

  // Function to perform the actual deletion after confirmation
  const confirmDelete = async () => {
    if (!zoneToDeleteId) return

    try {
      const response = await fetch("/api/zones", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: zoneToDeleteId }),
      })

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch (parseError) {
          console.error("Could not parse error response for delete:", parseError)
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        throw new Error(errorData.error || errorData.details || "Error al eliminar la zona")
      }

      toast({
        title: "Zona eliminada",
        description: "La zona ha sido eliminada exitosamente.",
      })
      fetchZones() // Refresh the list
    } catch (err: any) {
      console.error("Error deleting zone:", err)
      toast({
        title: "Error",
        description: err.message || "No se pudo eliminar la zona.",
        variant: "destructive",
      })
    } finally {
      setShowConfirmDeleteDialog(false) // Close dialog
      setZoneToDeleteId(null) // Clear ID
    }
  }

  const handleZoneSaved = async (zoneData: Partial<Zone>) => {
    try {
      if (!zoneData.name?.trim()) {
        throw new Error("El nombre de la zona es requerido")
      }

      if (!user?.id && !zoneData.id) {
        throw new Error("Usuario no autenticado")
      }

      const method = zoneData.id ? "PUT" : "POST"

      const payload = {
        ...zoneData,
        name: zoneData.name.trim(),
        ...(method === "POST" && { created_by: user?.id }),
      }

      const response = await fetch("/api/zones", {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch (parseError) {
          console.error("Could not parse error response:", parseError)
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        throw new Error(errorData.error || errorData.details || "Error al guardar la zona")
      }

      const savedZone = await response.json()

      toast({
        title: "Zona guardada",
        description: `La zona "${zoneData.name}" ha sido ${zoneData.id ? "actualizada" : "creada"} exitosamente.`,
      })

      await fetchZones()
      setIsModalOpen(false)
      return savedZone
    } catch (error: any) {
      console.error("Error saving zone:", error)

      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la zona.",
        variant: "destructive",
      })

      throw error
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingZone(null)
  }

  const filteredZones = zones.filter(
    (zone) =>
      zone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      zone.description?.toLowerCase().includes(searchTerm.toLowerCase()),
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
                    {zone.map_snapshot ? (
                      <div className="w-full h-full relative group">
                        <img
                          src={zone.map_snapshot || "/placeholder.svg"}
                          alt={`Mapa de ${zone.name}`}
                          className="w-full h-full object-cover rounded-md"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-md flex items-center justify-center">
                          <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-2 py-1 rounded">
                            Vista guardada
                          </span>
                        </div>
                      </div>
                    ) : zone.geometry ? (
                      <div className="w-full h-full z-0 relative">
                        <MapWithDrawing
                          key={zone.id}
                          ref={(el) => {
                            if (el) mapRefs.current[zone.id] = el
                            else delete mapRefs.current[zone.id]
                          }}
                          initialGeometry={zone.geometry}
                          onGeometryChange={() => {}}
                          readOnly={true}
                        />
                        <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                          Mapa en vivo
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <MapPin className="h-8 w-8 mb-2" />
                        <span className="text-sm">Sin mapa definido</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center text-sm">
                      <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{zone.surveyors?.length ?? 0} encuestadores asignados</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{zone.surveys?.length ?? 0} encuestas activas</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/50 pt-3">
                  <div className="flex justify-between w-full">
                    <Button variant="outline" size="sm" onClick={() => handleEditZone(zone)}>
                      <Edit className="h-4 w-4 " /> Editar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteZone(zone.id)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        <CreateEditZoneModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleZoneSaved}
          initialZone={editingZone}
        />

        <ConfirmationDialog
          isOpen={showConfirmDeleteDialog}
          onClose={() => setShowConfirmDeleteDialog(false)}
          onConfirm={confirmDelete}
          title="Confirmar eliminación de zona"
          description="¿Estás seguro de que deseas eliminar esta zona? Esta acción no se puede deshacer."
          confirmText="Eliminar"
          cancelText="Cancelar"
          confirmVariant="destructive"
        />
      </div>
    </DashboardLayout>
  )
}
