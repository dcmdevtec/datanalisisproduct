import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * POST /api/location
 * Endpoint para que la APK envíe la ubicación del encuestador
 * 
 * Body:
 * - surveyor_id: UUID del encuestador
 * - latitude: number
 * - longitude: number
 * - accuracy?: number (precisión en metros)
 * - battery_level?: number (0-100)
 * - is_charging?: boolean
 * - app_version?: string
 * - device_info?: string
 * - active_survey_id?: UUID (encuesta activa)
 */
export async function POST(request: Request) {
  console.log("🔵 POST /api/location - Receiving location update")

  // Validar configuración
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("❌ Missing Supabase configuration")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  // Crear cliente Supabase
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
    // Parsear el body
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("❌ Invalid JSON in request body")
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    // Validar campos requeridos
    const {
      surveyor_id,
      latitude,
      longitude,
      accuracy,
      battery_level,
      is_charging,
      app_version,
      device_info,
      active_survey_id,
      is_foreground = false,   // true = app en primer plano, false = app en background / no enviado
    } = body

    if (!surveyor_id) {
      return NextResponse.json({ error: "surveyor_id is required" }, { status: 400 })
    }

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json({ error: "latitude and longitude must be numbers" }, { status: 400 })
    }

    // Validar rangos de coordenadas
    if (latitude < -90 || latitude > 90) {
      return NextResponse.json({ error: "latitude must be between -90 and 90" }, { status: 400 })
    }

    if (longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: "longitude must be between -180 and 180" }, { status: 400 })
    }

    // Validar battery_level si se proporciona
    if (battery_level !== undefined && (battery_level < 0 || battery_level > 100)) {
      return NextResponse.json({ error: "battery_level must be between 0 and 100" }, { status: 400 })
    }

    console.log("📍 Location update:", {
      surveyor_id,
      latitude,
      longitude,
      accuracy,
      battery_level,
      active_survey_id,
    })

    // Verificar que el encuestador existe
    const { data: surveyor, error: surveyorError } = await supabase
      .from("surveyors")
      .select("id, name, status")
      .eq("id", surveyor_id)
      .single()

    if (surveyorError || !surveyor) {
      console.error("❌ Surveyor not found:", surveyor_id)
      return NextResponse.json({ error: "Surveyor not found" }, { status: 404 })
    }

    // Si el encuestador no está activo, lo reactivamos automáticamente al recibir ubicación.
    // Nunca bloquear la actualización de ubicación — si la APK está enviando datos, el encuestador ESTÁ activo.
    if (surveyor.status !== "active") {
      console.log("🔄 Reactivando encuestador que estaba:", surveyor.status, surveyor_id)
      await supabase
        .from("surveyors")
        .update({ status: "active" })
        .eq("id", surveyor_id)
    }

    // Insertar la ubicación
    // El trigger update_surveyor_zone se ejecutará automáticamente para calcular is_in_zone y current_zone_id
    const locationData = {
      surveyor_id,
      latitude,
      longitude,
      accuracy: accuracy || null,
      battery_level: battery_level || null,
      is_charging: is_charging || false,
      app_version: app_version || null,
      device_info: device_info || null,
      active_survey_id: active_survey_id || null,
      is_foreground: is_foreground || false,
      recorded_at: new Date().toISOString(),
    }

    const { data: location, error: insertError } = await supabase
      .from("surveyor_locations")
      .insert([locationData])
      .select(`
        id,
        latitude,
        longitude,
        accuracy,
        is_in_zone,
        current_zone_id,
        recorded_at
      `)
      .single()

    if (insertError) {
      console.error("❌ Error inserting location:", insertError)
      return NextResponse.json({
        error: "Failed to save location",
        details: insertError.message,
      }, { status: 500 })
    }

    // Obtener información de la zona si está en una
    let zoneInfo = null
    if (location.is_in_zone && location.current_zone_id) {
      const { data: zone } = await supabase
        .from("zones")
        .select("id, name")
        .eq("id", location.current_zone_id)
        .single()
      
      zoneInfo = zone
    }

    console.log("✅ Location saved successfully:", location.id)

    return NextResponse.json({
      success: true,
      message: "Location updated successfully",
      location: {
        id: location.id,
        latitude: location.latitude,
        longitude: location.longitude,
        recorded_at: location.recorded_at,
        is_in_zone: location.is_in_zone,
        zone: zoneInfo,
      },
    }, { status: 201 })

  } catch (error: any) {
    console.error("❌ Unexpected error in POST /api/location:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error.message,
    }, { status: 500 })
  }
}

/**
 * GET /api/location
 * Obtener la última ubicación de un encuestador específico
 * 
 * Query params:
 * - surveyor_id: UUID del encuestador
 */
export async function GET(request: Request) {
  console.log("🔵 GET /api/location - Getting latest location")

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
    return NextResponse.json({ error: "Database connection failed" }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const surveyor_id = searchParams.get("surveyor_id")

    if (!surveyor_id) {
      return NextResponse.json({ error: "surveyor_id query parameter is required" }, { status: 400 })
    }

    // Obtener la última ubicación
    const { data: location, error } = await supabase
      .from("surveyor_locations")
      .select(`
        id,
        latitude,
        longitude,
        accuracy,
        battery_level,
        is_charging,
        is_in_zone,
        current_zone_id,
        recorded_at,
        app_version,
        surveyor:surveyors(id, name, email, phone_number),
        zone:zones(id, name),
        active_survey:surveys(id, title)
      `)
      .eq("surveyor_id", surveyor_id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ 
          error: "No location found for this surveyor",
          surveyor_id 
        }, { status: 404 })
      }
      console.error("❌ Error fetching location:", error)
      return NextResponse.json({ error: "Failed to fetch location" }, { status: 500 })
    }

    // Calcular estado
    const recordedAt = new Date(location.recorded_at)
    const now = new Date()
    const minutesAgo = (now.getTime() - recordedAt.getTime()) / (1000 * 60)

    let status = "offline"
    if (minutesAgo <= 5) {
      status = "active"
    } else if (minutesAgo <= 30) {
      status = "inactive"
    }

    return NextResponse.json({
      ...location,
      status,
      minutes_ago: Math.round(minutesAgo),
    })

  } catch (error: any) {
    console.error("❌ Unexpected error in GET /api/location:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error.message,
    }, { status: 500 })
  }
}
