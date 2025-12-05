// ============================================
// EJEMPLOS DE TESTING - Módulo de Zonas
// ============================================
// Este archivo contiene ejemplos de cómo probar
// el módulo de zonas manualmente o con tests
// ============================================

// EJEMPLO 1: Crear zona por barrios (modo choropleth)
// ----------------------------------------------------
const createZoneByNeighborhoods = async () => {
  const zoneData = {
    name: "Zona Norte Barranquilla",
    description: "Barrios del norte de la ciudad",
    geometry: {
      type: "MultiPolygon",
      coordinates: [
        // Coordenadas de los barrios combinados
        // Esto lo genera automáticamente el componente
      ],
    },
    zone_color: "#4ecdc4",
    selected_neighborhoods: [
      "Barrio Boston",
      "El Prado",
      "Altos del Prado",
      "El Golf"
    ],
    status: "active",
    created_by: "user-uuid-here"
  }

  const response = await fetch("/api/zones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(zoneData)
  })

  const result = await response.json()
  console.log("✅ Zone created:", result)
  return result
}

// EJEMPLO 2: Crear zona por dibujo manual
// ----------------------------------------------------
const createZoneByDrawing = async () => {
  const zoneData = {
    name: "Zona Industrial Sur",
    description: "Área industrial del sur",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [-74.82, 10.92],
        [-74.82, 11.00],
        [-74.75, 11.00],
        [-74.75, 10.92],
        [-74.82, 10.92] // Cerrar el polígono
      ]]
    },
    zone_color: "#ff6b6b",
    selected_neighborhoods: [], // Vacío en modo manual
    status: "active",
    created_by: "user-uuid-here"
  }

  const response = await fetch("/api/zones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(zoneData)
  })

  const result = await response.json()
  console.log("✅ Zone created:", result)
  return result
}

// EJEMPLO 3: Verificar estructura de GeoJSON
// ----------------------------------------------------
const testGeoJSONStructures = () => {
  // Estructura 1: Polygon simple
  const polygon = {
    type: "Polygon",
    coordinates: [[
      [-74.8, 10.9],
      [-74.8, 11.0],
      [-74.7, 11.0],
      [-74.7, 10.9],
      [-74.8, 10.9]
    ]]
  }
  console.log("✅ Valid Polygon:", polygon)

  // Estructura 2: MultiPolygon (múltiples barrios)
  const multiPolygon = {
    type: "MultiPolygon",
    coordinates: [
      [[[-74.82, 10.92], [-74.82, 10.93], [-74.81, 10.93], [-74.81, 10.92], [-74.82, 10.92]]],
      [[[-74.80, 10.95], [-74.80, 10.96], [-74.79, 10.96], [-74.79, 10.95], [-74.80, 10.95]]]
    ]
  }
  console.log("✅ Valid MultiPolygon:", multiPolygon)

  // Estructura 3: LineString (ruta)
  const lineString = {
    type: "LineString",
    coordinates: [
      [-74.8, 10.9],
      [-74.79, 10.91],
      [-74.78, 10.92]
    ]
  }
  console.log("✅ Valid LineString:", lineString)

  // Estructura 4: Point (marcador)
  const point = {
    type: "Point",
    coordinates: [-74.8, 10.9]
  }
  console.log("✅ Valid Point:", point)
}

// EJEMPLO 4: Obtener todas las zonas
// ----------------------------------------------------
const getAllZones = async () => {
  const response = await fetch("/api/zones")
  const zones = await response.json()
  
  console.log("📊 Total zones:", zones.length)
  
  zones.forEach(zone => {
    console.log(`
      🗺️ Zone: ${zone.name}
      - ID: ${zone.id}
      - Geometry Type: ${zone.geometry?.type || 'None'}
      - Neighborhoods: ${zone.selected_neighborhoods?.length || 0}
      - Has Snapshot: ${!!zone.map_snapshot}
      - Color: ${zone.zone_color}
      - Status: ${zone.status}
    `)
  })
  
  return zones
}

// EJEMPLO 5: Actualizar una zona
// ----------------------------------------------------
const updateZone = async (zoneId: string) => {
  const updateData = {
    id: zoneId,
    name: "Zona Norte Actualizada",
    description: "Descripción actualizada",
    // Puedes actualizar solo los campos que necesites
    zone_color: "#00d2d3"
  }

  const response = await fetch("/api/zones", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updateData)
  })

  const result = await response.json()
  console.log("✅ Zone updated:", result)
  return result
}

// EJEMPLO 6: Eliminar una zona
// ----------------------------------------------------
const deleteZone = async (zoneId: string) => {
  const response = await fetch("/api/zones", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: zoneId })
  })

  const result = await response.json()
  console.log("✅ Zone deleted:", result)
  return result
}

// EJEMPLO 7: Validar geometría antes de guardar
// ----------------------------------------------------
const validateGeometry = (geometry: any): boolean => {
  const validTypes = [
    "Point",
    "LineString",
    "Polygon",
    "MultiPoint",
    "MultiLineString",
    "MultiPolygon",
    "GeometryCollection"
  ]

  // Verificar estructura básica
  if (!geometry || typeof geometry !== 'object') {
    console.error("❌ Invalid: geometry is not an object")
    return false
  }

  // Verificar tipo
  if (!geometry.type || !validTypes.includes(geometry.type)) {
    console.error(`❌ Invalid: type "${geometry.type}" not supported`)
    return false
  }

  // Verificar coordenadas (excepto GeometryCollection)
  if (geometry.type !== "GeometryCollection") {
    if (!Array.isArray(geometry.coordinates)) {
      console.error("❌ Invalid: coordinates must be an array")
      return false
    }
    if (geometry.coordinates.length === 0) {
      console.error("❌ Invalid: coordinates array is empty")
      return false
    }
  } else {
    // GeometryCollection debe tener geometries
    if (!Array.isArray(geometry.geometries)) {
      console.error("❌ Invalid: GeometryCollection must have geometries array")
      return false
    }
  }

  console.log("✅ Geometry is valid:", geometry.type)
  return true
}

// EJEMPLO 8: Test de carga de snapshot
// ----------------------------------------------------
const testSnapshotUpload = async () => {
  // Simular base64 de imagen
  const base64Image = "data:image/jpeg;base64,/9j/4AAQSkZJRg..." // truncado
  
  const zoneData = {
    name: "Zona con Snapshot",
    description: "Test de snapshot",
    geometry: {
      type: "Polygon",
      coordinates: [[[-74.8, 10.9], [-74.8, 11.0], [-74.7, 11.0], [-74.7, 10.9], [-74.8, 10.9]]]
    },
    map_snapshot: base64Image, // Se subirá a Storage automáticamente
    zone_color: "#3388ff",
    selected_neighborhoods: [],
    created_by: "user-uuid"
  }

  const response = await fetch("/api/zones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(zoneData)
  })

  const result = await response.json()
  
  if (result.map_snapshot && !result.map_snapshot.startsWith('data:')) {
    console.log("✅ Snapshot uploaded successfully to Storage")
    console.log("📸 Snapshot URL:", result.map_snapshot)
  } else {
    console.error("❌ Snapshot was not uploaded")
  }
  
  return result
}

// EJEMPLO 9: Combinar barrios en geometría
// ----------------------------------------------------
const combineNeighborhoods = async (neighborhoodNames: string[]) => {
  // Importar datos de barrios
  const barranquillaGeoJSON = await import('@/lib/geo-barranquilla.json')
  
  // Filtrar barrios seleccionados
  const selectedFeatures = barranquillaGeoJSON.features.filter(
    (f: any) => neighborhoodNames.includes(f.properties.nombre)
  )
  
  if (selectedFeatures.length === 0) {
    console.error("❌ No neighborhoods found")
    return null
  }
  
  // Si solo hay uno, retornar su geometría
  if (selectedFeatures.length === 1) {
    console.log("✅ Single neighborhood:", selectedFeatures[0].geometry)
    return selectedFeatures[0].geometry
  }
  
  // Múltiples: crear MultiPolygon
  const multiPolygon = {
    type: "MultiPolygon",
    coordinates: selectedFeatures.map((f: any) => f.geometry.coordinates)
  }
  
  console.log("✅ Combined neighborhoods into MultiPolygon")
  return multiPolygon
}

// EJEMPLO 10: Test completo del flujo
// ----------------------------------------------------
const testCompleteFlow = async () => {
  console.log("🧪 Starting complete flow test...")
  
  try {
    // 1. Crear zona
    console.log("\n1️⃣ Creating zone...")
    const newZone = await createZoneByNeighborhoods()
    console.log("✅ Zone created:", newZone.id)
    
    // 2. Obtener todas las zonas
    console.log("\n2️⃣ Fetching all zones...")
    const zones = await getAllZones()
    console.log("✅ Found zones:", zones.length)
    
    // 3. Actualizar la zona
    console.log("\n3️⃣ Updating zone...")
    const updated = await updateZone(newZone.id)
    console.log("✅ Zone updated:", updated.name)
    
    // 4. Eliminar la zona
    console.log("\n4️⃣ Deleting zone...")
    await deleteZone(newZone.id)
    console.log("✅ Zone deleted")
    
    console.log("\n✅ Complete flow test passed!")
  } catch (error) {
    console.error("\n❌ Complete flow test failed:", error)
  }
}

// EJEMPLO 11: Debugging de geometría
// ----------------------------------------------------
const debugGeometry = (geometry: any) => {
  console.group("🔍 Geometry Debug")
  
  console.log("Type:", geometry?.type)
  console.log("Has coordinates:", !!geometry?.coordinates)
  console.log("Coordinates structure:", JSON.stringify(geometry?.coordinates).substring(0, 100) + "...")
  
  if (geometry?.type === "Polygon") {
    const rings = geometry.coordinates.length
    const points = geometry.coordinates[0].length
    console.log(`Rings: ${rings}, Points in first ring: ${points}`)
  }
  
  if (geometry?.type === "MultiPolygon") {
    const polygons = geometry.coordinates.length
    console.log(`Number of polygons: ${polygons}`)
  }
  
  // Verificar si está cerrado (primer punto === último punto)
  if (geometry?.type === "Polygon" && geometry.coordinates[0].length > 0) {
    const first = geometry.coordinates[0][0]
    const last = geometry.coordinates[0][geometry.coordinates[0].length - 1]
    const isClosed = JSON.stringify(first) === JSON.stringify(last)
    console.log("Is closed:", isClosed ? "✅" : "❌")
  }
  
  console.groupEnd()
}

// ============================================
// CÓMO USAR ESTOS EJEMPLOS
// ============================================

/*
En la consola del navegador (F12), ejecuta:

// Test básico de creación
await createZoneByNeighborhoods()

// Ver todas las zonas
await getAllZones()

// Validar una geometría
validateGeometry({
  type: "Polygon",
  coordinates: [[[-74.8, 10.9], [-74.8, 11.0], [-74.7, 11.0], [-74.7, 10.9], [-74.8, 10.9]]]
})

// Test completo
await testCompleteFlow()

// Debug de geometría
debugGeometry(myGeometry)

*/

// ============================================
// EXPORT PARA USO EN TESTS
// ============================================
export {
  createZoneByNeighborhoods,
  createZoneByDrawing,
  testGeoJSONStructures,
  getAllZones,
  updateZone,
  deleteZone,
  validateGeometry,
  testSnapshotUpload,
  combineNeighborhoods,
  testCompleteFlow,
  debugGeometry
}
