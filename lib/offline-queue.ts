// Cola offline real para el envío de respuestas (auditoría de producción
// 2026-07-29, "Corto plazo": "implementar una cola offline real con
// IndexedDB para el portal del encuestador").
//
// Problema que resuelve: hasta ahora, si un encuestador en campo sin señal
// (o con una conexión que falla a mitad del envío) completaba una encuesta,
// el único lugar donde vivían sus respuestas era el estado de React de la
// pestaña — si cerraba la app, recargaba, o el navegador mataba la pestaña
// en segundo plano, esas respuestas se perdían sin ninguna forma de
// recuperarlas. `settings.offlineMode` existe como campo en la configuración
// de la encuesta pero no estaba conectado a ninguna lógica real.
//
// Este módulo persiste cada envío fallido por red en IndexedDB (que
// sobrevive a recargas y cierres de pestaña, a diferencia de la memoria de
// React) y expone una función para reintentarlos cuando vuelve la conexión.
// Es intencionalmente independiente de React: cualquier página puede
// importarlo sin necesitar un Provider.
//
// No se usa en SSR — todas las funciones son no-op seguras si `window` o
// `indexedDB` no existen (build de Next.js, tests, etc.).

const DB_NAME = "datanalisis_offline_queue"
const DB_VERSION = 1
const STORE_NAME = "pending_responses"

export type PendingResponse = {
  // Id local (no confundir con el id real de `responses` en Supabase, que
  // todavía no existe mientras el envío sigue en la cola).
  localId: string
  // Payload exacto que se le manda a POST /api/responses — incluye
  // client_submission_id, así que aunque este mismo envío ya haya llegado a
  // tocar el servidor antes de perder la conexión (p.ej. la respuesta de
  // éxito no llegó a la app), el backend lo deduplica en vez de crear una
  // fila repetida (ver sql/2026_07_responses_idempotency.sql).
  payload: any
  createdAt: string
  attempts: number
  lastError?: string
  lastAttemptAt?: string
}

function hasIndexedDB(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined"
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      reject(new Error("IndexedDB no disponible en este entorno"))
      return
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "localId" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error("No se pudo abrir la base de datos offline"))
  })
}

function generateLocalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** Guarda un envío que falló por red para reintentarlo más tarde. No lanza si IndexedDB no está disponible — en ese caso devuelve null y el llamador sigue funcionando igual que antes (sin cola offline, pero sin romper nada). */
export async function enqueueResponse(payload: any): Promise<string | null> {
  if (!hasIndexedDB()) return null
  try {
    const db = await openDB()
    const localId = generateLocalId()
    const entry: PendingResponse = {
      localId,
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
    }
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      tx.objectStore(STORE_NAME).put(entry)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
    return localId
  } catch (err) {
    console.error("[offline-queue] No se pudo encolar la respuesta:", err)
    return null
  }
}

export async function getPendingResponses(): Promise<PendingResponse[]> {
  if (!hasIndexedDB()) return []
  try {
    const db = await openDB()
    const result = await new Promise<PendingResponse[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly")
      const req = tx.objectStore(STORE_NAME).getAll()
      req.onsuccess = () => resolve((req.result as PendingResponse[]) || [])
      req.onerror = () => reject(req.error)
    })
    db.close()
    return result
  } catch (err) {
    console.error("[offline-queue] No se pudo leer la cola offline:", err)
    return []
  }
}

export async function getPendingCount(): Promise<number> {
  const all = await getPendingResponses()
  return all.length
}

async function removePendingResponse(localId: string): Promise<void> {
  if (!hasIndexedDB()) return
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      tx.objectStore(STORE_NAME).delete(localId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (err) {
    console.error("[offline-queue] No se pudo eliminar de la cola offline:", err)
  }
}

async function markAttempt(localId: string, error: string): Promise<void> {
  if (!hasIndexedDB()) return
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)
      const getReq = store.get(localId)
      getReq.onsuccess = () => {
        const existing = getReq.result as PendingResponse | undefined
        if (existing) {
          existing.attempts += 1
          existing.lastError = error
          existing.lastAttemptAt = new Date().toISOString()
          store.put(existing)
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (err) {
    console.error("[offline-queue] No se pudo actualizar el intento en la cola offline:", err)
  }
}

let flushInFlight = false

/**
 * Reintenta todos los envíos pendientes contra /api/responses. Se apoya en
 * la llave de idempotencia (client_submission_id) que ya viaja dentro de
 * cada payload — si el servidor ya había recibido este envío antes de que
 * se cortara la conexión, lo detecta y devuelve la respuesta existente en
 * vez de duplicarla. Los envíos que fallan por un error real del servidor
 * (validación, etc., no de red) se sacan de la cola para no reintentarlos
 * indefinidamente; los que fallan por red se dejan para el próximo intento.
 */
export async function flushQueue(): Promise<{ synced: number; failed: number; remaining: number }> {
  if (flushInFlight) return { synced: 0, failed: 0, remaining: await getPendingCount() }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { synced: 0, failed: 0, remaining: await getPendingCount() }
  }
  flushInFlight = true
  let synced = 0
  let failed = 0
  try {
    const pending = await getPendingResponses()
    for (const item of pending) {
      try {
        const res = await fetch("/api/responses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        })
        if (res.ok) {
          await removePendingResponse(item.localId)
          synced += 1
        } else {
          // Error real del servidor (400/403/etc.) — no es un problema de
          // red, reintentar no lo va a arreglar. Se descarta para no
          // atascar la cola, pero queda en consola para diagnóstico.
          const body = await res.json().catch(() => ({}))
          console.error("[offline-queue] El servidor rechazó un envío en cola, se descarta:", body)
          await removePendingResponse(item.localId)
          failed += 1
        }
      } catch (err) {
        // Sigue sin haber red (o se cortó a mitad de este intento) — se
        // deja en la cola para el siguiente flush.
        await markAttempt(item.localId, err instanceof Error ? err.message : String(err))
        failed += 1
      }
    }
  } finally {
    flushInFlight = false
  }
  const remaining = await getPendingCount()
  return { synced, failed, remaining }
}
