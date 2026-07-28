import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server"

// Lista paginada de respuestas individuales (pptx slide 22: "Respuestas Individuales").
// Reutiliza exactamente los mismos filtros globales del módulo de Reportes
// (empresa/proyecto/encuesta/encuestador/tipo/rango de fechas) para que la
// pestaña quede consistente con el resto de pestañas.
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

    let query = admin
      .from("responses")
      .select(
        "id, survey_id, assignment_id, created_at, completed_at, status, outcome, incidence_type, respondent_name, respondent_document_type, location, surveys(title), assignments(surveyor_id, surveyors(name))",
        { count: "exact" }
      )
    if (filteredSurveyIds !== null) query = query.in("survey_id", filteredSurveyIds)
    if (filteredAssignmentIds !== null) query = query.in("assignment_id", filteredAssignmentIds)
    if (dateFrom) query = query.gte("created_at", dateFrom.toISOString())
    if (dateTo) query = query.lte("created_at", dateTo.toISOString())

    query = query.order("created_at", { ascending: false })

    // Cuando hay filtro de tipo, no podemos paginar en SQL puro porque el outcome
    // puede depender del fallback (status). Traemos una ventana generosa, filtramos
    // en memoria y recortamos a la página pedida. Para datasets muy grandes esto es
    // un costo aceptado hasta que 'outcome' esté poblado consistentemente por la APK
    // (momento en el que se puede filtrar 100% en SQL con .eq('outcome', tipoFilter)).
    if (tipoFilter !== "all") {
      const { data: allMatching } = await query.limit(5000)
      const filtered = ((allMatching as any[]) || []).filter((r: any) => resolveOutcome(r) === tipoFilter)
      const total = filtered.length
      const start = (page - 1) * pageSize
      const pageItems = filtered.slice(start, start + pageSize)
      return NextResponse.json({
        items: pageItems.map((r: any) => mapListItem(r)),
        total,
        page,
        pageSize,
      })
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    const { data, count } = await query.range(from, to)

    return NextResponse.json({
      items: ((data as any[]) || []).map((r: any) => mapListItem(r)),
      total: count ?? 0,
      page,
      pageSize,
    })
  } catch (error) {
    console.error("Error en reports/individual API:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

function mapListItem(r: any) {
  const durationSecs = (r.completed_at && r.created_at)
    ? Math.round((new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()) / 1000)
    : null
  return {
    id: r.id,
    surveyId: r.survey_id,
    surveyTitle: r.surveys?.title ?? "Sin título",
    surveyorName: r.assignments?.surveyors?.name ?? null,
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
