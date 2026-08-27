"use client"

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"
import { Maximize2, Minimize2 } from "lucide-react"
import { formatPercent } from "@/lib/format"

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
  id?: string
  lat: number
  lng: number
  status: string
  outcome?: "efectiva" | "incidencia" | "abandonada" | "descalificado" | null
  createdAt: string
  surveyorName?: string | null
  surveyorId?: string | null
  startedAt?: string | null
  completedAt?: string | null
  respondentName?: string | null
  durationSecs?: number | null
  source?: string
}

interface ReportsGeoMapProps {
  zonePolygons: ZonePolygon[]
  responsePoints: ResponsePoint[]
}

// Devuelve color hex basado en tasa de completación (rojo → amarillo → verde)
// Se usa solo para las ZONAS (polígonos), que siguen midiéndose por tasa de completación.
function completionColor(rate: number): string {
  if (rate >= 75) return "#22c55e"  // verde
  if (rate >= 50) return "#f59e0b"  // amarillo
  if (rate >= 25) return "#f97316"  // naranja
  return "#ef4444"                   // rojo
}

// Colores por tipo de respuesta (pptx slide 24): Verde=Efectiva, Amarillo=Abandonada,
// Rojo=Incidencia, Morado=Descalificada (misma paleta que el comparativo de
// "Registros no efectivos" en components/reports/summary-content.tsx).
const outcomeColor: Record<string, string> = {
  efectiva: "#22c55e",
  abandonada: "#eab308",
  incidencia: "#ef4444",
  descalificado: "#a855f7",
}
const outcomeLabel: Record<string, string> = {
  efectiva: "Efectiva",
  abandonada: "Abandonada",
  incidencia: "Incidencia",
  descalificado: "Descalificada",
}

function formatDuration(secs: number | null | undefined): string {
  if (secs === null || secs === undefined) return "—"
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

// Centro de Colombia como fallback
const COLOMBIA_CENTER: [number, number] = [4.5709, -74.2973]
const COLOMBIA_ZOOM = 6

export default function ReportsGeoMap({ zonePolygons, responsePoints }: ReportsGeoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const layersRef = useRef<any[]>([])
  // Ruta GPS aproximada de un punto individual (ver botón "Ver ruta" en su
  // popup) — se dibuja aparte de layersRef para poder limpiarla sola sin
  // tocar el resto del mapa (zonas/puntos) cuando se pide otra ruta.
  const routeLayerRef = useRef<any>(null)
  const [loadingRouteId, setLoadingRouteId] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [showPoints, setShowPoints] = useState(true)
  const [showZones, setShowZones] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Filtro por tipo (slide 24): todas | efectiva | incidencia | abandonada | descalificado
  const [typeFilter, setTypeFilter] = useState<"all" | "efectiva" | "incidencia" | "abandonada" | "descalificado">("all")

  const filteredPoints = typeFilter === "all"
    ? responsePoints
    : responsePoints.filter((p) => (p.outcome ?? null) === typeFilter)

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

        // Mismo tile que components/tracking-map.tsx (encuestador) — antes este
        // mapa usaba CartoDB Positron (gris pálido), que el cliente reportó
        // como "se ve en negativo" al compararlo con el mapa de tracking.
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          subdomains: "abc",
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
  }, [zonePolygons, filteredPoints, showPoints, showZones, isClient])

  // Leaflet no detecta automáticamente que el contenedor cambió de tamaño al
  // entrar/salir de pantalla completa — hay que forzar el recálculo.
  useEffect(() => {
    if (!mapRef.current) return
    const t = setTimeout(() => {
      try { mapRef.current.invalidateSize() } catch { }
    }, 50)
    return () => clearTimeout(t)
  }, [isFullscreen])

  // Permite cerrar pantalla completa con la tecla Escape
  useEffect(() => {
    if (!isFullscreen) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false) }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isFullscreen])

  // Pide y dibuja la ruta GPS aproximada de un punto (ver app/api/reports/route-trace).
  const drawRoute = async (L: any, map: any, p: ResponsePoint) => {
    if (!p.surveyorId || !p.startedAt || !p.completedAt) return
    setLoadingRouteId(p.id ?? null)
    try {
      const params = new URLSearchParams({ surveyorId: p.surveyorId, from: p.startedAt, to: p.completedAt })
      const res = await fetch(`/api/reports/route-trace?${params}`)
      if (!res.ok) return
      const { points } = await res.json()
      if (!Array.isArray(points) || points.length < 2) return

      if (routeLayerRef.current) {
        try { map.removeLayer(routeLayerRef.current) } catch { }
        routeLayerRef.current = null
      }

      const latlngs = points.map((pt: any) => [pt.lat, pt.lng])
      const polyline = L.polyline(latlngs, { color: "#3b82f6", weight: 4, opacity: 0.85, dashArray: "6 4" }).addTo(map)
      routeLayerRef.current = polyline
      map.fitBounds(polyline.getBounds(), { padding: [40, 40], maxZoom: 16 })
    } catch (err) {
      console.error("Error cargando ruta del encuestador:", err)
    } finally {
      setLoadingRouteId(null)
    }
  }

  const renderLayers = async (L: any, map: any) => {
    if (!map) return

    // Limpiar capas anteriores
    layersRef.current.forEach((l) => { try { map.removeLayer(l) } catch { } })
    layersRef.current = []
    if (routeLayerRef.current) {
      try { map.removeLayer(routeLayerRef.current) } catch { }
      routeLayerRef.current = null
    }

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
                <span style="font-weight:700;color:${color}">${formatPercent(zone.completionRate)}</span>
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

    // ── PUNTOS DE RESPUESTA (individuales e independientes — pptx slide 24) ────
    // Cada punto se dibuja por separado, sin agrupar por celda. El color indica
    // el tipo de respuesta (verde=efectiva, amarillo=abandonada, rojo=incidencia);
    // para puntos sin clasificación (rastro de encuestador) se usa gris neutro.
    if (showPoints && filteredPoints.length > 0) {
      for (const p of filteredPoints) {
        const color = p.outcome ? outcomeColor[p.outcome] : "#94a3b8"

        const circle = L.circleMarker([p.lat, p.lng], {
          radius: 7,
          fillColor: color,
          color: "#fff",
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.9,
        })

        const isSurveyorTrace = p.source === "surveyor"
        const canShowRoute = !isSurveyorTrace && !!p.surveyorId && !!p.startedAt && !!p.completedAt
        const routeBtnId = `ver-ruta-${p.id ?? `${p.lat}-${p.lng}`}`
        const popupHtml = isSurveyorTrace
          ? `
          <div style="font-family:system-ui,sans-serif;font-size:12px;min-width:160px">
            <div style="font-weight:700;margin-bottom:4px;font-size:13px">📍 Actividad de encuestador</div>
            ${p.surveyorName ? `<div style="color:#555">Encuestador: <strong>${p.surveyorName}</strong></div>` : ""}
            <div style="color:#888;font-size:11px;margin-top:2px">${new Date(p.createdAt).toLocaleString("es-CO")}</div>
          </div>`
          : `
          <div style="font-family:system-ui,sans-serif;font-size:12px;min-width:180px">
            <div style="font-weight:700;margin-bottom:6px;font-size:13px">📍 ${p.outcome ? outcomeLabel[p.outcome] : "Respuesta"}</div>
            <div style="display:flex;flex-direction:column;gap:3px">
              <div style="color:#555">Encuestador: <strong>${p.surveyorName || "Sin asignar"}</strong></div>
              <div style="color:#555">Encuestado: <strong>${p.respondentName || "Anónimo"}</strong></div>
              <div style="color:#555">Duración: <strong>${formatDuration(p.durationSecs)}</strong></div>
              <div style="color:#888;font-size:11px;margin-top:2px">${new Date(p.createdAt).toLocaleString("es-CO")}</div>
              ${canShowRoute ? `<button id="${routeBtnId}" style="margin-top:6px;padding:4px 8px;font-size:11px;font-weight:600;color:#18b0a4;background:#18b0a41a;border:1px solid #18b0a4;border-radius:6px;cursor:pointer">Ver ruta del encuestador</button>` : ""}
            </div>
          </div>`

        circle.bindPopup(popupHtml, { maxWidth: 220 })
        if (canShowRoute) {
          circle.on("popupopen", () => {
            const btn = document.getElementById(routeBtnId)
            if (!btn) return
            btn.addEventListener("click", () => drawRoute(L, map, p), { once: true })
          })
        }
        circle.addTo(map)
        layersRef.current.push(circle)

        bounds.push([p.lat, p.lng])
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

  const hasData = zonePolygons.length > 0 || filteredPoints.length > 0
  const hasOutcomeData = responsePoints.some((p) => !!p.outcome)

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-[2000] rounded-none border-0"
          : "relative w-full rounded-xl overflow-hidden border shadow-sm"
      }
      style={isFullscreen ? {} : { height: 460 }}
    >
      {/* Mapa */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Controles de capa — esquina superior derecha */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1.5">
        <button
          onClick={() => setIsFullscreen((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md border bg-white border-gray-200 text-gray-700 transition-all hover:bg-gray-50"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          {isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
        </button>
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
        {/* Filtro por tipo de respuesta (slide 24) — solo tiene sentido si hay datos clasificados */}
        {hasOutcomeData && (
          <div className="flex flex-col gap-1 bg-white border border-gray-200 rounded-lg shadow-md p-1.5">
            {(["all", "efectiva", "incidencia", "abandonada", "descalificado"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`flex items-center gap-2 px-2 py-1 rounded text-xs font-medium transition-all ${typeFilter === t ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:bg-gray-50"}`}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t === "all" ? "#94a3b8" : outcomeColor[t] }} />
                {t === "all" ? "Todas" : outcomeLabel[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Leyenda — esquina inferior izquierda */}
      <div className="absolute bottom-6 left-3 z-[1000] flex flex-col gap-2">
        {hasOutcomeData && (
          <div className="bg-white/90 backdrop-blur-sm rounded-lg border shadow-md px-3 py-2">
            <p className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Tipo de respuesta</p>
            <div className="flex flex-col gap-1">
              {(["efectiva", "abandonada", "incidencia", "descalificado"] as const).map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: outcomeColor[t] }} />
                  <span className="text-[10px] text-gray-600">{outcomeLabel[t]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg border shadow-md px-3 py-2">
          <p className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Tasa de completación (zonas)</p>
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
      </div>

      {/* Contador de puntos */}
      {filteredPoints.length > 0 && (
        <div className="absolute top-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg border shadow-md px-3 py-1.5">
          <p className="text-xs text-gray-600">
            <span className="font-bold text-gray-800">{filteredPoints.length.toLocaleString()}</span>{" "}
            {filteredPoints.some(p => p.source === "surveyor") ? "ubicaciones de encuestadores" : "respuestas georeferenciadas"}
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
