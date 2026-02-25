"use client"

import { useEffect, useRef, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Battery, BatteryLow, BatteryCharging, Clock, Phone, Mail } from "lucide-react"

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

interface TrackingMapProps {
  surveyors: SurveyorLocation[]
  zones: Zone[]
  centerOnZone?: string
  selectedSurveyorId?: string | null
  onSurveyorSelect?: (id: string | null) => void
}

// Fix para los iconos de Leaflet en Next.js
const createIcon = (color: string = "blue", isSelected: boolean = false) => {
  const colors: Record<string, string> = {
    green: "#22c55e",
    yellow: "#eab308",
    red: "#ef4444",
    gray: "#6b7280",
    blue: "#3b82f6",
  }

  const iconColor = colors[color] || colors.blue
  const scale = isSelected ? 1.5 : 1
  const size = 24
  const finalSize = size * scale

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        transform: scale(${scale});
        transition: transform 0.2s ease-in-out;
      ">
        <div style="
          background-color: ${iconColor};
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 5px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
      </div>
    `,
    iconSize: [finalSize, finalSize],
    iconAnchor: [finalSize / 2, finalSize / 2],
    popupAnchor: [0, -finalSize / 2],
  })
}

// Componente para centrar el mapa en una zona específica
function MapController({ centerOnZone, zones }: { centerOnZone?: string; zones: Zone[] }) {
  const map = useMap()

  useEffect(() => {
    if (centerOnZone && centerOnZone !== "all") {
      const zone = zones.find((z) => z.id === centerOnZone)
      if (zone?.geometry) {
        try {
          const coords = zone.geometry.coordinates[0]
          if (coords && coords.length > 0) {
            // Calcular centro del polígono
            let sumLat = 0
            let sumLng = 0
            coords.forEach((coord: number[]) => {
              sumLng += coord[0]
              sumLat += coord[1]
            })
            const centerLat = sumLat / coords.length
            const centerLng = sumLng / coords.length
            map.flyTo([centerLat, centerLng], 14)
          }
        } catch (e) {
          console.error("Error centering map on zone:", e)
        }
      }
    }
  }, [centerOnZone, zones, map])

  return null
}

// Helper para formatear tiempo
const formatMinutesAgo = (minutes: number | null): string => {
  if (minutes === null || minutes < 0) {
    return "nunca"
  }
  if (minutes < 1) {
    return "hace menos de un minuto"
  }
  const roundedMinutes = Math.round(minutes)
  if (roundedMinutes < 60) {
    return `hace ${roundedMinutes} ${roundedMinutes === 1 ? "minuto" : "minutos"}`
  }
  const hours = Math.floor(roundedMinutes / 60)
  if (hours < 24) {
    return `hace ${hours} ${hours === 1 ? "hora" : "horas"}`
  }
  const days = Math.floor(hours / 24)
  return `hace ${days} ${days === 1 ? "día" : "días"}`
}

// Componente para centrar el mapa en el encuestador seleccionado
function SelectedSurveyorController({ surveyor }: { surveyor: SurveyorLocation | null }) {
  const map = useMap()

  useEffect(() => {
    if (surveyor?.current_location) {
      const { latitude, longitude } = surveyor.current_location
      map.flyTo([latitude, longitude], 16)
    }
  }, [surveyor, map])

  return null
}

// Componente para convertir GeoJSON a coordenadas de Leaflet
function GeoJSONPolygon({ geometry, color = "#3388ff", name }: { geometry: any; color?: string; name?: string }) {
  if (!geometry || !geometry.coordinates || !Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
    return null
  }

  try {
    // Para Polygon, las coordenadas son [lng, lat] en GeoJSON
    // Leaflet espera [lat, lng]
    const firstRing = geometry.coordinates[0]
    if (!Array.isArray(firstRing) || firstRing.length === 0) {
      return null
    }
    
    const coordinates = firstRing
      .filter((coord: number[]) => Array.isArray(coord) && coord.length >= 2)
      .map((coord: number[]) => [coord[1], coord[0]])

    if (coordinates.length === 0) {
      return null
    }

    return (
      <Polygon
        positions={coordinates}
        pathOptions={{
          color: color,
          fillColor: color,
          fillOpacity: 0.2,
          weight: 2,
        }}
      >
        {name && (
          <Popup>
            <div className="font-medium">{name}</div>
          </Popup>
        )}
      </Polygon>
    )
  } catch (e) {
    console.error("Error rendering polygon:", e)
    return null
  }
}

export default function TrackingMap({
  surveyors,
  zones,
  centerOnZone,
  selectedSurveyorId,
  onSurveyorSelect,
}: TrackingMapProps) {
  // Coordenadas por defecto (Barranquilla, Colombia)
  const defaultCenter: [number, number] = [10.9639, -74.7964]
  const defaultZoom = 13

  // Obtener color según estado
  const getMarkerColor = (surveyor: SurveyorLocation) => {
    if (surveyor.status === "offline") return "gray"
    if (!surveyor.current_location?.is_in_zone) return "red"
    if (surveyor.status === "inactive") return "yellow"
    return "green"
  }

  // Filtrar encuestadores con ubicación
  const surveyorsWithLocation = surveyors.filter((s) => s.current_location)
  const selectedSurveyor = surveyorsWithLocation.find((s) => s.id === selectedSurveyorId)

  return (
    <div className="relative h-full w-full rounded-lg overflow-hidden z-0">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Controladores del mapa */}
        <MapController centerOnZone={centerOnZone} zones={zones} />
        <SelectedSurveyorController surveyor={selectedSurveyor || null} />

        {/* Renderizar zonas */}
        {zones.map((zone) => (
          <GeoJSONPolygon
            key={zone.id}
            geometry={zone.geometry}
            color={zone.zone_color || "#3388ff"}
            name={zone.name}
          />
        ))}

        {/* Renderizar marcadores de encuestadores */}
        {surveyorsWithLocation.map((surveyor) => {
          if (!surveyor.current_location) return null

          const { latitude, longitude } = surveyor.current_location
          const markerColor = getMarkerColor(surveyor)
          const isSelected = surveyor.id === selectedSurveyorId

          return (
            <Marker
              key={surveyor.id}
              position={[latitude, longitude]}
              icon={createIcon(markerColor, isSelected)}
              eventHandlers={{
                click: () => {
                  if (onSurveyorSelect) {
                    onSurveyorSelect(isSelected ? null : surveyor.id)
                  }
                },
              }}
              zIndexOffset={isSelected ? 1000 : 0}
            >
              <Popup>
                <div className="min-w-[200px] p-1">
                  <div className="font-semibold text-lg mb-2">{surveyor.name}</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{surveyor.email}</span>
                    </div>
                    {surveyor.phone_number && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{surveyor.phone_number}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      <span>
                        {surveyor.current_location.zone?.name || "Sin zona"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatMinutesAgo(surveyor.current_location.minutes_ago)}
                      </span>
                    </div>
                    {surveyor.current_location.battery_level !== null && (
                      <div className="flex items-center gap-2">
                        {surveyor.current_location.is_charging ? (
                          <BatteryCharging className="h-3 w-3 text-green-500" />
                        ) : surveyor.current_location.battery_level < 20 ? (
                          <BatteryLow className="h-3 w-3 text-red-500" />
                        ) : (
                          <Battery className="h-3 w-3" />
                        )}
                        <span>{surveyor.current_location.battery_level}%</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex gap-1">
                    {surveyor.status === "active" ? (
                      <Badge className="bg-green-500 text-xs">Activo</Badge>
                    ) : surveyor.status === "inactive" ? (
                      <Badge className="bg-yellow-500 text-xs">Inactivo</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Offline</Badge>
                    )}
                    {surveyor.current_location.is_in_zone ? (
                      <Badge className="bg-green-600 text-xs">En zona</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">Fuera</Badge>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Leyenda */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-[1000]">
        <div className="text-xs font-semibold mb-2">Leyenda</div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Activo en zona</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Inactivo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Fuera de zona</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400" />
            <span>Offline</span>
          </div>
        </div>
      </div>

      {/* Contador */}
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-[1000]">
        <div className="text-xs text-muted-foreground">Encuestadores visibles</div>
        <div className="text-2xl font-bold">{surveyorsWithLocation.length}</div>
      </div>
    </div>
  )
}
