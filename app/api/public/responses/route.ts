import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Admin client que bypasea RLS — SOLO se usa en server-side
function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Validar que un string sea UUID v4
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

/**
 * POST /api/public/responses
 * 
 * Endpoint público para enviar respuestas de encuestas SIN autenticación.
 * Usado por la página pública /encuesta/[id].
 * 
 * Body esperado:
 * {
 *   survey_id: string (UUID),
 *   answers: Array<{ question_id: string, value: any }>,
 *   respondent_document_type?: string,
 *   respondent_document_number?: string,
 *   respondent_name?: string,
 *   public_respondent_id?: string,
 *   location?: { lat: number, lng: number }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminSupabase()
    const body = await request.json()

    const {
      survey_id,
      answers,
      respondent_document_type,
      respondent_document_number,
      respondent_name,
      public_respondent_id,
      location,
      started_at,
    } = body

    // --- Validaciones ---
    if (!survey_id || !isValidUUID(survey_id)) {
      return NextResponse.json({ error: "ID de encuesta inválido" }, { status: 400 })
    }

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json({ error: "Se requieren respuestas" }, { status: 400 })
    }

    // Validar que cada answer tenga question_id válido
    for (const answer of answers) {
      if (!answer.question_id || !isValidUUID(answer.question_id)) {
        return NextResponse.json(
          { error: `question_id inválido: ${answer.question_id}` },
          { status: 400 }
        )
      }
    }

    // --- Verificar que la encuesta existe y está activa ---
    const { data: survey, error: surveyError } = await supabase
      .from("surveys")
      .select("id, status, settings, security_config")
      .eq("id", survey_id)
      .single()

    if (surveyError || !survey) {
      return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 })
    }

    if (survey.status !== "active") {
      return NextResponse.json(
        { error: "Esta encuesta no está disponible para respuestas" },
        { status: 403 }
      )
    }

    // --- Buscar/crear public_respondent si hay datos de contacto ---
    let resolvedRespondentId = public_respondent_id || null

    // Si se envía contact_info en las answers, extraer datos
    const questionIds = answers.map((a: { question_id: string }) => a.question_id).filter(Boolean)
    const { data: contactQuestions } = await supabase
      .from("questions")
      .select("id, type")
      .in("id", questionIds)
      .eq("type", "contact_info")

    if (contactQuestions && contactQuestions.length > 0) {
      const contactAnswer = answers.find(
        (a: { question_id: string }) => a.question_id === contactQuestions[0].id
      )
      if (contactAnswer?.value) {
        const val = contactAnswer.value
        const docType = val.documentType || respondent_document_type
        const docNum = val.documentNumber || respondent_document_number
        if (docType && docNum) {
          const fullName =
            val.fullName ||
            [val.firstName, val.lastName].filter(Boolean).join(" ").trim() ||
            respondent_name ||
            ""

          const { data: upsertData } = await supabase
            .from("public_respondents")
            .upsert(
              {
                survey_id,
                document_type: docType,
                document_number: docNum,
                full_name: fullName,
                email: val.email || null,
                phone: val.phone || null,
                address: val.address || null,
                company: val.company || null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "survey_id,document_type,document_number", ignoreDuplicates: false }
            )
            .select("id")
            .single()

          if (upsertData) {
            resolvedRespondentId = upsertData.id
          }
        }
      }
    }

    // --- Insertar respuesta principal ---
    const responsePayload: Record<string, unknown> = {
      survey_id,
      respondent_id: null, // Sin usuario autenticado
      public_respondent_id: resolvedRespondentId,
      respondent_document_type: respondent_document_type || null,
      respondent_document_number: respondent_document_number || null,
      respondent_name: respondent_name || null,
      location: location || null,
      status: "completed",
      completed_at: new Date().toISOString(),
      ...(typeof started_at === "string" && started_at.trim().length > 0 ? { started_at } : {}),
    }

    let { data: responseData, error: responseError } = await supabase
      .from("responses")
      .insert(responsePayload)
      .select("id")
      .single()

    // Fallback: si la columna started_at aún no existe en la BD (migración
    // pendiente), reintenta sin ella en vez de tumbar el envío de la encuesta.
    if (responseError && "started_at" in responsePayload && /started_at/i.test(responseError.message || "")) {
      delete (responsePayload as Record<string, unknown>).started_at
      ;({ data: responseData, error: responseError } = await supabase
        .from("responses")
        .insert(responsePayload)
        .select("id")
        .single())
    }

    if (responseError || !responseData) {
      console.error("Error al crear respuesta pública:", responseError)
      return NextResponse.json(
        { error: "Error al guardar la respuesta" },
        { status: 500 }
      )
    }

    // --- Insertar answers individuales ---
    const answersToInsert = answers
      .filter((a: { question_id: string }) => isValidUUID(a.question_id))
      .map((a: { question_id: string; value: unknown }) => ({
        response_id: responseData.id,
        question_id: a.question_id,
        value: a.value !== undefined ? a.value : null,
      }))

    if (answersToInsert.length > 0) {
      const { error: answersError } = await supabase
        .from("answers")
        .insert(answersToInsert)

      if (answersError) {
        console.error("Error al insertar answers:", answersError)
        // La respuesta principal ya se creó, logueamos pero no fallamos
      }
    }

    // --- Actualizar tracking si existe ---
    if (resolvedRespondentId) {
      await supabase
        .from("survey_respondent_tracking")
        .upsert(
          {
            survey_id,
            respondent_public_id: resolvedRespondentId,
            response_id: responseData.id,
            status: "completed",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "survey_id,respondent_public_id" }
        )
        .select()
    }

    return NextResponse.json({
      success: true,
      response_id: responseData.id,
      message: "Respuesta guardada correctamente",
    })
  } catch (error) {
    console.error("Error en POST /api/public/responses:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
