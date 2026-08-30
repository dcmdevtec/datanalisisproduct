import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/api-auth"
import { createAdminSupabase } from "@/lib/supabase-server"
import { createHash } from "crypto"

function hashPassword(pw: string): string {
  return createHash("sha256").update(pw).digest("hex")
}

// POST /api/shared-reports — crea un link compartible (requiere auth admin/supervisor)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(["admin", "supervisor"])
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { surveyId, config, customTitle, imageUrl, password } = body

    if (!surveyId || surveyId === "all") {
      return NextResponse.json(
        { error: "Debes seleccionar una encuesta específica para compartir el reporte." },
        { status: 400 }
      )
    }

    // Calcular expires_at según la opción elegida
    const expiryDays: number | null = body.expiryDays ?? null
    const expiresAt = expiryDays
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
      : null

    const admin = createAdminSupabase()

    // Obtener el título de la encuesta para incluirlo en el config
    const { data: survey } = await admin
      .from("surveys")
      .select("title, description")
      .eq("id", surveyId)
      .maybeSingle()

    const fullConfig = {
      ...config,
      surveyTitle: survey?.title ?? "Encuesta",
      surveyDescription: survey?.description ?? "",
      customTitle: customTitle?.trim() || null,
      // Imagen de rich preview (Open Graph) — se sube antes a
      // /api/shared-reports/upload-image (bucket público "share-previews")
      // y acá solo se guarda la URL resultante.
      imageUrl: typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null,
      passwordHash: password?.trim() ? hashPassword(password.trim()) : null,
    }

    const { data, error } = await (admin as any)
      .from("shared_reports")
      .insert({
        survey_id: surveyId,
        config: fullConfig,
        created_by: auth.user.id,
        expires_at: expiresAt,
      })
      .select("id, token, expires_at")
      .single()

    if (error) {
      console.error("[shared-reports] insert error:", error)
      return NextResponse.json({ error: "Error al crear el link compartible." }, { status: 500 })
    }

    return NextResponse.json({ token: data.token, expiresAt: data.expires_at })
  } catch (err) {
    console.error("[shared-reports] unexpected error:", err)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}

// PATCH /api/shared-reports?token=<token> — actualiza un link YA CREADO en
// vez de generar uno nuevo (reunión 2026-08-27: "Si elimino una gráfica del
// diseño del link, ¿Se actualiza? Todo cambio que se haga, debe reflejarse
// en el link enviado" — antes cada "Generar link" del modal creaba SIEMPRE
// un token nuevo; no había forma de corregir un link que ya se le mandó a
// alguien sin cambiarle la URL). Solo quien creó el link (o un admin) puede
// actualizarlo.
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireRole(["admin", "supervisor"])
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")
    if (!token) {
      return NextResponse.json({ error: "token es requerido" }, { status: 400 })
    }

    const body = await request.json()
    const { config, customTitle, imageUrl, password, expiryDays } = body

    const admin = createAdminSupabase()

    const { data: existing, error: findError } = await (admin as any)
      .from("shared_reports")
      .select("id, created_by, config")
      .eq("token", token)
      .maybeSingle()

    if (findError || !existing) {
      return NextResponse.json({ error: "Link no encontrado." }, { status: 404 })
    }
    if (existing.created_by !== auth.user.id && auth.user.role !== "admin") {
      return NextResponse.json({ error: "No tienes permiso para editar este link." }, { status: 403 })
    }

    const fullConfig = {
      ...existing.config,
      ...config,
      customTitle: customTitle !== undefined ? (customTitle?.trim() || null) : existing.config?.customTitle ?? null,
      imageUrl: imageUrl !== undefined
        ? (typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null)
        : existing.config?.imageUrl ?? null,
      // password vacío en el form no borra la contraseña existente — solo se
      // reemplaza si mandan un valor nuevo explícito. Para quitarla del
      // todo, mandar password: "" Y clearPassword: true.
      passwordHash: password?.trim()
        ? hashPassword(password.trim())
        : (body.clearPassword ? null : existing.config?.passwordHash ?? null),
    }

    const update: Record<string, any> = { config: fullConfig }
    if (expiryDays !== undefined) {
      update.expires_at = expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString() : null
    }

    const { data, error } = await (admin as any)
      .from("shared_reports")
      .update(update)
      .eq("token", token)
      .select("id, token, expires_at")
      .single()

    if (error) {
      console.error("[shared-reports] update error:", error)
      return NextResponse.json({ error: "Error al actualizar el link." }, { status: 500 })
    }

    return NextResponse.json({ token: data.token, expiresAt: data.expires_at })
  } catch (err) {
    console.error("[shared-reports] PATCH unexpected error:", err)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}

// GET /api/shared-reports — lista los links creados por el usuario (requiere auth)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(["admin", "supervisor"])
    if (!auth.ok) return auth.response

    const admin = createAdminSupabase()
    const { data, error } = await (admin as any)
      .from("shared_reports")
      .select("id, token, survey_id, config, created_at, expires_at")
      .eq("created_by", auth.user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: "Error al consultar los links." }, { status: 500 })
    }

    return NextResponse.json({ links: data ?? [] })
  } catch (err) {
    console.error("[shared-reports] GET error:", err)
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 })
  }
}
