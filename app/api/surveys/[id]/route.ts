import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { requireRole } from "@/lib/api-auth"

// Cliente SSR de Supabase (sin helpers de nextjs)
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient<Database>(supabaseUrl, supabaseKey)
}

// GET encuesta por ID — INTENCIONALMENTE público, sin auth. app/encuesta/[id]/page.tsx
// (la toma de encuesta pública, respondentes anónimos vía QR/link) llama
// directamente a esta ruta para renderizar el formulario — gatearla rompería
// el flujo público de toma de encuesta. Exponer preguntas/opciones no es
// sensible por sí solo (a diferencia de datos de usuarios/ubicación/mensajes).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabaseClient()
  try {
    const { id } = await params
    // console.log(`GET /api/surveys/${id} - Obteniendo encuesta`)

    const { data, error } = await supabase
      .from("surveys")
      .select(`
    *, 
    questions (*),
    survey_sections (*),
    projects (
      id,
      name,
      companies (
        name,
        logo
      )
    )
  `)
      .eq("id", id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 })

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error en GET:", error)
    return NextResponse.json({ error: "Error al obtener la encuesta" }, { status: 500 })
  }
}

// PUT actualizar encuesta
// SEGURIDAD (auditoría 2026-07-29): el check anterior (`supabase.auth.getUser()`
// sobre un cliente de SERVICE ROLE, que no lee cookies de sesión) no
// resolvía realmente al usuario logueado — o siempre fallaba con 401, o
// dependía de que el caller reenviara un JWT que nada en el frontend envía.
// Se reemplaza por requireRole(), que sí lee la sesión real del navegador.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["admin", "supervisor"])
  if (!auth.ok) return auth.response

  const supabase = getSupabaseClient()
  try {
    const { id } = await params
    // console.log(`PUT /api/surveys/${id} - Actualizando encuesta`)

    const body = await request.json()
    const { title, description, questions, settings, deadline, status, start_date } = body

    const { data: existingSurvey, error: surveyCheckError } = await supabase
      .from("surveys")
      .select("id, created_by, status")
      .eq("id", id)
      .single()

    if (surveyCheckError) return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 })

    // Al pasar de "prueba" (draft) a "activa": las respuestas recopiladas
    // mientras se probaba la encuesta son basura de prueba, no datos reales —
    // se borran para que el reporte arranque en cero al salir a producción.
    // answers tiene ON DELETE CASCADE sobre response_id (ver schema.sql), así
    // que borrar responses ya limpia sus answers asociadas.
    if (existingSurvey.status === "draft" && status === "active") {
      const { error: wipeError } = await supabase.from("responses").delete().eq("survey_id", id)
      if (wipeError) {
        console.error("Error borrando respuestas de prueba al activar encuesta:", wipeError)
        return NextResponse.json({ error: "No se pudieron limpiar las respuestas de prueba antes de activar" }, { status: 500 })
      }
    }

    const { data: updatedSurvey, error: updateError } = await supabase
      .from("surveys")
      .update({
        title,
        description,
        settings,
        deadline,
        status,
        ...(start_date !== undefined ? { start_date } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    if (questions?.length > 0) {
      const { error: deleteError } = await supabase.from("questions").delete().eq("survey_id", id)

      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

      const questionsToInsert = questions.map((q: any, i: any) => ({
        survey_id: id,
        type: q.type,
        text: q.text,
        options: q.options || [],
        required: q.required || false,
        order_num: i + 1,
        settings: q.settings || {},
      }))

      const { error: insertError } = await supabase.from("questions").insert(questionsToInsert)

      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const { data: completeData, error: completeError } = await supabase
      .from("surveys")
      .select(`*, questions (*)`)
      .eq("id", id)
      .single()

    if (completeError) return NextResponse.json({ error: completeError.message }, { status: 500 })

    return NextResponse.json(completeData)
  } catch (error) {
    console.error("Error en PUT:", error)
    return NextResponse.json({ error: "Error al actualizar la encuesta" }, { status: 500 })
  }
}

// DELETE encuesta
// Mismo fix de seguridad que PUT arriba.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["admin", "supervisor"])
  if (!auth.ok) return auth.response

  const supabase = getSupabaseClient()
  try {
    const { id } = await params
    // console.log(`DELETE /api/surveys/${id} - Eliminando encuesta`)

    const { data: existingSurvey, error: surveyCheckError } = await supabase
      .from("surveys")
      .select("id, created_by")
      .eq("id", id)
      .single()

    if (surveyCheckError) return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 })

    // Borrar las grabaciones de audio del portal de encuestador (surveyor_recordings)
    // ligadas a las respuestas de esta encuesta ANTES de tocar `surveys`/`responses`.
    // El FK surveyor_recordings.response_id -> responses.id es ON DELETE SET NULL,
    // no CASCADE (ver sql/2026_07_surveyor_portal.sql) — si dejáramos que el
    // borrado de la encuesta cascadeara solo, estas filas quedarían huérfanas
    // (response_id en null) y el archivo de audio en Storage jamás se borraría.
    // También limpia (getSupabaseClient() ya usa la service role key, así que
    // tiene acceso a Storage).
    const { data: surveyResponses } = await supabase.from("responses").select("id").eq("survey_id", id)
    const responseIds = ((surveyResponses as any[]) || []).map((r) => r.id)

    if (responseIds.length > 0) {
      const { data: surveyRecordings } = await (supabase as any)
        .from("surveyor_recordings")
        .select("id, storage_path")
        .in("response_id", responseIds)

      const recordingList = (surveyRecordings as any[]) || []
      const storagePaths = recordingList.map((r) => r.storage_path).filter(Boolean)

      if (storagePaths.length > 0) {
        const { error: storageDeleteError } = await supabase.storage.from("response-media").remove(storagePaths)
        if (storageDeleteError) {
          console.error("Error eliminando audios de Storage al borrar la encuesta:", storageDeleteError.message)
          // No bloqueamos el borrado de la encuesta por esto — mejor una encuesta
          // borrada con algún archivo huérfano en Storage que no poder borrarla.
        }
      }

      if (recordingList.length > 0) {
        const { error: recordingsDeleteError } = await (supabase as any)
          .from("surveyor_recordings")
          .delete()
          .in("response_id", responseIds)
        if (recordingsDeleteError) {
          console.error("Error eliminando filas de surveyor_recordings al borrar la encuesta:", recordingsDeleteError.message)
        }
      }
    }

    const { error: questionsError } = await supabase.from("questions").delete().eq("survey_id", id)

    if (questionsError) return NextResponse.json({ error: questionsError.message }, { status: 500 })

    const { error: deleteError } = await supabase.from("surveys").delete().eq("id", id)

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error en DELETE:", error)
    return NextResponse.json({ error: "Error al eliminar la encuesta" }, { status: 500 })
  }
}
