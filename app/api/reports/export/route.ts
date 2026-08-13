import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server"
import * as XLSX from "xlsx"
import { requireRole } from "@/lib/api-auth"

function extractValue(val: any): string {
  if (val === null || val === undefined) return ""
  if (typeof val === "string") return val
  if (typeof val === "number" || typeof val === "boolean") return String(val)
  if (Array.isArray(val)) return val.map(extractValue).join(", ")
  if (typeof val === "object") {
    if (val.value !== undefined) return extractValue(val.value)
    if (val.label !== undefined) return extractValue(val.label)
    if (val.text !== undefined) return extractValue(val.text)
    if (val.option !== undefined) return extractValue(val.option)
    const vals = Object.values(val).filter((v) => v !== null && v !== undefined && v !== "")
    if (vals.length > 0) return vals.map(extractValue).join(", ")
    return ""
  }
  return String(val)
}

const periodLabels: Record<string, string> = {
  week: "Última semana", month: "Último mes", quarter: "Último trimestre", year: "Último año", all: "Todo el tiempo"
}

const tabLabels: Record<string, string> = {
  summary: "Resumen", responses: "Respuestas", performance: "Rendimiento", geographic: "Geográfico"
}

function makeHeaderSheet(wb: XLSX.WorkBook, tab: string, period: string) {
  const info = [
    ["REPORTE DE ENCUESTAS - DATANALISIS"],
    ["Sección", tabLabels[tab] || tab],
    ["Generado el", new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })],
    ["Período", periodLabels[period] || period],
  ]
  const ws = XLSX.utils.aoa_to_sheet(info)
  ws["!cols"] = [{ wch: 20 }, { wch: 45 }]
  return ws
}

function sendWorkbook(wb: XLSX.WorkBook, filename: string) {
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

// SEGURIDAD (auditoría 2026-07-29): verificaba sesión pero no rol.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(["admin", "supervisor"])
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const companyFilter = searchParams.get("company") || "all"
    const projectFilter = searchParams.get("project") || "all"
    const surveyFilter = searchParams.get("survey") || "all"
    const periodFilter = searchParams.get("period") || "month"
    const tab = searchParams.get("tab") || "summary"

    const admin = createAdminSupabase()

    // Date range
    const now = new Date()
    let dateFrom: Date | null = null
    switch (periodFilter) {
      case "week": dateFrom = new Date(now.getTime() - 7 * 86400000); break
      case "month": dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break
      case "quarter": dateFrom = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break
      case "year": dateFrom = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break
    }

    // Cascading filter resolution
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allProjects } = await (admin as any).from("projects").select("id, name, company_id, companies(name)").order("name")
    const { data: allSurveys } = await admin.from("surveys").select("id, title, project_id").order("created_at", { ascending: false })

    let filteredSurveyIds: string[] | null = null
    if (surveyFilter !== "all") {
      filteredSurveyIds = [surveyFilter]
    } else if (projectFilter !== "all") {
      filteredSurveyIds = (allSurveys || []).filter((s: any) => s.project_id === projectFilter).map((s: any) => s.id)
    } else if (companyFilter !== "all") {
      const companyProjectIds = (allProjects || []).filter((p: any) => p.company_id === companyFilter).map((p: any) => p.id)
      filteredSurveyIds = (allSurveys || []).filter((s: any) => companyProjectIds.includes(s.project_id)).map((s: any) => s.id)
    }

    if (filteredSurveyIds !== null && filteredSurveyIds.length === 0) {
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["No hay datos para los filtros seleccionados"]]), "Info")
      return sendWorkbook(wb, "reporte_vacio.xlsx")
    }

    const dateStr = new Date().toISOString().slice(0, 10)
    const wb = XLSX.utils.book_new()

    // ==================== RESUMEN ====================
    if (tab === "summary") {
      // Fetch responses for summary
      let rq = admin.from("responses").select("id, survey_id, created_at, completed_at, status")
      if (filteredSurveyIds !== null) rq = rq.in("survey_id", filteredSurveyIds)
      if (dateFrom) rq = rq.gte("created_at", dateFrom.toISOString())
      const { data: responses } = await rq.order("created_at", { ascending: false })

      const totalResponses = responses?.length ?? 0
      const completedResponses = responses?.filter((r: any) => r.status === "completed").length ?? 0
      const incompleteResponses = totalResponses - completedResponses
      const completionRate = totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 100) : 0

      const timeDiffs: number[] = []
      for (const r of responses || []) {
        if (r.completed_at && r.created_at) {
          const diff = (new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()) / 1000
          if (diff > 0 && diff < 7200) timeDiffs.push(diff)
        }
      }
      const avgTimeSec = timeDiffs.length > 0 ? Math.round(timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length) : 0

      // Sheet: header + KPIs
      XLSX.utils.book_append_sheet(wb, makeHeaderSheet(wb, tab, periodFilter), "Info")

      const kpiData = [
        ["INDICADORES CLAVE"],
        ["Indicador", "Valor"],
        ["Total de Respuestas", totalResponses],
        ["Respuestas Completadas", completedResponses],
        ["Respuestas Incompletas", incompleteResponses],
        ["Tasa de Finalización", `${completionRate}%`],
        ["Tiempo Promedio", `${Math.floor(avgTimeSec / 60)}:${String(avgTimeSec % 60).padStart(2, "0")} min`],
      ]
      const wsKpi = XLSX.utils.aoa_to_sheet(kpiData)
      wsKpi["!cols"] = [{ wch: 30 }, { wch: 20 }]
      XLSX.utils.book_append_sheet(wb, wsKpi, "Indicadores")

      // Sheet: Responses timeline (chart data)
      const timelineCounts: Record<string, number> = {}
      for (const r of responses || []) {
        const d = new Date(r.created_at).toISOString().slice(0, 10)
        timelineCounts[d] = (timelineCounts[d] || 0) + 1
      }
      const timelineRows: any[][] = [["Fecha", "Respuestas"]]
      for (const [date, count] of Object.entries(timelineCounts).sort()) {
        timelineRows.push([date, count])
      }
      const wsTl = XLSX.utils.aoa_to_sheet(timelineRows)
      wsTl["!cols"] = [{ wch: 15 }, { wch: 15 }]
      XLSX.utils.book_append_sheet(wb, wsTl, "Respuestas por Tiempo")

      // Sheet: Status distribution (chart data)
      const statusRows: any[][] = [
        ["DISTRIBUCIÓN POR ESTADO"],
        ["Estado", "Cantidad", "Porcentaje"],
        ["Completadas", completedResponses, `${completionRate}%`],
        ["Incompletas", incompleteResponses, `${totalResponses > 0 ? 100 - completionRate : 0}%`],
        [],
        ["Total", totalResponses, "100%"],
      ]
      const wsSt = XLSX.utils.aoa_to_sheet(statusRows)
      wsSt["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, wsSt, "Estado de Respuestas")

      return sendWorkbook(wb, `resumen_${dateStr}.xlsx`)
    }

    // ==================== RESPUESTAS ====================
    if (tab === "responses") {
      let rq = admin.from("responses").select(
        "id, survey_id, created_at, completed_at, status, respondent_name, respondent_document_type, respondent_document_number, surveys(title, project_id)"
      )
      if (filteredSurveyIds !== null) rq = rq.in("survey_id", filteredSurveyIds)
      if (dateFrom) rq = rq.gte("created_at", dateFrom.toISOString())
      const { data: responses } = await rq.order("created_at", { ascending: false })

      const responseIds = (responses || []).map((r: any) => r.id)
      let answers: any[] = []
      if (responseIds.length > 0) {
        const batchSize = 200
        for (let i = 0; i < responseIds.length; i += batchSize) {
          const batch = responseIds.slice(i, i + batchSize)
          const { data: ba } = await admin
            .from("answers")
            .select("id, response_id, question_id, value, questions(id, text, type, survey_id, section_id, order_num)")
            .in("response_id", batch)
            .limit(10000)
          if (ba) answers.push(...ba.filter((a: any) => a.questions !== null))
        }
      }

      const projectMap: Record<string, { name: string; company: string }> = {}
      for (const p of allProjects || []) {
        projectMap[p.id] = { name: p.name, company: (p.companies as any)?.name || "" }
      }
      const surveyTitleMap: Record<string, string> = {}
      for (const s of allSurveys || []) surveyTitleMap[s.id] = s.title

      // Build question list
      const questionList: { id: string; text: string; type: string; order: number }[] = []
      const questionSet = new Set<string>()
      for (const a of answers) {
        const q = a.questions
        if (q && !questionSet.has(q.id)) {
          questionSet.add(q.id)
          questionList.push({ id: q.id, text: q.text || "Sin texto", type: q.type, order: q.order_num || 0 })
        }
      }
      questionList.sort((a, b) => a.order - b.order)

      // Group answers by response
      const answersByResponse: Record<string, Record<string, string>> = {}
      for (const a of answers) {
        if (!answersByResponse[a.response_id]) answersByResponse[a.response_id] = {}
        answersByResponse[a.response_id][a.question_id] = extractValue(a.value)
      }

      XLSX.utils.book_append_sheet(wb, makeHeaderSheet(wb, tab, periodFilter), "Info")

      // Sheet: Respuestas Detalladas
      const headers = ["#", "Encuesta", "Proyecto", "Empresa", "Encuestado", "Documento", "# Documento", "Estado", "Fecha", "Hora", ...questionList.map((q) => q.text)]
      const rows: any[][] = [headers]
      for (let i = 0; i < (responses || []).length; i++) {
        const r = responses![i]
        const surveyTitle = (r.surveys as any)?.title || surveyTitleMap[r.survey_id] || ""
        const projectId = (r.surveys as any)?.project_id || ""
        const proj = projectMap[projectId]
        const date = new Date(r.created_at)
        const row: any[] = [
          i + 1, surveyTitle, proj?.name || "", proj?.company || "",
          r.respondent_name || "Anónimo", r.respondent_document_type || "", r.respondent_document_number || "",
          r.status === "completed" ? "Completada" : "Incompleta",
          date.toLocaleDateString("es-CO"),
          date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
        ]
        const ra = answersByResponse[r.id] || {}
        for (const q of questionList) row.push(ra[q.id] || "")
        rows.push(row)
      }
      const wsR = XLSX.utils.aoa_to_sheet(rows)
      wsR["!cols"] = headers.map((h) => ({ wch: Math.max(String(h).length + 2, 15) }))
      XLSX.utils.book_append_sheet(wb, wsR, "Respuestas Detalladas")

      // Sheet: Análisis por Pregunta (chart data per question)
      const analysisRows: any[][] = [["Pregunta", "Tipo", "Total Respuestas", "Opción / Valor", "Cantidad", "Porcentaje"]]
      const qMap: Record<string, { text: string; type: string; answers: any[] }> = {}
      for (const a of answers) {
        const q = a.questions
        if (!q) continue
        if (!qMap[q.id]) qMap[q.id] = { text: q.text || "Sin texto", type: q.type, answers: [] }
        qMap[q.id].answers.push(a.value)
      }
      for (const q of questionList) {
        const qData = qMap[q.id]
        if (!qData) continue
        const { text, type, answers: qAnswers } = qData
        if (["multiple_choice", "single_choice", "dropdown", "radio", "checkbox"].includes(type)) {
          const counts: Record<string, number> = {}
          for (const rawVal of qAnswers) {
            const extracted = extractValue(rawVal)
            const vals = extracted.includes(", ") ? extracted.split(", ") : [extracted]
            for (const v of vals) { if (v) counts[v] = (counts[v] || 0) + 1 }
          }
          const total = qAnswers.length || 1
          const entries = Object.entries(counts).sort(([, a], [, b]) => b - a)
          for (let i = 0; i < entries.length; i++) {
            const [label, count] = entries[i]
            analysisRows.push([
              i === 0 ? text : "", i === 0 ? type : "", i === 0 ? qAnswers.length : "",
              label, count, `${Math.round((count / total) * 100)}%`,
            ])
          }
          if (entries.length === 0) analysisRows.push([text, type, qAnswers.length, "", "", ""])
        } else if (["rating", "nps", "likert"].includes(type)) {
          const nums = qAnswers.map((v: any) => {
            if (typeof v === "number") return v
            if (typeof v === "string") { const n = Number(v); return isNaN(n) ? null : n }
            if (typeof v === "object" && v?.value !== undefined) { const n = Number(v.value); return isNaN(n) ? null : n }
            return null
          }).filter((n: any): n is number => n !== null)
          const avg = nums.length > 0 ? (nums.reduce((a: number, b: number) => a + b, 0) / nums.length).toFixed(2) : "N/A"
          const min = nums.length > 0 ? Math.min(...nums) : "N/A"
          const max = nums.length > 0 ? Math.max(...nums) : "N/A"
          analysisRows.push([text, type, qAnswers.length, `Promedio: ${avg}`, `Min: ${min}`, `Max: ${max}`])
        } else {
          const sample = qAnswers.slice(0, 5).map(extractValue).filter((v: string) => v.length > 0)
          analysisRows.push([text, type, qAnswers.length, sample.join(" | "), "", ""])
        }
        analysisRows.push([])
      }
      const wsA = XLSX.utils.aoa_to_sheet(analysisRows)
      wsA["!cols"] = [{ wch: 50 }, { wch: 18 }, { wch: 16 }, { wch: 40 }, { wch: 12 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, wsA, "Análisis por Pregunta")

      // Sheet: Distribución por pregunta (flat chart-friendly data)
      const distRows: any[][] = [["Pregunta", "Opción", "Cantidad"]]
      for (const q of questionList) {
        const qData = qMap[q.id]
        if (!qData) continue
        if (["multiple_choice", "single_choice", "dropdown", "radio", "checkbox"].includes(qData.type)) {
          const counts: Record<string, number> = {}
          for (const rawVal of qData.answers) {
            const extracted = extractValue(rawVal)
            const vals = extracted.includes(", ") ? extracted.split(", ") : [extracted]
            for (const v of vals) { if (v) counts[v] = (counts[v] || 0) + 1 }
          }
          for (const [label, count] of Object.entries(counts).sort(([, a], [, b]) => b - a)) {
            distRows.push([qData.text, label, count])
          }
        }
      }
      if (distRows.length > 1) {
        const wsDist = XLSX.utils.aoa_to_sheet(distRows)
        wsDist["!cols"] = [{ wch: 40 }, { wch: 30 }, { wch: 12 }]
        XLSX.utils.book_append_sheet(wb, wsDist, "Distribuciones")
      }

      return sendWorkbook(wb, `respuestas_${dateStr}.xlsx`)
    }

    // ==================== RENDIMIENTO ====================
    if (tab === "performance") {
      let rq = admin.from("responses").select("id, survey_id, created_at, status")
      if (filteredSurveyIds !== null) rq = rq.in("survey_id", filteredSurveyIds)
      if (dateFrom) rq = rq.gte("created_at", dateFrom.toISOString())
      const { data: responses } = await rq

      let aq = admin.from("assignments").select("id, survey_id, surveyor_id, status, surveyors(name)")
      if (filteredSurveyIds !== null) aq = aq.in("survey_id", filteredSurveyIds)
      const { data: assignments } = await aq

      XLSX.utils.book_append_sheet(wb, makeHeaderSheet(wb, tab, periodFilter), "Info")

      // Sheet: Encuestadores
      const perfRows: any[][] = [["Encuestador", "Asignaciones Totales", "Completadas", "Pendientes", "Tasa de Finalización"]]
      const surveyorMap: Record<string, { name: string; total: number; completed: number }> = {}
      for (const a of assignments || []) {
        const sid = a.surveyor_id as string
        const name = (a.surveyors as any)?.name || sid
        if (!surveyorMap[sid]) surveyorMap[sid] = { name, total: 0, completed: 0 }
        surveyorMap[sid].total++
        if (a.status === "completed") surveyorMap[sid].completed++
      }
      let totalAssignAll = 0, totalCompletedAll = 0
      for (const s of Object.values(surveyorMap).sort((a, b) => b.completed - a.completed)) {
        const pending = s.total - s.completed
        const rate = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0
        perfRows.push([s.name, s.total, s.completed, pending, `${rate}%`])
        totalAssignAll += s.total
        totalCompletedAll += s.completed
      }
      if (perfRows.length === 1) {
        perfRows.push(["Sin datos de encuestadores", "", "", "", ""])
      } else {
        perfRows.push([])
        perfRows.push(["TOTAL", totalAssignAll, totalCompletedAll, totalAssignAll - totalCompletedAll,
          `${totalAssignAll > 0 ? Math.round((totalCompletedAll / totalAssignAll) * 100) : 0}%`])
      }
      const wsPerf = XLSX.utils.aoa_to_sheet(perfRows)
      wsPerf["!cols"] = [{ wch: 30 }, { wch: 22 }, { wch: 15 }, { wch: 15 }, { wch: 22 }]
      XLSX.utils.book_append_sheet(wb, wsPerf, "Encuestadores")

      // Sheet: Respuestas por Día (chart data)
      const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
      const dayCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
      for (const r of responses || []) {
        const dayIndex = new Date(r.created_at).getDay()
        dayCounts[dayIndex] = (dayCounts[dayIndex] || 0) + 1
      }
      const dayRows: any[][] = [["Día de la Semana", "Respuestas"]]
      for (let i = 1; i <= 6; i++) dayRows.push([dayNames[i], dayCounts[i] || 0])
      dayRows.push([dayNames[0], dayCounts[0] || 0]) // Sunday last
      const wsDay = XLSX.utils.aoa_to_sheet(dayRows)
      wsDay["!cols"] = [{ wch: 18 }, { wch: 15 }]
      XLSX.utils.book_append_sheet(wb, wsDay, "Respuestas por Día")

      // Sheet: Resumen General
      const totalSurveyors = Object.keys(surveyorMap).length
      const avgRate = totalSurveyors > 0
        ? Math.round(Object.values(surveyorMap).reduce((s, p) => s + (p.total > 0 ? (p.completed / p.total) * 100 : 0), 0) / totalSurveyors)
        : 0
      const genRows: any[][] = [
        ["RESUMEN GENERAL DE RENDIMIENTO"],
        ["Métrica", "Valor"],
        ["Total encuestadores", totalSurveyors],
        ["Promedio de finalización", `${avgRate}%`],
        ["Total respuestas en período", responses?.length ?? 0],
        ["Total asignaciones", totalAssignAll],
        ["Asignaciones completadas", totalCompletedAll],
      ]
      const wsGen = XLSX.utils.aoa_to_sheet(genRows)
      wsGen["!cols"] = [{ wch: 30 }, { wch: 15 }]
      XLSX.utils.book_append_sheet(wb, wsGen, "Resumen Rendimiento")

      return sendWorkbook(wb, `rendimiento_${dateStr}.xlsx`)
    }

    // ==================== GEOGRÁFICO ====================
    if (tab === "geographic") {
      let aq = admin.from("assignments").select("id, survey_id, surveyor_id, zone_id, status, zones(name), surveyors(name)")
      if (filteredSurveyIds !== null) aq = aq.in("survey_id", filteredSurveyIds)
      const { data: assignments } = await aq

      XLSX.utils.book_append_sheet(wb, makeHeaderSheet(wb, tab, periodFilter), "Info")

      // Sheet: Zona detalle
      const zoneMap: Record<string, { name: string; total: number; completed: number }> = {}
      for (const a of assignments || []) {
        if (!a.zone_id) continue
        const zn = (a.zones as any)?.name || String(a.zone_id)
        if (!zoneMap[a.zone_id as string]) zoneMap[a.zone_id as string] = { name: zn, total: 0, completed: 0 }
        zoneMap[a.zone_id as string].total++
        if (a.status === "completed") zoneMap[a.zone_id as string].completed++
      }

      const geoRows: any[][] = [["Zona", "Asignaciones", "Completadas", "Pendientes", "Tasa de Finalización", "% del Total"]]
      const totalZoneAssign = Object.values(zoneMap).reduce((s, z) => s + z.total, 0) || 1
      let totalAll = 0, totalComp = 0
      for (const z of Object.values(zoneMap).sort((a, b) => b.total - a.total)) {
        const pending = z.total - z.completed
        const rate = z.total > 0 ? Math.round((z.completed / z.total) * 100) : 0
        const pct = Math.round((z.total / totalZoneAssign) * 100)
        geoRows.push([z.name, z.total, z.completed, pending, `${rate}%`, `${pct}%`])
        totalAll += z.total
        totalComp += z.completed
      }
      if (geoRows.length === 1) {
        geoRows.push(["Sin datos de zonas", "", "", "", "", ""])
      } else {
        geoRows.push([])
        geoRows.push(["TOTAL", totalAll, totalComp, totalAll - totalComp,
          `${totalAll > 0 ? Math.round((totalComp / totalAll) * 100) : 0}%`, "100%"])
      }
      const wsGeo = XLSX.utils.aoa_to_sheet(geoRows)
      wsGeo["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 22 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, wsGeo, "Zonas Detalle")

      // Sheet: Respuestas por Zona (chart data - flat)
      const chartRows: any[][] = [["Zona", "Asignaciones", "Completadas"]]
      for (const z of Object.values(zoneMap).sort((a, b) => b.total - a.total)) {
        chartRows.push([z.name, z.total, z.completed])
      }
      const wsChart = XLSX.utils.aoa_to_sheet(chartRows)
      wsChart["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }]
      XLSX.utils.book_append_sheet(wb, wsChart, "Gráfico Zonas")

      // Sheet: Encuestadores por Zona
      const survByZone: Record<string, Record<string, { total: number; completed: number }>> = {}
      for (const a of assignments || []) {
        if (!a.zone_id) continue
        const zn = (a.zones as any)?.name || String(a.zone_id)
        const sn = (a.surveyors as any)?.name || String(a.surveyor_id)
        if (!survByZone[zn]) survByZone[zn] = {}
        if (!survByZone[zn][sn]) survByZone[zn][sn] = { total: 0, completed: 0 }
        survByZone[zn][sn].total++
        if (a.status === "completed") survByZone[zn][sn].completed++
      }
      const szRows: any[][] = [["Zona", "Encuestador", "Asignaciones", "Completadas", "Tasa"]]
      for (const [zone, surveyors] of Object.entries(survByZone).sort()) {
        for (const [name, stats] of Object.entries(surveyors).sort()) {
          const rate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
          szRows.push([zone, name, stats.total, stats.completed, `${rate}%`])
        }
      }
      if (szRows.length > 1) {
        const wsSz = XLSX.utils.aoa_to_sheet(szRows)
        wsSz["!cols"] = [{ wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 12 }]
        XLSX.utils.book_append_sheet(wb, wsSz, "Encuestadores por Zona")
      }

      return sendWorkbook(wb, `geografico_${dateStr}.xlsx`)
    }

    // Fallback
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Tab no reconocido"]]), "Error")
    return sendWorkbook(wb, `reporte_${dateStr}.xlsx`)

  } catch (error) {
    console.error("Error en export API:", error)
    return NextResponse.json({ error: "Error generando el reporte" }, { status: 500 })
  }
}
