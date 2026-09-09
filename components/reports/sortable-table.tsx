"use client"

import { useState, useMemo, type ReactNode } from "react"
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"

// Tabla genérica ordenable — ítem 09/09/2026: "habilitar orden ascendente y
// descendente en todas las tablas — no limitar esta función a 'Rendimiento
// por encuestador'". SortablePerformanceTable (components/reports/
// sortable-performance-table.tsx) ya cubría esa; este componente generaliza
// el mismo patrón (click en encabezado, flechas, memo del sort) para
// reutilizarlo en el resto de tablas de Reportes sin repetir la lógica cada
// vez.
export interface SortableColumn<T> {
  key: string
  label: string
  align?: "left" | "center"
  // Valor usado para comparar al ordenar — por defecto castea la celda
  // renderizada, así que la mayoría de columnas numéricas/texto simples no
  // necesitan pasarlo; solo hace falta cuando el render() no es directamente
  // comparable (ej. un badge con color).
  sortValue?: (row: T) => string | number
  render: (row: T) => ReactNode
  sortable?: boolean // default true
}

interface SortableTableProps<T> {
  rows: T[]
  columns: SortableColumn<T>[]
  defaultSortKey?: string
  defaultSortDir?: "asc" | "desc"
  emptyMessage?: string
  rowKey?: (row: T, index: number) => string | number
}

export function SortableTable<T>({
  rows,
  columns,
  defaultSortKey,
  defaultSortDir = "desc",
  emptyMessage = "Sin datos disponibles",
  rowKey,
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey)
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSortDir)

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    const col = columns.find((c) => c.key === sortKey)
    if (!col) return rows
    const getValue = col.sortValue ?? ((row: T) => (row as any)[col.key])
    const copy = [...rows]
    copy.sort((a, b) => {
      let av = getValue(a)
      let bv = getValue(b)
      if (av === null || av === undefined) av = ""
      if (bv === null || bv === undefined) bv = ""
      const cmp = typeof av === "string" || typeof bv === "string"
        ? String(av).localeCompare(String(bv))
        : (av as number) - (bv as number)
      return sortDir === "asc" ? cmp : -cmp
    })
    return copy
  }, [rows, columns, sortKey, sortDir])

  const toggleSort = (key: string) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{emptyMessage}</p>
  }

  return (
    <div className="rounded-md border overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b">
            {columns.map((col) => {
              const sortable = col.sortable !== false
              return (
                <th
                  key={col.key}
                  onClick={sortable ? () => toggleSort(col.key) : undefined}
                  className={`p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide select-none transition-colors ${
                    col.align === "center" ? "text-center" : "text-left"
                  } ${sortable ? "cursor-pointer hover:text-foreground" : ""}`}
                >
                  <span className={`inline-flex items-center gap-1 ${col.align === "center" ? "justify-center" : ""}`}>
                    {col.label}
                    {sortable && (
                      sortKey === col.key ? (
                        sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )
                    )}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((row, i) => (
            <tr key={rowKey ? rowKey(row, i) : i} className="hover:bg-muted/20 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className={`p-3 ${col.align === "center" ? "text-center" : ""}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
