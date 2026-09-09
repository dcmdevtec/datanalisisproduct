// Helpers de fecha/hora en zona horaria de Bogotá (America/Bogota, UTC-5 fijo
// todo el año — Colombia no observa horario de verano).
//
// `created_at` (y demás timestamps) se guardan en UTC. Usar
// `new Date(...).getHours()/getDay()/toISOString().slice(0,10)` da la hora/
// fecha LOCAL DEL SERVIDOR (en Vercel/Node eso normalmente es UTC), no la de
// Bogotá — ese es el bug reportado en la reunión 07/09/2026 (#15: "hice la
// encuesta a las 3pm y aparece a las 8pm" = exactamente el desfase de 5h).
//
// app/api/reports/route.ts fue el primero en corregirse (tiene su propia
// copia de estos mismos helpers, sin tocar acá para no arriesgar ese archivo
// ya probado). Este módulo compartido existe para los demás lugares que
// agrupan/muestran por hora o día y todavía no tenían el fix (09/09/2026):
// exports Excel, reporte público con token, y el reporte público legado.
export const BOGOTA_TZ = "America/Bogota"

const bogotaHourFormatter = new Intl.DateTimeFormat("en-US", { timeZone: BOGOTA_TZ, hour: "2-digit", hourCycle: "h23" })
const bogotaDayKeyFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: BOGOTA_TZ, year: "numeric", month: "2-digit", day: "2-digit" })
const bogotaDateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  timeZone: BOGOTA_TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
})

/** Hora (0-23) del timestamp, en hora de Bogotá. */
export function bogotaHour(dateStr: string): number {
  return Number(bogotaHourFormatter.format(new Date(dateStr)))
}

/** "YYYY-MM-DD" del timestamp, en hora de Bogotá (en-CA da formato ISO por defecto). */
export function bogotaDayKey(dateStr: string): string {
  return bogotaDayKeyFormatter.format(new Date(dateStr))
}

/**
 * Índice de día de la semana (0=domingo … 6=sábado) del timestamp, en hora
 * de Bogotá — para el mismo bucketing que ya usaba `new Date().getDay()`,
 * pero sobre la fecha calendario correcta. El día de la semana de una fecha
 * calendario no depende de en qué zona horaria se interprete la medianoche,
 * así que basta construir la fecha local a partir de bogotaDayKey().
 */
export function bogotaDayIndex(dateStr: string): number {
  return new Date(`${bogotaDayKey(dateStr)}T00:00:00`).getDay()
}

/** Fecha y hora completas formateadas en es-CO, hora de Bogotá — reemplazo directo de `date.toLocaleDateString("es-CO")` + `date.toLocaleTimeString("es-CO", ...)` sin timeZone explícito. */
export function bogotaDateTime(dateStr: string): { date: string; time: string } {
  const parts = bogotaDateTimeFormatter.formatToParts(new Date(dateStr))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return {
    date: `${get("day")}/${get("month")}/${get("year")}`,
    time: `${get("hour")}:${get("minute")}`,
  }
}

/**
 * Instante UTC que corresponde a las 00:00:00 de HOY en Bogotá — para
 * filtros tipo "respuestas de hoy" (`.gte("created_at", ...)`). Ítem
 * 09/09/2026: "reiniciar diariamente los indicadores operativos... la
 * primera y última hora deben ser del mismo día, no arrastrarse desde el
 * día anterior". `new Date(); .setHours(0,0,0,0)` calcula la medianoche en
 * la hora LOCAL DEL SERVIDOR (normalmente UTC) — como Bogotá es UTC-5, esa
 * medianoche-servidor cae a las 7pm de AYER en Bogotá, así que "hoy" se
 * armaba con 5 horas de la tarde/noche anterior coladas de más. Se
 * construye la fecha explícitamente con el offset fijo de Bogotá
 * ("-05:00") para que no dependa de en qué zona horaria corra el servidor.
 */
export function bogotaStartOfDayUTC(): Date {
  return new Date(`${bogotaDayKey(new Date().toISOString())}T00:00:00-05:00`)
}
