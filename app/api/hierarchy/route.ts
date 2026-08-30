import { NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { requireRole } from "@/lib/api-auth"

// GET /api/hierarchy — coordinadores, supervisores (con su coordinador) y
// encuestadores (con su supervisor), para armar la asignación en cascada
// Coordinador -> Supervisor -> Encuestadores al crear/editar una encuesta
// (reunión 2026-08-27, "Asignación"). Usa el cliente admin porque el
// picker de asignación necesita ver TODA la jerarquía para poder armar
// equipos por encuesta, no solo la del propio usuario autenticado.
export async function GET() {
  const auth = await requireRole(["admin"])
  if (!auth.ok) return auth.response

  const admin = createAdminSupabase()

  const [{ data: coordinators }, { data: supervisors }, { data: surveyors }] = await Promise.all([
    admin.from("users").select("id, name").eq("role", "coordinator").order("name"),
    admin.from("users").select("id, name, coordinator_id").eq("role", "supervisor").order("name"),
    admin.from("surveyors").select("id, name, email, supervisor_id").eq("status", "active").order("name"),
  ])

  return NextResponse.json({
    coordinators: (coordinators || []).map((c: any) => ({ id: c.id, name: c.name })),
    supervisors: (supervisors || []).map((s: any) => ({ id: s.id, name: s.name, coordinatorId: s.coordinator_id })),
    surveyors: (surveyors || []).map((s: any) => ({ id: s.id, name: s.name, email: s.email, supervisorId: s.supervisor_id })),
  })
}
