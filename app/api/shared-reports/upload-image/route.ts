import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { requireRole } from "@/lib/api-auth"

// Sube la imagen de "rich preview" (Open Graph) para un link compartido de
// reportes — la que se ve cuando se pega el link en WhatsApp/Slack/etc.
// Va a un bucket PÚBLICO ("share-previews", ver migration.sql) porque los
// crawlers de esas plataformas no pueden autenticarse ni usar URLs firmadas
// de corta duración como las de "response-media".
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB — de sobra para una imagen de preview

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80)
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "supervisor"])
  if (!auth.ok) return auth.response

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Solo se permiten imágenes JPG, PNG o WEBP" }, { status: 400 })
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({
        error: `La imagen no debe superar los 5 MB (tamaño actual: ${(file.size / 1048576).toFixed(1)} MB)`,
      }, { status: 413 })
    }

    const admin = createAdminSupabase() as any
    const uniqueId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const path = `${uniqueId}-${sanitizeFilename(file.name || "preview.jpg")}`

    const { error: uploadError } = await admin.storage
      .from("share-previews")
      .upload(path, file, { upsert: false, contentType: file.type })

    if (uploadError) {
      console.error("Error subiendo imagen de preview:", uploadError)
      return NextResponse.json({ error: "No se pudo subir la imagen", details: uploadError.message }, { status: 500 })
    }

    const { data: publicUrlData } = admin.storage.from("share-previews").getPublicUrl(path)

    return NextResponse.json({ url: publicUrlData.publicUrl })
  } catch (error: any) {
    console.error("Error en /api/shared-reports/upload-image:", error)
    return NextResponse.json({ error: "Error interno del servidor", details: error?.message || String(error) }, { status: 500 })
  }
}
