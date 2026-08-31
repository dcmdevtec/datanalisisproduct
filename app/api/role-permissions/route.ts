/**
 * API /api/role-permissions
 *
 * - GET: devuelve el override de permisos guardado para cada rol editable
 *   (admin, coordinator, supervisor), leyendo public.role_permissions
 *   (ver sql/2026_08_31_role_permissions.sql). Rol sin fila = {} (usa
 *   ROLE_DEFAULTS de lib/permissions.ts sin cambios).
 * - PATCH ?role=<rol>: reemplaza el grid de permisos guardado para ESE rol
 *   (upsert). Afecta a TODOS los usuarios que tengan ese rol.
 *
 * Solo admin: esto cambia lo que puede hacer un rol completo, mismo
 * criterio que /api/users (crear/editar cuentas).
 */
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/api-auth"

// Roles editables desde la pestaña "Roles y permisos" — "admin" queda
// afuera a propósito: bajarle permisos al rol admin completo (incluido
// quien está editando) es un riesgo de auto-bloqueo sin forma fácil de
// revertirlo desde la propia UI. surveyor/client no usan este panel (ver
// comentario en lib/permissions.ts ROLE_DEFAULTS).
const EDITABLE_ROLES = ["coordinator", "supervisor"]

export async function GET() {
  const auth = await requireRole(["admin"])
  if (!auth.ok) return auth.response

  try {
    const supabaseAdmin = createAdminClient()
    const { data, error } = await supabaseAdmin
      .from("role_permissions")
      .select("role, permissions, updated_at")
      .in("role", EDITABLE_ROLES)

    if (error) {
      // Tabla nueva (sql/2026_08_31_role_permissions.sql) — si todavía no
      // se corrió en este ambiente, se responde "sin overrides" en vez de
      // romper la pestaña entera.
      if (/relation .*role_permissions.* does not exist/i.test(error.message)) {
        return NextResponse.json({ roles: EDITABLE_ROLES, byRole: {} })
      }
      console.error("Error fetching role_permissions:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const byRole: Record<string, any> = {}
    for (const row of data || []) {
      byRole[(row as any).role] = (row as any).permissions ?? {}
    }

    return NextResponse.json({ roles: EDITABLE_ROLES, byRole })
  } catch (err: any) {
    console.error("Unexpected error in GET /api/role-permissions:", err.message)
    return NextResponse.json({ error: err.message || "Unexpected error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const auth = await requireRole(["admin"])
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const role = searchParams.get("role")
  if (!role || !EDITABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: `role debe ser uno de: ${EDITABLE_ROLES.join(", ")}` }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })

  const { permissions } = body as { permissions?: Record<string, Record<string, boolean>> | null }

  try {
    const supabaseAdmin = createAdminClient()
    const { data, error } = await supabaseAdmin
      .from("role_permissions")
      .upsert(
        { role, permissions: permissions ?? {}, updated_at: new Date().toISOString(), updated_by: auth.user.id },
        { onConflict: "role" },
      )
      .select()
      .single()

    if (error) {
      if (/relation .*role_permissions.* does not exist/i.test(error.message)) {
        return NextResponse.json(
          { error: "La base de datos todavía no tiene la tabla de permisos por rol (falta correr sql/2026_08_31_role_permissions.sql)." },
          { status: 409 },
        )
      }
      console.error("Error upserting role_permissions:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error("Unexpected error in PATCH /api/role-permissions:", err.message)
    return NextResponse.json({ error: err.message || "Unexpected error" }, { status: 500 })
  }
}
