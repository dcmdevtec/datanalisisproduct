import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { resolveCurrentSurveyor } from "@/lib/portal-encuestador/auth"
import { resolveOutcome } from "@/lib/report-outcome"

// Indicadores de la pantalla principal del portal (pptx slide 2):
// Total Registros, Encuestas Efectivas, Incidencias, Encuestas Abandonadas,
// Descalificadas, última fecha de actualización, con filtro de rango de fechas.
//
// Bug (reporte 2026-08-31, screenshot del portal): a "descalificado" (salto
// de lógica "Descalificar y terminar", ver lib/report-outcome.ts) le faltaba
// su propio indicador acá — cualquier respuesta con ese outcome caía en el
// `else` y se contaba como "abandonada", igual que en el módulo de Reportes
// del admin antes de agregarse "descalificadas" ahí (app/api/reports/route.ts).
export async function GET(request: NextRequest) {
  try {
    const surveyor = await resolveCurrentSurveyor()
    if (!surveyor) {
      return NextResponse.json({ error: "No autorizado o encuestador no vinculado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateFromParam = searchParams.get("dateFrom")
    const dateToParam = searchParams.get("dateTo")

    const admin = createAdminSupabase()

    // Resuelve qué respuestas pertenecen a este encuestador vía sus
    // asignaciones en survey_surveyor_zones (fuente real — no la tabla
    // legacy `assignments`, ver sql/2026_07_fix_assignment_source_table.sql).
    // responses.assignment_id apunta a survey_surveyor_zones.id desde esa migración.
    const { data: assignments } = await admin
      .from("survey_surveyor_zones")
      .select("id")
      .eq("surveyor_id", surveyor.surveyorId)
    const assignmentIds = ((assignments as any[]) || []).map((a) => a.id)

    if (assignmentIds.length === 0) {
      return NextResponse.json({
        surveyorName: surveyor.name,
        totalRegistros: 0, efectivas: 0, incidencias: 0, abandonadas: 0, descalificadas: 0,
        lastUpdatedAt: null,
      })
    }

    let query = admin
      .from("responses")
      .select("id, status, outcome, created_at, completed_at, updated_at")
      .in("assignment_id", assignmentIds)

    if (dateFromParam) {
      const d = new Date(dateFromParam)
      if (!isNaN(d.getTime())) query = query.gte("created_at", d.toISOString())
    }
    if (dateToParam) {
      const d = new Date(dateToParam)
      if (!isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); query = query.lte("created_at", d.toISOString()) }
    }

    const { data: responses } = await query
    const list = (responses as any[]) || []

    let efectivas = 0, incidencias = 0, abandonadas = 0, descalificadas = 0
    let lastUpdatedAt: string | null = null
    for (const r of list) {
      const outcome = resolveOutcome(r)
      if (outcome === "efectiva") efectivas++
      else if (outcome === "incidencia") incidencias++
      else if (outcome === "descalificado") descalificadas++
      else abandonadas++
      const updated = r.updated_at || r.completed_at || r.created_at
      if (updated && (!lastUpdatedAt || new Date(updated) > new Date(lastUpdatedAt))) {
        lastUpdatedAt = updated
      }
    }

    return NextResponse.json({
      surveyorName: surveyor.name,
      totalRegistros: list.length,
      efectivas,
      incidencias,
      abandonadas,
      descalificadas,
      lastUpdatedAt,
    })
  } catch (error) {
    console.error("Error en portal-encuestador/dashboard API:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
