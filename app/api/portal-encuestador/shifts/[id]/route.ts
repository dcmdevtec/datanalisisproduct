import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { resolveCurrentSurveyor } from "@/lib/portal-encuestador/auth"

// Cierra un turno (logout, cierre de pestaña detectado por beacon, o fin de jornada).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const surveyor = await resolveCurrentSurveyor()
    if (!surveyor) {
      return NextResponse.json({ error: "No autorizado o encuestador no vinculado" }, { status: 401 })
    }
    const { id: shiftId } = await params
    const admin = createAdminSupabase()

    // surveyor_shifts es una tabla nueva (ver sql/2026_07_surveyor_portal.sql) que aún
    // no existe en los tipos generados de Supabase — se castea a any, mismo patrón usado
    // en el resto del proyecto para tablas fuera del generador de tipos.
    const { error } = await (admin as any)
      .from("surveyor_shifts")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", shiftId)
      .eq("surveyor_id", surveyor.surveyorId) // un encuestador solo puede cerrar SUS turnos

    if (error) {
      console.error("Error cerrando turno:", error)
      return NextResponse.json({ error: "No se pudo cerrar el turno" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error en portal-encuestador/shifts/[id] PATCH:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
