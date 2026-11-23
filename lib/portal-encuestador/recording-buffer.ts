// Buffer local durable (IndexedDB) de los segmentos de audio del portal.
//
// Cada trozo que entrega MediaRecorder (cada pocos segundos) se guarda acá
// apenas llega. Si la pestaña muere con el teléfono bloqueado, si se va la
// señal justo al subir, o si el navegador mata la página, el audio sigue en
// el teléfono y se sube en la próxima oportunidad (ver recoverPending en
// use-shift-recording.ts). Solo se borra después de que el servidor confirma
// la subida.
//
// Todo es best-effort: si IndexedDB no está disponible (modo privado, cuota
// llena), cada función falla en silencio y el motor sigue funcionando solo
// con la copia en memoria, como antes.

const DB_NAME = "dn-portal-recordings"
const DB_VERSION = 1
const SEGMENTS = "segments"
const CHUNKS = "chunks"

export interface BufferedSegmentMeta {
  recordingId: string
  shiftId: string
  scope: "shift" | "survey"
  mimeType: string
  startedAt: number
  lastChunkAt: number
  // false mientras el servidor no haya confirmado la creación del segmento
  // (sin señal al abrirlo) — la recuperación lo registra antes de subirlo.
  registered: boolean
  // Se conoce al cerrar el segmento (fin de intento); si la subida falla, la
  // recuperación lo reenvía para que el audio quede ligado a su respuesta.
  responseId?: string | null
  closed?: boolean
}

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") { resolve(null); return }
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(SEGMENTS)) db.createObjectStore(SEGMENTS, { keyPath: "recordingId" })
        if (!db.objectStoreNames.contains(CHUNKS)) {
          const chunks = db.createObjectStore(CHUNKS, { autoIncrement: true })
          chunks.createIndex("recordingId", "recordingId", { unique: false })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
    tx.onabort = () => resolve()
  })
}

export async function putSegmentMeta(meta: BufferedSegmentMeta): Promise<void> {
  try {
    const db = await openDb()
    if (!db) return
    const tx = db.transaction(SEGMENTS, "readwrite")
    tx.objectStore(SEGMENTS).put(meta)
    await txDone(tx)
  } catch { /* best effort */ }
}

export async function updateSegmentMeta(recordingId: string, patch: Partial<BufferedSegmentMeta>): Promise<void> {
  try {
    const db = await openDb()
    if (!db) return
    const tx = db.transaction(SEGMENTS, "readwrite")
    const store = tx.objectStore(SEGMENTS)
    const req = store.get(recordingId)
    req.onsuccess = () => {
      if (req.result) store.put({ ...req.result, ...patch })
    }
    await txDone(tx)
  } catch { /* best effort */ }
}

// Guarda un trozo y actualiza lastChunkAt en la misma transacción.
export async function appendChunk(recordingId: string, blob: Blob): Promise<void> {
  try {
    const db = await openDb()
    if (!db) return
    const tx = db.transaction([CHUNKS, SEGMENTS], "readwrite")
    tx.objectStore(CHUNKS).add({ recordingId, blob })
    const segStore = tx.objectStore(SEGMENTS)
    const req = segStore.get(recordingId)
    req.onsuccess = () => {
      if (req.result) segStore.put({ ...req.result, lastChunkAt: Date.now() })
    }
    await txDone(tx)
  } catch { /* best effort */ }
}

export async function listSegments(): Promise<BufferedSegmentMeta[]> {
  try {
    const db = await openDb()
    if (!db) return []
    const tx = db.transaction(SEGMENTS, "readonly")
    const req = tx.objectStore(SEGMENTS).getAll()
    const result = await new Promise<BufferedSegmentMeta[]>((resolve) => {
      req.onsuccess = () => resolve((req.result as BufferedSegmentMeta[]) || [])
      req.onerror = () => resolve([])
    })
    await txDone(tx)
    return result
  } catch {
    return []
  }
}

// Trozos en el orden en que se grabaron (la clave autoincremental lo garantiza).
export async function loadChunks(recordingId: string): Promise<Blob[]> {
  try {
    const db = await openDb()
    if (!db) return []
    const tx = db.transaction(CHUNKS, "readonly")
    const req = tx.objectStore(CHUNKS).index("recordingId").getAll(recordingId)
    const result = await new Promise<Blob[]>((resolve) => {
      req.onsuccess = () => resolve(((req.result as { blob: Blob }[]) || []).map((r) => r.blob))
      req.onerror = () => resolve([])
    })
    await txDone(tx)
    return result
  } catch {
    return []
  }
}

// Vínculos audio -> respuesta que no se pudieron enviar (sin señal). Se
// guardan en localStorage y se reintentan en la recuperación.
const PENDING_LINKS_KEY = "dn-portal-pending-links"

export interface PendingLink {
  responseId: string
  recordingIds: string[]
}

export function readPendingLinks(): PendingLink[] {
  try {
    const raw = localStorage.getItem(PENDING_LINKS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writePendingLinks(links: PendingLink[]): void {
  try {
    if (links.length === 0) localStorage.removeItem(PENDING_LINKS_KEY)
    else localStorage.setItem(PENDING_LINKS_KEY, JSON.stringify(links))
  } catch { /* best effort */ }
}

export async function deleteSegment(recordingId: string): Promise<void> {
  try {
    const db = await openDb()
    if (!db) return
    const tx = db.transaction([CHUNKS, SEGMENTS], "readwrite")
    tx.objectStore(SEGMENTS).delete(recordingId)
    const idx = tx.objectStore(CHUNKS).index("recordingId")
    const cursorReq = idx.openKeyCursor(IDBKeyRange.only(recordingId))
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result
      if (cursor) {
        tx.objectStore(CHUNKS).delete(cursor.primaryKey)
        cursor.continue()
      }
    }
    await txDone(tx)
  } catch { /* best effort */ }
}
