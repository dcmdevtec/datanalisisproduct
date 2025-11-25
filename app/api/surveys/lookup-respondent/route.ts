import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const document_type = url.searchParams.get('document_type')
    const document_number = url.searchParams.get('document_number')
    const survey_id = url.searchParams.get('survey_id')

    if (!document_type || !document_number) {
      return NextResponse.json({ error: 'document_type and document_number are required' }, { status: 400 })
    }

    const supabase = createAdminSupabase() as any

    // 1) Try to find a public_respondent for this survey specifically
    if (survey_id) {
      const { data: perSurvey, error: perErr } = await supabase
        .from('public_respondents')
        .select('id, full_name, email, phone, address, company, metadata')
        .eq('survey_id', survey_id)
        .eq('document_type', document_type)
        .eq('document_number', document_number)
        .limit(1)
        .maybeSingle()

      if (perErr) console.error('lookup perSurvey err', perErr)
      if (perSurvey) {
        return NextResponse.json({
          found: true,
          scope: 'survey',
          respondent_id: perSurvey.id,
          respondent_name: perSurvey.full_name || null,
          email: perSurvey.email,
          phone: perSurvey.phone,
          address: perSurvey.address,
          company: perSurvey.company,
          metadata: perSurvey.metadata
        })
      }
    }

    // 2) Search other public_respondents globally
    const { data: otherPub, error: otherPubErr } = await supabase
      .from('public_respondents')
      .select('id, survey_id, full_name, email, phone, address, company, metadata')
      .eq('document_type', document_type)
      .eq('document_number', document_number)
      .limit(1)
      .maybeSingle()

    if (otherPubErr) console.error('lookup otherPub err', otherPubErr)
    if (otherPub) {
      return NextResponse.json({
        found: true,
        scope: 'other_public',
        respondent_id: otherPub.id,
        respondent_name: otherPub.full_name || null,
        source_survey_id: otherPub.survey_id,
        email: otherPub.email,
        phone: otherPub.phone,
        address: otherPub.address,
        company: otherPub.company,
        metadata: otherPub.metadata
      })
    }

    // 3) Search most recent response by document
    const { data: otherResp, error: otherRespErr } = await supabase
      .from('responses')
      .select('id, survey_id, respondent_name, respondent_document_type, respondent_document_number, completed_at')
      .eq('respondent_document_type', document_type)
      .eq('respondent_document_number', document_number)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (otherRespErr) console.error('lookup otherResp err', otherRespErr)
    if (otherResp) {
      return NextResponse.json({ found: true, scope: 'response', respondent_name: otherResp.respondent_name || null, source_survey_id: otherResp.survey_id })
    }

    return NextResponse.json({ found: false })
  } catch (e) {
    console.error('lookup error', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
