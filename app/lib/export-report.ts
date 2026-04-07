import ExcelJS from "exceljs"
import html2canvas from "html2canvas"

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

async function captureElement(el: HTMLElement): Promise<Buffer> {
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  })
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      blob!.arrayBuffer().then((ab) => resolve(Buffer.from(ab)))
    }, "image/png")
  })
}

async function captureCharts(containerId: string): Promise<Buffer[]> {
  const container = document.getElementById(containerId)
  if (!container) return []
  const cards = container.querySelectorAll<HTMLElement>("[data-export-chart]")
  const images: Buffer[] = []
  for (const card of Array.from(cards)) {
    try {
      const img = await captureElement(card)
      images.push(img)
    } catch {
      // Skip cards that fail to render
    }
  }
  return images
}

function addHeaderRow(ws: ExcelJS.Worksheet, tab: string, period: string) {
  ws.addRow(["REPORTE DE ENCUESTAS - DATANALISIS"])
  ws.addRow(["Sección", tabTitles[tab] || tab])
  ws.addRow(["Generado el", new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })])
  ws.addRow(["Período", periodLabels[period] || period])
  ws.addRow([])

  // Style the header
  ws.getRow(1).font = { bold: true, size: 14 }
  ws.getRow(2).font = { bold: false, size: 11 }
  ws.getRow(3).font = { bold: false, size: 11 }
  ws.getRow(4).font = { bold: false, size: 11 }
  ws.getColumn(1).width = 30
  ws.getColumn(2).width = 45
}

function styleTableHeader(ws: ExcelJS.Worksheet, rowNum: number, colCount: number) {
  const row = ws.getRow(rowNum)
  row.font = { bold: true, color: { argb: "FFFFFFFF" } }
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } }
  row.alignment = { horizontal: "center", vertical: "middle" }
  for (let c = 1; c <= colCount; c++) {
    row.getCell(c).border = {
      bottom: { style: "thin", color: { argb: "FF374151" } },
    }
  }
}

async function addChartImages(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, images: Buffer[], startRow: number) {
  let currentRow = startRow
  for (let i = 0; i < images.length; i++) {
    const imageId = wb.addImage({ buffer: images[i], extension: "png" })
    ws.addImage(imageId, {
      tl: { col: 0, row: currentRow },
      ext: { width: 750, height: 400 },
    })
    currentRow += 22 // ~22 rows per chart image
  }
  return currentRow
}

function downloadBuffer(buffer: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

// ======================== RESUMEN ========================
export async function exportSummary(data: any, period: string) {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Datanalisis"
  const summary = data.summary

  // Sheet 1: Indicadores
  const wsKpi = wb.addWorksheet("Indicadores")
  addHeaderRow(wsKpi, "summary", period)

  const kpiStartRow = 6
  wsKpi.addRow(["INDICADORES CLAVE"])
  wsKpi.getRow(kpiStartRow).font = { bold: true, size: 12 }
  wsKpi.addRow([])

  const kpiHeaderRow = kpiStartRow + 2
  wsKpi.addRow(["Indicador", "Valor"])
  styleTableHeader(wsKpi, kpiHeaderRow, 2)

  wsKpi.addRow(["Total de Respuestas", summary?.totalResponses ?? 0])
  const completed = summary ? Math.round((summary.totalResponses * summary.completionRate) / 100) : 0
  wsKpi.addRow(["Respuestas Completadas", completed])
  wsKpi.addRow(["Respuestas Incompletas", (summary?.totalResponses ?? 0) - completed])
  wsKpi.addRow(["Tasa de Finalización (%)", summary?.completionRate ?? 0])
  wsKpi.addRow(["Tiempo Promedio", summary?.avgTime || "—"])
  wsKpi.addRow(["NPS", summary?.nps ?? "Sin datos"])
  wsKpi.addRow(["Crecimiento vs período anterior (%)", summary?.responseGrowth ?? 0])

  // Sheet 2: Timeline data
  const wsTl = wb.addWorksheet("Respuestas por Tiempo")
  wsTl.addRow(["Fecha", "Cantidad de Respuestas"])
  styleTableHeader(wsTl, 1, 2)
  wsTl.getColumn(1).width = 18
  wsTl.getColumn(2).width = 25
  for (const d of summary?.responsesTimeline || []) {
    wsTl.addRow([d.date, d.count])
  }

  // Sheet 3: Status distribution
  const wsSt = wb.addWorksheet("Estado de Respuestas")
  wsSt.addRow(["Estado", "Cantidad", "Porcentaje (%)"])
  styleTableHeader(wsSt, 1, 3)
  wsSt.getColumn(1).width = 20
  wsSt.getColumn(2).width = 15
  wsSt.getColumn(3).width = 18
  wsSt.addRow(["Completadas", completed, summary?.completionRate ?? 0])
  wsSt.addRow(["Incompletas", (summary?.totalResponses ?? 0) - completed, summary ? 100 - summary.completionRate : 0])
  wsSt.addRow([])
  const totalRow = wsSt.addRow(["TOTAL", summary?.totalResponses ?? 0, 100])
  totalRow.font = { bold: true }

  // Sheet 4: Chart captures
  const chartImages = await captureCharts("export-summary")
  if (chartImages.length > 0) {
    const wsCharts = wb.addWorksheet("Gráficos")
    wsCharts.addRow(["GRÁFICOS - RESUMEN"])
    wsCharts.getRow(1).font = { bold: true, size: 14 }
    await addChartImages(wb, wsCharts, chartImages, 2)
  }

  const buffer = await wb.xlsx.writeBuffer()
  downloadBuffer(buffer, `resumen_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ======================== RESPUESTAS ========================
export async function exportResponses(data: any, period: string) {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Datanalisis"
  const breakdowns = data.responses?.questionBreakdowns || []

  // Sheet 1: Info
  const wsInfo = wb.addWorksheet("Info")
  addHeaderRow(wsInfo, "responses", period)
  wsInfo.addRow(["Total preguntas con respuestas", breakdowns.length])

  // Sheet 2: Análisis por pregunta
  const wsA = wb.addWorksheet("Análisis por Pregunta")
  wsA.addRow(["Pregunta", "Tipo", "Total Respuestas", "Opción / Valor", "Cantidad", "Porcentaje (%)"])
  styleTableHeader(wsA, 1, 6)
  wsA.getColumn(1).width = 50
  wsA.getColumn(2).width = 18
  wsA.getColumn(3).width = 18
  wsA.getColumn(4).width = 40
  wsA.getColumn(5).width = 12
  wsA.getColumn(6).width = 15

  for (const qb of breakdowns) {
    if (qb.distribution && qb.distribution.length > 0) {
      for (let i = 0; i < qb.distribution.length; i++) {
        const d = qb.distribution[i]
        wsA.addRow([
          i === 0 ? qb.text : "",
          i === 0 ? qb.type : "",
          i === 0 ? qb.totalAnswers : "",
          d.label,
          d.count,
          d.percentage,
        ])
      }
      if (qb.average) {
        wsA.addRow(["", "", "", `Promedio: ${qb.average}`, "", ""])
      }
    } else if (qb.sampleAnswers && qb.sampleAnswers.length > 0) {
      for (let i = 0; i < qb.sampleAnswers.length; i++) {
        wsA.addRow([
          i === 0 ? qb.text : "",
          i === 0 ? qb.type : "",
          i === 0 ? qb.totalAnswers : "",
          qb.sampleAnswers[i],
          "",
          "",
        ])
      }
    } else {
      wsA.addRow([qb.text, qb.type, qb.totalAnswers, "Sin datos", "", ""])
    }
    wsA.addRow([]) // separator
  }

  // Sheet 3: Distribución plana (chart-friendly)
  const wsDist = wb.addWorksheet("Distribuciones")
  wsDist.addRow(["Pregunta", "Opción", "Cantidad", "Porcentaje (%)"])
  styleTableHeader(wsDist, 1, 4)
  wsDist.getColumn(1).width = 45
  wsDist.getColumn(2).width = 35
  wsDist.getColumn(3).width = 12
  wsDist.getColumn(4).width = 15
  for (const qb of breakdowns) {
    if (qb.distribution && qb.distribution.length > 0) {
      for (const d of qb.distribution) {
        wsDist.addRow([qb.text, d.label, d.count, d.percentage])
      }
    }
  }

  // Sheet 4: Chart captures
  const chartImages = await captureCharts("export-responses")
  if (chartImages.length > 0) {
    const wsCharts = wb.addWorksheet("Gráficos")
    wsCharts.addRow(["GRÁFICOS - RESPUESTAS"])
    wsCharts.getRow(1).font = { bold: true, size: 14 }
    await addChartImages(wb, wsCharts, chartImages, 2)
  }

  const buffer = await wb.xlsx.writeBuffer()
  downloadBuffer(buffer, `respuestas_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ======================== RENDIMIENTO ========================
export async function exportPerformance(data: any, period: string) {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Datanalisis"
  const perf = data.performance

  // Sheet 1: Info
  const wsInfo = wb.addWorksheet("Info")
  addHeaderRow(wsInfo, "performance", period)

  // Sheet 2: Encuestadores
  const wsP = wb.addWorksheet("Encuestadores")
  wsP.addRow(["Encuestador", "Asignaciones", "Completadas", "Pendientes", "Tasa de Finalización (%)"])
  styleTableHeader(wsP, 1, 5)
  wsP.getColumn(1).width = 30
  wsP.getColumn(2).width = 18
  wsP.getColumn(3).width = 15
  wsP.getColumn(4).width = 15
  wsP.getColumn(5).width = 25

  let totalAssign = 0, totalCompleted = 0
  for (const s of perf?.surveyorPerformance || []) {
    const pending = s.totalAssignments - s.completedAssignments
    wsP.addRow([s.name, s.totalAssignments, s.completedAssignments, pending, s.completionRate])
    totalAssign += s.totalAssignments
    totalCompleted += s.completedAssignments
  }
  if ((perf?.surveyorPerformance?.length ?? 0) > 0) {
    wsP.addRow([])
    const tRow = wsP.addRow(["TOTAL", totalAssign, totalCompleted, totalAssign - totalCompleted,
      totalAssign > 0 ? Math.round((totalCompleted / totalAssign) * 100) : 0])
    tRow.font = { bold: true }
  }

  // Sheet 3: Distribución por día
  const wsDay = wb.addWorksheet("Respuestas por Día")
  wsDay.addRow(["Día de la Semana", "Cantidad de Respuestas"])
  styleTableHeader(wsDay, 1, 2)
  wsDay.getColumn(1).width = 22
  wsDay.getColumn(2).width = 25
  for (const d of perf?.dailyDistribution || []) {
    wsDay.addRow([d.day, d.count])
  }

  // Sheet 4: Resumen general
  const wsGen = wb.addWorksheet("Resumen Rendimiento")
  addHeaderRow(wsGen, "performance", period)
  wsGen.addRow(["RESUMEN GENERAL"])
  wsGen.getRow(6).font = { bold: true, size: 12 }
  wsGen.addRow([])
  wsGen.addRow(["Métrica", "Valor"])
  styleTableHeader(wsGen, 8, 2)
  wsGen.addRow(["Total encuestadores", perf?.surveyorPerformance?.length ?? 0])
  const avgRate = perf?.surveyorPerformance?.length > 0
    ? Math.round(perf.surveyorPerformance.reduce((s: number, p: any) => s + p.completionRate, 0) / perf.surveyorPerformance.length)
    : 0
  wsGen.addRow(["Promedio de finalización (%)", avgRate])
  wsGen.addRow(["Total respuestas en período", data.summary?.totalResponses ?? 0])
  wsGen.addRow(["Total asignaciones", totalAssign])
  wsGen.addRow(["Asignaciones completadas", totalCompleted])

  // Sheet 5: Chart captures
  const chartImages = await captureCharts("export-performance")
  if (chartImages.length > 0) {
    const wsCharts = wb.addWorksheet("Gráficos")
    wsCharts.addRow(["GRÁFICOS - RENDIMIENTO"])
    wsCharts.getRow(1).font = { bold: true, size: 14 }
    await addChartImages(wb, wsCharts, chartImages, 2)
  }

  const buffer = await wb.xlsx.writeBuffer()
  downloadBuffer(buffer, `rendimiento_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ======================== GEOGRÁFICO ========================
export async function exportGeographic(data: any, period: string) {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Datanalisis"
  const geo = data.geographic

  // Sheet 1: Info
  const wsInfo = wb.addWorksheet("Info")
  addHeaderRow(wsInfo, "geographic", period)

  // Sheet 2: Zonas detalle
  const wsZ = wb.addWorksheet("Zonas Detalle")
  wsZ.addRow(["Zona", "Asignaciones", "Completadas", "Pendientes", "Tasa de Fin. (%)", "% del Total"])
  styleTableHeader(wsZ, 1, 6)
  wsZ.getColumn(1).width = 25
  wsZ.getColumn(2).width = 15
  wsZ.getColumn(3).width = 15
  wsZ.getColumn(4).width = 15
  wsZ.getColumn(5).width = 20
  wsZ.getColumn(6).width = 15

  const totalZone = (geo?.zoneBreakdown || []).reduce((s: number, z: any) => s + z.responseCount, 0) || 1
  let tAll = 0, tComp = 0
  for (const z of geo?.zoneBreakdown || []) {
    const pending = z.responseCount - z.completedCount
    const pct = Math.round((z.responseCount / totalZone) * 100)
    wsZ.addRow([z.zone, z.responseCount, z.completedCount, pending, z.completionRate, pct])
    tAll += z.responseCount
    tComp += z.completedCount
  }
  if ((geo?.zoneBreakdown?.length ?? 0) > 0) {
    wsZ.addRow([])
    const tRow = wsZ.addRow(["TOTAL", tAll, tComp, tAll - tComp,
      tAll > 0 ? Math.round((tComp / tAll) * 100) : 0, 100])
    tRow.font = { bold: true }
  }

  // Sheet 3: Gráfico datos (chart-friendly)
  const wsChart = wb.addWorksheet("Datos Gráfico Zonas")
  wsChart.addRow(["Zona", "Asignaciones", "Completadas"])
  styleTableHeader(wsChart, 1, 3)
  wsChart.getColumn(1).width = 25
  wsChart.getColumn(2).width = 15
  wsChart.getColumn(3).width = 15
  for (const z of geo?.zoneBreakdown || []) {
    wsChart.addRow([z.zone, z.responseCount, z.completedCount])
  }

  // Sheet 4: Chart captures
  const chartImages = await captureCharts("export-geographic")
  if (chartImages.length > 0) {
    const wsCharts = wb.addWorksheet("Gráficos")
    wsCharts.addRow(["GRÁFICOS - GEOGRÁFICO"])
    wsCharts.getRow(1).font = { bold: true, size: 14 }
    await addChartImages(wb, wsCharts, chartImages, 2)
  }

  const buffer = await wb.xlsx.writeBuffer()
  downloadBuffer(buffer, `geografico_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
