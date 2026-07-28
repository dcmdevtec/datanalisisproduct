import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

function getSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => {
          try {
            cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )
}

/**
 * GET /api/messages?userId=UUID&with=UUID&limit=50
 *
 * Devuelve los mensajes del usuario autenticado.
 * - Si se pasa `with`, filtra la conversación entre userId y with.
 * - Si no, devuelve todos los mensajes del usuario (directos + broadcast).
 * Ordena por timestamp ASC para renderizar en orden cronológico.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get("userId")
    const withUser = url.searchParams.get("with")
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 200)

    if (!userId) {
      return NextResponse.json({ error: "Se requiere userId" }, { status: 400 })
    }

    const supabase = getSupabase()

    let query = supabase
      .from("messages")
      .select("id, sender_id, receiver_id, content, created_at, read, message_type")
      .order("created_at", { ascending: true })
      .limit(limit)

    if (withUser) {
      // Conversación directa entre dos usuarios
      query = query.or(
        `and(sender_id.eq.${userId},receiver_id.eq.${withUser}),and(sender_id.eq.${withUser},receiver_id.eq.${userId})`
      )
    } else {
      // Todos los mensajes del usuario + broadcasts
      query = query.or(`sender_id.eq.${userId},receiver_id.eq.${userId},message_type.eq.broadcast`)
    }

    const { data, error } = await query

    if (error) {
      // CORRECCIÓN (revisión previa a puesta en uso): antes esto devolvía []
      // con 200 para CUALQUIER error de Supabase, no solo "la tabla no
      // existe". Eso hacía que un error real (RLS mal configurado, columna
      // renombrada, etc.) se viera exactamente igual que "no hay mensajes"
      // — imposible de distinguir desde la UI o los logs del cliente. Ahora
      // solo se hace fallback silencioso para 42P01 (relation does not
      // exist, es decir la migración db/migrations/2026-05-05_create_messages.sql
      // no se ha corrido todavía); cualquier otro error se propaga como 500
      // para que sea visible.
      if (error.code === "42P01") {
        console.warn("[messages] Tabla 'messages' no existe aún — devolviendo lista vacía. Ejecutar db/migrations/2026-05-05_create_messages.sql")
        return NextResponse.json([], { status: 200 })
      }
      console.error("[messages] Supabase error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Mapear al formato que espera la UI (sender/receiver en vez de sender_id/receiver_id)
    const mapped = (data ?? []).map((m: any) => ({
      id: m.id,
      sender: m.sender_id,
      receiver: m.receiver_id ?? "all",
      content: m.content,
      timestamp: m.created_at,
      read: m.read ?? false,
      message_type: m.message_type ?? "direct",
    }))

    return NextResponse.json(mapped)
  } catch (err: any) {
    console.error("[messages] GET error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/messages
 * Body: { sender: UUID, receiver: UUID | "all", content: string, message_type?: "direct"|"broadcast" }
 *
 * Guarda un mensaje en Supabase y devuelve el registro creado.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sender, receiver, content, message_type = "direct" } = body

    if (!sender || !content?.trim()) {
      return NextResponse.json({ error: "sender y content son requeridos" }, { status: 400 })
    }

    const supabase = getSupabase()

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: sender,
        receiver_id: receiver === "all" ? null : receiver,
        content: content.trim(),
        message_type,
        read: false,
      })
      .select("id, sender_id, receiver_id, content, created_at, read, message_type")
      .single()

    if (error) {
      console.error("[messages] POST insert error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      id: data.id,
      sender: data.sender_id,
      receiver: data.receiver_id ?? "all",
      content: data.content,
      timestamp: data.created_at,
      read: data.read,
      message_type: data.message_type,
    })
  } catch (err: any) {
    console.error("[messages] POST error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/messages
 * Body: { ids: string[], read: boolean }
 *
 * Marca mensajes como leídos/no leídos.
 */
export async function PATCH(request: Request) {
  try {
    const { ids, read } = await request.json()

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array requerido" }, { status: 400 })
    }

    const supabase = getSupabase()

    const { error } = await supabase
      .from("messages")
      .update({ read })
      .in("id", ids)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, updated: ids.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
