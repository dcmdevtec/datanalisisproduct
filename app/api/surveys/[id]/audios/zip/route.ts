import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { requireRole } from "@/lib/api-auth"
import { convertToMp3 } from "@/lib/audio-merge"
import { ZipArchive } from "archiver"
import { Readable } from "stream"
import { bogotaDayKey } from "@/lib/bogota-time"
import { resolvePreSurveyClips } from "@/lib/audio-attribution"
import { selectInChunks } from "@/lib/supabase-chunked"

// GET /api/surveys/[id]/audios/zip?date=YYYY-MM-DD&surveyorId=<uuid> —
// descarga las grabaciones de audio de una encuesta en un único ZIP,
// organizadas en carpetas ID-de-la-encuesta/Fecha/Encuestador/archivo
// (reunión 2026-08-27, módulo "Audios"). `date`/`surveyorId` son opcionales
// (acta 07/09/2026, ítem #34: "solo tengo la opción de descargar todos los
// audios... con más de mil audios, ¿cuánto demorará?") — permiten pedir un
// subconjunto manejable en vez de un solo ZIP gigante con todo.
//
// Fuente de datos: surveyor_recordings con scope='survey' (grabación
// completa de la entrevista, ligada a una response puntual) — misma
// consulta base que /api/surveys/[id]/recordings, que ya resuelve
// encuestador + URL firmada por grabación. No se incluyen respuestas de
// tipo "audio" en media_files (grabaciones sueltas por pregunta): ese
// campo no tiene un formato de URL/bucket documentado en este repo (nunca
// se inserta desde aquí, solo se lee) y es un caso mucho más raro que la
// grabación completa de la entrevista, que es lo que pidió el cliente.
//
// Pedido 2026-08-31: originalmente este endpoint fusionaba (ffmpeg) el
// audio "de antes" (scope='shift') con el de la encuesta misma
// (scope='survey') en un solo archivo. Se retiró el 26/11/2026: desde que
// /api/surveys/[id]/recordings lista cada clip "de antes" como su propia
// fila seleccionable (no fusionada con "durante"), la fusión aquí
// recalculaba la ventana de asociación con SU PROPIO criterio (por
// grabación, acotado por la grabación anterior del mismo turno) — distinto
// del que ahora usa esta misma ruta para los clips sueltos (por RESPUESTA,
// ver standaloneShiftRecs más abajo). Los dos criterios podían discrepar y
// producir el mismo audio duplicado (una vez fusionado en "PARTE 1", otra
// vez suelto como "ANTES 1"), o archivos con nombres repetidos que el
// explorador de archivos pisa al descomprimir — exactamente lo reportado:
// "7 grabaciones, pero solo llegan 4 al ZIP". Ahora cada id marcado en el
// árbol produce exactamente un archivo, sin fusionar nada server-side —
// el ZIP queda forzosamente igual a lo que el usuario seleccionó en pantalla.
//
// El ZIP se arma en streaming (archiver + Readable.toWeb) para no cargar
// todas las grabaciones en memoria a la vez — cada archivo se descarga de
// Supabase Storage, se agrega al archive, y se libera antes de pasar al
// siguiente.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ZipInput {
  dateFilter: string | null // YYYY-MM-DD
  surveyorIdFilter: string | null
  // Ítem 09/09/2026: "repositorio jerárquico... seleccionar mediante
  // casillas exactamente qué carpetas o audios descargar". date/surveyorId
  // solo soportan UN valor cada uno; recordingIds, cuando viene, manda sobre
  // esos dos filtros: es la lista exacta de ids que el árbol dejó marcados.
  recordingIdsFilter: string[] | null
  // Ítem #36 (acta 07/09/2026): formato opcional mp3; por defecto el webm
  // original grabado por el navegador.
  wantsMp3: boolean
}

type RouteContext = { params: Promise<{ id: string }> }

// Forma heredada: filtros en la URL. Sirve para pocos ids; con la selección
// del árbol se usa POST (abajo).
export async function GET(request: NextRequest, context: RouteContext) {
  const { searchParams } = new URL(request.url)
  const recordingIdsParam = searchParams.get("recordingIds")
  return buildZip(context, {
    dateFilter: searchParams.get("date"),
    surveyorIdFilter: searchParams.get("surveyorId"),
    recordingIdsFilter: recordingIdsParam ? recordingIdsParam.split(",").filter(Boolean) : null,
    wantsMp3: searchParams.get("format") === "mp3",
  })
}

// Selección del árbol en el cuerpo de la petición (ítem 24/11/2026): con
// "Seleccionar todo" sobre cientos o miles de audios, la lista de ids en la
// URL superaba el tamaño máximo que aceptan el servidor y el proxy.
export async function POST(request: NextRequest, context: RouteContext) {
  const body = await request.json().catch(() => null)
  const ids = Array.isArray(body?.recordingIds)
    ? body.recordingIds.filter((x: unknown): x is string => typeof x === "string" && UUID_RE.test(x))
    : []
  if (ids.length === 0) {
    return NextResponse.json({ error: "No se recibió ninguna grabación para descargar" }, { status: 400 })
  }
  return buildZip(context, { dateFilter: null, surveyorIdFilter: null, recordingIdsFilter: ids, wantsMp3: body?.format === "mp3" })
}

async function buildZip({ params }: RouteContext, { dateFilter, surveyorIdFilter, recordingIdsFilter, wantsMp3 }: ZipInput) {
  // Ítem "revisar los accesos y permisos de cada rol" (13/10/2026): mismo
  // criterio que recordings/route.ts — faltaba "coordinator".
  const auth = await requireRole(["admin", "supervisor", "coordinator"])
  if (!auth.ok) return auth.response

  try {
    const { id: surveyId } = await params
    const admin = createAdminSupabase() as any

    const { data: survey } = await admin
      .from("surveys")
      .select("id, title, code, project_id, projects(name)")
      .eq("id", surveyId)
      .maybeSingle()

    if (!survey) {
      return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 })
    }

    const { data: responses } = await admin
      .from("responses")
      .select("id, created_at, completed_at, outcome, assignment_id, respondent_id, metadata")
      .eq("survey_id", surveyId)

    const responseIds = (responses || []).map((r: any) => r.id)
    if (responseIds.length === 0) {
      return NextResponse.json({ error: "Esta encuesta no tiene respuestas todavía" }, { status: 404 })
    }
    const responseById = new Map<string, any>((responses || []).map((r: any) => [r.id, r]))

    // Ítem 26/10/2026 ("deberían llegar todos los audios al seleccionado,
    // pero solo llegó uno"): "Seleccionar todo" en la pestaña Audios marca
    // tanto ids de scope='survey' como de scope='shift' (los clips sueltos
    // "Antes de iniciar", que existen SOLOS para respuestas de incidencia —
    // esas nunca tienen grabación scope='survey', ver comentario en
    // app/api/portal-encuestador/responses/finish/route.ts). La consulta de
    // abajo (recordingsQuery) fuerza scope='survey', así que esos ids
    // simplemente desaparecían del ZIP sin aviso. La atribución clip ->
    // respuesta sale del mismo módulo que usa el repositorio
    // (lib/audio-attribution.ts), así el ZIP contiene exactamente lo que se
    // ve y se marca en pantalla.
    const { preClipsByResponseId } = await resolvePreSurveyClips(admin, responses || [])
    const responseIdByShiftClipId = new Map<string, string>()
    const shiftClipById = new Map<string, any>()
    for (const [responseId, clips] of preClipsByResponseId) {
      for (const clip of clips) {
        responseIdByShiftClipId.set(clip.id, responseId)
        shiftClipById.set(clip.id, clip)
      }
    }

    // Por lotes (ver lib/supabase-chunked.ts): con encuestas grandes o una
    // selección grande, un solo .in() superaba el largo máximo de URL (414).
    const surveyRecordings = (q: any) =>
      q.eq("scope", "survey").eq("upload_status", "uploaded").not("storage_path", "is", null)
    const RECORDING_COLUMNS = "id, surveyor_id, response_id, shift_id, started_at, storage_path"
    const { data: recordingsRaw, error: recordingsError } = recordingIdsFilter
      ? await selectInChunks(recordingIdsFilter, (chunk) =>
          surveyRecordings(admin.from("surveyor_recordings").select(RECORDING_COLUMNS).in("id", chunk))
        ).then((res) => ({
          // Solo grabaciones de respuestas de ESTA encuesta: un id ajeno en la
          // selección no puede colarse en el ZIP.
          ...res,
          data: res.data.filter((r: any) => responseById.has(r.response_id)),
        }))
      : await selectInChunks(responseIds, (chunk) => {
          let q = surveyRecordings(admin.from("surveyor_recordings").select(RECORDING_COLUMNS).in("response_id", chunk))
          if (surveyorIdFilter) q = q.eq("surveyor_id", surveyorIdFilter)
          return q
        })

    if (recordingsError) {
      console.error("Error obteniendo grabaciones para ZIP:", recordingsError)
      return NextResponse.json({ error: "No se pudieron obtener las grabaciones" }, { status: 500 })
    }

    // Filtro por fecha (en memoria): la "fecha efectiva" de una grabación es
    // la misma que usa el nombre de carpeta más abajo (started_at, o el
    // created_at de la respuesta si no hay started_at) — filtrar acá antes
    // evita descargar/procesar grabaciones que no van a incluirse en el ZIP.
    // No aplica cuando ya se filtró por recordingIds explícitos (selección
    // de árbol) — ahí la selección YA es exacta, filtrar de nuevo por fecha
    // podría excluir algo que el usuario marcó a propósito.
    // Ítem 26/10/2026 ("debe concordar con lo que se está filtrando"):
    // slice(0,10) sobre un ISO UTC da la fecha calendario del SERVIDOR, no
    // la de Bogotá — mismo bug ya corregido en audios-tab.tsx (el `date` que
    // llega acá en la URL es justamente ese bogotaDayKey que arma el
    // frontend al filtrar/agrupar). Comparar con slice(0,10) podía excluir
    // (o incluir de más) grabaciones de la noche, desajustando el ZIP
    // respecto a lo que el usuario ve filtrado en pantalla.
    const recordings = dateFilter && !recordingIdsFilter
      ? (recordingsRaw || []).filter((r: any) => {
          const response = responseById.get(r.response_id)
          const effectiveDate = r.started_at ? bogotaDayKey(r.started_at) : (response?.created_at ? bogotaDayKey(response.created_at) : "")
          return effectiveDate === dateFilter
        })
      : recordingsRaw

    // Ids seleccionados en el árbol que son clips sueltos "Antes de iniciar"
    // (scope='shift') — no los trajo recordingsQuery porque esa consulta
    // fuerza scope='survey'. Se resuelven acá con el mapeo calculado arriba.
    const standaloneShiftRecs = recordingIdsFilter
      ? recordingIdsFilter
          .filter((id) => !(recordings || []).some((r: any) => r.id === id))
          .map((id) => shiftClipById.get(id))
          .filter(Boolean)
      : []

    if ((!recordings || recordings.length === 0) && standaloneShiftRecs.length === 0) {
      return NextResponse.json({ error: "No hay grabaciones de audio para esta encuesta con ese filtro" }, { status: 404 })
    }

    const surveyorIds = Array.from(
      new Set([
        ...(recordings || []).map((r: any) => r.surveyor_id).filter(Boolean),
        ...standaloneShiftRecs.map((r: any) => r.surveyor_id).filter(Boolean),
      ])
    )
    const { data: surveyors } = await selectInChunks(surveyorIds as string[], (chunk) =>
      admin.from("surveyors").select("id, name").in("id", chunk)
    )
    const surveyorNameById = new Map<string, string>((surveyors || []).map((s: any) => [s.id, s.name || "Sin nombre"]))

    const surveyName = survey.title || "Sin título"
    const surveyCode: string | null = (survey as any).code ?? null
    const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 80) || "Sin nombre"
    // Ítem 26/11/2026: la carpeta principal del ZIP lleva el ID de la
    // encuesta (el código de su configuración, ej. GT-ALC-CALI-0926) en vez
    // de Proyecto/Título — el ID ya identifica la encuesta. Si una encuesta
    // vieja no tiene código, se usa el título.
    const rootFolder = sanitize(surveyCode || surveyName)
    // Ítem "Nombre de los audios" (acta 05/10/2026): mismo formato que ya
    // usa /api/surveys/[id]/recordings — ver comentario ahí.
    const OUTCOME_LABEL: Record<string, string> = {
      efectiva: "Efectiva", incidencia: "Incidencia", abandonada: "Abandonada", descalificado: "Descalificada",
    }
    // Ítem 19/10/2026 ("el id está muy largo en los audios, truncarlo hasta
    // el primer guion"): mismo criterio que /api/surveys/[id]/recordings —
    // solo el primer segmento del UUID (ej. 5b9497a8), suficiente para
    // diferenciar PARTE 1/2/3 de un mismo intento.
    const shortId = (id: string) => id.split("-")[0]
    const buildBaseName = (surveyorName: string, dateStr: string, outcome: string | null, responseId: string) => {
      const parts = [sanitize(surveyorName), dateStr]
      if (surveyCode) parts.push(sanitize(surveyCode))
      parts.push(outcome ? (OUTCOME_LABEL[outcome] || outcome) : "Sin-estado", shortId(responseId))
      return parts.join(" - ")
    }

    // PARTE N por RESPUESTA (no por posición en el array) — mismo criterio
    // que partNumberByRecordingId en recordings/route.ts. Necesario porque
    // un mismo intento puede tener varias grabaciones scope='survey' si el
    // encuestador entró/salió de la encuesta varias veces; sin numerar por
    // respuesta, dos segmentos de un mismo intento competían por el nombre
    // "PARTE 1" y uno pisaba al otro en el ZIP.
    const partNumberByRecordingId = new Map<string, number>()
    {
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
    }

    // ANTES N por RESPUESTA, mismo motivo: la grabación de fondo puede
    // cortar varios clips antes de que el encuestador toque "Iniciar
    // Encuesta" (p.ej. una Incidencia reportada en dos partes) — sin
    // numerar, todos esos clips de una misma respuesta se llamaban igual
    // ("ANTES 1") y el ZIP terminaba con menos archivos de los marcados.
    const antesNumberByClipId = new Map<string, number>()
    {
      const byResponseId = new Map<string, any[]>()
      for (const rec of standaloneShiftRecs as any[]) {
        const responseId = responseIdByShiftClipId.get(rec.id) || rec.id
        if (!byResponseId.has(responseId)) byResponseId.set(responseId, [])
        byResponseId.get(responseId)!.push(rec)
      }
      for (const group of byResponseId.values()) {
        group.sort((a, b) => (a.started_at || "").localeCompare(b.started_at || ""))
        group.forEach((rec, i) => antesNumberByClipId.set(rec.id, i + 1))
      }
    }

    const archive = new ZipArchive({ zlib: { level: 6 } })
    archive.on("warning", (err: Error) => console.warn("[audios/zip] warning:", err))
    archive.on("error", (err: Error) => console.error("[audios/zip] error:", err))

    // Descarga + agrega cada grabación al archive de forma secuencial (no
    // Promise.all) para no tener N descargas de audio completas en memoria
    // a la vez. Un id marcado en el árbol = un archivo en el ZIP, sin
    // fusionar nada server-side (ver comentario de cabecera, 26/11/2026).
    ;(async () => {
      for (const rec of recordings as any[]) {
        try {
          if (!rec.storage_path) continue
          const surveyorName = sanitize(surveyorNameById.get(rec.surveyor_id) || "Sin asignar")
          const response = responseById.get(rec.response_id)
          const dateStr = bogotaDayKey(rec.started_at || response?.created_at || new Date().toISOString())
          const folderBase = `${rootFolder}/${dateStr}/${surveyorName}`

          const { data: fileBlob, error: downloadError } = await admin.storage
            .from("response-media")
            .download(rec.storage_path)
          if (downloadError || !fileBlob) {
            console.error("[audios/zip] no se pudo descargar", rec.storage_path, downloadError)
            continue
          }
          const buffer = Buffer.from(await fileBlob.arrayBuffer())
          const ext = rec.storage_path.split(".").pop() || "webm"
          const mp3 = wantsMp3 ? await convertToMp3(buffer, ext) : null
          const baseName = buildBaseName(surveyorNameById.get(rec.surveyor_id) || "Sin asignar", dateStr, response?.outcome ?? null, rec.response_id)
          const partNum = partNumberByRecordingId.get(rec.id) ?? 1
          const fileName = `${baseName} - PARTE ${partNum}.${mp3 ? "mp3" : ext}`
          archive.append(mp3 || buffer, { name: `${folderBase}/${fileName}` })
        } catch (err) {
          console.error("[audios/zip] error procesando grabación", rec.id, err)
        }
      }

      // Clips sueltos "Antes de iniciar" (scope='shift') marcados en el
      // árbol sin una grabación scope='survey' asociada — el caso típico es
      // una Incidencia, que nunca llega a "Iniciar Encuesta" (ver comentario
      // arriba de standaloneShiftRecs). Se agregan como archivo
      // independiente, con el mismo esquema de nombre que ya usa
      // /api/surveys/[id]/recordings para estos clips (sufijo "ANTES").
      for (const rec of standaloneShiftRecs as any[]) {
        try {
          if (!rec.storage_path) continue
          const responseId = responseIdByShiftClipId.get(rec.id) || null
          const response = responseId ? responseById.get(responseId) : null
          const surveyorName = sanitize(surveyorNameById.get(rec.surveyor_id) || "Sin asignar")
          const dateStr = bogotaDayKey(rec.started_at || response?.created_at || new Date().toISOString())
          const folderBase = `${rootFolder}/${dateStr}/${surveyorName}`

          const { data: fileBlob, error: downloadError } = await admin.storage
            .from("response-media")
            .download(rec.storage_path)
          if (downloadError || !fileBlob) {
            console.error("[audios/zip] no se pudo descargar", rec.storage_path, downloadError)
            continue
          }
          const buffer = Buffer.from(await fileBlob.arrayBuffer())
          const ext = rec.storage_path.split(".").pop() || "webm"
          const mp3 = wantsMp3 ? await convertToMp3(buffer, ext) : null
          const baseName = buildBaseName(
            surveyorNameById.get(rec.surveyor_id) || "Sin asignar",
            dateStr,
            response?.outcome ?? null,
            responseId || rec.id
          )
          const antesNum = antesNumberByClipId.get(rec.id) ?? 1
          const fileName = `${baseName} - ANTES ${antesNum}.${mp3 ? "mp3" : ext}`
          archive.append(mp3 || buffer, { name: `${folderBase}/${fileName}` })
        } catch (err) {
          console.error("[audios/zip] error procesando clip suelto", rec.id, err)
        }
      }

      archive.finalize()
    })()

    const webStream = Readable.toWeb(archive as unknown as Readable) as ReadableStream

    const filterSuffix = recordingIdsFilter
      ? "seleccion"
      : [dateFilter, surveyorIdFilter ? surveyorNameById.get(surveyorIdFilter) : null]
          .filter(Boolean)
          .map((s) => sanitize(String(s)))
          .join("_")
    const zipFilename = `audios_${rootFolder}${filterSuffix ? `_${filterSuffix}` : ""}.zip`
    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
      },
    })
  } catch (error: any) {
    console.error("Error en /api/surveys/[id]/audios/zip:", error)
    return NextResponse.json({ error: "Error interno del servidor", details: error?.message || String(error) }, { status: 500 })
  }
}
