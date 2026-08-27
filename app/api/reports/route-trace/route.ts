import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { requireRole } from "@/lib/api-auth"

// Ruta GPS aproximada de UN punto del mapa de Reportes (Geográfico): dado un
// encuestador y la ventana [started_at, completed_at] de esa respuesta,
// devuelve los pings de surveyor_locations en ese rango, ordenados por
// tiempo, para dibujar un polyline. No hay FK directa responses↔surveyor_
// locations (no existe response_id en esa tabla) — es una aproximación por
// surveyor_id + tiempo, tan precisa como la frecuencia con la que la APK
// reporta ubicación.
export async function GET(request: NextRequest) {
  const auth = await requireRole(["admin", "supervisor"])
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const surveyorId = searchParams.get("surveyorId")
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  if (!surveyorId || !from || !to) {
    return NextResponse.json({ error: "surveyorId, from y to son requeridos" }, { status: 400 })
  }

  const admin = createAdminSupabase()

  // Margen de 10 min a cada lado: la respuesta pudo terminar unos minutos
  // después del último ping reportado, o empezar antes del primero.
  const fromDate = new Date(new Date(from).getTime() - 10 * 60000)
  const toDate = new Date(new Date(to).getTime() + 10 * 60000)

  const { data, error } = await admin
    .from("surveyor_locations")
    .select("latitude, longitude, recorded_at")
    .eq("surveyor_id", surveyorId)
    .gte("recorded_at", fromDate.toISOString())
    .lte("recorded_at", toDate.toISOString())
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("recorded_at", { ascending: true })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const points = (data || []).map((p: any) => ({
    lat: Number(p.latitude),
    lng: Number(p.longitude),
    recordedAt: p.recorded_at,
  }))

  return NextResponse.json({ points })
}
