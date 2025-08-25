import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase-browser"

export async function GET(request: NextRequest) {
  try {
    console.log("GET /api/responses - Obteniendo respuestas")

    // Obtener parámetros de consulta
    const url = new URL(request.url)
    const surveyId = url.searchParams.get("surveyId")

    // Obtener la sesión del usuario para verificar autenticación
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      console.error("No hay sesión activa")
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    // Construir consulta base
    let query = supabase.from("responses").select(`
        *,
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

    console.log(`GET /api/responses - Se obtuvieron ${data?.length || 0} respuestas`)
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error al obtener respuestas:", error)
    return NextResponse.json({ error: "Error al obtener respuestas" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("POST /api/responses - Guardando respuesta")
    const body = await request.json()
    const { survey_id, answers, location, device_info } = body

    if (!survey_id) {
      return NextResponse.json({ error: "ID de encuesta requerido" }, { status: 400 })
    }

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json({ error: "Se requieren respuestas" }, { status: 400 })
    }

    console.log("Datos recibidos:", {
      survey_id,
      answersCount: answers?.length || 0,
      location: location ? "Proporcionada" : "No proporcionada",
      device_info: device_info ? "Proporcionada" : "No proporcionada",
    })

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

    console.log("Respuesta creada:", responseData.id)

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

    console.log("Respuestas guardadas correctamente")
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
