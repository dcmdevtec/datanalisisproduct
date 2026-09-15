"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
  // Reunión 2026-08-27 ("Poder descargar el PDF del mapa"): html2canvas
  // tiñe el canvas (y tira SecurityError al leerlo) si intenta capturar
  // imágenes cross-origin que el navegador cargó sin permiso CORS — que es
  // como Leaflet pide los tiles por defecto. Activar esto en el mapa que el
  // equipo usa todo el día es arriesgado sin poder probarlo en un navegador
  // real (si el tile server no manda los headers CORS esperados, las
  // imágenes ni siquiera cargarían). Por eso es un prop aparte, false por
  // default, y solo lo prende la copia oculta que arma el PDF en
  // app/reports/page.tsx — el mapa visible de siempre nunca lo toca.
  crossOriginTiles?: boolean
  // Estado inicial de los filtros — solo se leen al MONTAR (useState
  // perezoso), nunca se vuelven a aplicar si cambian después. Existen para
  // que la copia oculta de exportación (app/reports/page.tsx) pueda
  // arrancar con el mismo tipo de respuesta filtrado y la misma ruta
  // seleccionada que tenía el mapa visible en pantalla al tocar "Descargar
  // PDF" — sin esto, la exportación siempre salía con el filtro de fábrica
  // (todo activado, sin ruta), sin importar lo que el usuario tuviera
  // elegido. El mapa visible los ignora (nunca se le pasan).
  initialEnabledOutcomes?: string[]
  initialShowZones?: boolean
  initialShowPoints?: boolean
  initialSelectedRouteSurveyorIds?: string[]
  // Reunión 2026-08-27, punto 4 ("Poder delimitar el mapa al momento de
  // visualizarlo Y descargarlo"): el selector de ciudad/municipio (ver
  // CITY_PRESETS) delimitaba la vista en pantalla, pero la copia oculta de
  // exportación siempre arrancaba en "Todo Colombia" — el PDF descargado
  // ignoraba la delimitación elegida. Se agrega como initial* más, mismo
  // patrón que los demás filtros.
  initialCityPresetIdx?: number
  // El mapa VISIBLE usa esto para avisarle a app/reports/page.tsx cuál es su
  // filtro actual cada vez que cambia — así, al momento de exportar, el
  // padre ya tiene a mano qué pasarle como initial* de arriba a la copia
  // oculta. Se evita un ref imperativo a propósito: ReportsGeoMap se importa
  // con next/dynamic, y no vale la pena depender de que el forwarding de
  // refs a través de next/dynamic funcione sin poder probarlo.
  onFilterStateChange?: (state: {
    enabledOutcomes: string[]
    showZones: boolean
    showPoints: boolean
    selectedRouteSurveyorIds: string[]
    cityPresetIdx: number
  }) => void
  // Ítem 09/09/2026: el botón "Ver encuesta" del popup de un punto de
  // respuesta llama a esto con el id real de `responses` — app/reports/page.tsx
  // lo usa para cambiar a la pestaña "Respuestas Individuales" y abrir el
  // mismo modal de detalle que esa pestaña, en vez de dibujar la ruta GPS
  // (que ya tiene su propio control "Ver ruta" en el panel del mapa).
  onViewResponse?: (responseId: string) => void
  // Ítem 15/09/2026: "el PDF del mapa a veces sale en blanco" — app/reports/
  // page.tsx capturaba la copia oculta de exportación tras una espera FIJA
  // (2.5s), sin ninguna garantía real de que los tiles (con crossOrigin,
  // así que nunca reusan la caché del mapa visible — siempre se piden de
  // nuevo por red) ya hubieran terminado de pintarse. Con red lenta, la
  // captura llegaba antes de que aparecieran, y el PDF salía con el mapa en
  // blanco. Este callback se dispara UNA vez que el mapa está realmente
  // listo para capturarse: polígonos/puntos ya dibujados, ruta pre-
  // seleccionada (si la había) ya resuelta, Y el tile layer disparó su
  // propio evento 'load' (todos los tiles visibles ya bajaron o fallaron).
  onReady?: () => void
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

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "")
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// Solo el anillo exterior de cada polígono — suficiente para el relleno
// aproximado de drawOverlayCanvas más abajo; las zonas de esta app son
// bounding boxes simples, no hace falta soporte de huecos (holes).
function extractPolygonRings(geometry: any): [number, number][][] {
  if (!geometry) return []
  if (geometry.type === "Polygon") {
    return geometry.coordinates?.[0] ? [geometry.coordinates[0]] : []
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates || []).map((poly: any) => poly?.[0]).filter(Boolean)
  }
  return []
}

// Debe coincidir con el `scale` que usa captureCharts() en
// app/lib/export-report.ts al capturar la tarjeta de exportación — este
// canvas se dibuja a esa densidad para no salir borroso en el PDF.
const OVERLAY_CANVAS_SCALE = 3

// Espera a que el tile layer termine de bajar TODOS los tiles pendientes en
// este momento (no cuando se creó el layer) — ver el comentario junto a su
// uso en init() sobre por qué la señal vieja (un solo 'load' disparado justo
// al crear el layer) se quedaba corta cuando el mapa hacía zoom a nivel de
// calle después. `isLoading()` (Leaflet GridLayer) dice si hay tiles
// pidiéndose ahora mismo; si no hay ninguno, resuelve de una.
function waitForTilesIdle(tileLayer: any, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const finish = () => { if (settled) return; settled = true; resolve() }
    try {
      if (typeof tileLayer.isLoading === "function" && !tileLayer.isLoading()) {
        finish()
        return
      }
    } catch { }
    tileLayer.once("load", finish)
    setTimeout(finish, timeoutMs)
  })
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

export default function ReportsGeoMap({
  zonePolygons,
  responsePoints,
  hasActiveSurveyorFilter,
  hasSurveySelected,
  crossOriginTiles,
  initialEnabledOutcomes,
  initialShowZones,
  initialShowPoints,
  initialSelectedRouteSurveyorIds,
  initialCityPresetIdx,
  onFilterStateChange,
  onViewResponse,
  onReady,
}: ReportsGeoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Ítem 15/09/2026: canvas de overlay dibujado a mano (ver drawOverlayCanvas
  // más abajo) — solo se usa/monta cuando crossOriginTiles=true.
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const mapRef = useRef<any>(null)
  const layersRef = useRef<any[]>([])
  // Ruta GPS aproximada de un punto individual (ver botón "Ver ruta" en su
  // popup) — se dibuja aparte de layersRef para poder limpiarla sola sin
  // tocar el resto del mapa (zonas/puntos) cuando se pide otra ruta.
  // Ahora puede haber varias rutas dibujadas a la vez (una por encuestador
  // seleccionado) — se guardan por surveyorId para poder limpiar/redibujar
  // solo la que cambió sin afectar las demás.
  const routeLayersRef = useRef<Map<string, any>>(new Map())
  // Caché de puntos ya traídos por encuestador — a diferencia de
  // routeLayersRef (que se vacía cada vez que se redibuja el mapa),
  // sobrevive entre redibujados para no volver a pedir /api/reports/route-trace
  // cada vez que cambia un filtro (zonas, puntos, tipo, etc.) mientras la
  // ruta seleccionada sigue siendo la misma.
  const routeDataCacheRef = useRef<Map<string, { lat: number; lng: number }[]>>(new Map())
  const [loadingRouteIds, setLoadingRouteIds] = useState<Set<string>>(new Set())
  const [isClient, setIsClient] = useState(false)
  const [showPoints, setShowPoints] = useState(initialShowPoints ?? true)
  const [showZones, setShowZones] = useState(initialShowZones ?? true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Delimitar el mapa por ciudad/municipio (ver CITY_PRESETS) en vez de
  // siempre mostrar todo el país.
  const [cityPresetIdx, setCityPresetIdx] = useState(initialCityPresetIdx ?? 0)
  // Filtro por tipo (slide 24): checkboxes multi-selección, todos activos por defecto.
  // Los puntos sin outcome (ej. rastro GPS del portal encuestador) siempre se
  // muestran — el filtro solo aplica a respuestas ya clasificadas.
  const ALL_OUTCOMES = ["efectiva", "abandonada", "incidencia", "descalificado"] as const
  const [enabledOutcomes, setEnabledOutcomes] = useState<Set<string>>(
    () => new Set(initialEnabledOutcomes ?? ALL_OUTCOMES),
  )
  // Ítem 09/09/2026: si al desmarcar queda el set vacío (se desmarcaron
  // todos), en vez de dejar el mapa sin nada visible y obligar a marcar uno
  // por uno de nuevo, se restaura la selección completa — el checkbox que
  // se acaba de clickear queda como el único marcado (el mismo criterio que
  // "clic en el último = reiniciar" evita el estado "todo apagado").
  const toggleOutcome = (t: string) => {
    setEnabledOutcomes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      if (next.size === 0) return new Set(ALL_OUTCOMES)
      return next
    })
  }
  // Selector de encuestadores para ver su ruta GPS completa (independiente de
  // hacer click en un punto puntual) — multi-selección: permite comparar la
  // ruta de varios encuestadores a la vez, cada una con su propio color, sin
  // que el mapa "colapse" al perder las rutas ya dibujadas al elegir otra.
  const [selectedRouteSurveyorIds, setSelectedRouteSurveyorIds] = useState<Set<string>>(
    () => new Set(initialSelectedRouteSurveyorIds ?? []),
  )
  const [showRoutePicker, setShowRoutePicker] = useState(false)

  // Le avisa a app/reports/page.tsx cada vez que cambia el filtro de esta
  // instancia — ver onFilterStateChange arriba. Solo lo usa el mapa
  // visible; la copia oculta de exportación no pasa este prop, así que ahí
  // esto no hace nada.
  useEffect(() => {
    onFilterStateChange?.({
      enabledOutcomes: [...enabledOutcomes],
      showZones,
      showPoints,
      selectedRouteSurveyorIds: [...selectedRouteSurveyorIds],
      cityPresetIdx,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledOutcomes, showZones, showPoints, selectedRouteSurveyorIds, cityPresetIdx])

  // Ítem 15/09/2026: "evita posibles bugs — que solo muestre por
  // encuestador individual, no permita seleccionar más de dos" — cada ruta
  // seleccionada dispara su propio fetch a /api/reports/route-trace y hace
  // zoom a nivel de calle (ver drawRouteForSurveyor); sin tope, muchas rutas
  // a la vez multiplican esos pedidos y el encuadre final termina siendo un
  // punto medio confuso entre todas — quedaba sin sentido leerlo. Tope de
  // 2 simultáneas: alcanza para comparar dos encuestadores a la vez sin la
  // maraña de tener varias rutas encimadas.
  const MAX_SIMULTANEOUS_ROUTES = 2
  const toggleRouteSurveyor = (id: string) => {
    setSelectedRouteSurveyorIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= MAX_SIMULTANEOUS_ROUTES) return prev
        next.add(id)
      }
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

  // BUG CRÍTICO (2026-08-28): esto se recalculaba en cada render como un
  // array NUEVO (nueva referencia), y era dependencia del efecto que
  // redibuja las capas del mapa. Ese efecto, al dibujar una ruta
  // seleccionada, actualiza estado (setLoadingRouteIds) — lo cual dispara
  // un re-render — lo cual crea un `filteredPoints` con referencia distinta
  // — lo cual vuelve a disparar el efecto — bucle infinito: seguía
  // pidiendo /api/reports/route-trace y redibujando el mapa sin parar,
  // hasta trabar/colgar la pestaña. Memoizado para que la referencia solo
  // cambie cuando los datos o el filtro de tipo realmente cambian.
  const filteredPoints = useMemo(
    () => responsePoints.filter((p) => !p.outcome || enabledOutcomes.has(p.outcome)),
    [responsePoints, enabledOutcomes]
  )

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
          // Ítem 15/09/2026: en la copia oculta de exportación
          // (crossOriginTiles=true) se apagan TODAS las animaciones de
          // Leaflet — el fade de tiles nuevos y el paneo/zoom suave dejan
          // el mapa en un estado visual "a medio camino" por unos cientos
          // de ms, y si html2canvas captura justo ahí, el resultado se ve
          // corrido/desalineado. Sin animación, cada cambio (fitBounds del
          // preset de ciudad o de una ruta) se aplica de una sola vez, así
          // que no hay ninguna ventana donde capturar algo a medio mover.
          // El mapa VISIBLE (crossOriginTiles=false) conserva las
          // animaciones normales — esto no le cambia nada.
          ...(crossOriginTiles ? { fadeAnimation: false, zoomAnimation: false, markerZoomAnimation: false } : {}),
        })

        mapRef.current = map

        // Mismo tile que components/tracking-map.tsx (encuestador) — antes este
        // mapa usaba CartoDB Positron (gris pálido), que el cliente reportó
        // como "se ve en negativo" al compararlo con el mapa de tracking.
        //
        // Ítem 15/09/2026 — historial de esta misma línea, para que quede
        // constancia de por qué terminó así:
        //   1. tile.openstreetmap.org (el de siempre): no manda headers CORS.
        //      Con crossOrigin:true (obligatorio para que html2canvas pueda
        //      leer el canvas sin SecurityError) el navegador rechaza cada
        //      tile en silencio — Leaflet igual dispara 'load' (cuenta los
        //      fallos como "terminado"), así que el mapa quedaba con los
        //      tiles en blanco pase lo que pase.
        //   2. Se probó CartoDB (sí manda CORS) — pero ahora exige API key
        //      para uso anónimo; sin una, cada tile vuelve como una imagen
        //      de error con "API KEY REQUIRED" superpuesto — de ahí que "se
        //      viera horrible", no era un problema de estilo.
        // Solución final, sin depender de ningún proveedor externo ni API
        // key: /api/tiles/[z]/[x]/[y] (este mismo repo) pide el tile real a
        // OpenStreetMap DEL LADO DEL SERVIDOR (sin problema de CORS ahí — es
        // un fetch servidor-a-servidor) y lo reenvía con
        // Access-Control-Allow-Origin: * en la respuesta. Mismo estilo
        // exacto que el mapa visible (es el mismo tile de OSM), servido
        // desde nuestro propio dominio para cumplir lo que el navegador
        // exige con crossOrigin:true. El mapa VISIBLE sigue igual que
        // siempre, pidiendo directo a OSM sin pasar por este proxy.
        const tileUrl = crossOriginTiles
          ? "/api/tiles/{z}/{x}/{y}"
          : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        const tileLayer = L.tileLayer(tileUrl, {
          maxZoom: 19,
          ...(crossOriginTiles ? { crossOrigin: true } : { subdomains: "abc" }),
        }).addTo(map)

        // Atribución pequeña en esquina — el tile sigue siendo de OSM en
        // ambos casos (con o sin el proxy propio de /api/tiles), así que el
        // crédito es el mismo para el mapa visible y para la exportación.
        L.control.attribution({ position: "bottomright", prefix: false })
          .addAttribution('© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>')
          .addTo(map)

        await renderLayers(L, map)

        // Dibuja de una las rutas que ya venían seleccionadas al montar (la
        // copia oculta de exportación arranca con initialSelectedRouteSurveyorIds
        // ya poblado — ver props arriba). El efecto de más abajo que dibuja
        // rutas depende de selectedRouteSurveyorIds y bailea si mapRef.current
        // todavía es null (que es justo el caso acá, porque ese efecto ya
        // corrió una vez ANTES de que este init() asíncrono terminara de
        // crear el mapa) — sin esto, la ruta seleccionada nunca aparecería
        // en el PDF exportado.
        if (selectedRouteSurveyorIds.size > 0) {
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
            await drawRouteForSurveyor(L, map, surveyorId, from, to, color)
          }
        }

        // Ítem 15/09/2026 (2da vuelta): "el mapa exportado sale con partes
        // grises" cuando hay una ruta seleccionada — la señal de "tiles
        // listos" se armaba UNA sola vez, apenas se creaba el tile layer, a
        // la vista inicial (todo el país, pocos tiles, carga rápida). Pero
        // renderLayers() y drawRouteForSurveyor() (arriba) hacen zoom a
        // nivel de calle para encuadrar los puntos/la ruta — eso pide un
        // lote de tiles COMPLETAMENTE NUEVO (y mucho más grande) a nuestro
        // proxy /api/tiles, que nunca se esperaba: el 'load' original ya
        // había disparado (o el timeout de 5s ya había vencido) antes de
        // que ese lote nuevo terminara de bajar. Se espera acá, DESPUÉS de
        // que el encuadre final ya está fijado, con un timeout más generoso
        // (10s — cada tile pasa por nuestro proxy, que hace su propio
        // pedido a OpenStreetMap, así que toma más que un tile directo).
        await waitForTilesIdle(tileLayer)
        drawOverlayCanvas()
        onReady?.()
      } catch (err) {
        console.error("Error inicializando mapa de reportes:", err)
        // No dejar a quien esté esperando onReady() colgado para siempre si
        // algo de lo anterior falló (ej. el fetch de la ruta) — mejor
        // capturar el mapa como haya quedado que no capturarlo nunca.
        onReady?.()
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
    drawOverlayCanvas()

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
    const map = mapRef.current
    // fitBounds acá usa animate:true (mapa visible) — dibujar el overlay
    // solo al terminar el paneo (moveend), no antes, para no capturar una
    // posición a medio camino en la copia oculta si esta encuesta arranca
    // con un cityPresetIdx>0 (ver initialCityPresetIdx). El dibujo
    // inmediato de abajo cubre el caso en que fitBounds no dispare
    // 'moveend' por no haber movimiento real (ya estaba en esa posición).
    try {
      map.once("moveend", () => drawOverlayCanvas())
      map.fitBounds(CITY_PRESETS[cityPresetIdx].bounds, { animate: true })
    } catch { }
    drawOverlayCanvas()
  }, [cityPresetIdx])

  // Permite cerrar pantalla completa con la tecla Escape
  useEffect(() => {
    if (!isFullscreen) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false) }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isFullscreen])

  // Dibuja una polyline ya resuelta (desde caché) sin tocar red ni estado —
  // usado cuando renderLayers necesita redibujar una ruta que ya se había
  // traído antes (ej. el usuario tocó el filtro de tipo/zonas mientras una
  // ruta seguía seleccionada). No llamar setState acá es intencional: eso
  // fue justamente lo que causaba el bucle infinito (ver comentario en
  // filteredPoints) — redibujar nunca debe disparar un re-render.
  const drawCachedRoute = (L: any, map: any, surveyorId: string, points: { lat: number; lng: number }[], color: string) => {
    const existing = routeLayersRef.current.get(surveyorId)
    if (existing) {
      try { map.removeLayer(existing) } catch { }
    }
    const latlngs = points.map((pt) => [pt.lat, pt.lng])
    const polyline = L.polyline(latlngs, { color, weight: 4, opacity: 0.85, dashArray: "6 4" }).addTo(map)
    routeLayersRef.current.set(surveyorId, polyline)
    drawOverlayCanvas()
  }

  // Pide (si no está en caché) y dibuja la ruta GPS de un encuestador entre
  // `from` y `to` (ver app/api/reports/route-trace). Usada tanto por el
  // botón "Ver ruta" de un punto puntual como por el selector general de
  // encuestadores. Cada ruta se guarda en routeLayersRef bajo su surveyorId
  // para poder tener varias dibujadas a la vez sin que se pisen entre sí.
  const drawRouteForSurveyor = async (L: any, map: any, surveyorId: string, from: string, to: string, color: string = "#3b82f6") => {
    const cached = routeDataCacheRef.current.get(surveyorId)
    if (cached) {
      drawCachedRoute(L, map, surveyorId, cached, color)
      return
    }

    setLoadingRouteIds((prev) => new Set(prev).add(surveyorId))
    try {
      const params = new URLSearchParams({ surveyorId, from, to })
      const res = await fetch(`/api/reports/route-trace?${params}`)
      if (!res.ok) return
      const { points } = await res.json()
      if (!Array.isArray(points) || points.length < 2) return

      routeDataCacheRef.current.set(surveyorId, points)
      drawCachedRoute(L, map, surveyorId, points, color)

      // Si hay una sola ruta visible, centra el mapa en ella; con varias,
      // evita saltar de una a otra y deja que el usuario navegue libremente.
      const layer = routeLayersRef.current.get(surveyorId)
      if (layer && routeLayersRef.current.size === 1) {
        // Ítem 15/09/2026: "que la ruta/los puntos no salgan corridos" — en
        // la copia oculta de exportación (crossOriginTiles=true) este
        // fitBounds corría DENTRO de init(), antes de que onReady avisara
        // que ya podía capturarse — pero con animate por defecto (true),
        // Leaflet arranca una transición de paneo/zoom que tarda unos
        // cientos de ms en asentarse. html2canvas podía terminar
        // capturando a mitad de esa animación: el mapa base ya en su
        // posición final, pero la ruta/el marcador todavía a mitad de
        // camino — el efecto "corrido" que se ve en el PDF. Sin animación
        // en la copia oculta, el encuadre queda en su posición final de
        // inmediato, sin ventana donde capturar algo a medio mover. El mapa
        // VISIBLE (crossOriginTiles=false) conserva la animación de siempre.
        map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 16, animate: !crossOriginTiles })
        // drawCachedRoute (arriba) ya redibujó el overlay, pero con el
        // encuadre ANTERIOR a este fitBounds — hay que volver a dibujar con
        // la posición final para que no quede desalineado.
        drawOverlayCanvas()
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

  // Ítem 15/09/2026 (5ta vuelta sobre este mismo problema): tras varias
  // rondas intentando que html2canvas capture bien el pane SVG de Leaflet
  // — foreignObjectRendering resuelve el transform pero no siempre trae los
  // tiles de red; el renderer por defecto, a la escala real de zoom/paneo
  // de producción, a veces dibuja un "fantasma" del overlay en un lugar
  // equivocado (confirmado con una prueba aislada) — la solución realmente
  // robusta es no depender en ABSOLUTO de que html2canvas entienda el pane
  // SVG de Leaflet. Este canvas (solo para la copia oculta de exportación,
  // crossOriginTiles=true) se redibuja a mano con Canvas 2D plano cada vez
  // que cambian zonas/puntos/rutas o el encuadre del mapa, usando
  // `map.latLngToContainerPoint()` — la MISMA matemática que Leaflet usa
  // internamente para posicionar su propio pane SVG — así que es imposible
  // que quede desalineado respecto a los tiles: ambos terminan
  // posicionados según el mismo estado real del mapa en el momento del
  // dibujo. Al ser un <canvas> plano (position:absolute con top/left fijos,
  // sin ningún CSS transform propio) html2canvas lo captura con la misma
  // confiabilidad con la que ya capturaba los tiles (<img> normales) — ver
  // captureCharts() en app/lib/export-report.ts, que ya NO necesita ningún
  // tratamiento especial para la tarjeta del mapa.
  const drawOverlayCanvas = () => {
    if (!crossOriginTiles) return
    const canvas = overlayCanvasRef.current
    const map = mapRef.current
    if (!canvas || !map) return
    const size = map.getSize()
    if (!size || size.x === 0 || size.y === 0) return
    canvas.width = size.x * OVERLAY_CANVAS_SCALE
    canvas.height = size.y * OVERLAY_CANVAS_SCALE
    canvas.style.width = `${size.x}px`
    canvas.style.height = `${size.y}px`
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(OVERLAY_CANVAS_SCALE, OVERLAY_CANVAS_SCALE)

    const toPoint = (lat: number, lng: number) => map.latLngToContainerPoint([lat, lng])

    if (showZones) {
      for (const zone of zonePolygons) {
        if (!zone.geometry) continue
        const color = completionColor(zone.completionRate)
        for (const ring of extractPolygonRings(zone.geometry)) {
          ctx.beginPath()
          ring.forEach(([lng, lat]: [number, number], i: number) => {
            const pt = toPoint(lat, lng)
            if (i === 0) ctx.moveTo(pt.x, pt.y)
            else ctx.lineTo(pt.x, pt.y)
          })
          ctx.closePath()
          ctx.fillStyle = hexToRgba(color, 0.25)
          ctx.fill()
          ctx.strokeStyle = color
          ctx.lineWidth = 2
          ctx.globalAlpha = 0.85
          ctx.stroke()
          ctx.globalAlpha = 1
        }
      }
    }

    if (showPoints) {
      const pointRadius = filteredPoints.length > 500 ? 3.5
        : filteredPoints.length > 200 ? 4.5
        : filteredPoints.length > 50 ? 5.5
        : 7
      for (const p of filteredPoints) {
        const color = p.outcome ? outcomeColor[p.outcome] : "#94a3b8"
        const pt = toPoint(p.lat, p.lng)
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, pointRadius, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        ctx.lineWidth = pointRadius > 5 ? 1.5 : 1
        ctx.strokeStyle = "#ffffff"
        ctx.stroke()
      }
    }

    for (const [surveyorId, points] of routeDataCacheRef.current.entries()) {
      if (!selectedRouteSurveyorIds.has(surveyorId) || points.length < 2) continue
      const colorIdx = surveyorOptions.findIndex((s) => s.id === surveyorId)
      const color = ROUTE_COLORS[colorIdx >= 0 ? colorIdx % ROUTE_COLORS.length : 0]
      ctx.beginPath()
      points.forEach((pt, i) => {
        const c = toPoint(pt.lat, pt.lng)
        if (i === 0) ctx.moveTo(c.x, c.y)
        else ctx.lineTo(c.x, c.y)
      })
      ctx.strokeStyle = color
      ctx.lineWidth = 4
      ctx.globalAlpha = 0.85
      ctx.setLineDash([6, 4])
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }

    ctx.restore()
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
      // Ítem 09/09/2026: "reducir el tamaño de los puntos y limpiar
      // elementos innecesarios — con un volumen alto de encuestas, los
      // marcadores actuales pueden impedir la lectura del mapa". Radio fijo
      // en píxeles (no cambia con el zoom — Leaflet lo mantiene legible sin
      // importar el nivel de acercamiento), pero se reduce el tamaño BASE
      // según cuántos puntos hay que dibujar a la vez, para que no se tapen
      // entre sí en zonas muy densas.
      const pointRadius = filteredPoints.length > 500 ? 3.5
        : filteredPoints.length > 200 ? 4.5
        : filteredPoints.length > 50 ? 5.5
        : 7
      for (const p of filteredPoints) {
        const color = p.outcome ? outcomeColor[p.outcome] : "#94a3b8"

        const circle = L.circleMarker([p.lat, p.lng], {
          radius: pointRadius,
          fillColor: color,
          color: "#fff",
          weight: pointRadius > 5 ? 1.5 : 1,
          opacity: 1,
          fillOpacity: 0.9,
        })

        const isSurveyorTrace = p.source === "surveyor"
        // Ítem pedido 09/09/2026: el botón del popup llevaba a "Ver ruta del
        // encuestador", redundante con el control "Ver ruta" del panel de la
        // derecha (que ya filtra por encuestador/fecha) — y el cliente
        // esperaba que un punto de RESPUESTA lo llevara a esa respuesta, no a
        // la ruta GPS. Se reemplaza por "Ver encuesta", que abre el mismo
        // modal de detalle que usa la pestaña "Respuestas Individuales" (ver
        // onViewResponse, resuelto en app/reports/page.tsx).
        const canOpenResponse = !isSurveyorTrace && !!p.id && !!onViewResponse
        const viewBtnId = `ver-encuesta-${p.id ?? `${p.lat}-${p.lng}`}`
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
              ${canOpenResponse ? `<button id="${viewBtnId}" style="margin-top:6px;padding:4px 8px;font-size:11px;font-weight:600;color:#18b0a4;background:#18b0a41a;border:1px solid #18b0a4;border-radius:6px;cursor:pointer">Ver encuesta</button>` : ""}
            </div>
          </div>`

        circle.bindPopup(popupHtml, { maxWidth: 220 })
        if (canOpenResponse) {
          circle.on("popupopen", () => {
            const btn = document.getElementById(viewBtnId)
            if (!btn) return
            btn.addEventListener("click", () => onViewResponse!(p.id as string), { once: true })
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

    drawOverlayCanvas()
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

      {/* Ítem 15/09/2026: capa de overlay dibujada a mano (ver
          drawOverlayCanvas) — SOLO para la copia oculta de exportación.
          Reemplaza la necesidad de que html2canvas entienda el pane SVG de
          Leaflet (zonas/puntos/rutas), que demostró ser poco confiable a
          las escalas reales de zoom/paneo. El mapa VISIBLE de siempre sigue
          usando el pane nativo de Leaflet sin tocar nada. */}
      {crossOriginTiles && (
        <canvas ref={overlayCanvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 450 }} />
      )}

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
                  Encuestadores (máx. {MAX_SIMULTANEOUS_ROUTES} a la vez)
                </p>
                {surveyorOptions.map((s, idx) => {
                  const checked = selectedRouteSurveyorIds.has(s.id)
                  const color = ROUTE_COLORS[idx % ROUTE_COLORS.length]
                  const atCap = !checked && selectedRouteSurveyorIds.size >= MAX_SIMULTANEOUS_ROUTES
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-2 px-1 py-1 rounded select-none ${atCap ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-gray-50"}`}
                      title={atCap ? `Ya elegiste ${MAX_SIMULTANEOUS_ROUTES} — destildá uno para cambiar` : undefined}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={atCap}
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

      {/* Contador de puntos — corrido a la derecha del control de zoom nativo
          de Leaflet (esquina superior izquierda, ~10-40px): antes quedaba
          en top-3 left-3, justo encima de los botones +/-, tapándolos por
          completo (ítem 09/09/2026, "no me dejan ampliar"). */}
      {filteredPoints.length > 0 && (
        <div className="absolute top-3 left-16 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg border shadow-md px-3 py-1.5">
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
