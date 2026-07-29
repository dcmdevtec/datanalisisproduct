import { NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { resolveCurrentSurveyor } from "@/lib/portal-encuestador/auth"
import { resolveAuthedUser, resolveAllowedMessageReceivers } from "@/lib/api-auth"

// Contactos habilitados para mensajería del encuestador (módulo de mensajes,
// pptx / CLAUDE.md: "necesito que el modulo de mensaje funcione ... en el
// modulo de encuestador"). A diferencia de /api/messages (usado por el panel
// admin), aquí NO devolvemos /api/users completo — un encuestador no debe
// poder ver ni escribirle a cualquier usuario del sistema, solo a:
//   1. Su supervisor asignado (surveyors.supervisor_id), si tiene uno.
//   2. Todos los usuarios con role='admin' (soporte/administración).
// La lista de IDs permitidos sale de resolveAllowedMessageReceivers()
// (lib/api-auth.ts) — la misma función que /api/messages usa para validar
// destinatarios, para que ambas rutas nunca queden desincronizadas.
export async function GET() {
  try {
    const surveyor = await resolveCurrentSurveyor()
    if (!surveyor) {
      return NextResponse.json({ error: "No autorizado o encuestador no vinculado" }, { status: 401 })
    }
    const authedUser = await resolveAuthedUser()
    if (!authedUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const admin = createAdminSupabase()
    const allowed = await resolveAllowedMessageReceivers(authedUser)
    const allowedIds = allowed.any ? [] : allowed.ids
    if (allowedIds.length === 0) {
      return NextResponse.json({ contacts: [] })
    }

    const { data: rows } = await admin
      .from("users")
      .select("id, name, email, role")
      .in("id", allowedIds)
      .order("name")

    const contacts = (rows || []).map((u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role }))
    return NextResponse.json({ contacts })
  } catch (error) {
    console.error("Error en portal-encuestador/contacts API:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
