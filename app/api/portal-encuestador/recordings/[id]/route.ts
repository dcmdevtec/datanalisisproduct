import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { resolveCurrentSurveyor } from "@/lib/portal-encuestador/auth"

// Finaliza un segmento de grabación: recibe el blob de audio (multipart/form-data,
// campo "file") y lo sube al bucket privado 'response-media', actualiza el
// registro con la ruta de storage, duración y estado.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const surveyor = await resolveCurrentSurveyor()
    if (!surveyor) {
      return NextResponse.json({ error: "No autorizado o encuestador no vinculado" }, { status: 401 })
    }
    const { id: recordingId } = await params
    // surveyor_recordings es tabla nueva (ver sql/2026_07_surveyor_portal.sql), aún no
    // presente en los tipos generados de Supabase — se castea a any en este archivo.
    const admin = createAdminSupabase() as any

    const { data: recording } = await admin
      .from("surveyor_recordings")
      .select("id, shift_id, scope, response_id, started_at")
      .eq("id", recordingId)
      .eq("surveyor_id", surveyor.surveyorId)
      .maybeSingle()

    if (!recording) {
      return NextResponse.json({ error: "Segmento de grabación no encontrado" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const durationSecsRaw = formData.get("durationSecs")
    const durationSecs = durationSecsRaw ? parseInt(String(durationSecsRaw), 10) : null
    // responseId opcional: se conoce recién cuando la encuesta se envía o se
    // registra su abandono/incidencia — llega en ese momento, no al abrir.
    const responseIdRaw = formData.get("responseId")
    const responseId = responseIdRaw ? String(responseIdRaw) : null
    const responseIdPatch = responseId && recording.scope === "survey" ? { response_id: responseId } : {}

    if (!file || file.size === 0) {
      // Segmento vacío (ej. usuario cerró sesión sin grabar nada útil) — se marca sin audio.
      await admin.from("surveyor_recordings").update({
        ended_at: new Date().toISOString(),
        upload_status: "failed",
        ...responseIdPatch,
      }).eq("id", recordingId)
      return NextResponse.json({ ok: true, uploaded: false })
    }

    const ext = file.type.includes("mp4") ? "mp4" : file.type.includes("ogg") ? "ogg" : "webm"
    const path = `surveyor-recordings/${surveyor.surveyorId}/${recording.shift_id}/${recordingId}.${ext}`

    const { error: uploadError } = await admin.storage
      .from("response-media")
      .upload(path, file, { upsert: true, contentType: file.type || "audio/webm" })

    if (uploadError) {
      console.error("Error subiendo segmento de audio:", uploadError)
      await admin.from("surveyor_recordings").update({
        ended_at: new Date().toISOString(),
        upload_status: "failed",
        ...responseIdPatch,
      }).eq("id", recordingId)
      // Se expone el mensaje real del error de Storage (antes solo se veía
      // en logs del servidor, inaccesibles para el equipo sin dashboard de
      // Vercel/Supabase) — este endpoint solo lo usan encuestadores
      // autenticados del propio portal, no es público.
      return NextResponse.json({ error: "No se pudo subir el audio", details: uploadError.message }, { status: 500 })
    }

    const { error: updateError } = await admin.from("surveyor_recordings").update({
      ended_at: new Date().toISOString(),
      storage_path: path,
      duration_secs: durationSecs,
      upload_status: "uploaded",
      ...responseIdPatch,
    }).eq("id", recordingId)

    if (updateError) {
      console.error("Error actualizando surveyor_recordings tras subir el audio:", updateError)
      return NextResponse.json({ error: "Audio subido pero no se pudo actualizar el registro", details: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, uploaded: true })
  } catch (error: any) {
    console.error("Error en portal-encuestador/recordings/[id] PATCH:", error)
    return NextResponse.json({ error: "Error interno del servidor", details: error?.message || String(error) }, { status: 500 })
  }
}
