"use client"

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"
import { Maximize2, Minimize2 } from "lucide-react"
import { formatPercent } from "@/lib/format"
import { Checkbox } from "@/components/ui/checkbox"

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
  respondentPhone?: string | null
  durationSecs?: number | null
  source?: string
}

interface ReportsGeoMapProps {
  zonePolygons: ZonePolygon[]
  responsePoints: ResponsePoint[]
  hasActiveSurveyorFilter?: boolean
  hasSurveySelected?: boolean
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
// Límite de paneo/zoom del mapa: solo territorio colombiano (con margen para
// no cortar el borde al hacer zoom out).
const COLOMBIA_BOUNDS: [[number, number], [number, number]] = [
  [-4.9, -82.5],
  [16.5, -60.0],
]

// Reunión 2026-08-27: "Poder delimitar el mapa al momento de visualizarlo y
// descargarlo (Barranquilla, Atlántico, Soledad, o cualquier otro
// municipio)". No tenemos polígonos oficiales de límites municipales
// (requeriría datos geográficos del DANE), así que se aproxima con un
// bounding box por municipio/departamento — suficiente para "delimitar la
// vista", no para un recorte exacto del límite administrativo.
const CITY_PRESETS: { label: string; bounds: [[number, number], [number, number]] }[] = [
  { label: "Todo Colombia",      bounds: COLOMBIA_BOUNDS },
  { label: "Barranquilla",       bounds: [[10.90, -74.87], [11.05, -74.72]] },
  { label: "Soledad",            bounds: [[10.85, -74.85], [10.95, -74.72]] },
  { label: "Atlántico (depto.)", bounds: [[10.15, -75.30], [11.10, -74.70]] },
  { label: "Cartagena",          bounds: [[10.35, -75.60], [10.50, -75.45]] },
  { label: "Santa Marta",        bounds: [[11.15, -74.30], [11.30, -74.15]] },
  { label: "Bogotá",             bounds: [[4.45, -74.25], [4.85, -73.99]] },
]

export default function ReportsGeoMap({ zonePolygons, responsePoints, hasActiveSurveyorFilter, hasSurveySelected }: ReportsGeoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const layersRef = useRef<any[]>([])
  // Ruta GPS aproximada de un punto individual (ver botón "Ver ruta" en su
  // popup) — se dibuja aparte de layersRef para poder limpiarla sola sin
  // tocar el resto del mapa (zonas/puntos) cuando se pide otra ruta.
  // Ahora puede haber varias rutas dibujadas a la vez (una por encuestador
  // seleccionado) — se guardan por surveyorId para poder limpiar/redibujar
  // solo la que cambió sin afectar las demás.
  const routeLayersRef = useRef<Map<string, any>>(new Map())
  const [loadingRouteIds, setLoadingRouteIds] = useState<Set<string>>(new Set())
  const [isClient, setIsClient] = useState(false)
  const [showPoints, setShowPoints] = useState(true)
  const [showZones, setShowZones] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Delimitar el mapa por ciudad/municipio (ver CITY_PRESETS) en vez de
  // siempre mostrar todo el país.
  const [cityPresetIdx, setCityPresetIdx] = useState(0)
  // Filtro por tipo (slide 24): checkboxes multi-selección, todos activos por defecto.
  // Los puntos sin outcome (ej. rastro GPS del portal encuestador) siempre se
  // muestran — el filtro solo aplica a respuestas ya clasificadas.
  const ALL_OUTCOMES = ["efectiva", "abandonada", "incidencia", "descalificado"] as const
  const [enabledOutcomes, setEnabledOutcomes] = useState<Set<string>>(new Set(ALL_OUTCOMES))
  const toggleOutcome = (t: string) => {
    setEnabledOutcomes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }
  // Selector de encuestadores para ver su ruta GPS completa (independiente de
  // hacer click en un punto puntual) — multi-selección: permite comparar la
  // ruta de varios encuestadores a la vez, cada una con su propio color, sin
  // que el mapa "colapse" al perder las rutas ya dibujadas al elegir otra.
  const [selectedRouteSurveyorIds, setSelectedRouteSurveyorIds] = useState<Set<string>>(new Set())
  const [showRoutePicker, setShowRoutePicker] = useState(false)
  const toggleRouteSurveyor = (id: string) => {
    setSelectedRouteSurveyorIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  // Paleta fija para distinguir rutas simultáneas en el mapa.
  const ROUTE_COLORS = ["#3b82f6", "#f97316", "#14b8a6", "#e11d48", "#8b5cf6", "#0ea5e9", "#84cc16", "#f43f5e"]
  // Tope defensivo del rango de tiempo que se le pide a /api/reports/route-trace
  // por encuestador: aunque ya se exige elegir una encuesta puntual (ver
  // "Ver ruta" arriba), una encuesta que lleva corriendo varias semanas
  // igual generaría una ventana enorme mezclando días de trabajo distintos.
  // Se limita a las últimas 48h de actividad de ese encuestador dentro del
  // rango detectado.
  const MAX_ROUTE_WINDOW_MS = 48 * 60 * 60 * 1000
  const clampRouteWindow = (minTs: number, maxTs: number): { from: string; to: string } => {
    const clampedMin = maxTs - minTs > MAX_ROUTE_WINDOW_MS ? maxTs - MAX_ROUTE_WINDOW_MS : minTs
    return { from: new Date(clampedMin).toISOString(), to: new Date(maxTs).toISOString() }
  }

  const filteredPoints = responsePoints.filter((p) => !p.outcome || enabledOutcomes.has(p.outcome))

  // Encuestadores disponibles para el selector de ruta (dedupe por id).
  const surveyorOptions = Array.from(
    new Map(
      responsePoints
        .filter((p) => p.surveyorId && p.surveyorName)
        .map((p) => [p.surveyorId as string, p.surveyorName as string])
    ).entries()
  ).map(([id, name]) => ({ id, name }))

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
          maxBounds: COLOMBIA_BOUNDS,
          maxBoundsViscosity: 1.0,
          minZoom: 5,
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

  // Dibuja/limpia rutas cuando cambia el conjunto de encuestadores
  // seleccionados. Cada uno mantiene su propia polyline (routeLayersRef,
  // indexado por surveyorId) así que tildar/destildar uno no afecta a los
  // demás ya dibujados. Rango de tiempo: desde el primer punto hasta el
  // último conocido de ese encuestador en los datos ya cargados (createdAt
  // como fallback si no hay startedAt/completedAt).
  useEffect(() => {
    if (!mapRef.current) return

    // Quitar del mapa las rutas de encuestadores que ya no están seleccionados.
    for (const [id, layer] of routeLayersRef.current.entries()) {
      if (!selectedRouteSurveyorIds.has(id)) {
        try { mapRef.current.removeLayer(layer) } catch { }
        routeLayersRef.current.delete(id)
      }
    }

    const toDraw = [...selectedRouteSurveyorIds].filter((id) => !routeLayersRef.current.has(id))
    if (toDraw.length === 0) return

    import("leaflet").then((mod) => {
      for (const surveyorId of toDraw) {
        const pointsForSurveyor = responsePoints.filter((p) => p.surveyorId === surveyorId)
        if (pointsForSurveyor.length === 0) continue
        const timestamps = pointsForSurveyor
          .flatMap((p) => [p.startedAt, p.completedAt, p.createdAt])
          .filter((t): t is string => !!t)
          .map((t) => new Date(t).getTime())
          .filter((t) => !Number.isNaN(t))
        if (timestamps.length === 0) continue
        const { from, to } = clampRouteWindow(Math.min(...timestamps), Math.max(...timestamps))
        const colorIdx = surveyorOptions.findIndex((s) => s.id === surveyorId)
        const color = ROUTE_COLORS[colorIdx >= 0 ? colorIdx % ROUTE_COLORS.length : 0]
        drawRouteForSurveyor(mod.default, mapRef.current, surveyorId, from, to, color)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRouteSurveyorIds])

  // Si se quita el filtro de encuesta (vuelve a "Todas"), limpia cualquier
  // ruta que hubiera quedado seleccionada — ver comentario junto al botón
  // "Ver ruta" sobre por qué esa combinación trababa el mapa.
  useEffect(() => {
    if (!hasSurveySelected && selectedRouteSurveyorIds.size > 0) {
      setSelectedRouteSurveyorIds(new Set())
      setShowRoutePicker(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSurveySelected])

  // Re-encuadra el mapa apenas se elige un municipio/ciudad, sin esperar a
  // que cambien filteredPoints/zonePolygons.
  useEffect(() => {
    if (!mapRef.current) return
    try { mapRef.current.fitBounds(CITY_PRESETS[cityPresetIdx].bounds, { animate: true }) } catch { }
  }, [cityPresetIdx])

  // Permite cerrar pantalla completa con la tecla Escape
  useEffect(() => {
    if (!isFullscreen) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false) }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isFullscreen])

  // Pide y dibuja la ruta GPS de un encuestador entre `from` y `to` (ver
  // app/api/reports/route-trace). Usada tanto por el botón "Ver ruta" de un
  // punto puntual como por el selector general de encuestadores. Cada ruta
  // se guarda en routeLayersRef bajo su surveyorId para poder tener varias
  // dibujadas a la vez sin que se pisen entre sí.
  const drawRouteForSurveyor = async (L: any, map: any, surveyorId: string, from: string, to: string, color: string = "#3b82f6") => {
    setLoadingRouteIds((prev) => new Set(prev).add(surveyorId))
    try {
      const params = new URLSearchParams({ surveyorId, from, to })
      const res = await fetch(`/api/reports/route-trace?${params}`)
      if (!res.ok) return
      const { points } = await res.json()
      if (!Array.isArray(points) || points.length < 2) return

      const existing = routeLayersRef.current.get(surveyorId)
      if (existing) {
        try { map.removeLayer(existing) } catch { }
      }

      const latlngs = points.map((pt: any) => [pt.lat, pt.lng])
      const polyline = L.polyline(latlngs, { color, weight: 4, opacity: 0.85, dashArray: "6 4" }).addTo(map)
      routeLayersRef.current.set(surveyorId, polyline)

      // Si hay una sola ruta visible, centra el mapa en ella; con varias,
      // evita saltar de una a otra y deja que el usuario navegue libremente.
      if (routeLayersRef.current.size === 1) {
        map.fitBounds(polyline.getBounds(), { padding: [40, 40], maxZoom: 16 })
      }
    } catch (err) {
      console.error("Error cargando ruta del encuestador:", err)
    } finally {
      setLoadingRouteIds((prev) => {
        const next = new Set(prev)
        next.delete(surveyorId)
        return next
      })
    }
  }

  const drawRoute = (L: any, map: any, p: ResponsePoint) => {
    if (!p.surveyorId || !p.startedAt || !p.completedAt) return
    setSelectedRouteSurveyorIds((prev) => new Set(prev).add(p.surveyorId as string))
    return drawRouteForSurveyor(L, map, p.surveyorId, p.startedAt, p.completedAt)
  }

  const renderLayers = async (L: any, map: any) => {
    if (!map) return

    // Limpiar capas anteriores
    layersRef.current.forEach((l) => { try { map.removeLayer(l) } catch { } })
    layersRef.current = []
    for (const layer of routeLayersRef.current.values()) {
      try { map.removeLayer(layer) } catch { }
    }
    routeLayersRef.current.clear()

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
              ${p.respondentPhone ? `<div style="color:#555">Teléfono: <strong>${p.respondentPhone}</strong></div>` : ""}
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
    // Si el usuario delimitó el mapa a una ciudad/municipio (CITY_PRESETS),
    // esa elección manda sobre el auto-fit a los datos — si no, cada cambio
    // de filtro devolvería la vista a "todo el país".
    if (cityPresetIdx > 0) {
      try { map.fitBounds(CITY_PRESETS[cityPresetIdx].bounds, { animate: false }) } catch { }
    } else if (bounds.length > 0) {
      try {
        const latLngBounds = L.latLngBounds(bounds)
        if (latLngBounds.isValid()) {
          map.fitBounds(latLngBounds, { padding: [40, 40], maxZoom: 14, animate: false })
        }
      } catch { }
    }

    // Este método limpia TODAS las capas (incluidas rutas) arriba, así que
    // si había encuestadores seleccionados para ver su ruta hay que
    // redibujarlas para que un cambio de filtro (zonas/puntos/tipo) no las
    // borre silenciosamente.
    for (const surveyorId of selectedRouteSurveyorIds) {
      const pointsForSurveyor = responsePoints.filter((p) => p.surveyorId === surveyorId)
      if (pointsForSurveyor.length === 0) continue
      const timestamps = pointsForSurveyor
        .flatMap((p) => [p.startedAt, p.completedAt, p.createdAt])
        .filter((t): t is string => !!t)
        .map((t) => new Date(t).getTime())
        .filter((t) => !Number.isNaN(t))
      if (timestamps.length === 0) continue
      const { from, to } = clampRouteWindow(Math.min(...timestamps), Math.max(...timestamps))
      const colorIdx = surveyorOptions.findIndex((s) => s.id === surveyorId)
      const color = ROUTE_COLORS[colorIdx >= 0 ? colorIdx % ROUTE_COLORS.length : 0]
      drawRouteForSurveyor(L, map, surveyorId, from, to, color)
    }
  }

  if (!isClient) {
    return (
      <div className="w-full rounded-xl bg-muted animate-pulse" style={{ height: 460 }} />
    )
  }

  const hasData = zonePolygons.length > 0 || filteredPoints.length > 0

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
        <select
          value={cityPresetIdx}
          onChange={(e) => setCityPresetIdx(Number(e.target.value))}
          className="px-2 py-1.5 rounded-lg text-xs font-medium shadow-md border bg-white border-gray-200 text-gray-700"
          title="Delimitar el mapa a una ciudad/municipio"
        >
          {CITY_PRESETS.map((p, idx) => (
            <option key={p.label} value={idx}>{p.label}</option>
          ))}
        </select>
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
        {/* Ver ruta: requiere una encuesta puntual seleccionada arriba.
            Sin eso, el rango de tiempo para reconstruir la ruta de un
            encuestador termina siendo "todo su historial" (semanas/meses de
            pings de días y encuestas distintas mezclados), lo que generaba
            consultas pesadas y un polyline sin sentido que trababa el mapa. */}
        {!hasSurveySelected ? (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md border bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
            title="Elegí una encuesta específica en el filtro de arriba para poder ver la ruta de un encuestador"
          >
            <span className="w-3 h-0.5 rounded inline-block bg-gray-300" />
            Ver ruta
          </div>
        ) : surveyorOptions.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowRoutePicker((v) => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md border transition-all w-full ${selectedRouteSurveyorIds.size > 0 ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}
            >
              <span className="w-3 h-0.5 rounded inline-block bg-blue-500" />
              Ver ruta{selectedRouteSurveyorIds.size > 0 ? ` (${selectedRouteSurveyorIds.size})` : "..."}
            </button>
            {showRoutePicker && (
              <div className="absolute right-0 mt-1 w-56 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex flex-col gap-0.5">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-1 mb-1">
                  Encuestadores (elegí varios)
                </p>
                {surveyorOptions.map((s, idx) => {
                  const checked = selectedRouteSurveyorIds.has(s.id)
                  const color = ROUTE_COLORS[idx % ROUTE_COLORS.length]
                  return (
                    <label key={s.id} className="flex items-center gap-2 px-1 py-1 rounded cursor-pointer hover:bg-gray-50 select-none">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleRouteSurveyor(s.id)}
                        className="h-3.5 w-3.5"
                        style={checked ? { borderColor: color, backgroundColor: color } : { borderColor: color }}
                      />
                      <span className="text-xs text-gray-700 truncate">{s.name}</span>
                    </label>
                  )
                })}
                {selectedRouteSurveyorIds.size > 0 && (
                  <button
                    onClick={() => setSelectedRouteSurveyorIds(new Set())}
                    className="mt-1 text-[11px] text-gray-500 hover:text-gray-700 px-1 text-left"
                  >
                    Limpiar rutas
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {loadingRouteIds.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md border bg-white border-gray-200 text-gray-500">
            Cargando ruta...
          </div>
        )}
      </div>

      {/* Leyenda — esquina inferior izquierda. Doble uso: además de leyenda,
          cada fila es un checkbox real que filtra el tipo de respuesta.
          Se muestra siempre (no solo cuando hay puntos clasificados) para que
          sirva de referencia fija del mapa. */}
      <div className="absolute bottom-6 left-3 z-[1000] flex flex-col gap-2">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg border shadow-md px-3 py-2">
          <p className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Tipo de respuesta</p>
          <div className="flex flex-col gap-1">
            {ALL_OUTCOMES.map((t) => {
              const checked = enabledOutcomes.has(t)
              return (
                <label key={t} className="flex items-center gap-2 cursor-pointer select-none rounded px-1 -mx-1 hover:bg-gray-50">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleOutcome(t)}
                    className="h-3.5 w-3.5"
                    style={{ borderColor: outcomeColor[t], ...(checked ? { backgroundColor: outcomeColor[t] } : {}) }}
                  />
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: outcomeColor[t], opacity: checked ? 1 : 0.35 }} />
                  <span className={`text-[10px] ${checked ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                    {outcomeLabel[t]}
                  </span>
                </label>
              )
            })}
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
          <p className="text-xs text-gray-400 mt-1">
            {hasActiveSurveyorFilter
              ? "El encuestador seleccionado no tiene ubicaciones registradas para esta encuesta. Probá con \"Todos\" en el filtro de Encuestador."
              : "Asigna encuestadores a zonas para ver el mapa"}
          </p>
        </div>
      )}
    </div>
  )
}
