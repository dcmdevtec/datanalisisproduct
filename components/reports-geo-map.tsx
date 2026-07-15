"use client"

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"

interface ZonePolygon {
  id: string
  name: string
  geometry: any
  zoneColor: string
  responseCount: number
  completedCount: number
  completionRate: number
}

interface ResponsePoint {
  lat: number
  lng: number
  status: string
  createdAt: string
  source?: string
}

interface ReportsGeoMapProps {
  zonePolygons: ZonePolygon[]
  responsePoints: ResponsePoint[]
}

// Devuelve color hex basado en tasa de completación (rojo → amarillo → verde)
function completionColor(rate: number): string {
  if (rate >= 75) return "#22c55e"  // verde
  if (rate >= 50) return "#f59e0b"  // amarillo
  if (rate >= 25) return "#f97316"  // naranja
  return "#ef4444"                   // rojo
}

// Centro de Colombia como fallback
const COLOMBIA_CENTER: [number, number] = [4.5709, -74.2973]
const COLOMBIA_ZOOM = 6

export default function ReportsGeoMap({ zonePolygons, responsePoints }: ReportsGeoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const layersRef = useRef<any[]>([])
  const [isClient, setIsClient] = useState(false)
  const [showPoints, setShowPoints] = useState(true)
  const [showZones, setShowZones] = useState(true)

  useEffect(() => { setIsClient(true) }, [])

  useEffect(() => {
    if (!isClient || !containerRef.current) return

    let isMounted = true
    let L: any = null
    let map: any = null

    const init = async () => {
      try {
        L = (await import("leaflet")).default

        // Parche de iconos de Leaflet para Next.js
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        })

        if (!isMounted || !containerRef.current) return

        // Destruir mapa existente si hay uno
        if (mapRef.current) {
          mapRef.current.remove()
          mapRef.current = null
        }

        map = L.map(containerRef.current, {
          center: COLOMBIA_CENTER,
          zoom: COLOMBIA_ZOOM,
          zoomControl: true,
          attributionControl: false,
        })

        mapRef.current = map

        // Tile layer profesional (CartoDB Positron — limpio, rápido, sin ruido visual)
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 19,
          subdomains: "abcd",
        }).addTo(map)

        // Atribución pequeña en esquina
        L.control.attribution({ position: "bottomright", prefix: false })
          .addAttribution('© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>')
          .addTo(map)

        await renderLayers(L, map)
      } catch (err) {
        console.error("Error inicializando mapa de reportes:", err)
      }
    }

    init()

    return () => {
      isMounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      layersRef.current = []
    }
    // Solo re-inicializar si cambia isClient
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient])

  // Re-renderizar capas cuando cambien los datos o los toggles
  useEffect(() => {
    if (!mapRef.current || !isClient) return
    let L: any = null
    import("leaflet").then((mod) => {
      L = mod.default
      renderLayers(L, mapRef.current)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zonePolygons, responsePoints, showPoints, showZones, isClient])

  const renderLayers = async (L: any, map: any) => {
    if (!map) return

    // Limpiar capas anteriores
    layersRef.current.forEach((l) => { try { map.removeLayer(l) } catch { } })
    layersRef.current = []

    const bounds: [number, number][] = []

    // ── ZONAS POLIGONALES ──────────────────────────────────────────────────────
    if (showZones) {
      for (const zone of zonePolygons) {
        if (!zone.geometry) continue

        const color = completionColor(zone.completionRate)

        let geoLayer: any
        try {
          geoLayer = L.geoJSON(zone.geometry, {
            style: {
              color: color,
              weight: 2,
              opacity: 0.85,
              fillColor: color,
              fillOpacity: 0.25,
            },
          })
        } catch {
          continue
        }

        // Popup con stats de la zona
        const popupHtml = `
          <div style="min-width:180px;font-family:system-ui,sans-serif">
            <div style="font-weight:700;font-size:14px;margin-bottom:8px;color:#111">${zone.name}</div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <div style="display:flex;justify-content:space-between;font-size:12px">
                <span style="color:#666">Asignaciones</span>
                <span style="font-weight:600">${zone.responseCount}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:12px">
                <span style="color:#666">Completadas</span>
                <span style="font-weight:600">${zone.completedCount}</span>
              </div>
              <div style="margin-top:4px;padding-top:4px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:12px">
                <span style="color:#666">Tasa</span>
                <span style="font-weight:700;color:${color}">${zone.completionRate}%</span>
              </div>
            </div>
          </div>`

        geoLayer.bindPopup(popupHtml, { maxWidth: 220 })
        geoLayer.on("mouseover", function (this: any) {
          this.setStyle({ fillOpacity: 0.5, weight: 3 })
        })
        geoLayer.on("mouseout", function (this: any) {
          this.setStyle({ fillOpacity: 0.25, weight: 2 })
        })
        geoLayer.addTo(map)
        layersRef.current.push(geoLayer)

        // Acumular bounds para auto-fit
        try {
          const lb = geoLayer.getBounds()
          if (lb.isValid()) {
            bounds.push([lb.getSouthWest().lat, lb.getSouthWest().lng])
            bounds.push([lb.getNorthEast().lat, lb.getNorthEast().lng])
          }
        } catch { }

        // Label centrado en la zona
        try {
          const center = geoLayer.getBounds().getCenter()
          const label = L.divIcon({
            className: "",
            html: `<div style="background:rgba(255,255,255,0.85);border:1px solid ${color};border-radius:4px;padding:2px 6px;font-size:10px;font-weight:600;color:#333;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.2)">${zone.name}</div>`,
            iconAnchor: [0, 0],
          })
          const labelMarker = L.marker(center, { icon: label, interactive: false, zIndexOffset: -1 })
          labelMarker.addTo(map)
          layersRef.current.push(labelMarker)
        } catch { }
      }
    }

    // ── PUNTOS DE RESPUESTA ───────────────────────────────────────────────────
    if (showPoints && responsePoints.length > 0) {
      // Agrupar puntos muy cercanos para no saturar (grid simple 4 decimales)
      const grid: Record<string, { lat: number; lng: number; count: number; completed: number }> = {}
      for (const p of responsePoints) {
        const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`
        if (!grid[key]) grid[key] = { lat: p.lat, lng: p.lng, count: 0, completed: 0 }
        grid[key].count++
        if (p.status === "completed") grid[key].completed++
      }

      for (const cell of Object.values(grid)) {
        const rate = cell.count > 0 ? Math.round((cell.completed / cell.count) * 100) : 0
        const color = completionColor(rate)
        const r = Math.min(6 + Math.log2(cell.count + 1) * 3, 18) // radio dinámico por densidad

        const circle = L.circleMarker([cell.lat, cell.lng], {
          radius: r,
          fillColor: color,
          color: "#fff",
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.85,
        })

        const isSurveyorSource = responsePoints.some(p => p.source === "surveyor")
        circle.bindPopup(`
          <div style="font-family:system-ui,sans-serif;font-size:12px">
            <div style="font-weight:700;margin-bottom:4px;font-size:13px">📍 ${isSurveyorSource ? "Actividad de encuestador" : "Respuestas"}</div>
            <div style="color:#555">Registros: <strong>${cell.count}</strong></div>
          </div>`, { maxWidth: 180 })

        circle.addTo(map)
        layersRef.current.push(circle)

        bounds.push([cell.lat, cell.lng])
      }
    }

    // ── AUTO-FIT BOUNDS ────────────────────────────────────────────────────────
    if (bounds.length > 0) {
      try {
        const latLngBounds = L.latLngBounds(bounds)
        if (latLngBounds.isValid()) {
          map.fitBounds(latLngBounds, { padding: [40, 40], maxZoom: 14, animate: false })
        }
      } catch { }
    }
  }

  if (!isClient) {
    return (
      <div className="w-full rounded-xl bg-muted animate-pulse" style={{ height: 460 }} />
    )
  }

  const hasData = zonePolygons.length > 0 || responsePoints.length > 0

  return (
    <div className="relative w-full rounded-xl overflow-hidden border shadow-sm" style={{ height: 460 }}>
      {/* Mapa */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Controles de capa — esquina superior derecha */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1.5">
        <button
          onClick={() => setShowZones((v) => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md border transition-all ${showZones ? "bg-white border-gray-200 text-gray-700" : "bg-gray-100 border-gray-300 text-gray-400"}`}
        >
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#3b82f6", opacity: showZones ? 1 : 0.4 }} />
          Zonas
        </button>
        <button
          onClick={() => setShowPoints((v) => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md border transition-all ${showPoints ? "bg-white border-gray-200 text-gray-700" : "bg-gray-100 border-gray-300 text-gray-400"}`}
        >
          <span className="w-3 h-3 rounded-full inline-block" style={{ background: "#22c55e", opacity: showPoints ? 1 : 0.4 }} />
          Respuestas
        </button>
      </div>

      {/* Leyenda — esquina inferior izquierda */}
      <div className="absolute bottom-6 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg border shadow-md px-3 py-2">
        <p className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Tasa de completación</p>
        <div className="flex flex-col gap-1">
          {[
            { color: "#22c55e", label: "≥ 75% — Alta" },
            { color: "#f59e0b", label: "50-74% — Media" },
            { color: "#f97316", label: "25-49% — Baja" },
            { color: "#ef4444", label: "< 25% — Crítica" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color }} />
              <span className="text-[10px] text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Contador de puntos */}
      {responsePoints.length > 0 && (
        <div className="absolute top-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg border shadow-md px-3 py-1.5">
          <p className="text-xs text-gray-600">
            <span className="font-bold text-gray-800">{responsePoints.length.toLocaleString()}</span>{" "}
            {responsePoints.some(p => p.source === "surveyor") ? "ubicaciones de encuestadores" : "respuestas georeferenciadas"}
          </p>
        </div>
      )}

      {/* Estado vacío */}
      {!hasData && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm z-[1000]">
          <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="text-sm font-medium text-gray-500">Sin datos geográficos disponibles</p>
          <p className="text-xs text-gray-400 mt-1">Asigna encuestadores a zonas para ver el mapa</p>
        </div>
      )}
    </div>
  )
}
