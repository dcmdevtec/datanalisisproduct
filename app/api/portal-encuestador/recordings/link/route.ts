import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { resolveCurrentSurveyor } from "@/lib/portal-encuestador/auth"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_IDS = 500

// Liga a una respuesta todos los segmentos de audio de un intento (ítem
// 26/11/2026). El portal acumula los ids de cada segmento abierto desde que
// el encuestador entró a la encuesta — incluidos los cortados por bloqueo de
// pantalla o por la rotación de 2 min, que al cerrarse aún no conocían su
// respuesta — y los manda acá al registrar la incidencia o al
// enviar/abandonar. Solo toca segmentos del propio encuestador que todavía
// no estén ligados a otra respuesta.
export async function POST(request: NextRequest) {
  try {
    const surveyor = await resolveCurrentSurveyor()
    if (!surveyor) {
      return NextResponse.json({ error: "No autorizado o encuestador no vinculado" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const responseId = body?.responseId
    const recordingIds = body?.recordingIds
    if (typeof responseId !== "string" || !UUID_RE.test(responseId)) {
      return NextResponse.json({ error: "responseId inválido" }, { status: 400 })
    }
    if (
      !Array.isArray(recordingIds) ||
      recordingIds.length === 0 ||
      recordingIds.length > MAX_IDS ||
      !recordingIds.every((id) => typeof id === "string" && UUID_RE.test(id))
    ) {
      return NextResponse.json({ error: "recordingIds inválido" }, { status: 400 })
    }

    const admin = createAdminSupabase() as any

    const { data: response } = await admin.from("responses").select("id").eq("id", responseId).maybeSingle()
    if (!response) {
      return NextResponse.json({ error: "Respuesta no encontrada" }, { status: 404 })
    }

    const { data: updated, error } = await admin
      .from("surveyor_recordings")
      .update({ response_id: responseId })
      .in("id", recordingIds)
      .eq("surveyor_id", surveyor.surveyorId)
      .is("response_id", null)
      .select("id")

    if (error) {
      console.error("Error ligando segmentos de audio a la respuesta:", error)
      return NextResponse.json({ error: "No se pudieron ligar los audios", details: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, linked: (updated || []).length })
  } catch (error: any) {
    console.error("Error en portal-encuestador/recordings/link POST:", error)
    return NextResponse.json({ error: "Error interno del servidor", details: error?.message || String(error) }, { status: 500 })
  }
}
