import { NextResponse } from "next/server"
import { requireRole, type AuthedUser } from "@/lib/api-auth"
import { createAdminSupabase } from "@/lib/supabase-server"
import { resolveOutcome } from "@/lib/report-outcome"

// Resuelve a qué surveyor_id tiene acceso este usuario (reunión 2026-08-27,
// "Jerarquías y roles"). null = admin, sin restricción. [] = supervisor o
// coordinador sin equipo asignado (no debe ver a nadie).
//
// CORRECCIÓN: este cálculo vivía solo dentro de GET — pero la pantalla de
// Geolocalización (app/surveyors/page.tsx) llama a POST /api/tracking, que
// hasta ahora NO aplicaba ningún filtro de equipo (solo exigía rol
// admin/supervisor). En la práctica, cualquier supervisor podía ver la
// ubicación en tiempo real, batería y contacto de TODOS los encuestadores,
// no solo los suyos — exactamente el hueco que la reunión pidió cerrar.
// Se extrae a un helper para que GET y POST apliquen la misma regla.
async function resolveTeamSurveyorIds(
  user: AuthedUser,
  supabase: ReturnType<typeof createAdminSupabase>,
): Promise<string[] | null> {
  if (user.role === "supervisor") {
    const { data: mySurveyors } = await supabase.from("surveyors").select("id").eq("supervisor_id", user.id)
    return ((mySurveyors as any[]) || []).map((s) => s.id)
  }
  if (user.role === "coordinator") {
    const { data: mySupervisors } = await supabase.from("users").select("id").eq("role", "supervisor").eq("coordinator_id", user.id)
    const supIds = ((mySupervisors as any[]) || []).map((s: any) => s.id)
    if (supIds.length === 0) return []
    const { data: mySurveyors } = await supabase.from("surveyors").select("id").in("supervisor_id", supIds)
    return ((mySurveyors as any[]) || []).map((s) => s.id)
  }
  return null // admin
}

/**
 * Calcula el estado del encuestador basado en minutos transcurridos
 * desde su última ubicación registrada.
 *
 * Umbrales:
 *   ≤ 5 min  → "active"   (teléfono encendido y enviando)
 *   ≤ 30 min → "inactive" (última señal reciente pero ya no responde)
 *   > 30 min → "offline"  (sin señal, teléfono apagado o sin internet)
 *   sin ubicación → "offline"
 *
 * IMPORTANTE: no confiar en el campo `status` de la vista — puede estar
 * desactualizado. Siempre recalcular a partir de `minutes_since_update`
 * o de `recorded_at` si el campo de minutos no está disponible.
 */
function calcStatus(item: any, lastLogoutAt?: string | null): "active" | "inactive" | "offline" {
  // Fix 2026-07-29: si el encuestador cerró sesión explícitamente (botón de
  // salir en el portal web) DESPUÉS de su última ubicación registrada,
  // mostrarlo "offline" de inmediato en vez de esperar a que pase el
  // umbral de 5 min por inactividad. surveyors.last_logout_at se actualiza
  // en app/api/portal-encuestador/shifts/[id]/route.ts al cerrar el turno.
  // Si vuelve a iniciar sesión y llega una ubicación más nueva que
  // last_logout_at, este chequeo deja de aplicar solo (se compara contra
  // recorded_at cada vez).
  if (lastLogoutAt && (!item.recorded_at || new Date(lastLogoutAt).getTime() > new Date(item.recorded_at).getTime())) {
    return "offline"
  }

  // Calcular minutos desde la última ubicación recibida
  let minutesAgo: number | null = null

  if (typeof item.minutes_since_update === "number") {
    minutesAgo = item.minutes_since_update
  } else if (item.recorded_at) {
    minutesAgo = (Date.now() - new Date(item.recorded_at).getTime()) / 60000
  }

  if (minutesAgo === null || minutesAgo < 0) return "offline"
  if (minutesAgo <= 5)  return "active"    // ≤5 min: APK enviando activamente
  if (minutesAgo <= 30) return "inactive"  // 5–30 min: sin señal reciente
  return "offline"                         // >30 min: teléfono apagado / sin internet
}
// CORRECCIÓN (revisión previa a puesta en uso real): esta función estaba en
// 2/15 min, en desacuerdo con su propio comentario de arriba, con la vista
// v_surveyor_latest_location y con GET /api/location (ambas usan 5/30 min).
// tracking_config.update_interval_seconds tiene un default de 60s y puede
// llegar a 300s (5 min) — con un corte de "active" en 2 min, cualquier
// retraso normal de GPS/red/Doze de Android hace que el encuestador
// parpadee a "inactivo" entre un ping y el siguiente aunque la APK esté
// funcionando bien. Esto coincide exactamente con el síntoma reportado
// ("aparece activo una vez y después aparece inactivo"): es un umbral
// demasiado agresivo en este archivo, no necesariamente un problema de la APK.

/** El encuestador está dentro de la app (primer plano) si:
 *  - La última ubicación llegó hace ≤2 min Y
 *  - el APK envió is_foreground=true en esa última ubicación
 *  Si el APK no soporta is_foreground todavía, no se muestra el indicador.
 */
function isInApp(item: any): boolean | null {
  if (item.is_foreground === undefined || item.is_foreground === null) return null
  const minutesAgo = typeof item.minutes_since_update === "number"
    ? item.minutes_since_update
    : item.recorded_at
      ? (Date.now() - new Date(item.recorded_at).getTime()) / 60000
      : 999
  return minutesAgo <= 2 && item.is_foreground === true
}

/**
 * GET /api/tracking
 * Obtener ubicaciones de encuestadores usando surveyor_tracking_view
 * 
 * Query params:
 * - survey_id?: UUID - Filtrar por encuesta
 * - zone_id?: UUID - Filtrar por zona
 * - surveyor_ids?: string - Lista de IDs separados por coma
 * - status?: 'active' | 'idle' | 'offline' | 'never_seen' - Filtrar por estado
 */
export async function GET(request: Request) {
  console.log("🔵 GET /api/tracking - Getting surveyor locations from view")

  // SEGURIDAD (auditoría 2026-07-29): esta ruta devuelve ubicación GPS en
  // vivo, batería y contacto de TODOS los encuestadores. Antes no tenía
  // ningún check de sesión/rol — cualquiera con la URL podía verla.
  // Reunión 2026-08-27 ("Jerarquías y roles"): se agrega coordinator (antes
  // ni entraba) y se fuerza el alcance por equipo más abajo.
  const auth = await requireRole(["admin", "supervisor", "coordinator"])
  if (!auth.ok) return auth.response

  // Fix 2026-08-12: cookies() sin await (bug Next.js 15) → cliente anon sin
  // sesión → lecturas de vistas/tablas con RLS podían fallar. Admin client:
  // auth ya verificada por requireRole() arriba.
  const supabase = createAdminSupabase()

  try {
    const { searchParams } = new URL(request.url)
    const survey_id = searchParams.get("survey_id")
    const zone_id = searchParams.get("zone_id")
    const surveyor_ids = searchParams.get("surveyor_ids")
    const status_filter = searchParams.get("status")

    console.log("📊 Query params:", { survey_id, zone_id, status_filter })

    // SEGURIDAD (reunión 2026-08-27): esta ubicación en tiempo real, batería
    // y contacto de encuestadores debe estar limitada al equipo del
    // supervisor/coordinador autenticado — antes solo el ROL ("supervisor")
    // daba acceso a la vista completa, sin importar de quién era el equipo.
    // Se resuelve server-side el set de surveyor_id permitido y se
    // interseca con lo que haya pedido el cliente (si pidió algo fuera de
    // su equipo, simplemente no aparece).
    const teamSurveyorIds = await resolveTeamSurveyorIds(auth.user, supabase)

    // Usar la vista surveyor_tracking_view como recomienda el documento
    let query = supabase
      .from("surveyor_tracking_view")
      .select("*")
      .order("recorded_at", { ascending: false, nullsFirst: false })

    // Filtrar por estado si se especifica
    if (status_filter) {
      query = query.eq("status", status_filter)
    }

    // Filtrar por zona si se especifica
    if (zone_id) {
      query = query.eq("zone_id", zone_id)
    }

    // Filtrar por lista de IDs de encuestadores — intersección con el
    // equipo permitido cuando el usuario no es admin.
    if (teamSurveyorIds !== null) {
      const requestedIds = surveyor_ids ? surveyor_ids.split(",").map((id) => id.trim()) : null
      const allowedIds = requestedIds ? requestedIds.filter((id) => teamSurveyorIds!.includes(id)) : teamSurveyorIds
      query = query.in("surveyor_id", allowedIds.length > 0 ? allowedIds : ["__none__"])
    } else if (surveyor_ids) {
      const ids = surveyor_ids.split(",").map(id => id.trim())
      query = query.in("surveyor_id", ids)
    }

    // Si hay filtro por encuesta, obtener los encuestadores asignados
    if (survey_id) {
      const { data: surveyData, error: surveyError } = await (supabase as any)
        .from("surveys")
        .select("assigned_surveyors")
        .eq("id", survey_id)
        .single()

      if (!surveyError && surveyData?.assigned_surveyors) {
        const assignedIds = Array.isArray(surveyData.assigned_surveyors)
          ? surveyData.assigned_surveyors
          : [surveyData.assigned_surveyors]

        query = query.in("surveyor_id", assignedIds)
      }
    }

    const { data: trackingData, error: trackingError } = await query

    if (trackingError) {
      console.error("❌ Error fetching tracking data:", trackingError)
      return NextResponse.json({ error: "Failed to fetch tracking data" }, { status: 500 })
    }

    // Fix 2026-07-29: surveyor_tracking_view no expone last_logout_at (su
    // definición ya trae columnas fijas de antes de este fix, y no queríamos
    // arriesgar un CREATE OR REPLACE VIEW a ciegas sin ver su SQL completo).
    // En vez de eso, se consulta aparte contra `surveyors` y se cruza por
    // surveyor_id en memoria — ver calcStatus() más arriba.
    const surveyorIdsForLogout = Array.from(
      new Set((trackingData || []).map((item: any) => item.surveyor_id).filter(Boolean))
    )
    let lastLogoutMap: Record<string, string | null> = {}
    if (surveyorIdsForLogout.length > 0) {
      const { data: logoutRows } = await supabase
        .from("surveyors")
        .select("id, last_logout_at")
        .in("id", surveyorIdsForLogout)
      lastLogoutMap = Object.fromEntries(
        (logoutRows || []).map((r: any) => [r.id, r.last_logout_at])
      )
    }

    // Reunión 2026-08-27: "Cada punto de encuestador debe estar identificado
    // con Total de registros, Efectivas y Hora de inicio de la primera
    // encuesta del día". Se calcula sobre las respuestas de HOY (00:00 en
    // adelante, hora del servidor) resolviendo el encuestador con el mismo
    // criterio de 3 niveles que /api/reports/route.ts (assignment_id vía
    // survey_surveyor_zones → metadata.surveyor_id de la APK →
    // respondent_id de la web autenticada).
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const todayStatsBySurveyorId: Record<string, { total: number; efectivas: number; firstResponseAt: string | null }> = {}
    if (surveyorIdsForLogout.length > 0) {
      const { data: sszRows } = await supabase
        .from("survey_surveyor_zones")
        .select("id, surveyor_id")
        .in("surveyor_id", surveyorIdsForLogout)
      const assignmentToSurveyor: Record<string, string> = {}
      for (const r of (sszRows as any[]) || []) assignmentToSurveyor[r.id] = r.surveyor_id

      const { data: todayResponses } = await supabase
        .from("responses")
        .select("assignment_id, metadata, respondent_id, created_at, status, outcome")
        .gte("created_at", startOfDay.toISOString())

      for (const r of (todayResponses as any[]) || []) {
        const sid = (r.assignment_id ? assignmentToSurveyor[r.assignment_id] : undefined)
          ?? (!r.assignment_id ? r.metadata?.surveyor_id : undefined)
          ?? (r.respondent_id && surveyorIdsForLogout.includes(r.respondent_id) ? r.respondent_id : undefined)
        if (!sid || !surveyorIdsForLogout.includes(sid)) continue
        if (!todayStatsBySurveyorId[sid]) todayStatsBySurveyorId[sid] = { total: 0, efectivas: 0, firstResponseAt: null }
        const entry = todayStatsBySurveyorId[sid]
        entry.total++
        if (resolveOutcome(r) === "efectiva") entry.efectivas++
        if (!entry.firstResponseAt || r.created_at < entry.firstResponseAt) entry.firstResponseAt = r.created_at
      }
    }

    // Transformar los datos al formato esperado por el frontend
    const surveyorsWithLocation = trackingData?.map((item: any) => {
      // Estado calculado siempre desde tiempo real, nunca desde el campo status de la vista
      const status = calcStatus(item, lastLogoutMap[item.surveyor_id])
      const in_app = isInApp(item)
      const todayStats = todayStatsBySurveyorId[item.surveyor_id] ?? { total: 0, efectivas: 0, firstResponseAt: null }

      return {
        id: item.surveyor_id,
        name: item.surveyor_name || "Sin nombre",
        email: item.surveyor_email || "",
        phone_number: item.surveyor_phone || "",
        status,
        in_app,  // true=en la app, false=background, null=APK no reporta este campo aún
        today_total_registros: todayStats.total,
        today_efectivas: todayStats.efectivas,
        today_first_response_at: todayStats.firstResponseAt,
        current_location: item.latitude && item.longitude ? {
          latitude: item.latitude,
          longitude: item.longitude,
          accuracy: item.accuracy || null,
          battery_level: item.battery_level,
          is_charging: item.is_charging || false,
          is_in_zone: item.is_in_zone || false,
          zone: item.zone_id ? { id: item.zone_id, name: item.zone_name || "Sin nombre" } : null,
          active_survey: null,
          recorded_at: item.recorded_at,
          minutes_ago: Math.round(
            typeof item.minutes_since_update === "number"
              ? item.minutes_since_update
              : item.recorded_at
                ? (Date.now() - new Date(item.recorded_at).getTime()) / 60000
                : 0
          ),
        } : null,
      }
    }) || []

    // Calcular estadísticas
    const stats = {
      total: surveyorsWithLocation.length,
      active: surveyorsWithLocation.filter(s => s.status === "active").length,
      inactive: surveyorsWithLocation.filter(s => s.status === "inactive").length,
      offline: surveyorsWithLocation.filter(s => s.status === "offline").length,
      in_zone: surveyorsWithLocation.filter(s => s.current_location?.is_in_zone).length,
      out_of_zone: surveyorsWithLocation.filter(s =>
        s.current_location && !s.current_location.is_in_zone
      ).length,
      low_battery: surveyorsWithLocation.filter(s =>
        s.current_location &&
        s.current_location.battery_level !== null &&
        s.current_location.battery_level < 20
      ).length,
    }

    // Obtener zonas para mostrar en el mapa
    const { data: zones, error: zonesError } = await supabase
      .from("zones")
      .select(`
        id,
        name,
        geometry,
        status,
        zone_color
      `)
      .eq("status", "active")

    const response = {
      surveyors: surveyorsWithLocation,
      stats,
      zones: zones || [],
      last_update: new Date().toISOString(),
      filters: {
        survey_id,
        zone_id,
        status: status_filter,
      },
    }

    console.log("✅ Returning", surveyorsWithLocation.length, "surveyors with tracking data")

    return NextResponse.json(response)

  } catch (error: any) {
    console.error("❌ Unexpected error in GET /api/tracking:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error.message,
    }, { status: 500 })
  }
}

/**
 * POST /api/tracking
 * Obtener ubicaciones de encuestadores usando surveyor_tracking_view
 * 
 * Body params:
 * - survey_id?: UUID - Filtrar por encuesta
 * - zone_id?: UUID - Filtrar por zona
 * - surveyor_ids?: string[] - Lista de IDs de encuestadores
 * - minutes?: number - No usado, mantenido por compatibilidad
 * - status?: 'active' | 'idle' | 'offline' | 'never_seen' - Filtrar por estado
 */
export async function POST(request: Request) {
  console.log("🔵 POST /api/tracking - Getting surveyor locations from view")

  // Misma protección que GET — este POST también solo LEE ubicaciones
  // (filtros vía body en vez de query string), no es el endpoint donde el
  // encuestador reporta su propia posición (eso vive en /api/location).
  //
  // CORRECCIÓN (ver resolveTeamSurveyorIds arriba): antes solo exigía rol
  // admin/supervisor sin filtrar por equipo — y este es el endpoint que la
  // pantalla de Geolocalización realmente usa (app/surveyors/page.tsx llama
  // a POST, no a GET). Se agrega coordinator y el mismo alcance por equipo.
  const auth = await requireRole(["admin", "supervisor", "coordinator"])
  if (!auth.ok) return auth.response

  // Fix 2026-08-12: mismo bug de cookies() sin await que el GET handler.
  const supabase = createAdminSupabase()

  try {
    const body = await request.json()
    const { survey_id, zone_id, surveyor_ids, status } = body

    console.log("📊 Body params:", { survey_id, zone_id, surveyor_ids, status })

    const teamSurveyorIds = await resolveTeamSurveyorIds(auth.user, supabase)

    // Usar la vista surveyor_tracking_view como recomienda el documento
    let query = supabase
      .from("surveyor_tracking_view")
      .select("*")
      .order("recorded_at", { ascending: false, nullsFirst: false })

    // Filtrar por estado si se especifica
    if (status) {
      query = query.eq("status", status)
    }

    // Filtrar por zona si se especifica
    if (zone_id && zone_id !== "all") {
      query = query.eq("zone_id", zone_id)
    }

    // Filtrar por lista de IDs de encuestadores — intersección con el
    // equipo permitido cuando el usuario no es admin (mismo criterio que GET).
    if (teamSurveyorIds !== null) {
      const requestedIds = surveyor_ids && Array.isArray(surveyor_ids) && surveyor_ids.length > 0 ? surveyor_ids : null
      const allowedIds = requestedIds ? requestedIds.filter((id: string) => teamSurveyorIds.includes(id)) : teamSurveyorIds
      query = query.in("surveyor_id", allowedIds.length > 0 ? allowedIds : ["__none__"])
    } else if (surveyor_ids && Array.isArray(surveyor_ids) && surveyor_ids.length > 0) {
      query = query.in("surveyor_id", surveyor_ids)
    }

    // Si hay filtro por encuesta, obtener los encuestadores asignados
    if (survey_id && survey_id !== "all") {
      const { data: surveyData, error: surveyError } = await (supabase as any)
        .from("surveys")
        .select("assigned_surveyors")
        .eq("id", survey_id)
        .single()

      if (!surveyError && surveyData?.assigned_surveyors) {
        const assignedIds = Array.isArray(surveyData.assigned_surveyors)
          ? surveyData.assigned_surveyors
          : [surveyData.assigned_surveyors]

        query = query.in("surveyor_id", assignedIds)
      }
    }

    const { data: trackingData, error: trackingError } = await query

    if (trackingError) {
      console.error("❌ Error fetching tracking data:", trackingError)
      return NextResponse.json({ error: "Failed to fetch tracking data" }, { status: 500 })
    }

    // Fix 2026-07-29: surveyor_tracking_view no expone last_logout_at (su
    // definición ya trae columnas fijas de antes de este fix, y no queríamos
    // arriesgar un CREATE OR REPLACE VIEW a ciegas sin ver su SQL completo).
    // En vez de eso, se consulta aparte contra `surveyors` y se cruza por
    // surveyor_id en memoria — ver calcStatus() más arriba.
    const surveyorIdsForLogout = Array.from(
      new Set((trackingData || []).map((item: any) => item.surveyor_id).filter(Boolean))
    )
    let lastLogoutMap: Record<string, string | null> = {}
    if (surveyorIdsForLogout.length > 0) {
      const { data: logoutRows } = await supabase
        .from("surveyors")
        .select("id, last_logout_at")
        .in("id", surveyorIdsForLogout)
      lastLogoutMap = Object.fromEntries(
        (logoutRows || []).map((r: any) => [r.id, r.last_logout_at])
      )
    }

    // Transformar los datos al formato esperado por el frontend
    const surveyorsWithLocation = trackingData?.map((item: any) => {
      // Estado calculado siempre desde tiempo real, nunca desde el campo status de la vista
      const status = calcStatus(item, lastLogoutMap[item.surveyor_id])
      const in_app = isInApp(item)

      return {
        id: item.surveyor_id,
        name: item.surveyor_name || "Sin nombre",
        email: item.surveyor_email || "",
        phone_number: item.surveyor_phone || "",
        status,
        in_app,  // true=en la app, false=background, null=APK no reporta este campo aún
        current_location: item.latitude && item.longitude ? {
          latitude: item.latitude,
          longitude: item.longitude,
          accuracy: item.accuracy || null,
          battery_level: item.battery_level,
          is_charging: item.is_charging || false,
          is_in_zone: item.is_in_zone || false,
          zone: item.zone_id ? { id: item.zone_id, name: item.zone_name || "Sin nombre" } : null,
          active_survey: null,
          recorded_at: item.recorded_at,
          minutes_ago: Math.round(
            typeof item.minutes_since_update === "number"
              ? item.minutes_since_update
              : item.recorded_at
                ? (Date.now() - new Date(item.recorded_at).getTime()) / 60000
                : 0
          ),
        } : null,
      }
    }) || []

    // Calcular estadísticas
    const stats = {
      total: surveyorsWithLocation.length,
      active: surveyorsWithLocation.filter(s => s.status === "active").length,
      inactive: surveyorsWithLocation.filter(s => s.status === "inactive").length,
      offline: surveyorsWithLocation.filter(s => s.status === "offline").length,
      in_zone: surveyorsWithLocation.filter(s => s.current_location?.is_in_zone).length,
      out_of_zone: surveyorsWithLocation.filter(s =>
        s.current_location && !s.current_location.is_in_zone
      ).length,
      low_battery: surveyorsWithLocation.filter(s => 
        s.current_location && 
        s.current_location.battery_level !== null && 
        s.current_location.battery_level < 20
      ).length,
    }

    // Obtener zonas para mostrar en el mapa
    const { data: zones, error: zonesError } = await supabase
      .from("zones")
      .select(`
        id,
        name,
        geometry,
        status,
        zone_color
      `)
      .eq("status", "active")

    const response = {
      surveyors: surveyorsWithLocation,
      stats,
      zones: zones || [],
      last_update: new Date().toISOString(),
    }

    console.log("✅ Returning", surveyorsWithLocation.length, "surveyors with tracking data")

    return NextResponse.json(response)

  } catch (error: any) {
    console.error("❌ Unexpected error in POST /api/tracking:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error.message,
    }, { status: 500 })
  }
}
