import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/api-auth'

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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer = require('puppeteer-core')

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
        try { return require('fs').existsSync(p) } catch { return false }
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
    const origin = new URL(request.url).origin
    await page.goto(`${origin}/print/survey/${surveyId}`, { waitUntil: 'networkidle0', timeout: 30000 })
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
