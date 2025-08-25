import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// Validador y extractor de GeoJSON
function processGeoJSON(obj: any): { isValid: boolean; geometry: any } {
  try {
    if (!obj || typeof obj !== "object") {
      return { isValid: false, geometry: null }
    }

    let geometry = obj

    // Si es un Feature, extraer la geometría
    if (obj.type === "Feature" && obj.geometry) {
      geometry = obj.geometry
    }

    // Validar que la geometría tenga la estructura correcta
    const isValid =
      typeof geometry === "object" &&
      geometry !== null &&
      typeof geometry.type === "string" &&
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.length > 0

    return { isValid, geometry: isValid ? geometry : null }
  } catch (error) {
    console.error("Error processing GeoJSON:", error)
    return { isValid: false, geometry: null }
  }
}

// Función helper para validar GeoJSON (mantener compatibilidad)
function isValidGeoJSON(obj: any): boolean {
  return processGeoJSON(obj).isValid
}

export async function GET(request: Request) {
  console.log("🔵 GET /api/zones - Starting request")

  // Verificar variables de entorno primero
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL")
    return NextResponse.json({ error: "NEXT_PUBLIC_SUPABASE_URL not configured" }, { status: 500 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_ANON_KEY")
    return NextResponse.json({ error: "NEXT_PUBLIC_SUPABASE_ANON_KEY not configured" }, { status: 500 })
  }

  console.log("✅ Environment variables OK")

  let cookieStore
  let supabase

  try {
    console.log("🔵 Getting cookies...")
    cookieStore = cookies()
    console.log("✅ Cookies obtained")

    console.log("🔵 Creating Supabase client...")
    supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        get: (name: string) => {
          const cookie = cookieStore.get(name)
          console.log(`Cookie ${name}:`, cookie?.value ? "present" : "not found")
          return cookie?.value
        },
      },
    })
    console.log("✅ Supabase client created")
  } catch (error) {
    console.error("❌ Error setting up Supabase client:", error)
    return NextResponse.json(
      { error: "Failed to initialize database connection", details: String(error) },
      { status: 500 },
    )
  }

  try {
    console.log("🔵 Querying zones from database...")

    // Consultar zones con información relacionada de surveys
    const { data: zones, error } = await supabase.from("zones").select(`
        id,
        name,
        description,
        status,
        geometry,
        created_by,
        created_at,
        updated_at,
        map_snapshot
      `)

    console.log("🔵 Query completed. Error:", error ? error.message : "none")
    console.log("🔵 Data received:", zones ? `${zones.length} zones` : "null")

    if (error) {
      console.error("❌ Supabase error fetching zones:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      return NextResponse.json(
        {
          error: "Failed to fetch zones",
          details: error.message,
          code: error.code,
        },
        { status: 500 },
      )
    }

    // Si no hay datos, retornar array vacío
    let safeZones = zones || []

    // Opcionalmente, agregar información de surveys relacionadas para cada zona
    if (safeZones.length > 0) {
      console.log("🔵 Fetching related surveys for zones...")

      // Obtener surveys que tienen zonas asignadas
      const { data: surveys, error: surveysError } = await supabase
        .from("surveys")
        .select(`
          id,
          title,
          assigned_zones,
          assigned_surveyors,
          status
        `)
        .not("assigned_zones", "is", null)

      if (!surveysError && surveys) {
        console.log("🔵 Found", surveys.length, "surveys with assigned zones")

        // Agregar información de surveys y surveyors a cada zona
        safeZones = safeZones.map((zone) => {
          // Buscar surveys que tienen esta zona asignada
          const relatedSurveys = surveys.filter((survey) => {
            // assigned_zones puede ser un string con el ID de la zona
            // o un array de IDs (dependiendo de cómo lo manejes)
            const assignedZones =
              typeof survey.assigned_zones === "string"
                ? survey.assigned_zones.split(",").map((z) => z.trim())
                : survey.assigned_zones || []

            return (
              assignedZones.includes(zone.id) ||
              assignedZones.includes(zone.name) ||
              survey.assigned_zones === zone.id ||
              survey.assigned_zones === zone.name
            )
          })

          // Recopilar todos los surveyors únicos de las surveys relacionadas
          const allSurveyors = relatedSurveys.reduce((acc, survey) => {
            const surveyors = survey.assigned_surveyors || []
            return [...acc, ...surveyors]
          }, [])

          const uniqueSurveyors = [...new Set(allSurveyors)]

          return {
            ...zone,
            surveys: relatedSurveys.map((s) => ({
              id: s.id,
              title: s.title,
              status: s.status,
            })),
            surveyors: uniqueSurveyors,
          }
        })
      } else {
        console.log("⚠️ Could not fetch surveys:", surveysError?.message)
        // Si no se pueden obtener las surveys, solo agregar arrays vacíos
        safeZones = safeZones.map((zone) => ({
          ...zone,
          surveys: [],
          surveyors: [],
        }))
      }
    }

    console.log("✅ Returning", safeZones.length, "zones")
    return NextResponse.json(safeZones, { status: 200 })
  } catch (error: any) {
    console.error("❌ Unexpected error in GET /api/zones:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message || "Unknown error occurred",
        type: error.name || "Unknown",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  let cookieStore
  let supabase

  try {
    cookieStore = cookies()

    supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
      },
    })
  } catch (error) {
    console.error("Error setting up Supabase client:", error)
    return NextResponse.json({ error: "Failed to initialize database connection" }, { status: 500 })
  }

  try {
    // Verificar que las variables de entorno estén configuradas
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("Missing Supabase environment variables")
      return NextResponse.json({ error: "Database configuration error" }, { status: 500 })
    }

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("JSON parse error:", parseError)
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { name, description = "", geometry = null, status = "active", created_by, map_snapshot = null } = body

    // Validación básica
    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "Zone name is required and must be a non-empty string" }, { status: 400 })
    }

    if (!created_by) {
      return NextResponse.json({ error: "created_by is required" }, { status: 400 })
    }

    // Procesar geometry si está presente
    let processedGeometry = null
    if (geometry) {
      const geoResult = processGeoJSON(geometry)
      if (!geoResult.isValid) {
        return NextResponse.json(
          { error: "Invalid GeoJSON geometry. Expected geometry object or Feature with valid coordinates." },
          { status: 400 },
        )
      }
      processedGeometry = geoResult.geometry
    }

    console.log("🔵 Processed geometry:", processedGeometry ? "valid geometry" : "null")

    const { data: newZone, error } = await supabase
      .from("zones")
      .insert([
        {
          name: name.trim(),
          description,
          geometry: processedGeometry,
          status,
          created_by,
          map_snapshot,
        },
      ])
      .select(`
        id,
        name,
        description,
        status,
        geometry,
        created_by,
        created_at,
        updated_at,
        map_snapshot
      `)
      .single()

    if (error) {
      console.error("Supabase insert error:", error)
      return NextResponse.json(
        {
          error: "Failed to create zone",
          details: error.message,
        },
        { status: 500 },
      )
    }

    // Agregar campos surveys y surveyors como arrays vacíos para consistencia
    const zoneWithRelations = {
      ...newZone,
      surveys: [],
      surveyors: [],
    }

    return NextResponse.json(zoneWithRelations, { status: 201 })
  } catch (error: any) {
    console.error("Unexpected error in POST /api/zones:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error?.message || "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  let cookieStore
  let supabase

  try {
    cookieStore = cookies()

    supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
      },
    })
  } catch (error) {
    console.error("Error setting up Supabase client:", error)
    return NextResponse.json({ error: "Failed to initialize database connection" }, { status: 500 })
  }

  try {
    // Verificar que las variables de entorno estén configuradas
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("Missing Supabase environment variables")
      return NextResponse.json({ error: "Database configuration error" }, { status: 500 })
    }

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("JSON parse error:", parseError)
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { id, name, description, geometry, status, map_snapshot } = body

    if (!id) {
      return NextResponse.json({ error: "Zone ID is required for update" }, { status: 400 })
    }

    const updateData: {
      name?: string
      description?: string
      geometry?: any
      status?: string
      map_snapshot?: string | null
      updated_at?: string
    } = { updated_at: new Date().toISOString() }

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "") {
        return NextResponse.json({ error: "Zone name must be a non-empty string" }, { status: 400 })
      }
      updateData.name = name.trim()
    }
    if (description !== undefined) updateData.description = description
    if (geometry !== undefined) {
      if (geometry !== null) {
        const geoResult = processGeoJSON(geometry)
        if (!geoResult.isValid) {
          return NextResponse.json(
            { error: "Invalid GeoJSON geometry. Expected geometry object or Feature with valid coordinates." },
            { status: 400 },
          )
        }
        updateData.geometry = geoResult.geometry
      } else {
        updateData.geometry = null
      }
    }
    if (status !== undefined) updateData.status = status
    if (map_snapshot !== undefined) updateData.map_snapshot = map_snapshot

    const { data: updatedZone, error } = await supabase
      .from("zones")
      .update(updateData)
      .eq("id", id)
      .select(`
        id,
        name,
        description,
        status,
        geometry,
        created_by,
        created_at,
        updated_at,
        map_snapshot
      `)
      .single()

    if (error) {
      console.error("Supabase update error:", error)
      return NextResponse.json(
        {
          error: "Failed to update zone",
          details: error.message,
        },
        { status: 500 },
      )
    }

    if (!updatedZone) {
      return NextResponse.json({ error: "Zone not found" }, { status: 404 })
    }

    // Agregar campos surveys y surveyors para consistencia
    const zoneWithRelations = {
      ...updatedZone,
      surveys: [],
      surveyors: [],
    }

    return NextResponse.json(zoneWithRelations, { status: 200 })
  } catch (error: any) {
    console.error("Unexpected error in PUT /api/zones:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message || "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  let cookieStore
  let supabase

  try {
    cookieStore = cookies()

    supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
      },
    })
  } catch (error) {
    console.error("Error setting up Supabase client for DELETE:", error)
    return NextResponse.json({ error: "Failed to initialize database connection" }, { status: 500 })
  }

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("Missing Supabase environment variables for DELETE")
      return NextResponse.json({ error: "Database configuration error" }, { status: 500 })
    }

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("JSON parse error for DELETE:", parseError)
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { id } = body

    if (!id) {
      return NextResponse.json({ error: "Zone ID is required for deletion" }, { status: 400 })
    }

    const { error } = await supabase.from("zones").delete().eq("id", id)

    if (error) {
      console.error("Supabase delete error:", error)
      return NextResponse.json(
        {
          error: "Failed to delete zone",
          details: error.message,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ message: "Zone deleted successfully" }, { status: 200 })
  } catch (error: any) {
    console.error("Unexpected error in DELETE /api/zones:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message || "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}
