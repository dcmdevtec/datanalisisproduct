"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Camera, Map, Pencil } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import dynamic from "next/dynamic"
import type { Zone } from "@/types/zone"
import type { GeoJSON } from "geojson"
import { NeighborhoodCombobox } from "@/components/neighborhood-combobox"

const MapWithDrawing = dynamic(() => import("./map-with-drawing"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[300px] bg-gray-100 rounded-md">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span className="ml-2">Cargando mapa...</span>
    </div>
  ),
})

const MapWithChoropleth = dynamic(() => import("./map-with-choropleth"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[300px] bg-gray-100 rounded-md">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span className="ml-2">Cargando mapa de barrios...</span>
    </div>
  ),
})

type CreateEditZoneModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (zone: Partial<Zone>) => Promise<void>
  initialZone?: Zone | null
}

export function CreateEditZoneModal({ isOpen, onClose, onSave, initialZone }: CreateEditZoneModalProps) {
  const { toast } = useToast()

  // Estados básicos del formulario
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [geometry, setGeometry] = React.useState<GeoJSON | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isCapturingSnapshot, setIsCapturingSnapshot] = React.useState(false)
  const [mapSnapshot, setMapSnapshot] = React.useState<string | null>(null)

  // Estados del modo de creación
  const [mapMode, setMapMode] = React.useState<"neighborhoods" | "manual">("neighborhoods")
  const [selectedNeighborhoods, setSelectedNeighborhoods] = React.useState<string[]>([])
  const [zoneColor, setZoneColor] = React.useState("#3388ff")

  // Control de montaje del mapa
  const [showMap, setShowMap] = React.useState(false)
  const [mapKey, setMapKey] = React.useState(0)

  // Referencias
  const mapRef = React.useRef<any>(null)
  const mapContainerRef = React.useRef<HTMLDivElement>(null)
  const isInitializedRef = React.useRef(false)

  const generateZoneColor = React.useCallback(() => {
    const colors = [
      "#3388ff", "#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4",
      "#feca57", "#ff9ff3", "#54a0ff", "#5f27cd", "#00d2d3",
    ]
    return colors[Math.floor(Math.random() * colors.length)]
  }, [])

  // Inicializar formulario cuando se abre el modal
  React.useEffect(() => {
    if (isOpen && !isInitializedRef.current) {
      isInitializedRef.current = true

      // Cargar datos iniciales
      setName(initialZone?.name || "")
      setDescription(initialZone?.description || "")
      setGeometry(initialZone?.geometry || null)
      setMapSnapshot(initialZone?.map_snapshot || null)
      setSelectedNeighborhoods((initialZone as any)?.selected_neighborhoods || [])
      setZoneColor(initialZone ? ((initialZone as any)?.zone_color || "#3388ff") : generateZoneColor())

      // Determinar modo inicial basado en los datos existentes
      if (initialZone?.geometry) {
        // Si tiene geometry, verificar si viene de barrios seleccionados
        const hasNeighborhoods = (initialZone as any)?.selected_neighborhoods?.length > 0
        setMapMode(hasNeighborhoods ? "neighborhoods" : "manual")
      }

      // Delay para montar el mapa correctamente
      setTimeout(() => {
        setShowMap(true)
      }, 300)
    }

    if (!isOpen) {
      // Reiniciar cuando se cierra
      isInitializedRef.current = false
      setShowMap(false)

      setTimeout(() => {
        setName("")
        setDescription("")
        setGeometry(null)
        setMapSnapshot(null)
        setSelectedNeighborhoods([])
        setMapMode("neighborhoods")
        setMapKey(prev => prev + 1)
      }, 200)
    }
  }, [isOpen, initialZone, generateZoneColor])

  // Invalidar tamaño del mapa cuando sea visible
  React.useEffect(() => {
    if (showMap && mapRef.current?.invalidateMapSize) {
      const timer = setTimeout(() => {
        mapRef.current.invalidateMapSize()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [showMap])

  // Cambiar modo sin recargar el mapa innecesariamente
  const handleModeChange = React.useCallback((mode: "neighborhoods" | "manual") => {
    if (mode === mapMode) return

    setMapMode(mode)
    setMapKey(prev => prev + 1)

    // Limpiar datos del modo anterior
    if (mode === "manual") {
      setSelectedNeighborhoods([])
    } else {
      setGeometry(null)
    }
  }, [mapMode])

  // Handler para cambio de geometría desde el mapa de dibujo
  const handleGeometryChange = React.useCallback((newGeometry: GeoJSON | null) => {
    console.log("📍 Geometry changed:", newGeometry ? "Valid geometry" : "null")
    setGeometry(newGeometry)
  }, [])

  // Handler para selección de barrios
  const handleNeighborhoodSelect = React.useCallback((neighborhoods: string[]) => {
    console.log("🏘️ Neighborhoods selected:", neighborhoods)
    setSelectedNeighborhoods(neighborhoods)
  }, [])

  // Remover barrio individual
  const handleRemoveNeighborhood = React.useCallback((neighborhoodToRemove: string) => {
    setSelectedNeighborhoods(prev => prev.filter(n => n !== neighborhoodToRemove))
  }, [])

  const captureMapSnapshot = async () => {
    if (!mapContainerRef.current) {
      toast({
        title: "Error",
        description: "No se puede capturar el mapa en este momento.",
        variant: "destructive",
      })
      return
    }

    // Validar que haya algo para capturar
    if (mapMode === "neighborhoods" && selectedNeighborhoods.length === 0) {
      toast({
        title: "Error",
        description: "Primero debes seleccionar al menos un barrio.",
        variant: "destructive",
      })
      return
    }

    if (mapMode === "manual" && !geometry) {
      toast({
        title: "Error",
        description: "Primero debes dibujar una zona en el mapa.",
        variant: "destructive",
      })
      return
    }

    setIsCapturingSnapshot(true)
    try {
      const html2canvas = (await import("html2canvas")).default

      await new Promise((resolve) => setTimeout(resolve, 500))

      const canvas = await html2canvas(mapContainerRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 1,
        width: 500,
        height: 300,
        backgroundColor: "#f8f9fa",
      })

      const base64Image = canvas.toDataURL("image/jpeg", 0.8)
      setMapSnapshot(base64Image)

      toast({
        title: "Captura realizada",
        description: "La captura del mapa se ha generado correctamente.",
      })
    } catch (error) {
      console.error("Error capturing map snapshot:", error)
      toast({
        title: "Error",
        description: "No se pudo capturar la imagen del mapa.",
        variant: "destructive",
      })
    } finally {
      setIsCapturingSnapshot(false)
    }
  }

  const handleSave = async () => {
    // Validación del nombre
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "El nombre de la zona es obligatorio.",
        variant: "destructive",
      })
      return
    }

    // Validación según el modo
    if (mapMode === "neighborhoods" && selectedNeighborhoods.length === 0) {
      toast({
        title: "Error",
        description: "Debes seleccionar al menos un barrio para crear la zona.",
        variant: "destructive",
      })
      return
    }

    if (mapMode === "manual" && !geometry) {
      toast({
        title: "Error",
        description: "Debes dibujar la zona en el mapa.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      let finalGeometry = geometry
      let finalSnapshotUrl = mapSnapshot

      // Si estamos en modo barrios, obtener la geometría del mapa
      if (mapMode === "neighborhoods" && mapRef.current?.getGeometryFromNeighborhoods) {
        const neighborhoodsGeometry = mapRef.current.getGeometryFromNeighborhoods()
        if (neighborhoodsGeometry) {
          finalGeometry = neighborhoodsGeometry
          console.log("✅ Geometry extracted from neighborhoods:", finalGeometry)
        }
      }

      // Validar que tenemos geometría final
      if (!finalGeometry) {
        toast({
          title: "Error",
          description: "No se pudo obtener la geometría de la zona. Intenta de nuevo.",
          variant: "destructive",
        })
        setIsSaving(false)
        return
      }

      // Subir snapshot a Storage si es base64
      if (mapSnapshot && mapSnapshot.startsWith('data:image/')) {
        try {
          const { migrateBase64ToStorage, generateUniqueFileName } = await import("@/lib/supabase-storage")
          const fileName = initialZone?.id
            ? `zone_${initialZone.id}_${Date.now()}.jpg`
            : generateUniqueFileName("zone_map", "jpg")
          finalSnapshotUrl = await migrateBase64ToStorage("zone-maps", fileName, mapSnapshot)
          console.log("✅ Snapshot uploaded:", finalSnapshotUrl)
        } catch (uploadError) {
          console.error("Error uploading map snapshot:", uploadError)
          toast({
            title: "Advertencia",
            description: "No se pudo subir la imagen del mapa, se guardará sin ella.",
          })
          finalSnapshotUrl = null
        }
      } else if (!mapSnapshot && mapContainerRef.current) {
        // Auto-capturar si no hay snapshot
        try {
          const html2canvas = (await import("html2canvas")).default
          await new Promise((resolve) => setTimeout(resolve, 300))
          const canvas = await html2canvas(mapContainerRef.current, {
            useCORS: true,
            allowTaint: true,
            scale: 1,
            width: 500,
            height: 300,
            backgroundColor: "#f8f9fa",
          })
          const base64 = canvas.toDataURL("image/jpeg", 0.8)
          const { migrateBase64ToStorage, generateUniqueFileName } = await import("@/lib/supabase-storage")
          const fileName = generateUniqueFileName("zone_map", "jpg")
          finalSnapshotUrl = await migrateBase64ToStorage("zone-maps", fileName, base64)
          console.log("✅ Auto-captured snapshot uploaded:", finalSnapshotUrl)
        } catch (error) {
          console.warn("Auto-capture and upload failed:", error)
        }
      }

      const zoneData: Partial<Zone> = {
        name: name.trim(),
        description: description.trim(),
        geometry: finalGeometry,
        map_snapshot: finalSnapshotUrl,
        zone_color: zoneColor,
        selected_neighborhoods: mapMode === "neighborhoods" ? selectedNeighborhoods : [],
      } as any

      if (initialZone?.id) {
        zoneData.id = initialZone.id
      }

      console.log("💾 Saving zone data:", {
        name: zoneData.name,
        hasGeometry: !!zoneData.geometry,
        hasSnapshot: !!zoneData.map_snapshot,
        neighborhoods: (zoneData as any).selected_neighborhoods?.length || 0,
        mode: mapMode,
      })

      await onSave(zoneData)
      onClose()

      // Limpiar estados
      isInitializedRef.current = false
    } catch (error: any) {
      console.error("Error saving zone:", error)
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la zona.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setShowMap(false)
    isInitializedRef.current = false
    onClose()
  }

  // Prevenir que el input de nombre cause re-renders del mapa
  const handleNameChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
  }, [])

  const handleDescriptionChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value)
  }, [])

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto z-[999]">
        <DialogHeader>
          <DialogTitle>{initialZone ? "Editar Zona" : "Crear Nueva Zona"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Nombre de la zona */}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la Zona *</Label>
            <Input
              id="name"
              value={name}
              onChange={handleNameChange}
              placeholder="Ej: Zona Industrial Sur"
              autoComplete="off"
            />
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={handleDescriptionChange}
              placeholder="Descripción de la zona geográfica"
              rows={3}
            />
          </div>

          {/* Modo de Creación */}
          <div className="space-y-2">
            <Label>Modo de Creación</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mapMode === "neighborhoods" ? "default" : "outline"}
                size="sm"
                onClick={() => handleModeChange("neighborhoods")}
                className="gap-2"
              >
                <Map className="h-4 w-4" />
                Por Barrios
              </Button>
              <Button
                type="button"
                variant={mapMode === "manual" ? "default" : "outline"}
                size="sm"
                onClick={() => handleModeChange("manual")}
                className="gap-2"
              >
                <Pencil className="h-4 w-4" />
                Dibujo Manual
              </Button>
            </div>
          </div>

          {/* Buscador de Barrios */}
          {mapMode === "neighborhoods" && (
            <div className="space-y-2">
              <Label>Buscar Barrio</Label>
              <NeighborhoodCombobox
                selectedNeighborhoods={selectedNeighborhoods}
                onNeighborhoodSelect={handleNeighborhoodSelect}
                placeholder="Buscar barrio por nombre..."
              />
              <p className="text-xs text-muted-foreground">
                Busca y selecciona barrios por nombre, o haz click directamente en el mapa
              </p>
            </div>
          )}

          {/* Barrios Seleccionados */}
          {mapMode === "neighborhoods" && selectedNeighborhoods.length > 0 && (
            <div className="space-y-2">
              <Label>Barrios Seleccionados ({selectedNeighborhoods.length})</Label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-2 border rounded-md bg-muted/30">
                {selectedNeighborhoods.map((neighborhood) => (
                  <Badge
                    key={neighborhood}
                    variant="secondary"
                    className="relative pr-6"
                    style={{
                      backgroundColor: `${zoneColor}20`,
                      color: zoneColor,
                      borderColor: zoneColor
                    }}
                  >
                    {neighborhood}
                    <button
                      type="button"
                      aria-label={`Eliminar ${neighborhood}`}
                      onClick={() => handleRemoveNeighborhood(neighborhood)}
                      className="absolute top-0 right-0 h-full px-1.5 text-xs hover:text-red-500 focus:outline-none"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Mapa */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                {mapMode === "neighborhoods" ? "Seleccionar Barrios" : "Dibujar en el mapa"}
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={captureMapSnapshot}
                disabled={isCapturingSnapshot || (mapMode === "neighborhoods" ? selectedNeighborhoods.length === 0 : !geometry)}
                className="gap-2"
              >
                {isCapturingSnapshot ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                {isCapturingSnapshot ? "Capturando..." : "Capturar Vista"}
              </Button>
            </div>

            <div className="h-[350px] w-full rounded-md overflow-hidden border" ref={mapContainerRef}>
              {showMap ? (
                mapMode === "neighborhoods" ? (
                  <MapWithChoropleth
                    key={`choropleth-${mapKey}`}
                    ref={mapRef}
                    initialGeometry={geometry}
                    onGeometryChange={handleGeometryChange}
                    zoneColor={zoneColor}
                    selectedNeighborhoods={selectedNeighborhoods}
                    onNeighborhoodSelect={handleNeighborhoodSelect}
                  />
                ) : (
                  <MapWithDrawing
                    key={`manual-${mapKey}`}
                    ref={mapRef}
                    initialGeometry={geometry}
                    onGeometryChange={handleGeometryChange}
                  />
                )
              ) : (
                <div className="flex items-center justify-center h-full bg-gray-100">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Preparando mapa...</span>
                </div>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              {mapMode === "neighborhoods"
                ? "Haz clic en los barrios para seleccionarlos y formar tu zona. Los barrios seleccionados se mostrarán con el color asignado."
                : "Usa las herramientas de dibujo para definir el área o la ruta de la zona."}{" "}
              Luego captura la vista para guardarla.
            </p>

            {/* Preview del snapshot */}
            {mapSnapshot && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Vista capturada:</Label>
                <div className="border rounded-md p-2 bg-muted/50">
                  <img
                    src={mapSnapshot}
                    alt="Vista capturada del mapa"
                    className="w-full h-32 object-cover rounded"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              initialZone ? "Guardar Cambios" : "Crear Zona"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
