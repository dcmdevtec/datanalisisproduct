import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const paramsId = params.id
  try {
    const body = await request.json()
    const { document_type, document_number, full_name } = body as {
      document_type?: string
      document_number?: string
      full_name?: string
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

    // 1) Find or create a public_respondent for this survey + document
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

    let respondentPublicId: string | null = existing?.id ?? null

    if (!respondentPublicId) {
      // If no public_respondent exists for this survey, try to find the person in other tables
      // 1) Check other public_respondents (across surveys) for same document
      const { data: otherPublic, error: otherPubErr } = await supabase
        .from('public_respondents')
        .select('id, survey_id, full_name')
        .eq('document_type', document_type)
        .eq('document_number', document_number)
        .limit(1)
        .maybeSingle()

      if (otherPubErr) {
        console.error('Error querying other public_respondents:', otherPubErr)
      }

      // 2) Check responses table globally for a prior response with this document (most recent)
      const { data: otherResp, error: otherRespErr } = await supabase
        .from('responses')
        .select('id, survey_id, respondent_name, respondent_document_type, respondent_document_number, completed_at')
        .eq('respondent_document_type', document_type)
        .eq('respondent_document_number', document_number)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (otherRespErr) {
        console.error('Error querying responses for other surveys:', otherRespErr)
      }

      // Choose a candidate full_name from otherPublic or otherResp if available
      const candidateName = (otherPublic && (otherPublic as any).full_name) || (otherResp && (otherResp as any).respondent_name) || null

      const { data: created, error: createErr } = await supabase
        .from("public_respondents")
        // If we found a candidate name from other surveys, use it to prefill full_name
        .insert({ survey_id: surveyId, document_type, document_number, full_name: full_name || candidateName || null })
        .select("id")
        .single()

      if (createErr) {
        console.error("Error creating public_respondent:", createErr)
        return NextResponse.json({ error: createErr.message }, { status: 500 })
      }

      respondentPublicId = (created && (created as any).id) || null
      if (!respondentPublicId) {
        console.error("Created public_respondent returned no id:", created)
        return NextResponse.json({ error: "Failed to create respondent id" }, { status: 500 })
      }
    }

    // 2) Since we won't use survey_respondent_tracking, check the `responses` table instead for any
    // completed response from the same document for this survey. If any exists, block the user.
    try {
      // Query responses table by survey + document fields (schema has respondent_document_type/number)
      const { data: existingResponse, error: existingResponseErr } = await supabase
        .from("responses")
        .select("id, survey_id, respondent_document_type, respondent_document_number, completed_at")
        .eq("survey_id", surveyId)
        .eq("respondent_document_type", document_type)
        .eq("respondent_document_number", document_number)
        .limit(1)
        .maybeSingle()

      if (existingResponseErr) {
        console.error("Error querying responses by document fields:", existingResponseErr)
        return NextResponse.json({ error: existingResponseErr.message }, { status: 500 })
      }

      if (existingResponse) {
        console.info("Blocking start: found existing response for same document on this survey", { surveyId, responseId: existingResponse.id })
        return NextResponse.json({ allowed_to_proceed: false, message: "Documento ya registrado para esta encuesta" })
      }

      // No prior response found — allow to proceed. Do not write to tracking table per instruction.
      return NextResponse.json({ allowed_to_proceed: true, respondent_public_id: respondentPublicId })
    } catch (e) {
      console.error("Error while checking responses table:", e)
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  } catch (err) {
    console.error("Unexpected error in verify-respondent:", err)
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 })
  }
}
