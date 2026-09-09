import { NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { requireRole, resolveAllowedMessageReceivers } from "@/lib/api-auth"

// Ítem 09/09/2026 (revisión): el bloqueo real del botón "Cerrar sesión" del
// encuestador se descartó porque el force-logout remoto depende de un ping
// cada ~60s (lib/portal-encuestador/use-location-tracking.ts) y no es en
// tiempo real — bloquear al encuestador sin poder avisarle de inmediato al
// supervisor generaba una mala experiencia sin ningún beneficio real. En su
// lugar: el encuestador SIEMPRE puede cerrar su sesión, pero si lo hace con
// la jornada (turno) activa, se le avisa a su supervisor + todos los admins
// vía el sistema de mensajería existente (tabla `messages`, mismo canal que
// /portal-encuestador/mensajes y la bandeja de Reportes/Encuestas del admin).
//
// POST /api/portal-encuestador/self-logout-alert
// Sin body — el encuestador y su turno salen de la sesión autenticada.
export async function POST() {
  try {
    const auth = await requireRole(["surveyor"])
    if (!auth.ok) return auth.response

    const admin = createAdminSupabase()

    const { data: profile } = await admin
      .from("users")
      .select("name, email")
      .eq("id", auth.user.id)
      .maybeSingle()

    const surveyorName = (profile as any)?.name || (profile as any)?.email || auth.user.email || "Un encuestador"

    const receivers = await resolveAllowedMessageReceivers(auth.user)
    const receiverIds = receivers.any
      ? ((await admin.from("users").select("id").neq("id", auth.user.id)).data || []).map((u: any) => u.id as string)
      : receivers.ids

    if (receiverIds.length === 0) {
      return NextResponse.json({ ok: true, notified: 0 })
    }

    const content = `⚠️ ${surveyorName} cerró su sesión con la jornada activa.`

    const rows = receiverIds.map((receiverId) => ({
      sender_id: auth.user.id,
      receiver_id: receiverId,
      content,
      message_type: "direct" as const,
      read: false,
    }))

    const { error } = await admin.from("messages").insert(rows)

    if (error) {
      // No bloquear el logout del encuestador por esto — solo lo dejamos
      // registrado en el log del servidor.
      console.error("[self-logout-alert] insert error:", error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, notified: rows.length })
  } catch (err: any) {
    console.error("[self-logout-alert] error:", err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
