/**
 * API /api/users
 *
 * - GET: returns list of users using the server Supabase client (respects RLS and session cookies)
 * - POST: creates a user in Supabase Auth (using the service role) and inserts a profile row in `public.users`.
 * - PATCH ?id=<uuid>: updates name/role/status/coordinatorId of an existing profile row.
 *
 * Requirements:
 * - Environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (for server client), SUPABASE_SERVICE_ROLE_KEY (for admin actions)
 * - The endpoint uses the admin client to call `auth.admin.createUser` so it must be protected in production (only admins should call it).
 *
 * Expected POST payload:
 * {
 *   email: string,
 *   password: string,
 *   name: string,
 *   role: "admin" | "supervisor" | "coordinator" | "surveyor" | "client",
 *   coordinatorId?: string | null // solo aplica si role === "supervisor"
 * }
 *
 * On failure inserting the profile, the code attempts to delete the created auth user to avoid orphaned auth records.
 */
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import type { Database } from "@/types/supabase"
import { requireRole } from "@/lib/api-auth"

type UserRow = Database["public"]["Tables"]["users"]["Row"]

// SEGURIDAD (auditoría 2026-07-29): esta ruta usa el cliente de service-role,
// que ignora RLS por completo — antes no tenía NINGÚN check de sesión/rol,
// así que cualquiera con la URL podía listar todos los usuarios (GET) o
// crear una cuenta admin nueva (POST). Solo admins pueden usarla ahora.
export async function GET(request: Request) {
  // admin + supervisor: /messages (usada por ambos roles) necesita el listado
  // de usuarios para armar la lista de conversaciones. Crear cuentas (POST)
  // sigue restringido solo a admin más abajo.
  const auth = await requireRole(["admin", "supervisor"])
  if (!auth.ok) return auth.response

  // Use admin client to bypass RLS and list all users
  try {
    const supabaseAdmin = createAdminClient()

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, email, name, role, status, coordinator_id, created_at, updated_at")

    if (error) {
      console.error("Error fetching users:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // coordinator_id no trae el nombre del coordinador — se arma el mapa
    // id -> name desde el mismo resultado (los coordinadores también son
    // filas de esta tabla) en vez de hacer una query aparte o depender de
    // una relación FK registrada en PostgREST (que esta tabla no tiene).
    const coordinatorNameById = new Map(
      (data || []).filter((u: any) => u.role === "coordinator").map((u: any) => [u.id, u.name]),
    )
    const withCoordinatorName = (data || []).map((u: any) => ({
      ...u,
      coordinatorName: u.coordinator_id ? coordinatorNameById.get(u.coordinator_id) ?? null : null,
    }))

    return NextResponse.json(withCoordinatorName)
  } catch (err: any) {
    console.error("Unexpected error in GET /api/users:", err.message)
    return NextResponse.json({ error: err.message || "Unexpected error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireRole(["admin"])
  if (!auth.ok) return auth.response

  // Create user in Supabase Auth (admin) and insert profile + role rows
  const supabaseAdmin = createAdminClient()

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })

  const { email, password, name, role, coordinatorId } = body as { email?: string; password?: string; name?: string; role?: string; coordinatorId?: string | null }

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: "email, password, name and role are required" }, { status: 400 })
  }

  // Basic role validation - match project's allowed roles
  // "coordinator" agregado reunión 2026-08-27 ("Jerarquías y roles") — ya no
  // se crean usuarios "client" desde este modal, coordinator lo reemplaza
  // en el flujo de asignación de encuestas (Coordinador -> Supervisor ->
  // Encuestadores). Se deja "client" en la lista por compatibilidad con
  // cuentas ya existentes, simplemente no se ofrece en la UI de creación.
  const allowedRoles = ["admin", "supervisor", "coordinator", "surveyor", "client"]
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: `role must be one of: ${allowedRoles.join(", ")}` }, { status: 400 })
  }

  try {
    // 1) Create user in Supabase Auth using admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      console.error("Supabase Auth Error:", authError.message)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user?.id
    if (!userId) {
      throw new Error("Failed to obtain created user id from Supabase Auth")
    }

    // 2) Insert into public.users (profile table)
    // coordinatorId (reunión 2026-08-27): solo tiene sentido para role='supervisor'
    // — vincula al supervisor con su coordinador GLOBAL por defecto (ver
    // users.coordinator_id en sql/2026_07_reports_outcome_and_hierarchy.sql).
    // Este es el organigrama por defecto; la asignación por encuesta puntual
    // puede seguir siendo distinta (survey_surveyor_zones.coordinator_id).
    const { data: userData, error: userInsertError } = await supabaseAdmin
      .from("users")
      .insert({
        id: userId,
        email,
        name,
        role,
        status: "active",
        metadata: {},
        ...(role === "supervisor" && coordinatorId ? { coordinator_id: coordinatorId } : {}),
      })
      .select()
      .single()

    if (userInsertError) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => { })
      console.error("DB error inserting into users:", userInsertError.message)
      return NextResponse.json({ error: userInsertError.message }, { status: 500 })
    }

    // 3) Insert into user_roles table for compatibility (if exists)
    // Some parts of the system use the 'role' column on users; schema also has user_roles as mapping
    const { error: roleInsertError } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role })
    if (roleInsertError) {
      // Not critical, but log and continue. If required, you could rollback above.
      console.warn("Warning inserting into user_roles:", roleInsertError.message)
    }

    // Return created profile
    return NextResponse.json(userData, { status: 201 })
  } catch (err: any) {
    console.error("Unexpected error in POST /api/users:", err.message)
    return NextResponse.json({ error: err.message || "Unexpected error" }, { status: 500 })
  }
}

// PATCH /api/users?id=<uuid>
//
// Antes no existía ninguna forma de editar un usuario ya creado: el botón
// "Activar/Desactivar" del módulo de Usuarios solo mostraba un toast y no
// llamaba a ningún API (no persistía), y el coordinador de un supervisor
// solo se podía fijar al momento de crearlo — si se necesitaba corregirlo
// después, no había cómo. Mismo criterio de autorización que POST: solo
// admin, porque cambia rol/estado/jerarquía de otras cuentas.
export async function PATCH(request: Request) {
  const auth = await requireRole(["admin"])
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id es requerido" }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })

  const { name, role, status, coordinatorId } = body as {
    name?: string
    role?: string
    status?: string
    coordinatorId?: string | null
  }

  const allowedRoles = ["admin", "supervisor", "coordinator", "surveyor", "client"]
  if (role !== undefined && !allowedRoles.includes(role)) {
    return NextResponse.json({ error: `role must be one of: ${allowedRoles.join(", ")}` }, { status: 400 })
  }
  const allowedStatuses = ["active", "inactive"]
  if (status !== undefined && !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${allowedStatuses.join(", ")}` }, { status: 400 })
  }

  const update: Record<string, any> = {}
  if (name !== undefined) update.name = name
  if (status !== undefined) update.status = status
  if (role !== undefined) {
    update.role = role
    // coordinator_id solo tiene sentido para role="supervisor" — si el rol
    // cambia a otra cosa se limpia, para no dejar un valor huérfano/inválido.
    update.coordinator_id = role === "supervisor" ? coordinatorId ?? null : null
  } else if (coordinatorId !== undefined) {
    update.coordinator_id = coordinatorId
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No hay cambios para aplicar" }, { status: 400 })
  }

  try {
    const supabaseAdmin = createAdminClient()
    const { data, error } = await supabaseAdmin.from("users").update(update).eq("id", id).select().single()

    if (error) {
      console.error("Error updating user:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error("Unexpected error in PATCH /api/users:", err.message)
    return NextResponse.json({ error: err.message || "Unexpected error" }, { status: 500 })
  }
}
