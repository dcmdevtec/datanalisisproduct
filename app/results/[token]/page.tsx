import type { Metadata } from "next"
import { createAdminSupabase } from "@/lib/supabase-server"
import ResultsClient from "./ResultsClient"

// Server Component — SOLO para generar los meta tags Open Graph (rich
// preview de WhatsApp/Slack/etc.) a partir del título e imagen que se
// configuraron al compartir (ver components/reports/share-report-modal.tsx).
// Esto no puede hacerse desde ResultsClient.tsx porque es "use client": los
// crawlers de esas plataformas leen el HTML inicial de la respuesta del
// servidor, no lo que React inyecta después en el navegador.
export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params
  const admin = createAdminSupabase()

  const { data: share } = await (admin as any)
    .from("shared_reports")
    .select("survey_id, config")
    .eq("token", token)
    .maybeSingle()

  if (!share) {
    return { title: "Reporte no encontrado — Datanalisis" }
  }

  const config = share.config || {}
  let surveyTitle = config.surveyTitle || "Encuesta"
  if (!config.surveyTitle && share.survey_id) {
    const { data: survey } = await admin.from("surveys").select("title").eq("id", share.survey_id).maybeSingle()
    if (survey?.title) surveyTitle = survey.title
  }
  const title = config.customTitle || surveyTitle
  const description = config.surveyDescription || "Reporte de encuesta compartido — Datanalisis"
  const imageUrl: string | null = config.imageUrl || null

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  }
}

export default function PublicResultsPage() {
  return <ResultsClient />
}
