import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { resolveCurrentSurveyor } from "@/lib/portal-encuestador/auth"
import { resolveClientInstant } from "@/lib/portal-encuestador/client-time"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Crea un nuevo segmento de grabación (metadata primero, el audio se sube
// después vía PATCH /recordings/[id] cuando el segmento termina).
//
// IMPORTANTE: scope='survey' NO requiere responseId al crear el segmento.
// El motor de encuestas (app/preview/survey/page.tsx) solo genera la fila
// en `responses` cuando el encuestador ENVÍA la encuesta (no al abrirla),
// así que grabamos la encuesta desde que se abre sin saber todavía su
// response_id, y lo asociamos al cerrar el segmento (PATCH .../[id]) una
// vez que la respuesta ya se guardó o se registró el abandono/incidencia.
export async function POST(request: NextRequest) {
  try {
    const surveyor = await resolveCurrentSurveyor()
    if (!surveyor) {
      return NextResponse.json({ error: "No autorizado o encuestador no vinculado" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { shiftId, scope, responseId, id, startedAt, clientNow } = body as {
      shiftId?: string
      scope?: string
      responseId?: string
      id?: string
      startedAt?: number
      clientNow?: number
    }

    if (!shiftId || (scope !== "shift" && scope !== "survey")) {
      return NextResponse.json({ error: "shiftId y scope ('shift'|'survey') son requeridos" }, { status: 400 })
    }
    if (id !== undefined && (typeof id !== "string" || !UUID_RE.test(id))) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 })
    }

    // surveyor_shifts / surveyor_recordings son tablas nuevas (ver
    // sql/2026_07_surveyor_portal.sql), aún no presentes en los tipos generados
    // de Supabase — se castea a any en este archivo.
    const admin = createAdminSupabase() as any

    // Ítem 26/11/2026 ("que no se pierdan los audios"): el portal ahora
    // genera el id del segmento en el teléfono y arranca a grabar sin
    // esperar a la red; este registro puede llegar tarde (sin señal) o
    // repetirse (reintento) — si el id ya existe para este encuestador, se
    // devuelve tal cual.
    if (id) {
      const { data: existing } = await admin
        .from("surveyor_recordings")
        .select("id, started_at, surveyor_id")
        .eq("id", id)
        .maybeSingle()
      if (existing) {
        if (existing.surveyor_id !== surveyor.surveyorId) {
          return NextResponse.json({ error: "Segmento de otro encuestador" }, { status: 409 })
        }
        return NextResponse.json({ recordingId: existing.id, startedAt: existing.started_at })
      }
    }

    // Verifica que el turno pertenezca a este encuestador y siga activo.
    const { data: shift } = await admin
      .from("surveyor_shifts")
      .select("id, status")
      .eq("id", shiftId)
      .eq("surveyor_id", surveyor.surveyorId)
      .maybeSingle()
    if (!shift) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
    }

    const { data: created, error } = await admin
      .from("surveyor_recordings")
      .insert([{
        ...(id ? { id } : {}),
        shift_id: shiftId,
        surveyor_id: surveyor.surveyorId,
        response_id: scope === "survey" ? responseId : null,
        scope,
        started_at: resolveClientInstant(startedAt, clientNow),
        upload_status: "pending",
      }])
      .select("id, started_at")
      .single()

    if (error || !created) {
      console.error("Error creando segmento de grabación:", error)
      return NextResponse.json({ error: "No se pudo iniciar la grabación" }, { status: 500 })
    }

    return NextResponse.json({ recordingId: created.id, startedAt: created.started_at })
  } catch (error) {
    console.error("Error en portal-encuestador/recordings POST:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
