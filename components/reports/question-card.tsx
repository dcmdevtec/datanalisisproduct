"use client"

// Tarjeta de pregunta individual para el constructor de informes.
// Muestra el encabezado, controles de tipo de gráfica y la gráfica.
// Diseñada para renderizar múltiples instancias en scroll vertical.

import { useState, useEffect } from "react"
import {
  ChartPie, Disc, BarChart2, AlignLeft, TrendingUp,
  Eye, EyeOff, Table2, ChevronDown, ChevronUp, X,
  Download, Loader2,
} from "lucide-react"
import { QuestionChart, type ChartType, type DistributionItem, type TimelinePoint } from "./question-chart"

export interface QuestionBreakdown {
  questionId: string
  text: string
  type: string
  totalAnswers: number
  average?: string | null
  distribution?: DistributionItem[]
  timeline?: TimelinePoint[]
  sampleAnswers?: string[]
}

export interface CardSettings {
  chartType: ChartType
  showLabels: boolean
  showTable: boolean
}

interface QuestionCardProps {
  question: QuestionBreakdown
  index: number
  settings: CardSettings
  onSettingsChange: (s: Partial<CardSettings>) => void
  onHide: () => void
  surveyId?: string
}

const CHART_OPTIONS: { value: ChartType; label: string; icon: React.ElementType }[] = [
  { value: "pie",    label: "Torta",             icon: ChartPie },
  { value: "donut",  label: "Anillo",             icon: Disc },
  { value: "barsV",  label: "Barras verticales",  icon: BarChart2  },
  { value: "barsH",  label: "Barras horizontales", icon: AlignLeft },
  { value: "trend",  label: "Tendencia",          icon: TrendingUp },
]

// Determine sensible default chart type by question type
function defaultChartType(questionType: string): ChartType {
  if (["rating", "nps", "likert", "scale"].includes(questionType)) return "barsV"
  if (["text", "long_text", "textarea", "open"].includes(questionType)) return "barsH"
  return "barsH"
}

export function QuestionCard({ question, index, settings, onSettingsChange, onHide, surveyId }: QuestionCardProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [fileGallery, setFileGallery] = useState<{ url: string; name: string; type?: string }[]>([])
  const [fileLoading, setFileLoading] = useState(false)

  const isFileQuestion = ["file", "image_upload"].includes(question.type)
  const hasDistribution = (question.distribution?.length ?? 0) > 0
  const hasAnswers = question.totalAnswers > 0

  useEffect(() => {
    if (!isFileQuestion || !surveyId || !question.questionId) return
    setFileLoading(true)
    const params = new URLSearchParams({ questionId: question.questionId })
    if (surveyId && surveyId !== "all") params.set("surveyId", surveyId)
    fetch(`/api/response-files?${params}`)
      .then((r) => r.json())
      .then((d) => setFileGallery(d.files ?? []))
      .catch(() => setFileGallery([]))
      .finally(() => setFileLoading(false))
  }, [isFileQuestion, question.questionId, surveyId])

  return (
    <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3 bg-muted/30 border-b">
        <span className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-[#18b0a4]/10 text-[#18b0a4] text-xs font-bold flex items-center justify-center">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm leading-snug">{question.text}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {question.totalAnswers} respuesta{question.totalAnswers !== 1 ? "s" : ""}
            {question.average ? ` · Promedio: ${question.average}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
            title={collapsed ? "Expandir" : "Colapsar"}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button
            onClick={onHide}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
            title="Ocultar pregunta del informe"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 py-4 space-y-4">
          {/* Controls */}
          {!isFileQuestion && hasDistribution && (
            <div className="flex flex-wrap gap-2 items-center pb-3 border-b">
              {/* Chart type buttons */}
              <div className="flex gap-1 flex-wrap">
                {CHART_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => onSettingsChange({ chartType: value })}
                    title={label}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium border transition-all ${
                      settings.chartType === value
                        ? "bg-[#18b0a4] text-white border-[#18b0a4]"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-border hidden sm:block" />

              {/* Toggles */}
              <div className="flex gap-3">
                <button
                  onClick={() => onSettingsChange({ showLabels: !settings.showLabels })}
                  className={`flex items-center gap-1 text-xs rounded px-2 py-1.5 border transition-all ${
                    settings.showLabels
                      ? "bg-[#18b0a4]/10 text-[#18b0a4] border-[#18b0a4]/30"
                      : "text-muted-foreground border-transparent hover:bg-muted"
                  }`}
                  title="Mostrar/ocultar etiquetas"
                >
                  {settings.showLabels ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  <span className="hidden sm:inline">Etiquetas</span>
                </button>
                <button
                  onClick={() => onSettingsChange({ showTable: !settings.showTable })}
                  className={`flex items-center gap-1 text-xs rounded px-2 py-1.5 border transition-all ${
                    settings.showTable
                      ? "bg-[#18b0a4]/10 text-[#18b0a4] border-[#18b0a4]/30"
                      : "text-muted-foreground border-transparent hover:bg-muted"
                  }`}
                  title="Mostrar/ocultar tabla de datos"
                >
                  <Table2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Tabla</span>
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          {!hasAnswers ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin respuestas para este filtro</p>
          ) : isFileQuestion ? (
            /* File/image gallery */
            <div className="space-y-3">
              {fileLoading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Cargando archivos…
                </div>
              ) : fileGallery.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No hay archivos subidos</div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {fileGallery.map((f, idx) =>
                    f.type?.startsWith("image/") ? (
                      <a key={idx} href={f.url} target="_blank" rel="noreferrer" title={f.name} className="block group">
                        <img src={f.url} alt={f.name} className="h-24 w-24 object-cover rounded-lg border group-hover:opacity-90 transition-opacity" />
                        <p className="text-xs text-muted-foreground mt-1 w-24 truncate text-center">{f.name}</p>
                      </a>
                    ) : (
                      <a key={idx} href={f.url} target="_blank" rel="noreferrer"
                        className="flex flex-col items-center gap-1.5 p-3 border rounded-lg bg-muted/30 hover:bg-muted transition-colors w-24 text-center">
                        <Download className="h-6 w-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground truncate w-full">{f.name}</span>
                      </a>
                    )
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">{fileGallery.length} archivo{fileGallery.length !== 1 ? "s" : ""}</p>
            </div>
          ) : hasDistribution ? (
            /* Chart */
            <>
              <QuestionChart
                type={settings.chartType}
                distribution={question.distribution ?? []}
                timeline={question.timeline ?? []}
                showLabels={settings.showLabels}
              />

              {settings.showTable && hasDistribution && (
                <div className="rounded-md border overflow-hidden mt-2">
                  <div className="grid grid-cols-3 p-2 text-xs font-semibold text-muted-foreground uppercase bg-muted/50 border-b">
                    <div>Opción</div>
                    <div className="text-center">Respuestas</div>
                    <div className="text-center">%</div>
                  </div>
                  <div className="divide-y">
                    {question.distribution!.map((d, i) => (
                      <div key={i} className="grid grid-cols-3 p-2 text-sm items-center">
                        <div className="truncate">{d.label}</div>
                        <div className="text-center font-medium">{d.count}</div>
                        <div className="text-center text-muted-foreground">{d.percentage}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (question.sampleAnswers?.length ?? 0) > 0 ? (
            /* Text answers */
            <div className="space-y-2">
              {question.sampleAnswers!.map((ans, i) => (
                <div key={i} className="p-3 border rounded-md bg-muted/20">
                  <p className="text-sm text-muted-foreground">&ldquo;{ans}&rdquo;</p>
                </div>
              ))}
              {question.totalAnswers > 5 && (
                <p className="text-xs text-muted-foreground">Mostrando 5 de {question.totalAnswers} respuestas de texto</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin datos para graficar este tipo de pregunta</p>
          )}
        </div>
      )}
    </div>
  )
}

// Helper: default settings for a question based on its type
export function defaultCardSettings(questionType: string): CardSettings {
  return {
    chartType: defaultChartType(questionType),
    showLabels: true,
    showTable: false,
  }
}
