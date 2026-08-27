// Formato de porcentaje con 1 decimal y coma (es-CO), ej. 33,3% — antes se
// redondeaba a entero en todo el módulo de Reportes, lo que hacía que
// "Efectivas/Incidencias/Abandonadas/Descalificadas" nunca sumaran
// exactamente 100% a la vista del cliente.
export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value)) return "0%"
  return `${value.toLocaleString("es-CO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`
}
