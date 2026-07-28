import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { resolveCurrentSurveyor } from "@/lib/portal-encuestador/auth"

// Inicia un turno de trabajo. Se llama automáticamente al entrar al portal
// (no requiere acción manual del encuestador — la grabación debe arrancar
// "apenas inicien sesión" según el pedido).
export async function POST() {
  try {
    const surveyor = await resolveCurrentSurveyor()
    if (!surveyor) {
      return NextResponse.json({ error: "No autorizado o encuestador no vinculado" }, { status: 401 })
    }
    // surveyor_shifts es tabla nueva (ver sql/2026_07_surveyor_portal.sql), aún no
    // presente en los tipos generados de Supabase — se castea a any en este archivo.
    const admin = createAdminSupabase() as any

    // Si ya hay un turno activo (ej. refresh de página), lo reutiliza en vez
    // de crear uno nuevo — evita fragmentar el audio del mismo turno real.
    const { data: existing } = await admin
      .from("surveyor_shifts")
      .select("id, started_at")
      .eq("surveyor_id", surveyor.surveyorId)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ shiftId: existing.id, startedAt: existing.started_at, reused: true })
    }

    const { data: created, error } = await admin
      .from("surveyor_shifts")
      .insert([{ surveyor_id: surveyor.surveyorId, status: "active" }])
      .select("id, started_at")
      .single()

    if (error || !created) {
      console.error("Error creando turno:", error)
      return NextResponse.json({ error: "No se pudo iniciar el turno" }, { status: 500 })
    }

    return NextResponse.json({ shiftId: created.id, startedAt: created.started_at, reused: false })
  } catch (error) {
    console.error("Error en portal-encuestador/shifts POST:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
