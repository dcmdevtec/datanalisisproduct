import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server"
import { requireRole } from "@/lib/api-auth"
import { resolveOutcome } from "@/lib/report-outcome"

// Detalle de una respuesta individual (pptx slide 22): preguntas + respuestas
// de esa encuesta en particular, más audio si existe (tabla media_files,
// type='audio', enlazado por answer_id). No requiere ningún cambio de schema:
// media_files ya existe en la base de datos actual.
function extractValue(val: any, questionType?: string): string {
  if (val === null || val === undefined) return ""
  if (typeof val === "string") return val
  if (typeof val === "number" || typeof val === "boolean") return String(val)
  if (Array.isArray(val)) return val.map(v => extractValue(v)).join(", ")
  if (typeof val === "object") {
    // Pregunta de ubicación GPS — mostrar solo los campos geográficos, no lat/lng crudos
    if (questionType === "location" || (val.lat !== undefined && val.lng !== undefined && (val.ciudad !== undefined || val.pais !== undefined))) {
      const parts = [val.ciudad, val.barrio, val.localidad, val.departamento, val.pais]
        .filter((s) => s && String(s).trim())
        .map((s) => String(s).trim())
      const coords = `(${Number(val.lat).toFixed(5)}, ${Number(val.lng).toFixed(5)})`
      return parts.length > 0 ? `${parts.join(", ")} ${coords}` : coords
    }
    if (val.value !== undefined) return extractValue(val.value)
    if (val.label !== undefined) return extractValue(val.label)
    if (val.text !== undefined) return extractValue(val.text)
    if (val.option !== undefined) return extractValue(val.option)
    const vals = Object.values(val).filter((v) => v !== null && v !== undefined && v !== "")
    if (vals.length > 0) return vals.map(v => extractValue(v)).join(", ")
    return ""
  }
  return String(val)
}

// SEGURIDAD (auditoría 2026-07-29): verificaba sesión pero no rol.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(["admin", "supervisor"])
    if (!auth.ok) return auth.response

    const { id: responseId } = await params
    const admin = createAdminSupabase()

    // CORRECCIÓN: mismo bug que el list — el nested join
    // assignments(surveyor_id, surveyors(name)) falla con .single() cuando
    // la respuesta no tiene assignment_id (enviada desde APK sin asignación),
    // retornando error y por lo tanto 404. Se separa el nombre del encuestador.
    const { data: response, error: responseError } = await admin
      .from("responses")
      .select(
        "id, survey_id, assignment_id, created_at, completed_at, started_at, status, outcome, incidence_type, respondent_name, respondent_document_type, location, surveys(title, description)"
      )
      .eq("id", responseId)
      .single()

    if (responseError || !response) {
      console.error("Error fetching response detail:", responseError)
      return NextResponse.json({ error: "Respuesta no encontrada" }, { status: 404 })
    }
    const r: any = response

    // Lookup del encuestador — mismo fix que el list API (2026-08-12):
    // responses.assignment_id apunta a survey_surveyor_zones.id, no a assignments.id.
    let surveyorName: string | null = null
    let surveyorEmail: string | null = null
    if (r.assignment_id) {
      // 1️⃣ survey_surveyor_zones (flujo real del portal encuestador)
      const { data: sszRow } = await (admin as any)
        .from("survey_surveyor_zones")
        .select("id, surveyors(id, name, email)")
        .eq("id", r.assignment_id)
        .maybeSingle()
      if (sszRow?.surveyors) {
        surveyorName = (sszRow as any).surveyors?.name ?? null
        surveyorEmail = (sszRow as any).surveyors?.email ?? null
      } else {
        // 2️⃣ Fallback: assignments legacy
        const { data: assignment } = await (admin as any)
          .from("assignments")
          .select("surveyors(name, email)")
          .eq("id", r.assignment_id)
          .maybeSingle()
        surveyorName = (assignment as any)?.surveyors?.name ?? null
        surveyorEmail = (assignment as any)?.surveyors?.email ?? null
      }
    }

    const { data: answers } = await admin
      .from("answers")
      .select("id, question_id, value, questions(id, text, type, options, order_num, section_id, matrix_rows, matrix_cols, settings)")
      .eq("response_id", responseId)

    const answerList = (answers as any[]) || []
    const answerIds = answerList.map((a: any) => a.id)

    // Audio (y cualquier otro media) ligado a las respuestas de esta encuesta.
    let mediaByAnswerId: Record<string, { type: string; remoteUrl: string | null; localPath: string | null }[]> = {}
    if (answerIds.length > 0) {
      const { data: media } = await admin
        .from("media_files")
        .select("answer_id, type, remote_url, local_path")
        .in("answer_id", answerIds)
      for (const m of (media as any[]) || []) {
        if (!mediaByAnswerId[m.answer_id]) mediaByAnswerId[m.answer_id] = []
        mediaByAnswerId[m.answer_id].push({ type: m.type, remoteUrl: m.remote_url, localPath: m.local_path })
      }
    }

    const questions = (await Promise.all(
      answerList
        .filter((a: any) => a.questions !== null)
        .map(async (a: any) => {
          const q = a.questions
          const media = mediaByAnswerId[a.id] || []
          const audio = media.find((m) => m.type === "audio" && m.remoteUrl) || null

          // Preguntas tipo archivo/foto (auditoría 2026-07-29): el valor
          // real ahora es un arreglo de descriptores {status:'uploaded',
          // path, name, type} (ver app/api/response-files/upload/route.ts
          // y app/preview/survey/page.tsx). Se generan URLs firmadas de
          // corta duración (1h) para poder verlas/descargarlas desde el
          // panel — el bucket 'response-media' es privado, igual que las
          // grabaciones de audio (mismo patrón que
          // app/api/surveys/[id]/recordings/route.ts).
          let fileUrls: { name: string; url: string | null; type: string; path?: string }[] = []
          if (q.type === "file" || q.type === "image_upload") {
            // Normaliza el valor al formato [{path, name, type}]. Soporta 3 formatos:
            // 1. JSON array de objetos: [{status:'uploaded', path, name, type}] — formato web actual
            // 2. String CSV del APK: "nombre.jpg, survey-responses/..., size, image/jpeg, uploaded"
            // 3. String CSV sin path (APK local antes de subir): "file:///..., nombre.jpg, size, type"
            const normalizeToFileList = (val: any): { path: string; name: string; type: string }[] => {
              if (Array.isArray(val)) {
                return val
                  .filter((f: any) => f && typeof f === "object" && typeof f.path === "string" && f.path.startsWith("survey-responses/"))
                  .map((f: any) => ({ path: f.path, name: f.name || f.path.split("/").pop() || "", type: f.type || "image/jpeg" }))
              }
              if (typeof val === "string" && val.trim()) {
                // APK format: "filename, survey-responses/..., size, mimetype, status"
                const parts = val.split(",").map((s) => s.trim())
                const pathPart = parts.find((p) => p.startsWith("survey-responses/"))
                if (pathPart) {
                  const name = parts[0] || pathPart.split("/").pop() || ""
                  const type = parts.find((p) => p.startsWith("image/") || p === "application/pdf") || "image/jpeg"
                  return [{ path: pathPart, name, type }]
                }
                // Local APK path (file:///...) — no se puede resolver, skip
              }
              return []
            }

            const fileList = normalizeToFileList(a.value)
            fileUrls = await Promise.all(
              fileList.map(async (f) => {
                const { data: signed } = await admin.storage.from("response-media").createSignedUrl(f.path, 3600)
                return { name: f.name, url: signed?.signedUrl ?? null, type: f.type, path: f.path }
              })
            )
          }

          return {
            questionId: q.id,
            answerId: a.id,
            text: q.text || "Sin texto",
            type: q.type,
            orderNum: q.order_num ?? 0,
            answer: extractValue(a.value, q.type),
            rawAnswer: a.value,
            matrixRows: q.matrix_rows || q.settings?.matrixRows || null,
            matrixCols: q.matrix_cols || q.settings?.matrixCols || null,
            audioUrl: audio?.remoteUrl ?? null,
            fileUrls,
          }
        })
    )).sort((a, b) => a.orderNum - b.orderNum)

    const durationSecs = (r.completed_at && r.started_at)
      ? Math.max(0, Math.round((new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 1000))
      : null

    // Extraer nombre del encuestado desde pregunta contact_info si respondent_name es null.
    // El APK solo popula respondent_name cuando hay docType + docNum (ver /api/responses/route.ts).
    // Si solo hay nombre sin documento, lo rescatamos aquí directamente de la respuesta.
    let respondentName: string | null = r.respondent_name ?? null
    let respondentContact: { email?: string; phone?: string; documentType?: string; documentNumber?: string } | null = null
    if (!respondentName) {
      const contactAnswer = questions.find((q) => q.type === "contact_info")
      if (contactAnswer?.rawAnswer && typeof contactAnswer.rawAnswer === "object") {
        const val = contactAnswer.rawAnswer as any
        const fullName = val.fullName || [val.firstName, val.lastName].filter(Boolean).join(" ").trim() || null
        if (fullName) respondentName = fullName
        respondentContact = {
          email: val.email || undefined,
          phone: val.phone || undefined,
          documentType: val.documentType || undefined,
          documentNumber: val.documentNumber || undefined,
        }
      }
    }

    // Grabación del portal encuestador para esta respuesta específica.
    // surveyor_recordings.response_id es el vínculo. Puede no existir si:
    // (a) la encuesta fue tomada desde la vista previa web (no el portal),
    // (b) la tabla surveyor_recordings no existe todavía en la DB,
    // (c) allowAudio=false, o (d) el upload falló.
    let surveyorRecording: { audioUrl: string | null; durationSecs: number | null; startedAt: string | null } | null = null
    try {
      const { data: recRow } = await (admin as any)
        .from("surveyor_recordings")
        .select("id, storage_path, duration_secs, started_at, upload_status")
        .eq("response_id", responseId)
        .eq("scope", "survey")
        .eq("upload_status", "uploaded")
        .limit(1)
        .maybeSingle() as { data: { storage_path: string; duration_secs: number | null; started_at: string | null } | null }

      if (recRow?.storage_path) {
        const { data: signed } = await admin.storage
          .from("response-media")
          .createSignedUrl(recRow.storage_path, 3600)
        surveyorRecording = {
          audioUrl: signed?.signedUrl ?? null,
          durationSecs: recRow.duration_secs ?? null,
          startedAt: recRow.started_at ?? null,
        }
      }
    } catch {
      // Silencioso: surveyor_recordings podría no existir todavía
    }

    return NextResponse.json({
      id: r.id,
      surveyId: r.survey_id,
      surveyTitle: r.surveys?.title ?? "Sin título",
      surveyDescription: r.surveys?.description ?? null,
      surveyorName,
      surveyorEmail,
      respondentName,
      respondentContact,
      respondentDocumentType: r.respondent_document_type ?? null,
      createdAt: r.created_at,
      completedAt: r.completed_at,
      durationSecs,
      status: r.status,
      outcome: resolveOutcome(r),
      incidenceType: r.incidence_type ?? null,
      location: r.location ?? null,
      surveyorRecording,
      questions,
    })
  } catch (error) {
    console.error("Error en reports/individual/[id] API:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// PATCH /api/reports/individual/[id] — edita el valor de UNA respuesta a una
// pregunta puntual de esta encuesta (reunión 2026-08-27: "Tener la opción de
// editar las respuestas por pregunta de una encuesta"). Body:
// { answerId: string, value: any }. Mismo rol que el GET (admin/supervisor):
// corregir un dato mal digitado en campo es trabajo de supervisión, no algo
// tan destructivo como borrar la encuesta completa (eso sí queda solo para
// admin, ver DELETE más abajo).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(["admin", "supervisor"])
    if (!auth.ok) return auth.response

    const { id: responseId } = await params
    const body = await request.json().catch(() => null)
    const answerId = body?.answerId
    if (!answerId || typeof answerId !== "string") {
      return NextResponse.json({ error: "answerId es requerido" }, { status: 400 })
    }
    if (!("value" in (body ?? {}))) {
      return NextResponse.json({ error: "value es requerido" }, { status: 400 })
    }

    const admin = createAdminSupabase()

    // Confirmar que la respuesta (answer) realmente pertenece a esta
    // encuesta individual — sin esto, cualquier answerId válido de CUALQUIER
    // otra respuesta se podría sobreescribir desde este endpoint.
    const { data: answerRow, error: fetchError } = await admin
      .from("answers")
      .select("id, response_id")
      .eq("id", answerId)
      .maybeSingle()

    if (fetchError || !answerRow || (answerRow as any).response_id !== responseId) {
      return NextResponse.json({ error: "La respuesta no pertenece a esta encuesta" }, { status: 404 })
    }

    const { error: updateError } = await admin
      .from("answers")
      .update({ value: body.value })
      .eq("id", answerId)

    if (updateError) {
      console.error("Error actualizando answer:", updateError)
      return NextResponse.json({ error: "No se pudo guardar el cambio" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error en PATCH reports/individual/[id]:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// DELETE /api/reports/individual/[id] — elimina una respuesta individual
// completa (reunión 2026-08-27: "Tener la opción de Eliminar la encuesta
// individual"). Solo admin — un supervisor no debería poder borrar datos de
// campo, solo verlos. Borra en cascada: media_files ligados a las answers
// de esta respuesta, luego las answers, y por último la respuesta. No se
// borran los archivos del storage (fuera de alcance; quedan huérfanos, igual
// que ya pasa con handleDeleteFile en la UI de individual-responses-tab).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(["admin"])
    if (!auth.ok) return auth.response

    const { id: responseId } = await params
    const admin = createAdminSupabase()

    const { data: answerRows } = await admin.from("answers").select("id").eq("response_id", responseId)
    const answerIds = ((answerRows as any[]) || []).map((a) => a.id)

    if (answerIds.length > 0) {
      await admin.from("media_files").delete().in("answer_id", answerIds)
      await admin.from("answers").delete().in("id", answerIds)
    }

    const { error: deleteError } = await admin.from("responses").delete().eq("id", responseId)
    if (deleteError) {
      console.error("Error eliminando respuesta:", deleteError)
      return NextResponse.json({ error: "No se pudo eliminar la respuesta" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error en DELETE reports/individual/[id]:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
