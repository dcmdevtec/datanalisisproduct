import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { requireRole } from "@/lib/api-auth"

// Elimina UNA grabación de audio del portal de encuestador (surveyor_recordings)
// ligada a esta encuesta: borra el archivo en Storage (bucket 'response-media')
// y la fila en la base de datos. Usado por el botón "Eliminar" de la sección
// Grabaciones de Audio en app/surveys/[id]/page.tsx.
//
// SEGURIDAD (auditoría 2026-07-29): sin auth, cualquiera podía borrar
// grabaciones de encuestadores sin login.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; recordingId: string }> }) {
  const auth = await requireRole(["admin", "supervisor"])
  if (!auth.ok) return auth.response

  try {
    const { id: surveyId, recordingId } = await params
    const admin = createAdminSupabase() as any

    const { data: recording, error: fetchError } = await admin
      .from("surveyor_recordings")
      .select("id, storage_path, response_id")
      .eq("id", recordingId)
      .maybeSingle()

    if (fetchError || !recording) {
      return NextResponse.json({ error: "Grabación no encontrada" }, { status: 404 })
    }

    // Verificar que la grabación realmente pertenezca a una respuesta de ESTA
    // encuesta (no confiar solo en el recordingId — evita que alguien borre
    // grabaciones de otra encuesta cambiando el id en la URL).
    if (!recording.response_id) {
      return NextResponse.json({ error: "La grabación no pertenece a esta encuesta" }, { status: 403 })
    }
    const { data: response } = await admin
      .from("responses")
      .select("survey_id")
      .eq("id", recording.response_id)
      .maybeSingle()

    if (!response || response.survey_id !== surveyId) {
      return NextResponse.json({ error: "La grabación no pertenece a esta encuesta" }, { status: 403 })
    }

    if (recording.storage_path) {
      const { error: storageError } = await admin.storage.from("response-media").remove([recording.storage_path])
      if (storageError) {
        // No bloqueamos el borrado del registro por esto (ej. el archivo ya no
        // existía en Storage) — se registra para diagnóstico.
        console.error("Error eliminando archivo de audio de Storage:", recordingId, storageError.message)
      }
    }

    const { error: deleteError } = await admin.from("surveyor_recordings").delete().eq("id", recordingId)
    if (deleteError) {
      return NextResponse.json({ error: "No se pudo eliminar la grabación", details: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error("Error en DELETE /api/surveys/[id]/recordings/[recordingId]:", error)
    return NextResponse.json({ error: "Error interno del servidor", details: error?.message || String(error) }, { status: 500 })
  }
}
