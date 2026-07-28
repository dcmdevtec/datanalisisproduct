"use client"

// Renderiza los 5 tipos de gráfico pedidos en el pptx (slide 21, "Análisis de
// resultados"): torta, anillo, barras verticales, barras horizontales y tendencia.
// Construido en SVG/CSS puro para no sumar una librería de charts nueva al bundle
// (el proyecto ya carga bastante: recharts, leaflet, tiptap, quill).

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
}

const PALETTE = [
  "#18b0a4", "#2563eb", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#84cc16", "#06b6d4",
]

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1"
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`
}

function PieOrDonut({ distribution, donut, showLabels }: { distribution: DistributionItem[]; donut: boolean; showLabels: boolean }) {
  const total = distribution.reduce((s, d) => s + d.count, 0) || 1
  let cumulativeAngle = 0
  const cx = 100, cy = 100, r = 90

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 200 200" className="w-full max-w-[260px]">
        {distribution.map((d, i) => {
          const angle = (d.count / total) * 360
          const path = arcPath(cx, cy, r, cumulativeAngle, cumulativeAngle + angle)
          cumulativeAngle += angle
          return <path key={i} d={path} fill={PALETTE[i % PALETTE.length]} stroke="#fff" strokeWidth={1.5} />
        })}
        {donut && <circle cx={cx} cy={cy} r={48} fill="var(--background, #fff)" />}
        {donut && (
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="fill-foreground" style={{ fontSize: 22, fontWeight: 700 }}>
            {total}
          </text>
        )}
      </svg>
      {showLabels && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 w-full max-w-md">
          {distribution.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-sm min-w-0">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="truncate flex-1 text-muted-foreground" title={d.label}>{d.label}</span>
              <span className="font-medium whitespace-nowrap">{d.count} ({d.percentage}%)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BarsVertical({ distribution, showLabels }: { distribution: DistributionItem[]; showLabels: boolean }) {
  const max = Math.max(...distribution.map((d) => d.count), 1)
  return (
    <div className="h-64 flex items-end gap-3 pt-6 px-2">
      {distribution.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group min-w-0">
          {showLabels && <span className="text-xs font-medium mb-1">{d.count}</span>}
          <div
            className="w-full rounded-t-sm min-h-[3px] transition-all"
            style={{ height: `${Math.max((d.count / max) * 100, 2)}%`, background: PALETTE[i % PALETTE.length] }}
            title={`${d.label}: ${d.count} (${d.percentage}%)`}
          />
          {showLabels && (
            <span className="text-[10px] text-muted-foreground mt-1.5 text-center truncate w-full" title={d.label}>
              {d.label}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function BarsHorizontal({ distribution, showLabels }: { distribution: DistributionItem[]; showLabels: boolean }) {
  const max = Math.max(...distribution.map((d) => d.count), 1)
  return (
    <div className="space-y-3 py-2">
      {distribution.map((d, i) => (
        <div key={i} className="space-y-1">
          {showLabels && (
            <div className="flex items-center justify-between text-sm">
              <span className="truncate max-w-[70%]" title={d.label}>{d.label}</span>
              <span className="text-muted-foreground whitespace-nowrap">{d.count} ({d.percentage}%)</span>
            </div>
          )}
          <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.max((d.count / max) * 100, 2)}%`, background: PALETTE[i % PALETTE.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function Trend({ timeline, showLabels }: { timeline: TimelinePoint[]; showLabels: boolean }) {
  if (!timeline || timeline.length === 0) {
    return <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">Sin datos de tendencia para esta pregunta</div>
  }
  const max = Math.max(...timeline.map((t) => t.count), 1)
  return (
    <div className="h-56 flex items-end gap-0.5 pt-6 relative">
      {[25, 50, 75].map((pct) => (
        <div key={pct} className="absolute left-0 right-0 border-t border-dashed border-muted" style={{ bottom: `${pct}%` }} />
      ))}
      {timeline.map((t, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
          {showLabels && <span className="text-[10px] text-muted-foreground mb-0.5">{t.count > 0 ? t.count : ""}</span>}
          <div
            className="w-full bg-[#18b0a4]/80 hover:bg-[#18b0a4] rounded-t-sm min-h-[3px] transition-all"
            style={{ height: `${Math.max((t.count / max) * 100, 2)}%` }}
            title={`${t.date}: ${t.count}`}
          />
          {timeline.length <= 20 && (
            <span className="text-[9px] text-muted-foreground mt-1 truncate w-full text-center">{t.date.slice(5)}</span>
          )}
        </div>
      ))}
    </div>
  )
}

export function QuestionChart({ type, distribution, timeline, showLabels }: QuestionChartProps) {
  if (type === "trend") return <Trend timeline={timeline || []} showLabels={showLabels} />
  if (distribution.length === 0) {
    return <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">Sin datos para graficar</div>
  }
  switch (type) {
    case "pie": return <PieOrDonut distribution={distribution} donut={false} showLabels={showLabels} />
    case "donut": return <PieOrDonut distribution={distribution} donut={true} showLabels={showLabels} />
    case "barsV": return <BarsVertical distribution={distribution} showLabels={showLabels} />
    case "barsH": return <BarsHorizontal distribution={distribution} showLabels={showLabels} />
    default: return null
  }
}
