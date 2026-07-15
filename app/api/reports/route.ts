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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const companyFilter = searchParams.get("company") || "all"
    const projectFilter = searchParams.get("project") || "all"
    const surveyFilter = searchParams.get("survey") || "all"
    const periodFilter = searchParams.get("period") || "month"

    const admin = createAdminSupabase()

    // Calculate date range
    const now = new Date()
    let dateFrom: Date | null = null
    switch (periodFilter) {
      case "week": dateFrom = new Date(now.getTime() - 7 * 86400000); break
      case "month": dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break
      case "quarter": dateFrom = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break
      case "year": dateFrom = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break
    }

    // --- Load companies, projects, surveys for cascading filter dropdowns ---
    const { data: allCompanies } = await admin.from("companies").select("id, name").order("name")
    const { data: allProjects } = await admin.from("projects").select("id, name, company_id").order("name")
    const { data: allSurveys } = await admin.from("surveys").select("id, title, project_id").order("created_at", { ascending: false })

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

    // --- Build responses query with filters ---
    let responsesQuery = admin.from("responses").select(
      "id, survey_id, created_at, completed_at, status, respondent_name, respondent_document_type, location, surveys(title)"
    )
    if (filteredSurveyIds !== null) {
      if (filteredSurveyIds.length === 0) {
        // No matching surveys — return empty
        return NextResponse.json({
          companies: (allCompanies || []).map((c: any) => ({ id: c.id, name: c.name })),
          projects: (allProjects || []).map((p: any) => ({ id: p.id, name: p.name, companyId: p.company_id })),
          surveys: (allSurveys || []).map((s: any) => ({ id: s.id, title: s.title, projectId: s.project_id })),
          summary: { totalResponses: 0, completionRate: 0, avgTime: "0:00", nps: null, responseGrowth: 0, responsesTimeline: [] },
          responses: { questionBreakdowns: [] },
          performance: { surveyorPerformance: [], dailyDistribution: [] },
          geographic: { zoneBreakdown: [] },
        })
      }
      responsesQuery = responsesQuery.in("survey_id", filteredSurveyIds)
    }
    if (dateFrom) {
      responsesQuery = responsesQuery.gte("created_at", dateFrom.toISOString())
    }

    const { data: responses } = await responsesQuery.order("created_at", { ascending: false })

    // --- Answers: filter by response IDs from our filtered responses ---
    const responseIds = (responses || []).map((r: any) => r.id)
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
      .select("id, survey_id, surveyor_id, zone_id, status, created_at, zones(name), surveyors(name)")
    if (filteredSurveyIds !== null) {
      assignmentsQuery = assignmentsQuery.in("survey_id", filteredSurveyIds)
    }
    const { data: assignments } = await assignmentsQuery

    // === SUMMARY TAB ===
    const totalResponses = responses?.length ?? 0
    const completedResponses = responses?.filter((r: any) => r.status === "completed").length ?? 0
    const completionRate = totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 100) : 0

    // Average completion time
    const timeDiffs: number[] = []
    for (const r of responses || []) {
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
    for (const r of responses || []) {
      const day = new Date(r.created_at).toISOString().slice(0, 10)
      responsesByDay[day] = (responsesByDay[day] || 0) + 1
    }
    const responsesTimeline = Object.entries(responsesByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))

    // Previous period comparison
    let prevResponses = 0
    if (dateFrom) {
      const periodMs = now.getTime() - dateFrom.getTime()
      const prevDateTo = new Date(dateFrom.getTime())
      const prevDateFrom = new Date(dateFrom.getTime() - periodMs)
      let prevQuery = admin.from("responses").select("id", { count: "exact", head: true })
      if (filteredSurveyIds !== null) prevQuery = prevQuery.in("survey_id", filteredSurveyIds)
      prevQuery = prevQuery.gte("created_at", prevDateFrom.toISOString()).lt("created_at", prevDateTo.toISOString())
      const { count } = await prevQuery
      prevResponses = count ?? 0
    }
    const responseGrowth = prevResponses > 0
      ? Math.round(((totalResponses - prevResponses) / prevResponses) * 100)
      : totalResponses > 0 ? 100 : 0

    // === RESPONSES TAB ===
    const questionMap: Record<string, { text: string; type: string; options: any[]; answers: any[] }> = {}
    for (const a of answers) {
      const q = a.questions
      if (!q) continue
      if (!questionMap[q.id]) {
        questionMap[q.id] = { text: q.text || "Sin texto", type: q.type, options: q.options || [], answers: [] }
      }
      questionMap[q.id].answers.push(a.value)
    }

    const questionBreakdowns = Object.entries(questionMap).map(([qId, qData]) => {
      const { text, type, options, answers: qAnswers } = qData

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
        return { questionId: qId, text, type, totalAnswers: qAnswers.length, distribution }
      }

      if (type === "rating" || type === "nps" || type === "likert") {
        const nums = qAnswers.map(extractNumeric).filter((n): n is number => n !== null)
        const avg = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "0"
        const counts: Record<string, number> = {}
        for (const n of nums) { counts[String(n)] = (counts[String(n)] || 0) + 1 }
        const distribution = Object.entries(counts)
          .map(([label, count]) => ({ label, count, percentage: Math.round((count / (nums.length || 1)) * 100) }))
          .sort((a, b) => Number(a.label) - Number(b.label))
        return { questionId: qId, text, type, totalAnswers: qAnswers.length, average: avg, distribution }
      }

      // Text / open ended
      const textAnswers = qAnswers.map((v) => {
        const ex = extractValue(v)
        return Array.isArray(ex) ? ex.join(", ") : ex
      }).filter((v) => v.length > 0)
      return { questionId: qId, text, type, totalAnswers: qAnswers.length, sampleAnswers: textAnswers.slice(0, 5) }
    })

    // === PERFORMANCE TAB ===
    const surveyorMap: Record<string, { name: string; total: number; completed: number }> = {}
    for (const a of assignments || []) {
      const sid = a.surveyor_id as string
      const name = (a.surveyors as any)?.name || sid
      if (!surveyorMap[sid]) surveyorMap[sid] = { name, total: 0, completed: 0 }
      surveyorMap[sid].total++
      if (a.status === "completed") surveyorMap[sid].completed++
    }
    const surveyorPerformance = Object.values(surveyorMap)
      .map((s) => ({
        name: s.name,
        totalAssignments: s.total,
        completedAssignments: s.completed,
        completionRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.completedAssignments - a.completedAssignments)

    const responsesByDayOfWeek: Record<string, number> = {}
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    for (const r of responses || []) {
      const dayIdx = new Date(r.created_at).getDay()
      responsesByDayOfWeek[dayNames[dayIdx]] = (responsesByDayOfWeek[dayNames[dayIdx]] || 0) + 1
    }
    const dailyDistribution = dayNames.map((d) => ({ day: d, count: responsesByDayOfWeek[d] || 0 }))

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

    // Extract individual response location points from responses.location (web/APK with GPS)
    const responsePointsFromResponses = (responses || [])
      .filter((r: any) => r.location && typeof r.location === "object" &&
        typeof (r.location.lat ?? r.location.latitude) === "number" &&
        typeof (r.location.lng ?? r.location.longitude) === "number")
      .map((r: any) => ({
        lat: r.location.lat ?? r.location.latitude,
        lng: r.location.lng ?? r.location.longitude,
        status: r.status,
        createdAt: r.created_at,
        source: "response" as const,
      }))

    // Also pull from surveyor_locations: where encuestadores actually were during active surveys
    // This is the primary source of real location data from the APK
    let surveyorLocationPoints: { lat: number; lng: number; status: string; createdAt: string; source: "surveyor" }[] = []
    try {
      let locQuery = admin
        .from("surveyor_locations")
        .select("latitude, longitude, recorded_at, active_survey_id")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("recorded_at", { ascending: false })
        .limit(4000)

      if (dateFrom) {
        locQuery = locQuery.gte("recorded_at", dateFrom.toISOString())
      }

      // If we have a survey filter, look for locations where the surveyor was actively on those surveys
      // This works even without assignments (web-only or direct APK usage)
      if (filteredSurveyIds !== null && filteredSurveyIds.length > 0) {
        locQuery = locQuery.in("active_survey_id", filteredSurveyIds)
      } else {
        // No survey filter: limit by surveyors from assignments if any, otherwise all locations in period
        const surveyorIds = [...new Set((assignments || []).map((a: any) => a.surveyor_id).filter(Boolean))]
        if (surveyorIds.length > 0) {
          locQuery = locQuery.in("surveyor_id", surveyorIds)
        }
        // If no surveyor filter either, we still get the most recent 4000 points in the period
      }

      const { data: locData } = await locQuery
      if (locData && locData.length > 0) {
        // Sample evenly to stay under 2000 points for frontend performance
        const step = Math.max(1, Math.floor(locData.length / 2000))
        surveyorLocationPoints = locData
          .filter((_: any, i: number) => i % step === 0)
          .map((l: any) => ({
            lat: Number(l.latitude),
            lng: Number(l.longitude),
            status: "completed",
            createdAt: l.recorded_at,
            source: "surveyor" as const,
          }))
      }
    } catch (geoErr) {
      console.error("Error fetching surveyor_locations for map:", geoErr)
    }

    // Merge both sources, response locations take priority, cap at 2000
    const responsePoints = [
      ...responsePointsFromResponses,
      ...surveyorLocationPoints,
    ].slice(0, 2000)

    return NextResponse.json({
      companies: (allCompanies || []).map((c: any) => ({ id: c.id, name: c.name })),
      projects: (allProjects || []).map((p: any) => ({ id: p.id, name: p.name, companyId: p.company_id })),
      surveys: (allSurveys || []).map((s: any) => ({ id: s.id, title: s.title, projectId: s.project_id })),
      summary: {
        totalResponses,
        completionRate,
        avgTime: `${avgTimeMin}:${String(avgTimeSec).padStart(2, "0")}`,
        nps,
        responseGrowth,
        responsesTimeline,
      },
      responses: { questionBreakdowns },
      performance: { surveyorPerformance, dailyDistribution },
      geographic: { zoneBreakdown, zonePolygons, responsePoints },
    })
  } catch (error) {
    console.error("Error en reports API:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
