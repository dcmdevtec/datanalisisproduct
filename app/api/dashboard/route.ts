import { NextResponse } from "next/server"
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server"
import { requirePermission } from "@/lib/api-auth"

// SEGURIDAD (auditoría 2026-07-29): verificaba sesión pero no rol — un
// encuestador autenticado podía consultar analítica de toda la organización.
//
// CORRECCIÓN (auditoría 2026-08-30): requireRole(["admin","supervisor"]) se
// quedó desactualizado — Reportes, Tracking y Mensajes ya suman
// "coordinator" desde la reunión del 27 ago, pero acá se olvidó. Un
// coordinador podía ver Reportes pero le rebotaba el Dashboard. Se
// reemplaza por requirePermission("dashboard","view"), que en
// lib/permissions.ts sí incluye a coordinator por default.
export async function GET() {
  try {
    const auth = await requirePermission("dashboard", "view")
    if (!auth.ok) return auth.response

    const supabase = await createServerSupabase()
    const admin = createAdminSupabase()

    // Run all queries in parallel
    const [
      surveysRes,
      surveyorsRes,
      responsesRes,
      zonesRes,
      recentResponsesRes,
      assignmentsRes,
    ] = await Promise.all([
      // Total surveys
      admin.from("surveys").select("id, status, created_at", { count: "exact", head: false }),
      // Active surveyors
      admin.from("surveyors").select("id, status", { count: "exact", head: false }),
      // Total responses
      admin.from("responses").select("id, created_at, survey_id", { count: "exact", head: false }),
      // Active zones
      admin.from("zones").select("id, name, status", { count: "exact", head: false }),
      // Recent responses with survey + respondent info (for activity feed)
      admin
        .from("responses")
        .select("id, created_at, status, respondent_name, respondent_document_type, survey_id, surveys(title)")
        .order("created_at", { ascending: false })
        .limit(10),
      // Assignments with zone info for completion rates
      admin
        .from("assignments")
        .select("id, status, zone_id, zones(name)")
        .not("zone_id", "is", null),
    ])

    // --- KPI Cards ---
    const totalSurveys = surveysRes.count ?? surveysRes.data?.length ?? 0
    const activeSurveyors =
      surveyorsRes.data?.filter((s: any) => s.status === "active").length ?? 0
    const totalResponses = responsesRes.count ?? responsesRes.data?.length ?? 0
    const activeZones =
      zonesRes.data?.filter((z: any) => z.status === "active").length ?? 0

    // Comparison metrics: surveys created this month vs last month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const surveysThisMonth =
      surveysRes.data?.filter(
        (s: any) => new Date(s.created_at) >= startOfMonth
      ).length ?? 0
    const surveysLastMonth =
      surveysRes.data?.filter(
        (s: any) =>
          new Date(s.created_at) >= startOfLastMonth &&
          new Date(s.created_at) < startOfMonth
      ).length ?? 0
    const surveyGrowth =
      surveysLastMonth > 0
        ? Math.round(((surveysThisMonth - surveysLastMonth) / surveysLastMonth) * 100)
        : surveysThisMonth > 0
          ? 100
          : 0

    // Responses this week vs last week
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const startOfLastWeek = new Date(startOfWeek)
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)

    const responsesThisWeek =
      responsesRes.data?.filter(
        (r: any) => new Date(r.created_at) >= startOfWeek
      ).length ?? 0
    const responsesLastWeek =
      responsesRes.data?.filter(
        (r: any) =>
          new Date(r.created_at) >= startOfLastWeek &&
          new Date(r.created_at) < startOfWeek
      ).length ?? 0
    const responseGrowth =
      responsesLastWeek > 0
        ? Math.round(((responsesThisWeek - responsesLastWeek) / responsesLastWeek) * 100)
        : responsesThisWeek > 0
          ? 100
          : 0

    // New surveyors this week
    const newSurveyorsThisWeek =
      surveyorsRes.data?.filter(
        (s: any) => s.status === "active"
      ).length ?? 0

    // New zones this week
    const newZonesThisWeek =
      zonesRes.data?.filter(
        (z: any) => z.status === "active"
      ).length ?? 0

    // --- Recent Activity ---
    const recentActivity = (recentResponsesRes.data || []).map((r: any) => {
      const surveyTitle = r.surveys?.title || "Encuesta"
      const name = r.respondent_name || "Encuestado anónimo"
      const createdAt = new Date(r.created_at)
      return {
        user: name,
        action: `Respondió "${surveyTitle}"`,
        time: createdAt.toISOString(),
      }
    })

    // --- Zone Completion Rates ---
    const zoneMap: Record<string, { total: number; completed: number; name: string }> = {}
    for (const a of assignmentsRes.data || []) {
      const zoneId = a.zone_id as string
      const zoneName = (a.zones as any)?.name || zoneId
      if (!zoneMap[zoneId]) {
        zoneMap[zoneId] = { total: 0, completed: 0, name: zoneName }
      }
      zoneMap[zoneId].total++
      if (a.status === "completed") {
        zoneMap[zoneId].completed++
      }
    }

    // If no assignment data, build from zones table directly
    let zoneCompletionRates = Object.values(zoneMap)
      .map((z) => ({
        zone: z.name,
        completion: z.total > 0 ? Math.round((z.completed / z.total) * 100) : 0,
        total: z.total,
        completed: z.completed,
      }))
      .sort((a, b) => b.completion - a.completion)

    if (zoneCompletionRates.length === 0 && zonesRes.data) {
      zoneCompletionRates = zonesRes.data
        .filter((z: any) => z.status === "active")
        .map((z: any) => ({
          zone: z.name,
          completion: 0,
          total: 0,
          completed: 0,
        }))
    }

    return NextResponse.json({
      kpis: {
        totalSurveys,
        surveyGrowth,
        activeSurveyors,
        newSurveyorsThisWeek,
        totalResponses,
        responseGrowth,
        activeZones,
        newZonesThisWeek,
      },
      recentActivity,
      zoneCompletionRates,
    })
  } catch (error) {
    console.error("Error en dashboard API:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
