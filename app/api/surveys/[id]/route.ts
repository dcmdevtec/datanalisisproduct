import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

// Cliente SSR de Supabase (sin helpers de nextjs)
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient<Database>(supabaseUrl, supabaseKey)
}

// GET encuesta por ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseClient()
  try {
    const id = params.id
    console.log(`GET /api/surveys/${id} - Obteniendo encuesta`)

    // Si necesitas validar usuario, hazlo aquí con JWT o session, o elimina este check si no es necesario

    const { data, error } = await supabase
      .from("surveys")
      .select(`
    *, 
    questions (*),
    projects (
      id,
      name,
      companies (
        name,
        logo
      )
    )
  `)
      .eq("id", id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 })

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error en GET:", error)
    return NextResponse.json({ error: "Error al obtener la encuesta" }, { status: 500 })
  }
}

// PUT actualizar encuesta
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseClient()
  try {
    const id = params.id
    console.log(`PUT /api/surveys/${id} - Actualizando encuesta`)

    const body = await request.json()
    const { title, description, questions, settings, deadline, status } = body

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const { data: existingSurvey, error: surveyCheckError } = await supabase
      .from("surveys")
      .select("id, created_by")
      .eq("id", id)
      .single()

    if (surveyCheckError) return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 })

    const { data: updatedSurvey, error: updateError } = await supabase
      .from("surveys")
      .update({
        title,
        description,
        settings,
        deadline,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    if (questions?.length > 0) {
      const { error: deleteError } = await supabase.from("questions").delete().eq("survey_id", id)

      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

      const questionsToInsert = questions.map((q: any, i: any) => ({
        survey_id: id,
        type: q.type,
        text: q.text,
        options: q.options || [],
        required: q.required || false,
        order_num: i + 1,
        settings: q.settings || {},
      }))

      const { error: insertError } = await supabase.from("questions").insert(questionsToInsert)

      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const { data: completeData, error: completeError } = await supabase
      .from("surveys")
      .select(`*, questions (*)`)
      .eq("id", id)
      .single()

    if (completeError) return NextResponse.json({ error: completeError.message }, { status: 500 })

    return NextResponse.json(completeData)
  } catch (error) {
    console.error("Error en PUT:", error)
    return NextResponse.json({ error: "Error al actualizar la encuesta" }, { status: 500 })
  }
}

// DELETE encuesta
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseClient()
  try {
    const id = params.id
    console.log(`DELETE /api/surveys/${id} - Eliminando encuesta`)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

    const { data: existingSurvey, error: surveyCheckError } = await supabase
      .from("surveys")
      .select("id, created_by")
      .eq("id", id)
      .single()

    if (surveyCheckError) return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 })

    const { error: questionsError } = await supabase.from("questions").delete().eq("survey_id", id)

    if (questionsError) return NextResponse.json({ error: questionsError.message }, { status: 500 })

    const { error: deleteError } = await supabase.from("surveys").delete().eq("id", id)

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error en DELETE:", error)
    return NextResponse.json({ error: "Error al eliminar la encuesta" }, { status: 500 })
  }
}
