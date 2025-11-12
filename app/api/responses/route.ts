import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { searchParams } = new URL(request.url)
    const surveyId = searchParams.get("survey_id")

    let query = supabase
      .from("responses")
      .select(`
        id,
        survey_id,
        respondent_id,
        location,
        device_info,
        status,
        created_at,
        survey:survey_id (title),
        answer_data:response_answers (*)
      `)

    // Filtrar por encuesta si se proporciona un ID
    if (surveyId) {
      query = query.eq("survey_id", surveyId)
    }

    // Ejecutar consulta
    const { data, error } = await query.order("created_at", { ascending: false })

    if (error) {
      console.error("Error al obtener respuestas:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error al obtener respuestas:", error)
    return NextResponse.json({ error: "Error al obtener respuestas" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const body = await request.json()
  // Accept both `answers` and `response_answers` (frontend uses response_answers)
  const { survey_id, answers, response_answers, location, device_info, respondent_document_type, respondent_document_number, respondent_name } = body
  const effectiveAnswers = answers || response_answers

    if (!survey_id) {
      return NextResponse.json({ error: "ID de encuesta requerido" }, { status: 400 })
    }

    if (!effectiveAnswers || !Array.isArray(effectiveAnswers) || effectiveAnswers.length === 0) {
      return NextResponse.json({ error: "Se requieren respuestas" }, { status: 400 })
    }

    // Obtener usuario actual
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Crear respuesta principal
    const insertPayload: any = {
      survey_id,
      respondent_id: session?.user?.id || null,
      location: location || null,
      device_info: device_info || null,
      status: "completed",
      completed_at: new Date().toISOString(),
    }

    // Include public respondent info if provided (preview/public flows)
    if (respondent_document_type) insertPayload.respondent_document_type = respondent_document_type
    if (respondent_document_number) insertPayload.respondent_document_number = respondent_document_number
    if (respondent_name) insertPayload.respondent_name = respondent_name

    // Try insert, and if Supabase complains about missing columns in the schema cache
    // (PGRST204: Could not find the 'X' column...), remove those keys and retry once.
    let responseData: any = null
    let responseError: any = null
    let attemptedPayload = { ...insertPayload }
    const maxRetries = 2
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const resAttempt = await supabase.from("responses").insert(attemptedPayload).select().single()
      responseData = resAttempt.data
      responseError = resAttempt.error

      if (!responseError) break

      // If Supabase reports missing column(s) in the schema cache, try to drop them and retry
      const msg = responseError.message || ''
      const missingCols: string[] = []
      // Match patterns like: Could not find the 'device_info' column of 'responses' in the schema cache
      const regex = /Could not find the '([^']+)' column/gi
      let m: RegExpExecArray | null
      while ((m = regex.exec(msg)) !== null) {
        if (m[1]) missingCols.push(m[1])
      }

      if (missingCols.length === 0) {
        // No missing-column info => don't retry
        break
      }

      // Remove missing columns from attemptedPayload and retry
      missingCols.forEach((c) => {
        if (c in attemptedPayload) {
          delete attemptedPayload[c]
          console.warn(`Removing missing column from payload before retry: ${c}`)
        }
      })

      // Continue to next attempt
    }

    if (responseError) {
      console.error("Error al crear respuesta después de reintentos:", responseError)
      return NextResponse.json({ error: responseError.message || 'Error creando respuesta', details: responseError }, { status: 500 })
    }

    if (!responseData || !responseData.id) {
      console.error('Insert returned no responseData', responseData)
      return NextResponse.json({ error: 'Insert no devolvió id de respuesta', details: responseData }, { status: 500 })
    }

    // Crear respuestas individuales en la tabla existente `answers` (response_id, question_id, value jsonb)
    // Validate and normalize question_id (answers from preview can contain keys like `${uuid}_0`)
    const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
    const answersToInsert: any[] = []
    const skipped: any[] = []

    for (const answer of (effectiveAnswers || [])) {
      let qid = answer.question_id
      if (typeof qid !== 'string') {
        skipped.push({ reason: 'question_id_not_string', original: answer })
        continue
      }

      // If qid is exactly a UUID, keep it. Otherwise try to extract a leading UUID.
      let match = qid.match(uuidRegex)
      if (match && match[0]) {
        qid = match[0]
      } else {
        skipped.push({ reason: 'invalid_question_id_uuid', original: answer })
        continue
      }

      answersToInsert.push({
        response_id: responseData.id,
        question_id: qid,
        value: answer.value === undefined ? null : (typeof answer.value === 'object' ? answer.value : { value: answer.value }),
      })
    }

    if (answersToInsert.length > 0) {
      const { error: answersError } = await supabase.from("answers").insert(answersToInsert)
      if (answersError) {
        console.error("Error al guardar answers:", answersError)
        // Si hay error al guardar respuestas, eliminar la respuesta principal
        try {
          await supabase.from("responses").delete().eq("id", responseData.id)
        } catch (delErr) {
          console.error('Error al eliminar respuesta fallida:', delErr)
        }
        return NextResponse.json({ error: answersError.message || 'Error guardando answers', details: answersError }, { status: 500 })
      }
    }

    // Return success but note skipped answers (if any) so client can debug
    if (skipped.length > 0) {
      return NextResponse.json({ success: true, message: 'Respuesta guardada, pero algunas respuestas fueron omitidas', skipped_count: skipped.length, skipped }, { status: 200 })
    }

    // No usamos survey_respondent_tracking en la lógica actual; no actualizarla.

    return NextResponse.json({
      success: true,
      message: "Respuesta guardada correctamente",
      response_id: responseData.id,
    })
  } catch (error) {
    console.error("Error al guardar respuesta:", error)
    return NextResponse.json({ error: "Error al guardar la respuesta" }, { status: 500 })
  }
}
