import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/api-auth"
import { createAdminSupabase } from "@/lib/supabase-server"

// POST /api/shared-reports — crea un link compartible (requiere auth admin/supervisor)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(["admin", "supervisor"])
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { surveyId, config } = body

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

// GET /api/shared-reports — lista los links creados por el usuario (requiere auth)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(["admin", "supervisor"])
    if (!auth.ok) return auth.response

    const admin = createAdminSupabase()
    const { data, error } = await admin
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
