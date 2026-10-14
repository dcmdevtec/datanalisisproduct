"use client"

import { Fragment, useMemo, useState } from "react"
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react"
import { formatPercent } from "@/lib/format"
import { bogotaDateTime } from "@/lib/bogota-time"
import { Badge } from "@/components/ui/badge"

// Tabla de rendimiento por encuestador — pptx slide 25 + ajustes reunión
// 2026-08-27 (agrega Descalificadas, Hora inicio y Hora final).
//
// Ítem "Rendimiento por Encuestador" (acta de ajustes 05/10/2026):
// "Agruparlos por equipos de la encuesta, similar a una tabla dinámica y
// uno poder desplegar u ocultar el detalle" — antes era una tabla PLANA
// (una fila por encuestador, columna "Supervisor" de solo texto, sin
// Coordinador ni subtotales). Se reemplaza por un árbol Coordinador >
// Supervisor > Encuestador, colapsable en ambos niveles, con una fila de
// subtotal (suma de Total/Incidencias/Abandonadas/Descalificadas/Efectivas
// + Tasa recalculada) en cada nivel de grupo. Tiempo promedio y las fechas
// de inicio/fin no se subtotalizan (son valores ya formateados por
// encuestador, no tiene sentido promediar texto "m:ss" sin los segundos
// crudos) — esas columnas quedan vacías en las filas de grupo.
//
// El orden de columnas sigue siendo ordenable, pero el click en el
// encabezado solo reordena las filas DE ENCUESTADOR dentro de cada grupo
// Coordinador→Supervisor — los grupos en sí van siempre ordenados por su
// propio subtotal de Total registros (descendente), que es el mismo orden
// por el que la tabla plana anterior arrancaba por defecto.

export interface SurveyorPerformanceRow {
  name: string
  supervisorId: string | null
  supervisorName: string | null
  coordinatorId: string | null
  coordinatorName: string | null
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

type SortKey = "name" | "totalRegistros" | "incidencias" | "abandonadas" | "descalificadas" | "efectivas" | "tasaRespuestas"
type SortDir = "asc" | "desc"

interface ColDef {
  key: SortKey
  label: string
  align: "left" | "center"
}

const columns: ColDef[] = [
  { key: "name",            label: "Encuestador",       align: "left"   },
  { key: "totalRegistros",  label: "Total registros",    align: "center" },
  { key: "incidencias",     label: "Incidencias",        align: "center" },
  { key: "abandonadas",     label: "Abandonadas",        align: "center" },
  { key: "descalificadas",  label: "Descalificadas",     align: "center" },
  { key: "efectivas",       label: "Efectivas",          align: "center" },
  { key: "tasaRespuestas",  label: "Tasa",               align: "center" },
]

const NONE_KEY = "__none__"

// Ítem 14/10/2026: "cambiar la hora de inicio y fin por fecha de inicio y
// fecha fin, no por hora" — antes mostraba solo HH:MM, además calculado en
// la hora local del SERVIDOR (new Date().toLocaleTimeString sin timeZone
// explícito), el mismo bug documentado en lib/bogota-time.ts. Se usa
// bogotaDateTime().date, igual que "Rendimiento por Encuesta" en
// app/reports/page.tsx (misma tabla, deben coincidir).
function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return bogotaDateTime(iso).date
}

interface Subtotal {
  totalRegistros: number
  incidencias: number
  abandonadas: number
  descalificadas: number
  efectivas: number
  tasaRespuestas: number
}

function sumRows(rows: SurveyorPerformanceRow[]): Subtotal {
  const totalRegistros = rows.reduce((s, r) => s + r.totalRegistros, 0)
  const incidencias = rows.reduce((s, r) => s + r.incidencias, 0)
  const abandonadas = rows.reduce((s, r) => s + r.abandonadas, 0)
  const descalificadas = rows.reduce((s, r) => s + r.descalificadas, 0)
  const efectivas = rows.reduce((s, r) => s + r.efectivas, 0)
  return {
    totalRegistros, incidencias, abandonadas, descalificadas, efectivas,
    tasaRespuestas: totalRegistros > 0 ? Math.round((efectivas / totalRegistros) * 1000) / 10 : 0,
  }
}

interface SupervisorGroup {
  key: string
  label: string
  rows: SurveyorPerformanceRow[]
  subtotal: Subtotal
}

interface CoordinatorGroup {
  key: string
  label: string
  supervisorGroups: SupervisorGroup[]
  subtotal: Subtotal
}

function groupRows(rows: SurveyorPerformanceRow[]): CoordinatorGroup[] {
  const byCoordinator = new Map<string, { label: string; rows: SurveyorPerformanceRow[] }>()
  for (const row of rows) {
    const key = row.coordinatorId ?? NONE_KEY
    if (!byCoordinator.has(key)) byCoordinator.set(key, { label: row.coordinatorName ?? "Sin coordinador", rows: [] })
    byCoordinator.get(key)!.rows.push(row)
  }

  const groups: CoordinatorGroup[] = Array.from(byCoordinator.entries()).map(([key, { label, rows: coordRows }]) => {
    const bySupervisor = new Map<string, { label: string; rows: SurveyorPerformanceRow[] }>()
    for (const row of coordRows) {
      const supKey = row.supervisorId ?? NONE_KEY
      if (!bySupervisor.has(supKey)) bySupervisor.set(supKey, { label: row.supervisorName ?? "Sin supervisor", rows: [] })
      bySupervisor.get(supKey)!.rows.push(row)
    }
    const supervisorGroups: SupervisorGroup[] = Array.from(bySupervisor.entries())
      .map(([supKey, { label: supLabel, rows: supRows }]) => ({ key: supKey, label: supLabel, rows: supRows, subtotal: sumRows(supRows) }))
      .sort((a, b) => b.subtotal.totalRegistros - a.subtotal.totalRegistros)
    return { key, label, supervisorGroups, subtotal: sumRows(coordRows) }
  })

  return groups.sort((a, b) => b.subtotal.totalRegistros - a.subtotal.totalRegistros)
}

interface SortablePerformanceTableProps {
  rows: SurveyorPerformanceRow[]
}

export function SortablePerformanceTable({ rows }: SortablePerformanceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("totalRegistros")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [collapsedCoordinators, setCollapsedCoordinators] = useState<Set<string>>(new Set())
  const [collapsedSupervisors, setCollapsedSupervisors] = useState<Set<string>>(new Set())

  const groups = useMemo(() => groupRows(rows), [rows])

  const sortRows = (list: SurveyorPerformanceRow[]) => {
    const copy = [...list]
    copy.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number)
      return sortDir === "asc" ? cmp : -cmp
    })
    return copy
  }

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const toggleCoordinator = (key: string) => {
    setCollapsedCoordinators((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const toggleSupervisor = (key: string) => {
    setCollapsedSupervisors((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No hay datos de encuestadores disponibles
      </p>
    )
  }

  const subtotalCell = (value: number, colorByValue?: boolean, variant?: "red" | "amber" | "purple" | "teal") => {
    const colorClass = !colorByValue
      ? ""
      : variant === "red" ? (value > 0 ? "text-red-500" : "text-muted-foreground")
      : variant === "amber" ? (value > 0 ? "text-amber-500" : "text-muted-foreground")
      : variant === "purple" ? (value > 0 ? "text-purple-500" : "text-muted-foreground")
      : "text-[#18b0a4]"
    return <span className={`font-semibold ${colorClass}`}>{value}</span>
  }

  return (
    <div className="rounded-md border overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[760px]">
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
            <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Tiempo prom.</th>
            <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Inicio 1ra</th>
            <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Fin última</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {groups.map((coordGroup) => {
            const coordCollapsed = collapsedCoordinators.has(coordGroup.key)
            const coordTotalSurveyors = coordGroup.supervisorGroups.reduce((s, g) => s + g.rows.length, 0)
            return (
              <Fragment key={`coord-${coordGroup.key}`}>
                {/* ── Grupo Coordinador ── */}
                <tr className="bg-muted/40 hover:bg-muted/60 transition-colors">
                  <td className="p-2.5">
                    <button
                      type="button"
                      onClick={() => toggleCoordinator(coordGroup.key)}
                      className="inline-flex items-center gap-1.5 font-semibold text-sm"
                    >
                      {coordCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {coordGroup.label}
                      <Badge variant="secondary" className="ml-1">{coordTotalSurveyors}</Badge>
                    </button>
                  </td>
                  <td className="p-2.5 text-center font-semibold">{coordGroup.subtotal.totalRegistros}</td>
                  <td className="p-2.5 text-center">{subtotalCell(coordGroup.subtotal.incidencias, true, "red")}</td>
                  <td className="p-2.5 text-center">{subtotalCell(coordGroup.subtotal.abandonadas, true, "amber")}</td>
                  <td className="p-2.5 text-center">{subtotalCell(coordGroup.subtotal.descalificadas, true, "purple")}</td>
                  <td className="p-2.5 text-center">{subtotalCell(coordGroup.subtotal.efectivas, true, "teal")}</td>
                  <td className="p-2.5 text-center font-semibold" style={{ color: coordGroup.subtotal.tasaRespuestas >= 80 ? "#18b0a4" : coordGroup.subtotal.tasaRespuestas >= 50 ? "#f59e0b" : "#ef4444" }}>
                    {formatPercent(coordGroup.subtotal.tasaRespuestas)}
                  </td>
                  <td colSpan={3} />
                </tr>

                {!coordCollapsed && coordGroup.supervisorGroups.map((supGroup) => {
                  const supKey = `${coordGroup.key}::${supGroup.key}`
                  const supCollapsed = collapsedSupervisors.has(supKey)
                  return (
                    <Fragment key={`sup-${supKey}`}>
                      {/* ── Subgrupo Supervisor ── */}
                      <tr className="bg-muted/15 hover:bg-muted/30 transition-colors">
                        <td className="p-2 pl-8">
                          <button
                            type="button"
                            onClick={() => toggleSupervisor(supKey)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                          >
                            {supCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {supGroup.label}
                            <Badge variant="outline" className="ml-1">{supGroup.rows.length}</Badge>
                          </button>
                        </td>
                        <td className="p-2 text-center text-xs font-semibold">{supGroup.subtotal.totalRegistros}</td>
                        <td className="p-2 text-center text-xs">{subtotalCell(supGroup.subtotal.incidencias, true, "red")}</td>
                        <td className="p-2 text-center text-xs">{subtotalCell(supGroup.subtotal.abandonadas, true, "amber")}</td>
                        <td className="p-2 text-center text-xs">{subtotalCell(supGroup.subtotal.descalificadas, true, "purple")}</td>
                        <td className="p-2 text-center text-xs">{subtotalCell(supGroup.subtotal.efectivas, true, "teal")}</td>
                        <td className="p-2 text-center text-xs font-semibold" style={{ color: supGroup.subtotal.tasaRespuestas >= 80 ? "#18b0a4" : supGroup.subtotal.tasaRespuestas >= 50 ? "#f59e0b" : "#ef4444" }}>
                          {formatPercent(supGroup.subtotal.tasaRespuestas)}
                        </td>
                        <td colSpan={3} />
                      </tr>

                      {!supCollapsed && sortRows(supGroup.rows).map((row, i) => (
                        <tr key={`row-${supKey}-${i}`} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3 pl-14 font-medium whitespace-nowrap">{row.name}</td>
                          <td className="p-3 text-center font-medium">{row.totalRegistros}</td>
                          <td className="p-3 text-center">
                            <span className={row.incidencias > 0 ? "text-red-500 font-medium" : "text-muted-foreground"}>{row.incidencias}</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={row.abandonadas > 0 ? "text-amber-500 font-medium" : "text-muted-foreground"}>{row.abandonadas}</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={row.descalificadas > 0 ? "text-purple-500 font-medium" : "text-muted-foreground"}>{row.descalificadas}</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="text-[#18b0a4] font-medium">{row.efectivas}</span>
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className="font-semibold"
                              style={{ color: row.tasaRespuestas >= 80 ? "#18b0a4" : row.tasaRespuestas >= 50 ? "#f59e0b" : "#ef4444" }}
                            >
                              {formatPercent(row.tasaRespuestas)}
                            </span>
                          </td>
                          <td className="p-3 text-center text-xs font-mono text-muted-foreground">{row.avgTime}</td>
                          <td className="p-3 text-center text-xs font-mono text-muted-foreground">{formatDate(row.firstResponseAt)}</td>
                          <td className="p-3 text-center text-xs font-mono text-muted-foreground">{formatDate(row.lastResponseAt)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
