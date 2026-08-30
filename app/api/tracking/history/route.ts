import { NextResponse } from "next/server"
import { requireRole } from "@/lib/api-auth"
import { createAdminSupabase } from "@/lib/supabase-server"

// GET /api/tracking/history?surveyor_id=<uuid>&date=YYYY-MM-DD
//
// Reunión 2026-08-27 ("Geolocalización de los encuestadores"): "¿Qué ruta
// hizo el encuestador? ¿Cómo podemos verla?" — antes solo se guardaba/mostraba
// la ÚLTIMA ubicación de cada encuestador (surveyor_tracking_view, usada por
// /api/tracking). El recorrido completo ya se estaba grabando en
// surveyor_locations (un registro por cada actualización de posición, ver
// sql/tracking_tables.sql) pero no había ningún endpoint que lo expusiera.
// Este endpoint devuelve esos puntos ordenados cronológicamente para dibujar
// el trazo del día en el mapa (ver components/tracking-map.tsx).
//
// `date` es opcional (default: hoy, hora del servidor) — se acepta para
// poder revisar el recorrido de un día anterior si hace falta más adelante,
// aunque la UI actual solo pide "hoy".
export async function GET(request: Request) {
  const auth = await requireRole(["admin", "supervisor", "coordinator"])
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const surveyorId = searchParams.get("surveyor_id")
  if (!surveyorId) {
    return NextResponse.json({ error: "surveyor_id es requerido" }, { status: 400 })
  }

  const supabase = createAdminSupabase()

  // Mismo alcance por equipo que /api/tracking — un supervisor/coordinador
  // no puede pedir el recorrido de un encuestador ajeno a su equipo.
  if (auth.user.role === "supervisor") {
    const { data: mine } = await supabase.from("surveyors").select("id").eq("id", surveyorId).eq("supervisor_id", auth.user.id).maybeSingle()
    if (!mine) return NextResponse.json({ error: "No tienes permiso para ver este encuestador" }, { status: 403 })
  } else if (auth.user.role === "coordinator") {
    const { data: mySupervisors } = await supabase.from("users").select("id").eq("role", "supervisor").eq("coordinator_id", auth.user.id)
    const supIds = ((mySupervisors as any[]) || []).map((s: any) => s.id)
    const { data: mine } = supIds.length > 0
      ? await supabase.from("surveyors").select("id").eq("id", surveyorId).in("supervisor_id", supIds).maybeSingle()
      : { data: null }
    if (!mine) return NextResponse.json({ error: "No tienes permiso para ver este encuestador" }, { status: 403 })
  }

  const dateParam = searchParams.get("date")
  const dayStart = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date()
  if (!dateParam) dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  try {
    const { data, error } = await supabase
      .from("surveyor_locations")
      .select("latitude, longitude, accuracy, recorded_at")
      .eq("surveyor_id", surveyorId)
      .gte("recorded_at", dayStart.toISOString())
      .lt("recorded_at", dayEnd.toISOString())
      .order("recorded_at", { ascending: true })

    if (error) {
      // 42P01 = la tabla no existe todavía en este ambiente (no todos los
      // proyectos corrieron sql/tracking_tables.sql) — mismo criterio que
      // /api/messages: no romper la pantalla, solo devolver "sin recorrido".
      if (error.code === "42P01") {
        return NextResponse.json({ points: [] })
      }
      console.error("Error fetching tracking history:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const points = ((data as any[]) || [])
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p) => ({
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        accuracy: p.accuracy != null ? Number(p.accuracy) : null,
        recorded_at: p.recorded_at,
      }))

    return NextResponse.json({ points })
  } catch (err: any) {
    console.error("Unexpected error in GET /api/tracking/history:", err.message)
    return NextResponse.json({ error: err.message || "Unexpected error" }, { status: 500 })
  }
}
