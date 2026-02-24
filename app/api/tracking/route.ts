import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * GET /api/tracking
 * Obtener ubicaciones de encuestadores para el panel de tracking
 * 
 * Query params:
 * - survey_id?: UUID - Filtrar por encuesta
 * - zone_id?: UUID - Filtrar por zona
 * - surveyor_ids?: string - Lista de IDs separados por coma
 * - minutes?: number - Últimos N minutos (default: 60)
 * - include_history?: boolean - Incluir historial del día
 * - status?: 'active' | 'inactive' | 'offline' - Filtrar por estado
 */
export async function GET(request: Request) {
  console.log("🔵 GET /api/tracking - Getting surveyor locations")

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
    const minutes = parseInt(searchParams.get("minutes") || "60")
    const include_history = searchParams.get("include_history") === "true"
    const status_filter = searchParams.get("status")

    console.log("📊 Query params:", { survey_id, zone_id, minutes, include_history, status_filter })

    // Obtener encuestadores con sus ubicaciones más recientes
    // Primero obtenemos todos los encuestadores
    let surveyorsQuery = supabase
      .from("surveyors")
      .select(`
        id,
        name,
        email,
        phone_number,
        status
      `)
      .eq("status", "active")

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
        
        surveyorsQuery = surveyorsQuery.in("id", assignedIds)
      }
    }

    // Si hay filtro por lista de IDs
    if (surveyor_ids) {
      const ids = surveyor_ids.split(",").map(id => id.trim())
      surveyorsQuery = surveyorsQuery.in("id", ids)
    }

    const { data: surveyors, error: surveyorsError } = await surveyorsQuery

    if (surveyorsError) {
      console.error("❌ Error fetching surveyors:", surveyorsError)
      return NextResponse.json({ error: "Failed to fetch surveyors" }, { status: 500 })
    }

    // Obtener las últimas ubicaciones de cada encuestador
    const surveyorIds = surveyors?.map(s => s.id) || []
    
    // Calcular el tiempo límite
    const timeLimit = new Date(Date.now() - minutes * 60 * 1000).toISOString()

    // Obtener ubicaciones recientes
    const { data: locations, error: locationsError } = await supabase
      .from("surveyor_locations")
      .select(`
        id,
        surveyor_id,
        latitude,
        longitude,
        accuracy,
        battery_level,
        is_charging,
        is_in_zone,
        current_zone_id,
        active_survey_id,
        recorded_at,
        app_version,
        zone:zones(id, name),
        survey:surveys(id, title)
      `)
      .in("surveyor_id", surveyorIds)
      .gte("recorded_at", timeLimit)
      .order("recorded_at", { ascending: false })

    if (locationsError) {
      console.error("❌ Error fetching locations:", locationsError)
      return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 })
    }

    // Procesar los datos para obtener la última ubicación de cada encuestador
    const latestLocationsMap = new Map()
    
    locations?.forEach(loc => {
      if (!latestLocationsMap.has(loc.surveyor_id)) {
        latestLocationsMap.set(loc.surveyor_id, loc)
      }
    })

    // Construir respuesta
    const now = new Date()
    const surveyorsWithLocation = surveyors?.map(surveyor => {
      const latestLocation = latestLocationsMap.get(surveyor.id)
      
      let status = "offline"
      let minutesAgo = null
      
      if (latestLocation) {
        const recordedAt = new Date(latestLocation.recorded_at)
        minutesAgo = Math.round((now.getTime() - recordedAt.getTime()) / (1000 * 60))
        
        if (minutesAgo <= 5) {
          status = "active"
        } else if (minutesAgo <= 30) {
          status = "inactive"
        }
      }

      return {
        id: surveyor.id,
        name: surveyor.name,
        email: surveyor.email,
        phone_number: surveyor.phone_number,
        status,
        current_location: latestLocation ? {
          latitude: latestLocation.latitude,
          longitude: latestLocation.longitude,
          accuracy: latestLocation.accuracy,
          battery_level: latestLocation.battery_level,
          is_charging: latestLocation.is_charging,
          is_in_zone: latestLocation.is_in_zone,
          zone: latestLocation.zone,
          active_survey: latestLocation.survey,
          recorded_at: latestLocation.recorded_at,
          minutes_ago: minutesAgo,
        } : null,
      }
    }) || []

    // Filtrar por estado si se especifica
    let filteredSurveyors = surveyorsWithLocation
    if (status_filter) {
      filteredSurveyors = surveyorsWithLocation.filter(s => s.status === status_filter)
    }

    // Filtrar por zona si se especifica
    if (zone_id) {
      filteredSurveyors = filteredSurveyors.filter(s => 
        s.current_location?.zone?.id === zone_id
      )
    }

    // Calcular estadísticas
    const stats = {
      total: filteredSurveyors.length,
      active: filteredSurveyors.filter(s => s.status === "active").length,
      inactive: filteredSurveyors.filter(s => s.status === "inactive").length,
      offline: filteredSurveyors.filter(s => s.status === "offline").length,
      in_zone: filteredSurveyors.filter(s => s.current_location?.is_in_zone).length,
      out_of_zone: filteredSurveyors.filter(s => 
        s.current_location && !s.current_location.is_in_zone
      ).length,
      low_battery: filteredSurveyors.filter(s => 
        s.current_location && 
        s.current_location.battery_level !== null && 
        s.current_location.battery_level < 20
      ).length,
    }

    // Si se solicita historial, obtenerlo
    let history = null
    if (include_history && surveyorIds.length > 0) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const { data: historyData, error: historyError } = await supabase
        .from("surveyor_locations")
        .select(`
          id,
          surveyor_id,
          latitude,
          longitude,
          recorded_at,
          is_in_zone
        `)
        .in("surveyor_id", surveyorIds)
        .gte("recorded_at", today.toISOString())
        .order("recorded_at", { ascending: true })

      if (!historyError && historyData) {
        // Agrupar por surveyor_id
        history = {}
        historyData.forEach(h => {
          if (!history[h.surveyor_id]) {
            history[h.surveyor_id] = []
          }
          history[h.surveyor_id].push({
            latitude: h.latitude,
            longitude: h.longitude,
            recorded_at: h.recorded_at,
            is_in_zone: h.is_in_zone,
          })
        })
      }
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
      surveyors: filteredSurveyors,
      stats,
      zones: zones || [],
      history,
      last_update: now.toISOString(),
      filters: {
        survey_id,
        zone_id,
        minutes,
        status: status_filter,
      },
    }

    console.log("✅ Returning", filteredSurveyors.length, "surveyors with tracking data")

    return NextResponse.json(response)

  } catch (error: any) {
    console.error("❌ Unexpected error in GET /api/tracking:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error.message,
    }, { status: 500 })
  }
}
