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
    const { survey_id, answers, response_answers, location, device_info, respondent_document_type, respondent_document_number, respondent_name, assignment_id, outcome, client_submission_id, started_at } = body
    const effectiveAnswers = answers || response_answers

    if (!survey_id) {
      return NextResponse.json({ error: "ID de encuesta requerido" }, { status: 400 })
    }

    if (!effectiveAnswers || !Array.isArray(effectiveAnswers) || effectiveAnswers.length === 0) {
      return NextResponse.json({ error: "Se requieren respuestas" }, { status: 400 })
    }

    // IDEMPOTENCIA (auditoría 2026-07-29): el botón "Finalizar Encuesta" no
    // tenía guardia de reentrada, así que un doble tap o un reintento tras un
    // error de red podían crear dos filas en `responses` para el mismo envío.
    // El cliente ahora manda una `client_submission_id` estable por sesión de
    // llenado (ver app/preview/survey/page.tsx, submissionTokenRef). Si ya
    // existe una respuesta con esa misma llave para esta encuesta, la
    // devolvemos tal cual en vez de insertar un duplicado. Requiere la
    // columna `client_submission_id` (ver sql/2026_07_responses_idempotency.sql);
    // si la migración aún no corrió en esta base, la consulta simplemente no
    // encuentra nada (columna ausente => error controlado) y seguimos con el
    // flujo normal de inserción, sin romper el envío.
    if (typeof client_submission_id === "string" && client_submission_id.trim().length > 0) {
      const { data: existing, error: existingError } = await (supabase as any)
        .from("responses")
        .select("id")
        .eq("survey_id", survey_id)
        .eq("client_submission_id", client_submission_id)
        .maybeSingle()
      if (!existingError && existing?.id) {
        return NextResponse.json({
          success: true,
          message: "Respuesta ya registrada (envío duplicado detectado)",
          response_id: existing.id,
          duplicate: true,
        })
      }
    }

    // Obtener usuario actual
    const { data: { session } } = await supabase.auth.getSession()

    // Crear respuesta principal
    const insertPayload: any = {
      survey_id,
      respondent_id: session?.user?.id || null,
      location: location || null,
      device_info: device_info || null,
      status: "completed",
      completed_at: new Date().toISOString(),
      // started_at: momento real en que el encuestado empezó a responder,
      // enviado por el cliente (survey-public-renderer / collect page). Sin
      // esto, created_at/completed_at quedan casi simultáneos y "tiempo
      // promedio" en /reports siempre da 0:00. Fallback a null si no llega
      // (clientes viejos) — el cálculo de /reports cae de vuelta a created_at.
      ...(typeof started_at === "string" && started_at.trim().length > 0 ? { started_at } : {}),
      respondent_document_type: respondent_document_type || null,
      respondent_document_number: respondent_document_number || null,
      respondent_name: respondent_name || null,
      // assignment_id: liga la respuesta al encuestador/zona (portal de encuestador).
      // outcome: clasificación efectiva/incidencia/abandonada (ver sql/2026_07_reports_outcome_and_hierarchy.sql).
      // Ambos opcionales y aditivos — si no vienen, se comporta exactamente igual que antes.
      ...(assignment_id ? { assignment_id } : {}),
      outcome: ["efectiva", "incidencia", "abandonada", "descalificado"].includes(outcome) ? outcome : "efectiva",
      ...(typeof client_submission_id === "string" && client_submission_id.trim().length > 0
        ? { client_submission_id }
        : {}),
    }

    // ---------------------------------------------------------------
    // Lógica para guardar/actualizar Public Respondent (Contact Info)
    // ---------------------------------------------------------------
    // Obtener IDs de preguntas presentes en la respuesta
    const questionIds = effectiveAnswers.map((a: any) => a.question_id).filter(Boolean)
    // Buscar preguntas de tipo 'contact_info'
    const { data: contactQuestions } = await supabase
      .from('questions')
      .select('id, type')
      .in('id', questionIds)
      .eq('type', 'contact_info')

    if (contactQuestions && contactQuestions.length > 0) {
      const contactQId = contactQuestions[0].id
      const answerPayload = effectiveAnswers.find((a: any) => a.question_id === contactQId)
      if (answerPayload && answerPayload.value) {
        const val = answerPayload.value
        const docType = val.documentType || respondent_document_type
        const docNum = val.documentNumber || respondent_document_number
        if (docType && docNum) {
          const fullName = val.fullName || [val.firstName, val.lastName].filter(Boolean).join(' ').trim() || respondent_name || ''
          const respondentData = {
            survey_id,
            document_type: docType,
            document_number: docNum,
            full_name: fullName,
            email: val.email || null,
            phone: val.phone || null,
            address: val.address || null,
            company: val.company || null,
            updated_at: new Date().toISOString(),
          }
          const { data: upsertData, error: upsertError } = await supabase
            .from('public_respondents')
            .upsert(respondentData, { onConflict: 'survey_id,document_type,document_number', ignoreDuplicates: false })
            .select('id')
            .single()
          if (upsertError) {
            console.error('Error upserting public_respondent:', upsertError)
          } else if (upsertData) {
            insertPayload.respondent_id = upsertData.id
          }
        }
      }
    }

    // Insertar la respuesta principal (tabla responses)
    let responseData: any = null
    let responseError: any = null
    const maxRetries = 2
    let attemptedPayload = { ...insertPayload }
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const resAttempt = await supabase.from('responses').insert(attemptedPayload).select().single()
      responseData = resAttempt.data
      responseError = resAttempt.error
      if (!responseError) break
      // Si hay error por columnas faltantes, los removemos y reintentamos
      const msg = responseError.message || ''
      const missingCols: string[] = []
      const regex = /Could not find the '([^']+)' column/gi
      let m: RegExpExecArray | null
      while ((m = regex.exec(msg)) !== null) {
        if (m[1]) missingCols.push(m[1])
      }
      if (missingCols.length === 0) break
      missingCols.forEach((c) => {
        if (c in attemptedPayload) {
          delete attemptedPayload[c]
          console.warn(`Removing missing column from payload before retry: ${c}`)
        }
      })
    }

    if (responseError) {
      // Carrera de idempotencia: dos requests con la misma client_submission_id
      // llegaron casi al mismo tiempo (p.ej. doble tap que alcanzó a pasar la
      // verificación previa antes de que el primer insert terminara). El
      // índice único responses_client_submission_id_unique
      // (sql/2026_07_responses_idempotency.sql) rechaza el segundo insert con
      // 23505 — en vez de devolver error al usuario, buscamos la fila que sí
      // se creó y la devolvemos como si fuera la respuesta de este request.
      if (responseError.code === '23505' && typeof client_submission_id === 'string' && client_submission_id.trim().length > 0) {
        const { data: raced } = await (supabase as any)
          .from('responses')
          .select('id')
          .eq('survey_id', survey_id)
          .eq('client_submission_id', client_submission_id)
          .maybeSingle()
        if (raced?.id) {
          return NextResponse.json({
            success: true,
            message: 'Respuesta ya registrada (envío duplicado detectado)',
            response_id: raced.id,
            duplicate: true,
          })
        }
      }
      console.error('Error al crear respuesta después de reintentos:', responseError)
      return NextResponse.json({ error: responseError.message || 'Error creando respuesta', details: responseError }, { status: 500 })
    }

    if (!responseData || !responseData.id) {
      console.error('Insert returned no responseData', responseData)
      return NextResponse.json({ error: 'Insert no devolvió id de respuesta', details: responseData }, { status: 500 })
    }

    // ---------------------------------------------------------------
    // Insertar respuestas individuales en la tabla answers
    // ---------------------------------------------------------------
    const answersToInsert: any[] = []
    const skipped: any[] = []
    const candidateQuestionIds: string[] = []
    for (const answer of effectiveAnswers) {
      const qid = answer.question_id
      if (typeof qid !== 'string') {
        skipped.push({ reason: 'question_id_not_string', original: answer })
        continue
      }
      candidateQuestionIds.push(qid)
      answersToInsert.push({
        response_id: responseData.id,
        question_id: qid,
        value: answer.value === undefined ? null : (typeof answer.value === 'object' ? answer.value : { value: answer.value }),
      })
    }

    // Validar que todos los question_id existan en la encuesta
    if (answersToInsert.length > 0) {
      const { data: existingQuestions, error: qError } = await supabase
        .from('questions')
        .select('id')
        .eq('survey_id', survey_id)
        .in('id', Array.from(new Set(candidateQuestionIds)))
      if (qError) {
        console.error('❌ Error validating question IDs:', qError)
      } else {
        const existingIds = new Set((existingQuestions || []).map((q: any) => q.id))
        const invalidAnswers = answersToInsert.filter(a => !existingIds.has(a.question_id))
        if (invalidAnswers.length > 0) {
          console.error('❌ Invalid question_ids detected (not found in survey):', {
            invalid: invalidAnswers.map(a => a.question_id).slice(0, 5),
            invalidCount: invalidAnswers.length,
            surveyId: survey_id,
          })
          // Filtrar los inválidos
          answersToInsert.splice(0, answersToInsert.length, ...answersToInsert.filter(a => existingIds.has(a.question_id)))
          invalidAnswers.forEach(a => {
            skipped.push({ reason: 'question_id_not_in_survey', question_id: a.question_id })
          })
        }
      }
    }

    if (answersToInsert.length > 0) {
      const { error: answersError } = await supabase.from('answers').insert(answersToInsert)
      if (answersError) {
        console.error('❌ Error al guardar answers:', {
          error: answersError,
          attemptedCount: answersToInsert.length,
          skippedCount: skipped.length,
          skipped: skipped.slice(0, 5),
        })
        if (answersError.code === '23503' || answersError.message?.includes('foreign key')) {
          console.error('🔗 Foreign key constraint violation - some question_ids may not exist in the database')
          console.error('Attempted question_ids:', answersToInsert.map(a => a.question_id).slice(0, 5))
        }
        // Intentar limpiar la respuesta principal si falla la inserción de answers
        try {
          await supabase.from('responses').delete().eq('id', responseData.id)
        } catch (delErr) {
          console.error('Error al eliminar respuesta fallida:', delErr)
        }
        return NextResponse.json({
          error: answersError.message || 'Error guardando answers',
          details: answersError,
          attempted_count: answersToInsert.length,
          skipped_count: skipped.length,
          diagnostic: 'Check if all question_ids exist in the questions table',
        }, { status: 500 })
      }
    }

    if (skipped.length > 0) {
      return NextResponse.json({ success: true, message: 'Respuesta guardada, pero algunas respuestas fueron omitidas', skipped_count: skipped.length, skipped }, { status: 200 })
    }

    return NextResponse.json({
      success: true,
      message: "Respuesta guardada correctamente",
      response_id: responseData.id,
    })
  } catch (error) {
    console.error('Error al guardar respuesta:', error)
    return NextResponse.json({ error: "Error al guardar la respuesta" }, { status: 500 })
  }
}
