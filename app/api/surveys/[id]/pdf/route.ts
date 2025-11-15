"use server"

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
// pdfkit is a CJS module; require dynamically to avoid TS import issues in ESM
let PDFDocument: any
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  PDFDocument = require('pdfkit')
} catch (e) {
  PDFDocument = null
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!PDFDocument) {
      return NextResponse.json({ error: 'pdfkit no está instalado en el servidor' }, { status: 500 })
    }

    const surveyId = params.id
    const supabase = createAdminClient()
    const { data: survey, error } = await supabase
      .from('surveys')
      .select('id, title, description, created_at, project_id')
      .eq('id', surveyId)
      .single()

    if (error || !survey) {
      return NextResponse.json({ error: error?.message || 'Encuesta no encontrada' }, { status: 404 })
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    await new Promise<void>((resolve) => doc.on('end', () => resolve()))

    doc.fontSize(20).text(String(survey.title || 'Encuesta'), { align: 'left' })
    doc.moveDown()
    doc.fontSize(12).text(`Descripción: ${survey.description || '-'}`)
    doc.moveDown()
    doc.fontSize(10).text(`ID: ${survey.id}`)
    doc.text(`Proyecto: ${survey.project_id || '-'}`)
    doc.text(`Fecha creación: ${survey.created_at ? new Date(survey.created_at).toLocaleString() : '-'}`)

    doc.end()

    const pdfBuffer = Buffer.concat(chunks)

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="survey-${survey.id}.pdf"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error generando PDF' }, { status: 500 })
  }
}
