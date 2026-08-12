import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server"
import { requireRole } from "@/lib/api-auth"

// Lista paginada de respuestas individuales (pptx slide 22: "Respuestas Individuales").
// Reutiliza exactamente los mismos filtros globales del módulo de Reportes
// (empresa/proyecto/encuesta/encuestador/tipo/rango de fechas) para que la
// pestaña quede consistente con el resto de pestañas.
function resolveOutcome(r: { outcome?: string | null; status?: string | null }): "efectiva" | "incidencia" | "abandonada" {
  if (r.outcome === "efectiva" || r.outcome === "incidencia" || r.outcome === "abandonada") return r.outcome
  return r.status === "completed" ? "efectiva" : "abandonada"
}

// SEGURIDAD (auditoría 2026-07-29): verificaba sesión pero no rol —
// exponía nombre/documento/respuestas individuales de respondentes a
// cualquier usuario autenticado, incl. encuestadores.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(["admin", "supervisor"])
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const companyFilter = searchParams.get("company") || "all"
    const projectFilter = searchParams.get("project") || "all"
    const surveyFilter = searchParams.get("survey") || "all"
    const surveyorFilter = searchParams.get("surveyor") || "all"
    const tipoFilter = searchParams.get("tipo") || "all"
    const dateFromParam = searchParams.get("dateFrom")
    const dateToParam = searchParams.get("dateTo")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10) || 25))

    const admin = createAdminSupabase()

    let dateFrom: Date | null = null
    let dateTo: Date | null = null
    if (dateFromParam) {
      const d = new Date(dateFromParam)
      if (!isNaN(d.getTime())) dateFrom = d
    }
    if (dateToParam) {
      const d = new Date(dateToParam)
      if (!isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); dateTo = d }
    }

    const { data: allProjects } = await admin.from("projects").select("id, company_id")
    const { data: allSurveys } = await admin.from("surveys").select("id, project_id")

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
      return NextResponse.json({ items: [], total: 0, page, pageSize })
    }

    let filteredAssignmentIds: string[] | null = null
    if (surveyorFilter !== "all") {
      let aq = admin.from("assignments").select("id").eq("surveyor_id", surveyorFilter)
      if (filteredSurveyIds !== null) aq = aq.in("survey_id", filteredSurveyIds)
      const { data: matching } = await aq
      filteredAssignmentIds = (matching || []).map((a: any) => a.id)
      if (filteredAssignmentIds.length === 0) {
        return NextResponse.json({ items: [], total: 0, page, pageSize })
      }
    }

    // CORRECCIÓN: el nested join assignments(surveyor_id, surveyors(name)) con
    // count:"exact" puede fallar silenciosamente en Supabase/PostgREST cuando
    // hay respuestas con assignment_id=null (enviadas desde APK sin asignación),
    // retornando 0 resultados aunque existan registros. Se separa el lookup de
    // nombres de encuestadores en un paso post-proceso para evitar ese problema.
    let query = admin
      .from("responses")
      .select(
        "id, survey_id, assignment_id, created_at, completed_at, status, outcome, incidence_type, respondent_name, respondent_document_type, location, surveys(title)",
        { count: "exact" }
      )
    if (filteredSurveyIds !== null) query = query.in("survey_id", filteredSurveyIds)
    if (filteredAssignmentIds !== null) query = query.in("assignment_id", filteredAssignmentIds)
    if (dateFrom) query = query.gte("created_at", dateFrom.toISOString())
    if (dateTo) query = query.lte("created_at", dateTo.toISOString())

    query = query.order("created_at", { ascending: false })

    // Cuando hay filtro de tipo, no podemos paginar en SQL puro porque el outcome
    // puede depender del fallback (status). Traemos una ventana generosa, filtramos
    // en memoria y recortamos a la página pedida.
    let rawData: any[]
    let totalCount: number

    if (tipoFilter !== "all") {
      const { data: allMatching, error: listErr } = await (query as any).limit(5000)
      if (listErr) {
        console.error("Error en reports/individual list (tipo filter):", listErr)
        return NextResponse.json({ items: [], total: 0, page, pageSize })
      }
      const filtered = ((allMatching as any[]) || []).filter((r: any) => resolveOutcome(r) === tipoFilter)
      totalCount = filtered.length
      const start = (page - 1) * pageSize
      rawData = filtered.slice(start, start + pageSize)
    } else {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, count, error: listErr } = await (query as any).range(from, to)
      if (listErr) {
        console.error("Error en reports/individual list:", listErr)
        return NextResponse.json({ items: [], total: 0, page, pageSize })
      }
      rawData = (data as any[]) || []
      totalCount = count ?? 0
    }

    // Lookup de nombres de encuestadores en batch (evita N+1 y el nested join problemático).
    // CORRECCIÓN (2026-08-12): el portal encuestador guarda en responses.assignment_id el id
    // de survey_surveyor_zones, NO de la tabla legacy `assignments` (que nunca se llena —
    // ver sql/2026_07_fix_assignment_source_table.sql y el comentario en
    // app/api/portal-encuestador/assignments/[id]/route.ts). El lookup anterior contra
    // `assignments` siempre retornaba vacío, causando que todos los encuestadores del portal
    // aparecieran como "Sin asignar" en Reportes.
    const assignmentIds = [...new Set(rawData.map((r: any) => r.assignment_id).filter(Boolean))]
    // surveyor_info_map: id de assignment → { name, email } del encuestador
    const surveyorInfoByAssignmentId: Record<string, { name: string | null; email: string | null }> = {}
    if (assignmentIds.length > 0) {
      // 1️⃣ survey_surveyor_zones (flujo real del portal encuestador)
      const { data: sszRows } = await (admin as any)
        .from("survey_surveyor_zones")
        .select("id, surveyor_id, surveyors(id, name, email)")
        .in("id", assignmentIds)
      for (const a of (sszRows as any[]) || []) {
        surveyorInfoByAssignmentId[a.id] = {
          name: a.surveyors?.name ?? null,
          email: a.surveyors?.email ?? null,
        }
      }
      // 2️⃣ Fallback: assignments legacy (por si migración parcial)
      const missing = assignmentIds.filter((id) => !surveyorInfoByAssignmentId[id])
      if (missing.length > 0) {
        const { data: assignmentRows } = await (admin as any)
          .from("assignments")
          .select("id, surveyors(name, email)")
          .in("id", missing)
        for (const a of (assignmentRows as any[]) || []) {
          surveyorInfoByAssignmentId[a.id] = {
            name: a.surveyors?.name ?? null,
            email: a.surveyors?.email ?? null,
          }
        }
      }
    }

    return NextResponse.json({
      items: rawData.map((r: any) => mapListItem(r, surveyorInfoByAssignmentId)),
      total: totalCount,
      page,
      pageSize,
    })
  } catch (error) {
    console.error("Error en reports/individual API:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

function mapListItem(
  r: any,
  surveyorInfoByAssignmentId: Record<string, { name: string | null; email: string | null }> = {}
) {
  const durationSecs = (r.completed_at && r.created_at)
    ? Math.max(0, Math.round((new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()) / 1000))
    : null
  const surveyorInfo = r.assignment_id ? (surveyorInfoByAssignmentId[r.assignment_id] ?? null) : null
  return {
    id: r.id,
    surveyId: r.survey_id,
    surveyTitle: r.surveys?.title ?? "Sin título",
    surveyorName: surveyorInfo?.name ?? null,
    surveyorEmail: surveyorInfo?.email ?? null,
    respondentName: r.respondent_name ?? null,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    durationSecs,
    status: r.status,
    outcome: resolveOutcome(r),
    incidenceType: r.incidence_type ?? null,
    hasLocation: !!(r.location && typeof r.location === "object"),
  }
}
