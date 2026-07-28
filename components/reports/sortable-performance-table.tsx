"use client"

import { useState, useMemo } from "react"
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"

// Tabla de rendimiento por encuestador con columnas ordenables (pptx slide 23).
// Encuestador / Supervisor / Total registros / Incidencias / Abandonadas /
// Efectivas / Tasa de respuestas / Tiempo promedio.

export interface SurveyorPerformanceRow {
  name: string
  supervisorId: string | null
  totalRegistros: number
  incidencias: number
  abandonadas: number
  efectivas: number
  tasaRespuestas: number
  completionRate: number
}

type SortKey = keyof Pick<SurveyorPerformanceRow, "name" | "totalRegistros" | "incidencias" | "abandonadas" | "efectivas" | "tasaRespuestas">
type SortDir = "asc" | "desc"

const columns: { key: SortKey; label: string; align: "left" | "center" }[] = [
  { key: "name", label: "Encuestador", align: "left" },
  { key: "totalRegistros", label: "Total registros", align: "center" },
  { key: "incidencias", label: "Incidencias", align: "center" },
  { key: "abandonadas", label: "Abandonadas", align: "center" },
  { key: "efectivas", label: "Efectivas", align: "center" },
  { key: "tasaRespuestas", label: "Tasa de respuestas", align: "center" },
]

interface SortablePerformanceTableProps {
  rows: SurveyorPerformanceRow[]
  supervisorNameById?: Record<string, string>
}

export function SortablePerformanceTable({ rows, supervisorNameById = {} }: SortablePerformanceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("totalRegistros")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number)
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
    return <p className="text-sm text-muted-foreground py-8 text-center">No hay datos de encuestadores disponibles</p>
  }

  return (
    <div className="rounded-md border overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
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
                    sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-30" />
                  )}
                </span>
              </th>
            ))}
            <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Supervisor</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((row, i) => (
            <tr key={i} className="hover:bg-muted/20 transition-colors">
              <td className="p-3 font-medium">{row.name}</td>
              <td className="p-3 text-center">{row.totalRegistros}</td>
              <td className="p-3 text-center">
                <span className={row.incidencias > 0 ? "text-red-500 font-medium" : "text-muted-foreground"}>{row.incidencias}</span>
              </td>
              <td className="p-3 text-center">
                <span className={row.abandonadas > 0 ? "text-amber-500 font-medium" : "text-muted-foreground"}>{row.abandonadas}</span>
              </td>
              <td className="p-3 text-center">
                <span className="text-[#18b0a4] font-medium">{row.efectivas}</span>
              </td>
              <td className="p-3 text-center">
                <span className="font-semibold" style={{ color: row.tasaRespuestas >= 80 ? "#18b0a4" : row.tasaRespuestas >= 50 ? "#f59e0b" : "#ef4444" }}>
                  {row.tasaRespuestas}%
                </span>
              </td>
              <td className="p-3 text-center text-xs text-muted-foreground">
                {row.supervisorId ? (supervisorNameById[row.supervisorId] ?? "—") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
