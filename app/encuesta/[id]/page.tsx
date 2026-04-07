"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import SurveyPreviewPage from "@/app/preview/survey/page"
import { Loader2, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

/**
 * Página pública /encuesta/[id]
 * Carga la encuesta desde la API, transforma los datos al formato PreviewSurveyData,
 * los guarda en localStorage y renderiza el mismo componente de preview.
 */
export default function PublicSurveyPage() {
  const params = useParams()
  const surveyId = params?.id as string
  const [status, setStatus] = useState<"loading" | "ready" | "not_found" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    if (!surveyId) return

    ;(async () => {
      try {
        const res = await fetch(`/api/surveys/${surveyId}`)
        if (!res.ok) {
          if (res.status === 404) { setStatus("not_found"); return }
          setErrorMsg("Error al cargar la encuesta")
          setStatus("error")
          return
        }
        const data = await res.json()

        if (data.status !== "active" && data.status !== "draft") {
          setErrorMsg("Esta encuesta no está activa actualmente.")
          setStatus("error")
          return
        }

        // --- Transformar la respuesta de la API al formato PreviewSurveyData ---
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
        setStatus("ready")
      } catch {
        setErrorMsg("Error de conexión")
        setStatus("error")
      }
    })()
  }, [surveyId])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando encuesta...</p>
        </div>
      </div>
    )
  }

  if (status === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Encuesta no encontrada</h2>
            <p className="text-muted-foreground">El enlace que abriste no corresponde a una encuesta válida.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Error</h2>
            <p className="text-muted-foreground">{errorMsg}</p>
            <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // status === "ready": renderizar el mismo componente de preview
  return <SurveyPreviewPage />
}
