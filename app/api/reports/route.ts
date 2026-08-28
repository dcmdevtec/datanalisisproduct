import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server"
import { requireRole } from "@/lib/api-auth"
import { resolveOutcome } from "@/lib/report-outcome"

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
// SEGURIDAD (auditoría 2026-07-29): verificaba sesión pero no rol — un
// encuestador autenticado podía consultar analítica de toda la organización
// (incl. datos de otros encuestadores y respondentes).
export async function GET(request: NextRequest) {
  try {
    // Reunión 2026-08-27 ("Jerarquías y roles"): coordinator ahora puede
    // entrar a Reportes (antes ni figuraba en la lista de roles permitidos,
    // así que no podía ver ni su propio equipo).
    const auth = await requireRole(["admin", "supervisor", "coordinator"])
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const companyFilter = searchParams.get("company") || "all"
    const projectFilter = searchParams.get("project") || "all"
    const surveyFilter = searchParams.get("survey") || "all"
    const surveyorFilter = searchParams.get("surveyor") || "all"
    const tipoFilter = searchParams.get("tipo") || "all" // all | efectiva | incidencia | abandonada
    // Filtro avanzado (pptx slide 21: "filtrar las gráficas teniendo en cuenta lo
    // que contestaron en una pregunta en particular"). Se aplica a TODO el reporte
    // (no solo al gráfico seleccionado) para que resumen/rendimiento/geográfico
    // queden consistentes con el mismo subconjunto de respuestas.
    const filterQuestionId = searchParams.get("filterQuestionId")
    const filterValue = searchParams.get("filterValue")
    // Jerarquía Encuestador -> Supervisor -> Coordinador (slide 19).
    //
    // SEGURIDAD (reunión 2026-08-27): estos filtros venían tal cual del
    // query string, es decir, el propio cliente decidía a qué equipo
    // "mirar". Un supervisor autenticado podía omitir el filtro (o poner el
    // id de OTRO supervisor) y ver el reporte de toda la organización, no
    // solo el de su equipo — la única barrera era el rol ("admin"|"supervisor"),
    // nunca la identidad. Ahora, si el usuario autenticado es supervisor o
    // coordinador, su propio id GANA sobre lo que haya venido en la URL.
    let supervisorFilter = searchParams.get("supervisor") || "all"
    let coordinatorFilter = searchParams.get("coordinator") || "all"
    if (auth.user.role === "supervisor") {
      supervisorFilter = auth.user.id
      coordinatorFilter = "all"
    } else if (auth.user.role === "coordinator") {
      coordinatorFilter = auth.user.id
      supervisorFilter = "all"
    }
    // Tablas cruzadas (slide 21): cruzar respuestas de dos preguntas de tipo
    // choice/rating, contando cuántas respuestas cayeron en cada combinación.
    const crossRowQuestionId = searchParams.get("crossRowQuestionId")
    const crossColQuestionId = searchParams.get("crossColQuestionId")
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
    // Encuestadores para el selector de filtro (slide 19).
    const { data: allSurveyors } = await admin
      .from("surveyors")
      .select("id, name, supervisor_id")
      .eq("status", "active")
      .order("name")
    // Supervisores y coordinadores para los selectores de jerarquía (slide 19).
    // Ambos viven en public.users (roles 'supervisor' y 'coordinator' — ver
    // sql/2026_07_reports_outcome_and_hierarchy.sql).
    const { data: allSupervisors } = await admin.from("users").select("id, name").eq("role", "supervisor").order("name")
    const { data: allCoordinators } = await admin.from("users").select("id, name").eq("role", "coordinator").order("name")

    // Resuelve qué encuestadores caen bajo el supervisor/coordinador elegido.
    // coordinator manda sobre supervisor si ambos vienen seteados (es más
    // específico en la jerarquía... al revés: coordinador es el nivel más alto,
    // así que filtrar por coordinador ya incluye a todos sus supervisores).
    let hierarchySurveyorIds: string[] | null = null
    if (coordinatorFilter !== "all") {
      const { data: supsUnderCoordinator } = await admin
        .from("users").select("id").eq("role", "supervisor").eq("coordinator_id", coordinatorFilter)
      const supIds = ((supsUnderCoordinator as any[]) || []).map((s) => s.id)
      if (supIds.length === 0) {
        hierarchySurveyorIds = []
      } else {
        const { data: survsUnderSup } = await admin.from("surveyors").select("id").in("supervisor_id", supIds)
        hierarchySurveyorIds = ((survsUnderSup as any[]) || []).map((s) => s.id)
      }
    } else if (supervisorFilter !== "all") {
      const { data: survsUnderSup } = await admin.from("surveyors").select("id").eq("supervisor_id", supervisorFilter)
      hierarchySurveyorIds = ((survsUnderSup as any[]) || []).map((s) => s.id)
    }

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

    // Si hay filtro por encuestador (directo o vía jerarquía supervisor/coordinador),
    // resolvemos primero los assignment_id que le pertenecen, porque responses no
    // tiene surveyor_id directo (solo assignment_id -> surveyor).
    //
    // BUG (2026-08-27): responses.assignment_id apunta a survey_surveyor_zones.id
    // en el flujo real del portal encuestador (mismo criterio que ya usa
    // app/api/reports/individual/[id]/route.ts), NO a la tabla legacy
    // "assignments". Este filtro solo consultaba "assignments", así que
    // cualquier encuestador que solo tuviera asignaciones vía
    // survey_surveyor_zones (la inmensa mayoría hoy) daba
    // filteredAssignmentIds = [] y el reporte entero devolvía emptyResponse()
    // al elegirlo en el filtro — aunque SÍ tuviera respuestas y ubicación GPS
    // visibles sin el filtro. Se consultan ambas tablas y se unen los ids.
    //
    // OJO: NO se filtra también por filteredSurveyIds acá — responsesQuery ya
    // filtra por survey_id directamente sobre "responses" más abajo, así que
    // agregar ese mismo filtro sobre survey_surveyor_zones es redundante y,
    // si esa fila de asignación no tiene el survey_id perfectamente
    // sincronizado (reasignaciones de zona no siempre lo actualizan), la doble
    // condición podía anular una respuesta real de ese encuestador para esta
    // encuesta.
    let filteredAssignmentIds: string[] | null = null
    if (surveyorFilter !== "all" || hierarchySurveyorIds !== null) {
      if (hierarchySurveyorIds !== null && hierarchySurveyorIds.length === 0) {
        filteredAssignmentIds = []
      } else {
        let sszIdQuery = admin.from("survey_surveyor_zones").select("id")
        let assignmentIdQuery = admin.from("assignments").select("id")
        if (surveyorFilter !== "all") {
          sszIdQuery = sszIdQuery.eq("surveyor_id", surveyorFilter)
          assignmentIdQuery = assignmentIdQuery.eq("surveyor_id", surveyorFilter)
        } else if (hierarchySurveyorIds !== null) {
          sszIdQuery = sszIdQuery.in("surveyor_id", hierarchySurveyorIds)
          assignmentIdQuery = assignmentIdQuery.in("surveyor_id", hierarchySurveyorIds)
        }
        const [{ data: matchingSSZ }, { data: matchingAssignments }] = await Promise.all([sszIdQuery, assignmentIdQuery])
        filteredAssignmentIds = [
          ...((matchingSSZ || []).map((a: any) => a.id)),
          ...((matchingAssignments || []).map((a: any) => a.id)),
        ]
      }
    }

    const emptyResponse = () => NextResponse.json({
      companies: (allCompanies || []).map((c: any) => ({ id: c.id, name: c.name })),
      projects: (allProjects || []).map((p: any) => ({ id: p.id, name: p.name, companyId: p.company_id })),
      surveys: (allSurveys || []).map((s: any) => ({ id: s.id, title: s.title, projectId: s.project_id })),
      surveyors: (allSurveyors || []).map((s: any) => ({ id: s.id, name: s.name, supervisorId: s.supervisor_id })),
      supervisors: (allSupervisors || []).map((s: any) => ({ id: s.id, name: s.name })),
      coordinators: (allCoordinators || []).map((c: any) => ({ id: c.id, name: c.name })),
      summary: {
        totalResponses: 0, totalSurveyors: 0, completionRate: 0, avgTime: "0:00", nps: null, responseGrowth: 0,
        responsesTimeline: [], responsesByHour: [], peakHour: 0, activeDays: 0, avgPerDay: 0,
        surveysWithData: 0, trendPct: 0, peakDay: null,
        efectivas: 0, incidencias: 0, abandonadas: 0, tasaRespuestasEfectivas: 0,
      },
      responses: { questionBreakdowns: [], filterableQuestions: [], crosstab: null },
      performance: { surveyorPerformance: [], dailyDistribution: [], surveyPerformance: [] },
      geographic: { zoneBreakdown: [], zonePolygons: [], responsePoints: [] },
      individual: { total: 0 },
    })

    if (filteredSurveyIds !== null && filteredSurveyIds.length === 0) return emptyResponse()
    if (filteredAssignmentIds !== null && filteredAssignmentIds.length === 0) return emptyResponse()

    // --- Build responses query with filters ---
    let responsesQuery = admin.from("responses").select(
      "id, survey_id, assignment_id, created_at, completed_at, started_at, status, outcome, incidence_type, respondent_name, respondent_document_type, respondent_id, location, metadata, surveys(title)"
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
    let responses: any[] = ((rawResponses as any[]) || []).filter((r: any) => {
      if (tipoFilter === "all") return true
      return resolveOutcome(r) === tipoFilter
    })

    // --- survey_surveyor_zones — se computa ANTES del early-return para que el
    //     mapa geográfico muestre ubicaciones aunque no haya respuestas aún. ---
    let sszQueryEarly = admin
      .from("survey_surveyor_zones")
      .select("id, survey_id, surveyor_id, zone_id, status, created_at, zones(name), surveyors(id, name, supervisor_id)")
    if (filteredSurveyIds !== null) {
      sszQueryEarly = sszQueryEarly.in("survey_id", filteredSurveyIds)
    }
    if (surveyorFilter !== "all") {
      sszQueryEarly = sszQueryEarly.eq("surveyor_id", surveyorFilter)
    } else if (hierarchySurveyorIds !== null) {
      sszQueryEarly = sszQueryEarly.in("surveyor_id", hierarchySurveyorIds.length > 0 ? hierarchySurveyorIds : ["__none__"])
    }
    const { data: rawSSZEarly } = await sszQueryEarly
    const assignments: any[] = (rawSSZEarly as any[]) || []
    const assignmentById: Record<string, any> = {}
    for (const a of assignments) assignmentById[a.id] = a

    // === GEOGRAPHIC DATA (siempre, independiente de si hay respuestas) ===
    const zoneResponseMapEarly: Record<string, { name: string; responseCount: number; completedCount: number }> = {}
    for (const a of assignments) {
      if (!a.zone_id) continue
      const zoneName = (a.zones as any)?.name || String(a.zone_id)
      if (!zoneResponseMapEarly[a.zone_id as string]) {
        zoneResponseMapEarly[a.zone_id as string] = { name: zoneName, responseCount: 0, completedCount: 0 }
      }
      zoneResponseMapEarly[a.zone_id as string].responseCount++
      if (a.status === "completed") zoneResponseMapEarly[a.zone_id as string].completedCount++
    }
    const totalZoneResponsesEarly = Object.values(zoneResponseMapEarly).reduce((s, z) => s + z.responseCount, 0) || 1
    const zoneBreakdown = Object.values(zoneResponseMapEarly)
      .map((z) => ({
        zone: z.name,
        responseCount: z.responseCount,
        completedCount: z.completedCount,
        percentage: Math.round((z.responseCount / totalZoneResponsesEarly) * 1000) / 10,
        completionRate: z.responseCount > 0 ? Math.round((z.completedCount / z.responseCount) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.responseCount - a.responseCount)

    const zoneIdsEarly = [...new Set(assignments.map((a: any) => a.zone_id).filter(Boolean))]
    let zonePolygons: { id: string; name: string; geometry: any; zoneColor: string; responseCount: number; completedCount: number; completionRate: number }[] = []
    if (zoneIdsEarly.length > 0) {
      const { data: zonesGeoEarly } = await admin
        .from("zones")
        .select("id, name, geometry, zone_color")
        .in("id", zoneIdsEarly)
      if (zonesGeoEarly) {
        zonePolygons = zonesGeoEarly
          .filter((z: any) => z.geometry)
          .map((z: any) => {
            const stats = zoneResponseMapEarly[z.id]
            const rc = stats?.responseCount || 0
            const cc = stats?.completedCount || 0
            return {
              id: z.id,
              name: z.name,
              geometry: z.geometry,
              zoneColor: z.zone_color || "#3b82f6",
              responseCount: rc,
              completedCount: cc,
              completionRate: rc > 0 ? Math.round((cc / rc) * 1000) / 10 : 0,
            }
          })
      }
    }

    // Nombre del encuestado para los puntos con GPS: mismo criterio que
    // "Respuestas Individuales" (respondent_name, si no, la respuesta de la
    // pregunta tipo contact_info) — antes el mapa solo mostraba el nombre del
    // ENCUESTADOR, nunca la persona encuestada.
    const geoResponseIds = responses
      .filter((r: any) => r.location && typeof r.location === "object" &&
        typeof (r.location.lat ?? r.location.latitude) === "number" &&
        typeof (r.location.lng ?? r.location.longitude) === "number")
      .map((r: any) => r.id)
    const respondentNameByResponseId: Record<string, string> = {}
    const respondentPhoneByResponseId: Record<string, string> = {}
    if (geoResponseIds.length > 0) {
      const { data: contactAnswers } = await admin
        .from("answers")
        .select("response_id, value, questions!inner(type)")
        .in("response_id", geoResponseIds)
        .eq("questions.type", "contact_info")
        .limit(2000)
      for (const a of (contactAnswers as any[]) || []) {
        const val = a.value
        if (!val || typeof val !== "object") continue
        const fullName = val.fullName || [val.firstName, val.lastName].filter(Boolean).join(" ").trim()
        if (fullName) respondentNameByResponseId[a.response_id] = fullName
        const phone = val.phone || val.telefono || val.phoneNumber
        if (phone) respondentPhoneByResponseId[a.response_id] = String(phone)
      }
    }

    // Puntos de respuesta con GPS (de la tabla responses)
    const responsePointsFromResponses = responses
      .filter((r: any) => r.location && typeof r.location === "object" &&
        typeof (r.location.lat ?? r.location.latitude) === "number" &&
        typeof (r.location.lng ?? r.location.longitude) === "number")
      .map((r: any) => {
        const assignment = r.assignment_id ? assignmentById[r.assignment_id] : null
        const surveyorName = (assignment?.surveyors as any)?.name ?? null
        const surveyorId = assignment?.surveyor_id ?? null
        const startedAt = (r as any).started_at ?? null
        const durationSecs = (r.completed_at && startedAt)
          ? Math.round((new Date(r.completed_at).getTime() - new Date(startedAt).getTime()) / 1000)
          : null
        return {
          id: r.id,
          lat: r.location.lat ?? r.location.latitude,
          lng: r.location.lng ?? r.location.longitude,
          status: r.status,
          outcome: resolveOutcome(r),
          createdAt: r.created_at,
          surveyorName,
          // surveyorId + startedAt/completedAt: para reconstruir la ruta GPS
          // aproximada de ESTE punto (ver /api/reports/route-trace) — no hay
          // FK directa response->surveyor_locations, se aproxima por
          // surveyor_id + ventana de tiempo [started_at, completed_at].
          surveyorId,
          startedAt,
          completedAt: r.completed_at ?? null,
          respondentName: r.respondent_name ?? respondentNameByResponseId[r.id] ?? null,
          respondentPhone: respondentPhoneByResponseId[r.id] ?? null,
          durationSecs,
          source: "response" as const,
        }
      })

    // Rastro GPS de encuestadores (surveyor_locations)
    let surveyorLocationPoints: { id: string; lat: number; lng: number; status: string; outcome: string | null; createdAt: string; surveyorId: string | null; surveyorName: string | null; respondentName: string | null; durationSecs: number | null; source: "surveyor" }[] = []
    try {
      let locQuery = admin
        .from("surveyor_locations")
        .select("id, latitude, longitude, recorded_at, active_survey_id, surveyor_id, surveyors(name)")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("recorded_at", { ascending: false })
        .limit(4000)

      if (dateFrom) locQuery = locQuery.gte("recorded_at", dateFrom.toISOString())
      if (dateTo)   locQuery = locQuery.lte("recorded_at", dateTo.toISOString())

      if (filteredSurveyIds !== null && filteredSurveyIds.length > 0) {
        locQuery = locQuery.in("active_survey_id", filteredSurveyIds)
      } else {
        const surveyorIds = [...new Set(assignments.map((a: any) => a.surveyor_id).filter(Boolean))]
        if (surveyorIds.length > 0) {
          locQuery = locQuery.in("surveyor_id", surveyorIds)
        }
        // Si no hay assignments → sin filtro de surveyor_id → devuelve TODOS los
        // puntos de la tabla (útil para ver encuestadores activos aunque no tengan
        // asignaciones formales aún).
      }
      if (surveyorFilter !== "all") {
        locQuery = locQuery.eq("surveyor_id", surveyorFilter)
      }

      const { data: locData } = await locQuery
      if (locData && locData.length > 0) {
        const step = Math.max(1, Math.floor(locData.length / 2000))
        surveyorLocationPoints = locData
          .filter((_: any, i: number) => i % step === 0)
          .map((l: any) => ({
            id: l.id,
            lat: Number(l.latitude),
            lng: Number(l.longitude),
            status: "completed",
            outcome: null,
            createdAt: l.recorded_at,
            surveyorId: l.surveyor_id ?? null,
            surveyorName: (l.surveyors as any)?.name ?? null,
            respondentName: null,
            durationSecs: null,
            source: "surveyor" as const,
          }))
      }
    } catch (geoErr) {
      console.error("Error fetching surveyor_locations for map:", geoErr)
    }

    const responsePoints = [
      ...responsePointsFromResponses,
      ...surveyorLocationPoints,
    ].slice(0, 2000)
    // === FIN GEOGRAPHIC DATA ===

    if (responses.length === 0 && (rawResponses?.length ?? 0) === 0) {
      // No hay respuestas, pero devolvemos datos geográficos (ubicaciones de
      // encuestadores y polígonos de zonas) para que el mapa funcione igual.
      return NextResponse.json({
        companies: (allCompanies || []).map((c: any) => ({ id: c.id, name: c.name })),
        projects: (allProjects || []).map((p: any) => ({ id: p.id, name: p.name, companyId: p.company_id })),
        surveys: (allSurveys || []).map((s: any) => ({ id: s.id, title: s.title, projectId: s.project_id })),
        surveyors: (allSurveyors || []).map((s: any) => ({ id: s.id, name: s.name, supervisorId: s.supervisor_id })),
        supervisors: (allSupervisors || []).map((s: any) => ({ id: s.id, name: s.name })),
        coordinators: (allCoordinators || []).map((c: any) => ({ id: c.id, name: c.name })),
        summary: {
          totalResponses: 0, totalSurveyors: 0, completionRate: 0, avgTime: "0:00", nps: null, responseGrowth: 0,
          responsesTimeline: [], responsesByHour: [], peakHour: 0, activeDays: 0, avgPerDay: 0,
          surveysWithData: 0, trendPct: 0, peakDay: null,
          efectivas: 0, incidencias: 0, abandonadas: 0, tasaRespuestasEfectivas: 0,
        },
        responses: { questionBreakdowns: [], filterableQuestions: [], crosstab: null },
        performance: { surveyorPerformance: [], dailyDistribution: [], surveyPerformance: [] },
        geographic: { zoneBreakdown, zonePolygons, responsePoints },
        individual: { total: 0 },
      })
    }

    // --- Answers: filter by response IDs from our filtered responses ---
    const responseIds = responses.map((r: any) => r.id)
    let responseById: Record<string, any> = {}
    for (const r of responses) responseById[r.id] = r

    let answers: any[] = []
    if (responseIds.length > 0) {
      const batchSize = 200
      for (let i = 0; i < responseIds.length; i += batchSize) {
        const batch = responseIds.slice(i, i + batchSize)
        const { data: batchAnswers } = await admin
          .from("answers")
          .select("id, response_id, question_id, value, questions(id, text, type, options, survey_id, section_id, order_num, matrix_rows, matrix_cols, settings)")
          .in("response_id", batch)
          .limit(5000)
        if (batchAnswers) {
          answers.push(...batchAnswers.filter((a: any) => a.questions !== null))
        }
      }
    }

    // Preguntas usables para el filtro avanzado (solo tipo choice/rating, con al
    // menos una respuesta), calculadas ANTES de aplicar el filtro avanzado — así
    // las opciones del selector de "valor" no se reducen solas al aplicar uno.
    const filterableQuestionsMap: Record<string, { questionId: string; text: string; values: Set<string> }> = {}
    for (const a of answers) {
      const q = a.questions
      if (!q || !["multiple_choice", "single_choice", "dropdown", "radio", "checkbox", "rating", "nps", "likert", "scale"].includes(q.type)) continue
      if (!filterableQuestionsMap[q.id]) filterableQuestionsMap[q.id] = { questionId: q.id, text: q.text || "Sin texto", values: new Set() }
      const extracted = extractValue(a.value)
      const vals = Array.isArray(extracted) ? extracted : [extracted]
      for (const v of vals) if (v !== "") filterableQuestionsMap[q.id].values.add(v)
    }
    const filterableQuestions = Object.values(filterableQuestionsMap).map((q) => ({
      questionId: q.questionId,
      text: q.text,
      values: Array.from(q.values).sort(),
    }))

    // --- Filtro avanzado: narrow responses/answers al subconjunto que respondió
    // filterValue en filterQuestionId. Se hace DESPUÉS de fetchear answers (con
    // el set completo de responseIds) porque necesitamos ver la respuesta a esa
    // pregunta antes de decidir qué queda.
    if (filterQuestionId && filterValue) {
      const matchingResponseIds = new Set(
        answers
          .filter((a: any) => a.question_id === filterQuestionId)
          .filter((a: any) => {
            const extracted = extractValue(a.value)
            const vals = Array.isArray(extracted) ? extracted : [extracted]
            return vals.includes(filterValue)
          })
          .map((a: any) => a.response_id)
      )
      responses = responses.filter((r: any) => matchingResponseIds.has(r.id))
      answers = answers.filter((a: any) => matchingResponseIds.has(a.response_id))
      responseById = {}
      for (const r of responses) responseById[r.id] = r
      if (responses.length === 0) {
        const empty = emptyResponse()
        const emptyJson = await empty.json()
        emptyJson.responses.filterableQuestions = filterableQuestions
        emptyJson.responses.crosstab = null
        return NextResponse.json(emptyJson)
      }
    }

    // --- Tablas cruzadas (slide 21): cruza las respuestas de dos preguntas sobre
    // el subconjunto de respuestas ya filtrado (incluye filtro avanzado si hay uno
    // activo), para que la tabla siempre refleje lo mismo que el resto del reporte.
    let crosstab: {
      rowQuestion: string; colQuestion: string
      rows: string[]; cols: string[]; matrix: number[][]
      rowTotals: number[]; colTotals: number[]; total: number
    } | null = null
    if (crossRowQuestionId && crossColQuestionId) {
      const rowQ = filterableQuestionsMap[crossRowQuestionId]
      const colQ = filterableQuestionsMap[crossColQuestionId]
      if (rowQ && colQ) {
        // response_id -> valores respondidos en cada pregunta (puede haber más de
        // uno si es checkbox, cada combinación cuenta por separado)
        const byResponseRow: Record<string, string[]> = {}
        const byResponseCol: Record<string, string[]> = {}
        for (const a of answers) {
          if (a.question_id !== crossRowQuestionId && a.question_id !== crossColQuestionId) continue
          const extracted = extractValue(a.value)
          const vals = (Array.isArray(extracted) ? extracted : [extracted]).filter((v: string) => v !== "")
          if (vals.length === 0) continue
          const target = a.question_id === crossRowQuestionId ? byResponseRow : byResponseCol
          target[a.response_id] = vals
        }
        const rows = Array.from(rowQ.values).sort()
        const cols = Array.from(colQ.values).sort()
        const rowIndex: Record<string, number> = {}
        rows.forEach((r, i) => { rowIndex[r] = i })
        const colIndex: Record<string, number> = {}
        cols.forEach((c, i) => { colIndex[c] = i })
        const matrix: number[][] = rows.map(() => cols.map(() => 0))
        let total = 0
        for (const responseId of Object.keys(byResponseRow)) {
          const colVals = byResponseCol[responseId]
          if (!colVals) continue
          for (const rv of byResponseRow[responseId]) {
            for (const cv of colVals) {
              const ri = rowIndex[rv]
              const ci = colIndex[cv]
              if (ri === undefined || ci === undefined) continue
              matrix[ri][ci]++
              total++
            }
          }
        }
        const rowTotals = matrix.map((row) => row.reduce((s, v) => s + v, 0))
        const colTotals = cols.map((_, ci) => matrix.reduce((s, row) => s + row[ci], 0))
        crosstab = { rowQuestion: rowQ.text, colQuestion: colQ.text, rows, cols, matrix, rowTotals, colTotals, total }
      }
    }

    // assignments y assignmentById ya se calcularon arriba (antes del early-return)

    // === SUMMARY TAB ===
    const totalResponses = responses.length
    const completedResponses = responses.filter((r: any) => r.status === "completed").length
    const completionRate = totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 1000) / 10 : 0

    // Clasificación efectiva / incidencia / abandonada / descalificado (slide 20).
    // "descalificado" es su propia categoría (no cuenta como incidencia ni
    // abandonada) — sale del salto de lógica "Descalificar y terminar" cuando
    // el encuestado no cumple un filtro (ej. edad mínima).
    let efectivas = 0, incidencias = 0, abandonadas = 0, descalificadas = 0
    // Desglose de incidencias por motivo (slide 3: vivienda_cerrada, rechazo,
    // menor_sin_adulto, etc. — ver sql/2026_07_reports_outcome_and_hierarchy.sql).
    const incidenceTypeCounts: Record<string, number> = {}
    for (const r of responses) {
      const outcome = resolveOutcome(r)
      if (outcome === "efectiva") efectivas++
      else if (outcome === "incidencia") {
        incidencias++
        const t = (r as any).incidence_type || "otro"
        incidenceTypeCounts[t] = (incidenceTypeCounts[t] || 0) + 1
      }
      else if (outcome === "descalificado") descalificadas++
      else abandonadas++
    }
    const INCIDENCE_TYPE_LABELS: Record<string, string> = {
      vivienda_cerrada: "Vivienda cerrada",
      vivienda_desocupada: "Vivienda desocupada",
      senales_ocupacion_sin_atender: "Señales de ocupación sin atender",
      rechazo: "Rechazo",
      menor_sin_adulto: "Menor sin adulto",
      negocio_local: "Negocio/local",
      propiedad_horizontal_sin_acceso: "Propiedad horizontal sin acceso",
      idioma_discapacidad: "Idioma/discapacidad",
      no_cumple_cuota: "No cumple cuota",
      otro: "Otro",
    }
    const incidenceBreakdown = Object.entries(incidenceTypeCounts)
      .map(([type, count]) => ({ type, label: INCIDENCE_TYPE_LABELS[type] || type, count }))
      .sort((a, b) => b.count - a.count)
    const tasaRespuestasEfectivas = totalResponses > 0 ? Math.round((efectivas / totalResponses) * 1000) / 10 : 0

    // Average completion time (solo sobre efectivas, como pide slide 20 "tiempo promedio por encuesta efectiva")
    // started_at = inicio real de la respuesta (capturado en el cliente). Antes
    // se medía completed_at - created_at, pero ambos se setean en el mismo
    // INSERT al enviar, así que el promedio siempre daba 0:00. Con datos
    // viejos (started_at ausente) esa fila simplemente no se cuenta.
    const timeDiffs: number[] = []
    for (const r of responses) {
      if (resolveOutcome(r) !== "efectiva") continue
      const start = (r as any).started_at
      if (r.completed_at && start) {
        const diff = (new Date(r.completed_at).getTime() - new Date(start).getTime()) / 1000
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
      if (total > 0) nps = Math.round(((promoters - detractors) / total) * 1000) / 10
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
      trendPct = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 1000) / 10 : 0
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
      ? Math.round(((totalResponses - prevResponses) / prevResponses) * 1000) / 10
      : totalResponses > 0 ? 100 : 0

    // === ANÁLISIS DE RESULTADOS TAB (antes "Respuestas") ===
    // Guarda también el día de cada respuesta por pregunta para poder graficar
    // "Tendencia" por pregunta (slide 21) sin volver a golpear la base de datos.
    const questionMap: Record<string, { text: string; type: string; options: any[]; answers: any[]; days: string[]; matrixRows: string[]; matrixCols: string[]; cellType: string; sectionId: string | null; orderNum: number }> = {}
    for (const a of answers) {
      const q = a.questions
      if (!q) continue
      if (!questionMap[q.id]) {
        const mRows: string[] = q.matrix_rows || q.settings?.matrixRows || []
        const mCols: string[] = q.matrix_cols || q.settings?.matrixCols || []
        const cType: string = q.settings?.matrixCellType || "radio"
        questionMap[q.id] = {
          text: q.text || "Sin texto", type: q.type, options: q.options || [], answers: [], days: [],
          matrixRows: mRows, matrixCols: mCols, cellType: cType,
          sectionId: (q as any).section_id ?? null, orderNum: (q as any).order_num ?? 0,
        }
      }
      questionMap[q.id].answers.push(a.value)
      const parentResponse = responseById[a.response_id]
      if (parentResponse?.created_at) {
        questionMap[q.id].days.push(new Date(parentResponse.created_at).toISOString().slice(0, 10))
      }
    }

    const questionBreakdowns = Object.entries(questionMap).map(([qId, qData]) => {
      const { text, type, options, answers: qAnswers, days, matrixRows, matrixCols, cellType } = qData

      // Timeline por pregunta: cuántas respuestas de ESTA pregunta llegaron cada día.
      const dayCounts: Record<string, number> = {}
      for (const d of days) dayCounts[d] = (dayCounts[d] || 0) + 1
      const timeline = Object.entries(dayCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }))

      // ── Matriz ───────────────────────────────────────────────────────────────
      if (type === "matrix" && matrixRows.length > 0) {
        if (cellType === "number" || cellType === "text") {
          // Formato: { "row_col": value, ... }
          const sums: Record<string, number> = {}
          const cnts: Record<string, number> = {}
          const samples: Record<string, string[]> = {}
          for (const val of qAnswers) {
            if (!val || typeof val !== "object" || Array.isArray(val)) continue
            for (const [key, v] of Object.entries(val as Record<string, any>)) {
              const str = String(v ?? "").trim()
              if (!str) continue
              if (cellType === "number") {
                const n = parseFloat(str.replace(",", "."))
                if (!isNaN(n)) { sums[key] = (sums[key] || 0) + n; cnts[key] = (cnts[key] || 0) + 1 }
              } else {
                if (!samples[key]) samples[key] = []
                if (samples[key].length < 3) samples[key].push(str)
              }
            }
          }
          // Build per-row per-col table
          const tableData: Record<string, Record<string, { avg?: number; count: number; samples?: string[] }>> = {}
          for (const row of matrixRows) {
            tableData[row] = {}
            for (const col of matrixCols) {
              const key = `${row}_${col}`
              if (cellType === "number") {
                const c = cnts[key] || 0
                tableData[row][col] = { avg: c > 0 ? Math.round((sums[key] / c) * 10) / 10 : undefined, count: c }
              } else {
                tableData[row][col] = { count: (samples[key] || []).length, samples: samples[key] || [] }
              }
            }
          }
          return { questionId: qId, text, type, totalAnswers: qAnswers.length, timeline,
            matrixBreakdown: { matrixRows, matrixCols, cellType, tableData } }
        }

        if (cellType === "radio" || cellType === "checkbox") {
          // Formato radio: { rowLabel: colLabel }  checkbox: { rowLabel: [colLabel,...] }
          const rowDist: Record<string, Record<string, number>> = {}
          for (const row of matrixRows) rowDist[row] = {}
          for (const val of qAnswers) {
            if (!val || typeof val !== "object" || Array.isArray(val)) continue
            for (const row of matrixRows) {
              const sel = (val as any)[row]
              const selected: string[] = Array.isArray(sel) ? sel : sel ? [String(sel)] : []
              for (const s of selected) {
                if (s) rowDist[row][s] = (rowDist[row][s] || 0) + 1
              }
            }
          }
          return { questionId: qId, text, type, totalAnswers: qAnswers.length, timeline,
            matrixBreakdown: { matrixRows, matrixCols, cellType, rowDistribution: rowDist } }
        }

        // rating per cell: { "row_col": numericValue }
        const sums: Record<string, number> = {}
        const cnts: Record<string, number> = {}
        for (const val of qAnswers) {
          if (!val || typeof val !== "object" || Array.isArray(val)) continue
          for (const [key, v] of Object.entries(val as Record<string, any>)) {
            const n = parseFloat(String(v ?? ""))
            if (!isNaN(n)) { sums[key] = (sums[key] || 0) + n; cnts[key] = (cnts[key] || 0) + 1 }
          }
        }
        const tableData: Record<string, Record<string, { avg?: number; count: number }>> = {}
        for (const row of matrixRows) {
          tableData[row] = {}
          for (const col of matrixCols) {
            const key = `${row}_${col}`
            const c = cnts[key] || 0
            tableData[row][col] = { avg: c > 0 ? Math.round((sums[key] / c) * 10) / 10 : undefined, count: c }
          }
        }
        return { questionId: qId, text, type, totalAnswers: qAnswers.length, timeline,
          matrixBreakdown: { matrixRows, matrixCols, cellType, tableData } }
      }
      // ─────────────────────────────────────────────────────────────────────────

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
          .map(([label, count]) => ({ label, count, percentage: Math.round((count / total) * 1000) / 10 }))
          .sort((a, b) => b.count - a.count)
        return { questionId: qId, text, type, totalAnswers: qAnswers.length, distribution, timeline }
      }

      if (type === "rating" || type === "nps" || type === "likert") {
        const nums = qAnswers.map(extractNumeric).filter((n): n is number => n !== null)
        const avg = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "0"
        const counts: Record<string, number> = {}
        for (const n of nums) { counts[String(n)] = (counts[String(n)] || 0) + 1 }
        const distribution = Object.entries(counts)
          .map(([label, count]) => ({ label, count, percentage: Math.round((count / (nums.length || 1)) * 1000) / 10 }))
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

    // Ordenar igual que en el builder de la encuesta (sección → orden de
    // pregunta dentro de la sección), no por orden de inserción en el mapa
    // (que depende del orden en que llegaron las respuestas). Se usa en el
    // buscador de "Análisis de resultados" y en "Compartir link".
    let sectionOrderById: Record<string, number> = {}
    if (filteredSurveyIds !== null && filteredSurveyIds.length > 0) {
      const { data: sectionsForOrder } = await admin
        .from("survey_sections")
        .select("id, order_num")
        .in("survey_id", filteredSurveyIds)
      for (const s of (sectionsForOrder as any[]) || []) sectionOrderById[s.id] = s.order_num ?? 0
    }
    questionBreakdowns.sort((a, b) => {
      const qa = questionMap[a.questionId]
      const qb2 = questionMap[b.questionId]
      const sa = qa?.sectionId ? (sectionOrderById[qa.sectionId] ?? 0) : 0
      const sb = qb2?.sectionId ? (sectionOrderById[qb2.sectionId] ?? 0) : 0
      if (sa !== sb) return sa - sb
      return (qa?.orderNum ?? 0) - (qb2?.orderNum ?? 0)
    })

    // === PERFORMANCE TAB ===
    // Construir mapa supervisor_id -> nombre (de allSupervisors ya cargado arriba)
    const supervisorNameById: Record<string, string> = {}
    for (const sup of (allSupervisors || [])) supervisorNameById[sup.id] = sup.name

    // surveyorMap: clave = surveyor_id
    const surveyorMap: Record<string, {
      name: string
      supervisorId: string | null
      supervisorName: string | null
      efectivas: number
      incidencias: number
      abandonadas: number
      descalificadas: number
      timeDiffs: number[]
      // Reunión 2026-08-27: "Hora de inicio 1ra encuesta del día" / "Hora
      // final última encuesta del día" — se aproxima con el primer/último
      // created_at dentro del rango de fechas ya filtrado (dateFrom/dateTo),
      // no estrictamente "del día" porque el reporte puede abarcar varios días.
      firstResponseAt: string | null
      lastResponseAt: string | null
    }> = {}

    // Encuestadores por metadata.surveyor_id (APK): la APK siempre manda
    // assignment_id=null (ver SurveyDetailScreen.tsx), así que sin este
    // fallback ninguna respuesta de la APK se contaba en "Rendimiento por
    // Encuestador" — mismo criterio ya usado en /api/reports/individual.
    const metaSurveyorIds = [
      ...new Set(
        responses
          .filter((r: any) => !r.assignment_id && r.metadata?.surveyor_id)
          .map((r: any) => r.metadata.surveyor_id as string)
      )
    ]
    const surveyorByMetaId: Record<string, { name: string | null; supervisor_id: string | null }> = {}
    if (metaSurveyorIds.length > 0) {
      const { data: surveyorRows } = await admin
        .from("surveyors")
        .select("id, name, supervisor_id")
        .in("id", metaSurveyorIds)
      for (const s of (surveyorRows as any[]) || []) {
        surveyorByMetaId[s.id] = { name: s.name ?? null, supervisor_id: s.supervisor_id ?? null }
      }
    }

    // Encuestadores por respondent_id (web autenticada, ej. app/surveys/[id]/collect
    // o /preview/survey/[id] / /encuesta/[id] tomada directamente por un
    // encuestador sin pasar por el portal): estas rutas no mandan assignment_id
    // ni metadata.surveyor_id, pero /api/responses igual guarda
    // responses.respondent_id = sesión autenticada del navegador. Se resuelve
    // igual que resolveCurrentSurveyor() en lib/portal-encuestador/auth.ts:
    // 1) surveyors.user_id = respondent_id, 2) fallback surveyors.id = respondent_id.
    const respondentIdsNeedingSurveyor = [
      ...new Set(
        responses
          .filter((r: any) => !r.assignment_id && !r.metadata?.surveyor_id && r.respondent_id)
          .map((r: any) => r.respondent_id as string)
      )
    ]
    const surveyorByRespondentId: Record<string, { name: string | null; supervisor_id: string | null }> = {}
    if (respondentIdsNeedingSurveyor.length > 0) {
      const { data: byUserId } = await admin
        .from("surveyors")
        .select("id, user_id, name, supervisor_id")
        .in("user_id", respondentIdsNeedingSurveyor)
      const resolvedIds = new Set<string>()
      for (const s of (byUserId as any[]) || []) {
        surveyorByRespondentId[s.user_id] = { name: s.name ?? null, supervisor_id: s.supervisor_id ?? null }
        resolvedIds.add(s.user_id)
      }
      const remaining = respondentIdsNeedingSurveyor.filter((id) => !resolvedIds.has(id))
      if (remaining.length > 0) {
        const { data: byLegacyId } = await admin
          .from("surveyors")
          .select("id, name, supervisor_id")
          .in("id", remaining)
        for (const s of (byLegacyId as any[]) || []) {
          surveyorByRespondentId[s.id] = { name: s.name ?? null, supervisor_id: s.supervisor_id ?? null }
        }
      }
    }

    // Inicializar desde SSZ (incluye encuestadores asignados aunque no tengan respuestas aún)
    for (const a of assignments) {
      const sid = a.surveyor_id as string
      if (!sid || surveyorMap[sid]) continue
      const name = (a.surveyors as any)?.name || sid
      const supervisorId = (a.surveyors as any)?.supervisor_id ?? null
      surveyorMap[sid] = {
        name, supervisorId,
        supervisorName: supervisorId ? (supervisorNameById[supervisorId] ?? null) : null,
        efectivas: 0, incidencias: 0, abandonadas: 0, descalificadas: 0, timeDiffs: [],
        firstResponseAt: null, lastResponseAt: null,
      }
    }

    // Contar outcomes y tiempo promedio desde responses
    for (const r of responses) {
      const ssz = r.assignment_id ? assignmentById[r.assignment_id] : null
      const metaSurveyor = !r.assignment_id ? surveyorByMetaId[(r as any).metadata?.surveyor_id] : null
      const respondentSurveyor = (!r.assignment_id && !metaSurveyor && (r as any).respondent_id)
        ? surveyorByRespondentId[(r as any).respondent_id] ?? null
        : null
      const sid = (ssz?.surveyor_id as string | undefined)
        ?? (!r.assignment_id ? (r as any).metadata?.surveyor_id : undefined)
        ?? (respondentSurveyor ? (r as any).respondent_id : undefined)
      if (!sid) continue
      // Inicializar si no existía (respuestas sin SSZ en el filtro actual)
      if (!surveyorMap[sid]) {
        const name = (ssz?.surveyors as any)?.name || metaSurveyor?.name || respondentSurveyor?.name || sid
        const supervisorId = (ssz?.surveyors as any)?.supervisor_id ?? metaSurveyor?.supervisor_id ?? respondentSurveyor?.supervisor_id ?? null
        surveyorMap[sid] = {
          name, supervisorId,
          supervisorName: supervisorId ? (supervisorNameById[supervisorId] ?? null) : null,
          efectivas: 0, incidencias: 0, abandonadas: 0, descalificadas: 0, timeDiffs: [],
          firstResponseAt: null, lastResponseAt: null,
        }
      }
      if (r.created_at) {
        const entry = surveyorMap[sid]
        if (!entry.firstResponseAt || r.created_at < entry.firstResponseAt) entry.firstResponseAt = r.created_at
        if (!entry.lastResponseAt || r.created_at > entry.lastResponseAt) entry.lastResponseAt = r.created_at
      }
      const outcome = resolveOutcome(r)
      if (outcome === "efectiva") {
        surveyorMap[sid].efectivas++
        const start = (r as any).started_at
        if (r.completed_at && start) {
          const diff = (new Date(r.completed_at).getTime() - new Date(start).getTime()) / 1000
          if (diff > 0 && diff < 7200) surveyorMap[sid].timeDiffs.push(diff)
        }
      } else if (outcome === "incidencia") {
        surveyorMap[sid].incidencias++
      } else if (outcome === "descalificado") {
        surveyorMap[sid].descalificadas++
      } else {
        surveyorMap[sid].abandonadas++
      }
    }

    const surveyorPerformance = Object.values(surveyorMap)
      .map((s) => {
        const totalRegistros = s.efectivas + s.incidencias + s.abandonadas + s.descalificadas
        const avgSecs = s.timeDiffs.length > 0
          ? Math.round(s.timeDiffs.reduce((a, b) => a + b, 0) / s.timeDiffs.length) : 0
        const m = Math.floor(avgSecs / 60)
        const sec = avgSecs % 60
        return {
          name: s.name,
          supervisorId: s.supervisorId,
          supervisorName: s.supervisorName,
          totalRegistros,
          efectivas: s.efectivas,
          incidencias: s.incidencias,
          abandonadas: s.abandonadas,
          descalificadas: s.descalificadas,
          tasaRespuestas: totalRegistros > 0 ? Math.round((s.efectivas / totalRegistros) * 1000) / 10 : 0,
          avgTime: avgSecs > 0 ? `${m}:${String(sec).padStart(2, "0")}` : "—",
          firstResponseAt: s.firstResponseAt,
          lastResponseAt: s.lastResponseAt,
          // Alias para backward compat
          totalAssignments: totalRegistros,
          completedAssignments: s.efectivas,
          completionRate: totalRegistros > 0 ? Math.round((s.efectivas / totalRegistros) * 1000) / 10 : 0,
        }
      })
      .filter((s) => s.totalRegistros > 0)
      .sort((a, b) => b.efectivas - a.efectivas)

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
        const start = (r as any).started_at
        if (r.completed_at && start) {
          const diff = (new Date(r.completed_at).getTime() - new Date(start).getTime()) / 1000
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
          completionRate: s.total > 0 ? Math.round((s.completed / s.total) * 1000) / 10 : 0,
          avgTime: avgSecs > 0 ? `${m}:${String(sec).padStart(2, "0")}` : "—",
        }
      })
      .sort((a, b) => b.totalResponses - a.totalResponses)

    // zoneBreakdown, zonePolygons, responsePoints ya se calcularon arriba
    // (antes del early-return) para que el mapa funcione aunque no haya respuestas.

    return NextResponse.json({
      companies: (allCompanies || []).map((c: any) => ({ id: c.id, name: c.name })),
      projects: (allProjects || []).map((p: any) => ({ id: p.id, name: p.name, companyId: p.company_id })),
      surveys: (allSurveys || []).map((s: any) => ({ id: s.id, title: s.title, projectId: s.project_id })),
      surveyors: (allSurveyors || []).map((s: any) => ({ id: s.id, name: s.name, supervisorId: s.supervisor_id })),
      supervisors: (allSupervisors || []).map((s: any) => ({ id: s.id, name: s.name })),
      coordinators: (allCoordinators || []).map((c: any) => ({ id: c.id, name: c.name })),
      summary: {
        totalResponses,
        // Encuestadores con al menos un registro en el período/filtro actual
        // (pedido en reunión 2026-08-27: "indicador de los encuestadores").
        totalSurveyors: surveyorPerformance.length,
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
        descalificadas,
        incidenceBreakdown,
        tasaRespuestasEfectivas,
      },
      responses: { questionBreakdowns, filterableQuestions, crosstab },
      performance: { surveyorPerformance, dailyDistribution, surveyPerformance },
      geographic: { zoneBreakdown, zonePolygons, responsePoints },
      individual: { total: responses.length },
    })
  } catch (error) {
    console.error("Error en reports API:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
