import { NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { requireRole } from "@/lib/api-auth"

// POST /api/surveyors/[id]/force-logout
//
// Ítem pedido 09/09/2026: "restringir el cierre de sesión del encuestador —
// una vez iniciada la jornada, el encuestador no debería poder cerrar su
// propia sesión. Solo el supervisor o administrador podría cerrarla
// remotamente desde la lista de encuestadores."
//
// Solo marca la intención (surveyors.force_logout_requested_at = now()) —
// el portal del encuestador la recoge y se cierra sola en su próximo ping
// de ubicación (ver app/api/location/route.ts, que la consume y limpia en
// el mismo request). No hay forma de invalidar una sesión de Supabase Auth
// "a la fuerza" de un lado a otro sin cooperación del cliente — este es el
// mismo patrón (mejor esfuerzo, vía polling) que ya usa el resto del portal
// para llegar al dispositivo del encuestador (mensajes, ubicación, etc.).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["admin", "supervisor"])
  if (!auth.ok) return auth.response

  const { id } = await params
  const admin = createAdminSupabase()

  const { data: surveyor, error: fetchError } = await admin
    .from("surveyors")
    .select("id, supervisor_id")
    .eq("id", id)
    .maybeSingle()

  if (fetchError || !surveyor) {
    return NextResponse.json({ error: "Encuestador no encontrado" }, { status: 404 })
  }

  // Un supervisor solo puede forzar el cierre de sesión de SU propio
  // equipo — mismo criterio de alcance que el resto del portal (ver
  // resolveTeamSurveyorIds en app/api/tracking/route.ts).
  if (auth.user.role === "supervisor" && (surveyor as any).supervisor_id !== auth.user.id) {
    return NextResponse.json({ error: "No tienes permiso sobre este encuestador" }, { status: 403 })
  }

  // Cast a any: force_logout_requested_at es una columna nueva (ver
  // db/migrations/2026-09-09_add_surveyor_force_logout.sql) que todavía no
  // existe en los tipos generados de Supabase.
  const { error: updateError } = await (admin as any)
    .from("surveyors")
    .update({ force_logout_requested_at: new Date().toISOString() })
    .eq("id", id)

  if (updateError) {
    console.error("Error solicitando cierre de sesión remoto:", updateError)
    return NextResponse.json({ error: "No se pudo registrar el cierre de sesión remoto" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
