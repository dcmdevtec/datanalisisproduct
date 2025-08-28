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
        user_id,
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
    const { survey_id, answers, location, device_info } = body

    if (!survey_id) {
      return NextResponse.json({ error: "ID de encuesta requerido" }, { status: 400 })
    }

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json({ error: "Se requieren respuestas" }, { status: 400 })
    }

    // Obtener usuario actual
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Crear respuesta principal
    const { data: responseData, error: responseError } = await supabase
      .from("responses")
      .insert({
        survey_id,
        user_id: session?.user?.id || null,
        location: location || null,
        device_info: device_info || null,
        status: "completed",
      })
      .select()
      .single()

    if (responseError) {
      console.error("Error al crear respuesta:", responseError)
      return NextResponse.json({ error: responseError.message }, { status: 500 })
    }

    // Crear respuestas individuales
    const answersToInsert = answers.map((answer) => ({
      response_id: responseData.id,
      question_id: answer.question_id,
      answer_value: answer.value,
      answer_type: answer.type || "text",
    }))

    const { error: answersError } = await supabase.from("response_answers").insert(answersToInsert)

    if (answersError) {
      console.error("Error al guardar respuestas:", answersError)
      // Si hay error al guardar respuestas, eliminar la respuesta principal
      await supabase.from("responses").delete().eq("id", responseData.id)
      return NextResponse.json({ error: answersError.message }, { status: 500 })
    }

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
