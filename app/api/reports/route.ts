import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server"

// Extract a displayable string from a JSONB answer value
function extractValue(val: any): string | string[] {
  if (val === null || val === undefined) return ""
  if (typeof val === "string") return val
  if (typeof val === "number" || typeof val === "boolean") return String(val)
  if (Array.isArray(val)) return val.map((v) => extractValue(v) as string)
  if (typeof val === "object") {
    // Common shapes: {value: "x"}, {label: "x"}, {text: "x"}, {option: "x"}
    if (val.value !== undefined) return extractValue(val.value)
    if (val.label !== undefined) return extractValue(val.label)
    if (val.text !== undefined) return extractValue(val.text)
    if (val.option !== undefined) return extractValue(val.option)
    // Fallback: join all non-empty values
    const vals = Object.values(val).filter((v) => v !== null && v !== undefined && v !== "")
    if (vals.length > 0) return vals.map((v) => extractValue(v) as string).join(", ")
    return ""
  }
  return String(val)
}

function extractNumeric(val: any): number | null {
  if (typeof val === "number") return val
  if (typeof val === "string") { const n = Number(val); return isNaN(n) ? null : n }
  if (typeof val === "object" && val !== null) {
    if (val.value !== undefined) return extractNumeric(val.value)
    if (val.rating !== undefined) return extractNumeric(val.rating)
    if (val.score !== undefined) return extractNumeric(val.score)
  }
  return null
}

// Tipo de encuesta según pptx (slides 2-4): efectiva | incidencia | abandonada.
// responses.outcome es la columna real (ver sql/2026_07_reports_outcome_and_hierarchy.sql).
// Mientras la APK no la esté enviando, usamos un fallback conservador:
//   - outcome ya guardado -> se respeta tal cual
//   - sin outcome + status 'completed' -> 'efectiva'
//   - sin outcome + cualquier otro status -> 'abandonada'
// Nunca inferimos 'incidencia' por proxy: no hay señal confiable en los datos actuales
// para distinguir una incidencia real de una respuesta simplemente incompleta.
function resolveOutcome(r: { outcome?: string | null; status?: string | null }): "efectiva" | "incidencia" | "abandonada" {
  if (r.outcome === "efectiva" || r.outcome === "incidencia" || r.outcome === "abandonada") return r.outcome
  return r.status === "completed" ? "efectiva" : "abandonada"
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const companyFilter = searchParams.get("company") || "all"
    const projectFilter = searchParams.get("project") || "all"
    const surveyFilter = searchParams.get("survey") || "all"
    const surveyorFilter = searchParams.get("surveyor") || "all"
    const tipoFilter = searchParams.get("tipo") || "all" // all | efectiva | incidencia | abandonada
    // Rango de fechas real (slide 19). Se aceptan ISO date strings (YYYY-MM-DD).
    // Se mantiene compatibilidad con el antiguo parámetro "period" por si algún
    // enlace o export guardado todavía lo usa.
    const dateFromParam = searchParams.get("dateFrom")
    const dateToParam = searchParams.get("dateTo")
    const legacyPeriod = searchParams.get("period")

    const admin = createAdminSupabase()

    // Calculate date range: prioriza dateFrom/dateTo explícitos; si no vienen,
    // cae al período heredado; si tampoco hay período, no filtra por fecha.
    const now = new Date()
    let dateFrom: Date | null = null
    let dateTo: Date | null = null
    if (dateFromParam) {
      const d = new Date(dateFromParam)
      if (!isNaN(d.getTime())) dateFrom = d
    }
    if (dateToParam) {
      const d = new Date(dateToParam)
      if (!isNaN(d.getTime())) {
        // Incluye todo el día seleccionado como "hasta"
        d.setHours(23, 59, 59, 999)
        dateTo = d
      }
    }
    if (!dateFrom && !dateTo && legacyPeriod) {
      switch (legacyPeriod) {
        case "week": dateFrom = new Date(now.getTime() - 7 * 86400000); break
        case "month": dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break
        case "quarter": dateFrom = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break
        case "year": dateFrom = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break
        // "all" -> sin filtro
      }
    }

    // --- Load companies, projects, surveys for cascading filter dropdowns ---
    const { data: allCompanies } = await admin.from("companies").select("id, name").order("name")
    const { data: allProjects } = await admin.from("projects").select("id, name, company_id").order("name")
    const { data: allSurveys } = await admin.from("surveys").select("id, title, project_id").order("created_at", { ascending: false })
    // Encuestadores para el selector de filtro (slide 19). Se listan todos los activos;
    // el filtro "supervisor_id" (jerarquía) se deja preparado para cuando exista el dato.
    const { data: allSurveyors } = await admin
      .from("surveyors")
      .select("id, name, supervisor_id")
      .eq("status", "active")
      .order("name")

    // Resolve survey IDs based on cascading filters
    let filteredSurveyIds: string[] | null = null // null = no filter (all)

    if (surveyFilter !== "all") {
      filteredSurveyIds = [surveyFilter]
    } else if (projectFilter !== "all") {
      filteredSurveyIds = (allSurveys || []).filter((s: any) => s.project_id === projectFilter).map((s: any) => s.id)
    } else if (companyFilter !== "all") {
      const companyProjectIds = (allProjects || []).filter((p: any) => p.company_id === companyFilter).map((p: any) => p.id)
      filteredSurveyIds = (allSurveys || []).filter((s: any) => companyProjectIds.includes(s.project_id)).map((s: any) => s.id)
    }

    // Si hay filtro por encuestador, resolvemos primero los assignment_id que le pertenecen,
    // porque responses no tiene surveyor_id directo (solo assignment_id -> assignments.surveyor_id).
    let filteredAssignmentIds: string[] | null = null
    if (surveyorFilter !== "all") {
      let assignmentIdQuery = admin.from("assignments").select("id").eq("surveyor_id", surveyorFilter)
      if (filteredSurveyIds !== null) assignmentIdQuery = assignmentIdQuery.in("survey_id", filteredSurveyIds)
      const { data: matchingAssignments } = await assignmentIdQuery
      filteredAssignmentIds = (matchingAssignments || []).map((a: any) => a.id)
    }

    const emptyResponse = () => NextResponse.json({
      companies: (allCompanies || []).map((c: any) => ({ id: c.id, name: c.name })),
      projects: (allProjects || []).map((p: any) => ({ id: p.id, name: p.name, companyId: p.company_id })),
      surveys: (allSurveys || []).map((s: any) => ({ id: s.id, title: s.title, projectId: s.project_id })),
      surveyors: (allSurveyors || []).map((s: any) => ({ id: s.id, name: s.name, supervisorId: s.supervisor_id })),
      summary: {
        totalResponses: 0, completionRate: 0, avgTime: "0:00", nps: null, responseGrowth: 0,
        responsesTimeline: [], responsesByHour: [], peakHour: 0, activeDays: 0, avgPerDay: 0,
        surveysWithData: 0, trendPct: 0, peakDay: null,
        efectivas: 0, incidencias: 0, abandonadas: 0, tasaRespuestasEfectivas: 0,
      },
      responses: { questionBreakdowns: [] },
      performance: { surveyorPerformance: [], dailyDistribution: [], surveyPerformance: [] },
      geographic: { zoneBreakdown: [], zonePolygons: [], responsePoints: [] },
      individual: { total: 0 },
    })

    if (filteredSurveyIds !== null && filteredSurveyIds.length === 0) return emptyResponse()
    if (filteredAssignmentIds !== null && filteredAssignmentIds.length === 0) return emptyResponse()

    // --- Build responses query with filters ---
    let responsesQuery = admin.from("responses").select(
      "id, survey_id, assignment_id, created_at, completed_at, status, outcome, incidence_type, respondent_name, respondent_document_type, location, surveys(title)"
    )
    if (filteredSurveyIds !== null) {
      responsesQuery = responsesQuery.in("survey_id", filteredSurveyIds)
    }
    if (filteredAssignmentIds !== null) {
      responsesQuery = responsesQuery.in("assignment_id", filteredAssignmentIds)
    }
    if (dateFrom) {
      responsesQuery = responsesQuery.gte("created_at", dateFrom.toISOString())
    }
    if (dateTo) {
      responsesQuery = responsesQuery.lte("created_at", dateTo.toISOString())
    }

    const { data: rawResponses } = await responsesQuery.order("created_at", { ascending: false })

    // Aplica el filtro de tipo (efectiva/incidencia/abandonada) en memoria, porque
    // depende del fallback resolveOutcome() y no solo de la columna outcome.
    // (cast a any[]: el generado de tipos de Supabase para esta tabla resuelve a `never`
    // en este proyecto — mismo patrón que ya usaba el resto del archivo)
    const responses: any[] = ((rawResponses as any[]) || []).filter((r: any) => {
      if (tipoFilter === "all") return true
      return resolveOutcome(r) === tipoFilter
    })

    if (responses.length === 0 && (rawResponses?.length ?? 0) === 0) return emptyResponse()

    // --- Answers: filter by response IDs from our filtered responses ---
    const responseIds = responses.map((r: any) => r.id)
    const responseById: Record<string, any> = {}
    for (const r of responses) responseById[r.id] = r

    let answers: any[] = []
    if (responseIds.length > 0) {
      const batchSize = 200
      for (let i = 0; i < responseIds.length; i += batchSize) {
        const batch = responseIds.slice(i, i + batchSize)
        const { data: batchAnswers } = await admin
          .from("answers")
          .select("id, response_id, question_id, value, questions(id, text, type, options, survey_id, section_id)")
          .in("response_id", batch)
          .limit(5000)
        if (batchAnswers) {
          answers.push(...batchAnswers.filter((a: any) => a.questions !== null))
        }
      }
    }

    // --- Assignments (for performance + geo tabs) ---
    let assignmentsQuery = admin
      .from("assignments")
      .select("id, survey_id, surveyor_id, zone_id, status, created_at, zones(name), surveyors(id, name, supervisor_id)")
    if (filteredSurveyIds !== null) {
      assignmentsQuery = assignmentsQuery.in("survey_id", filteredSurveyIds)
    }
    if (surveyorFilter !== "all") {
      assignmentsQuery = assignmentsQuery.eq("surveyor_id", surveyorFilter)
    }
    const { data: rawAssignments } = await assignmentsQuery
    const assignments: any[] = (rawAssignments as any[]) || []

    // Mapa assignment_id -> assignment (para resolver encuestador por respuesta)
    const assignmentById: Record<string, any> = {}
    for (const a of assignments) assignmentById[a.id] = a

    // === SUMMARY TAB ===
    const totalResponses = responses.length
    const completedResponses = responses.filter((r: any) => r.status === "completed").length
    const completionRate = totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 100) : 0

    // Clasificación efectiva / incidencia / abandonada (slide 20)
    let efectivas = 0, incidencias = 0, abandonadas = 0
    for (const r of responses) {
      const outcome = resolveOutcome(r)
      if (outcome === "efectiva") efectivas++
      else if (outcome === "incidencia") incidencias++
      else abandonadas++
    }
    const tasaRespuestasEfectivas = totalResponses > 0 ? Math.round((efectivas / totalResponses) * 100) : 0

    // Average completion time (solo sobre efectivas, como pide slide 20 "tiempo promedio por encuesta efectiva")
    const timeDiffs: number[] = []
    for (const r of responses) {
      if (resolveOutcome(r) !== "efectiva") continue
      if (r.completed_at && r.created_at) {
        const diff = (new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()) / 1000
        if (diff > 0 && diff < 7200) timeDiffs.push(diff)
      }
    }
    let avgTimeSeconds = timeDiffs.length > 0 ? Math.round(timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length) : 0
    const avgTimeMin = Math.floor(avgTimeSeconds / 60)
    const avgTimeSec = avgTimeSeconds % 60

    // NPS
    let nps: number | null = null
    const ratingAnswers = answers.filter((a: any) => {
      const q = a.questions
      return q && (q.type === "rating" || q.type === "nps")
    })
    if (ratingAnswers.length > 0) {
      let promoters = 0, detractors = 0, total = 0
      for (const a of ratingAnswers) {
        const val = extractNumeric(a.value)
        if (val === null) continue
        total++
        if (val >= 9) promoters++
        else if (val <= 6) detractors++
      }
      if (total > 0) nps = Math.round(((promoters - detractors) / total) * 100)
    }

    // Responses timeline
    const responsesByDay: Record<string, number> = {}
    for (const r of responses) {
      const day = new Date(r.created_at).toISOString().slice(0, 10)
      responsesByDay[day] = (responsesByDay[day] || 0) + 1
    }
    const responsesTimeline = Object.entries(responsesByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))

    // Responses by hour of day (0–23)
    const responsesByHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }))
    for (const r of responses) {
      const h = new Date(r.created_at).getHours()
      responsesByHour[h].count++
    }
    const peakHour = responsesByHour.reduce((best, cur) => cur.count > best.count ? cur : best, responsesByHour[0]).hour

    // Active days (days with at least 1 response)
    const activeDays = Object.keys(responsesByDay).length
    const avgPerDay = activeDays > 0 ? Math.round(totalResponses / activeDays) : 0

    // Total surveys that have at least 1 response in this filter
    const surveysWithData = [...new Set(responses.map((r: any) => r.survey_id))].length

    // Trend: compare first half vs second half of timeline
    let trendPct = 0
    if (responsesTimeline.length >= 4) {
      const half = Math.floor(responsesTimeline.length / 2)
      const firstHalf = responsesTimeline.slice(0, half).reduce((s, d) => s + d.count, 0)
      const secondHalf = responsesTimeline.slice(half).reduce((s, d) => s + d.count, 0)
      trendPct = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : 0
    }

    // Peak day (day with most responses)
    const peakDay = responsesTimeline.length > 0
      ? responsesTimeline.reduce((best, cur) => cur.count > best.count ? cur : best, responsesTimeline[0])
      : null

    // Previous period comparison
    let prevResponses = 0
    if (dateFrom) {
      const periodEnd = dateTo ?? now
      const periodMs = periodEnd.getTime() - dateFrom.getTime()
      const prevDateTo = new Date(dateFrom.getTime())
      const prevDateFrom = new Date(dateFrom.getTime() - periodMs)
      let prevQuery = admin.from("responses").select("id", { count: "exact", head: true })
      if (filteredSurveyIds !== null) prevQuery = prevQuery.in("survey_id", filteredSurveyIds)
      if (filteredAssignmentIds !== null) prevQuery = prevQuery.in("assignment_id", filteredAssignmentIds)
      prevQuery = prevQuery.gte("created_at", prevDateFrom.toISOString()).lt("created_at", prevDateTo.toISOString())
      const { count } = await prevQuery
      prevResponses = count ?? 0
    }
    const responseGrowth = prevResponses > 0
      ? Math.round(((totalResponses - prevResponses) / prevResponses) * 100)
      : totalResponses > 0 ? 100 : 0

    // === ANÁLISIS DE RESULTADOS TAB (antes "Respuestas") ===
    // Guarda también el día de cada respuesta por pregunta para poder graficar
    // "Tendencia" por pregunta (slide 21) sin volver a golpear la base de datos.
    const questionMap: Record<string, { text: string; type: string; options: any[]; answers: any[]; days: string[] }> = {}
    for (const a of answers) {
      const q = a.questions
      if (!q) continue
      if (!questionMap[q.id]) {
        questionMap[q.id] = { text: q.text || "Sin texto", type: q.type, options: q.options || [], answers: [], days: [] }
      }
      questionMap[q.id].answers.push(a.value)
      const parentResponse = responseById[a.response_id]
      if (parentResponse?.created_at) {
        questionMap[q.id].days.push(new Date(parentResponse.created_at).toISOString().slice(0, 10))
      }
    }

    const questionBreakdowns = Object.entries(questionMap).map(([qId, qData]) => {
      const { text, type, options, answers: qAnswers, days } = qData

      // Timeline por pregunta: cuántas respuestas de ESTA pregunta llegaron cada día.
      const dayCounts: Record<string, number> = {}
      for (const d of days) dayCounts[d] = (dayCounts[d] || 0) + 1
      const timeline = Object.entries(dayCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }))

      if (["multiple_choice", "single_choice", "dropdown", "radio", "checkbox"].includes(type)) {
        const counts: Record<string, number> = {}
        for (const rawVal of qAnswers) {
          const extracted = extractValue(rawVal)
          const vals = Array.isArray(extracted) ? extracted : [extracted]
          for (const v of vals) {
            if (v === "") continue
            counts[v] = (counts[v] || 0) + 1
          }
        }
        const total = qAnswers.length || 1
        const distribution = Object.entries(counts)
          .map(([label, count]) => ({ label, count, percentage: Math.round((count / total) * 100) }))
          .sort((a, b) => b.count - a.count)
        return { questionId: qId, text, type, totalAnswers: qAnswers.length, distribution, timeline }
      }

      if (type === "rating" || type === "nps" || type === "likert") {
        const nums = qAnswers.map(extractNumeric).filter((n): n is number => n !== null)
        const avg = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "0"
        const counts: Record<string, number> = {}
        for (const n of nums) { counts[String(n)] = (counts[String(n)] || 0) + 1 }
        const distribution = Object.entries(counts)
          .map(([label, count]) => ({ label, count, percentage: Math.round((count / (nums.length || 1)) * 100) }))
          .sort((a, b) => Number(a.label) - Number(b.label))
        return { questionId: qId, text, type, totalAnswers: qAnswers.length, average: avg, distribution, timeline }
      }

      // Text / open ended
      const textAnswers = qAnswers.map((v) => {
        const ex = extractValue(v)
        return Array.isArray(ex) ? ex.join(", ") : ex
      }).filter((v) => v.length > 0)
      return { questionId: qId, text, type, totalAnswers: qAnswers.length, sampleAnswers: textAnswers.slice(0, 5), timeline }
    })

    // === PERFORMANCE TAB ===
    const surveyorMap: Record<string, { name: string; total: number; completed: number; efectivas: number; incidencias: number; abandonadas: number; supervisorId: string | null }> = {}
    for (const a of assignments || []) {
      const sid = a.surveyor_id as string
      const name = (a.surveyors as any)?.name || sid
      const supervisorId = (a.surveyors as any)?.supervisor_id ?? null
      if (!surveyorMap[sid]) surveyorMap[sid] = { name, total: 0, completed: 0, efectivas: 0, incidencias: 0, abandonadas: 0, supervisorId }
      surveyorMap[sid].total++
      if (a.status === "completed") surveyorMap[sid].completed++
    }
    // Cruza responses -> assignment -> surveyor para contar efectivas/incidencias/abandonadas por encuestador
    for (const r of responses) {
      const assignment = r.assignment_id ? assignmentById[r.assignment_id] : null
      const sid = assignment?.surveyor_id as string | undefined
      if (!sid || !surveyorMap[sid]) continue
      const outcome = resolveOutcome(r)
      if (outcome === "efectiva") surveyorMap[sid].efectivas++
      else if (outcome === "incidencia") surveyorMap[sid].incidencias++
      else surveyorMap[sid].abandonadas++
    }
    const surveyorPerformance = Object.values(surveyorMap)
      .map((s) => ({
        name: s.name,
        supervisorId: s.supervisorId,
        totalAssignments: s.total,
        completedAssignments: s.completed,
        completionRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
        efectivas: s.efectivas,
        incidencias: s.incidencias,
        abandonadas: s.abandonadas,
        totalRegistros: s.efectivas + s.incidencias + s.abandonadas,
        tasaRespuestas: (s.efectivas + s.incidencias + s.abandonadas) > 0
          ? Math.round((s.efectivas / (s.efectivas + s.incidencias + s.abandonadas)) * 100) : 0,
      }))
      .sort((a, b) => b.completedAssignments - a.completedAssignments)

    const responsesByDayOfWeek: Record<string, number> = {}
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    for (const r of responses) {
      const dayIdx = new Date(r.created_at).getDay()
      responsesByDayOfWeek[dayNames[dayIdx]] = (responsesByDayOfWeek[dayNames[dayIdx]] || 0) + 1
    }
    const dailyDistribution = dayNames.map((d) => ({ day: d, count: responsesByDayOfWeek[d] || 0 }))

    // Per-survey performance (works even without assignments — from responses table directly)
    const surveyPerfMap: Record<string, { title: string; total: number; completed: number; timeDiffs: number[] }> = {}
    for (const r of responses) {
      const sid = r.survey_id as string
      const title = (r.surveys as any)?.title || "Sin título"
      if (!surveyPerfMap[sid]) surveyPerfMap[sid] = { title, total: 0, completed: 0, timeDiffs: [] }
      surveyPerfMap[sid].total++
      if (r.status === "completed") {
        surveyPerfMap[sid].completed++
        if (r.completed_at && r.created_at) {
          const diff = (new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()) / 1000
          if (diff > 0 && diff < 7200) surveyPerfMap[sid].timeDiffs.push(diff)
        }
      }
    }
    const surveyPerformance = Object.entries(surveyPerfMap)
      .map(([, s]) => {
        const avgSecs = s.timeDiffs.length > 0
          ? Math.round(s.timeDiffs.reduce((a, b) => a + b, 0) / s.timeDiffs.length) : 0
        const m = Math.floor(avgSecs / 60)
        const sec = avgSecs % 60
        return {
          title: s.title,
          totalResponses: s.total,
          completedResponses: s.completed,
          completionRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
          avgTime: avgSecs > 0 ? `${m}:${String(sec).padStart(2, "0")}` : "—",
        }
      })
      .sort((a, b) => b.totalResponses - a.totalResponses)

    // === GEOGRAPHIC TAB ===
    const zoneResponseMap: Record<string, { name: string; responseCount: number; completedCount: number }> = {}
    for (const a of assignments || []) {
      if (!a.zone_id) continue
      const zoneName = (a.zones as any)?.name || String(a.zone_id)
      if (!zoneResponseMap[a.zone_id as string]) {
        zoneResponseMap[a.zone_id as string] = { name: zoneName, responseCount: 0, completedCount: 0 }
      }
      zoneResponseMap[a.zone_id as string].responseCount++
      if (a.status === "completed") zoneResponseMap[a.zone_id as string].completedCount++
    }
    const totalZoneResponses = Object.values(zoneResponseMap).reduce((s, z) => s + z.responseCount, 0) || 1
    const zoneBreakdown = Object.values(zoneResponseMap)
      .map((z) => ({
        zone: z.name,
        responseCount: z.responseCount,
        completedCount: z.completedCount,
        percentage: Math.round((z.responseCount / totalZoneResponses) * 100),
        completionRate: z.responseCount > 0 ? Math.round((z.completedCount / z.responseCount) * 100) : 0,
      }))
      .sort((a, b) => b.responseCount - a.responseCount)

    // Fetch zone geometries for map rendering
    const zoneIds = [...new Set((assignments || []).map((a: any) => a.zone_id).filter(Boolean))]
    let zonePolygons: { id: string; name: string; geometry: any; zoneColor: string; responseCount: number; completedCount: number; completionRate: number }[] = []
    if (zoneIds.length > 0) {
      const { data: zonesGeo } = await admin
        .from("zones")
        .select("id, name, geometry, zone_color")
        .in("id", zoneIds)
      if (zonesGeo) {
        zonePolygons = zonesGeo
          .filter((z: any) => z.geometry)
          .map((z: any) => {
            const stats = zoneResponseMap[z.id]
            const rc = stats?.responseCount || 0
            const cc = stats?.completedCount || 0
            return {
              id: z.id,
              name: z.name,
              geometry: z.geometry,
              zoneColor: z.zone_color || "#3b82f6",
              responseCount: rc,
              completedCount: cc,
              completionRate: rc > 0 ? Math.round((cc / rc) * 100) : 0,
            }
          })
      }
    }

    // Extract INDIVIDUAL response location points (slide 24: "los puntos geolocalizados
    // deben ser individuales e independientes" — ya NO se agrupan por grid).
    // Cada punto trae encuestador, encuestado, duración y tipo para el popup.
    const responsePointsFromResponses = responses
      .filter((r: any) => r.location && typeof r.location === "object" &&
        typeof (r.location.lat ?? r.location.latitude) === "number" &&
        typeof (r.location.lng ?? r.location.longitude) === "number")
      .map((r: any) => {
        const assignment = r.assignment_id ? assignmentById[r.assignment_id] : null
        const surveyorName = (assignment?.surveyors as any)?.name ?? null
        const durationSecs = (r.completed_at && r.created_at)
          ? Math.round((new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()) / 1000)
          : null
        return {
          id: r.id,
          lat: r.location.lat ?? r.location.latitude,
          lng: r.location.lng ?? r.location.longitude,
          status: r.status,
          outcome: resolveOutcome(r),
          createdAt: r.created_at,
          surveyorName,
          respondentName: r.respondent_name ?? null,
          durationSecs,
          source: "response" as const,
        }
      })

    // Also pull from surveyor_locations: where encuestadores actually were during active surveys
    // (rastro de ubicación, no respuestas puntuales — se mantiene aparte del listado individual)
    let surveyorLocationPoints: { id: string; lat: number; lng: number; status: string; outcome: string | null; createdAt: string; surveyorName: string | null; respondentName: string | null; durationSecs: number | null; source: "surveyor" }[] = []
    try {
      let locQuery = admin
        .from("surveyor_locations")
        .select("id, latitude, longitude, recorded_at, active_survey_id, surveyor_id, surveyors(name)")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("recorded_at", { ascending: false })
        .limit(4000)

      if (dateFrom) locQuery = locQuery.gte("recorded_at", dateFrom.toISOString())
      if (dateTo) locQuery = locQuery.lte("recorded_at", dateTo.toISOString())

      if (filteredSurveyIds !== null && filteredSurveyIds.length > 0) {
        locQuery = locQuery.in("active_survey_id", filteredSurveyIds)
      } else {
        const surveyorIds = [...new Set((assignments || []).map((a: any) => a.surveyor_id).filter(Boolean))]
        if (surveyorIds.length > 0) {
          locQuery = locQuery.in("surveyor_id", surveyorIds)
        }
      }
      if (surveyorFilter !== "all") {
        locQuery = locQuery.eq("surveyor_id", surveyorFilter)
      }

      const { data: locData } = await locQuery
      if (locData && locData.length > 0) {
        // Sample evenly to stay under 2000 points for frontend performance
        const step = Math.max(1, Math.floor(locData.length / 2000))
        surveyorLocationPoints = locData
          .filter((_: any, i: number) => i % step === 0)
          .map((l: any) => ({
            id: l.id,
            lat: Number(l.latitude),
            lng: Number(l.longitude),
            status: "completed",
            outcome: null, // no aplica clasificación efectiva/incidencia/abandonada a rastros de ubicación
            createdAt: l.recorded_at,
            surveyorName: (l.surveyors as any)?.name ?? null,
            respondentName: null,
            durationSecs: null,
            source: "surveyor" as const,
          }))
      }
    } catch (geoErr) {
      console.error("Error fetching surveyor_locations for map:", geoErr)
    }

    // Merge both sources, response locations take priority, cap at 2000.
    // Ya NO se agrupan por grid — cada punto es individual (slide 24).
    const responsePoints = [
      ...responsePointsFromResponses,
      ...surveyorLocationPoints,
    ].slice(0, 2000)

    return NextResponse.json({
      companies: (allCompanies || []).map((c: any) => ({ id: c.id, name: c.name })),
      projects: (allProjects || []).map((p: any) => ({ id: p.id, name: p.name, companyId: p.company_id })),
      surveys: (allSurveys || []).map((s: any) => ({ id: s.id, title: s.title, projectId: s.project_id })),
      surveyors: (allSurveyors || []).map((s: any) => ({ id: s.id, name: s.name, supervisorId: s.supervisor_id })),
      summary: {
        totalResponses,
        completionRate,
        avgTime: `${avgTimeMin}:${String(avgTimeSec).padStart(2, "0")}`,
        nps,
        responseGrowth,
        responsesTimeline,
        responsesByHour,
        peakHour,
        activeDays,
        avgPerDay,
        surveysWithData,
        trendPct,
        peakDay,
        efectivas,
        incidencias,
        abandonadas,
        tasaRespuestasEfectivas,
      },
      responses: { questionBreakdowns },
      performance: { surveyorPerformance, dailyDistribution, surveyPerformance },
      geographic: { zoneBreakdown, zonePolygons, responsePoints },
      individual: { total: responses.length },
    })
  } catch (error) {
    console.error("Error en reports API:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
