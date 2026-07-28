import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { resolveCurrentSurveyor } from "@/lib/portal-encuestador/auth"

// Crea un nuevo segmento de grabación (metadata primero, el audio se sube
// después vía PATCH /recordings/[id] cuando el segmento termina).
// scope='survey' requiere responseId — scope='shift' es un tramo de fondo
// entre encuestas y no lleva responseId.
export async function POST(request: NextRequest) {
  try {
    const surveyor = await resolveCurrentSurveyor()
    if (!surveyor) {
      return NextResponse.json({ error: "No autorizado o encuestador no vinculado" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { shiftId, scope, responseId } = body as { shiftId?: string; scope?: string; responseId?: string }

    if (!shiftId || (scope !== "shift" && scope !== "survey")) {
      return NextResponse.json({ error: "shiftId y scope ('shift'|'survey') son requeridos" }, { status: 400 })
    }
    if (scope === "survey" && !responseId) {
      return NextResponse.json({ error: "responseId es requerido cuando scope='survey'" }, { status: 400 })
    }

    // surveyor_shifts / surveyor_recordings son tablas nuevas (ver
    // sql/2026_07_surveyor_portal.sql), aún no presentes en los tipos generados
    // de Supabase — se castea a any en este archivo.
    const admin = createAdminSupabase() as any

    // Verifica que el turno pertenezca a este encuestador y siga activo.
    const { data: shift } = await admin
      .from("surveyor_shifts")
      .select("id, status")
      .eq("id", shiftId)
      .eq("surveyor_id", surveyor.surveyorId)
      .maybeSingle()
    if (!shift) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
    }

    const { data: created, error } = await admin
      .from("surveyor_recordings")
      .insert([{
        shift_id: shiftId,
        surveyor_id: surveyor.surveyorId,
        response_id: scope === "survey" ? responseId : null,
        scope,
        started_at: new Date().toISOString(),
        upload_status: "pending",
      }])
      .select("id, started_at")
      .single()

    if (error || !created) {
      console.error("Error creando segmento de grabación:", error)
      return NextResponse.json({ error: "No se pudo iniciar la grabación" }, { status: 500 })
    }

    return NextResponse.json({ recordingId: created.id, startedAt: created.started_at })
  } catch (error) {
    console.error("Error en portal-encuestador/recordings POST:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
