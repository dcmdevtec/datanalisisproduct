import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"

// ─── Helpers (idénticos a reports/route.ts para consistencia) ────────────────
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

function resolveOutcome(r: { outcome?: string | null; status?: string | null }) {
  if (r.outcome === "efectiva" || r.outcome === "incidencia" || r.outcome === "abandonada") return r.outcome
  return r.status === "completed" ? "efectiva" : "abandonada"
}

// ─── GET /api/public-report/[token] — sin autenticación ──────────────────────
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> | { token: string } }
) {
  const params = await Promise.resolve(context.params)
  const { token } = params as { token: string }
  if (!token) return NextResponse.json({ error: "Token inválido." }, { status: 400 })

  const admin = createAdminSupabase()

  // 1. Buscar el shared_report por token
  // (cast a any: shared_reports es tabla nueva, aún no está en los tipos generados)
  const { data: share, error: shareErr } = await (admin as any)
    .from("shared_reports")
    .select("id, survey_id, config, expires_at")
    .eq("token", token)
    .maybeSingle()

  if (shareErr || !share) {
    return NextResponse.json({ error: "Link no encontrado o inválido." }, { status: 404 })
  }

  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return NextResponse.json({ error: "Este link ha expirado." }, { status: 410 })
  }

  const config: any = (share as any).config || {}
  const surveyId: string = (share as any).survey_id
  const filters = config.filters || {}
  const sections = config.sections || { resumen: true, analisis: true, rendimiento: false, geografico: false }
  // null = todas las preguntas, array = filtrar solo esas
  const allowedQuestionIds: string[] | null = config.questionIds ?? null

  // 2. Metadata de la encuesta
  const { data: survey } = await admin
    .from("surveys")
    .select("id, title, description")
    .eq("id", surveyId)
    .maybeSingle()

  // 3. Fetch responses
  let responsesQuery = admin
    .from("responses")
    .select("id, survey_id, created_at, completed_at, status, outcome, assignment_id")
    .eq("survey_id", surveyId)

  if (filters.dateFrom) responsesQuery = responsesQuery.gte("created_at", filters.dateFrom)
  if (filters.dateTo) responsesQuery = responsesQuery.lte("created_at", filters.dateTo + "T23:59:59")

  const { data: rawResponses } = await responsesQuery.order("created_at", { ascending: false })
  let responses: any[] = (rawResponses as any[]) || []

  // Filter by tipo
  if (filters.tipo && filters.tipo !== "all") {
    responses = responses.filter((r: any) => resolveOutcome(r) === filters.tipo)
  }

  const responseIds = responses.map((r: any) => r.id)
  const responseById: Record<string, any> = {}
  for (const r of responses) responseById[r.id] = r

  // 4. Fetch answers (for question breakdowns)
  let answers: any[] = []
  if (responseIds.length > 0 && (sections.analisis !== false)) {
    const batchSize = 200
    for (let i = 0; i < responseIds.length; i += batchSize) {
      const batch = responseIds.slice(i, i + batchSize)
      const { data: batchAnswers } = await admin
        .from("answers")
        .select("id, response_id, question_id, value, questions(id, text, type, options, section_id)")
        .in("response_id", batch)
        .limit(5000)
      if (batchAnswers) {
        answers.push(...(batchAnswers as any[]).filter((a: any) => a.questions !== null))
      }
    }
  }

  // 5. Summary stats
  const totalResponses = responses.length
  const completedResponses = responses.filter((r: any) => r.status === "completed").length
  const completionRate = totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 100) : 0

  let efectivas = 0, incidencias = 0, abandonadas = 0
  for (const r of responses) {
    const outcome = resolveOutcome(r)
    if (outcome === "efectiva") efectivas++
    else if (outcome === "incidencia") incidencias++
    else abandonadas++
  }
  const tasaRespuestasEfectivas = totalResponses > 0 ? Math.round((efectivas / totalResponses) * 100) : 0

  const timeDiffs: number[] = []
  for (const r of responses) {
    if (resolveOutcome(r) !== "efectiva") continue
    if (r.completed_at && r.created_at) {
      const diff = (new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()) / 1000
      if (diff > 0 && diff < 7200) timeDiffs.push(diff)
    }
  }
  const avgSeconds = timeDiffs.length > 0 ? Math.round(timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length) : 0
  const avgTime = `${Math.floor(avgSeconds / 60)}m ${avgSeconds % 60}s`

  // NPS
  let nps: number | null = null
  const ratingAnswers = answers.filter((a: any) => a.questions && (a.questions.type === "rating" || a.questions.type === "nps"))
  if (ratingAnswers.length > 0) {
    let promoters = 0, detractors = 0, total = 0
    for (const a of ratingAnswers) {
      const val = extractNumeric(a.value)
      if (val === null) continue
      total++
      if (val >= 9) promoters++
      else if (val <= 6) detractors++
    }
    if (total > 0) nps = Math.round(((promoters - detractors) / total) * 100)
  }

  // Timeline
  const responsesByDay: Record<string, number> = {}
  for (const r of responses) {
    const day = new Date(r.created_at).toISOString().slice(0, 10)
    responsesByDay[day] = (responsesByDay[day] || 0) + 1
  }
  const responsesTimeline = Object.entries(responsesByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))

  // 6. Question breakdowns (Análisis de resultados)
  const questionMap: Record<string, { text: string; type: string; options: any[]; answers: any[]; days: string[] }> = {}
  for (const a of answers) {
    const q = a.questions
    if (!q) continue
    // Filtrar por preguntas seleccionadas si se especificaron
    if (allowedQuestionIds !== null && !allowedQuestionIds.includes(q.id)) continue
    if (!questionMap[q.id]) {
      questionMap[q.id] = { text: q.text || "Sin texto", type: q.type, options: q.options || [], answers: [], days: [] }
    }
    questionMap[q.id].answers.push(a.value)
    const parentResponse = responseById[a.response_id]
    if (parentResponse?.created_at) {
      questionMap[q.id].days.push(new Date(parentResponse.created_at).toISOString().slice(0, 10))
    }
  }

  // Build breakdowns (simplified — same logic as reports/route.ts)
  const questionBreakdowns = Object.entries(questionMap).map(([qId, qData]) => {
    const { text, type, options, answers: qAnswers } = qData
    const totalAnswered = qAnswers.length

    if (["multiple_choice", "single_choice", "dropdown", "radio", "checkbox"].includes(type)) {
      const counts: Record<string, number> = {}
      if (options?.length > 0) {
        for (const opt of options) {
          const label = typeof opt === "string" ? opt : opt?.label || opt?.value || String(opt)
          counts[label] = 0
        }
      }
      for (const val of qAnswers) {
        const extracted = extractValue(val)
        const vals = Array.isArray(extracted) ? extracted : [extracted]
        for (const v of vals) { if (v !== "") counts[v] = (counts[v] || 0) + 1 }
      }
      const choices = Object.entries(counts)
        .map(([label, count]) => ({ label, count, percentage: totalAnswered > 0 ? Math.round((count / totalAnswered) * 100) : 0 }))
        .sort((a, b) => b.count - a.count)
      return { questionId: qId, text, type, totalAnswered, choices, numericStats: null, textAnswers: [] }
    }

    if (["rating", "nps", "likert", "scale"].includes(type)) {
      const nums = qAnswers.map(extractNumeric).filter((n): n is number => n !== null)
      const avg = nums.length > 0 ? parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)) : 0
      const min = nums.length > 0 ? Math.min(...nums) : 0
      const max = nums.length > 0 ? Math.max(...nums) : 0
      const sorted = [...nums].sort((a, b) => a - b)
      const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0
      const dist: Record<number, number> = {}
      for (const n of nums) dist[n] = (dist[n] || 0) + 1
      const distribution = Object.entries(dist)
        .map(([value, count]) => ({ value: Number(value), count, percentage: nums.length > 0 ? Math.round((count / nums.length) * 100) : 0 }))
        .sort((a, b) => a.value - b.value)
      return { questionId: qId, text, type, totalAnswered, choices: [], numericStats: { avg, min, max, median, distribution }, textAnswers: [] }
    }

    if (["text", "long_text", "textarea", "open"].includes(type)) {
      const texts = qAnswers.map((v) => {
        const e = extractValue(v)
        return Array.isArray(e) ? e.join(", ") : e
      }).filter((s) => s !== "").slice(0, 50)
      return { questionId: qId, text, type, totalAnswered, choices: [], numericStats: null, textAnswers: texts }
    }

    return { questionId: qId, text, type, totalAnswered, choices: [], numericStats: null, textAnswers: [] }
  }).filter((q) => q.totalAnswered > 0)

  // 7. Performance (solo si sections.rendimiento está activo)
  let surveyorPerformance: any[] = []
  if (sections.rendimiento) {
    const { data: rawAssignments } = await admin
      .from("assignments")
      .select("id, survey_id, surveyor_id, surveyors(id, name)")
      .eq("survey_id", surveyId)

    const assignmentById: Record<string, any> = {}
    for (const a of (rawAssignments as any[] || [])) assignmentById[a.id] = a

    const surveyorMap: Record<string, { name: string; efectivas: number; incidencias: number; abandonadas: number; totalRegistros: number }> = {}
    for (const r of responses) {
      const assignment = assignmentById[r.assignment_id]
      if (!assignment?.surveyors) continue
      const sid = assignment.surveyor_id
      const sname = assignment.surveyors?.name || "Desconocido"
      if (!surveyorMap[sid]) surveyorMap[sid] = { name: sname, efectivas: 0, incidencias: 0, abandonadas: 0, totalRegistros: 0 }
      const outcome = resolveOutcome(r)
      surveyorMap[sid].totalRegistros++
      if (outcome === "efectiva") surveyorMap[sid].efectivas++
      else if (outcome === "incidencia") surveyorMap[sid].incidencias++
      else surveyorMap[sid].abandonadas++
    }
    surveyorPerformance = Object.values(surveyorMap).map((s) => ({
      ...s,
      tasaRespuestas: s.totalRegistros > 0 ? Math.round((s.efectivas / s.totalRegistros) * 100) : 0,
      completionRate: s.totalRegistros > 0 ? Math.round((s.efectivas / s.totalRegistros) * 100) : 0,
    })).sort((a, b) => b.efectivas - a.efectivas)
  }

  return NextResponse.json({
    meta: {
      surveyTitle: survey?.title || config.surveyTitle || "Encuesta",
      surveyDescription: survey?.description || config.surveyDescription || "",
      sections,
      expiresAt: share.expires_at,
    },
    summary: {
      totalResponses,
      completionRate,
      avgTime,
      nps,
      efectivas,
      incidencias,
      abandonadas,
      tasaRespuestasEfectivas,
      responsesTimeline,
    },
    questionBreakdowns,
    surveyorPerformance,
  })
}
