/**
 * debugLog — wrapper condicional de console.log para el módulo de encuestas.
 * Solo imprime si NEXT_PUBLIC_DEBUG_SURVEY=true está seteado en el entorno.
 * En producción todos los logs de debug quedan silenciados automáticamente.
 *
 * Uso:
 *   import { debugLog } from "@/lib/debug-log"
 *   debugLog("✅ Sección guardada", sectionId)
 */

const DEBUG_ENABLED =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_DEBUG_SURVEY === "true"

export function debugLog(...args: unknown[]): void {
  if (DEBUG_ENABLED) {
    // eslint-disable-next-line no-console
    console.log(...args)
  }
}

export function debugWarn(...args: unknown[]): void {
  if (DEBUG_ENABLED) {
    // eslint-disable-next-line no-console
    console.warn(...args)
  }
}
