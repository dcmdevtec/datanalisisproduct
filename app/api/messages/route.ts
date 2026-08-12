import { NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { resolveAuthedUser, resolveAllowedMessageReceivers } from "@/lib/api-auth"

// CORRECCIÓN (2026-08-12): el helper getSupabase() original llamaba cookies()
// sin await — en Next.js 15, cookies() es una Promise. El cliente resultante
// quedaba sin sesión, RLS bloqueaba TODAS las queries (inbox vacío, envío falla
// con error 500). Mismo patrón corregido en /api/location y /api/tracking.
// Auth ya está verificado por resolveAuthedUser() (que sí awaita cookies),
// así que es seguro usar createAdminSupabase() para las operaciones de datos.
function getSupabase() {
  return createAdminSupabase()
}

/**
 * GET /api/messages?with=UUID&limit=50
 *
 * Devuelve los mensajes del usuario AUTENTICADO (sesión, no un parámetro de
 * la URL — ver nota de seguridad abajo).
 * - Si se pasa `with`, filtra la conversación entre el usuario y `with`.
 * - Si no, devuelve todos los mensajes del usuario (directos + broadcast).
 * Ordena por timestamp ASC para renderizar en orden cronológico.
 *
 * SEGURIDAD (auditoría 2026-07-29): antes `userId` venía del query string sin
 * verificar sesión — cualquiera podía leer los mensajes de cualquier otro
 * usuario pasando su UUID (IDOR). Ahora el usuario siempre sale de la
 * cookie de sesión; el parámetro `userId` ya no se usa para nada.
 */
export async function GET(request: Request) {
  try {
    const authedUser = await resolveAuthedUser()
    if (!authedUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    const userId = authedUser.id

    const url = new URL(request.url)
    const withUser = url.searchParams.get("with")
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 200)

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
 * Body: { receiver: UUID | "all", content: string, message_type?: "direct"|"broadcast" }
 *
 * Guarda un mensaje en Supabase y devuelve el registro creado. `sender`
 * sale de la sesión, nunca del body (ver nota de seguridad).
 *
 * SEGURIDAD (auditoría 2026-07-29): antes `sender` venía del body sin
 * verificar — cualquiera podía enviar mensajes SUPLANTANDO a cualquier otro
 * usuario, y `receiver` no se validaba contra ningún set de contactos
 * permitido (un encuestador podía escribirle a otro encuestador pese a que
 * la UI del portal solo muestra supervisor+admins). Ahora:
 *   - sender = usuario de la sesión, siempre.
 *   - receiver = "all" (broadcast) solo permitido para admin/supervisor.
 *   - receiver = un usuario puntual: debe estar en la lista de contactos
 *     permitidos para el rol del remitente (resolveAllowedMessageReceivers).
 */
export async function POST(request: Request) {
  try {
    const authedUser = await resolveAuthedUser()
    if (!authedUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const { receiver, content, message_type = "direct" } = body

    if (!receiver || !content?.trim()) {
      return NextResponse.json({ error: "receiver y content son requeridos" }, { status: 400 })
    }

    if (receiver === "all") {
      if (authedUser.role !== "admin" && authedUser.role !== "supervisor") {
        return NextResponse.json({ error: "No tienes permiso para publicar anuncios" }, { status: 403 })
      }
    } else {
      const allowed = await resolveAllowedMessageReceivers(authedUser)
      if (!allowed.any && !allowed.ids.includes(receiver)) {
        return NextResponse.json({ error: "No puedes enviar mensajes a este usuario" }, { status: 403 })
      }
    }

    const supabase = getSupabase()

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: authedUser.id,
        receiver_id: receiver === "all" ? null : receiver,
        content: content.trim(),
        message_type: receiver === "all" ? "broadcast" : message_type,
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
 * Marca mensajes como leídos/no leídos. Solo puede marcar mensajes donde
 * el usuario autenticado es el RECEPTOR (antes no se validaba nada — ver
 * nota de seguridad: cualquiera podía marcar como leído/no leído mensajes
 * de cualquier otra persona).
 */
export async function PATCH(request: Request) {
  try {
    const authedUser = await resolveAuthedUser()
    if (!authedUser) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { ids, read } = await request.json()

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array requerido" }, { status: 400 })
    }

    const supabase = getSupabase()

    const { error, count } = await supabase
      .from("messages")
      .update({ read })
      .in("id", ids)
      .eq("receiver_id", authedUser.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, updated: count ?? ids.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
