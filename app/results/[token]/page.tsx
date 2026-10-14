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
  const { token: rawToken } = await params
  // Ítem 14/10/2026: ver el mismo comentario en
  // app/api/public-report/[token]/route.ts — el link puede traer
  // "-CODIGO" concatenado; el token real son los primeros 32 hex.
  const token = rawToken.slice(0, 32)
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
  // Seguimiento 13/10/2026 ("el logo sigue saliendo blanco"): esta página
  // define su PROPIO openGraph (generateMetadata), que reemplaza por
  // completo al del layout raíz en vez de heredarlo — así que cuando no
  // hay imagen de vista previa personalizada (config.imageUrl), este link
  // quedaba SIN ningún og:image, y WhatsApp caía al apple-touch-icon
  // (metadata.icons.apple en app/layout.tsx, /logo.png, la versión blanca)
  // como última alternativa. Se usa /opengraph-image.png (logo teal, mismo
  // archivo que ya corrige el preview del sitio general) como respaldo
  // explícito en vez de depender de esa herencia que no ocurre acá.
  const imageUrl: string = config.imageUrl || "/opengraph-image.png"

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  }
}

export default function PublicResultsPage() {
  return <ResultsClient />
}
