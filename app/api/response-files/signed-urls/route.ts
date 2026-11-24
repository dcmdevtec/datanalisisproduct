import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { requireRole } from "@/lib/api-auth"

// Genera URLs firmadas (1h) para todos los archivos de una pregunta tipo file/image_upload,
// dado un questionId. Se usa desde la pestaña "Análisis de resultados" para mostrar
// la galería de fotos/archivos sin incluir las URLs en la respuesta del API principal
// (las signed URLs expiran en 1h y el API principal se cachea en el cliente).
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(["admin", "supervisor"])
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get("questionId")
    const surveyFilter = searchParams.get("survey") || "all"

    if (!questionId) {
      return NextResponse.json({ error: "questionId requerido" }, { status: 400 })
    }

    const admin = createAdminSupabase() as any

    // Trae todas las respuestas de esta pregunta. Con filtro de encuesta se
    // filtra por la tabla unida (responses!inner): antes se pasaban hasta
    // 5000 ids de respuestas en un .in(), que superaba el límite de URL del
    // servidor (414) con más de ~250, y si la encuesta no tenía respuestas
    // no se aplicaba ningún filtro y salían archivos de TODAS las encuestas.
    let answersQuery = admin
      .from("answers")
      .select(surveyFilter !== "all" ? "id, value, response_id, responses!inner(survey_id)" : "id, value, response_id, responses(survey_id)")
      .eq("question_id", questionId)
      .limit(500)
    if (surveyFilter !== "all") {
      answersQuery = answersQuery.eq("responses.survey_id", surveyFilter)
    }

    const { data: answers } = await answersQuery

    // Parsea los archivos (soporta JSON array y CSV del APK)
    const fileList: { answerId: string; path: string; name: string; type: string }[] = []
    for (const a of (answers as any[]) || []) {
      const val = a.value
      if (Array.isArray(val)) {
        for (const f of val) {
          if (f && typeof f === "object" && typeof f.path === "string" && f.path.startsWith("survey-responses/")) {
            fileList.push({ answerId: a.id, path: f.path, name: f.name || f.path.split("/").pop() || "", type: f.type || "image/jpeg" })
          }
        }
      } else if (typeof val === "string" && val.trim()) {
        const parts = val.split(",").map((s: string) => s.trim())
        const pathPart = parts.find((p: string) => p.startsWith("survey-responses/"))
        if (pathPart) {
          const name = parts[0] || pathPart.split("/").pop() || ""
          const type = parts.find((p: string) => p.startsWith("image/") || p === "application/pdf") || "image/jpeg"
          fileList.push({ answerId: a.id, path: pathPart, name, type })
        }
      }
    }

    // Genera signed URLs en batch
    const files = await Promise.all(
      fileList.map(async (f) => {
        const { data: signed } = await admin.storage.from("response-media").createSignedUrl(f.path, 3600)
        return { ...f, url: signed?.signedUrl ?? null }
      })
    )

    return NextResponse.json({ files: files.filter((f) => f.url) })
  } catch (error: any) {
    console.error("Error en /api/response-files/signed-urls:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
