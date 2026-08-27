import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"

// Sube el archivo/foto real de una pregunta tipo "file"/"image_upload"
// (auditoría de producción 2026-07-29: hasta ahora esa pregunta solo
// guardaba el NOMBRE del archivo en la respuesta — nunca el contenido. Este
// endpoint es la pieza que faltaba).
//
// INTENCIONALMENTE PÚBLICO (sin requireRole), igual que POST /api/responses:
// una persona respondiendo una encuesta pública en /encuesta/[id] no tiene
// sesión de Supabase. La validación de abuso se hace verificando que
// survey_id/question_id sean reales y que la pregunta sea del tipo correcto,
// no con auth.
//
// Sigue el mismo patrón ya usado para grabaciones de audio del portal
// (app/api/portal-encuestador/recordings/[id]/route.ts): bucket privado
// 'response-media', se guarda solo el storage_path (no una URL firmada
// permanente) — las URLs firmadas de corta duración se generan al momento
// de ver la respuesta (ver app/api/reports/individual/[id]/route.ts para el
// mismo patrón ya en uso con audio).
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf", "video/mp4", "video/quicktime", "video/webm"]
const MAX_SIZE_BYTES = 20 * 1024 * 1024  // 20 MB para imágenes y PDFs
const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024 // 200 MB para videos

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120)
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const surveyId = formData.get("survey_id") as string | null
    const questionId = formData.get("question_id") as string | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 })
    }
    if (!surveyId || !questionId) {
      return NextResponse.json({ error: "survey_id y question_id son requeridos" }, { status: 400 })
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Solo se permiten archivos JPG, PNG, PDF o video (MP4, MOV, WebM)" }, { status: 400 })
    }
    const isVideo = file.type.startsWith("video/")
    const sizeLimit = isVideo ? MAX_VIDEO_SIZE_BYTES : MAX_SIZE_BYTES
    if (file.size > sizeLimit) {
      return NextResponse.json({
        error: isVideo
          ? `El video no debe superar los 200 MB (tamaño actual: ${(file.size / 1048576).toFixed(1)} MB)`
          : "El archivo no debe superar los 20 MB",
      }, { status: 413 })
    }

    const admin = createAdminSupabase() as any

    // Valida que la pregunta exista, pertenezca a esa encuesta, y sea
    // realmente de tipo archivo/imagen — evita que este endpoint público se
    // use como un depósito genérico de archivos sin relación con ninguna
    // encuesta real.
    const { data: question, error: questionError } = await admin
      .from("questions")
      .select("id, type, survey_id")
      .eq("id", questionId)
      .eq("survey_id", surveyId)
      .maybeSingle()

    if (questionError || !question) {
      return NextResponse.json({ error: "Pregunta no encontrada para esta encuesta" }, { status: 404 })
    }
    if (!["file", "image_upload", "video"].includes((question as any).type)) {
      return NextResponse.json({ error: "Esta pregunta no acepta archivos" }, { status: 400 })
    }

    const extMap: Record<string, string> = {
      "application/pdf": "pdf", "image/png": "png",
      "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
    }
    const ext = extMap[file.type] || "jpg"
    const uniqueId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const path = `survey-responses/${surveyId}/${questionId}/${uniqueId}-${sanitizeFilename(file.name || `archivo.${ext}`)}`

    const { error: uploadError } = await admin.storage
      .from("response-media")
      .upload(path, file, { upsert: false, contentType: file.type })

    if (uploadError) {
      console.error("Error subiendo archivo de respuesta:", uploadError)
      return NextResponse.json({ error: "No se pudo subir el archivo", details: uploadError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      path,
      name: file.name || path.split("/").pop(),
      type: file.type,
      size: file.size,
    })
  } catch (error: any) {
    console.error("Error en /api/response-files/upload:", error)
    return NextResponse.json({ error: "Error interno del servidor", details: error?.message || String(error) }, { status: 500 })
  }
}
