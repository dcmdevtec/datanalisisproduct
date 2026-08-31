// Reverse geocoding con caché (lat/lng -> ciudad/barrio), vía Nominatim /
// OpenStreetMap — mismo proveedor y mismo mapeo de campos que ya usa
// components/location-question.tsx del lado del navegador, pero pensado
// para correr en el servidor (User-Agent explícito, como exige la política
// de uso de Nominatim para tráfico que no viene de un navegador).
//
// Ver sql/2026_08_31_geocode_cache.sql: la caché agrupa por coordenada
// redondeada a 3 decimales (~110m) para no pedirle a Nominatim la misma
// zona una y otra vez — varias respuestas del mismo barrio comparten una
// sola consulta.
// Se tipa `admin` como `any` a propósito: geocode_cache es una tabla nueva
// (sql/2026_08_31_geocode_cache.sql) que todavía no está en el Database
// generado, mismo criterio que el resto de este archivo usa para tablas
// fuera de ese tipo (surveyor_recordings, role_permissions, etc.).

function normalizeCityName(raw: string): string {
  if (!raw) return raw
  const prefixPattern = /^\s*(per[ií]metro urbano|zona urbana|[aá]rea urbana|zona rural)\s+(de\s+)?/i
  const stripped = raw.replace(prefixPattern, "").trim()
  return stripped || raw.trim()
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

// Resuelve ciudad/barrio para UNA coordenada, usando la caché primero. Si no
// está en caché, llama a Nominatim y guarda el resultado (incluso si viene
// vacío, para no volver a pedirlo). Nunca lanza — un fallo de red o de
// Nominatim simplemente devuelve null, y el llamador se queda con "—".
export async function reverseGeocodeCached(
  admin: any,
  lat: number,
  lng: number,
): Promise<{ ciudad: string | null; barrio: string | null } | null> {
  const latRound = round3(lat)
  const lngRound = round3(lng)

  try {
    const { data: cached } = await (admin as any)
      .from("geocode_cache")
      .select("ciudad, barrio")
      .eq("lat_round", latRound)
      .eq("lng_round", lngRound)
      .maybeSingle()
    if (cached) return { ciudad: cached.ciudad ?? null, barrio: cached.barrio ?? null }
  } catch {
    // Tabla nueva (sql/2026_08_31_geocode_cache.sql) — si todavía no existe
    // en este ambiente, se sigue sin caché (cada llamada golpea Nominatim
    // directo) en vez de romper la pantalla.
  }

  let result: { ciudad: string | null; barrio: string | null } = { ciudad: null, barrio: null }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          Accept: "application/json",
          // Requerido por la política de uso de Nominatim para tráfico de
          // servidor (a diferencia del navegador, que manda su propio
          // User-Agent automáticamente) — identifica de dónde vienen las
          // consultas en vez de aparecer como anónimas.
          "User-Agent": "DatanalisisReportes/1.0 (portal de encuestas — reverse geocoding de respuestas)",
        },
      },
    )
    if (res.ok) {
      const json = await res.json()
      const addr = json?.address || {}
      const ciudad = normalizeCityName(addr.city || addr.town || addr.municipality || "") || null
      const barrio = addr.suburb || addr.neighbourhood || addr.quarter || null
      result = { ciudad, barrio }
    }
  } catch (err) {
    console.error("[geocode] reverse geocoding falló:", err)
  }

  try {
    await (admin as any)
      .from("geocode_cache")
      .upsert({ lat_round: latRound, lng_round: lngRound, ciudad: result.ciudad, barrio: result.barrio }, { onConflict: "lat_round,lng_round" })
  } catch {
    // Igual que arriba: si la tabla no existe todavía, no pasa nada — se
    // devuelve el resultado igual, solo que sin quedar cacheado para la
    // próxima vez.
  }

  return result
}

// Resuelve ciudad/barrio para un LOTE de respuestas sin pregunta de
// Ubicación respondida, con un tope de consultas NUEVAS a Nominatim por
// llamada (maxNewLookups) — su política pide no pasar de ~1 request/seg, así
// que no se puede geocodificar una página entera de una sola vez sin
// arriesgarse a que bloqueen las consultas. Las que caen en caché (misma
// zona ya resuelta antes) no cuentan contra ese tope. Lo que se queda sin
// resolver en esta pasada simplemente sigue en "—" — la próxima vez que se
// cargue la pantalla, esa coordenada probablemente ya esté en caché (si cayó
// cerca de una ya resuelta) o entra en el cupo de esa carga.
export async function reverseGeocodeBatch(
  admin: any,
  points: { id: string; lat: number; lng: number }[],
  maxNewLookups = 6,
): Promise<Record<string, { ciudad: string | null; barrio: string | null }>> {
  const result: Record<string, { ciudad: string | null; barrio: string | null }> = {}
  if (points.length === 0) return result

  // Primero, todo lo que ya esté en caché — sin límite, es gratis.
  const uniqueCoords = new Map<string, { lat: number; lng: number }>()
  for (const p of points) {
    const key = `${round3(p.lat)},${round3(p.lng)}`
    if (!uniqueCoords.has(key)) uniqueCoords.set(key, { lat: p.lat, lng: p.lng })
  }

  let cachedByKey: Record<string, { ciudad: string | null; barrio: string | null }> = {}
  try {
    const roundedList = [...uniqueCoords.values()].map((c) => ({ lat: round3(c.lat), lng: round3(c.lng) }))
    if (roundedList.length > 0) {
      const { data } = await (admin as any)
        .from("geocode_cache")
        .select("lat_round, lng_round, ciudad, barrio")
        .in("lat_round", [...new Set(roundedList.map((c) => c.lat))])
      for (const row of (data as any[]) || []) {
        cachedByKey[`${row.lat_round},${row.lng_round}`] = { ciudad: row.ciudad ?? null, barrio: row.barrio ?? null }
      }
    }
  } catch {
    // sin caché disponible todavía — se sigue igual, solo más lento
  }

  let newLookups = 0
  for (const p of points) {
    const key = `${round3(p.lat)},${round3(p.lng)}`
    if (cachedByKey[key]) {
      result[p.id] = cachedByKey[key]
      continue
    }
    if (newLookups >= maxNewLookups) continue // se queda en "—" esta vez
    newLookups++
    const geocoded = await reverseGeocodeCached(admin, p.lat, p.lng)
    if (geocoded) {
      cachedByKey[key] = geocoded
      result[p.id] = geocoded
    }
  }

  return result
}
