import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { requireRole } from "@/lib/api-auth"
import { resolveOutcome } from "@/lib/report-outcome"

// GET /api/projects/[id]/export-database — descarga en CSV TODAS las
// respuestas de TODAS las encuestas de un proyecto, una fila por respuesta,
// con una columna por cada pregunta existente en el proyecto (reunión
// 2026-08-27: "Debo tener la opción de descargar la base de datos por
// proyecto con todos los datos"). Formato ancho (pivotado) en vez de
// "una fila por respuesta" porque es lo que un cliente puede abrir
// directamente en Excel y cruzar sin trabajo adicional.
function csvEscape(val: any): string {
  if (val === null || val === undefined) return ""
  const s = typeof val === "string" ? val : JSON.stringify(val)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function extractValue(val: any): string {
  if (val === null || val === undefined) return ""
  if (typeof val === "string") return val
  if (typeof val === "number" || typeof val === "boolean") return String(val)
  if (Array.isArray(val)) return val.map((v) => extractValue(v)).join(" | ")
  if (typeof val === "object") {
    if (val.value !== undefined) return extractValue(val.value)
    if (val.label !== undefined) return extractValue(val.label)
    if (val.text !== undefined) return extractValue(val.text)
    if (val.option !== undefined) return extractValue(val.option)
    const vals = Object.values(val).filter((v) => v !== null && v !== undefined && v !== "")
    if (vals.length > 0) return vals.map((v) => extractValue(v)).join(" | ")
    return ""
  }
  return String(val)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(["admin", "supervisor", "coordinator"])
    if (!auth.ok) return auth.response

    const { id: projectId } = await params
    const admin = createAdminSupabase()

    const { data: project } = await admin.from("projects").select("id, name").eq("id", projectId).maybeSingle()
    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 })
    }

    const { data: surveys } = await admin.from("surveys").select("id, title").eq("project_id", projectId)
    const surveyIds = (surveys || []).map((s: any) => s.id)
    const surveyTitleById: Record<string, string> = Object.fromEntries((surveys || []).map((s: any) => [s.id, s.title]))

    if (surveyIds.length === 0) {
      return new NextResponse("Sin encuestas en este proyecto\n", {
        headers: { "Content-Type": "text/csv; charset=utf-8" },
      })
    }

    // SEGURIDAD: mismo criterio de jerarquía que /api/reports — un
    // supervisor/coordinador exporta solo las respuestas de SU equipo, no
    // las de todo el proyecto.
    let teamSurveyorIds: string[] | null = null
    if (auth.user.role === "supervisor") {
      const { data: mySurveyors } = await admin.from("surveyors").select("id").eq("supervisor_id", auth.user.id)
      teamSurveyorIds = ((mySurveyors as any[]) || []).map((s) => s.id)
    } else if (auth.user.role === "coordinator") {
      const { data: mySupervisors } = await admin.from("users").select("id").eq("role", "supervisor").eq("coordinator_id", auth.user.id)
      const supIds = ((mySupervisors as any[]) || []).map((s: any) => s.id)
      const { data: mySurveyors } = supIds.length > 0
        ? await admin.from("surveyors").select("id").in("supervisor_id", supIds)
        : { data: [] as any[] }
      teamSurveyorIds = ((mySurveyors as any[]) || []).map((s: any) => s.id)
    }

    const { data: responses } = await admin
      .from("responses")
      .select("id, survey_id, assignment_id, created_at, completed_at, started_at, status, outcome, respondent_name, respondent_id, metadata, location")
      .in("survey_id", surveyIds)
      .order("created_at", { ascending: false })
      .limit(20000)

    const responseRows = (responses as any[]) || []

    // Resolver encuestador por assignment_id (survey_surveyor_zones,
    // flujo real del portal) y por metadata.surveyor_id (APK) — mismo
    // criterio de 3 niveles usado en el resto de /api/reports.
    const assignmentIds = [...new Set(responseRows.map((r) => r.assignment_id).filter(Boolean))]
    const surveyorNameByAssignmentId: Record<string, string> = {}
    if (assignmentIds.length > 0) {
      const { data: sszRows } = await admin
        .from("survey_surveyor_zones")
        .select("id, surveyors(id, name)")
        .in("id", assignmentIds)
      for (const a of (sszRows as any[]) || []) {
        if (a.surveyors?.name) surveyorNameByAssignmentId[a.id] = a.surveyors.name
      }
    }
    const metaSurveyorIds = [...new Set(
      responseRows.filter((r) => !r.assignment_id && r.metadata?.surveyor_id).map((r) => r.metadata.surveyor_id)
    )]
    const surveyorNameBySurveyorId: Record<string, string> = {}
    if (metaSurveyorIds.length > 0) {
      const { data: surveyorRows } = await admin.from("surveyors").select("id, name").in("id", metaSurveyorIds)
      for (const s of (surveyorRows as any[]) || []) surveyorNameBySurveyorId[s.id] = s.name
    }

    // Filtrar por equipo (si aplica): necesita el cruce fino
    // assignment_id -> surveyor_id para las respuestas del portal web, y
    // metadata.surveyor_id/respondent_id directo para las de la APK.
    let allowedAssignmentIds: Set<string> | null = null
    if (teamSurveyorIds !== null && assignmentIds.length > 0) {
      const { data: sszTeam } = await admin
        .from("survey_surveyor_zones")
        .select("id, surveyor_id")
        .in("id", assignmentIds)
        .in("surveyor_id", teamSurveyorIds)
      allowedAssignmentIds = new Set(((sszTeam as any[]) || []).map((a) => a.id))
    }
    const finalResponses = teamSurveyorIds === null
      ? responseRows
      : responseRows.filter((r) => {
          if (r.assignment_id) return allowedAssignmentIds?.has(r.assignment_id) ?? false
          const sid = r.metadata?.surveyor_id ?? r.respondent_id
          return sid ? teamSurveyorIds!.includes(sid) : false
        })

    const responseIds = finalResponses.map((r) => r.id)

    // Todas las respuestas a preguntas de estas respuestas, con el texto y
    // orden de la pregunta para poder pivotar en columnas estables.
    const answersByResponseId: Record<string, Record<string, string>> = {}
    const questionColumns: { id: string; label: string; order: number }[] = []
    const seenQuestionIds = new Set<string>()

    if (responseIds.length > 0) {
      const CHUNK = 500
      for (let i = 0; i < responseIds.length; i += CHUNK) {
        const chunk = responseIds.slice(i, i + CHUNK)
        const { data: answers } = await admin
          .from("answers")
          .select("response_id, value, questions(id, text, order_num, section_id)")
          .in("response_id", chunk)
        for (const a of (answers as any[]) || []) {
          const q = a.questions
          if (!q) continue
          if (!seenQuestionIds.has(q.id)) {
            seenQuestionIds.add(q.id)
            questionColumns.push({ id: q.id, label: q.text || "Sin texto", order: q.order_num ?? 0 })
          }
          if (!answersByResponseId[a.response_id]) answersByResponseId[a.response_id] = {}
          answersByResponseId[a.response_id][q.id] = extractValue(a.value)
        }
      }
    }
    questionColumns.sort((a, b) => a.order - b.order)

    // Encabezados: de-dupe de labels de pregunta repetidos entre encuestas
    // distintas del mismo proyecto (mismo texto, distinto id).
    const labelCount: Record<string, number> = {}
    const questionHeader = questionColumns.map((q) => {
      const base = q.label.replace(/[\r\n]+/g, " ").trim().slice(0, 80)
      labelCount[base] = (labelCount[base] || 0) + 1
      return labelCount[base] > 1 ? `${base} (${labelCount[base]})` : base
    })

    const baseHeaders = [
      "ID Respuesta", "Encuesta", "Encuestador", "Encuestado", "Fecha", "Hora inicio",
      "Duración (seg)", "Tipo", "Estado",
    ]

    const lines: string[] = []
    lines.push([...baseHeaders, ...questionHeader].map(csvEscape).join(","))

    for (const r of finalResponses) {
      const surveyorName = (r.assignment_id ? surveyorNameByAssignmentId[r.assignment_id] : undefined)
        ?? (r.metadata?.surveyor_id ? surveyorNameBySurveyorId[r.metadata.surveyor_id] : undefined)
        ?? ""
      const respondentName = r.respondent_name ?? (typeof r.metadata?.respondent_name === "string" ? r.metadata.respondent_name : "") ?? ""
      const durationSecs = (r.completed_at && r.started_at)
        ? Math.max(0, Math.round((new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 1000))
        : ""
      const rowAnswers = answersByResponseId[r.id] || {}
      const row = [
        r.id,
        surveyTitleById[r.survey_id] ?? "",
        surveyorName,
        respondentName,
        r.created_at ? new Date(r.created_at).toLocaleDateString("es-CO") : "",
        r.started_at ? new Date(r.started_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "",
        durationSecs,
        resolveOutcome(r),
        r.status ?? "",
        ...questionColumns.map((q) => rowAnswers[q.id] ?? ""),
      ]
      lines.push(row.map(csvEscape).join(","))
    }

    const csv = "﻿" + lines.join("\n") // BOM para que Excel abra UTF-8 con tildes bien
    const filename = `${project.name.replace(/[^a-z0-9]+/gi, "_")}_base_de_datos.csv`

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("Error en export-database:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
