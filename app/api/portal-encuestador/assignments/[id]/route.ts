import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { resolveCurrentSurveyor } from "@/lib/portal-encuestador/auth"

// Dado un survey_id (el segmento :id de esta ruta), verifica que el
// encuestador logueado tenga una asignación activa para esa encuesta y
// devuelve el assignmentId correspondiente. Mismo patrón de ownership que
// app/api/portal-encuestador/surveys/route.ts, pero para un solo registro.
//
// Por qué por survey_id y no por assignment_id: la ruta que consume este
// endpoint es /portal-encuestador/encuesta/[surveyId] — se eligió surveyId
// como segmento de URL (no assignmentId) para que el motor de encuestas
// compartido (app/preview/survey/page.tsx) infiera correctamente el
// survey_id a partir del pathname, tal como ya hace en /encuesta/[id]
// público, sin necesitar tocar esa lógica interna.
//
// Fuente de la asignación: survey_surveyor_zones, NO la tabla legacy
// `assignments` (nunca poblada por ningún flujo real — ver
// sql/2026_07_fix_assignment_source_table.sql). El `id` que se devuelve acá
// como assignmentId es survey_surveyor_zones.id, que es a lo que ahora
// apunta responses.assignment_id tras esa migración. Si el encuestador
// tiene varias filas de zona para la misma encuesta, se toma la más
// reciente — cualquiera es válida como referencia, solo se necesita UNA
// fila real que pruebe la asignación.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const surveyor = await resolveCurrentSurveyor()
    if (!surveyor) {
      return NextResponse.json({ error: "No autorizado o encuestador no vinculado" }, { status: 401 })
    }

    const { id: surveyId } = await params
    // El join anidado (zones/surveys) hace que TS infiera 'never' en el tipo
    // de retorno generado de Supabase para esta consulta — se castea a any
    // igual que en el resto de endpoints nuevos del portal de encuestador.
    const admin = createAdminSupabase() as any

    const { data: assignment, error } = await admin
      .from("survey_surveyor_zones")
      .select("id, survey_id, zone_id, general_status, zones(id, name), surveys(id, title, description, status)")
      .eq("survey_id", surveyId)
      .eq("surveyor_id", surveyor.surveyorId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !assignment) {
      return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 })
    }

    const survey = (assignment as any).surveys
    if (!survey || survey.status !== "active") {
      return NextResponse.json({ error: "Esta encuesta ya no está activa" }, { status: 404 })
    }

    return NextResponse.json({
      assignmentId: assignment.id,
      surveyId: survey.id,
      title: survey.title,
      description: survey.description,
      zoneName: assignment.general_status ? "Todas las zonas" : ((assignment as any).zones?.name ?? "Sin zona asignada"),
    })
  } catch (error) {
    console.error("Error en portal-encuestador/assignments/[id] GET:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
