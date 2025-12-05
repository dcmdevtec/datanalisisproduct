import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// Validador y extractor de GeoJSON mejorado
function processGeoJSON(obj: any): { isValid: boolean; geometry: any; error?: string } {
  try {
    if (!obj || typeof obj !== "object") {
      return { isValid: false, geometry: null, error: "GeoJSON debe ser un objeto válido" }
    }

    let geometry = obj

    // Si es un Feature, extraer la geometría
    if (obj.type === "Feature" && obj.geometry) {
      geometry = obj.geometry
      console.log("📍 Extrayendo geometría de Feature")
    }

    // Si es un FeatureCollection, solo aceptar si tiene una sola feature
    if (obj.type === "FeatureCollection" && obj.features && Array.isArray(obj.features)) {
      if (obj.features.length === 0) {
        return { isValid: false, geometry: null, error: "FeatureCollection está vacío" }
      }
      if (obj.features.length === 1) {
        geometry = obj.features[0].geometry
        console.log("📍 Extrayendo geometría de FeatureCollection con 1 feature")
      } else {
        // Rechazar múltiples features - el usuario debe combinarlas primero
        return {
          isValid: false,
          geometry: null,
          error: `FeatureCollection con ${obj.features.length} features no soportado. Por favor, combina las geometrías en una sola.`
        }
      }
    }

    // Validar que la geometría tenga la estructura correcta
    const validTypes = ["Point", "LineString", "Polygon", "MultiPoint", "MultiLineString", "MultiPolygon"]

    if (!geometry.type || typeof geometry.type !== "string") {
      return { isValid: false, geometry: null, error: "Geometría debe tener un tipo válido" }
    }

    if (!validTypes.includes(geometry.type)) {
      return {
        isValid: false,
        geometry: null,
        error: `Tipo de geometría '${geometry.type}' no soportado. Tipos válidos: ${validTypes.join(", ")}`
      }
    }

    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
      return { isValid: false, geometry: null, error: "Geometría debe tener coordenadas válidas" }
    }

    // Validar coordenadas según el tipo
    const coordsValid = validateCoordinates(geometry.type, geometry.coordinates)
    if (!coordsValid.isValid) {
      return { isValid: false, geometry: null, error: coordsValid.error }
    }

    console.log("✅ GeoJSON válido:", geometry.type, `(${coordsValid.pointCount} puntos)`)
    return { isValid: true, geometry }
  } catch (error: any) {
    console.error("❌ Error procesando GeoJSON:", error)
    return { isValid: false, geometry: null, error: error.message || "Error desconocido al procesar GeoJSON" }
  }
}

// Función helper para validar coordenadas
function validateCoordinates(type: string, coordinates: any): { isValid: boolean; error?: string; pointCount?: number } {
  let pointCount = 0

  try {
    switch (type) {
      case "Point":
        if (!Array.isArray(coordinates) || coordinates.length < 2) {
          return { isValid: false, error: "Point debe tener al menos 2 coordenadas [lng, lat]" }
        }
        const [lng, lat] = coordinates
        if (typeof lng !== "number" || typeof lat !== "number") {
          return { isValid: false, error: "Coordenadas deben ser números" }
        }
        if (lat < -90 || lat > 90) {
          return { isValid: false, error: `Latitud ${lat} fuera de rango válido (-90 a 90)` }
        }
        if (lng < -180 || lng > 180) {
          return { isValid: false, error: `Longitud ${lng} fuera de rango válido (-180 a 180)` }
        }
        return { isValid: true, pointCount: 1 }

      case "LineString":
        if (!Array.isArray(coordinates) || coordinates.length < 2) {
          return { isValid: false, error: "LineString debe tener al menos 2 puntos" }
        }
        for (const point of coordinates) {
          const validation = validateCoordinates("Point", point)
          if (!validation.isValid) return validation
          pointCount++
        }
        return { isValid: true, pointCount }

      case "Polygon":
        if (!Array.isArray(coordinates) || coordinates.length === 0) {
          return { isValid: false, error: "Polygon debe tener al menos un anillo" }
        }
        for (const ring of coordinates) {
          if (!Array.isArray(ring) || ring.length < 4) {
            return { isValid: false, error: "Anillo de polígono debe tener al menos 4 puntos (cerrado)" }
          }
          // Validar que el primer y último punto sean iguales (polígono cerrado)
          const first = ring[0]
          const last = ring[ring.length - 1]
          if (first[0] !== last[0] || first[1] !== last[1]) {
            return { isValid: false, error: "Polígono debe estar cerrado (primer y último punto iguales)" }
          }
          for (const point of ring) {
            const validation = validateCoordinates("Point", point)
            if (!validation.isValid) return validation
            pointCount++
          }
        }
        return { isValid: true, pointCount }

      case "MultiPoint":
      case "MultiLineString":
      case "MultiPolygon":
        if (!Array.isArray(coordinates) || coordinates.length === 0) {
          return { isValid: false, error: `${type} debe tener al menos un elemento` }
        }
        const subType = type.replace("Multi", "")
        for (const subCoords of coordinates) {
          const validation = validateCoordinates(subType, subCoords)
          if (!validation.isValid) return validation
          pointCount += validation.pointCount || 0
        }
        return { isValid: true, pointCount }

      default:
        return { isValid: false, error: `Tipo de geometría '${type}' no reconocido` }
    }
  } catch (error: any) {
    return { isValid: false, error: `Error validando coordenadas: ${error.message}` }
  }
}

// Función helper para validar GeoJSON (mantener compatibilidad)
function isValidGeoJSON(obj: any): boolean {
  return processGeoJSON(obj).isValid
}

export async function GET(request: Request) {
  console.log("🔵 GET /api/zones - Starting request")

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL")
    return NextResponse.json({ error: "NEXT_PUBLIC_SUPABASE_URL not configured" }, { status: 500 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_ANON_KEY")
    return NextResponse.json({ error: "NEXT_PUBLIC_SUPABASE_ANON_KEY not configured" }, { status: 500 })
  }

  let cookieStore
  let supabase

  try {
    cookieStore = cookies()
    supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        get: (name: string) => {
          const cookie = cookieStore.get(name)
          return cookie?.value
        },
      },
    })
  } catch (error) {
    console.error("❌ Error setting up Supabase client:", error)
    return NextResponse.json(
      { error: "Failed to initialize database connection", details: String(error) },
      { status: 500 }
    )
  }

  try {
    console.log("🔵 Querying zones from database...")

    const { data: zones, error } = await supabase.from("zones").select(`
        id,
        name,
        description,
        status,
        geometry,
        created_by,
        created_at,
        updated_at,
        map_snapshot,
        zone_color,
        selected_neighborhoods
      `)

    if (error) {
      console.error("❌ Supabase error fetching zones:", error)
      return NextResponse.json(
        {
          error: "Failed to fetch zones",
          details: error.message,
          code: error.code,
        },
        { status: 500 }
      )
    }

    let safeZones = zones || []

    // Agregar información de surveys relacionadas
    if (safeZones.length > 0) {
      console.log("🔵 Fetching related surveys for zones...")

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

        safeZones = safeZones.map((zone) => {
          const relatedSurveys = surveys.filter((survey) => {
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
    console.error("❌ Unexpected error in GET /api/zones:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message || "Unknown error occurred",
        type: error.name || "Unknown",
      },
      { status: 500 }
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
    console.error("❌ Error setting up Supabase client:", error)
    return NextResponse.json({ error: "Failed to initialize database connection" }, { status: 500 })
  }

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("❌ Missing Supabase environment variables")
      return NextResponse.json({ error: "Database configuration error" }, { status: 500 })
    }

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("❌ JSON parse error:", parseError)
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const {
      name,
      description = "",
      geometry = null,
      status = "active",
      created_by,
      map_snapshot = null,
      zone_color = "#3388ff",
      selected_neighborhoods = [],
    } = body

    console.log("📥 POST /api/zones - Creating zone:", {
      name,
      hasGeometry: !!geometry,
      hasSnapshot: !!map_snapshot,
      neighborhoodsCount: selected_neighborhoods.length,
    })

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
        console.error("❌ Invalid geometry:", geoResult.error || "Unknown error")
        return NextResponse.json(
          {
            error: "Invalid GeoJSON geometry",
            details: geoResult.error || "Expected valid GeoJSON geometry object with coordinates",
          },
          { status: 400 }
        )
      }
      processedGeometry = geoResult.geometry
      console.log("✅ Processed geometry:", processedGeometry.type)
    } else {
      console.warn("⚠️ No geometry provided")
    }

    const insertData = {
      name: name.trim(),
      description,
      geometry: processedGeometry,
      status,
      created_by,
      map_snapshot,
      zone_color,
      selected_neighborhoods: Array.isArray(selected_neighborhoods) ? selected_neighborhoods : [],
    }

    console.log("💾 Inserting zone data:", {
      name: insertData.name,
      geometryType: processedGeometry?.type || "null",
      hasSnapshot: !!insertData.map_snapshot,
      neighborhoods: insertData.selected_neighborhoods.length,
    })

    const { data: newZone, error } = await supabase
      .from("zones")
      .insert([insertData])
      .select(`
        id,
        name,
        description,
        status,
        geometry,
        created_by,
        created_at,
        updated_at,
        map_snapshot,
        zone_color,
        selected_neighborhoods
      `)
      .single()

    if (error) {
      console.error("❌ Supabase insert error:", error)
      return NextResponse.json(
        {
          error: "Failed to create zone",
          details: error.message,
        },
        { status: 500 }
      )
    }

    const zoneWithRelations = {
      ...newZone,
      surveys: [],
      surveyors: [],
    }

    console.log("✅ Zone created successfully:", newZone.id)
    return NextResponse.json(zoneWithRelations, { status: 201 })
  } catch (error: any) {
    console.error("❌ Unexpected error in POST /api/zones:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error?.message || "Unknown error occurred",
      },
      { status: 500 }
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
    console.error("❌ Error setting up Supabase client:", error)
    return NextResponse.json({ error: "Failed to initialize database connection" }, { status: 500 })
  }

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("❌ Missing Supabase environment variables")
      return NextResponse.json({ error: "Database configuration error" }, { status: 500 })
    }

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("❌ JSON parse error:", parseError)
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const {
      id,
      name,
      description,
      geometry,
      status,
      map_snapshot,
      zone_color,
      selected_neighborhoods,
    } = body

    console.log("📥 PUT /api/zones - Updating zone:", {
      id,
      hasGeometry: geometry !== undefined,
      hasSnapshot: map_snapshot !== undefined,
    })

    if (!id) {
      return NextResponse.json({ error: "Zone ID is required for update" }, { status: 400 })
    }

    const updateData: any = { updated_at: new Date().toISOString() }

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
          console.error("❌ Invalid geometry for update:", geoResult.error || "Unknown error")
          return NextResponse.json(
            {
              error: "Invalid GeoJSON geometry",
              details: geoResult.error || "Expected valid GeoJSON geometry object with coordinates",
            },
            { status: 400 }
          )
        }
        updateData.geometry = geoResult.geometry
        console.log("✅ Updated geometry:", geoResult.geometry.type)
      } else {
        updateData.geometry = null
      }
    }

    if (status !== undefined) updateData.status = status
    if (map_snapshot !== undefined) updateData.map_snapshot = map_snapshot
    if (zone_color !== undefined) updateData.zone_color = zone_color
    if (selected_neighborhoods !== undefined)
      updateData.selected_neighborhoods = Array.isArray(selected_neighborhoods) ? selected_neighborhoods : []

    console.log("💾 Updating zone with data:", {
      id,
      fields: Object.keys(updateData),
      geometryType: updateData.geometry?.type || "unchanged",
    })

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
        map_snapshot,
        zone_color,
        selected_neighborhoods
      `)
      .single()

    if (error) {
      console.error("❌ Supabase update error:", error)
      return NextResponse.json(
        {
          error: "Failed to update zone",
          details: error.message,
        },
        { status: 500 }
      )
    }

    if (!updatedZone) {
      return NextResponse.json({ error: "Zone not found" }, { status: 404 })
    }

    const zoneWithRelations = {
      ...updatedZone,
      surveys: [],
      surveyors: [],
    }

    console.log("✅ Zone updated successfully:", id)
    return NextResponse.json(zoneWithRelations, { status: 200 })
  } catch (error: any) {
    console.error("❌ Unexpected error in PUT /api/zones:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message || "Unknown error occurred",
      },
      { status: 500 }
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
    console.error("❌ Error setting up Supabase client for DELETE:", error)
    return NextResponse.json({ error: "Failed to initialize database connection" }, { status: 500 })
  }

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("❌ Missing Supabase environment variables for DELETE")
      return NextResponse.json({ error: "Database configuration error" }, { status: 500 })
    }

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("❌ JSON parse error for DELETE:", parseError)
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { id } = body

    if (!id) {
      return NextResponse.json({ error: "Zone ID is required for deletion" }, { status: 400 })
    }

    console.log("🗑️ Deleting zone:", id)

    const { error } = await supabase.from("zones").delete().eq("id", id)

    if (error) {
      console.error("❌ Supabase delete error:", error)
      return NextResponse.json(
        {
          error: "Failed to delete zone",
          details: error.message,
        },
        { status: 500 }
      )
    }

    console.log("✅ Zone deleted successfully:", id)
    return NextResponse.json({ message: "Zone deleted successfully" }, { status: 200 })
  } catch (error: any) {
    console.error("❌ Unexpected error in DELETE /api/zones:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message || "Unknown error occurred",
      },
      { status: 500 }
    )
  }
}
