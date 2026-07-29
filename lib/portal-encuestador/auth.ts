import { createServerSupabase, createAdminSupabase } from "@/lib/supabase-server"

// Resuelve el registro de `surveyors` vinculado al usuario autenticado actual.
// Devuelve null si el usuario no está logueado o no tiene un encuestador
// vinculado (ver sql/2026_07_surveyor_portal.sql — surveyors.user_id).
//
// `requireActive` (default true): si es true, solo resuelve encuestadores
// con status = 'active' — correcto para la mayoría de rutas (un encuestador
// desactivado no debería poder ver encuestas, mensajes, etc.).
//
// POST /api/location es la ÚNICA excepción conocida: ese endpoint necesita
// identificar al encuestador AUNQUE su status no sea 'active', porque tiene
// su propia lógica para reactivarlo automáticamente al recibir una
// ubicación ("nunca bloquear la actualización de ubicación"). Con
// requireActive=true (el default), esta función devolvía null para esos
// casos, el endpoint respondía 401 antes de llegar a esa lógica de
// reactivación, y el encuestador quedaba bloqueado para siempre — la app
// nunca podía volver a reportar ubicación ni auto-reactivarse. Bug
// encontrado 2026-07-29 al investigar el mensaje "No se pudo reportar tu
// ubicación al servidor" en el portal web.
export async function resolveCurrentSurveyor(
  { requireActive = true }: { requireActive?: boolean } = {}
): Promise<
  | { userId: string; surveyorId: string; name: string; email: string; status: string }
  | null
> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminSupabase()
  let query = admin
    .from("surveyors")
    .select("id, name, email, status")
    .eq("user_id", user.id)
  if (requireActive) query = query.eq("status", "active")
  let { data: surveyor } = await query.maybeSingle()

  // Fallback para encuestadores creados por POST /api/surveyors ANTES de la
  // corrección que empezó a setear user_id: ese flujo históricamente hacía
  // `surveyors.id = <auth user id>` pero nunca tocaba `user_id`, que quedaba
  // NULL. Sin este fallback, ningún encuestador dado de alta por la UI
  // "Añadir Encuestador" antes de esta fecha podría entrar al portal aunque
  // su rol ya estuviera corregido. Ver sql/2026_07_surveyor_portal_backfill.sql
  // para el backfill que setea user_id definitivamente.
  if (!surveyor) {
    let legacyQuery = admin
      .from("surveyors")
      .select("id, name, email, status")
      .eq("id", user.id)
    if (requireActive) legacyQuery = legacyQuery.eq("status", "active")
    const { data: legacySurveyor } = await legacyQuery.maybeSingle()
    surveyor = legacySurveyor
  }

  if (!surveyor) return null

  return {
    userId: user.id,
    surveyorId: (surveyor as any).id,
    name: (surveyor as any).name,
    email: (surveyor as any).email,
    status: (surveyor as any).status,
  }
}
