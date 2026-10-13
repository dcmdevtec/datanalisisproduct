import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { formatPercent } from "@/lib/format"

// Antes esto generaba un .xlsx con ExcelJS (el botón decía "Descargar Excel"
// y el cliente pidió explícitamente que los exportados de reportes sean PDF,
// no Excel). Se reemplaza por jsPDF + jspdf-autotable para las tablas, y se
// reusa el mismo html2canvas de antes para capturar las gráficas ya
// renderizadas en pantalla (recharts no tiene una vía directa a PDF).

const periodLabels: Record<string, string> = {
  week: "Última semana",
  month: "Último mes",
  quarter: "Último trimestre",
  year: "Último año",
  all: "Todo el tiempo",
}

const tabTitles: Record<string, string> = {
  summary: "Resumen General",
  responses: "Análisis de Respuestas",
  performance: "Rendimiento de Encuestadores",
  geographic: "Análisis Geográfico",
}

const TEAL = "#18b0a4"

interface ChartCapture {
  dataUrl: string
  width: number
  height: number
  // "half" = pensada para ir en pareja lado a lado en el PDF (ver
  // data-export-layout="half" en components/reports/summary-content.tsx);
  // por defecto ("full") ocupa todo el ancho.
  layout: "full" | "half"
  // Tope opcional de ancho en pt (data-export-max-width) — para gráficos que
  // no deben estirarse a todo su carril (ej. el donut de "Distribución por
  // Tipo", que a la mitad del ancho de página se veía desproporcionado).
  maxWidth?: number
  // Leyenda a redibujar con texto real de jsPDF (ver data-export-legend) —
  // el html2canvas capturado YA NO incluye esta leyenda (se le puso
  // data-html2canvas-ignore en question-chart.tsx) porque el motor de
  // captura no medía bien ese texto (quedaba superpuesto con el punto de
  // color). Texto de jsPDF siempre sale nítido, sin depender de captura.
  legend?: { label: string; count: number; percentage: number; color: string }[]
}

// Ítem 15/09/2026: tras varias vueltas intentando que html2canvas capture
// bien el pane SVG de Leaflet (zonas/puntos/rutas) dentro del mapa
// exportado — el renderer por defecto lo pierde o lo dibuja "fantasma" en
// una posición equivocada; foreignObjectRendering lo resuelve pero no
// siempre trae los tiles de red, y combinar ambas pasadas resultó frágil
// (ver historial completo en git log de este archivo) — se abandonó por
// completo esa vía. components/reports-geo-map.tsx ahora dibuja las
// zonas/puntos/rutas a mano con Canvas 2D (ver drawOverlayCanvas ahí,
// usando `map.latLngToContainerPoint()` — la misma matemática que Leaflet
// usa internamente) sobre un <canvas> plano, sin ningún CSS transform
// propio. Eso deja a la tarjeta del mapa con el mismo tipo de contenido que
// cualquier otra tarjeta (imágenes + un canvas + divs planos), que
// html2canvas en su modo normal ya capturaba de forma confiable en todas
// las pruebas — ya no necesita ningún tratamiento especial.
async function captureCharts(containerId: string): Promise<ChartCapture[]> {
  const container = document.getElementById(containerId)
  if (!container) return []
  const cards = container.querySelectorAll<HTMLElement>("[data-export-chart]")
  const images: ChartCapture[] = []
  for (const card of Array.from(cards)) {
    // Ítem "la tabla sale incompleta, los nombres salen cortos" (13/10/2026):
    // las tablas anchas de Reportes (Rendimiento por Encuestador/Encuesta,
    // ambas con muchas columnas) envuelven su <table> en un div
    // "overflow-x-auto" para poder scrollear en pantalla cuando no caben
    // todas las columnas — pero html2canvas NO captura lo que queda fuera
    // de vista dentro de un contenedor con overflow (lo recorta igual que
    // lo haría un navegador real), así que el PDF salía con la tabla
    // cortada según en qué posición de scroll hubiera quedado.
    //
    // Agrandar SOLO el wrapper (width: scrollWidth + overflow: visible) NO
    // alcanza — comprobado aparte con una captura aislada (Playwright +
    // html2canvas real): en flujo de bloque normal, un hijo más ancho que
    // su contenedor NO hace crecer al contenedor (el padre se queda en su
    // "width: auto" = ancho de SU propio contenedor, el hijo solo se ve
    // desbordado) — y html2canvas dimensiona el canvas según la caja del
    // elemento que se le pasa (acá `card`, no el wrapper), así que seguía
    // recortando exactamente igual. Hay que agrandar TAMBIÉN `card` mismo a
    // su ancho de contenido real (width: max-content) para que html2canvas
    // capture esa caja ya crecida — confirmado con la misma prueba aislada
    // (sin esto: recorta igual que antes; con esto: la tabla completa sale
    // en la captura, sin cortar nada a los lados).
    const scrollWrappers = card.querySelectorAll<HTMLElement>(".overflow-x-auto")
    const restoreWrappers: (() => void)[] = []
    if (scrollWrappers.length > 0) {
      const prevCardWidth = card.style.width
      card.style.width = "max-content"
      restoreWrappers.push(() => { card.style.width = prevCardWidth })
    }
    for (const wrapper of Array.from(scrollWrappers)) {
      const prevWidth = wrapper.style.width
      const prevOverflow = wrapper.style.overflow
      const prevScrollLeft = wrapper.scrollLeft
      wrapper.style.width = `${wrapper.scrollWidth}px`
      wrapper.style.overflow = "visible"
      wrapper.scrollLeft = 0
      restoreWrappers.push(() => {
        wrapper.style.width = prevWidth
        wrapper.style.overflow = prevOverflow
        wrapper.scrollLeft = prevScrollLeft
      })
    }
    try {
      const canvas = await html2canvas(card, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        scrollX: 0,
        scrollY: 0,
      })
      const layout = card.getAttribute("data-export-layout") === "half" ? "half" : "full"
      const maxWidthAttr = card.getAttribute("data-export-max-width")
      const maxWidth = maxWidthAttr ? Number(maxWidthAttr) : undefined
      const legendAttr = card.getAttribute("data-export-legend")
      let legend: ChartCapture["legend"]
      if (legendAttr) {
        try { legend = JSON.parse(legendAttr) } catch { legend = undefined }
      }
      images.push({ dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height, layout, maxWidth, legend })
    } catch {
      // Skip cards that fail to render
    } finally {
      restoreWrappers.forEach((fn) => fn())
    }
  }
  return images
}

function newDoc(orientation: "portrait" | "landscape" = "portrait"): jsPDF {
  return new jsPDF({ orientation, unit: "pt", format: "a4" })
}

// Encabezado común: título, sección, encuesta filtrada, fecha de generación
// y período — mismo contenido que antes tenía cada .xlsx en su fila de
// cabecera. Centrado (antes salía pegado a la izquierda, "corrido") y ahora
// incluye el nombre de la encuesta cuando el filtro no está en "Todas las
// encuestas" (acta 07/09/2026, ítem #16: "no aparece el título de la Encuesta,
// además se puede centrar un poco más").
// Ítem 15/09/2026: "no muestra en el encabezado el nombre del encuestador"
// — cuando el filtro "Encuestador" (arriba de la página, distinto del
// selector de ruta dentro del mapa) está en uno puntual, el encabezado solo
// mostraba la encuesta, nunca a quién correspondía. `surveyorName` se suma
// a la misma línea de metadatos (tab · encuesta/todas · encuestador ·
// generado · período) en vez de agregar una fila nueva al banner, para no
// tener que recalcular bannerHeight en los 4 exports que ya llaman a esto.
function addHeader(doc: jsPDF, tab: string, period: string, surveyTitle?: string | null, surveyorName?: string | null): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const centerX = pageWidth / 2
  const bannerHeight = surveyTitle ? 74 : 60
  doc.setFillColor(TEAL)
  doc.rect(0, 0, pageWidth, bannerHeight, "F")
  doc.setTextColor("#ffffff")
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text("Reporte de Encuestas — Datanalisis", centerX, 24, { align: "center" })
  let subY = 40
  if (surveyTitle) {
    doc.setFontSize(12)
    doc.text(surveyTitle, centerX, subY, { align: "center", maxWidth: pageWidth - 80 })
    subY += 18
  }
  doc.setFontSize(9.5)
  doc.setFont("helvetica", "normal")
  const scopeLabel = surveyTitle ? "" : "Todas las encuestas  ·  "
  const surveyorLabel = surveyorName ? `Encuestador: ${surveyorName}  ·  ` : ""
  doc.text(
    `${tabTitles[tab] || tab}  ·  ${scopeLabel}${surveyorLabel}Generado el ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}  ·  Período: ${periodLabels[period] || period}`,
    centerX, subY, { align: "center" }
  )
  doc.setTextColor("#111111")
  return bannerHeight + 20
}

// Agrega una imagen (captura de gráfico) ajustada al ancho de página,
// paginando automáticamente si no entra en lo que queda de la página actual.
//
// Ítem 09/09/2026: los gráficos de torta/anillo excluyen su leyenda de la
// captura de html2canvas (ver data-html2canvas-ignore en question-chart.tsx)
// porque el motor de captura no medía bien ese texto — hasta ahora solo
// exportSummary() sabía redibujarla con texto real de jsPDF a partir de
// `legend` (ChartCapture), así que en "Análisis de Resultados", "Rendimiento"
// y "Geográfico" esas tarjetas salían SIN leyenda ("componentes salen
// corto"). Mismo criterio acá: si la captura trae `legend`, se dibuja debajo
// de la imagen con drawNativeLegend + un marco de tarjeta, igual que
// exportSummary(). `maxWidth` (si la captura lo trae, ver
// data-export-max-width) limita el ancho de dibujo para no estirar de más
// donuts angostos — se centra dentro del ancho de página disponible.
function addImageFitted(doc: jsPDF, img: ChartCapture, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40
  const maxContentWidth = pageWidth - margin * 2
  const w = Math.min(maxContentWidth, img.maxWidth ?? maxContentWidth)
  const xOffset = margin + (maxContentWidth - w) / 2
  const ratio = img.height / img.width
  const h = w * ratio
  const legendH = legendHeight(img)
  const totalH = h + legendH

  if (y + totalH > pageHeight - margin) {
    doc.addPage()
    y = margin
  }
  doc.addImage(img.dataUrl, "PNG", xOffset, y, w, h)
  if (img.legend?.length) {
    // Sin el marco extra que sí dibuja exportSummary(): acá la imagen
    // capturada YA trae su propio borde de tarjeta (el div data-export-chart
    // de question-card.tsx tiene className con borde, a diferencia del div
    // "pelado" que arma summary-content.tsx para su donut) — agregar otro
    // marco encima duplicaría el borde.
    drawNativeLegend(doc, img.legend, xOffset + 16, y + h + LEGEND_TOP_GAP, w - 32)
  }
  return y + totalH + 16
}

function download(doc: jsPDF, filename: string) {
  doc.save(filename)
}

// Ítem "Importante el nombre de los archivos PDF's" (acta de ajustes
// 05/10/2026): "RESUMEN – [NOMBRE DEL PROYECTO] - [COD INTERNO]" (y
// equivalentes para ANÁLISIS DE RESULTADOS/RENDIMIENTO/GEOGRÁFICO). Antes
// era solo "resumen_2026-10-06.pdf" sin identificar a qué proyecto/encuesta
// corresponde. Cuando no hay un proyecto/encuesta específico seleccionado
// (filtro en "Todas"), cae de vuelta al nombre genérico con fecha.
function buildExportFilename(prefix: string, projectName?: string | null, surveyCode?: string | null): string {
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "").trim()
  if (!projectName && !surveyCode) {
    return `${prefix.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}_${new Date().toISOString().slice(0, 10)}.pdf`
  }
  const parts = [prefix]
  if (projectName) parts.push(safe(projectName))
  if (surveyCode) parts.push(safe(surveyCode))
  return `${parts.join(" - ")}.pdf`
}

// Agrupa las capturas en filas: dos "half" consecutivas van lado a lado
// (horizontal); "full" (o una "half" que quedó sola, sin pareja) ocupa toda
// la fila. Calcula de una vez el alto de cada fila para poder dimensionar la
// página exacta antes de dibujar nada.
// Alto por fila de leyenda dibujada con jsPDF (texto real) + separación
// respecto de la imagen del gráfico.
const LEGEND_ROW_HEIGHT = 16
const LEGEND_TOP_GAP = 12

function legendHeight(img: ChartCapture): number {
  return img.legend?.length ? LEGEND_TOP_GAP + img.legend.length * LEGEND_ROW_HEIGHT : 0
}

function layoutRows(images: ChartCapture[], contentWidth: number, gap: number) {
  // slotWidths = ancho del "carril" asignado (para avanzar el cursor X y
  // centrar); drawWidths = ancho real de dibujo, recortado por maxWidth si
  // la imagen trae uno (ver data-export-max-width). height incluye el
  // espacio para la leyenda nativa (legendHeight) si la imagen trae una.
  const rows: { imgs: ChartCapture[]; slotWidths: number[]; drawWidths: number[]; height: number }[] = []
  let i = 0
  while (i < images.length) {
    const cur = images[i]
    const next = images[i + 1]
    if (cur.layout === "half" && next?.layout === "half") {
      const halfWidth = (contentWidth - gap) / 2
      const drawW1 = Math.min(halfWidth, cur.maxWidth ?? halfWidth)
      const drawW2 = Math.min(halfWidth, next.maxWidth ?? halfWidth)
      const h1 = drawW1 * (cur.height / cur.width) + legendHeight(cur)
      const h2 = drawW2 * (next.height / next.width) + legendHeight(next)
      rows.push({ imgs: [cur, next], slotWidths: [halfWidth, halfWidth], drawWidths: [drawW1, drawW2], height: Math.max(h1, h2) })
      i += 2
    } else {
      const drawW = Math.min(contentWidth, cur.maxWidth ?? contentWidth)
      const h = drawW * (cur.height / cur.width) + legendHeight(cur)
      rows.push({ imgs: [cur], slotWidths: [contentWidth], drawWidths: [drawW], height: h })
      i += 1
    }
  }
  return rows
}

// Dibuja una leyenda con texto real de jsPDF (círculo de color + label +
// cantidad/porcentaje) — nunca queda "corrida" como pasaba capturando el
// HTML con html2canvas, porque no depende de ningún motor de captura.
function drawNativeLegend(doc: jsPDF, legend: NonNullable<ChartCapture["legend"]>, x: number, y: number, width: number) {
  doc.setFontSize(10)
  for (const item of legend) {
    const rowY = y + LEGEND_ROW_HEIGHT / 2
    doc.setFillColor(item.color)
    doc.circle(x + 5, rowY, 4, "F")
    doc.setFont("helvetica", "normal")
    doc.setTextColor("#64748b") // slate-500, mismo tono que text-muted-foreground
    doc.text(item.label, x + 14, rowY + 3.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor("#111111")
    const valueText = `${item.count} (${formatPercent(item.percentage)})`
    doc.text(valueText, x + width, rowY + 3.5, { align: "right" })
    y += LEGEND_ROW_HEIGHT
  }
  doc.setFont("helvetica", "normal")
  doc.setTextColor("#111111")
}

// ======================== RESUMEN ========================
// A pedido del cliente: sin la tabla de indicadores (solo los gráficos),
// los gráficos que van en pareja en pantalla (ej. "Registros no efectivos" +
// "Incidencias por motivo") van lado a lado en el PDF también — no apilados
// — y todo en UNA sola página (sin paginación). La página se dimensiona a
// medida del contenido real en vez de usar A4 fijo, calculando el alto total
// ANTES de crear el documento (las imágenes ya traen su tamaño real desde
// html2canvas a scale:3, para que el texto salga nítido).
export async function exportSummary(data: any, period: string, surveyTitle?: string | null, projectName?: string | null, surveyCode?: string | null) {
  const contentWidth = 750
  const margin = 40
  const gap = 16
  const pageWidth = contentWidth + margin * 2

  const chartImages = await captureCharts("export-summary")
  const rows = layoutRows(chartImages, contentWidth, gap)
  const rowsTotalHeight = rows.reduce((sum, row) => sum + row.height + gap, 0)

  // El banner crece ~34pt cuando se muestra el nombre de la encuesta (ver
  // addHeader) — hay que reservarle el mismo espacio acá, porque esta página
  // se dimensiona a medida ANTES de dibujar nada.
  const headerHeight = surveyTitle ? 114 : 80
  const bottomMargin = 40
  const totalHeight = Math.ceil(headerHeight + rowsTotalHeight + bottomMargin)

  const doc = new jsPDF({ unit: "pt", format: [pageWidth, Math.max(totalHeight, 200)] })

  let y = addHeader(doc, "summary", period, surveyTitle)

  for (const row of rows) {
    let x = margin
    for (let j = 0; j < row.imgs.length; j++) {
      const img = row.imgs[j]
      const slotW = row.slotWidths[j]
      const drawW = row.drawWidths[j]
      const h = drawW * (img.height / img.width)
      // Si el ancho de dibujo quedó recortado (maxWidth), centrar dentro del carril.
      const xOffset = (slotW - drawW) / 2
      if (img.legend?.length) {
        // Un solo marco (borde + esquinas redondeadas, estilo shadcn Card)
        // detrás de imagen + leyenda, para que se vean como UNA sola
        // tarjeta — la imagen capturada ya no trae su propio borde (ver
        // comentario en components/reports/summary-content.tsx), así que
        // sin esto la leyenda quedaba flotando suelta debajo del recuadro.
        const cardH = h + legendHeight(img) - LEGEND_TOP_GAP + 16
        doc.setDrawColor("#e5e7eb")
        doc.setFillColor("#ffffff")
        doc.setLineWidth(1)
        doc.roundedRect(x + xOffset, y, drawW, cardH, 10, 10, "FD")
      }
      doc.addImage(img.dataUrl, "PNG", x + xOffset, y, drawW, h)
      if (img.legend?.length) {
        drawNativeLegend(doc, img.legend, x + xOffset + 16, y + h + LEGEND_TOP_GAP, drawW - 32)
      }
      x += slotW + gap
    }
    y += row.height + gap
  }

  download(doc, buildExportFilename("RESUMEN", projectName, surveyCode))
}

// ======================== ANÁLISIS DE RESULTADOS ========================
// Ítem "la idea es que se exporte siempre lo de cada pantalla" (13/10/2026):
// esta función armaba su PROPIA tabla "Análisis por pregunta" combinando
// todas las preguntas en una sola tabla — contenido que no existe así en
// pantalla (ahí cada pregunta es su propia tarjeta, con su gráfico y,
// opcionalmente, su propia tabla — ver questionSettings/showTable en
// app/reports/page.tsx). captureCharts() ya captura esas tarjetas tal cual
// se ven (cada una con data-export-chart, ver components/reports/question-card.tsx)
// — la tabla combinada aparte era contenido EXTRA que no está en la pantalla,
// así que se quita: el PDF ahora es exactamente las tarjetas de preguntas,
// ni más ni menos.
export async function exportResponses(data: any, period: string, surveyTitle?: string | null, projectName?: string | null, surveyCode?: string | null) {
  const doc = newDoc()
  let y = addHeader(doc, "responses", period, surveyTitle)

  const chartImages = await captureCharts("export-responses")
  for (const img of chartImages) y = addImageFitted(doc, img, y)

  download(doc, buildExportFilename("ANÁLISIS DE RESULTADOS", projectName, surveyCode))
}

// ======================== RENDIMIENTO ========================
// Ítem "la idea es que se exporte siempre lo de cada pantalla" (13/10/2026):
// esta función armaba DOS tablas propias — "Encuestadores" (esquema viejo:
// Asignaciones/Completadas/Pendientes, de antes del rediseño de Rendimiento
// por Encuestador) y "Respuestas por día de la semana" (duplicado del
// gráfico "Actividad por Día de la Semana" que ya se ve en pantalla) — que
// no coinciden con lo que de verdad está en la pantalla. Se quitan: ahora
// el PDF es exactamente las tarjetas de Rendimiento (por Encuestador, por
// Encuesta, Actividad por Día) tal como las captura captureCharts().
export async function exportPerformance(data: any, period: string, surveyTitle?: string | null, projectName?: string | null, surveyCode?: string | null) {
  const doc = newDoc()
  let y = addHeader(doc, "performance", period, surveyTitle)

  const chartImages = await captureCharts("export-performance")
  for (const img of chartImages) y = addImageFitted(doc, img, y)

  download(doc, buildExportFilename("RENDIMIENTO", projectName, surveyCode))
}

// ======================== GEOGRÁFICO ========================
export async function exportGeographic(data: any, period: string, surveyTitle?: string | null, surveyorName?: string | null, projectName?: string | null, surveyCode?: string | null) {
  // Horizontal (antes portrait, igual que las demás pestañas): el mapa es
  // contenido ancho por naturaleza — en A4 vertical quedaba angosto/pequeño.
  // Ítem #33 (acta 07/09/2026): "se puede mejorar la descarga del PDF, más
  // grande".
  const doc = newDoc("landscape")
  let y = addHeader(doc, "geographic", period, surveyTitle, surveyorName)

  // Ítem "la idea es que se exporte siempre lo de cada pantalla" (13/10/2026):
  // acá había además una tabla propia "Zonas — detalle" (Asignaciones/
  // Completadas/Pendientes/Tasa Fin./% Total) que no coincide con la tabla
  // "Comparativa por Zona" que sí está en pantalla (Zona/Asignaciones/
  // Completadas/Tasa, ver app/reports/page.tsx) — contenido extra que no
  // está en la pantalla. Se quita: captureCharts() ya captura esa tarjeta
  // tal como se ve, junto con el mapa y el resto de tarjetas de esta pestaña.
  const chartImages = await captureCharts("export-geographic")
  for (const img of chartImages) y = addImageFitted(doc, img, y)

  download(doc, buildExportFilename("GEOGRÁFICO", projectName, surveyCode))
}
