import { NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { resolveCurrentSurveyor } from "@/lib/portal-encuestador/auth"

// Lista de encuestas del encuestador logueado — Y SOLO de él.
// La fuente de verdad es `survey_surveyor_zones` (survey_id, surveyor_id,
// zone_id, general_status): es la ÚNICA tabla a la que escribe la UI de
// administración al asignar encuestadores a zonas (ver
// app/projects/[id]/create-survey/page.tsx). La tabla `assignments` NO se
// usa aquí — históricamente ningún flujo del producto escribe en ella (ver
// sql/2026_07_fix_assignment_source_table.sql para el detalle completo).
// Si no hay una fila para este surveyor_id, la encuesta no aparece, sin
// importar si está activa o si otros encuestadores sí la tienen — esto es
// exactamente lo pedido: "no les debe aparecer una encuesta diferente si no
// la tienen asignada".
export async function GET() {
  try {
    const surveyor = await resolveCurrentSurveyor()
    if (!surveyor) {
      return NextResponse.json({ error: "No autorizado o encuestador no vinculado" }, { status: 401 })
    }

    const admin = createAdminSupabase()

    const { data: rows, error } = await admin
      .from("survey_surveyor_zones")
      .select("id, survey_id, zone_id, general_status, created_at, zones(id, name), surveys(id, title, description, status, deadline, logo, start_date)")
      .eq("surveyor_id", surveyor.surveyorId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching survey_surveyor_zones for surveyor portal:", error)
      return NextResponse.json({ error: "Error al cargar encuestas" }, { status: 500 })
    }

    // Un encuestador puede tener varias filas de zona para la MISMA
    // encuesta (una por cada zona a la que fue asignado, o una general con
    // zone_id null). El portal muestra una tarjeta por encuesta, no por
    // zona — se agrupan y se listan los nombres de zona juntos.
    const bySurvey = new Map<string, {
      surveyId: string; title: string; description: string | null; logo: string | null
      assignmentStatus: string; deadline: string | null; zoneNames: string[]
      isGeneral: boolean; zoneIds: string[]
    }>()

    for (const row of (rows as any[]) || []) {
      const survey = row.surveys
      if (!survey || survey.status !== "active") continue // solo encuestas activas en campo

      // CORRECCIÓN (2026-08-12): encuestas con fecha de inicio futura no deben
      // aparecer en el portal aunque su status sea "active". La plataforma admin
      // puede activar una encuesta antes de que empiece; el portal debe respetarlo.
      if (survey.start_date && new Date(survey.start_date) > new Date()) continue

      const existing = bySurvey.get(survey.id)
      const zoneName = row.general_status ? "Todas las zonas" : (row.zones?.name ?? "Sin zona asignada")

      if (existing) {
        if (!existing.zoneNames.includes(zoneName)) existing.zoneNames.push(zoneName)
        if (row.general_status) existing.isGeneral = true
        if (row.zone_id && !existing.zoneIds.includes(row.zone_id)) existing.zoneIds.push(row.zone_id)
      } else {
        bySurvey.set(survey.id, {
          surveyId: survey.id,
          title: survey.title,
          description: survey.description,
          logo: survey.logo,
          assignmentStatus: "assigned",
          deadline: row.zone_id ? null : (survey.deadline ?? null), // se completa abajo si aplica
          zoneNames: [zoneName],
          // isGeneral/zoneIds (fix 2026-07-29): espejo del bloqueo por zona
          // que ya existe en la APK (src/hooks/useZoneMonitoring.ts +
          // src/screens/SurveyListScreen.tsx en datapk) — si el encuestador
          // NO está asignado como "general" (general_status) para esta
          // encuesta, el portal solo debe dejarlo entrar si su ubicación
          // actual cae dentro de alguna de las zonas listadas aquí.
          isGeneral: !!row.general_status,
          zoneIds: row.zone_id ? [row.zone_id] : [],
        })
      }
      // deadline: preferir el de la encuesta si no hay uno específico por zona
      const entry = bySurvey.get(survey.id)!
      if (!entry.deadline) entry.deadline = survey.deadline ?? null
    }

    const items = Array.from(bySurvey.values()).map((s) => ({
      // El portal navega por surveyId (ver app/portal-encuestador/page.tsx y
      // app/portal-encuestador/encuesta/[surveyId]/page.tsx), así que no se
      // expone un "assignmentId" de lista — el endpoint de verificación de
      // propiedad (GET /api/portal-encuestador/assignments/[surveyId])
      // resuelve el id real que se necesita para grabar respuestas.
      surveyId: s.surveyId,
      title: s.title,
      description: s.description,
      logo: s.logo,
      zoneName: s.zoneNames.join(", "),
      assignmentStatus: s.assignmentStatus,
      deadline: s.deadline,
      isGeneral: s.isGeneral,
      zoneIds: s.zoneIds,
    }))

    return NextResponse.json({ surveyorName: surveyor.name, items })
  } catch (error) {
    console.error("Error en portal-encuestador/surveys API:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
