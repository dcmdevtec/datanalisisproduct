"use client"

// Página dedicada para generar el PDF de una encuesta (ver
// app/api/surveys/[id]/pdf/route.ts, que la abre con Puppeteer headless y
// llama a page.pdf()). No es interactiva ni paginada como el wizard de
// /preview/survey — muestra TODAS las secciones y preguntas en una sola
// vista larga, ideal para imprimir/exportar de una sola pasada.
//
// Se separa del wizard de preview porque ese lee los datos de
// localStorage("surveyPreviewData") (los escribe create-survey/page.tsx
// antes de abrir la pestaña) — Puppeteer navega "en frío", sin ese
// localStorage, así que necesita su propia fuente de datos vía API pública
// GET /api/surveys/[id] (ya es pública, sin auth — la usa /encuesta/[id]).

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

interface QuestionRow {
  id: string
  type: string
  text: string
  text_html?: string | null
  options?: any[]
  required?: boolean
  order_num?: number
  section_id?: string | null
  matrix_rows?: string[] | null
  matrix_cols?: string[] | null
  question_config?: any
  rating_scale?: number | null
}

interface SectionRow {
  id: string
  title: string
  title_html?: string | null
  description?: string | null
  order_num?: number
}

interface SurveyRow {
  id: string
  title: string
  description?: string | null
  status?: string
  created_at?: string
  questions: QuestionRow[]
  survey_sections: SectionRow[]
  projects?: { name: string; companies?: { name: string; logo?: string | null } | null } | null
}

const TYPE_LABELS: Record<string, string> = {
  text: "Texto corto", single_textbox: "Texto corto",
  textarea: "Texto largo", comment_box: "Texto largo",
  email: "Correo electrónico", number: "Número", phone: "Teléfono",
  date: "Fecha", time: "Hora",
  multiple_choice: "Opción múltiple", checkbox: "Casillas de verificación",
  dropdown: "Lista desplegable", ranking: "Ranking / Orden",
  rating: "Calificación (estrellas)", nps: "NPS (0-10)",
  scale: "Escala numérica", likert: "Escala Likert", matrix: "Matriz",
  multiple_textboxes: "Cuadros de texto múltiples", file_upload: "Subida de archivo",
  image_upload: "Subida de imagen", signature: "Firma",
  demographic: "Datos demográficos", contact_info: "Información de contacto",
  image_choice: "Selección de imagen",
}

function optionLabel(opt: any): string {
  if (opt == null) return ""
  if (typeof opt === "object") return String(opt.label ?? opt.value ?? opt.text ?? "")
  return String(opt)
}

function QuestionBlock({ question, index }: { question: QuestionRow; index: number }) {
  const config = question.question_config || {}
  const matrixRows = question.matrix_rows || config.matrixRows || []
  const matrixCols = question.matrix_cols || config.matrixCols || []
  const options = Array.isArray(question.options) ? question.options.filter(Boolean) : []

  return (
    <div className="mb-6 p-5 border border-gray-200 rounded-lg bg-white break-inside-avoid">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#18b0a4] text-white text-sm font-bold flex items-center justify-center">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="text-base font-semibold text-gray-900"
              dangerouslySetInnerHTML={{ __html: question.text_html || question.text || "" }}
            />
            {question.required && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">Obligatoria</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">{TYPE_LABELS[question.type] || question.type}</p>

          {/* Opciones */}
          {options.length > 0 && (
            <ul className="mt-3 space-y-1">
              {options.map((opt, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0" />
                  {optionLabel(opt)}
                </li>
              ))}
            </ul>
          )}

          {/* Matriz */}
          {question.type === "matrix" && matrixRows.length > 0 && matrixCols.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr>
                    <th className="border border-gray-200 bg-gray-50 p-1.5 text-left"></th>
                    {matrixCols.map((c: string, i: number) => (
                      <th key={i} className="border border-gray-200 bg-gray-50 p-1.5 text-center font-medium text-gray-600">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map((r: string, ri: number) => (
                    <tr key={ri}>
                      <td className="border border-gray-200 p-1.5 text-gray-700">{r}</td>
                      {matrixCols.map((_: string, ci: number) => (
                        <td key={ci} className="border border-gray-200 p-1.5 text-center text-gray-300">○</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Escalas */}
          {question.type === "nps" && <p className="mt-2 text-xs text-gray-400 italic">Escala del 0 al 10</p>}
          {question.type === "scale" && (
            <p className="mt-2 text-xs text-gray-400 italic">
              Escala del {config.scaleMin ?? 1} al {config.scaleMax ?? question.rating_scale ?? 10}
            </p>
          )}
          {question.type === "rating" && (
            <p className="mt-2 text-xs text-gray-400 italic">{config.scaleMax ?? question.rating_scale ?? 5} estrellas</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PrintSurveyPage() {
  const params = useParams<{ id: string }>()
  const [survey, setSurvey] = useState<SurveyRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/surveys/${params.id}`)
        if (!res.ok) throw new Error(`No se pudo cargar la encuesta (HTTP ${res.status})`)
        const data = await res.json()
        if (!cancelled) setSurvey(data)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Error cargando la encuesta")
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [params.id])

  if (!ready) return <div className="p-10 text-center text-gray-400">Cargando…</div>
  if (error || !survey) return <div className="p-10 text-center text-red-500">{error || "Encuesta no encontrada"}</div>

  const sections = [...(survey.survey_sections || [])].sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))
  const questionsBySection = new Map<string, QuestionRow[]>()
  for (const q of survey.questions || []) {
    const sid = q.section_id || "_sin_seccion"
    if (!questionsBySection.has(sid)) questionsBySection.set(sid, [])
    questionsBySection.get(sid)!.push(q)
  }
  for (const list of questionsBySection.values()) list.sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))

  const logo = survey.projects?.companies?.logo || null
  let globalIndex = 0

  return (
    // data-print-ready es el marcador que espera Puppeteer (ver pdf/route.ts)
    // antes de generar el PDF, para no capturar la pantalla de "Cargando…".
    <div data-print-ready="true" className="bg-white text-gray-900 max-w-3xl mx-auto p-8">
      <div className="flex items-center justify-between border-b-2 border-[#18b0a4] pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#18b0a4]">{survey.title}</h1>
          {survey.description && <p className="text-sm text-gray-500 mt-1">{survey.description}</p>}
        </div>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-12 max-w-[140px] object-contain flex-shrink-0" />
        )}
      </div>

      {sections.map((section) => {
        const qs = questionsBySection.get(section.id) || []
        return (
          <div key={section.id} className="mb-8">
            <div className="bg-[#e6f7f6] rounded px-3 py-2 mb-4">
              {section.title_html ? (
                <div className="text-sm font-bold text-[#18b0a4]" dangerouslySetInnerHTML={{ __html: section.title_html }} />
              ) : (
                <p className="text-sm font-bold text-[#18b0a4]">{section.title || "Sección"}</p>
              )}
              {/* section.description es HTML enriquecido (mismo campo que
                  "Descripción de la sección" en el editor), no texto plano
                  — mostrarlo como texto dejaba ver las etiquetas <p>/<strong>
                  literales en el PDF. */}
              {section.description && (
                <div className="text-xs text-gray-500 mt-0.5" dangerouslySetInnerHTML={{ __html: section.description }} />
              )}
            </div>
            {qs.map((q) => {
              const idx = globalIndex++
              return <QuestionBlock key={q.id} question={q} index={idx} />
            })}
          </div>
        )
      })}

      <p className="text-[10px] text-gray-400 text-center border-t pt-3 mt-8">
        {globalIndex} preguntas · {sections.length} secciones
      </p>
    </div>
  )
}
