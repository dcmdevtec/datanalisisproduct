import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { requireRole } from "@/lib/api-auth"

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
function calcStatus(item: any): "active" | "inactive" | "offline" {
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
  const auth = await requireRole(["admin", "supervisor"])
  if (!auth.ok) return auth.response

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  let supabase
  try {
    const cookieStore = cookies()
    supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get: (name: string) => cookieStore.get(name)?.value,
        },
      }
    )
  } catch (error) {
    console.error("❌ Error creating Supabase client:", error)
    return NextResponse.json({ error: "Database connection failed" }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const survey_id = searchParams.get("survey_id")
    const zone_id = searchParams.get("zone_id")
    const surveyor_ids = searchParams.get("surveyor_ids")
    const status_filter = searchParams.get("status")

    console.log("📊 Query params:", { survey_id, zone_id, status_filter })

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

    // Filtrar por lista de IDs de encuestadores
    if (surveyor_ids) {
      const ids = surveyor_ids.split(",").map(id => id.trim())
      query = query.in("surveyor_id", ids)
    }

    // Si hay filtro por encuesta, obtener los encuestadores asignados
    if (survey_id) {
      const { data: surveyData, error: surveyError } = await supabase
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

    // Transformar los datos al formato esperado por el frontend
    const surveyorsWithLocation = trackingData?.map((item: any) => {
      // Estado calculado siempre desde tiempo real, nunca desde el campo status de la vista
      const status = calcStatus(item)
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
  const auth = await requireRole(["admin", "supervisor"])
  if (!auth.ok) return auth.response

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  let supabase
  try {
    const cookieStore = cookies()
    supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get: (name: string) => cookieStore.get(name)?.value,
        },
      }
    )
  } catch (error) {
    console.error("❌ Error creating Supabase client:", error)
    return NextResponse.json({ error: "Database connection failed" }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { survey_id, zone_id, surveyor_ids, status } = body

    console.log("📊 Body params:", { survey_id, zone_id, surveyor_ids, status })

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

    // Filtrar por lista de IDs de encuestadores
    if (surveyor_ids && Array.isArray(surveyor_ids) && surveyor_ids.length > 0) {
      query = query.in("surveyor_id", surveyor_ids)
    }

    // Si hay filtro por encuesta, obtener los encuestadores asignados
    if (survey_id && survey_id !== "all") {
      const { data: surveyData, error: surveyError } = await supabase
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

    // Transformar los datos al formato esperado por el frontend
    const surveyorsWithLocation = trackingData?.map((item: any) => {
      // Estado calculado siempre desde tiempo real, nunca desde el campo status de la vista
      const status = calcStatus(item)
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
