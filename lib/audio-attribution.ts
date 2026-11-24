// Atribución de audio "antes de iniciar" (scope='shift') a respuestas, en
// lote. Lo usan el repositorio de audios (app/api/surveys/[id]/recordings) y
// su ZIP (app/api/surveys/[id]/audios/zip) — viven en un solo lugar porque
// cuando cada ruta tenía su propio criterio, el ZIP terminaba con audios
// distintos a los que mostraba la pantalla.
//
// 1) Ligado directo (ítem 26/11/2026): el portal liga cada segmento a su
//    respuesta al registrar la incidencia o enviar/abandonar la encuesta
//    (POST /api/portal-encuestador/recordings/link). Si una respuesta tiene
//    clips ligados, esos son sus audios — sin adivinar nada.
// 2) Ventana por hora (respaldo, audios grabados antes de ese cambio): los
//    clips de fondo del turno que empezaron en los 30 min previos a la
//    respuesta, acotados por la respuesta anterior del mismo turno. Nunca
//    toma un clip ya ligado a otra respuesta.

import { selectInChunks } from "./supabase-chunked"

export interface ShiftClip {
  id: string
  shift_id: string | null
  surveyor_id: string | null
  response_id: string | null
  storage_path: string | null
  duration_secs: number | null
  started_at: string | null
}

export interface AttributableResponse {
  id: string
  created_at: string | null
  completed_at: string | null
  assignment_id: string | null
  respondent_id: string | null
  metadata: any
}

const CLIP_COLUMNS = "id, shift_id, surveyor_id, response_id, storage_path, duration_secs, started_at"

export async function resolvePreSurveyClips(
  admin: any,
  responses: AttributableResponse[]
): Promise<{
  preClipsByResponseId: Map<string, ShiftClip[]>
  resolvedSurveyorIdByResponseId: Map<string, string | null>
}> {
  const responseIds = responses.map((r) => r.id)
  const preClipsByResponseId = new Map<string, ShiftClip[]>()

  // Encuestador de cada respuesta: 1) assignment_id -> survey_surveyor_zones;
  // 2) metadata.surveyor_id (APK); 3) respondent_id, que en
  // incidencia/abandono guarda el user_id del ENCUESTADOR (ver
  // app/api/portal-encuestador/responses/finish/route.ts).
  // Todas las consultas .in() van por lotes: con encuestas de más de ~250
  // respuestas la URL superaba el límite del servidor (ver supabase-chunked.ts).
  const { data: sszRows } = await selectInChunks(responses.map((r) => r.assignment_id), (chunk) =>
    admin.from("survey_surveyor_zones").select("id, surveyor_id").in("id", chunk)
  )
  const surveyorIdByAssignmentId = new Map<string, string>((sszRows || []).map((r: any) => [r.id, r.surveyor_id]))

  const respondentIds = responses.map((r) => r.respondent_id)
  const { data: byUserId } = await selectInChunks(respondentIds, (chunk) =>
    admin.from("surveyors").select("id, user_id").in("user_id", chunk)
  )
  const { data: byOwnId } = await selectInChunks(respondentIds, (chunk) =>
    admin.from("surveyors").select("id").in("id", chunk)
  )
  const surveyorIdByUserId = new Map<string, string>((byUserId || []).map((s: any) => [s.user_id, s.id]))
  const surveyorIdsByOwnId = new Set<string>((byOwnId || []).map((s: any) => s.id))

  const resolveSurveyorId = (r: AttributableResponse): string | null => {
    if (r.assignment_id && surveyorIdByAssignmentId.has(r.assignment_id)) return surveyorIdByAssignmentId.get(r.assignment_id)!
    const metaId = r.metadata?.surveyor_id as string | undefined
    if (metaId) return metaId
    if (r.respondent_id) {
      if (surveyorIdByUserId.has(r.respondent_id)) return surveyorIdByUserId.get(r.respondent_id)!
      if (surveyorIdsByOwnId.has(r.respondent_id)) return r.respondent_id
    }
    return null
  }
  const resolvedSurveyorIdByResponseId = new Map<string, string | null>(responses.map((r) => [r.id, resolveSurveyorId(r)]))

  // 1) Ligado directo.
  const { data: linkedClips } = await selectInChunks(responseIds, (chunk) =>
    admin
      .from("surveyor_recordings")
      .select(CLIP_COLUMNS)
      .in("response_id", chunk)
      .eq("scope", "shift")
      .eq("upload_status", "uploaded")
      .not("storage_path", "is", null)
  )
  for (const clip of (linkedClips || []) as ShiftClip[]) {
    if (!clip.response_id) continue
    if (!preClipsByResponseId.has(clip.response_id)) preClipsByResponseId.set(clip.response_id, [])
    preClipsByResponseId.get(clip.response_id)!.push(clip)
  }

  // 1b) Lo que pasó ANTES de abrir la encuesta en el celular (ítem 26/11/2026:
  // "lo que pasa antes de la incidencia no lo está subiendo"). El portal corta
  // el audio al abrir la encuesta, así que la conversación en la puerta antes
  // de abrirla queda en el segmento anterior, sin ligar. Se agrega el segmento
  // inmediatamente anterior al primer clip ligado de cada respuesta, solo si
  // no está ligado a otra respuesta — si lo está, es el final del intento
  // anterior y no hay "antes" que agregar (así nunca se mezclan intentos).
  const claimed = new Set<string>()
  const linkedShiftIds = Array.from(
    new Set(((linkedClips || []) as ShiftClip[]).map((c) => c.shift_id).filter(Boolean))
  ) as string[]
  if (linkedShiftIds.length) {
    // Toda la línea de tiempo del turno (también los no subidos o ligados a
    // otra respuesta): el "anterior" se decide sobre la secuencia real.
    const { data: timelineRows } = await selectInChunks(linkedShiftIds, (chunk) =>
      admin.from("surveyor_recordings").select(`${CLIP_COLUMNS}, upload_status`).in("shift_id", chunk).eq("scope", "shift")
    )
    const timelineByShift = new Map<string, any[]>()
    for (const row of (timelineRows || []) as any[]) {
      if (!row.shift_id || !row.started_at) continue
      if (!timelineByShift.has(row.shift_id)) timelineByShift.set(row.shift_id, [])
      timelineByShift.get(row.shift_id)!.push(row)
    }
    for (const rows of timelineByShift.values()) rows.sort((a, b) => a.started_at.localeCompare(b.started_at))

    for (const clips of preClipsByResponseId.values()) {
      const first = clips.reduce<ShiftClip | null>(
        (min, c) => (c.started_at && (!min || c.started_at < (min.started_at as string)) ? c : min),
        null
      )
      if (!first?.shift_id || !first.started_at) continue
      let prev: any = null
      for (const row of timelineByShift.get(first.shift_id) || []) {
        if (row.started_at < first.started_at) prev = row
        else break
      }
      if (prev && !prev.response_id && prev.upload_status === "uploaded" && prev.storage_path && !claimed.has(prev.id)) {
        clips.push(prev as ShiftClip)
        claimed.add(prev.id)
      }
    }
  }

  // 2) Ventana por hora, solo para respuestas sin clips ligados.
  const involvedSurveyorIds = Array.from(
    new Set(Array.from(resolvedSurveyorIdByResponseId.values()).filter(Boolean) as string[])
  )
  const { data: shifts } = await selectInChunks(involvedSurveyorIds, (chunk) =>
    admin.from("surveyor_shifts").select("id, surveyor_id, started_at, ended_at").in("surveyor_id", chunk)
  )

  const shiftIdByResponseId = new Map<string, string>()
  for (const r of responses) {
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
  const { data: shiftClips } = await selectInChunks(involvedShiftIds, (chunk) =>
    admin
      .from("surveyor_recordings")
      .select(CLIP_COLUMNS)
      .in("shift_id", chunk)
      .eq("scope", "shift")
      .eq("upload_status", "uploaded")
      .not("storage_path", "is", null)
      .is("response_id", null)
  )

  const responsesByShift = new Map<string, AttributableResponse[]>()
  for (const r of responses) {
    const shiftId = shiftIdByResponseId.get(r.id)
    if (!shiftId) continue
    if (!responsesByShift.has(shiftId)) responsesByShift.set(shiftId, [])
    responsesByShift.get(shiftId)!.push(r)
  }
  for (const [shiftId, respList] of responsesByShift) {
    respList.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""))
    const clipsOfShift = ((shiftClips || []) as ShiftClip[]).filter((c) => c.shift_id === shiftId)
    let prevBoundary: string | null = null
    for (const r of respList) {
      const upper = r.created_at as string
      const fixedLower = new Date(new Date(upper).getTime() - 30 * 60 * 1000).toISOString()
      const lower = prevBoundary && prevBoundary > fixedLower ? prevBoundary : fixedLower
      // Una respuesta con clips ligados ya tiene sus audios exactos; igual
      // avanza el límite para que la siguiente no tome lo que le tocaba.
      if (!preClipsByResponseId.has(r.id)) {
        const clips = clipsOfShift.filter((c) => !claimed.has(c.id) && c.started_at && c.started_at >= lower && c.started_at < upper)
        if (clips.length > 0) preClipsByResponseId.set(r.id, clips)
      }
      prevBoundary = r.completed_at || r.created_at
    }
  }

  for (const clips of preClipsByResponseId.values()) {
    clips.sort((a, b) => (a.started_at || "").localeCompare(b.started_at || ""))
  }

  return { preClipsByResponseId, resolvedSurveyorIdByResponseId }
}
