// Carga una encuesta desde la API y la deja lista en localStorage bajo la
// clave "surveyPreviewData", en el formato que espera el motor compartido
// SurveyPreviewPage (app/preview/survey/page.tsx).
//
// POR QUÉ EXISTE ESTE ARCHIVO:
// SurveyPreviewPage NUNCA hace fetch por su cuenta — en su montaje SIEMPRE
// lee localStorage.getItem("surveyPreviewData") y, si no encuentra nada,
// hace router.push("/") de inmediato (ver la línea ~288 de ese archivo).
// La única razón por la que /encuesta/[id] (el link público) funciona hoy es
// que app/encuesta/[id]/page.tsx hace exactamente este trabajo —
// fetch + transformar + localStorage.setItem — ANTES de montar
// <SurveyPreviewPage/>.
//
// Esta función extrae esa misma lógica (idéntica, línea por línea, a la de
// app/encuesta/[id]/page.tsx) para poder reutilizarla desde
// app/portal-encuestador/encuesta/[surveyId]/page.tsx, que hasta ahora
// montaba SurveyPreviewPage directo sin este paso — por eso al pulsar
// "Inicia encuesta" el encuestador terminaba expulsado a "/" (el efecto
// interno de SurveyPreviewPage no encontraba nada en localStorage).
//
// NO se tocó app/encuesta/[id]/page.tsx para no arriesgar el flujo público
// ya funcionando — este helper es código nuevo, aislado.
export async function loadSurveyIntoPreviewStorage(surveyId: string): Promise<
  { ok: true } | { ok: false; reason: "not_found" | "not_active" | "error"; message?: string }
> {
  try {
    const res = await fetch(`/api/surveys/${surveyId}`)
    if (!res.ok) {
      if (res.status === 404) return { ok: false, reason: "not_found" }
      return { ok: false, reason: "error", message: "Error al cargar la encuesta" }
    }
    const data = await res.json()

    if (data.status !== "active" && data.status !== "draft") {
      return { ok: false, reason: "not_active", message: "Esta encuesta no está activa actualmente." }
    }

    const rawSections: any[] = data.survey_sections || []
    const rawQuestions: any[] = data.questions || []

    const mapQuestion = (q: any) => ({
      id: q.id,
      type: q.type || "text",
      text: q.text || "",
      text_html: q.text_html,
      options: q.options || [],
      required: q.required ?? true,
      image: q.image || q.file_url,
      matrixRows: q.matrix_rows || q.settings?.matrixRows,
      matrixCols: q.matrix_cols || q.settings?.matrixCols,
      ratingScale: q.rating_scale || q.settings?.ratingScale || 5,
      config: {
        ...(q.settings || {}),
        ...(q.question_config || {}),
        displayLogic: q.display_logic || q.settings?.displayLogic || { enabled: false, conditions: [] },
        skipLogic: q.skip_logic || q.settings?.skipLogic || { enabled: false, rules: [] },
        validation: q.validation_rules || q.settings?.validation || { required: q.required ?? true },
      },
    })

    let sections: any[]
    if (rawSections.length > 0) {
      sections = rawSections
        .sort((a: any, b: any) => (a.order_num || 0) - (b.order_num || 0))
        .map((s: any) => ({
          id: s.id,
          title: s.title || "Sección",
          title_html: s.title_html,
          description: s.description,
          order_num: s.order_num || 0,
          questions: rawQuestions
            .filter((q: any) => q.section_id === s.id)
            .sort((a: any, b: any) => (a.order_num || 0) - (b.order_num || 0))
            .map(mapQuestion),
          skip_logic: s.skip_logic,
        }))
    } else if (rawQuestions.length > 0) {
      sections = [{
        id: "default",
        title: data.title || "Encuesta",
        order_num: 0,
        questions: rawQuestions
          .sort((a: any, b: any) => (a.order_num || 0) - (b.order_num || 0))
          .map(mapQuestion),
      }]
    } else {
      sections = []
    }

    const previewData = {
      title: data.title || "",
      description: data.description || "",
      startDate: data.start_date || "",
      deadline: data.deadline || "",
      sections,
      settings: {
        collectLocation: false,
        allowAudio: false,
        offlineMode: false,
        distributionMethods: [],
        ...(data.settings || {}),
        theme: data.theme_config || data.settings?.theme || undefined,
        branding: {
          showLogo: true,
          logoPosition: "top",
          ...(data.branding_config || data.settings?.branding || {}),
          logo: data.logo || data.branding_config?.logo || data.projects?.companies?.logo || null,
        },
        security: data.security_config || data.settings?.security || undefined,
      },
      projectData: data.projects ? {
        id: data.projects.id,
        name: data.projects.name,
        companies: data.projects.companies || null,
      } : null,
    }

    localStorage.setItem("surveyPreviewData", JSON.stringify(previewData))
    return { ok: true }
  } catch (err) {
    console.error("Error cargando encuesta en surveyPreviewData:", err)
    return { ok: false, reason: "error", message: "Error de conexión" }
  }
}
