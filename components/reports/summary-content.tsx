"use client"

// Contenido del tab "Resumen" — compartido entre /dashboard y /reports (tab
// Resumen) para no mantener dos copias de las mismas tarjetas/gráficos.
// Puramente presentacional: recibe los datos ya resueltos por el fetch de
// cada página (ambas pegan a /api/reports con sus propios filtros).

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart3, PieChart as PieChartIcon, TrendingUp, TrendingDown, AlertCircle,
  Clock, Calendar, Zap, Target, BookOpen, ArrowUpRight, ArrowDownRight, Minus,
  CheckCircle2, AlertTriangle, XCircle, Users2, UserX,
} from "lucide-react"
import { QuestionChart } from "@/components/reports/question-chart"
import { formatGrowth, type ReportData } from "@/app/reports/shared"
import { formatPercent } from "@/lib/format"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Cell,
} from "recharts"

function formatHour(h: number) {
  const ampm = h < 12 ? "AM" : "PM"
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display}:00 ${ampm}`
}

export function SummaryContent({ data }: { data: ReportData | null }) {
  const summary = data?.summary
  const questionBreakdowns = data?.responses?.questionBreakdowns ?? []

  return (
    <div className="space-y-6">
      {/* ── Fila 1: KPIs de tipo de encuesta ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4" data-export-chart>
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#18b0a4]/5 to-transparent pointer-events-none" />
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-[#18b0a4]" /> Total Registros
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold text-foreground">{summary?.totalResponses?.toLocaleString() ?? "0"}</div>
            <div className="flex items-center gap-1 mt-1">
              {(summary?.responseGrowth ?? 0) > 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5 text-[#18b0a4]" />
              ) : (summary?.responseGrowth ?? 0) < 0 ? (
                <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
              ) : (
                <Minus className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <p className={`text-xs font-medium ${(summary?.responseGrowth ?? 0) > 0 ? "text-[#18b0a4]" : (summary?.responseGrowth ?? 0) < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                {summary ? formatGrowth(summary.responseGrowth) : ""}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#18b0a4]/5 to-transparent pointer-events-none" />
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#18b0a4]" /> Efectivas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold text-[#18b0a4]">{summary?.efectivas?.toLocaleString() ?? "0"}</div>
            <p className="text-xs text-muted-foreground mt-1">{formatPercent(summary?.tasaRespuestasEfectivas ?? 0)} del total</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Incidencias
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold text-red-500">{summary?.incidencias?.toLocaleString() ?? "0"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatPercent((summary?.totalResponses ?? 0) > 0 ? Math.round(((summary?.incidencias ?? 0) / (summary?.totalResponses || 1)) * 1000) / 10 : 0)} del total
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 text-amber-500" /> Abandonadas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold text-amber-500">{summary?.abandonadas?.toLocaleString() ?? "0"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatPercent((summary?.totalResponses ?? 0) > 0 ? Math.round(((summary?.abandonadas ?? 0) / (summary?.totalResponses || 1)) * 1000) / 10 : 0)} del total
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <UserX className="h-3.5 w-3.5 text-purple-500" /> Descalificadas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold text-purple-500">{summary?.descalificadas?.toLocaleString() ?? "0"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatPercent((summary?.totalResponses ?? 0) > 0 ? Math.round(((summary?.descalificadas ?? 0) / (summary?.totalResponses || 1)) * 1000) / 10 : 0)} del total
            </p>
          </CardContent>
        </Card>
      </div>

      {!(data?.summary?.incidencias) && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-3 border border-dashed">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>
            &quot;Incidencias&quot; siempre muestra 0 hasta que la APK empiece a enviar la clasificación de cada respuesta
            (pantalla previa a la encuesta). Mientras tanto, &quot;Efectivas&quot; y &quot;Abandonadas&quot; se calculan a partir
            del estado actual de la respuesta como una aproximación razonable.
          </span>
        </div>
      )}

      {/* ── Desglose de incidencias por motivo ── */}
      <div className="grid grid-cols-1 gap-6">
        {/* Desglose de incidencias por motivo (slide 3): al ser varias, una sola
            barra de "Incidencias" no dice cuál es el motivo más frecuente. */}
        <Card data-export-chart data-export-layout="half">
          <CardHeader>
            <CardTitle className="text-base">Incidencias por motivo</CardTitle>
            <CardDescription>Detalle de las {summary?.incidencias ?? 0} incidencias del período</CardDescription>
          </CardHeader>
          <CardContent>
            {!summary?.incidenceBreakdown || summary.incidenceBreakdown.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Sin incidencias en el período</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, summary.incidenceBreakdown.length * 36)}>
                <BarChart
                  layout="vertical"
                  data={summary.incidenceBreakdown}
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <ReTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: any) => [value, "Incidencias"]}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22} fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Fila 2: KPIs principales ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-export-chart>
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#18b0a4]/5 to-transparent pointer-events-none" />
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-[#18b0a4]" /> Tasa de Respuestas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex items-center gap-3">
            <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#18b0a4" strokeWidth="4"
                  strokeDasharray={`${(summary?.tasaRespuestasEfectivas ?? 0) * 0.879} 87.9`}
                  strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">
                {formatPercent(summary?.tasaRespuestasEfectivas ?? 0)}
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold">{formatPercent(summary?.tasaRespuestasEfectivas ?? 0)}</div>
              <p className="text-xs text-muted-foreground">efectivas / total</p>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#18b0a4]/5 to-transparent pointer-events-none" />
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#18b0a4]" /> Tiempo Promedio
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold font-mono">{summary?.avgTime || "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">min:seg por encuesta efectiva</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#18b0a4]/5 to-transparent pointer-events-none" />
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Users2 className="h-3.5 w-3.5 text-[#18b0a4]" /> Total Encuestadores
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold">{data?.performance?.surveyorPerformance?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">con registros en el período</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#18b0a4]/5 to-transparent pointer-events-none" />
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-[#18b0a4]" /> Preguntas Analizadas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold">{questionBreakdowns.length}</div>
            <p className="text-xs text-muted-foreground mt-1">con al menos 1 respuesta</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Fila 3: Evolución de respuestas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" data-export-chart data-export-layout="half">
          <CardHeader>
            <CardTitle className="text-base">Evolución de Respuestas</CardTitle>
            <CardDescription>Tendencia de respuestas recibidas por día</CardDescription>
          </CardHeader>
          <CardContent>
            {(summary?.responsesTimeline?.length ?? 0) === 0 ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No hay datos para el período</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={summary!.responsesTimeline.map((d) => ({ ...d, label: d.date.slice(5) }))}
                  margin={{ top: 8, right: 8, left: -8, bottom: 48 }}
                >
                  <defs>
                    <linearGradient id="timelineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#18b0a4" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#18b0a4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    angle={-35}
                    textAnchor="end"
                    interval={Math.max(0, Math.floor((summary?.responsesTimeline?.length ?? 1) / 8) - 1)}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <ReTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: any) => [value, "Respuestas"]}
                    labelFormatter={(label) => `Fecha: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#18b0a4"
                    strokeWidth={2.5}
                    fill="url(#timelineGrad)"
                    dot={{ r: 3, fill: "#18b0a4", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#18b0a4" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          {/* El borde/esquinas redondeadas de esta tarjeta los dibuja
              export-report.ts a mano (un solo marco alrededor de imagen +
              leyenda) — por eso las marcas data-export-* van en este div
              INTERNO sin su propio borde, no en el <Card>: si capturáramos
              el <Card> completo (con su borde), quedaría un borde "cerrado"
              después del donut (por el colapso de layout de
              data-html2canvas-ignore) y otro borde mío para la leyenda,
              dando dos recuadros pegados en vez de uno solo. */}
          <div
            data-export-chart
            data-export-layout="half"
            data-export-max-width="320"
            // Leyenda para que export-report.ts la redibuje con texto real
            // de jsPDF (ver data-html2canvas-ignore en question-chart.tsx)
            // — mismo orden de colores que la paleta por defecto de
            // QuestionChart (DEFAULT_PALETTE): teal, azul, ámbar, rojo.
            data-export-legend={summary && summary.totalResponses > 0 ? JSON.stringify([
              { label: "Efectivas", count: summary.efectivas, percentage: Math.round((summary.efectivas / summary.totalResponses) * 1000) / 10, color: "#18b0a4" },
              { label: "Incidencias", count: summary.incidencias, percentage: Math.round((summary.incidencias / summary.totalResponses) * 1000) / 10, color: "#2563eb" },
              { label: "Descalificadas", count: summary.descalificadas, percentage: Math.round((summary.descalificadas / summary.totalResponses) * 1000) / 10, color: "#f59e0b" },
              { label: "Abandonadas", count: summary.abandonadas, percentage: Math.round((summary.abandonadas / summary.totalResponses) * 1000) / 10, color: "#ef4444" },
            ]) : undefined}
          >
            <CardHeader>
              <CardTitle className="text-base">Distribución por Tipo</CardTitle>
              <CardDescription>Efectivas vs Incidencias vs Descalificadas vs Abandonadas</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center min-h-56 gap-3 py-6">
              {summary && summary.totalResponses > 0 ? (
                <QuestionChart
                  type="donut"
                  showLabels={true}
                  distribution={[
                    { label: "Efectivas", count: summary.efectivas, percentage: Math.round((summary.efectivas / summary.totalResponses) * 1000) / 10 },
                    { label: "Incidencias", count: summary.incidencias, percentage: Math.round((summary.incidencias / summary.totalResponses) * 1000) / 10 },
                    { label: "Descalificadas", count: summary.descalificadas, percentage: Math.round((summary.descalificadas / summary.totalResponses) * 1000) / 10 },
                    { label: "Abandonadas", count: summary.abandonadas, percentage: Math.round((summary.abandonadas / summary.totalResponses) * 1000) / 10 },
                  ]}
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <PieChartIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin respuestas aún</p>
                </div>
              )}
            </CardContent>
          </div>
        </Card>
      </div>

      {/* ── Fila 4: Hora del día + Insights ── */}
      {/* Sin data-export-chart: a pedido del cliente, "Actividad por Hora del
          Día" e "Insights" no deben salir en el PDF exportado. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Actividad por Hora del Día</CardTitle>
            <CardDescription>¿A qué hora responden más las personas?</CardDescription>
          </CardHeader>
          <CardContent>
            {(summary?.totalResponses ?? 0) === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={(summary?.responsesByHour ?? []).map((h) => ({
                    ...h,
                    label: `${h.hour}:00`,
                    isPeak: h.hour === summary?.peakHour && h.count > 0,
                  }))}
                  margin={{ top: 4, right: 4, left: -16, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    interval={5}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <ReTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: any) => [value, "Respuestas"]}
                    labelFormatter={(label) => `Hora: ${label}`}
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={24}>
                    {(summary?.responsesByHour ?? []).map((h, i) => (
                      <Cell
                        key={i}
                        fill={h.hour === summary?.peakHour && h.count > 0 ? "#18b0a4" : "#18b0a480"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {summary && summary.totalResponses > 0 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Pico de actividad: <span className="font-semibold text-primary">{formatHour(summary.peakHour)}</span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Insights
            </CardTitle>
            <CardDescription>Análisis automático del período</CardDescription>
          </CardHeader>
          <CardContent>
            {(summary?.totalResponses ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos para analizar</p>
            ) : (
              <ul className="space-y-3 text-sm">
                <li className="flex gap-2">
                  {(summary?.trendPct ?? 0) >= 0
                    ? <TrendingUp className="h-4 w-4 text-[#18b0a4] flex-shrink-0 mt-0.5" />
                    : <TrendingDown className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />}
                  <span className="text-muted-foreground">
                    Las respuestas <strong className={(summary?.trendPct ?? 0) >= 0 ? "text-[#18b0a4]" : "text-red-500"}>
                      {(summary?.trendPct ?? 0) >= 0 ? "subieron" : "bajaron"} {Math.abs(summary?.trendPct ?? 0)}%
                    </strong> en la segunda mitad del período
                  </span>
                </li>
                {summary?.peakDay && (
                  <li className="flex gap-2">
                    <Calendar className="h-4 w-4 text-[#18b0a4] flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      Día más activo: <strong className="text-foreground">{summary.peakDay.date.slice(5)}</strong> con {summary.peakDay.count} respuestas
                    </span>
                  </li>
                )}
                <li className="flex gap-2">
                  <Clock className="h-4 w-4 text-[#18b0a4] flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    Mayor actividad a las <strong className="text-foreground">{formatHour(summary?.peakHour ?? 0)}</strong>
                  </span>
                </li>
                <li className="flex gap-2">
                  <Target className="h-4 w-4 flex-shrink-0 mt-0.5 text-[#18b0a4]" />
                  <span className="text-muted-foreground">
                    {summary?.tasaRespuestasEfectivas === 100
                      ? <><strong className="text-[#18b0a4]">100%</strong> de respuestas efectivas</>
                      : summary?.tasaRespuestasEfectivas && summary.tasaRespuestasEfectivas >= 80
                      ? <><strong className="text-[#18b0a4]">{formatPercent(summary.tasaRespuestasEfectivas)}</strong> de respuestas efectivas — muy buena tasa</>
                      : <><strong className="text-amber-500">{formatPercent(summary?.tasaRespuestasEfectivas)}</strong> de respuestas efectivas — revisar campo</>
                    }
                  </span>
                </li>
                <li className="flex gap-2">
                  <BarChart3 className="h-4 w-4 text-[#18b0a4] flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    Promedio de <strong className="text-foreground">{summary?.avgPerDay ?? 0} resp/día</strong> en {summary?.activeDays ?? 0} días activos
                  </span>
                </li>
                <li className="flex gap-2">
                  <BookOpen className="h-4 w-4 text-[#18b0a4] flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">{questionBreakdowns.length} preguntas</strong> con datos en este período
                  </span>
                </li>
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
