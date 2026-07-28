import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server"

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const { id: responseId } = await params
    const admin = createAdminSupabase()

    const { data: response, error: responseError } = await admin
      .from("responses")
      .select(
        "id, survey_id, assignment_id, created_at, completed_at, status, outcome, incidence_type, respondent_name, respondent_document_type, location, surveys(title, description), assignments(surveyor_id, surveyors(name))"
      )
      .eq("id", responseId)
      .single()

    if (responseError || !response) {
      return NextResponse.json({ error: "Respuesta no encontrada" }, { status: 404 })
    }
    const r: any = response

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

    const questions = answerList
      .filter((a: any) => a.questions !== null)
      .map((a: any) => {
        const q = a.questions
        const media = mediaByAnswerId[a.id] || []
        const audio = media.find((m) => m.type === "audio" && m.remoteUrl) || null
        return {
          questionId: q.id,
          text: q.text || "Sin texto",
          type: q.type,
          orderNum: q.order_num ?? 0,
          answer: extractValue(a.value),
          rawAnswer: a.value,
          audioUrl: audio?.remoteUrl ?? null,
        }
      })
      .sort((a, b) => a.orderNum - b.orderNum)

    const durationSecs = (r.completed_at && r.created_at)
      ? Math.round((new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()) / 1000)
      : null

    return NextResponse.json({
      id: r.id,
      surveyId: r.survey_id,
      surveyTitle: r.surveys?.title ?? "Sin título",
      surveyDescription: r.surveys?.description ?? null,
      surveyorName: r.assignments?.surveyors?.name ?? null,
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
