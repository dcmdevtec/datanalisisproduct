import { NextResponse } from "next/server"
import { resolveCurrentSurveyor } from "@/lib/portal-encuestador/auth"
import { requireRole } from "@/lib/api-auth"
import { createAdminSupabase } from "@/lib/supabase-server"

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

  // SEGURIDAD (auditoría 2026-07-29): antes este endpoint no exigía sesión
  // ni verificaba que el `surveyor_id` del body perteneciera a quien hace
  // el request — cualquier usuario autenticado (o incluso sin login) podía
  // insertar ubicación a nombre de OTRO encuestador. Tanto la APK como la
  // web exigen login del encuestador antes de reportar ubicación (confirmado
  // con el cliente) — los casos de "encuesta sin login" son un flujo
  // separado que no pasa por esta ruta. Se exige entonces que exista sesión
  // Y que el surveyor_id del body sea el del propio usuario autenticado.
  //
  // requireActive: false (fix 2026-07-29) — este endpoint reactiva
  // automáticamente al encuestador un poco más abajo si su status no es
  // 'active' ("nunca bloquear la actualización de ubicación"). Con el
  // default (requireActive: true), resolveCurrentSurveyor() devolvía null
  // para cualquier encuestador no-activo y esta ruta respondía 401 ANTES de
  // llegar a esa reactivación — dejándolo bloqueado para siempre (nunca
  // podía volver a reportar ubicación ni reactivarse solo). Esto es lo que
  // producía "No se pudo reportar tu ubicación al servidor" en el portal.
  const currentSurveyor = await resolveCurrentSurveyor({ requireActive: false })
  if (!currentSurveyor) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // Usar admin client: auth ya verificada por resolveCurrentSurveyor() arriba.
  // Fix 2026-08-12: el cliente anon anterior usaba cookies() sin await
  // (bug Next.js 15 — devuelve Promise en vez de ReadonlyRequestCookies),
  // por lo que el cliente no tenía sesión y los INSERTs fallaban con RLS.
  const supabase = createAdminSupabase()

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
      // surveyor_id ahora es opcional (auditoría 2026-07-29, tracking desde
      // el portal web): la APK lo manda explícito, pero el portal web no
      // tiene forma fácil de conocer su propio surveyor_id del lado del
      // cliente sin una llamada extra — como ya se exige sesión válida
      // arriba (resolveCurrentSurveyor), si el body no lo trae simplemente
      // se usa el del usuario autenticado. Si SÍ lo trae, se sigue
      // exigiendo que coincida con el propio (ver validación abajo).
      surveyor_id: bodySurveyorId,
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

    const surveyor_id = bodySurveyorId || currentSurveyor.surveyorId

    if (surveyor_id !== currentSurveyor.surveyorId) {
      console.warn("⚠️ Intento de reportar ubicación de otro encuestador:", { autenticado: currentSurveyor.surveyorId, solicitado: surveyor_id })
      return NextResponse.json({ error: "No puedes reportar ubicación de otro encuestador" }, { status: 403 })
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

  // SEGURIDAD (auditoría 2026-07-29): antes cualquiera podía consultar la
  // ubicación y datos de contacto de cualquier encuestador sin login. Ahora:
  // admin/supervisor pueden ver a cualquiera; un encuestador solo puede
  // consultar su propia ubicación.
  const { searchParams: authParams } = new URL(request.url)
  const requestedSurveyorId = authParams.get("surveyor_id")
  const roleAuth = await requireRole(["admin", "supervisor", "surveyor"])
  if (!roleAuth.ok) return roleAuth.response
  if (roleAuth.user.role === "surveyor") {
    const currentSurveyor = await resolveCurrentSurveyor()
    if (!currentSurveyor || currentSurveyor.surveyorId !== requestedSurveyorId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }
  }

  // Fix 2026-08-12: mismo bug de cookies() sin await. Admin client: auth ya
  // verificada por requireRole() arriba.
  const supabase = createAdminSupabase()

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
