import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { requireRole } from "@/lib/api-auth"
import { ZipArchive } from "archiver"
import { Readable } from "stream"

// GET /api/surveys/[id]/audios/zip — descarga TODAS las grabaciones de
// audio de una encuesta en un único ZIP, organizadas en carpetas
// Proyecto/Encuesta/Fecha/Encuestador/archivo (reunión 2026-08-27,
// módulo "Audios").
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
// El ZIP se arma en streaming (archiver + Readable.toWeb) para no cargar
// todas las grabaciones en memoria a la vez — cada archivo se descarga de
// Supabase Storage, se agrega al archive, y se libera antes de pasar al
// siguiente.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["admin", "supervisor"])
  if (!auth.ok) return auth.response

  try {
    const { id: surveyId } = await params
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

    const { data: recordings, error: recordingsError } = await admin
      .from("surveyor_recordings")
      .select("id, surveyor_id, response_id, started_at, storage_path")
      .in("response_id", responseIds)
      .eq("scope", "survey")
      .eq("upload_status", "uploaded")
      .not("storage_path", "is", null)

    if (recordingsError) {
      console.error("Error obteniendo grabaciones para ZIP:", recordingsError)
      return NextResponse.json({ error: "No se pudieron obtener las grabaciones" }, { status: 500 })
    }
    if (!recordings || recordings.length === 0) {
      return NextResponse.json({ error: "No hay grabaciones de audio para esta encuesta" }, { status: 404 })
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
          const { data: fileBlob, error: downloadError } = await admin.storage
            .from("response-media")
            .download(rec.storage_path)
          if (downloadError || !fileBlob) {
            console.error("[audios/zip] no se pudo descargar", rec.storage_path, downloadError)
            continue
          }
          const buffer = Buffer.from(await fileBlob.arrayBuffer())

          const surveyorName = sanitize(surveyorNameById.get(rec.surveyor_id) || "Sin asignar")
          const response = responseById.get(rec.response_id)
          const dateStr = (rec.started_at || response?.created_at || new Date().toISOString()).slice(0, 10)
          const ext = rec.storage_path.split(".").pop() || "webm"
          const fileName = `grabacion_${rec.id.slice(0, 8)}.${ext}`
          const folderPath = `${sanitize(projectName)}/${sanitize(surveyName)}/${dateStr}/${surveyorName}/${fileName}`

          archive.append(buffer, { name: folderPath })
        } catch (err) {
          console.error("[audios/zip] error procesando grabación", rec.id, err)
        }
      }
      archive.finalize()
    })()

    const webStream = Readable.toWeb(archive as unknown as Readable) as ReadableStream

    const zipFilename = `audios_${sanitize(surveyName)}.zip`
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
