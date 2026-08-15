import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/api-auth"
import { createAdminSupabase } from "@/lib/supabase-server"

// GET /api/survey-questions?surveyId=xxx
// Devuelve las preguntas de una encuesta para el selector del modal de compartir
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(["admin", "supervisor"])
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const surveyId = searchParams.get("surveyId")

    if (!surveyId || surveyId === "all") {
      return NextResponse.json({ questions: [] })
    }

    const admin = createAdminSupabase()

    // Traer preguntas con al menos 1 respuesta para esta encuesta
    const { data, error } = await admin
      .from("questions")
      .select("id, text, type, section_id, order_index")
      .eq("survey_id", surveyId)
      .order("order_index", { ascending: true })

    if (error) {
      console.error("[survey-questions] error:", error)
      return NextResponse.json({ questions: [] })
    }

    return NextResponse.json({ questions: data ?? [] })
  } catch (err) {
    console.error("[survey-questions] unexpected error:", err)
    return NextResponse.json({ questions: [] })
  }
}
