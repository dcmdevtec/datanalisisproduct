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
  /** Colores personalizados por opción (clave = label), no un color global. */
  colorOverrides?: Record<string, string>
  /** Label de la barra/porción actualmente seleccionada (resalte visual). */
  selectedLabel?: string | null
  /** Se dispara al hacer clic en una barra/porción o en su entrada de leyenda. */
  onSelectLabel?: (label: string) => void
}

export const DEFAULT_PALETTE = [
  "#18b0a4", "#2563eb", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#84cc16", "#06b6d4",
]

// #18 (reunión 07/09/2026, "solo permite personalizar parte de la gráfica")
// pasó por dos versiones: primero solo se pintaba la primera barra; luego se
// generaban tonos del mismo color para TODA la gráfica. El cliente aclaró
// (08/09/2026) que lo que quiere es personalización POR barra: seleccionar
// una barra/porción puntual y que el color elegido cambie SOLO esa, no todas.
// `colorOverrides` guarda esos colores puntuales por label; el resto de
// barras conserva la paleta por defecto (o su propio override, si tiene uno).
// Exportada (09/09/2026) para que question-card.tsx pueda armar el mismo
// data-export-legend que summary-content.tsx — así el color de cada fila de
// la leyenda dibujada en el PDF coincide exactamente con el de la porción/
// barra en pantalla (incluye colorOverrides).
export function colorFor(label: string, index: number, overrides?: Record<string, string>): string {
  return overrides?.[label] || DEFAULT_PALETTE[index % DEFAULT_PALETTE.length]
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
  colorOverrides,
  selectedLabel,
  onSelectLabel,
}: {
  distribution: DistributionItem[]
  donut: boolean
  showLabels: boolean
  colorOverrides?: Record<string, string>
  selectedLabel?: string | null
  onSelectLabel?: (label: string) => void
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

  // Ítem 09/09/2026: "mostrar número absoluto y porcentaje en todas las
  // gráficas" — la torta/anillo ya lo mostraba en tooltip y leyenda, pero
  // la etiqueta fija sobre la porción solo traía el %. Se agrega el
  // absoluto (mismo formato "N (P%)" que ya usan las barras).
  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }: any) => {
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
        fontSize={11}
        fontWeight={600}
      >
        {`${value} (${formatPercent(percent * 100)})`}
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
              {distribution.map((d, i) => (
                <Cell
                  key={i}
                  fill={colorFor(d.label, i, colorOverrides)}
                  onClick={() => onSelectLabel?.(d.label)}
                  cursor={onSelectLabel ? "pointer" : undefined}
                  stroke={d.label === selectedLabel ? "hsl(var(--foreground))" : "hsl(var(--background))"}
                  strokeWidth={d.label === selectedLabel ? 3 : 2}
                />
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
            <button
              key={i}
              type="button"
              onClick={() => onSelectLabel?.(d.label)}
              className={`flex items-center gap-2 text-sm min-w-0 rounded px-1 -mx-1 transition-colors ${
                onSelectLabel ? "hover:bg-muted cursor-pointer" : ""
              } ${d.label === selectedLabel ? "ring-1 ring-foreground/40 bg-muted/60" : ""}`}
              title={onSelectLabel ? `Seleccionar "${d.label}" para cambiar su color` : d.label}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorFor(d.label, i, colorOverrides) }} />
              <span className="flex-1 text-left text-muted-foreground truncate" title={d.label}>{d.label}</span>
              <span className="font-medium whitespace-nowrap flex-shrink-0">{d.count} ({formatPercent(d.percentage)})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function BarsVertical({
  distribution,
  showLabels,
  colorOverrides,
  selectedLabel,
  onSelectLabel,
}: {
  distribution: DistributionItem[]
  showLabels: boolean
  colorOverrides?: Record<string, string>
  selectedLabel?: string | null
  onSelectLabel?: (label: string) => void
}) {
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

  // Pedido en reunión 07/09/2026 (#19): las barras deben mostrar número Y
  // porcentaje visibles en el gráfico, no solo el número (el porcentaje ya
  // estaba pero únicamente en el tooltip al pasar el mouse).
  const ValueLabel = ({ x, y, width, value, index }: any) => (
    <text x={x + width / 2} y={y} dy={-6} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">
      {value} ({formatPercent(distribution[index]?.percentage ?? 0)})
    </text>
  )

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
        <Bar dataKey="count" radius={[4, 4, 0, 0]} label={showLabels ? <ValueLabel /> : false}>
          {distribution.map((d, i) => (
            <Cell
              key={i}
              fill={colorFor(d.label, i, colorOverrides)}
              onClick={() => onSelectLabel?.(d.label)}
              cursor={onSelectLabel ? "pointer" : undefined}
              stroke={d.label === selectedLabel ? "hsl(var(--foreground))" : undefined}
              strokeWidth={d.label === selectedLabel ? 2 : 0}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function BarsHorizontal({
  distribution,
  showLabels,
  colorOverrides,
  selectedLabel,
  onSelectLabel,
}: {
  distribution: DistributionItem[]
  showLabels: boolean
  colorOverrides?: Record<string, string>
  selectedLabel?: string | null
  onSelectLabel?: (label: string) => void
}) {
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

  // Ver nota en BarsVertical (#19, reunión 07/09/2026): número + porcentaje
  // visibles en la barra, no solo al hacer hover.
  const ValueLabel = ({ x, y, width, height, value, index }: any) => (
    <text x={x + width + 6} y={y + height / 2} dy={4} textAnchor="start" fontSize={10} fill="hsl(var(--muted-foreground))">
      {value} ({formatPercent(distribution[index]?.percentage ?? 0)})
    </text>
  )

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, distribution.length * 44)}>
      <BarChart data={distribution} layout="vertical" margin={{ top: 4, right: 72, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={130}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} label={showLabels ? <ValueLabel /> : false}>
          {distribution.map((d, i) => (
            <Cell
              key={i}
              fill={colorFor(d.label, i, colorOverrides)}
              onClick={() => onSelectLabel?.(d.label)}
              cursor={onSelectLabel ? "pointer" : undefined}
              stroke={d.label === selectedLabel ? "hsl(var(--foreground))" : undefined}
              strokeWidth={d.label === selectedLabel ? 2 : 0}
            />
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

export function QuestionChart({ type, distribution, timeline, showLabels, colorOverrides, selectedLabel, onSelectLabel }: QuestionChartProps) {
  if (type === "trend") return <Trend timeline={timeline || []} showLabels={showLabels} />
  if (distribution.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos para graficar
      </div>
    )
  }
  switch (type) {
    case "pie":   return <PieOrDonut distribution={distribution} donut={false} showLabels={showLabels} colorOverrides={colorOverrides} selectedLabel={selectedLabel} onSelectLabel={onSelectLabel} />
    case "donut": return <PieOrDonut distribution={distribution} donut={true}  showLabels={showLabels} colorOverrides={colorOverrides} selectedLabel={selectedLabel} onSelectLabel={onSelectLabel} />
    case "barsV": return <BarsVertical   distribution={distribution} showLabels={showLabels} colorOverrides={colorOverrides} selectedLabel={selectedLabel} onSelectLabel={onSelectLabel} />
    case "barsH": return <BarsHorizontal distribution={distribution} showLabels={showLabels} colorOverrides={colorOverrides} selectedLabel={selectedLabel} onSelectLabel={onSelectLabel} />
    default:      return null
  }
}
