import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { requireRole } from "@/lib/api-auth"
import { mergeAudioSegments, convertToMp3 } from "@/lib/audio-merge"
import { ZipArchive } from "archiver"
import { Readable } from "stream"

// GET /api/surveys/[id]/audios/zip?date=YYYY-MM-DD&surveyorId=<uuid> —
// descarga las grabaciones de audio de una encuesta en un único ZIP,
// organizadas en carpetas Proyecto/Encuesta/Fecha/Encuestador/archivo
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
// Pedido 2026-08-31: fusionar en UN solo archivo por encuestado el audio
// "de antes" (segmentos scope='shift' del turno, grabados justo antes de
// "Iniciar Encuesta" — ver app/api/reports/individual/[id]/route.ts, mismo
// criterio de ventana de 30 min) con el de la encuesta misma
// (scope='survey'), vía ffmpeg (lib/audio-merge.ts). Si la fusión falla
// por lo que sea, cae con gracia: deja los clips sueltos en el ZIP en vez
// de romper la descarga completa por un solo archivo problemático.
//
// El ZIP se arma en streaming (archiver + Readable.toWeb) para no cargar
// todas las grabaciones en memoria a la vez — cada archivo se descarga de
// Supabase Storage, se agrega al archive, y se libera antes de pasar al
// siguiente.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["admin", "supervisor"])
  if (!auth.ok) return auth.response

  try {
    const { id: surveyId } = await params
    const { searchParams } = new URL(request.url)
    const dateFilter = searchParams.get("date") // YYYY-MM-DD, opcional
    const surveyorIdFilter = searchParams.get("surveyorId") // opcional
    // Ítem 09/09/2026: "crear un repositorio jerárquico para descargar
    // audios — encuesta → fecha → encuestador → audios, permitir
    // seleccionar mediante casillas exactamente qué carpetas o audios
    // descargar". date/surveyorId (arriba) solo soportan UN valor cada
    // uno — no alcanza para una selección de árbol con casillas (varias
    // fechas y/o encuestadores sueltos a la vez). recordingIds, cuando
    // viene, manda sobre esos dos filtros: es la lista exacta de
    // surveyor_recordings.id que el árbol dejó marcados.
    const recordingIdsParam = searchParams.get("recordingIds") // CSV de ids, opcional
    const recordingIdsFilter = recordingIdsParam ? recordingIdsParam.split(",").filter(Boolean) : null
    // Ítem #36 (acta 07/09/2026): "¿en qué otro formato podemos guardar estos
    // audios? Que no sea webm" — opcional, default se mantiene en el formato
    // original grabado por el navegador (webm/opus) para no romper nada para
    // quien no pida el cambio.
    const wantsMp3 = searchParams.get("format") === "mp3"
    const admin = createAdminSupabase() as any

    const { data: survey } = await admin
      .from("surveys")
      .select("id, title, project_id, projects(name)")
      .eq("id", surveyId)
      .maybeSingle()

    if (!survey) {
      return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 })
    }

    const { data: responses } = await admin
      .from("responses")
      .select("id, created_at")
      .eq("survey_id", surveyId)

    const responseIds = (responses || []).map((r: any) => r.id)
    if (responseIds.length === 0) {
      return NextResponse.json({ error: "Esta encuesta no tiene respuestas todavía" }, { status: 404 })
    }
    const responseById = new Map<string, any>((responses || []).map((r: any) => [r.id, r]))

    let recordingsQuery = admin
      .from("surveyor_recordings")
      .select("id, surveyor_id, response_id, shift_id, started_at, storage_path")
      .in("response_id", responseIds)
      .eq("scope", "survey")
      .eq("upload_status", "uploaded")
      .not("storage_path", "is", null)
    if (recordingIdsFilter) recordingsQuery = recordingsQuery.in("id", recordingIdsFilter)
    else if (surveyorIdFilter) recordingsQuery = recordingsQuery.eq("surveyor_id", surveyorIdFilter)

    const { data: recordingsRaw, error: recordingsError } = await recordingsQuery

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
    const recordings = dateFilter && !recordingIdsFilter
      ? (recordingsRaw || []).filter((r: any) => {
          const response = responseById.get(r.response_id)
          const effectiveDate = (r.started_at || response?.created_at || "").slice(0, 10)
          return effectiveDate === dateFilter
        })
      : recordingsRaw

    if (!recordings || recordings.length === 0) {
      return NextResponse.json({ error: "No hay grabaciones de audio para esta encuesta con ese filtro" }, { status: 404 })
    }

    const surveyorIds = Array.from(new Set(recordings.map((r: any) => r.surveyor_id).filter(Boolean)))
    const { data: surveyors } = await admin.from("surveyors").select("id, name").in("id", surveyorIds)
    const surveyorNameById = new Map<string, string>((surveyors || []).map((s: any) => [s.id, s.name || "Sin nombre"]))

    const projectName = (survey.projects as any)?.name || "Sin proyecto"
    const surveyName = survey.title || "Sin título"
    const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 80) || "Sin nombre"

    const archive = new ZipArchive({ zlib: { level: 6 } })
    archive.on("warning", (err: Error) => console.warn("[audios/zip] warning:", err))
    archive.on("error", (err: Error) => console.error("[audios/zip] error:", err))

    // Descarga + agrega cada grabación al archive de forma secuencial (no
    // Promise.all) para no tener N descargas de audio completas en memoria
    // a la vez.
    ;(async () => {
      for (const rec of recordings as any[]) {
        try {
          const surveyorName = sanitize(surveyorNameById.get(rec.surveyor_id) || "Sin asignar")
          const response = responseById.get(rec.response_id)
          const dateStr = (rec.started_at || response?.created_at || new Date().toISOString()).slice(0, 10)
          const folderBase = `${sanitize(projectName)}/${sanitize(surveyName)}/${dateStr}/${surveyorName}`

          // Segmentos "de antes" (fondo del turno, ver comentario de cabecera)
          // que terminan justo antes de que arrancara esta encuesta — mismo
          // criterio de ventana (30 min) que app/api/reports/individual/[id]/route.ts.
          let preRows: { storage_path: string; started_at: string | null }[] = []
          if (rec.shift_id && rec.started_at) {
            // Ítem 09/09/2026 (mismo fix que app/api/reports/individual/[id]/route.ts):
            // acota la ventana al final del intento anterior de este mismo
            // turno, si hay uno, para no mezclar audio "de antes" de un
            // intento abandonado previo con el de esta grabación.
            let lowerBound = new Date(new Date(rec.started_at).getTime() - 30 * 60 * 1000).toISOString()
            const { data: prevAttempt } = await admin
              .from("surveyor_recordings")
              .select("ended_at")
              .eq("shift_id", rec.shift_id)
              .eq("scope", "survey")
              .neq("id", rec.id)
              .lt("started_at", rec.started_at)
              .gte("started_at", lowerBound)
              .order("started_at", { ascending: false })
              .limit(1)
              .maybeSingle()
            if ((prevAttempt as any)?.ended_at && (prevAttempt as any).ended_at > lowerBound) {
              lowerBound = (prevAttempt as any).ended_at
            }
            const { data } = await admin
              .from("surveyor_recordings")
              .select("storage_path, started_at")
              .eq("shift_id", rec.shift_id)
              .eq("scope", "shift")
              .eq("upload_status", "uploaded")
              .not("storage_path", "is", null)
              .gte("started_at", lowerBound)
              .lt("started_at", rec.started_at)
              .order("started_at", { ascending: true })
              .limit(10)
            preRows = data || []
          }

          // Descarga el clip de la encuesta + todos los "de antes", en orden
          // cronológico (los de antes primero, la encuesta al final).
          const allPaths = [...preRows.map((r) => r.storage_path), rec.storage_path]
          const downloaded: { buffer: Buffer; ext: string }[] = []
          for (const path of allPaths) {
            const { data: fileBlob, error: downloadError } = await admin.storage
              .from("response-media")
              .download(path)
            if (downloadError || !fileBlob) {
              console.error("[audios/zip] no se pudo descargar", path, downloadError)
              continue
            }
            downloaded.push({
              buffer: Buffer.from(await fileBlob.arrayBuffer()),
              ext: path.split(".").pop() || "webm",
            })
          }
          if (downloaded.length === 0) continue

          if (downloaded.length > 1) {
            // Varios segmentos para este encuestado: se fusionan en un solo
            // archivo. Si ffmpeg falla por lo que sea, se cae con gracia a
            // agregar cada clip por separado en vez de perder la grabación.
            const merged = await mergeAudioSegments(downloaded)
            if (merged) {
              // Ítem #36: conversión opcional a mp3 — si falla, se deja el
              // webm ya fusionado en vez de perder el archivo.
              const mp3 = wantsMp3 ? await convertToMp3(merged, "webm") : null
              const fileName = `grabacion_${rec.id.slice(0, 8)}.${mp3 ? "mp3" : "webm"}`
              archive.append(mp3 || merged, { name: `${folderBase}/${fileName}` })
              continue
            }
            console.error("[audios/zip] fusión falló para", rec.id, "— se dejan los clips sueltos")
          }

          for (let idx = 0; idx < downloaded.length; idx++) {
            const seg = downloaded[idx]
            const suffix = downloaded.length > 1 ? (idx < downloaded.length - 1 ? `_antes_${idx + 1}` : "") : ""
            const mp3 = wantsMp3 ? await convertToMp3(seg.buffer, seg.ext) : null
            const fileName = `grabacion_${rec.id.slice(0, 8)}${suffix}.${mp3 ? "mp3" : seg.ext}`
            archive.append(mp3 || seg.buffer, { name: `${folderBase}/${fileName}` })
          }
        } catch (err) {
          console.error("[audios/zip] error procesando grabación", rec.id, err)
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
    const zipFilename = `audios_${sanitize(surveyName)}${filterSuffix ? `_${filterSuffix}` : ""}.zip`
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
