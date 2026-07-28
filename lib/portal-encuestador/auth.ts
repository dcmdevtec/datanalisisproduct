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
  let { data: surveyor } = await admin
    .from("surveyors")
    .select("id, name, email")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  // Fallback para encuestadores creados por POST /api/surveyors ANTES de la
  // corrección que empezó a setear user_id: ese flujo históricamente hacía
  // `surveyors.id = <auth user id>` pero nunca tocaba `user_id`, que quedaba
  // NULL. Sin este fallback, ningún encuestador dado de alta por la UI
  // "Añadir Encuestador" antes de esta fecha podría entrar al portal aunque
  // su rol ya estuviera corregido. Ver sql/2026_07_surveyor_portal_backfill.sql
  // para el backfill que setea user_id definitivamente.
  if (!surveyor) {
    const { data: legacySurveyor } = await admin
      .from("surveyors")
      .select("id, name, email")
      .eq("id", user.id)
      .eq("status", "active")
      .maybeSingle()
    surveyor = legacySurveyor
  }

  if (!surveyor) return null

  return {
    userId: user.id,
    surveyorId: (surveyor as any).id,
    name: (surveyor as any).name,
    email: (surveyor as any).email,
  }
}
