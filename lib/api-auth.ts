import { NextResponse } from "next/server"
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server"

// Helper de autenticación/autorización compartido para rutas de app/api/**.
//
// Contexto (auditoría de producción, 2026-07-29): la mayoría de las rutas
// admin usaban el cliente de service-role (que ignora RLS por completo) SIN
// verificar sesión ni rol primero — es decir, cualquiera con la URL tenía
// acceso administrativo total. RLS en Supabase está habilitado solo en un
// puñado de tablas, así que el check aquí (a nivel de ruta) es la única
// barrera real para el resto — no asumir que RLS cubre lo que este helper
// no cubra.
//
// Uso típico dentro de un route handler:
//
//   const auth = await requireRole(["admin"])
//   if (!auth.ok) return auth.response
//   // auth.user.id / auth.user.role disponibles de aquí en adelante

export type AuthedUser = { id: string; email: string | null; role: string }

// Resuelve el usuario autenticado (sesión real, vía cookies) + su perfil de
// public.users. Devuelve null si no hay sesión o el perfil no existe.
export async function resolveAuthedUser(): Promise<AuthedUser | null> {
  const supabase = await createServerSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const admin = createAdminSupabase()
  const { data: profile } = await admin
    .from("users")
    .select("id, email, role")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile) return null
  return { id: (profile as any).id, email: (profile as any).email ?? null, role: (profile as any).role }
}

type RequireRoleResult =
  | { ok: true; user: AuthedUser }
  | { ok: false; response: NextResponse }

// Exige que exista sesión Y que el rol del usuario esté en `allowedRoles`.
// Si `allowedRoles` se omite, solo exige sesión (cualquier rol autenticado).
export async function requireRole(allowedRoles?: string[]): Promise<RequireRoleResult> {
  const user = await resolveAuthedUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) }
  }
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return { ok: false, response: NextResponse.json({ error: "No tienes permiso para realizar esta acción" }, { status: 403 }) }
  }
  return { ok: true, user }
}

// A quién puede escribirle/leer un usuario en el módulo de mensajes
// (usado por /api/messages y /api/portal-encuestador/contacts, para que
// ambos compartan exactamente la misma regla y no se desincronicen).
// - admin: puede mensajear a cualquier usuario (incl. broadcast).
// - supervisor: solo a los encuestadores de SU equipo + usuarios admin
//   (reunión 2026-08-27: "si una persona no hace parte de su equipo de
//   trabajo, no debe tener acceso a... su chat" — antes un supervisor podía
//   mensajear a CUALQUIERA, incluidos encuestadores de otros supervisores).
// - coordinator: a los supervisores a su cargo + los encuestadores de esos
//   supervisores + usuarios admin.
// - surveyor: solo a su supervisor asignado (si tiene) + usuarios admin.
// - cualquier otro rol: sin contactos (por defecto, restrictivo).
export async function resolveAllowedMessageReceivers(user: AuthedUser): Promise<{ any: true } | { any: false; ids: string[] }> {
  if (user.role === "admin") return { any: true }

  const admin = createAdminSupabase()

  if (user.role === "supervisor") {
    const { data: adminUsers } = await admin.from("users").select("id").eq("role", "admin")
    const { data: mySurveyors } = await admin.from("surveyors").select("user_id, id").eq("supervisor_id", user.id)
    const ids = new Set<string>((adminUsers || []).map((u: any) => u.id as string))
    for (const s of (mySurveyors as any[]) || []) {
      ids.add(s.user_id ?? s.id) // user_id si el encuestador tiene cuenta propia; si no, fallback legacy id===user_id
    }
    return { any: false, ids: [...ids] }
  }

  if (user.role === "coordinator") {
    const { data: adminUsers } = await admin.from("users").select("id").eq("role", "admin")
    const { data: mySupervisors } = await admin.from("users").select("id").eq("role", "supervisor").eq("coordinator_id", user.id)
    const supIds = (mySupervisors || []).map((u: any) => u.id as string)
    const ids = new Set<string>([...(adminUsers || []).map((u: any) => u.id as string), ...supIds])
    if (supIds.length > 0) {
      const { data: theirSurveyors } = await admin.from("surveyors").select("user_id, id").in("supervisor_id", supIds)
      for (const s of (theirSurveyors as any[]) || []) {
        ids.add(s.user_id ?? s.id)
      }
    }
    return { any: false, ids: [...ids] }
  }

  if (user.role === "surveyor") {
    const admin = createAdminSupabase()
    // Mismo criterio de resolución que resolveCurrentSurveyor() (incluye el
    // fallback legacy id===user_id) — se reimplementa la consulta aquí en
    // vez de importar lib/portal-encuestador/auth.ts para evitar una
    // dependencia circular entre módulos de auth; mantener ambas en sync
    // si ese archivo cambia.
    let { data: surveyorRow } = await admin.from("surveyors").select("supervisor_id").eq("user_id", user.id).eq("status", "active").maybeSingle()
    if (!surveyorRow) {
      const legacy = await admin.from("surveyors").select("supervisor_id").eq("id", user.id).eq("status", "active").maybeSingle()
      surveyorRow = legacy.data
    }
    const supervisorId = (surveyorRow as any)?.supervisor_id ?? null

    const { data: admins } = await admin.from("users").select("id").eq("role", "admin")
    const ids = (admins || []).map((u: any) => u.id as string)
    if (supervisorId && !ids.includes(supervisorId)) ids.push(supervisorId)
    return { any: false, ids }
  }

  return { any: false, ids: [] }
}
