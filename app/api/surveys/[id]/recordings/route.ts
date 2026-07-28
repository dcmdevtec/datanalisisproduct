import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"

// Lista las grabaciones de audio del portal de encuestador ligadas a ESTA
// encuesta, para el módulo de detalle (app/surveys/[id]/page.tsx).
//
// surveyor_recordings no tiene survey_id directo — solo response_id (para
// scope='survey') o shift_id. La forma correcta de saber "qué grabaciones
// pertenecen a esta encuesta" es: responses.survey_id = este id -> tomar
// esos response_id -> buscar surveyor_recordings con scope='survey' y
// response_id en ese conjunto. Los segmentos scope='shift' (tiempos muertos
// entre encuestas del turno) deliberadamente NO se incluyen aquí: no están
// ligados a una encuesta específica, pertenecen al turno completo del
// encuestador, no a esta encuesta.
//
// Solo se listan segmentos con upload_status='uploaded' (los 'failed' o
// 'pending' no tienen audio real que reproducir) y se genera una URL firmada
// de corta duración por cada uno (bucket 'response-media' es privado).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: surveyId } = await params
    const admin = createAdminSupabase() as any

    const { data: responses, error: responsesError } = await admin
      .from("responses")
      .select("id, outcome, incidence_type, completed_at, created_at")
      .eq("survey_id", surveyId)

    if (responsesError) {
      console.error("Error obteniendo respuestas de la encuesta:", responsesError)
      return NextResponse.json({ error: "No se pudieron obtener las respuestas", details: responsesError.message }, { status: 500 })
    }

    const responseIds = (responses || []).map((r: any) => r.id)
    if (responseIds.length === 0) {
      return NextResponse.json({ recordings: [] })
    }

    const responseById = new Map<string, any>((responses || []).map((r: any) => [r.id, r]))

    const { data: recordings, error: recordingsError } = await admin
      .from("surveyor_recordings")
      .select("id, surveyor_id, response_id, started_at, ended_at, storage_path, duration_secs, upload_status")
      .in("response_id", responseIds)
      .eq("scope", "survey")
      .eq("upload_status", "uploaded")
      .order("started_at", { ascending: false })

    if (recordingsError) {
      console.error("Error obteniendo grabaciones:", recordingsError)
      return NextResponse.json({ error: "No se pudieron obtener las grabaciones", details: recordingsError.message }, { status: 500 })
    }

    if (!recordings || recordings.length === 0) {
      return NextResponse.json({ recordings: [] })
    }

    const surveyorIds = Array.from(new Set(recordings.map((r: any) => r.surveyor_id).filter(Boolean)))
    const { data: surveyors } = await admin
      .from("surveyors")
      .select("id, name, email")
      .in("id", surveyorIds)
    const surveyorById = new Map<string, any>((surveyors || []).map((s: any) => [s.id, s]))

    const items = await Promise.all(
      recordings.map(async (rec: any) => {
        let audioUrl: string | null = null
        if (rec.storage_path) {
          const { data: signed, error: signError } = await admin.storage
            .from("response-media")
            .createSignedUrl(rec.storage_path, 3600)
          if (signError) {
            console.error("Error firmando URL de grabación:", rec.id, signError.message)
          } else {
            audioUrl = signed?.signedUrl || null
          }
        }
        const surveyor = surveyorById.get(rec.surveyor_id)
        const response = responseById.get(rec.response_id)
        const ext = rec.storage_path ? rec.storage_path.split(".").pop() : "webm"
        return {
          id: rec.id,
          surveyorName: surveyor?.name || surveyor?.email || "Encuestador desconocido",
          outcome: response?.outcome || null,
          incidenceType: response?.incidence_type || null,
          startedAt: rec.started_at,
          endedAt: rec.ended_at,
          durationSecs: rec.duration_secs,
          audioUrl,
          fileName: `grabacion_${(surveyor?.name || "encuestador").replace(/\s+/g, "_")}_${rec.id.slice(0, 8)}.${ext}`,
        }
      })
    )

    return NextResponse.json({ recordings: items })
  } catch (error: any) {
    console.error("Error en /api/surveys/[id]/recordings:", error)
    return NextResponse.json({ error: "Error interno del servidor", details: error?.message || String(error) }, { status: 500 })
  }
}
