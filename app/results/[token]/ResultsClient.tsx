"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, AreaChart, Area,
} from "recharts"
import { Loader2, AlertCircle, CheckCircle2, XCircle, AlertTriangle, Clock, Users, TrendingUp } from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { formatPercent } from "@/lib/format"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Meta {
  surveyTitle: string
  surveyDescription: string
  customTitle?: string | null
  brandLogo?: string | null
  sections: { resumen: boolean; analisis: boolean; rendimiento: boolean; geografico: boolean }
  expiresAt: string | null
}

interface Summary {
  totalResponses: number
  completionRate: number
  avgTime: string
  nps: number | null
  efectivas: number
  incidencias: number
  abandonadas: number
  tasaRespuestasEfectivas: number
  responsesTimeline: { date: string; count: number }[]
}

interface MatrixBreakdown {
  matrixRows: string[]
  matrixCols: string[]
  cellType: string
  tableData?: Record<string, Record<string, { avg?: number; count: number; samples?: string[] }>>
  rowDistribution?: Record<string, Record<string, number>>
}

interface QuestionBreakdown {
  questionId: string
  text: string
  type: string
  totalAnswered: number
  choices?: { label: string; count: number; percentage: number }[]
  numericStats?: { avg: number; min: number; max: number; median: number; distribution: { value: number; count: number; percentage: number }[] } | null
  textAnswers?: string[]
  matrixBreakdown?: MatrixBreakdown
  // Tipo de gráfica elegido por el admin en "Análisis de resultados" (ver
  // QuestionCard) — cuando viene, manda sobre el criterio por defecto
  // (pie si hay pocas opciones, barras si hay muchas).
  chartType?: string | null
}

interface ReportData {
  meta: Meta
  summary: Summary
  questionBreakdowns: QuestionBreakdown[]
  surveyorPerformance: any[]
}

// ─── Color palette ────────────────────────────────────────────────────────────
const CHART_COLORS = ["#18b0a4", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981", "#f97316", "#06b6d4"]

const RADIAN = Math.PI / 180
function RenderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) {
  if (percent < 0.05) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// ─── Matrix table ─────────────────────────────────────────────────────────────
function MatrixTablePublic({ mb }: { mb: MatrixBreakdown }) {
  const { matrixRows, matrixCols, cellType, tableData, rowDistribution } = mb
  const isNumeric = cellType === "number" || cellType === "rating"
  const isChoice  = cellType === "radio" || cellType === "checkbox"

  if (isChoice && rowDistribution) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 border border-gray-200">Fila</th>
              {matrixCols.map((col) => (
                <th key={col} className="text-center px-3 py-2.5 font-semibold text-gray-600 border border-gray-200">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixRows.map((row, ri) => {
              const dist = rowDistribution[row] || {}
              const rowTotal = Object.values(dist).reduce((s, n) => s + n, 0) || 1
              return (
                <tr key={row} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="px-3 py-2.5 font-medium text-gray-700 border border-gray-200">{row}</td>
                  {matrixCols.map((col) => {
                    const cnt = dist[col] || 0
                    const pct = Math.round((cnt / rowTotal) * 1000) / 10
                    return (
                      <td key={col} className="px-3 py-2.5 text-center border border-gray-200">
                        {cnt > 0 ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-bold text-[#18b0a4]">{cnt}</span>
                            <div className="w-12 bg-gray-200 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-[#18b0a4]" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-400">{formatPercent(pct)}</span>
                          </div>
                        ) : <span className="text-gray-300">—</span>}
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
        <table className="w-full text-sm border-collapse rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 border border-gray-200">Fila</th>
              {matrixCols.map((col) => (
                <th key={col} className="text-center px-3 py-2.5 font-semibold text-gray-600 border border-gray-200">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixRows.map((row, ri) => (
              <tr key={row} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                <td className="px-3 py-2.5 font-medium text-gray-700 border border-gray-200">{row}</td>
                {matrixCols.map((col) => {
                  const cell = tableData[row]?.[col]
                  return (
                    <td key={col} className="px-3 py-2.5 text-center border border-gray-200 tabular-nums">
                      {cell?.count ? (
                        isNumeric ? (
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-lg text-[#18b0a4]">{cell.avg ?? "—"}</span>
                            <span className="text-xs text-gray-400">{cell.count} resp.</span>
                          </div>
                        ) : (
                          <div className="text-left space-y-0.5">
                            {(cell.samples || []).map((s, i) => (
                              <p key={i} className="text-xs text-gray-500 italic">"{s}"</p>
                            ))}
                          </div>
                        )
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {isNumeric && <p className="text-xs text-gray-400 mt-2">Promedio de todas las respuestas por celda</p>}
      </div>
    )
  }
  return null
}

// ─── Chart component per question ─────────────────────────────────────────────
function QuestionCard({ q, index }: { q: QuestionBreakdown; index: number }) {
  const isMatrix = q.type === "matrix" && !!q.matrixBreakdown
  const isChoice = (q.choices?.length ?? 0) > 0
  const isNumeric = q.numericStats !== null
  const isText = (q.textAnswers?.length ?? 0) > 0
  // El default REAL de "Análisis de resultados" (ver defaultChartType en
  // components/reports/question-card.tsx) es barras para toda pregunta de
  // opciones — nunca torta — así que sin esto la mayoría de las preguntas
  // ni siquiera pasan por onSettingsChange (el admin ve "Barras
  // horizontales" ya marcado de entrada, no hace falta tocarlo, así que
  // nunca se guarda nada explícito). El criterio anterior acá (torta si
  // hay ≤6 opciones) no coincidía con eso, y el link compartido mostraba
  // torta aunque el admin viera barras. Torta/Anillo solo se usan cuando
  // se guardó explícitamente ese chartType.
  const isPie = isChoice && (q.chartType === "pie" || q.chartType === "donut")
  const isBar = isChoice && !isPie

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 mb-4">
      <div className="flex items-start gap-3 mb-4">
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#18b0a4]/10 text-[#18b0a4] text-xs font-bold flex items-center justify-center">
          {index + 1}
        </span>
        <div>
          <p className="font-medium text-gray-900 leading-snug">{q.text}</p>
          <p className="text-xs text-gray-400 mt-0.5">{q.totalAnswered} respuesta{q.totalAnswered !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Choice: pie chart */}
      {isPie && (
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="w-full md:w-1/2" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={q.choices}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  labelLine={false}
                  label={RenderCustomLabel}
                >
                  {(q.choices ?? []).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any, name: any) => [`${v} (${(q.choices ?? []).find(c => c.label === name)?.percentage ?? 0}%)`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full md:w-1/2 space-y-2">
            {(q.choices ?? []).map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span className="text-sm text-gray-700 flex-1 truncate">{c.label}</span>
                <span className="text-sm font-semibold text-gray-900 tabular-nums">{c.count}</span>
                <span className="text-xs text-gray-400 w-10 text-right tabular-nums">{formatPercent(c.percentage)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Choice: horizontal bar chart for many options */}
      {isBar && (
        <div style={{ height: Math.max(180, (q.choices?.length ?? 0) * 36) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={q.choices ?? []} margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" width={160} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any, _: any, p: any) => [`${v} (${formatPercent(p.payload.percentage)})`, "Respuestas"]} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {(q.choices ?? []).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Numeric */}
      {isNumeric && q.numericStats && (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Promedio", value: q.numericStats.avg.toFixed(1) },
              { label: "Mínimo", value: q.numericStats.min },
              { label: "Máximo", value: q.numericStats.max },
            ].map((stat) => (
              <div key={stat.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-[#18b0a4] tabular-nums">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={q.numericStats.distribution} margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="value" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any, _: any, p: any) => [`${v} (${formatPercent(p.payload.percentage)})`, "Respuestas"]} />
                <Bar dataKey="count" fill="#18b0a4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Matrix */}
      {isMatrix && <MatrixTablePublic mb={q.matrixBreakdown!} />}

      {/* Text answers */}
      {!isMatrix && isText && (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {(q.textAnswers ?? []).map((t, i) => (
            <p key={i} className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border-l-2 border-[#18b0a4]/40">
              {t}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ResultsClient() {
  const params = useParams()
  const token = params?.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ReportData | null>(null)
  const [activeSection, setActiveSection] = useState<"resumen" | "analisis" | "rendimiento">("resumen")
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [passwordInput, setPasswordInput] = useState("")
  const [passwordError, setPasswordError] = useState(false)

  const loadReport = (pw?: string) => {
    if (!token) return
    const url = pw ? `/api/public-report/${token}?password=${encodeURIComponent(pw)}` : `/api/public-report/${token}`
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.error === "password_required") { setPasswordRequired(true); setLoading(false); return }
        if (data.error) {
          if (pw) setPasswordError(true)
          else setError(data.error)
          return
        }
        setPasswordRequired(false)
        setReport(data)
        // Auto-select first enabled section
        const s = data.meta.sections
        if (s.resumen) setActiveSection("resumen")
        else if (s.analisis) setActiveSection("analisis")
        else if (s.rendimiento) setActiveSection("rendimiento")
      })
      .catch(() => setError("Error al cargar el reporte."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadReport() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#18b0a4] mx-auto mb-3" />
          <p className="text-gray-500">Cargando resultados...</p>
        </div>
      </div>
    )
  }

  if (passwordRequired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#18b0a4]/10 flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#18b0a4]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800">Reporte protegido</h2>
          <p className="text-gray-500 text-sm">Ingresa la contraseña para ver este reporte.</p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false) }}
            onKeyDown={(e) => { if (e.key === "Enter") { setLoading(true); loadReport(passwordInput) } }}
            placeholder="Contraseña"
            className={`w-full border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#18b0a4] ${passwordError ? "border-red-400" : "border-gray-200"}`}
          />
          {passwordError && <p className="text-xs text-red-500">Contraseña incorrecta. Intenta de nuevo.</p>}
          <button
            onClick={() => { setLoading(true); loadReport(passwordInput) }}
            className="w-full bg-[#18b0a4] hover:bg-[#14918a] text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            Ver reporte
          </button>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No disponible</h2>
          <p className="text-gray-500">{error || "Este reporte no existe o el link es incorrecto."}</p>
        </div>
      </div>
    )
  }

  const { meta, summary, questionBreakdowns, surveyorPerformance } = report
  const s = meta.sections

  // Tab list — only show enabled sections
  const tabs = [
    { id: "resumen" as const, label: "Resumen", enabled: s.resumen !== false },
    { id: "analisis" as const, label: "Análisis de Resultados", enabled: s.analisis !== false },
    { id: "rendimiento" as const, label: "Rendimiento", enabled: s.rendimiento === true },
  ].filter((t) => t.enabled)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{meta.customTitle || meta.surveyTitle}</h1>
              {meta.surveyDescription && (
                <p className="text-gray-500 text-sm mt-1">{meta.surveyDescription}</p>
              )}
            </div>
            <div className="flex-shrink-0">
              {meta.brandLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={meta.brandLogo} alt="" className="h-10 max-w-[160px] object-contain" />
              ) : (
                <div className="opacity-60">
                  <Logo size="sm" showText />
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          {tabs.length > 1 && (
            <div className="flex gap-1 mt-5 border-b -mb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeSection === tab.id
                      ? "border-[#18b0a4] text-[#18b0a4]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* ── RESUMEN ── */}
        {activeSection === "resumen" && (
          <div>
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { icon: <Users className="h-4 w-4" />, label: "Total respuestas", value: summary.totalResponses, color: "text-[#18b0a4]" },
                { icon: <CheckCircle2 className="h-4 w-4" />, label: "Efectivas", value: summary.efectivas, color: "text-emerald-600" },
                { icon: <AlertTriangle className="h-4 w-4" />, label: "Incidencias", value: summary.incidencias, color: "text-amber-500" },
                { icon: <XCircle className="h-4 w-4" />, label: "Abandonadas", value: summary.abandonadas, color: "text-red-500" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className={`flex items-center gap-1.5 text-xs font-medium mb-2 ${kpi.color}`}>
                    {kpi.icon} {kpi.label}
                  </div>
                  <p className={`text-3xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2">
                  <TrendingUp className="h-4 w-4" /> Tasa de respuestas efectivas
                </div>
                <p className="text-3xl font-bold tabular-nums text-gray-900">{formatPercent(summary.tasaRespuestasEfectivas)}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2">
                  <Clock className="h-4 w-4" /> Tiempo promedio
                </div>
                <p className="text-3xl font-bold tabular-nums text-gray-900">{summary.avgTime}</p>
              </div>
              {summary.nps !== null && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2">
                    NPS
                  </div>
                  <p className={`text-3xl font-bold tabular-nums ${summary.nps >= 50 ? "text-emerald-600" : summary.nps >= 0 ? "text-amber-500" : "text-red-500"}`}>
                    {summary.nps > 0 ? `+${summary.nps}` : summary.nps}
                  </p>
                </div>
              )}
            </div>

            {/* Timeline chart */}
            {summary.responsesTimeline.length > 1 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Respuestas por día</h3>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={summary.responsesTimeline} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradTimeline" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#18b0a4" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#18b0a4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip labelFormatter={(l) => `Fecha: ${l}`} formatter={(v: any) => [`${v} respuestas`, ""]} />
                      <Area type="monotone" dataKey="count" stroke="#18b0a4" strokeWidth={2} fill="url(#gradTimeline)" name="Respuestas" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ANÁLISIS DE RESULTADOS ── */}
        {activeSection === "analisis" && (
          <div>
            {questionBreakdowns.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
                <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No hay respuestas para mostrar.</p>
              </div>
            ) : (
              questionBreakdowns.map((q, i) => (
                <QuestionCard key={q.questionId} q={q} index={i} />
              ))
            )}
          </div>
        )}

        {/* ── RENDIMIENTO ── */}
        {activeSection === "rendimiento" && s.rendimiento && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h3 className="font-semibold text-gray-900">Rendimiento por encuestador</h3>
            </div>
            {surveyorPerformance.length === 0 ? (
              <div className="p-8 text-center text-gray-400">Sin datos de rendimiento.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Encuestador</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Efectivas</th>
                    <th className="px-4 py-3 text-right">Incidencias</th>
                    <th className="px-4 py-3 text-right">Abandonadas</th>
                    <th className="px-4 py-3 text-right">Tasa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {surveyorPerformance.map((s, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{s.totalRegistros}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">{s.efectivas}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-500">{s.incidencias}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-red-500">{s.abandonadas}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold tabular-nums ${s.tasaRespuestas >= 80 ? "text-emerald-600" : s.tasaRespuestas >= 50 ? "text-amber-500" : "text-red-500"}`}>
                          {formatPercent(s.tasaRespuestas)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-4xl mx-auto px-4 py-6 mt-4 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">
          Reporte generado con <span className="font-medium text-[#18b0a4]">Datanalisis</span>
          {meta.expiresAt && (
            <> · Expira {new Date(meta.expiresAt).toLocaleDateString("es-CO")}</>
          )}
        </p>
      </div>
    </div>
  )
}
