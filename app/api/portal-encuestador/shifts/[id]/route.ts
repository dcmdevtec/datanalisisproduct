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

    // Fix 2026-07-29: marcar el momento exacto del cierre de sesión para que
    // el mapa de rastreo (app/api/tracking/route.ts, calcStatus()) pueda
    // mostrar "offline" de inmediato en vez de esperar el umbral pasivo de
    // 5 min por falta de señal. No bloquea la respuesta si falla — cerrar
    // el turno ya es lo importante, esto es solo para el indicador visual.
    // Cast a any: last_logout_at es una columna nueva (ver
    // sql/2026_07_add_surveyor_last_logout_at.sql) que aún no existe en los
    // tipos generados de Supabase — mismo patrón usado arriba para
    // surveyor_shifts.
    const { error: logoutError } = await (admin as any)
      .from("surveyors")
      .update({ last_logout_at: new Date().toISOString() })
      .eq("id", surveyor.surveyorId)
    if (logoutError) {
      console.error("Error registrando last_logout_at:", logoutError)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error en portal-encuestador/shifts/[id] PATCH:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
