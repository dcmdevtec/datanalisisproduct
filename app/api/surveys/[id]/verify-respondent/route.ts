import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const paramsId = params.id
  try {
    const body = await request.json()
    // Map incoming payload to DB field names
    const {
      document_type,
      document_number,
      full_name,
      email,
      phone,
      address,
      company
    } = body as {
      document_type?: string
      document_number?: string
      full_name?: string
      email?: string
      phone?: string
      address?: string
      company?: string
    }

    // survey id may come from the URL or from the request body
    const surveyIdFromBody = (body as any)?.survey_id as string | undefined
    const surveyId = paramsId || surveyIdFromBody

    if (!document_type || !document_number) {
      return NextResponse.json({ error: "document_type and document_number are required" }, { status: 400 })
    }
    if (!surveyId) {
      return NextResponse.json({ error: "survey_id is required (either in URL or request body)" }, { status: 400 })
    }

    const supabase = createAdminSupabase() as any

    // 1) Check if respondent exists in this survey
    const { data: existing, error: existingErr } = await supabase
      .from("public_respondents")
      .select("*")
      .eq("survey_id", surveyId)
      .eq("document_type", document_type)
      .eq("document_number", document_number)
      .limit(1)
      .maybeSingle()

    if (existingErr) {
      console.error("DB error checking public_respondents:", existingErr)
      return NextResponse.json({ error: existingErr.message }, { status: 500 })
    }

    // 2) If respondent exists in public_respondents for this survey, BLOCK them immediately.
    // The user logic is: if they are in this table for this survey, they have already completed it.
    if (existing) {
      console.info("Blocking: respondent found in public_respondents for this survey", { surveyId, document_type, document_number })
      return NextResponse.json({
        allowed_to_proceed: false,
        message: "Esta cédula ya ha completado la encuesta y no puede responder de nuevo."
      })
    }

    // 3) If not found in this survey, try to find candidate data from other surveys to prefill
    let respondentPublicId: string | null = null
    let prefilledData: Record<string, any> = {}

    // New respondent - try to find candidate data from other surveys
    const { data: otherPublic, error: otherPubErr } = await supabase
      .from('public_respondents')
      .select('full_name, email, phone, address, company')
      .eq('document_type', document_type)
      .eq('document_number', document_number)
      .limit(1)
      .maybeSingle()

    if (otherPubErr) {
      console.error('Error querying other public_respondents:', otherPubErr)
    }

    const { data: otherResp, error: otherRespErr } = await supabase
      .from('responses')
      .select('respondent_name, completed_at')
      .eq('respondent_document_type', document_type)
      .eq('respondent_document_number', document_number)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (otherRespErr) {
      console.error('Error querying responses for candidate data:', otherRespErr)
    }

    // Build insert payload with incoming data or candidate data from other surveys
    // Note: We do NOT insert into public_respondents here anymore. 
    // We only use this data to prefill the form. The record will be created on submission.

    const candidateFullName = full_name || (otherPublic?.full_name as string) || (otherResp?.respondent_name as string) || null

    prefilledData = {
      full_name: candidateFullName || undefined,
      email: email || (otherPublic?.email as string) || undefined,
      phone: phone || (otherPublic?.phone as string) || undefined,
      address: address || (otherPublic?.address as string) || undefined,
      company: company || (otherPublic?.company as string) || undefined,
    }

    // 4) Allow to proceed
    console.info("Allowing respondent to proceed", { surveyId, document_type, document_number, respondentPublicId })
    return NextResponse.json({
      allowed_to_proceed: true,
      respondent_public_id: respondentPublicId,
      prefilled_data: prefilledData
    })
  } catch (err) {
    console.error("Unexpected error in verify-respondent:", err)
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 })
  }
}
