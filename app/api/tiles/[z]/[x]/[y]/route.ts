import { NextRequest, NextResponse } from "next/server"

// Ítem 15/09/2026: "el mapa exportado sale horrible / con marca de agua".
// Causa real, final: para poder capturar el mapa con html2canvas sin que el
// navegador tire SecurityError al leer el canvas, los tiles de la copia
// oculta de exportación necesitan cargarse con `crossOrigin: true` — y eso
// exige que el servidor de tiles responda con headers CORS
// (Access-Control-Allow-Origin). Se probaron dos rutas y ninguna sirve tal
// cual:
//   1. tile.openstreetmap.org (el mismo tile que usa el mapa visible): NO
//      manda esos headers — el navegador rechaza cada tile en silencio.
//   2. CartoDB (basemaps.cartocdn.com): sí manda CORS, pero ahora exige API
//      key para uso anónimo — sin una, cada tile vuelve como una imagen de
//      error con el texto "API KEY REQUIRED" superpuesto (por eso "se ve
//      horrible": esa marca de agua ERA la respuesta real del servidor).
//
// La solución que no depende de ningún proveedor externo ni de darse de
// alta en ningún servicio: hacer NOSOTROS mismos de proxy. Este endpoint
// pide el tile real a OpenStreetMap del lado del servidor (sin problema de
// CORS ahí — es un fetch servidor-a-servidor, no del navegador) y lo
// devuelve con Access-Control-Allow-Origin: * en NUESTRA respuesta. El
// resultado es exactamente el mismo tile que ve el mapa visible (mismo
// estilo, sin marcas de agua ni requisito de API key), pero servido desde
// nuestro propio dominio — que sí cumple lo que el navegador exige para
// `crossOrigin: true`.
//
// Respeta la política de uso de tiles de OSM (operations.osmfoundation.org/
// policies/tiles/): User-Agent identificable + Cache-Control largo para no
// volver a pedir el mismo tile más de lo necesario (uso puntual — solo
// cuando alguien exporta el mapa geográfico a PDF, no un mapa público de
// tráfico alto).
const TILE_SUBDOMAINS = ["a", "b", "c"]

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const { z, x, y } = await params

  // Validar que sean enteros simples antes de armar la URL — evita que
  // esto se use como proxy abierto hacia rutas arbitrarias.
  if (![z, x, y].every((v) => /^\d+$/.test(v))) {
    return NextResponse.json({ error: "Parámetros de tile inválidos" }, { status: 400 })
  }

  const subdomain = TILE_SUBDOMAINS[Number(x) % TILE_SUBDOMAINS.length]
  const upstreamUrl = `https://${subdomain}.tile.openstreetmap.org/${z}/${x}/${y}.png`

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        // Requerido por la política de uso de OSM — identifica la app,
        // no un navegador genérico.
        "User-Agent": "Datanalisis/1.0 (+https://datanalisis.dcmsystem.co)",
      },
      // No relevante para el navegador (esto corre en el servidor), pero
      // evita que Next.js cachee esta respuesta a nivel de fetch de forma
      // que compita con el Cache-Control que ya devolvemos abajo.
      cache: "no-store",
    })

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "No se pudo obtener el tile" }, { status: 502 })
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "image/png",
        "Access-Control-Allow-Origin": "*",
        // Los tiles de un mismo z/x/y no cambian — cachear agresivo tanto
        // en el navegador como en cualquier CDN intermedio reduce cuánto
        // le pegamos a los servidores de OSM en exportaciones repetidas.
        "Cache-Control": "public, max-age=604800, immutable",
      },
    })
  } catch (err) {
    console.error("[api/tiles] Error obteniendo tile:", err)
    return NextResponse.json({ error: "Error interno obteniendo el tile" }, { status: 500 })
  }
}
