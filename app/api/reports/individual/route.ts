import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server"
import { requireRole } from "@/lib/api-auth"
import { resolveOutcome } from "@/lib/report-outcome"

// Lista paginada de respuestas individuales (pptx slide 22: "Respuestas Individuales").
// Reutiliza exactamente los mismos filtros globales del módulo de Reportes
// (empresa/proyecto/encuesta/encuestador/tipo/rango de fechas) para que la
// pestaña quede consistente con el resto de pestañas.
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

    // CORRECCIÓN (2026-08-12): el filtro por encuestador consultaba la tabla
    // `assignments` que nunca se llena en producción (ver comentario en
    // app/api/portal-encuestador/assignments/[id]/route.ts). El portal guarda
    // responses.assignment_id = survey_surveyor_zones.id. Se corrige el filtro
    // para buscar en survey_surveyor_zones primero y en assignments como fallback.
    let filteredAssignmentIds: string[] | null = null
    if (surveyorFilter !== "all") {
      // 1️⃣ survey_surveyor_zones (flujo real del portal encuestador)
      let sszQuery = (admin as any)
        .from("survey_surveyor_zones")
        .select("id")
        .eq("surveyor_id", surveyorFilter)
      if (filteredSurveyIds !== null) sszQuery = sszQuery.in("survey_id", filteredSurveyIds)
      const { data: sszMatching } = await sszQuery
      filteredAssignmentIds = ((sszMatching as any[]) || []).map((a) => a.id)

      // 2️⃣ Fallback: assignments legacy
      let aq = admin.from("assignments").select("id").eq("surveyor_id", surveyorFilter)
      if (filteredSurveyIds !== null) aq = aq.in("survey_id", filteredSurveyIds)
      const { data: matching } = await aq
      const legacyIds = ((matching as any[]) || []).map((a: any) => a.id)
      for (const id of legacyIds) {
        if (!filteredAssignmentIds.includes(id)) filteredAssignmentIds.push(id)
      }

      if (filteredAssignmentIds.length === 0) {
        return NextResponse.json({ items: [], total: 0, page, pageSize })
      }
    }

    // CORRECCIÓN: el nested join assignments(surveyor_id, surveyors(name)) con
    // count:"exact" puede fallar silenciosamente en Supabase/PostgREST cuando
    // hay respuestas con assignment_id=null (enviadas desde APK sin asignación),
    // retornando 0 resultados aunque existan registros. Se separa el lookup de
    // nombres de encuestadores en un paso post-proceso para evitar ese problema.
    // metadata incluye surveyor_id (APK) y respondent_name (APK) — ambos
    // se usan en mapListItem cuando assignment_id es null (respuestas APK).
    let query = admin
      .from("responses")
      .select(
        "id, survey_id, assignment_id, created_at, completed_at, started_at, status, outcome, incidence_type, respondent_name, respondent_document_type, respondent_id, location, metadata, surveys(title)",
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
    // ── Lookup 1: encuestadores por assignment_id (portal web, SSZ) ────────────
    const assignmentIds = [...new Set(rawData.map((r: any) => r.assignment_id).filter(Boolean))]
    const surveyorInfoByAssignmentId: Record<string, { name: string | null; email: string | null }> = {}
    if (assignmentIds.length > 0) {
      // survey_surveyor_zones (flujo real del portal encuestador)
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
      // Fallback: assignments legacy
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

    // ── Lookup 2: encuestadores por metadata.surveyor_id (APK, sin assignment) ─
    // La APK guarda el auth user id en responses.metadata->>'surveyor_id'.
    // Cuando assignment_id es null Y metadata tiene surveyor_id, lo usamos para
    // resolver el nombre del encuestador directo de la tabla surveyors.
    const surveyorInfoBySurveyorId: Record<string, { name: string | null; email: string | null }> = {}
    const metaSurveyorIds = [
      ...new Set(
        rawData
          .filter((r: any) => !r.assignment_id && r.metadata?.surveyor_id)
          .map((r: any) => r.metadata.surveyor_id as string)
      )
    ]
    if (metaSurveyorIds.length > 0) {
      const { data: surveyorRows } = await (admin as any)
        .from("surveyors")
        .select("id, name, email")
        .in("id", metaSurveyorIds)
      for (const s of (surveyorRows as any[]) || []) {
        surveyorInfoBySurveyorId[s.id] = { name: s.name ?? null, email: s.email ?? null }
      }
    }

    // ── Lookup 3: encuestadores por respondent_id (web autenticada sin
    // assignment ni metadata.surveyor_id — ej. app/surveys/[id]/collect). Se
    // resuelve igual que resolveCurrentSurveyor(): 1) surveyors.user_id =
    // respondent_id, 2) fallback surveyors.id = respondent_id.
    const surveyorInfoByRespondentId: Record<string, { name: string | null; email: string | null }> = {}
    const respondentIdsNeedingSurveyor = [
      ...new Set(
        rawData
          .filter((r: any) => !r.assignment_id && !r.metadata?.surveyor_id && r.respondent_id)
          .map((r: any) => r.respondent_id as string)
      )
    ]
    if (respondentIdsNeedingSurveyor.length > 0) {
      const { data: byUserId } = await (admin as any)
        .from("surveyors")
        .select("id, user_id, name, email")
        .in("user_id", respondentIdsNeedingSurveyor)
      const resolvedIds = new Set<string>()
      for (const s of (byUserId as any[]) || []) {
        surveyorInfoByRespondentId[s.user_id] = { name: s.name ?? null, email: s.email ?? null }
        resolvedIds.add(s.user_id)
      }
      const remaining = respondentIdsNeedingSurveyor.filter((id) => !resolvedIds.has(id))
      if (remaining.length > 0) {
        const { data: byLegacyId } = await (admin as any)
          .from("surveyors")
          .select("id, name, email")
          .in("id", remaining)
        for (const s of (byLegacyId as any[]) || []) {
          surveyorInfoByRespondentId[s.id] = { name: s.name ?? null, email: s.email ?? null }
        }
      }
    }

    // Barrio / Ciudad-Municipio (reunión 2026-08-27): se sacan de la respuesta
    // a una pregunta tipo "location" (mismo shape que usa el detalle en
    // app/api/reports/individual/[id]/route.ts — {ciudad, barrio, lat, lng}),
    // no de responses.location (que solo trae lat/lng crudos del GPS del
    // dispositivo, sin geocodificar).
    const responseIds = rawData.map((r: any) => r.id)
    const locationByResponseId: Record<string, { ciudad: string | null; barrio: string | null }> = {}
    if (responseIds.length > 0) {
      const { data: locationAnswers } = await (admin as any)
        .from("answers")
        .select("response_id, value, questions!inner(type)")
        .in("response_id", responseIds)
        .eq("questions.type", "location")
        .limit(2000)
      for (const a of (locationAnswers as any[]) || []) {
        if (locationByResponseId[a.response_id]) continue // ya resuelto (primera pregunta location gana)
        const val = a.value
        if (!val || typeof val !== "object") continue
        locationByResponseId[a.response_id] = {
          ciudad: val.ciudad || null,
          barrio: val.barrio || null,
        }
      }
    }

    return NextResponse.json({
      items: rawData.map((r: any) => mapListItem(r, surveyorInfoByAssignmentId, surveyorInfoBySurveyorId, surveyorInfoByRespondentId, locationByResponseId[r.id])),
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
  surveyorInfoByAssignmentId: Record<string, { name: string | null; email: string | null }> = {},
  surveyorInfoBySurveyorId:  Record<string, { name: string | null; email: string | null }> = {},
  surveyorInfoByRespondentId: Record<string, { name: string | null; email: string | null }> = {},
  locationInfo?: { ciudad: string | null; barrio: string | null }
) {
  // started_at = inicio real de la respuesta. created_at/completed_at se
  // setean casi al mismo tiempo (al enviar), por eso no sirven para medir
  // duración — ver misma corrección en app/api/reports/route.ts.
  const durationSecs = (r.completed_at && r.started_at)
    ? Math.max(0, Math.round((new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 1000))
    : null

  // Encuestador: 1) asignación de zona (portal web), 2) metadata.surveyor_id
  // (APK), 3) respondent_id (web autenticada sin asignación, ej. .../collect)
  let surveyorInfo: { name: string | null; email: string | null } | null = null
  if (r.assignment_id) {
    surveyorInfo = surveyorInfoByAssignmentId[r.assignment_id] ?? null
  }
  if (!surveyorInfo?.name && r.metadata?.surveyor_id) {
    surveyorInfo = surveyorInfoBySurveyorId[r.metadata.surveyor_id] ?? null
  }
  if (!surveyorInfo?.name && r.respondent_id) {
    surveyorInfo = surveyorInfoByRespondentId[r.respondent_id] ?? null
  }

  // Nombre del encuestado: 1) columna respondent_name (portal web),
  // 2) metadata.respondent_name (APK — la APK lo guarda ahí porque la columna
  //    responses.respondent_name no siempre se llena desde el dispositivo).
  const respondentName: string | null =
    r.respondent_name
    ?? (typeof r.metadata?.respondent_name === "string" ? r.metadata.respondent_name : null)
    ?? null

  return {
    id: r.id,
    surveyId: r.survey_id,
    surveyTitle: r.surveys?.title ?? "Sin título",
    surveyorName:  surveyorInfo?.name  ?? null,
    surveyorEmail: surveyorInfo?.email ?? null,
    respondentName,
    createdAt: r.created_at,
    startedAt: r.started_at ?? null,
    completedAt: r.completed_at,
    durationSecs,
    status: r.status,
    outcome: resolveOutcome(r),
    incidenceType: r.incidence_type ?? null,
    hasLocation: !!(r.location && typeof r.location === "object"),
    ciudad: locationInfo?.ciudad ?? null,
    barrio: locationInfo?.barrio ?? null,
  }
}
