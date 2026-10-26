import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { requireRole } from "@/lib/api-auth"
import { bogotaDayKey } from "@/lib/bogota-time"

// Ítem "Nombre de los audios" (acta de ajustes 05/10/2026):
// "[ENCUESTADOR] - [FECHA] - [CODIGO INTERNO] - [ESTADO DE ENCUESTA] -
// [ID RESPUESTA INDIVIDUAL] - PARTE X". Antes era
// "grabacion_<encuestador>_<id8>.ext", sin identificar la encuesta, el
// estado del intento ni a cuál respuesta pertenece. OUTCOME_LABEL es la
// misma etiqueta humana que ya usa components/reports/audios-tab.tsx.
const OUTCOME_LABEL: Record<string, string> = {
  efectiva: "Efectiva", incidencia: "Incidencia", abandonada: "Abandonada", descalificado: "Descalificada",
}

function sanitizeFilenamePart(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, "").trim()
}

// Ítem 19/10/2026 ("el id está muy largo en los audios, truncarlo hasta el
// primer guion"): response_id es un UUID completo
// (ej. 5b9497a8-c4cf-40c1-9e45-9e98d2c41023) — se deja solo el primer
// segmento (5b9497a8) en el nombre del archivo, igual de identificable
// para diferenciar PARTE 1/2/3 de un mismo intento, sin ocupar tanto.
function shortId(id: string): string {
  return id.split("-")[0]
}

// Lista las grabaciones de audio del portal de encuestador ligadas a ESTA
// encuesta, para el módulo de detalle (app/surveys/[id]/page.tsx).
//
// surveyor_recordings no tiene survey_id directo — solo response_id (para
// scope='survey') o shift_id. La forma correcta de saber "qué grabaciones
// pertenecen a esta encuesta" es: responses.survey_id = este id -> tomar
// esos response_id -> buscar surveyor_recordings con scope='survey' y
// response_id en ese conjunto.
//
// Ítem 26/10/2026 ("en Respuestas Individuales salen todos los audios
// —antes y durante—, en el repositorio sale únicamente durante"): los
// segmentos scope='shift' (audio de fondo del turno, incluida la
// conversación ANTES de tocar "Iniciar Encuesta") antes se excluían acá
// a propósito ("no están ligados a una encuesta específica") — pero
// Respuestas Individuales (app/api/reports/individual/[id]/route.ts) sí
// los asocia a la respuesta más cercana, con una ventana acotada para no
// mezclar intentos. Se replica el mismo criterio acá, en lote para todas
// las respuestas de la encuesta: cada respuesta se queda con los clips
// scope='shift' de su turno que caen en los 30 min previos a su
// created_at, acotados por el límite del intento anterior del MISMO turno
// para que dos respuestas seguidas nunca se repartan el mismo audio.
//
// Solo se listan segmentos con upload_status='uploaded' (los 'failed' o
// 'pending' no tienen audio real que reproducir) y se genera una URL firmada
// de corta duración por cada uno (bucket 'response-media' es privado).
// SEGURIDAD (auditoría 2026-07-29): sin auth, esto devolvía URLs firmadas a
// audios de encuestadores (grabaciones de campo) a cualquiera con el ID de
// la encuesta.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Ítem "revisar los accesos y permisos de cada rol" (13/10/2026): faltaba
  // "coordinator" — bloqueaba la pestaña Audios de Reportes para ese rol,
  // que ya tiene acceso al resto de Reportes de esta misma encuesta.
  const auth = await requireRole(["admin", "supervisor", "coordinator"])
  if (!auth.ok) return auth.response

  try {
    const { id: surveyId } = await params
    const admin = createAdminSupabase() as any

    const { data: surveyRow } = await admin.from("surveys").select("code").eq("id", surveyId).maybeSingle()
    const surveyCode: string | null = surveyRow?.code ?? null

    const { data: responses, error: responsesError } = await admin
      .from("responses")
      .select("id, outcome, incidence_type, completed_at, created_at, response_mode, assignment_id, respondent_id, metadata")
      .eq("survey_id", surveyId)

    if (responsesError) {
      console.error("Error obteniendo respuestas de la encuesta:", responsesError)
      return NextResponse.json({ error: "No se pudieron obtener las respuestas", details: responsesError.message }, { status: 500 })
    }

    const responseIds = (responses || []).map((r: any) => r.id)
    if (responseIds.length === 0) {
      return NextResponse.json({ recordings: [] })
    }

    const responseById = new Map<string, any>((responses || []).map((r: any) => [r.id, r]))

    const { data: recordings, error: recordingsError } = await admin
      .from("surveyor_recordings")
      .select("id, surveyor_id, response_id, started_at, ended_at, storage_path, duration_secs, upload_status")
      .in("response_id", responseIds)
      .eq("scope", "survey")
      .eq("upload_status", "uploaded")
      .order("started_at", { ascending: false })

    if (recordingsError) {
      // Si la tabla no existe (código 42P01 = undefined_table) informar con
      // un mensaje claro en vez de un genérico 500.
      const tableNotFound = recordingsError.code === "42P01" || recordingsError.message?.includes("does not exist")
      console.error("Error obteniendo grabaciones:", recordingsError)
      return NextResponse.json({
        error: "No se pudieron obtener las grabaciones",
        details: recordingsError.message,
        diagnostic: tableNotFound
          ? "La tabla surveyor_recordings no existe en la base de datos. Ejecuta la migración SQL para crearla."
          : "Error de base de datos al consultar grabaciones.",
        tableExists: !tableNotFound,
      }, { status: 500 })
    }

    // Ítem 26/10/2026: resolución de encuestador POR RESPUESTA (no solo por
    // la grabación scope='survey', que puede no existir) — mismo respaldo
    // de 3 niveles ya usado en app/api/reports/route.ts y en
    // app/api/reports/individual/[id]/route.ts: 1) assignment_id ->
    // survey_surveyor_zones.surveyor_id (estado actual de la asignación);
    // 2) metadata.surveyor_id (lo manda la APK directo); 3) respondent_id
    // contra surveyors.user_id o surveyors.id (para incidencia/abandono,
    // respondent_id guarda el id del ENCUESTADOR, no del encuestado — ver
    // app/api/portal-encuestador/responses/finish/route.ts). Necesario para
    // poder encontrarle el turno (surveyor_shifts) a una respuesta aunque
    // su asignación haya sido reasignada después de creada, o aunque nunca
    // haya tenido assignment_id (incidencia reportada antes de "Iniciar
    // Encuesta").
    const assignmentIds = Array.from(new Set((responses || []).map((r: any) => r.assignment_id).filter(Boolean)))
    const { data: sszRows } = assignmentIds.length
      ? await admin.from("survey_surveyor_zones").select("id, surveyor_id").in("id", assignmentIds)
      : { data: [] as any[] }
    const surveyorIdByAssignmentId = new Map<string, string>((sszRows || []).map((r: any) => [r.id, r.surveyor_id]))

    const respondentIds = Array.from(new Set((responses || []).map((r: any) => r.respondent_id).filter(Boolean)))
    const { data: byUserId } = respondentIds.length
      ? await admin.from("surveyors").select("id, user_id").in("user_id", respondentIds)
      : { data: [] as any[] }
    const { data: byOwnId } = respondentIds.length
      ? await admin.from("surveyors").select("id").in("id", respondentIds)
      : { data: [] as any[] }
    const surveyorIdByUserId = new Map<string, string>((byUserId || []).map((s: any) => [s.user_id, s.id]))
    const surveyorIdsByOwnId = new Set<string>((byOwnId || []).map((s: any) => s.id))

    const resolveSurveyorId = (r: any): string | null => {
      if (r.assignment_id && surveyorIdByAssignmentId.has(r.assignment_id)) return surveyorIdByAssignmentId.get(r.assignment_id)!
      const metaId = r.metadata?.surveyor_id as string | undefined
      if (metaId) return metaId
      if (r.respondent_id) {
        if (surveyorIdByUserId.has(r.respondent_id)) return surveyorIdByUserId.get(r.respondent_id)!
        if (surveyorIdsByOwnId.has(r.respondent_id)) return r.respondent_id
      }
      return null
    }
    const resolvedSurveyorIdByResponseId = new Map<string, string | null>(
      (responses || []).map((r: any) => [r.id, resolveSurveyorId(r)])
    )

    // Turno activo de cada respuesta (el que estaba corriendo al momento de
    // su created_at) — para ubicar sus clips scope='shift' de "antes de
    // iniciar". Se trae TODOS los turnos de los encuestadores involucrados
    // de una sola vez (no uno por respuesta) y se matchea en memoria.
    const involvedSurveyorIds = Array.from(
      new Set(Array.from(resolvedSurveyorIdByResponseId.values()).filter(Boolean) as string[])
    )
    const { data: shifts } = involvedSurveyorIds.length
      ? await admin.from("surveyor_shifts").select("id, surveyor_id, started_at, ended_at").in("surveyor_id", involvedSurveyorIds)
      : { data: [] as any[] }

    const shiftIdByResponseId = new Map<string, string>()
    for (const r of (responses || []) as any[]) {
      const sid = resolvedSurveyorIdByResponseId.get(r.id)
      if (!sid || !r.created_at) continue
      const at = new Date(r.created_at).getTime()
      let best: any = null
      for (const s of (shifts || []) as any[]) {
        if (s.surveyor_id !== sid) continue
        const start = new Date(s.started_at).getTime()
        const end = s.ended_at ? new Date(s.ended_at).getTime() : Infinity
        if (start <= at && at <= end && (!best || start > new Date(best.started_at).getTime())) best = s
      }
      if (best) shiftIdByResponseId.set(r.id, best.id)
    }

    const involvedShiftIds = Array.from(new Set(Array.from(shiftIdByResponseId.values())))
    const { data: shiftRecordings } = involvedShiftIds.length
      ? await admin
          .from("surveyor_recordings")
          .select("id, shift_id, storage_path, duration_secs, started_at, upload_status")
          .in("shift_id", involvedShiftIds)
          .eq("scope", "shift")
          .eq("upload_status", "uploaded")
      : { data: [] as any[] }

    // Ventana de cada respuesta dentro de su turno: 30 min antes de su
    // created_at, acotada por el cierre (completed_at/created_at) del
    // intento ANTERIOR en el mismo turno — mismo criterio que ya usa
    // app/api/reports/individual/[id]/route.ts, generalizado acá a todas
    // las respuestas en lote para que dos intentos seguidos del mismo
    // turno nunca se repartan el mismo clip de audio.
    const responsesByShift = new Map<string, any[]>()
    for (const r of (responses || []) as any[]) {
      const shiftId = shiftIdByResponseId.get(r.id)
      if (!shiftId) continue
      if (!responsesByShift.has(shiftId)) responsesByShift.set(shiftId, [])
      responsesByShift.get(shiftId)!.push(r)
    }
    const preClipsByResponseId = new Map<string, any[]>()
    for (const [shiftId, respList] of responsesByShift) {
      respList.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""))
      const shiftClips = ((shiftRecordings || []) as any[]).filter((c) => c.shift_id === shiftId)
      let prevBoundary: string | null = null
      for (const r of respList) {
        const upper = r.created_at
        const fixedLower = new Date(new Date(upper).getTime() - 30 * 60 * 1000).toISOString()
        const lower = prevBoundary && prevBoundary > fixedLower ? prevBoundary : fixedLower
        const clips = shiftClips
          .filter((c) => c.started_at && c.started_at >= lower && c.started_at < upper)
          .sort((a, b) => (a.started_at || "").localeCompare(b.started_at || ""))
        if (clips.length > 0) preClipsByResponseId.set(r.id, clips)
        prevBoundary = r.completed_at || r.created_at
      }
    }

    if ((!recordings || recordings.length === 0) && preClipsByResponseId.size === 0) {
      // Diagnóstico extra: ¿hay grabaciones en otros estados (failed/pending)?
      const { data: allRecs } = await admin
        .from("surveyor_recordings")
        .select("id, upload_status, response_id, scope")
        .in("response_id", responseIds)
        .eq("scope", "survey")

      const failedCount = (allRecs || []).filter((r: any) => r.upload_status === "failed").length
      const pendingCount = (allRecs || []).filter((r: any) => r.upload_status === "pending").length
      const noResponseId = (allRecs || []).filter((r: any) => !r.response_id).length

      return NextResponse.json({
        recordings: [],
        diagnostic: {
          responseCount: responseIds.length,
          uploadedRecordingsCount: 0,
          failedRecordingsCount: failedCount,
          pendingRecordingsCount: pendingCount,
          recordingsWithNoResponseId: noResponseId,
          hint: failedCount > 0
            ? `Hay ${failedCount} grabacion(es) con upload_status='failed'. El audio no pudo subirse al storage.`
            : pendingCount > 0
              ? `Hay ${pendingCount} grabacion(es) con upload_status='pending'. Están en proceso de subida.`
              : "No hay grabaciones de audio ligadas a las respuestas de esta encuesta. Verifica que: (1) la encuesta fue tomada desde el portal encuestador /portal-encuestador/encuesta/[id], no desde la vista previa web; (2) el turno (shift) fue iniciado correctamente; (3) allowAudio está habilitado en la configuración de la encuesta.",
        },
      })
    }

    const surveyorIds = Array.from(
      new Set([
        ...((recordings || []) as any[]).map((r: any) => r.surveyor_id).filter(Boolean),
        ...involvedSurveyorIds,
      ])
    )
    const { data: surveyors } = await admin
      .from("surveyors")
      .select("id, name, email, supervisor_id")
      .in("id", surveyorIds)
    const surveyorById = new Map<string, any>((surveyors || []).map((s: any) => [s.id, s]))

    // Ítem 20/10/2026 ("revisa que todos los filtros sirvan"): Supervisor y
    // Coordinador (filtros de /reports) nunca llegaban hasta acá — mismo
    // criterio de jerarquía GLOBAL (surveyors.supervisor_id +
    // users.coordinator_id) que ya usa "Rendimiento por Encuestador" en
    // app/api/reports/route.ts, para no introducir un segundo criterio
    // distinto (por-proyecto) en esta misma pestaña.
    const supervisorIds = Array.from(
      new Set((surveyors || []).map((s: any) => s.supervisor_id).filter(Boolean))
    )
    const { data: supervisorUsers } = supervisorIds.length
      ? await admin.from("users").select("id, coordinator_id").in("id", supervisorIds)
      : { data: [] as any[] }
    const coordinatorIdBySupervisorId = new Map<string, string | null>(
      (supervisorUsers || []).map((u: any) => [u.id, u.coordinator_id ?? null])
    )

    // PARTE X: orden de este segmento DENTRO de su propia respuesta (un
    // mismo intento puede tener varios audios si el encuestador entró/salió
    // varias veces — ver comentario arriba de surveyor_recordings). `recordings`
    // ya viene ordenado por started_at desc; se ordena ascendente por
    // response_id para numerar PARTE 1, 2, 3... en el orden real en que
    // ocurrieron.
    const partNumberByRecordingId = new Map<string, number>()
    const byResponseId = new Map<string, any[]>()
    for (const rec of (recordings || []) as any[]) {
      if (!rec.response_id) continue
      if (!byResponseId.has(rec.response_id)) byResponseId.set(rec.response_id, [])
      byResponseId.get(rec.response_id)!.push(rec)
    }
    for (const group of byResponseId.values()) {
      group.sort((a, b) => (a.started_at || "").localeCompare(b.started_at || ""))
      group.forEach((rec, i) => partNumberByRecordingId.set(rec.id, i + 1))
    }

    const buildItem = async (
      rec: any,
      opts: { segment: "survey" | "shift"; surveyorIdOverride?: string | null; partLabel: string }
    ) => {
      let audioUrl: string | null = null
      if (rec.storage_path) {
        const { data: signed, error: signError } = await admin.storage
          .from("response-media")
          .createSignedUrl(rec.storage_path, 3600)
        if (signError) {
          console.error("Error firmando URL de grabación:", rec.id, signError.message)
        } else {
          audioUrl = signed?.signedUrl || null
        }
      }
      const effectiveSurveyorId = opts.surveyorIdOverride ?? rec.surveyor_id ?? null
      const surveyor = effectiveSurveyorId ? surveyorById.get(effectiveSurveyorId) : null
      const response = responseById.get(rec.response_id)
      const ext = rec.storage_path ? rec.storage_path.split(".").pop() : "webm"
      const surveyorLabel = sanitizeFilenamePart(surveyor?.name || surveyor?.email || "encuestador")
      const dateLabel = rec.started_at ? bogotaDayKey(rec.started_at) : "sin-fecha"
      const outcomeLabel = response?.outcome ? (OUTCOME_LABEL[response.outcome] || response.outcome) : "Sin-estado"
      const fileNameParts = [surveyorLabel, dateLabel]
      if (surveyCode) fileNameParts.push(sanitizeFilenamePart(surveyCode))
      fileNameParts.push(outcomeLabel, rec.response_id ? shortId(rec.response_id) : "sin-respuesta", opts.partLabel)
      const supervisorId: string | null = surveyor?.supervisor_id ?? null
      return {
        id: rec.id,
        // surveyorId (auditoría 2026-07-29, "hay que organizar mejor" las
        // grabaciones): el frontend agrupa por este id, no por el nombre
        // — dos encuestadores homónimos no deben mezclarse en un mismo
        // grupo, y agrupar por id es estable aunque se edite el nombre.
        surveyorId: effectiveSurveyorId,
        surveyorName: surveyor?.name || surveyor?.email || "Encuestador desconocido",
        supervisorId,
        coordinatorId: supervisorId ? (coordinatorIdBySupervisorId.get(supervisorId) ?? null) : null,
        outcome: response?.outcome || null,
        incidenceType: response?.incidence_type || null,
        // "Prueba" vs "Activa" (Estado de la Encuesta en /reports) — ver
        // db/migrations/2026-10-08_add_response_mode_tracking.sql. Default
        // "activa" para respuestas de antes de esa migración.
        responseMode: response?.response_mode || "activa",
        startedAt: rec.started_at,
        endedAt: rec.ended_at ?? null,
        durationSecs: rec.duration_secs,
        audioUrl,
        fileName: `${fileNameParts.join(" - ")}.${ext}`,
        // segment (26/10/2026): "survey" = grabado desde "Iniciar Encuesta"
        // en adelante; "shift" = audio de fondo del turno, antes de
        // empezar (consulta de incidencia, negociar con el encuestado) —
        // mismo criterio y misma etiqueta que ya usa individual-responses-tab.tsx
        // ("Antes de iniciar la encuesta"). El frontend usa esto para
        // mostrar la distinción, igual que en Respuestas Individuales.
        segment: opts.segment,
      }
    }

    const items: any[] = []
    for (const rec of (recordings || []) as any[]) {
      items.push(await buildItem(rec, { segment: "survey", partLabel: `PARTE ${partNumberByRecordingId.get(rec.id) ?? 1}` }))
    }
    for (const [responseId, clips] of preClipsByResponseId) {
      const surveyorIdForResponse = resolvedSurveyorIdByResponseId.get(responseId) ?? null
      clips.forEach((clip: any, i: number) => {
        items.push(
          buildItem(
            { ...clip, response_id: responseId },
            { segment: "shift", surveyorIdOverride: surveyorIdForResponse, partLabel: `ANTES ${i + 1}` }
          )
        )
      })
    }
    const resolvedItems = await Promise.all(items)
    resolvedItems.sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""))

    return NextResponse.json({ recordings: resolvedItems })
  } catch (error: any) {
    console.error("Error en /api/surveys/[id]/recordings:", error)
    return NextResponse.json({ error: "Error interno del servidor", details: error?.message || String(error) }, { status: 500 })
  }
}
