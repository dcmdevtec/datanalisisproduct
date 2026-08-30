import { NextResponse } from "next/server"
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server"
import type { Database } from "@/types/supabase"
import { requireRole } from "@/lib/api-auth"

// Separate interface for PUT request body — includes `password` which goes to
// auth.users (via admin.updateUserById), NOT to public.surveyors table.
interface SurveyorUpdateRequest {
  name?: string
  email?: string
  phone_number?: string | null
  password?: string
  status?: "active" | "inactive"
  supervisor_id?: string | null
}

// SEGURIDAD (auditoría 2026-07-29): PUT puede resetear la contraseña de
// cualquier encuestador — no tenía ningún check de sesión/rol. Mismo
// criterio que /api/surveyors: lectura admin+supervisor, mutaciones solo admin.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["admin", "supervisor"])
  if (!auth.ok) return auth.response

  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: surveyor, error } = await supabase.from("surveyors").select("*").eq("id", id).single()

  if (error) {
    console.error("Error fetching surveyor:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!surveyor) {
    return NextResponse.json({ error: "Surveyor not found" }, { status: 404 })
  }

  return NextResponse.json(surveyor)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["admin"])
  if (!auth.ok) return auth.response

  const { id } = await params
  const { name, email, phone_number, password, status, supervisor_id } = (await request.json()) as SurveyorUpdateRequest
  const adminSupabase = createAdminSupabase()

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 })
  }

  // Update user in Supabase Auth using the admin client
  const authUpdatePayload: { email?: string; password?: string; user_metadata?: any } = {
    email,
    user_metadata: { name, phone_number, role: "surveyor" },
  }
  if (password) {
    authUpdatePayload.password = password
  }

  const { data: authData, error: authError } = await adminSupabase.auth.admin.updateUserById(id, authUpdatePayload)

  if (authError) {
    console.error("Error updating Supabase Auth user:", authError)
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Update surveyor in public.surveyors table using the admin client to bypass RLS
  const { data: surveyor, error: dbError } = await adminSupabase
    .from("surveyors")
    .update({ name, email, phone_number, status, supervisor_id: supervisor_id ?? null })
    .eq("id", id)
    .select()
    .single()

  if (dbError) {
    console.error("Error updating surveyor in DB:", dbError)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json(surveyor)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["admin"])
  if (!auth.ok) return auth.response

  const { id } = await params
  const adminSupabase = createAdminSupabase()

  // Delete user from Supabase Auth using the admin client
  const { error: authError } = await adminSupabase.auth.admin.deleteUser(id)

  if (authError) {
    console.error("Error deleting Supabase Auth user:", authError)
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  // Delete surveyor from public.surveyors table using the admin client to bypass RLS
  const { error: dbError } = await adminSupabase.from("surveyors").delete().eq("id", id)

  if (dbError) {
    console.error("Error deleting surveyor from DB:", dbError)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ message: "Surveyor deleted successfully" }, { status: 200 })
}
