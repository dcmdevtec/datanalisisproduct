"use client"

import { useState, useMemo } from "react"
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { formatPercent } from "@/lib/format"

// Tabla de rendimiento por encuestador — pptx slide 25 + ajustes reunión
// 2026-08-27 (agrega Descalificadas, Hora inicio y Hora final).
// Columnas: Encuestador · Supervisor · Total registros · Incidencias ·
//           Abandonadas · Descalificadas · Efectivas · Tasa de respuestas ·
//           Tiempo promedio · Hora inicio 1ra · Hora final última
// Todas las columnas numéricas son ordenables (asc/desc).

export interface SurveyorPerformanceRow {
  name: string
  supervisorId: string | null
  supervisorName: string | null
  totalRegistros: number
  incidencias: number
  abandonadas: number
  descalificadas: number
  efectivas: number
  tasaRespuestas: number
  avgTime: string      // "m:ss" o "—"
  completionRate: number
  firstResponseAt: string | null
  lastResponseAt: string | null
}

type SortKey = "name" | "supervisorName" | "totalRegistros" | "incidencias" | "abandonadas" | "descalificadas" | "efectivas" | "tasaRespuestas"
type SortDir = "asc" | "desc"

interface ColDef {
  key: SortKey
  label: string
  align: "left" | "center"
}

const columns: ColDef[] = [
  { key: "name",            label: "Encuestador",       align: "left"   },
  { key: "supervisorName",  label: "Supervisor",         align: "left"   },
  { key: "totalRegistros",  label: "Total registros",    align: "center" },
  { key: "incidencias",     label: "Incidencias",        align: "center" },
  { key: "abandonadas",     label: "Abandonadas",        align: "center" },
  { key: "descalificadas",  label: "Descalificadas",     align: "center" },
  { key: "efectivas",       label: "Efectivas",          align: "center" },
  { key: "tasaRespuestas",  label: "Tasa",               align: "center" },
]

function formatHour(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
}

interface SortablePerformanceTableProps {
  rows: SurveyorPerformanceRow[]
}

export function SortablePerformanceTable({ rows }: SortablePerformanceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("totalRegistros")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      let av: string | number = a[sortKey] ?? ""
      let bv: string | number = b[sortKey] ?? ""
      // null → empty string (Supervisor puede ser null)
      if (av === null) av = ""
      if (bv === null) bv = ""
      const cmp = typeof av === "string"
        ? (av as string).localeCompare(bv as string)
        : (av as number) - (bv as number)
      return sortDir === "asc" ? cmp : -cmp
    })
    return copy
  }, [rows, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No hay datos de encuestadores disponibles
      </p>
    )
  }

  return (
    <div className="rounded-md border overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead>
          <tr className="bg-muted/50 border-b">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                className={`p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors ${col.align === "center" ? "text-center" : "text-left"}`}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key ? (
                    sortDir === "asc"
                      ? <ArrowUp className="h-3 w-3" />
                      : <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-30" />
                  )}
                </span>
              </th>
            ))}
            {/* Tiempo promedio, horas de inicio/fin — no sortable */}
            <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">
              Tiempo prom.
            </th>
            <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">
              Inicio 1ra
            </th>
            <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">
              Fin última
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((row, i) => (
            <tr key={i} className="hover:bg-muted/20 transition-colors">
              {/* Encuestador */}
              <td className="p-3 font-medium whitespace-nowrap">{row.name}</td>
              {/* Supervisor */}
              <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                {row.supervisorName || <span className="opacity-40">—</span>}
              </td>
              {/* Total */}
              <td className="p-3 text-center font-medium">{row.totalRegistros}</td>
              {/* Incidencias */}
              <td className="p-3 text-center">
                <span className={row.incidencias > 0 ? "text-red-500 font-medium" : "text-muted-foreground"}>
                  {row.incidencias}
                </span>
              </td>
              {/* Abandonadas */}
              <td className="p-3 text-center">
                <span className={row.abandonadas > 0 ? "text-amber-500 font-medium" : "text-muted-foreground"}>
                  {row.abandonadas}
                </span>
              </td>
              {/* Descalificadas */}
              <td className="p-3 text-center">
                <span className={row.descalificadas > 0 ? "text-purple-500 font-medium" : "text-muted-foreground"}>
                  {row.descalificadas}
                </span>
              </td>
              {/* Efectivas */}
              <td className="p-3 text-center">
                <span className="text-[#18b0a4] font-medium">{row.efectivas}</span>
              </td>
              {/* Tasa */}
              <td className="p-3 text-center">
                <span
                  className="font-semibold"
                  style={{
                    color: row.tasaRespuestas >= 80
                      ? "#18b0a4"
                      : row.tasaRespuestas >= 50
                      ? "#f59e0b"
                      : "#ef4444",
                  }}
                >
                  {formatPercent(row.tasaRespuestas)}
                </span>
              </td>
              {/* Tiempo promedio efectiva */}
              <td className="p-3 text-center text-xs font-mono text-muted-foreground">
                {row.avgTime}
              </td>
              {/* Hora inicio 1ra encuesta */}
              <td className="p-3 text-center text-xs font-mono text-muted-foreground">
                {formatHour(row.firstResponseAt)}
              </td>
              {/* Hora final última encuesta */}
              <td className="p-3 text-center text-xs font-mono text-muted-foreground">
                {formatHour(row.lastResponseAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
