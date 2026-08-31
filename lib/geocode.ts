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
// está en caché (o lo que hay en caché es un intento anterior que no
// encontró nada — ver más abajo por qué NO se trata como "ya resuelto"),
// llama a Nominatim y, si esta vez sí trae algo, lo guarda para la próxima.
// Nunca lanza — un fallo de red o de Nominatim simplemente devuelve null, y
// el llamador se queda con "—" (reintentable en la próxima carga).
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
    // BUG corregido (2026-08-31): antes se guardaba en caché CUALQUIER
    // resultado, incluido un fallo de red o de Nominatim (ciudad=null,
    // barrio=null) — una sola falla transitoria (ej. el contenedor sin
    // salida a internet en ese momento, un timeout, Nominatim caído un
    // instante) quedaba grabada para siempre como "ya se intentó, no hay
    // nada acá", y esa coordenada nunca más se volvía a intentar. Ahora solo
    // se confía en la caché si REALMENTE trajo algo la vez anterior — una
    // fila con ambos campos vacíos se trata como "todavía no resuelto" y se
    // reintenta (entra en el mismo cupo por página que un punto nuevo).
    if (cached && (cached.ciudad || cached.barrio)) {
      return { ciudad: cached.ciudad ?? null, barrio: cached.barrio ?? null }
    }
  } catch {
    // Tabla nueva (sql/2026_08_31_geocode_cache.sql) — si todavía no existe
    // en este ambiente, se sigue sin caché (cada llamada golpea Nominatim
    // directo) en vez de romper la pantalla.
  }

  let succeeded = false
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
          //
          // BUG encontrado en vivo (2026-08-31, con logs corriendo local):
          // este valor tenía un guión largo tipográfico "—" (U+2014, el
          // mismo que se usa en los comentarios de este archivo) en vez de
          // un guión ASCII normal. Los headers HTTP solo aceptan ByteString
          // (valores 0-255) — fetch() lanzaba
          // "Cannot convert argument to a ByteString" ANTES de mandar
          // cualquier request, así que ninguna llamada a Nominatim se
          // intentaba de verdad, en ningún ambiente. Nunca fue un problema
          // de red/firewall/Nominatim como se sospechaba — era este typo.
          "User-Agent": "DatanalisisReportes/1.0 (portal de encuestas - reverse geocoding de respuestas)",
        },
      },
    )
    if (res.ok) {
      const json = await res.json()
      const addr = json?.address || {}
      const ciudad = normalizeCityName(addr.city || addr.town || addr.municipality || "") || null
      const barrio = addr.suburb || addr.neighbourhood || addr.quarter || null
      result = { ciudad, barrio }
      succeeded = true
    } else {
      console.error(`[geocode] Nominatim respondió ${res.status} para ${lat},${lng}`)
    }
  } catch (err) {
    // Si esto se repite siempre, lo más probable es que el servidor no
    // tenga salida a internet hacia nominatim.openstreetmap.org (revisar
    // firewall/egress del contenedor) — no es un bug de este código.
    console.error(`[geocode] no se pudo contactar a Nominatim para ${lat},${lng}:`, err)
  }

  // Solo se cachea un resultado EXITOSO (incluso si vino vacío de verdad —
  // eso sí es información real: "Nominatim no tiene nada para este punto").
  // Un fallo de red/HTTP no se guarda, así que la próxima carga lo reintenta
  // en vez de darlo por perdido para siempre.
  if (succeeded) {
    try {
      await (admin as any)
        .from("geocode_cache")
        .upsert({ lat_round: latRound, lng_round: lngRound, ciudad: result.ciudad, barrio: result.barrio }, { onConflict: "lat_round,lng_round" })
    } catch {
      // Igual que arriba: si la tabla no existe todavía, no pasa nada — se
      // devuelve el resultado igual, solo que sin quedar cacheado para la
      // próxima vez.
    }
  }

  return succeeded ? result : null
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
        // Mismo criterio que reverseGeocodeCached: una fila cacheada con
        // ambos campos vacíos es un intento anterior fallido (ver bug
        // corregido arriba), no "ya se confirmó que no hay nada acá" — no
        // se cuenta como hit, así que cae en el cupo de reintentos de abajo
        // en vez de quedarse en "—" para siempre.
        if (row.ciudad || row.barrio) {
          cachedByKey[`${row.lat_round},${row.lng_round}`] = { ciudad: row.ciudad ?? null, barrio: row.barrio ?? null }
        }
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
