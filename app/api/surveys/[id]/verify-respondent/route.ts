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
    // Survey id can come from the route param or from body.survey_id
    const surveyIdFromBody = (body as any)?.survey_id as string | undefined
    const surveyId = paramsId || surveyIdFromBody

    if (!document_type || !document_number) {
      return NextResponse.json({ error: "document_type and document_number are required" }, { status: 400 })
    }
    if (!surveyId) {
      return NextResponse.json({ error: "survey_id is required (either in URL or request body)" }, { status: 400 })
    }

    // use admin client for server-side operations (service role key must be set)
    const supabase = createAdminSupabase() as any

    // 1) Look for existing public respondent
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

    let respondentId: string | undefined = existing?.id

    // 2) If not found, create it and a tracking row
    if (!respondentId) {
      const { data: created, error: createErr } = await supabase
        .from("public_respondents")
        .insert({ survey_id: surveyId, document_type, document_number, full_name: full_name || null })
        .select()
        .maybeSingle()

      if (createErr) {
        console.error("Error creating public_respondent:", createErr)
        return NextResponse.json({ error: createErr.message }, { status: 500 })
      }

      // Extract id defensively: supabase may return object or array depending on client
      respondentId = (created && (created as any).id) || (Array.isArray(created) && created[0] && created[0].id)

      if (!respondentId) {
        console.error("Created public_respondent returned no id:", created)
        return NextResponse.json({ error: "Failed to create respondent id" }, { status: 500 })
      }

      // create tracking (ensure respondentId is not null)
      let { error: trackErr } = await supabase.from("survey_respondent_tracking").insert({
        survey_id: surveyId,
        respondent_public_id: respondentId,
        status: "started",
      })

      if (trackErr) {
        console.error("Error creating tracking row (public_id):", trackErr)
        // Fallback: some DB schemas may expect a column named respondent_id (legacy). Try that as fallback.
        try {
          const { error: fallbackErr } = await supabase.from("survey_respondent_tracking").insert({
            survey_id: surveyId,
            respondent_id: respondentId,
            status: "started",
          })
          if (fallbackErr) {
            console.error("Fallback creating tracking row (respondent_id) also failed:", fallbackErr)
            return NextResponse.json({ error: fallbackErr.message || trackErr.message }, { status: 500 })
          }
        } catch (fallbackEx) {
          console.error("Unexpected fallback error creating tracking:", fallbackEx)
          return NextResponse.json({ error: String(fallbackEx) }, { status: 500 })
        }
      }

      return NextResponse.json({ allowed_to_proceed: true, status: "new", respondent_public_id: respondentId })
    }

    // 3) If found, check tracking state
    const { data: tracking, error: trackingErr } = await supabase
      .from("survey_respondent_tracking")
      .select("*")
      .eq("survey_id", surveyId)
      .eq("respondent_public_id", respondentId)
      .limit(1)
      .maybeSingle()

    if (trackingErr) {
      console.error("Error querying tracking:", trackingErr)
      return NextResponse.json({ error: trackingErr.message }, { status: 500 })
    }

    if (!tracking) {
      // No tracking found -> allow and create tracking
      if (!respondentId) {
        console.error("Missing respondentId when creating tracking for existing respondent", { surveyId, existing })
        return NextResponse.json({ error: "Missing respondent identifier" }, { status: 500 })
      }

      let { error: createTrackingErr } = await supabase.from("survey_respondent_tracking").insert({
        survey_id: surveyId,
        respondent_public_id: respondentId,
        status: "started",
      })

      if (createTrackingErr) {
        console.error("Error creating tracking row (public_id):", createTrackingErr)
        try {
          const { error: fallbackErr } = await supabase.from("survey_respondent_tracking").insert({
            survey_id: surveyId,
            respondent_id: respondentId,
            status: "started",
          })
          if (fallbackErr) {
            console.error("Fallback creating tracking row (respondent_id) also failed:", fallbackErr)
            return NextResponse.json({ error: fallbackErr.message || createTrackingErr.message }, { status: 500 })
          }
        } catch (fallbackEx) {
          console.error("Unexpected fallback error creating tracking:", fallbackEx)
          return NextResponse.json({ error: String(fallbackEx) }, { status: 500 })
        }
      }

      return NextResponse.json({ allowed_to_proceed: true, status: "started", respondent_public_id: respondentId })
    }

    // If a tracking row exists, decide based on status
    const status = tracking?.status as string | undefined

    if (status === "completed") {
      return NextResponse.json({ allowed_to_proceed: false, status: "completed", respondent_public_id: respondentId })
    }

    // started or abandoned -> allow to continue
    return NextResponse.json({ allowed_to_proceed: true, status: status || "started", respondent_public_id: respondentId })
  } catch (err) {
    console.error("Unexpected error in verify-respondent:", err)
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 })
  }
}
