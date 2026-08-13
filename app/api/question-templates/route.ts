import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          try { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options as any)) } catch {}
        },
      },
    }
  )
}

/**
 * GET /api/question-templates?q=texto&limit=8&category=Demografía
 *
 * Busca plantillas de preguntas por texto, tags y categoría.
 * Ordena por uso (use_count DESC) para mostrar las más populares primero.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get("q") ?? "").trim()
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "8", 10), 30)
    const category = searchParams.get("category") ?? ""

    if (q.length < 2) {
      return NextResponse.json({ data: [], error: null })
    }

    const supabase = await getSupabase()

    // Búsqueda por similitud de texto con pg_trgm + filtro por tags (contains)
    // Usamos ilike para compatibilidad sin requerir configuración extra de FTS
    let query = supabase
      .from("question_templates")
      .select("id, text, type, category, tags, options, use_count")
      .eq("is_active", true)
      .or(`text.ilike.%${q}%,category.ilike.%${q}%`)
      .order("use_count", { ascending: false })
      .limit(limit)

    if (category) {
      query = query.eq("category", category)
    }

    const { data, error } = await query

    if (error) {
      // Fallback: si la tabla no existe aún, devuelve arreglo vacío (el cliente usa el fallback estático)
      console.warn("[question-templates] Supabase error:", error.message)
      return NextResponse.json({ data: [], error: error.message }, { status: 200 })
    }

    // También incluir resultados donde el texto de búsqueda coincide con algún tag
    // (Supabase no soporta contains en arrays con ilike, así que hacemos un segundo query)
    let tagResults: any[] = []
    if ((data?.length ?? 0) < limit) {
      const remaining = limit - (data?.length ?? 0)
      const existingIds = (data ?? []).map((r: any) => r.id)

      let tagQuery = supabase
        .from("question_templates")
        .select("id, text, type, category, tags, options, use_count")
        .eq("is_active", true)
        .contains("tags", [q.toLowerCase()])
        .order("use_count", { ascending: false })
        .limit(remaining)

      if (existingIds.length > 0) {
        tagQuery = tagQuery.not("id", "in", `(${existingIds.join(",")})`)
      }

      const { data: tagData } = await tagQuery
      tagResults = tagData ?? []
    }

    const combined = [...(data ?? []), ...tagResults]
    return NextResponse.json({ data: combined, error: null })
  } catch (err: any) {
    console.error("[question-templates] Unexpected error:", err)
    return NextResponse.json({ data: [], error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/**
 * POST /api/question-templates/increment
 * Body: { id: string }
 *
 * Incrementa use_count de una plantilla cuando se aplica al editor.
 * Llamado en segundo plano (fire-and-forget) desde el cliente.
 */
export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 })

    const supabase = await getSupabase()

    // Incremento atómico con rpc o update
    const { error } = await supabase.rpc("increment_question_template_use_count", { template_id: id })

    if (error) {
      // Fallback silencioso si la función RPC aún no existe en esta instancia
      console.warn("[question-templates] increment rpc error (ignored):", error.message)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 })
  }
}
