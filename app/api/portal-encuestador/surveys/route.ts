import { NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { resolveCurrentSurveyor } from "@/lib/portal-encuestador/auth"

// Lista de encuestas del encuestador logueado — Y SOLO de él.
// La fuente de verdad es `assignments` (survey_id, surveyor_id, zone_id):
// si no hay un assignment para este surveyor_id, la encuesta no aparece,
// sin importar si está activa o si otros encuestadores sí la tienen.
// Esto es exactamente lo pedido: "no les debe aparecer una encuesta
// diferente si no la tienen asignada".
export async function GET() {
  try {
    const surveyor = await resolveCurrentSurveyor()
    if (!surveyor) {
      return NextResponse.json({ error: "No autorizado o encuestador no vinculado" }, { status: 401 })
    }

    const admin = createAdminSupabase()

    const { data: assignments, error } = await admin
      .from("assignments")
      .select("id, survey_id, zone_id, status, deadline, created_at, zones(id, name), surveys(id, title, description, status, deadline, logo)")
      .eq("surveyor_id", surveyor.surveyorId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching assignments for surveyor portal:", error)
      return NextResponse.json({ error: "Error al cargar encuestas" }, { status: 500 })
    }

    const items = ((assignments as any[]) || [])
      // Solo mostramos encuestas activas — una encuesta en borrador/archivada
      // no debería aparecer como disponible para trabajar en campo.
      .filter((a) => a.surveys && (a.surveys.status === "active"))
      .map((a) => ({
        assignmentId: a.id,
        surveyId: a.surveys.id,
        title: a.surveys.title,
        description: a.surveys.description,
        logo: a.surveys.logo,
        zoneId: a.zones?.id ?? null,
        zoneName: a.zones?.name ?? "Sin zona asignada",
        assignmentStatus: a.status,
        deadline: a.deadline ?? a.surveys.deadline ?? null,
      }))

    return NextResponse.json({ surveyorName: surveyor.name, items })
  } catch (error) {
    console.error("Error en portal-encuestador/surveys API:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
