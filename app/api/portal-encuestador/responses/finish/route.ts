import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { resolveCurrentSurveyor } from "@/lib/portal-encuestador/auth"

// Crea la fila en `responses` para los casos que NUNCA pasan por
// POST /api/responses (que requiere al menos una respuesta contestada):
// una incidencia (vivienda cerrada, rechazo, etc. — pptx slide 3) o un
// abandono a mitad de encuesta (pptx slide 4). En ambos casos no hay
// preguntas respondidas, solo se necesita dejar constancia del intento y
// devolver un response_id real para poder ligar el segmento de audio
// grabado (ver app/api/portal-encuestador/recordings/[id]/route.ts).
const VALID_OUTCOMES = ["incidencia", "abandonada"] as const

export async function POST(request: NextRequest) {
  try {
    const surveyor = await resolveCurrentSurveyor()
    if (!surveyor) {
      return NextResponse.json({ error: "No autorizado o encuestador no vinculado" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { assignmentId, outcome, incidenceType, location } = body as {
      assignmentId?: string
      outcome?: string
      incidenceType?: string
      location?: any
    }

    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId es requerido" }, { status: 400 })
    }
    if (!outcome || !VALID_OUTCOMES.includes(outcome as any)) {
      return NextResponse.json({ error: "outcome debe ser 'incidencia' o 'abandonada'" }, { status: 400 })
    }
    if (outcome === "incidencia" && !incidenceType) {
      return NextResponse.json({ error: "incidenceType es requerido cuando outcome='incidencia'" }, { status: 400 })
    }

    const admin = createAdminSupabase() as any

    // Verifica que la encuesta pertenezca a este encuestador (misma zona/asignación).
    // Fuente: survey_surveyor_zones, no la tabla legacy `assignments` — ver
    // sql/2026_07_fix_assignment_source_table.sql. El assignmentId que llega
    // acá es survey_surveyor_zones.id (lo devuelve
    // GET /api/portal-encuestador/assignments/[surveyId]).
    const { data: assignment } = await admin
      .from("survey_surveyor_zones")
      .select("id, survey_id")
      .eq("id", assignmentId)
      .eq("surveyor_id", surveyor.surveyorId)
      .maybeSingle()

    if (!assignment) {
      return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 })
    }

    const insertPayload: any = {
      survey_id: assignment.survey_id,
      respondent_id: null,
      location: location || null,
      status: "completed",
      completed_at: new Date().toISOString(),
      assignment_id: assignment.id,
      outcome,
      ...(outcome === "incidencia" ? { incidence_type: incidenceType } : {}),
    }

    const { data: responseData, error } = await admin
      .from("responses")
      .insert(insertPayload)
      .select("id")
      .single()

    if (error || !responseData) {
      console.error("Error creando respuesta de incidencia/abandono:", error)
      return NextResponse.json({ error: error?.message || "No se pudo registrar" }, { status: 500 })
    }

    return NextResponse.json({ success: true, response_id: responseData.id })
  } catch (error) {
    console.error("Error en portal-encuestador/responses/finish POST:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
