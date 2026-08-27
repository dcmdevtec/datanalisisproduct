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

export interface MatrixBreakdown {
  matrixRows: string[]
  matrixCols: string[]
  cellType: string
  /** number / text / rating cell types */
  tableData?: Record<string, Record<string, { avg?: number; count: number; samples?: string[] }>>
  /** radio / checkbox cell types */
  rowDistribution?: Record<string, Record<string, number>>
}

export interface QuestionBreakdown {
  questionId: string
  text: string
  type: string
  totalAnswers: number
  average?: string | null
  distribution?: DistributionItem[]
  timeline?: TimelinePoint[]
  sampleAnswers?: string[]
  matrixBreakdown?: MatrixBreakdown
}

export interface CardSettings {
  chartType: ChartType
  showLabels: boolean
  showTable: boolean
  baseColor?: string
}

// Paleta de colores para personalización rápida
const COLOR_PALETTE = [
  "#18b0a4", "#3b82f6", "#8b5cf6", "#f59e0b",
  "#ef4444", "#10b981", "#f97316", "#ec4899",
]

interface QuestionCardProps {
  question: QuestionBreakdown
  index: number
  settings: CardSettings
  onSettingsChange: (s: Partial<CardSettings>) => void
  onHide: () => void
  hideLabel?: string
  surveyId?: string
}

// ─── MatrixTable ──────────────────────────────────────────────────────────────
function MatrixTable({ mb }: { mb: MatrixBreakdown }) {
  const { matrixRows, matrixCols, cellType, tableData, rowDistribution } = mb
  const isNumeric = cellType === "number" || cellType === "rating"
  const isChoice  = cellType === "radio" || cellType === "checkbox"

  if (isChoice && rowDistribution) {
    // Mostrar distribución por fila: qué columna eligió cada respondente
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground border border-border rounded-tl-md">Fila</th>
              {matrixCols.map((col) => (
                <th key={col} className="text-center px-3 py-2 font-medium text-muted-foreground border border-border">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixRows.map((row, ri) => {
              const dist = rowDistribution[row] || {}
              const rowTotal = Object.values(dist).reduce((s, n) => s + n, 0) || 1
              return (
                <tr key={row} className={ri % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                  <td className="px-3 py-2 font-medium border border-border">{row}</td>
                  {matrixCols.map((col) => {
                    const cnt = dist[col] || 0
                    const pct = Math.round((cnt / rowTotal) * 100)
                    return (
                      <td key={col} className="px-3 py-2 text-center border border-border">
                        {cnt > 0 ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-semibold">{cnt}</span>
                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                              <div className="h-1.5 rounded-full bg-[#18b0a4]" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{pct}%</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  if (tableData) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground border border-border">
                {isNumeric ? "Fila / Columna" : "Fila"}
              </th>
              {matrixCols.map((col) => (
                <th key={col} className="text-center px-3 py-2 font-medium text-muted-foreground border border-border">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixRows.map((row, ri) => (
              <tr key={row} className={ri % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                <td className="px-3 py-2 font-medium border border-border">{row}</td>
                {matrixCols.map((col) => {
                  const cell = tableData[row]?.[col]
                  return (
                    <td key={col} className="px-3 py-2 text-center border border-border tabular-nums">
                      {cell?.count ? (
                        isNumeric ? (
                          <div className="flex flex-col items-center">
                            <span className="font-semibold text-base">{cell.avg ?? "—"}</span>
                            <span className="text-xs text-muted-foreground">{cell.count} resp.</span>
                          </div>
                        ) : (
                          <div className="text-left space-y-0.5">
                            {(cell.samples || []).map((s, i) => (
                              <p key={i} className="text-xs text-muted-foreground italic truncate max-w-[160px]">"{s}"</p>
                            ))}
                          </div>
                        )
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {isNumeric && (
          <p className="text-xs text-muted-foreground mt-2">Valores = promedio de todas las respuestas para cada celda</p>
        )}
      </div>
    )
  }

  return null
}
// ─────────────────────────────────────────────────────────────────────────────

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

export function QuestionCard({ question, index, settings, onSettingsChange, onHide, hideLabel, surveyId }: QuestionCardProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [fileGallery, setFileGallery] = useState<{ url: string; name: string; type?: string }[]>([])
  const [fileLoading, setFileLoading] = useState(false)

  const isFileQuestion = ["file", "image_upload"].includes(question.type)
  const isMatrixQuestion = question.type === "matrix" && !!question.matrixBreakdown
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
            title={hideLabel ? `${hideLabel} del informe` : "Ocultar pregunta del informe"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 py-4 space-y-4">
          {/* Controls — ocultar para matrices y archivos */}
          {!isFileQuestion && !isMatrixQuestion && hasDistribution && (
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

              {/* Color palette */}
              <div className="flex gap-1 items-center" title="Color base de la gráfica">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    onClick={() => onSettingsChange({ baseColor: color })}
                    style={{ backgroundColor: color }}
                    className={`w-4 h-4 rounded-full transition-all border-2 ${
                      settings.baseColor === color ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    title={color}
                  />
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
          ) : isMatrixQuestion ? (
            /* Matriz */
            <MatrixTable mb={question.matrixBreakdown!} />
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
                baseColor={settings.baseColor}
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
