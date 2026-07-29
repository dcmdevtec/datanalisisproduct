import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"

// Endpoint PÚBLICO (sin auth) para la vista de resultados compartible de UNA
// encuesta (pptx slide 21: "compartir un link para que la persona que lo tenga
// pueda verlo en línea", al estilo de la página de resultados de SurveyMonkey).
//
// Deliberadamente NO expone nada a nivel de respuesta individual (nombres,
// documentos, ubicación, audio) — solo agregados por pregunta (igual que la
// pestaña "Análisis de resultados" del panel de administración), porque
// cualquiera con el link puede abrir esta página.
//
// Código duplicado a propósito respecto a /api/reports (mismo patrón usado en
// /api/reports/individual/[id]): aislar la ruta pública evita que un cambio
// futuro en la lógica de admin filtre datos aquí sin querer.

function extractValue(val: any): string | string[] {
  if (val === null || val === undefined) return ""
  if (typeof val === "string") return val
  if (typeof val === "number" || typeof val === "boolean") return String(val)
  if (Array.isArray(val)) return val.map((v) => extractValue(v) as string)
  if (typeof val === "object") {
    if (val.value !== undefined) return extractValue(val.value)
    if (val.label !== undefined) return extractValue(val.label)
    if (val.text !== undefined) return extractValue(val.text)
    if (val.option !== undefined) return extractValue(val.option)
    const vals = Object.values(val).filter((v) => v !== null && v !== undefined && v !== "")
    if (vals.length > 0) return vals.map((v) => extractValue(v) as string).join(", ")
    return ""
  }
  return String(val)
}

function extractNumeric(val: any): number | null {
  if (typeof val === "number") return val
  if (typeof val === "string") { const n = Number(val); return isNaN(n) ? null : n }
  if (typeof val === "object" && val !== null) {
    if (val.value !== undefined) return extractNumeric(val.value)
    if (val.rating !== undefined) return extractNumeric(val.rating)
    if (val.score !== undefined) return extractNumeric(val.score)
  }
  return null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: surveyId } = await params
    const admin = createAdminSupabase() as any

    const { data: survey, error: surveyError } = await admin
      .from("surveys")
      .select("id, title, description, status")
      .eq("id", surveyId)
      .maybeSingle()

    if (surveyError || !survey) {
      return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 })
    }

    // SEGURIDAD (auditoría 2026-07-29): antes se consultaba `status` pero
    // nunca se comparaba contra nada — cualquier encuesta, incluida un
    // borrador (`draft`) o una de prueba (`prueba`), era públicamente
    // visible en el momento en que alguien conociera su UUID (y esos UUID ya
    // aparecen en URLs internas autenticadas, no son verdaderamente
    // secretos). Solo se permite el link público para encuestas que ya
    // están corriendo o cerradas: active | completed | archived.
    const shareableStatuses = ["active", "completed", "archived"]
    if (!shareableStatuses.includes((survey as any).status)) {
      return NextResponse.json({ error: "Esta encuesta no tiene resultados disponibles públicamente" }, { status: 403 })
    }

    const { data: responses } = await admin
      .from("responses")
      .select("id, created_at")
      .eq("survey_id", surveyId)

    const responseList = (responses as any[]) || []
    const totalResponses = responseList.length

    let answers: any[] = []
    const responseIds = responseList.map((r) => r.id)
    if (responseIds.length > 0) {
      const batchSize = 200
      for (let i = 0; i < responseIds.length; i += batchSize) {
        const batch = responseIds.slice(i, i + batchSize)
        const { data: batchAnswers } = await admin
          .from("answers")
          .select("id, response_id, question_id, value, questions(id, text, type, options, order_num)")
          .in("response_id", batch)
          .limit(5000)
        if (batchAnswers) answers.push(...batchAnswers.filter((a: any) => a.questions !== null))
      }
    }

    const responseById: Record<string, any> = {}
    for (const r of responseList) responseById[r.id] = r

    const questionMap: Record<string, { text: string; type: string; orderNum: number; answers: any[]; days: string[] }> = {}
    for (const a of answers) {
      const q = a.questions
      if (!q) continue
      if (!questionMap[q.id]) {
        questionMap[q.id] = { text: q.text || "Sin texto", type: q.type, orderNum: q.order_num || 0, answers: [], days: [] }
      }
      questionMap[q.id].answers.push(a.value)
      const parentResponse = responseById[a.response_id]
      if (parentResponse?.created_at) {
        questionMap[q.id].days.push(new Date(parentResponse.created_at).toISOString().slice(0, 10))
      }
    }

    const questionBreakdowns = Object.entries(questionMap)
      .map(([qId, qData]) => {
        const { text, type, orderNum, answers: qAnswers, days } = qData

        const dayCounts: Record<string, number> = {}
        for (const d of days) dayCounts[d] = (dayCounts[d] || 0) + 1
        const timeline = Object.entries(dayCounts)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, count]) => ({ date, count }))

        if (["multiple_choice", "single_choice", "dropdown", "radio", "checkbox"].includes(type)) {
          const counts: Record<string, number> = {}
          for (const rawVal of qAnswers) {
            const extracted = extractValue(rawVal)
            const vals = Array.isArray(extracted) ? extracted : [extracted]
            for (const v of vals) {
              if (v === "") continue
              counts[v] = (counts[v] || 0) + 1
            }
          }
          const total = qAnswers.length || 1
          const distribution = Object.entries(counts)
            .map(([label, count]) => ({ label, count, percentage: Math.round((count / total) * 100) }))
            .sort((a, b) => b.count - a.count)
          return { questionId: qId, text, type, orderNum, totalAnswers: qAnswers.length, distribution, timeline }
        }

        if (type === "rating" || type === "nps" || type === "likert" || type === "scale") {
          const nums = qAnswers.map(extractNumeric).filter((n): n is number => n !== null)
          const avg = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "0"
          const counts: Record<string, number> = {}
          for (const n of nums) counts[String(n)] = (counts[String(n)] || 0) + 1
          const distribution = Object.entries(counts)
            .map(([label, count]) => ({ label, count, percentage: Math.round((count / (nums.length || 1)) * 100) }))
            .sort((a, b) => Number(a.label) - Number(b.label))
          return { questionId: qId, text, type, orderNum, totalAnswers: qAnswers.length, average: avg, distribution, timeline }
        }

        // Preguntas de texto abierto: no se listan respuestas individuales en la
        // vista pública (podrían contener información sensible) — solo el total.
        return { questionId: qId, text, type, orderNum, totalAnswers: qAnswers.length, distribution: [], timeline }
      })
      .sort((a, b) => a.orderNum - b.orderNum)

    return NextResponse.json({
      survey: { id: survey.id, title: survey.title, description: survey.description },
      totalResponses,
      questionBreakdowns,
    })
  } catch (error: any) {
    console.error("Error en /api/reports/public/[id]:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
