import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * POST /api/surveys/[id]/sections
 *
 * Guarda (upsert) una sección con todas sus preguntas usando el
 * service role key — bypasa RLS de survey_sections/questions.
 *
 * El cliente browser no puede hacer upsert directo porque RLS solo
 * tiene política SELECT para anon/authenticated en survey_sections.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: surveyId } = await params
    const body = await request.json()
    const { section, questions } = body as {
      section: {
        id: string
        title: string
        title_html?: string
        description?: string
        order_num: number
        skip_logic?: any
      }
      questions: Array<{
        id: string
        type: string
        text: string
        options?: any[]
        required?: boolean
        order_num?: number
        settings?: any
        matrix_rows?: any[]
        matrix_cols?: any[]
        rating_scale?: number | null
        file_url?: string | null
        skip_logic?: any
        display_logic?: any
        validation_rules?: any
      }>
    }

    if (!surveyId || !section?.id) {
      return NextResponse.json({ error: 'surveyId y section.id son requeridos' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // ── 1. Upsert sección ────────────────────────────────────────────────────
    const sectionData = {
      id: section.id,
      survey_id: surveyId,
      title: (section.title || 'Sin título').trim(),
      title_html: section.title_html || '',
      description: section.description || '',
      order_num: section.order_num ?? 0,
      skip_logic: section.skip_logic || null,
    }

    const { data: savedSection, error: sectionError } = await supabase
      .from('survey_sections')
      .upsert([sectionData], { onConflict: 'id' })
      .select()

    if (sectionError) {
      console.error('[sections/route] Error upsert sección:', sectionError)
      return NextResponse.json({ error: sectionError.message }, { status: 500 })
    }

    if (!savedSection || savedSection.length === 0) {
      return NextResponse.json({ error: 'No se pudo guardar la sección' }, { status: 500 })
    }

    const savedSectionId = savedSection[0].id

    // ── 2. Upsert cada pregunta ──────────────────────────────────────────────
    const savedQuestions: any[] = []
    if (questions && questions.length > 0) {
      for (const [index, q] of questions.entries()) {
        const questionData = {
          id: q.id,
          survey_id: surveyId,
          section_id: savedSectionId,
          type: q.type,
          text: (q.text || '').trim(),
          options: q.options || [],
          required: q.required ?? false,
          order_num: q.order_num ?? index,
          settings: q.settings || {},
          matrix_rows: q.matrix_rows || [],
          matrix_cols: q.matrix_cols || [],
          rating_scale: q.rating_scale || null,
          file_url: q.file_url || null,
          skip_logic: q.skip_logic || null,
          display_logic: q.display_logic || null,
          validation_rules: q.validation_rules || null,
        }

        const { data: savedQ, error: qError } = await supabase
          .from('questions')
          .upsert([questionData], { onConflict: 'id' })
          .select()

        if (qError) {
          console.error(`[sections/route] Error upsert pregunta ${q.id}:`, qError)
          return NextResponse.json({
            error: `Error al guardar pregunta ${index + 1}: ${qError.message}`
          }, { status: 500 })
        }

        if (savedQ && savedQ.length > 0) savedQuestions.push(savedQ[0])
      }
    }

    return NextResponse.json({
      success: true,
      section: savedSection[0],
      questions: savedQuestions,
    })

  } catch (err: any) {
    console.error('[sections/route] Error inesperado:', err)
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/surveys/[id]/sections?sectionId=xxx
 * Elimina una sección y sus preguntas (CASCADE en DB).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: surveyId } = await params
    const sectionId = request.nextUrl.searchParams.get('sectionId')

    if (!surveyId || !sectionId) {
      return NextResponse.json({ error: 'surveyId y sectionId son requeridos' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Eliminar preguntas primero (por si no hay CASCADE en la DB)
    await supabase.from('questions').delete().eq('section_id', sectionId)

    const { error } = await supabase
      .from('survey_sections')
      .delete()
      .eq('id', sectionId)
      .eq('survey_id', surveyId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}
