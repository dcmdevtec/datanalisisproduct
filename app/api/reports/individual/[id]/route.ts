import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server"
import { requireRole } from "@/lib/api-auth"

// Detalle de una respuesta individual (pptx slide 22): preguntas + respuestas
// de esa encuesta en particular, más audio si existe (tabla media_files,
// type='audio', enlazado por answer_id). No requiere ningún cambio de schema:
// media_files ya existe en la base de datos actual.
function extractValue(val: any): string {
  if (val === null || val === undefined) return ""
  if (typeof val === "string") return val
  if (typeof val === "number" || typeof val === "boolean") return String(val)
  if (Array.isArray(val)) return val.map(extractValue).join(", ")
  if (typeof val === "object") {
    if (val.value !== undefined) return extractValue(val.value)
    if (val.label !== undefined) return extractValue(val.label)
    if (val.text !== undefined) return extractValue(val.text)
    if (val.option !== undefined) return extractValue(val.option)
    const vals = Object.values(val).filter((v) => v !== null && v !== undefined && v !== "")
    if (vals.length > 0) return vals.map(extractValue).join(", ")
    return ""
  }
  return String(val)
}

function resolveOutcome(r: { outcome?: string | null; status?: string | null }): "efectiva" | "incidencia" | "abandonada" {
  if (r.outcome === "efectiva" || r.outcome === "incidencia" || r.outcome === "abandonada") return r.outcome
  return r.status === "completed" ? "efectiva" : "abandonada"
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
        "id, survey_id, assignment_id, created_at, completed_at, status, outcome, incidence_type, respondent_name, respondent_document_type, location, surveys(title, description)"
      )
      .eq("id", responseId)
      .single()

    if (responseError || !response) {
      console.error("Error fetching response detail:", responseError)
      return NextResponse.json({ error: "Respuesta no encontrada" }, { status: 404 })
    }
    const r: any = response

    // Lookup del nombre del encuestador por separado
    let surveyorName: string | null = null
    if (r.assignment_id) {
      const { data: assignment } = await (admin as any)
        .from("assignments")
        .select("surveyors(name)")
        .eq("id", r.assignment_id)
        .maybeSingle()
      surveyorName = (assignment as any)?.surveyors?.name ?? null
    }

    const { data: answers } = await admin
      .from("answers")
      .select("id, question_id, value, questions(id, text, type, options, order_num, section_id)")
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
            answer: extractValue(a.value),
            rawAnswer: a.value,
            audioUrl: audio?.remoteUrl ?? null,
            fileUrls,
          }
        })
    )).sort((a, b) => a.orderNum - b.orderNum)

    const durationSecs = (r.completed_at && r.created_at)
      ? Math.max(0, Math.round((new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()) / 1000))
      : null

    return NextResponse.json({
      id: r.id,
      surveyId: r.survey_id,
      surveyTitle: r.surveys?.title ?? "Sin título",
      surveyDescription: r.surveys?.description ?? null,
      surveyorName,
      respondentName: r.respondent_name ?? null,
      respondentDocumentType: r.respondent_document_type ?? null,
      createdAt: r.created_at,
      completedAt: r.completed_at,
      durationSecs,
      status: r.status,
      outcome: resolveOutcome(r),
      incidenceType: r.incidence_type ?? null,
      location: r.location ?? null,
      questions,
    })
  } catch (error) {
    console.error("Error en reports/individual/[id] API:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
