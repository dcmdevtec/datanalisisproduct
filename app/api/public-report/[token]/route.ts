import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { createHash } from "crypto"
import { resolveOutcome } from "@/lib/report-outcome"

function hashPassword(pw: string): string {
  return createHash("sha256").update(pw).digest("hex")
}

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

  // Verificar contraseña si el link está protegido
  if (config.passwordHash) {
    const providedPassword = _req.nextUrl.searchParams.get("password") || ""
    if (!providedPassword || hashPassword(providedPassword) !== config.passwordHash) {
      return NextResponse.json(
        { error: "password_required", message: "Este reporte está protegido con contraseña." },
        { status: 401 }
      )
    }
  }
  const surveyId: string = (share as any).survey_id
  const filters = config.filters || {}
  const sections = config.sections || { resumen: true, analisis: true, rendimiento: false, geografico: false }

  // 2. Metadata de la encuesta
  const { data: survey } = await admin
    .from("surveys")
    .select("id, title, description, logo, project_id, settings, projects(logo, companies(logo))")
    .eq("id", surveyId)
    .maybeSingle()

  // Selección + ORDEN de preguntas de "Análisis de resultados": se lee en
  // vivo de surveys.settings en cada request (no de config.questionIds,
  // que quedaba congelado al momento de generar el link) — así, si el admin
  // agrega/quita/reordena preguntas después de compartir, el link ya
  // compartido lo refleja solo con refrescar, sin tener que volver a
  // compartir. config.questionIds queda como fallback para links viejos
  // creados antes de que existiera reportAnalysisQuestionIds.
  const liveQuestionIds: string[] | null =
    Array.isArray((survey as any)?.settings?.reportAnalysisQuestionIds) && (survey as any).settings.reportAnalysisQuestionIds.length > 0
      ? (survey as any).settings.reportAnalysisQuestionIds
      : null
  // null = todas las preguntas, array = filtrar solo esas (y en ESE orden)
  const allowedQuestionIds: string[] | null = liveQuestionIds ?? config.questionIds ?? null
  const liveQuestionOrder: Record<string, number> = {}
  if (liveQuestionIds) liveQuestionIds.forEach((qId, i) => { liveQuestionOrder[qId] = i })

  // Orden por pregunta elegido en la tabla de "Análisis de resultados" (ver
  // components/reports/question-card.tsx) — se guarda en surveys.settings
  // para que el link compartido muestre las gráficas en el MISMO orden que
  // dejó armado el admin, no siempre el default (descendente por cantidad).
  const questionSortConfig: Record<string, { key: "label" | "count" | "percentage"; dir: "asc" | "desc" }> =
    (survey as any)?.settings?.reportQuestionSort && typeof (survey as any).settings.reportQuestionSort === "object"
      ? (survey as any).settings.reportQuestionSort
      : {}

  // Tipo de gráfica elegido por pregunta en "Análisis de resultados" (ej.
  // "Barras horizontales" en vez del pie/bar por defecto que ResultsClient
  // decidía solo por cantidad de opciones) — mismo criterio que
  // questionSortConfig arriba, para que "Compartir link" muestre la misma
  // gráfica que dejó armada el admin.
  const questionChartSettings: Record<string, { chartType?: string }> =
    (survey as any)?.settings?.reportQuestionChartSettings && typeof (survey as any).settings.reportQuestionChartSettings === "object"
      ? (survey as any).settings.reportQuestionChartSettings
      : {}

  // Logo para el header del reporte compartido: prioriza el logo propio de la
  // encuesta, luego el del proyecto, luego el de la empresa — así el cliente
  // ve su propia marca en vez del logo de la plataforma (Datanalisis).
  const brandLogo: string | null =
    (survey as any)?.logo ||
    (survey as any)?.projects?.logo ||
    (survey as any)?.projects?.companies?.logo ||
    null

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
        .select("id, response_id, question_id, value, questions(id, text, type, options, section_id, matrix_rows, matrix_cols, settings)")
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
  const completionRate = totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 1000) / 10 : 0

  let efectivas = 0, incidencias = 0, abandonadas = 0
  for (const r of responses) {
    const outcome = resolveOutcome(r)
    if (outcome === "efectiva") efectivas++
    else if (outcome === "incidencia") incidencias++
    else abandonadas++
  }
  const tasaRespuestasEfectivas = totalResponses > 0 ? Math.round((efectivas / totalResponses) * 1000) / 10 : 0

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
    if (total > 0) nps = Math.round(((promoters - detractors) / total) * 1000) / 10
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
  const questionMap: Record<string, { text: string; type: string; options: any[]; answers: any[]; days: string[]; matrixRows: string[]; matrixCols: string[]; cellType: string }> = {}
  for (const a of answers) {
    const q = a.questions
    if (!q) continue
    // Filtrar por preguntas seleccionadas si se especificaron
    if (allowedQuestionIds !== null && !allowedQuestionIds.includes(q.id)) continue
    if (!questionMap[q.id]) {
      const mRows: string[] = q.matrix_rows || q.settings?.matrixRows || []
      const mCols: string[] = q.matrix_cols || q.settings?.matrixCols || []
      const cType: string = q.settings?.matrixCellType || "radio"
      questionMap[q.id] = { text: q.text || "Sin texto", type: q.type, options: q.options || [], answers: [], days: [], matrixRows: mRows, matrixCols: mCols, cellType: cType }
    }
    questionMap[q.id].answers.push(a.value)
    const parentResponse = responseById[a.response_id]
    if (parentResponse?.created_at) {
      questionMap[q.id].days.push(new Date(parentResponse.created_at).toISOString().slice(0, 10))
    }
  }

  // Build breakdowns (same logic as reports/route.ts)
  const questionBreakdowns = Object.entries(questionMap).map(([qId, qData]) => {
    const { text, type, options, answers: qAnswers, matrixRows, matrixCols, cellType } = qData
    const totalAnswered = qAnswers.length

    // ── Matriz ─────────────────────────────────────────────────────────────────
    if (type === "matrix" && matrixRows.length > 0) {
      if (cellType === "number" || cellType === "text") {
        const sums: Record<string, number> = {}
        const cnts: Record<string, number> = {}
        const samples: Record<string, string[]> = {}
        for (const val of qAnswers) {
          if (!val || typeof val !== "object" || Array.isArray(val)) continue
          for (const [key, v] of Object.entries(val as Record<string, any>)) {
            const str = String(v ?? "").trim()
            if (!str) continue
            if (cellType === "number") {
              const n = parseFloat(str.replace(",", "."))
              if (!isNaN(n)) { sums[key] = (sums[key] || 0) + n; cnts[key] = (cnts[key] || 0) + 1 }
            } else {
              if (!samples[key]) samples[key] = []
              if (samples[key].length < 3) samples[key].push(str)
            }
          }
        }
        const tableData: Record<string, Record<string, { avg?: number; count: number; samples?: string[] }>> = {}
        for (const row of matrixRows) {
          tableData[row] = {}
          for (const col of matrixCols) {
            const key = `${row}_${col}`
            if (cellType === "number") {
              const c = cnts[key] || 0
              tableData[row][col] = { avg: c > 0 ? Math.round((sums[key] / c) * 10) / 10 : undefined, count: c }
            } else {
              tableData[row][col] = { count: (samples[key] || []).length, samples: samples[key] || [] }
            }
          }
        }
        return { questionId: qId, text, type, totalAnswered, matrixBreakdown: { matrixRows, matrixCols, cellType, tableData } }
      }
      if (cellType === "radio" || cellType === "checkbox") {
        const rowDist: Record<string, Record<string, number>> = {}
        for (const row of matrixRows) rowDist[row] = {}
        for (const val of qAnswers) {
          if (!val || typeof val !== "object" || Array.isArray(val)) continue
          for (const row of matrixRows) {
            const sel = (val as any)[row]
            const selected: string[] = Array.isArray(sel) ? sel : sel ? [String(sel)] : []
            for (const s of selected) {
              if (s) rowDist[row][s] = (rowDist[row][s] || 0) + 1
            }
          }
        }
        return { questionId: qId, text, type, totalAnswered, matrixBreakdown: { matrixRows, matrixCols, cellType, rowDistribution: rowDist } }
      }
      return { questionId: qId, text, type, totalAnswered, matrixBreakdown: { matrixRows, matrixCols, cellType } }
    }
    // ───────────────────────────────────────────────────────────────────────────

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
      let choices = Object.entries(counts)
        .map(([label, count]) => ({ label, count, percentage: totalAnswered > 0 ? Math.round((count / totalAnswered) * 1000) / 10 : 0 }))
        .sort((a, b) => b.count - a.count)
      const customSort = questionSortConfig[qId]
      if (customSort) {
        choices = [...choices].sort((a, b) => {
          if (customSort.key === "label") return a.label.localeCompare(b.label)
          return (a[customSort.key] as number) - (b[customSort.key] as number)
        })
        if (customSort.dir === "desc") choices.reverse()
      }
      return { questionId: qId, text, type, totalAnswered, choices, numericStats: null, textAnswers: [], chartType: questionChartSettings[qId]?.chartType ?? null }
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
        .map(([value, count]) => ({ value: Number(value), count, percentage: nums.length > 0 ? Math.round((count / nums.length) * 1000) / 10 : 0 }))
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

  // Mismo orden que "Análisis de resultados" en vivo (liveQuestionOrder) —
  // sin esto, el link mostraba las preguntas en el orden en que llegaron
  // las respuestas de la base de datos, no en el orden que armó el admin.
  if (liveQuestionIds) {
    questionBreakdowns.sort((a, b) => {
      const oa = liveQuestionOrder[a.questionId] ?? Number.MAX_SAFE_INTEGER
      const ob = liveQuestionOrder[b.questionId] ?? Number.MAX_SAFE_INTEGER
      return oa - ob
    })
  }

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
      tasaRespuestas: s.totalRegistros > 0 ? Math.round((s.efectivas / s.totalRegistros) * 1000) / 10 : 0,
      completionRate: s.totalRegistros > 0 ? Math.round((s.efectivas / s.totalRegistros) * 1000) / 10 : 0,
    })).sort((a, b) => b.efectivas - a.efectivas)
  }

  return NextResponse.json({
    meta: {
      customTitle: config.customTitle || null,
      surveyTitle: survey?.title || config.surveyTitle || "Encuesta",
      surveyDescription: survey?.description || config.surveyDescription || "",
      brandLogo,
      // Imagen de rich preview (Open Graph) adjuntada al compartir — ver
      // app/results/[token]/page.tsx (generateMetadata) para dónde se usa.
      imageUrl: config.imageUrl || null,
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
