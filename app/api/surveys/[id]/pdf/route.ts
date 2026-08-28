import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/api-auth'
import { existsSync } from 'fs'

// SEGURIDAD (auditoría 2026-07-29): sin auth, cualquiera con el ID de la
// encuesta podía descargar el contenido completo en PDF sin login.
//
// Antes esto generaba el PDF a mano con pdfkit (texto plano, sin negrita/
// color/imagenes). El pedido del cliente fue "que se vea como el preview" —
// se reemplaza por Puppeteer headless: renderiza app/print/survey/[id] (una
// página dedicada que muestra la encuesta completa en una sola vista larga,
// con el mismo texto enriquecido/formato que el preview) y la imprime a PDF.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["admin", "supervisor"])
  if (!auth.ok) return auth.response

  const { id: surveyId } = await params
  const supabase = createAdminClient()

  const { data: survey, error } = await supabase
    .from('surveys')
    .select('id, title')
    .eq('id', surveyId)
    .single()

  if (error || !survey) {
    return NextResponse.json({ error: error?.message || 'Encuesta no encontrada' }, { status: 404 })
  }

  let browser: any = null
  try {
    // BUG (2026-08-28): puppeteer-core@25.x se distribuye como paquete
    // ESM-only. Con require('puppeteer-core'), Next.js no puede empaquetar
    // la referencia en el build ("Module not found: ESM packages
    // (puppeteer-core) need to be imported" — queda como warning, el build
    // no falla), y en runtime ese require() nunca encuentra el módulo
    // ("Cannot find module 'puppeteer-core'") aunque esté instalado en
    // node_modules. Se reemplaza por import() dinámico, que sí es
    // compatible con paquetes ESM.
    const puppeteer = (await import('puppeteer-core')).default

    // En producción (Dockerfile) se instala Chromium del sistema y se fija
    // PUPPETEER_EXECUTABLE_PATH. En desarrollo local, cae a un Chrome/Chromium
    // instalado en el equipo si existe alguno de estos paths conocidos.
    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      [
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      ].find((p) => {
        try { return existsSync(p) } catch { return false }
      })

    if (!executablePath) {
      return NextResponse.json(
        { error: 'No se encontró un navegador Chromium en el servidor para generar el PDF. Configura PUPPETEER_EXECUTABLE_PATH.' },
        { status: 500 }
      )
    }

    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()

    // BUG (2026-08-28): usar el origin del request público (new URL(request.url).origin)
    // rompe detrás de un proxy (Traefik/Dokploy) — el proxy reenvía
    // X-Forwarded-Proto: https pero el Host termina siendo el interno
    // ("localhost:3000"), así que Next reconstruye el origin como
    // "https://localhost:3000". Puppeteer corre DENTRO del mismo contenedor
    // que el servidor, que solo habla HTTP plano en ese puerto — de ahí el
    // net::ERR_SSL_PROTOCOL_ERROR. Se navega siempre por HTTP directo al
    // puerto interno, sin pasar por el proxy externo.
    const internalOrigin = process.env.INTERNAL_APP_URL || `http://127.0.0.1:${process.env.PORT || 3000}`

    // La página /print/survey/[id] llama a /api/surveys/[id], que exige
    // sesión (requireRole) — sin reenviar la cookie del usuario que pidió
    // el PDF, esa llamada interna daría 401 y la página nunca llegaría a
    // "data-print-ready".
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      await page.setExtraHTTPHeaders({ Cookie: cookieHeader })
    }

    await page.goto(`${internalOrigin}/print/survey/${surveyId}`, { waitUntil: 'networkidle0', timeout: 30000 })
    await page.waitForSelector('[data-print-ready="true"]', { timeout: 15000 })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '24px', bottom: '24px', left: '24px', right: '24px' },
    })

    const filename = `encuesta-${survey.title?.replace(/[^a-z0-9]/gi, '_').substring(0, 40) || surveyId}.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err: any) {
    console.error('[pdf/route] Error:', err)
    return NextResponse.json({ error: err?.message || 'Error generando PDF' }, { status: 500 })
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
