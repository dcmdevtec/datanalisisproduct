import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server"

// Resuelve el registro de `surveyors` vinculado al usuario autenticado actual.
// Devuelve null si el usuario no está logueado o no tiene un encuestador
// vinculado (ver sql/2026_07_surveyor_portal.sql — surveyors.user_id).
export async function resolveCurrentSurveyor(): Promise<
  | { userId: string; surveyorId: string; name: string; email: string }
  | null
> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminSupabase()
  const { data: surveyor } = await admin
    .from("surveyors")
    .select("id, name, email")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (!surveyor) return null

  return {
    userId: user.id,
    surveyorId: (surveyor as any).id,
    name: (surveyor as any).name,
    email: (surveyor as any).email,
  }
}
