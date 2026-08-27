"use client"

// Renderiza los 5 tipos de gráfico usando recharts (ya incluido en el bundle).
// Recharts maneja dark-mode correctamente (sin fondo negro en donut),
// tiene tooltips nativos con números al hover, y permite gráficas de línea reales.

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from "recharts"
import { formatPercent } from "@/lib/format"

export type ChartType = "pie" | "donut" | "barsV" | "barsH" | "trend"

export interface DistributionItem {
  label: string
  count: number
  percentage: number
}

export interface TimelinePoint {
  date: string
  count: number
}

interface QuestionChartProps {
  type: ChartType
  distribution: DistributionItem[]
  timeline?: TimelinePoint[]
  showLabels: boolean
  baseColor?: string
}

const DEFAULT_PALETTE = [
  "#18b0a4", "#2563eb", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#84cc16", "#06b6d4",
]

function buildPalette(baseColor?: string): string[] {
  if (!baseColor) return DEFAULT_PALETTE
  // Use the base color as the first entry and build analogous shades for the rest
  return [baseColor, ...DEFAULT_PALETTE.filter((c) => c !== baseColor)]
}

// Tooltip reutilizable con estilos CSS-var para que funcione en dark mode
const tooltipStyle = {
  backgroundColor: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--foreground))",
}

function PieOrDonut({
  distribution,
  donut,
  showLabels,
  palette,
}: {
  distribution: DistributionItem[]
  donut: boolean
  showLabels: boolean
  palette: string[]
}) {
  const total = distribution.reduce((s, d) => s + d.count, 0) || 1

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload as DistributionItem
    return (
      <div style={tooltipStyle} className="px-3 py-2 shadow-lg">
        <p className="font-semibold mb-0.5">{d.label}</p>
        <p className="text-muted-foreground">
          {d.count} respuestas — <span className="font-semibold text-foreground">{formatPercent(d.percentage)}</span>
        </p>
      </div>
    )
  }

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
    // Solo mostrar etiqueta si la porción es >= 8%
    if (percent < 0.08) return null
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
      <text
        x={x} y={y}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
      >
        {`${Math.round(percent * 100)}%`}
      </text>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Wrapper relativo para el overlay del total en el centro del donut */}
      <div className="relative w-full" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={distribution}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={donut ? 60 : 0}
              outerRadius={90}
              strokeWidth={2}
              stroke="hsl(var(--background))"
              labelLine={false}
              label={<CustomLabel />}
            >
              {distribution.map((_, i) => (
                <Cell key={i} fill={palette[i % palette.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Total centrado — overlay CSS, evita coordenadas SVG frágiles */}
        {donut && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold tabular-nums">{total}</span>
          </div>
        )}
      </div>

      {showLabels && (
        // data-html2canvas-ignore: ni flexbox ni <table> lograron que
        // html2canvas (usado para exportar a PDF) midiera bien este texto —
        // el punto de color quedaba superpuesto con la primera letra
        // ("Efectivas" salía como "Ffectivas") sin importar el layout CSS.
        // En vez de seguir peleando con el motor de captura, se le dice que
        // ignore este nodo por completo al exportar; export-report.ts dibuja
        // la leyenda con texto real de jsPDF a partir de data-export-legend
        // (ver components/reports/summary-content.tsx), nítido siempre.
        <div className={`grid ${distribution.length > 4 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"} gap-x-6 gap-y-1.5 w-full max-w-md`} data-html2canvas-ignore="true">
          {distribution.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-sm min-w-0">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: palette[i % palette.length] }} />
              <span className="flex-1 text-muted-foreground truncate" title={d.label}>{d.label}</span>
              <span className="font-medium whitespace-nowrap flex-shrink-0">{d.count} ({formatPercent(d.percentage)})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BarsVertical({ distribution, showLabels, palette }: { distribution: DistributionItem[]; showLabels: boolean; palette: string[] }) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const item = distribution.find((d) => d.label === label)
    return (
      <div style={tooltipStyle} className="px-3 py-2 shadow-lg">
        <p className="font-semibold mb-0.5 max-w-[200px] truncate">{label}</p>
        <p className="text-muted-foreground">
          {payload[0].value} respuestas
          {item ? ` — ${formatPercent(item.percentage)}` : ""}
        </p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={distribution} margin={{ top: 8, right: 8, left: -8, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} label={showLabels ? { position: "top", fontSize: 10, fill: "hsl(var(--muted-foreground))" } : false}>
          {distribution.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function BarsHorizontal({ distribution, showLabels, palette }: { distribution: DistributionItem[]; showLabels: boolean; palette: string[] }) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const item = distribution.find((d) => d.label === label)
    return (
      <div style={tooltipStyle} className="px-3 py-2 shadow-lg">
        <p className="font-semibold mb-0.5 max-w-[200px] truncate">{label}</p>
        <p className="text-muted-foreground">
          {payload[0].value} respuestas
          {item ? ` — ${formatPercent(item.percentage)}` : ""}
        </p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, distribution.length * 44)}>
      <BarChart data={distribution} layout="vertical" margin={{ top: 4, right: 48, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={130}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} label={showLabels ? { position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground))" } : false}>
          {distribution.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function Trend({ timeline, showLabels }: { timeline: TimelinePoint[]; showLabels: boolean }) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos de tendencia para esta pregunta
      </div>
    )
  }

  const data = timeline.map((t) => ({ ...t, label: t.date.slice(5) }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div style={tooltipStyle} className="px-3 py-2 shadow-lg">
        <p className="font-semibold mb-0.5">{label}</p>
        <p className="text-muted-foreground">{payload[0].value} respuestas</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 48 }}>
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
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
          interval={Math.max(0, Math.floor(data.length / 8) - 1)}
        />
        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#18b0a4"
          strokeWidth={2.5}
          fill="url(#trendGrad)"
          dot={{ r: 3, fill: "#18b0a4", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#18b0a4" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function QuestionChart({ type, distribution, timeline, showLabels, baseColor }: QuestionChartProps) {
  const palette = buildPalette(baseColor)
  if (type === "trend") return <Trend timeline={timeline || []} showLabels={showLabels} />
  if (distribution.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos para graficar
      </div>
    )
  }
  switch (type) {
    case "pie":   return <PieOrDonut distribution={distribution} donut={false} showLabels={showLabels} palette={palette} />
    case "donut": return <PieOrDonut distribution={distribution} donut={true}  showLabels={showLabels} palette={palette} />
    case "barsV": return <BarsVertical   distribution={distribution} showLabels={showLabels} palette={palette} />
    case "barsH": return <BarsHorizontal distribution={distribution} showLabels={showLabels} palette={palette} />
    default:      return null
  }
}
