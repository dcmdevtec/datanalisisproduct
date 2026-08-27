import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
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

async function captureCharts(containerId: string): Promise<ChartCapture[]> {
  const container = document.getElementById(containerId)
  if (!container) return []
  const cards = container.querySelectorAll<HTMLElement>("[data-export-chart]")
  const images: ChartCapture[] = []
  for (const card of Array.from(cards)) {
    try {
      // scale 3 (antes 2) — a mayor resolución de captura, texto más nítido
      // al imprimir la imagen a ancho completo/medio en el PDF.
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
    }
  }
  return images
}

function newDoc(): jsPDF {
  return new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" })
}

// Encabezado común: título, sección, fecha de generación y período — mismo
// contenido que antes tenía cada .xlsx en su fila de cabecera.
function addHeader(doc: jsPDF, tab: string, period: string): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFillColor(TEAL)
  doc.rect(0, 0, pageWidth, 60, "F")
  doc.setTextColor("#ffffff")
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text("Reporte de Encuestas — Datanalisis", 40, 30)
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(`${tabTitles[tab] || tab}  ·  Generado el ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}  ·  Período: ${periodLabels[period] || period}`, 40, 48)
  doc.setTextColor("#111111")
  return 80
}

// Agrega una imagen (captura de gráfico) ajustada al ancho de página,
// paginando automáticamente si no entra en lo que queda de la página actual.
function addImageFitted(doc: jsPDF, img: { dataUrl: string; width: number; height: number }, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40
  const maxWidth = pageWidth - margin * 2
  const ratio = img.height / img.width
  const w = maxWidth
  const h = w * ratio

  if (y + h > pageHeight - margin) {
    doc.addPage()
    y = margin
  }
  doc.addImage(img.dataUrl, "PNG", margin, y, w, h)
  return y + h + 16
}

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y > pageHeight - 60) { doc.addPage(); y = 40 }
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(TEAL)
  doc.text(title, 40, y)
  doc.setTextColor("#111111")
  doc.setFont("helvetica", "normal")
  return y + 20
}

function download(doc: jsPDF, filename: string) {
  doc.save(filename)
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
export async function exportSummary(data: any, period: string) {
  const contentWidth = 750
  const margin = 40
  const gap = 16
  const pageWidth = contentWidth + margin * 2

  const chartImages = await captureCharts("export-summary")
  const rows = layoutRows(chartImages, contentWidth, gap)
  const rowsTotalHeight = rows.reduce((sum, row) => sum + row.height + gap, 0)

  const headerHeight = 80
  const bottomMargin = 40
  const totalHeight = Math.ceil(headerHeight + rowsTotalHeight + bottomMargin)

  const doc = new jsPDF({ unit: "pt", format: [pageWidth, Math.max(totalHeight, 200)] })

  let y = addHeader(doc, "summary", period)

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

  download(doc, `resumen_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ======================== ANÁLISIS DE RESULTADOS ========================
export async function exportResponses(data: any, period: string) {
  const doc = newDoc()
  let y = addHeader(doc, "responses", period)
  const breakdowns = data.responses?.questionBreakdowns || []

  y = addSectionTitle(doc, `Análisis por pregunta (${breakdowns.length})`, y)

  const rows: (string | number)[][] = []
  for (const qb of breakdowns) {
    if (qb.distribution && qb.distribution.length > 0) {
      qb.distribution.forEach((d: any, i: number) => {
        rows.push([i === 0 ? qb.text : "", i === 0 ? qb.type : "", d.label, d.count, formatPercent(d.percentage)])
      })
    } else if (qb.sampleAnswers && qb.sampleAnswers.length > 0) {
      qb.sampleAnswers.forEach((s: string, i: number) => {
        rows.push([i === 0 ? qb.text : "", i === 0 ? qb.type : "", s, "", ""])
      })
    } else {
      rows.push([qb.text, qb.type, "Sin datos", "", ""])
    }
  }
  autoTable(doc, {
    startY: y,
    margin: { left: 40, right: 40 },
    head: [["Pregunta", "Tipo", "Opción / Valor", "Cantidad", "%"]],
    body: rows,
    headStyles: { fillColor: [24, 176, 164] },
    styles: { fontSize: 8, cellWidth: "wrap" },
    columnStyles: { 0: { cellWidth: 160 }, 2: { cellWidth: 160 } },
  })
  y = (doc as any).lastAutoTable.finalY + 24

  const chartImages = await captureCharts("export-responses")
  if (chartImages.length > 0) {
    y = addSectionTitle(doc, "Gráficos", y)
    for (const img of chartImages) y = addImageFitted(doc, img, y)
  }

  download(doc, `analisis_resultados_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ======================== RENDIMIENTO ========================
export async function exportPerformance(data: any, period: string) {
  const doc = newDoc()
  let y = addHeader(doc, "performance", period)
  const perf = data.performance

  y = addSectionTitle(doc, "Encuestadores", y)
  let totalAssign = 0, totalCompleted = 0
  const rows = (perf?.surveyorPerformance || []).map((s: any) => {
    const pending = s.totalAssignments - s.completedAssignments
    totalAssign += s.totalAssignments
    totalCompleted += s.completedAssignments
    return [s.name, s.totalAssignments, s.completedAssignments, pending, formatPercent(s.completionRate)]
  })
  autoTable(doc, {
    startY: y,
    margin: { left: 40, right: 40 },
    head: [["Encuestador", "Asignaciones", "Completadas", "Pendientes", "Tasa"]],
    body: rows,
    foot: rows.length > 0 ? [["TOTAL", totalAssign, totalCompleted, totalAssign - totalCompleted, totalAssign > 0 ? formatPercent(Math.round((totalCompleted / totalAssign) * 1000) / 10) : "0%"]] : undefined,
    headStyles: { fillColor: [24, 176, 164] },
    footStyles: { fillColor: [230, 247, 246], textColor: [17, 17, 17], fontStyle: "bold" },
    styles: { fontSize: 9 },
  })
  y = (doc as any).lastAutoTable.finalY + 24

  y = addSectionTitle(doc, "Respuestas por día de la semana", y)
  autoTable(doc, {
    startY: y,
    margin: { left: 40, right: 40 },
    head: [["Día", "Cantidad de Respuestas"]],
    body: (perf?.dailyDistribution || []).map((d: any) => [d.day, d.count]),
    headStyles: { fillColor: [24, 176, 164] },
    styles: { fontSize: 9 },
  })
  y = (doc as any).lastAutoTable.finalY + 24

  const chartImages = await captureCharts("export-performance")
  if (chartImages.length > 0) {
    y = addSectionTitle(doc, "Gráficos", y)
    for (const img of chartImages) y = addImageFitted(doc, img, y)
  }

  download(doc, `rendimiento_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ======================== GEOGRÁFICO ========================
export async function exportGeographic(data: any, period: string) {
  const doc = newDoc()
  let y = addHeader(doc, "geographic", period)
  const geo = data.geographic

  y = addSectionTitle(doc, "Zonas — detalle", y)
  const totalZone = (geo?.zoneBreakdown || []).reduce((s: number, z: any) => s + z.responseCount, 0) || 1
  let tAll = 0, tComp = 0
  const rows = (geo?.zoneBreakdown || []).map((z: any) => {
    const pending = z.responseCount - z.completedCount
    const pct = Math.round((z.responseCount / totalZone) * 1000) / 10
    tAll += z.responseCount
    tComp += z.completedCount
    return [z.zone, z.responseCount, z.completedCount, pending, formatPercent(z.completionRate), formatPercent(pct)]
  })
  autoTable(doc, {
    startY: y,
    margin: { left: 40, right: 40 },
    head: [["Zona", "Asignaciones", "Completadas", "Pendientes", "Tasa Fin.", "% Total"]],
    body: rows,
    foot: rows.length > 0 ? [["TOTAL", tAll, tComp, tAll - tComp, tAll > 0 ? formatPercent(Math.round((tComp / tAll) * 1000) / 10) : "0%", "100,0%"]] : undefined,
    headStyles: { fillColor: [24, 176, 164] },
    footStyles: { fillColor: [230, 247, 246], textColor: [17, 17, 17], fontStyle: "bold" },
    styles: { fontSize: 9 },
  })
  y = (doc as any).lastAutoTable.finalY + 24

  const chartImages = await captureCharts("export-geographic")
  if (chartImages.length > 0) {
    y = addSectionTitle(doc, "Mapa y gráficos", y)
    for (const img of chartImages) y = addImageFitted(doc, img, y)
  }

  download(doc, `geografico_${new Date().toISOString().slice(0, 10)}.pdf`)
}
