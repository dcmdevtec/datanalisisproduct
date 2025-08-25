import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import type { Database } from "@/types/supabase" // Asegúrate de definir este tipo si usas TS
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

// Cliente de Supabase autenticado por SSR
function getSupabaseClient() {
  const cookieStore = cookies()
  return createRouteHandlerClient<Database>({
    cookies: () => cookieStore,
  })
}
export async function GET(request: Request) {
  const supabase = getSupabaseClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { data: userInfo, error: userError } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (userError) {
    return NextResponse.json({ error: "Error al obtener rol" }, { status: 500 })
  }

  let query = supabase.from("surveys").select("*, questions(*)").order("created_at", { ascending: false })

  if (!["admin", "supervisor"].includes(userInfo.role)) {
    query = query.eq("created_by", user.id)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = getSupabaseClient()
  const body = await request.json()
  const { title, description, questions, settings, deadline } = body

  if (!title || !title.trim()) {
    return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 })
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { data: userInfo, error: userError } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (userError) {
    return NextResponse.json({ error: "Error al verificar permisos" }, { status: 500 })
  }

  const logo = settings?.branding?.logo || null

  const { data: surveyData, error: surveyError } = await supabase
    .from("surveys")
    .insert({
      title,
      description,
      settings: settings || {
        collectLocation: true,
        allowAudio: false,
        offlineMode: true,
        distributionMethods: ["app"],
      },
      logo, // Save logo field separately
      deadline: deadline || null,
      created_by: user.id,
      status: "draft",
    })
    .select()
    .single()

  if (surveyError) {
    return NextResponse.json({ error: surveyError.message }, { status: 500 })
  }

  if (questions && questions.length > 0) {
    const questionsToInsert = questions.map((q: any, i: number) => ({
      survey_id: surveyData.id,
      type: q.type,
      text: q.text,
      options: q.options || [],
      required: q.required || false,
      order_num: i + 1,
      settings: q.settings || {},
    }))

    const { error: questionsError } = await supabase.from("questions").insert(questionsToInsert)

    if (questionsError) {
      await supabase.from("surveys").delete().eq("id", surveyData.id)
      return NextResponse.json({ error: questionsError.message }, { status: 500 })
    }
  }

  const { data: completeData, error: finalError } = await supabase
    .from("surveys")
    .select("*, questions(*)")
    .eq("id", surveyData.id)
    .single()

  if (finalError) {
    return NextResponse.json({ error: finalError.message }, { status: 500 })
  }

  return NextResponse.json(completeData)
}

export async function PUT(request: Request) {
  const supabase = getSupabaseClient()
  const body = await request.json()
  const { id, title, description, questions, settings, deadline, status } = body

  if (!id) {
    return NextResponse.json({ error: "ID de encuesta requerido" }, { status: 400 })
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { data: userInfo, error: userError } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (userError) {
    return NextResponse.json({ error: "Error al verificar permisos" }, { status: 500 })
  }

  const { data: existingSurvey, error: checkError } = await supabase
    .from("surveys")
    .select("id, created_by")
    .eq("id", id)
    .single()

  if (checkError || !existingSurvey) {
    return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 })
  }

  const isOwner = existingSurvey.created_by === user.id
  const isAdmin = ["admin", "supervisor"].includes(userInfo.role)

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "No tienes permiso para modificar esta encuesta" }, { status: 403 })
  }

  const logo = settings?.branding?.logo || null

  const { data: updatedSurvey, error: updateError } = await supabase
    .from("surveys")
    .update({
      title,
      description,
      settings,
      logo, // Save logo field separately
      deadline,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Opcional: podrías eliminar y reinsertar preguntas actualizadas aquí si es necesario

  return NextResponse.json(updatedSurvey)
}
