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
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [geometry, setGeometry] = React.useState<GeoJSON | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [showMap, setShowMap] = React.useState(false)
  const [isCapturingSnapshot, setIsCapturingSnapshot] = React.useState(false)
  const [mapSnapshot, setMapSnapshot] = React.useState<string | null>(null)
  const [mapMode, setMapMode] = React.useState<"neighborhoods" | "manual">("neighborhoods")
  const [selectedNeighborhoods, setSelectedNeighborhoods] = React.useState<string[]>([])
  const [zoneColor, setZoneColor] = React.useState("#3388ff")
  const mapRef = React.useRef<any>(null)
  const mapContainerRef = React.useRef<HTMLDivElement>(null)

  const generateZoneColor = React.useCallback(() => {
    const colors = [
      "#3388ff",
      "#ff6b6b",
      "#4ecdc4",
      "#45b7d1",
      "#96ceb4",
      "#feca57",
      "#ff9ff3",
      "#54a0ff",
      "#5f27cd",
      "#00d2d3",
    ]
    return colors[Math.floor(Math.random() * colors.length)]
  }, [])

  // Reset form cuando se abre/cierra el modal
  React.useEffect(() => {
    if (isOpen) {
      setName(initialZone?.name || "")
      setDescription(initialZone?.description || "")
      setGeometry(initialZone?.geometry || null)
      setMapSnapshot(initialZone?.map_snapshot || null)
      setSelectedNeighborhoods([])
      setZoneColor(initialZone ? "#3388ff" : generateZoneColor())
      // Retrasar el montaje del mapa para evitar conflictos
      const timer = setTimeout(() => {
        setShowMap(true)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      // Primero ocultar el mapa, luego reset
      setShowMap(false)
      const resetTimer = setTimeout(() => {
        setName("")
        setDescription("")
        setGeometry(null)
        setMapSnapshot(null)
        setSelectedNeighborhoods([])
        setMapMode("neighborhoods")
      }, 100)
      return () => clearTimeout(resetTimer)
    }
  }, [isOpen, initialZone, generateZoneColor])

  // Invalidate map size when it becomes visible
  React.useEffect(() => {
    if (showMap && mapRef.current) {
      const timer = setTimeout(() => {
        mapRef.current.invalidateMapSize()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [showMap])

  const captureMapSnapshot = async () => {
    if (!mapContainerRef.current || !geometry) {
      toast({
        title: "Error",
        description: "Primero debes dibujar una zona en el mapa.",
        variant: "destructive",
      })
      return
    }

    setIsCapturingSnapshot(true)
    try {
      // Dynamic import to avoid SSR issues
      const html2canvas = (await import("html2canvas")).default

      // Wait a bit for the map to fully render
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

      // Subir a Storage inmediatamente para mostrar preview (opcional) o solo guardar en estado
      // Para optimizar, subiremos al guardar, pero aquí podemos mostrar preview con base64
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
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "El nombre de la zona es obligatorio.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      let finalSnapshotUrl = mapSnapshot

      // Si tenemos un snapshot en base64 (nuevo o actualizado), subirlo a Storage
      if (mapSnapshot && mapSnapshot.startsWith('data:image/')) {
        try {
          const { migrateBase64ToStorage, generateUniqueFileName } = await import("@/lib/supabase-storage")

          const fileName = initialZone?.id
            ? `zone_${initialZone.id}_${Date.now()}.jpg`
            : generateUniqueFileName("zone_map", "jpg")

          finalSnapshotUrl = await migrateBase64ToStorage("zone-maps", fileName, mapSnapshot)
        } catch (uploadError) {
          console.error("Error uploading map snapshot:", uploadError)
          // Fallback: intentar guardar sin snapshot o mostrar error
          toast({
            title: "Advertencia",
            description: "No se pudo subir la imagen del mapa, se guardará sin ella.",
            variant: "destructive"
          })
          finalSnapshotUrl = null
        }
      } else if (!mapSnapshot && mapContainerRef.current) {
        // Intentar capturar y subir si no hay snapshot
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
        } catch (error) {
          console.warn("Auto-capture and upload failed:", error)
        }
      }

      const zoneData: Partial<Zone> = {
        name,
        description,
        geometry,
        map_snapshot: finalSnapshotUrl, // URL de Storage
        zone_color: zoneColor,
        selected_neighborhoods: selectedNeighborhoods,
      }

      if (initialZone?.id) {
        zoneData.id = initialZone.id
      }

      await onSave(zoneData)
      onClose()
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
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto z-[999]">
        <DialogHeader>
          <DialogTitle>{initialZone ? "Editar Zona" : "Crear Nueva Zona"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la Zona *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Zona Industrial Sur"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción de la zona geográfica"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Modo de Creación</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mapMode === "neighborhoods" ? "default" : "outline"}
                size="sm"
                onClick={() => setMapMode("neighborhoods")}
                className="gap-2"
              >
                <Map className="h-4 w-4" />
                Por Barrios
              </Button>
              <Button
                type="button"
                variant={mapMode === "manual" ? "default" : "outline"}
                size="sm"
                onClick={() => setMapMode("manual")}
                className="gap-2"
              >
                <Pencil className="h-4 w-4" />
                Dibujo Manual
              </Button>
            </div>
          </div>

          {mapMode === "neighborhoods" && selectedNeighborhoods.length > 0 && (
            <div className="space-y-2">
              <Label>Barrios Seleccionados</Label>
              <div className="flex flex-wrap gap-2">
                {selectedNeighborhoods.map((neighborhood) => (
                  <Badge
                    key={neighborhood}
                    variant="secondary"
                    style={{ backgroundColor: zoneColor + "20", color: zoneColor, position: 'relative', paddingRight: '1.5rem' }}
                  >
                    {neighborhood}
                    <button
                      type="button"
                      aria-label={`Eliminar ${neighborhood}`}
                      onClick={() => setSelectedNeighborhoods(selectedNeighborhoods.filter((n) => n !== neighborhood))}
                      className="absolute top-0 right-0 px-1 text-xs text-gray-400 hover:text-red-500 focus:outline-none"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{mapMode === "neighborhoods" ? "Seleccionar Barrios" : "Dibujar en el mapa"}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={captureMapSnapshot}
                disabled={isCapturingSnapshot || !geometry}
                className="gap-2 bg-transparent"
              >
                {isCapturingSnapshot ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {isCapturingSnapshot ? "Capturando..." : "Capturar Vista"}
              </Button>
            </div>
            <div className="h-[350px] w-full rounded-md overflow-hidden border" ref={mapContainerRef}>
              {showMap ? (
                mapMode === "neighborhoods" ? (
                  <MapWithChoropleth
                    ref={mapRef}
                    key={`choropleth-map-${initialZone?.id || "new"}-${crypto.randomUUID()}`}
                    initialGeometry={geometry}
                    onGeometryChange={setGeometry}
                    zoneColor={zoneColor}
                    selectedNeighborhoods={selectedNeighborhoods}
                    onNeighborhoodSelect={setSelectedNeighborhoods}
                  />
                ) : (
                  <MapWithDrawing
                    ref={mapRef}
                    key={`manual-map-${initialZone?.id || "new"}-${crypto.randomUUID()}`}
                    initialGeometry={geometry}
                    onGeometryChange={setGeometry}
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
            {mapSnapshot && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Vista capturada:</Label>
                <div className="border rounded-md p-2 bg-muted/50">
                  <img
                    src={mapSnapshot || "/placeholder.svg"}
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
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {initialZone ? "Guardar Cambios" : "Crear Zona"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
