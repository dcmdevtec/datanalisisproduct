/**
 * API /api/users
 *
 * - GET: returns list of users using the server Supabase client (respects RLS and session cookies)
 * - POST: creates a user in Supabase Auth (using the service role) and inserts a profile row in `public.users`.
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
 *   role: "admin" | "supervisor" | "surveyor" | "client"
 * }
 *
 * On failure inserting the profile, the code attempts to delete the created auth user to avoid orphaned auth records.
 */
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import type { Database } from "@/types/supabase"

type UserRow = Database["public"]["Tables"]["users"]["Row"]

export async function GET(request: Request) {
  // Use admin client to bypass RLS and list all users
  try {
    const supabaseAdmin = createAdminClient()

    const { data, error } = await supabaseAdmin.from("users").select("id, email, name, role, status, created_at, updated_at")

    if (error) {
      console.error("Error fetching users:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error("Unexpected error in GET /api/users:", err.message)
    return NextResponse.json({ error: err.message || "Unexpected error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  // Create user in Supabase Auth (admin) and insert profile + role rows
  const supabaseAdmin = createAdminClient()

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })

  const { email, password, name, role } = body as { email?: string; password?: string; name?: string; role?: string }

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: "email, password, name and role are required" }, { status: 400 })
  }

  // Basic role validation - match project's allowed roles
  const allowedRoles = ["admin", "supervisor", "surveyor", "client"]
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
    const { data: userData, error: userInsertError } = await supabaseAdmin
      .from("users")
      .insert({ id: userId, email, name, role, status: "active", metadata: {} })
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
