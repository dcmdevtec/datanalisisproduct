import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/api-auth'

// SEGURIDAD (auditoría 2026-07-29): sin auth, cualquiera con el ID de la
// encuesta podía descargar el contenido completo en PDF sin login.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["admin", "supervisor"])
  if (!auth.ok) return auth.response

  try {
    // pdfkit debe estar en serverExternalPackages para no ser bundleado por webpack
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PDFKitModule = require('pdfkit')
    // Manejar tanto CJS directo como default export
    const PDFDocument = PDFKitModule?.default ?? PDFKitModule

    if (typeof PDFDocument !== 'function') {
      return NextResponse.json({ error: 'pdfkit no disponible en el servidor' }, { status: 500 })
    }

    const { id: surveyId } = await params
    const supabase = createAdminClient()

    // Cargar encuesta con secciones y preguntas
    const { data: survey, error } = await supabase
      .from('surveys')
      .select(`
        id, title, description, created_at, status,
        survey_sections (
          id, title, order_num,
          questions (
            id, text, type, required, order_num, options, config
          )
        )
      `)
      .eq('id', surveyId)
      .single()

    if (error || !survey) {
      return NextResponse.json({ error: error?.message || 'Encuesta no encontrada' }, { status: 404 })
    }

    // Ordenar secciones y preguntas
    const sections = ((survey as any).survey_sections || [])
      .sort((a: any, b: any) => (a.order_num ?? 0) - (b.order_num ?? 0))

    // Generar PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50, autoFirstPage: true })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    const pdfDone = new Promise<void>((resolve) => doc.on('end', resolve))

    // ── Paleta ──────────────────────────────────────────────────────────────
    const TEAL  = '#18b0a4'
    const DARK  = '#1e293b'
    const GRAY  = '#64748b'
    const LIGHT = '#f8f9fa'
    const W     = doc.page.width - 100   // ancho util

    // ── Etiquetas de tipo de pregunta en espanol ─────────────────────────────
    const TYPE_LABELS: Record<string, string> = {
      text:               'Texto corto',
      single_textbox:     'Texto corto',
      textarea:           'Texto largo',
      comment_box:        'Texto largo',
      email:              'Correo electronico',
      number:             'Numero',
      phone:              'Telefono',
      date:               'Fecha',
      time:               'Hora',
      multiple_choice:    'Opcion multiple',
      checkbox:           'Casillas de verificacion',
      dropdown:           'Lista desplegable',
      ranking:            'Ranking / Orden',
      rating:             'Calificacion (estrellas)',
      nps:                'NPS (0-10)',
      scale:              'Escala numerica',
      likert:             'Escala Likert',
      matrix:             'Matriz',
      multiple_textboxes: 'Cuadros de texto multiples',
      file_upload:        'Subida de archivo',
      signature:          'Firma',
      demographic:        'Datos demograficos (Edad / Genero)',
      contact_info:       'Informacion de contacto',
      image_choice:       'Seleccion de imagen',
    }
    const typeLabel = (t: string) => TYPE_LABELS[t] || t

    // ── Encabezado ───────────────────────────────────────────────────────────
    doc.rect(50, 40, W, 70).fill(TEAL)
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
       .text(String(survey.title || 'Encuesta'), 65, 55, { width: W - 30 })
    doc.fillColor('white').fontSize(9).font('Helvetica')
       .text(`Estado: ${(survey as any).status || 'borrador'}  •  Creada: ${new Date((survey as any).created_at).toLocaleDateString('es-CO')}`, 65, 92)

    doc.moveDown(4)

    // ── Descripción ──────────────────────────────────────────────────────────
    if ((survey as any).description) {
      doc.fillColor(GRAY).fontSize(9).font('Helvetica-Oblique')
         .text(String((survey as any).description), 50, doc.y, { width: W })
      doc.moveDown(1)
    }

    // ── Secciones y preguntas ────────────────────────────────────────────────
    let questionGlobal = 0

    for (const section of sections) {
      // Cabecera de sección
      const sy = doc.y + 6
      doc.rect(50, sy, W, 22).fill('#e6f7f6')
      doc.fillColor(TEAL).fontSize(10).font('Helvetica-Bold')
         .text(String(section.title || 'Sección'), 58, sy + 6, { width: W - 16 })
      doc.y = sy + 28

      const questions = (section.questions || [])
        .sort((a: any, b: any) => (a.order_num ?? 0) - (b.order_num ?? 0))

      for (const q of questions) {
        questionGlobal++

        // Evitar corte de pregunta al final de página
        if (doc.y > doc.page.height - 120) doc.addPage()

        const qy = doc.y
        // Número
        doc.circle(62, qy + 7, 9).fill(TEAL)
        doc.fillColor('white').fontSize(7).font('Helvetica-Bold')
           .text(String(questionGlobal), 56, qy + 3, { width: 12, align: 'center' })

        // Texto pregunta
        const required = q.required ? '  *' : ''
        doc.fillColor(DARK).fontSize(9.5).font('Helvetica-Bold')
           .text(String(q.text || '') + required, 78, qy, { width: W - 28 })

        // Tipo — etiqueta legible en espanol
        doc.fillColor(GRAY).fontSize(7.5).font('Helvetica')
           .text(`Tipo: ${typeLabel(q.type || 'text')}`, 78, doc.y + 1)

        const qConfig = (q as any).config ?? {}

        // ── Opciones seleccionables (multiple_choice, checkbox, dropdown, ranking, image_choice) ──
        const opts = Array.isArray(q.options) ? q.options.filter(Boolean) : []
        const MAX_OPTS = 20   // mostrar hasta 20 opciones
        if (opts.length > 0) {
          doc.moveDown(0.3)
          const visibleOpts = opts.slice(0, MAX_OPTS)
          for (const opt of visibleOpts) {
            let label: string
            if (typeof opt === 'object' && opt !== null) {
              label = String(opt?.label ?? opt?.value ?? opt?.text ?? '')
            } else {
              label = String(opt ?? '')
            }
            label = label.trim()
            if (!label || label === 'undefined') continue
            // Verificar si hay espacio suficiente antes de agregar opción
            if (doc.y > doc.page.height - 60) doc.addPage()
            doc.fillColor(GRAY).fontSize(8).font('Helvetica')
               .text(`    -  ${label}`, 86, doc.y, { width: W - 46 })
          }
          if (opts.length > MAX_OPTS) {
            doc.fillColor(GRAY).fontSize(7.5).font('Helvetica-Oblique')
               .text(`    ... y ${opts.length - MAX_OPTS} opciones mas`, 86, doc.y)
          }
        }

        // ── Para multiple_textboxes: mostrar las etiquetas de cada cuadro ──
        if (q.type === 'multiple_textboxes') {
          const labels: string[] = qConfig.textboxLabels ?? opts.map((o: any) =>
            typeof o === 'object' ? (o?.label ?? o?.value ?? '') : String(o ?? ''))
          if (labels.length > 0) {
            doc.moveDown(0.3)
            labels.forEach((lbl: string, i: number) => {
              const clean = String(lbl ?? '').trim() || `Campo ${i + 1}`
              doc.fillColor(GRAY).fontSize(8).font('Helvetica')
                 .text(`    ${i + 1}.  ${clean}`, 86, doc.y, { width: W - 46 })
            })
          }
        }

        // ── Para escala numerica: mostrar rango real desde config ──
        if (q.type === 'nps') {
          doc.fillColor(GRAY).fontSize(7.5).font('Helvetica-Oblique')
             .text('    Escala del 0 al 10', 86, doc.y + 2)
        }
        if (q.type === 'scale') {
          const scaleMin = qConfig.scaleMin ?? 1
          const scaleMax = qConfig.scaleMax ?? (q as any).ratingScale ?? 10
          const labelLow  = qConfig.scaleLabels?.[0] ? ` (${qConfig.scaleLabels[0]})` : ''
          const labelHigh = qConfig.scaleLabels?.[1] ? ` (${qConfig.scaleLabels[1]})` : ''
          doc.fillColor(GRAY).fontSize(7.5).font('Helvetica-Oblique')
             .text(`    Escala del ${scaleMin}${labelLow} al ${scaleMax}${labelHigh}`, 86, doc.y + 2)
        }
        if (q.type === 'rating') {
          const stars = qConfig.scaleMax ?? (q as any).ratingScale ?? 5
          doc.fillColor(GRAY).fontSize(7.5).font('Helvetica-Oblique')
             .text(`    ${stars} estrellas`, 86, doc.y + 2)
        }
        if (q.type === 'demographic') {
          doc.fillColor(GRAY).fontSize(7.5).font('Helvetica-Oblique')
             .text('    Campos: Edad, Genero', 86, doc.y + 2)
        }

        doc.moveDown(0.8)
        // Línea separadora suave
        doc.moveTo(78, doc.y).lineTo(50 + W, doc.y).strokeColor('#e2e8f0').lineWidth(0.4).stroke()
        doc.moveDown(0.5)
      }

      doc.moveDown(0.5)
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    const pages = (doc.bufferedPageRange?.() as any)?.count ?? 1
    const totalQ = questionGlobal
    doc.moveDown(1)
    doc.rect(50, doc.y, W, 28).fill(LIGHT)
    doc.fillColor(GRAY).fontSize(8).font('Helvetica')
       .text(`Total preguntas: ${totalQ}  •  Total secciones: ${sections.length}  •  Generado por Datanalisis`, 58, doc.y - 20, { width: W - 16 })

    doc.end()
    await pdfDone

    const pdfBuffer = Buffer.concat(chunks)
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
  }
}
