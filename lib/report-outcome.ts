// Clasificación de resultado de una respuesta para el módulo de Reportes.
// Extraído de 5 copias idénticas repartidas en distintas rutas de /api/reports
// y /api/public-report — un solo lugar para agregar nuevas categorías (ver
// "descalificado", agregado para el salto de lógica "Descalificar y terminar").
export type ReportOutcome = "efectiva" | "incidencia" | "abandonada" | "descalificado"

export function resolveOutcome(r: { outcome?: string | null; status?: string | null }): ReportOutcome {
  if (r.outcome === "efectiva" || r.outcome === "incidencia" || r.outcome === "abandonada" || r.outcome === "descalificado") {
    return r.outcome
  }
  return r.status === "completed" ? "efectiva" : "abandonada"
}
