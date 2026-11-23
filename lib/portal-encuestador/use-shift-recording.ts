"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  appendChunk,
  deleteSegment,
  listSegments,
  loadChunks,
  putSegmentMeta,
  readPendingLinks,
  updateSegmentMeta,
  writePendingLinks,
  type BufferedSegmentMeta,
} from "./recording-buffer"

// Motor de grabación continua del portal de encuestador.
//
// Se graba TODO el turno del encuestador desde que inicia sesión, y cada
// intento (incidencia o encuesta) queda en sus propios segmentos: un único
// MediaStream de micrófono vive todo el turno y se van creando MediaRecorder
// de scope 'shift' (fondo / "antes de iniciar") o 'survey' ("durante").
//
// Rediseño 26/11/2026 ("lo importante es que no se pierdan los audios al
// bloquear el celular, que no se corten"):
//  1. Bloquear la pantalla YA NO detiene la grabación. Antes este motor la
//     paraba a propósito al ocultarse la pestaña y abría otro archivo al
//     volver: lo dicho con el teléfono bloqueado se perdía y cada bloqueo
//     partía el audio. En Android, Chrome mantiene el micrófono activo para
//     una página que lo está usando (igual que una llamada web).
//  2. Cada trozo de audio (cada CHUNK_TIMESLICE_MS) se guarda al instante en
//     el teléfono (IndexedDB, recording-buffer.ts) y solo se borra cuando el
//     servidor confirma la subida. Si la página muere, se va la señal o el
//     sistema mata el navegador, el audio se sube en la próxima oportunidad
//     (recoverPending).
//  3. Grabar no depende de la red: el id de cada segmento se genera en el
//     teléfono y la grabación arranca de inmediato; el registro y la subida
//     al servidor van por detrás. Un corte (entrar a una encuesta, registrar
//     incidencia) nunca deja de grabar por falta de señal.
//  4. Mientras hay un intento abierto se pide a la pantalla que no se apague
//     sola (Screen Wake Lock): evita el apagado automático mientras el
//     encuestador conversa sin tocar el celular.
//  5. Si el sistema sí corta el micrófono (iOS lo suspende con la pantalla
//     bloqueada), al volver se retoma sola la grabación; las partes quedan
//     ligadas al mismo intento.
// Para grabación garantizada con la pantalla bloqueada en cualquier
// teléfono, la opción sigue siendo la APK nativa.

// Corte periódico del audio de fondo SOLO fuera de un intento (entre casas);
// dentro de un intento nunca se corta.
const SHIFT_SEGMENT_ROTATE_MS = 10 * 60 * 1000
const CHUNK_TIMESLICE_MS = 5 * 1000
const HEALTH_CHECK_MS = 15 * 1000

export type RecordingStatus =
  | "idle"
  | "requesting-permission"
  | "recording-shift"
  | "recording-survey"
  | "denied"
  | "error"

interface StartedSegment {
  recordingId: string
  shiftId: string
  scope: "shift" | "survey"
  recorder: MediaRecorder
  mimeType: string
  chunks: Blob[]
  startedAt: number
  endedAt: number | null
  // Cadena de escrituras a IndexedDB de este segmento — se espera antes de
  // borrarlo, para no dejar trozos huérfanos escritos después del borrado.
  persist: Promise<void>
  registration: Promise<SendResult>
}

type SendResult = "ok" | "gone" | "retry"

function newRecordingId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  } catch { /* contexto no seguro */ }
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function classify(status: number): SendResult {
  if (status >= 200 && status < 300) return "ok"
  // 400/404/409: el servidor nunca va a aceptar este dato — no reintentar.
  if (status === 400 || status === 404 || status === 409) return "gone"
  return "retry" // 401 (sesión vencida), 5xx, etc.
}

async function registerSegment(meta: { recordingId: string; shiftId: string; scope: string; startedAt: number }): Promise<SendResult> {
  try {
    const res = await fetch("/api/portal-encuestador/recordings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: meta.recordingId,
        shiftId: meta.shiftId,
        scope: meta.scope,
        startedAt: meta.startedAt,
        clientNow: Date.now(),
      }),
    })
    return classify(res.status)
  } catch {
    return "retry"
  }
}

async function sendSegmentFile(
  recordingId: string,
  blob: Blob,
  durationSecs: number,
  endedAt: number,
  responseId?: string | null
): Promise<SendResult> {
  const formData = new FormData()
  formData.append("file", blob, `${recordingId}.webm`)
  formData.append("durationSecs", String(durationSecs))
  formData.append("endedAt", String(endedAt))
  formData.append("clientNow", String(Date.now()))
  if (responseId) formData.append("responseId", responseId)
  try {
    const res = await fetch(`/api/portal-encuestador/recordings/${recordingId}`, { method: "PATCH", body: formData })
    const result = classify(res.status)
    if (result !== "ok") {
      const body = await res.json().catch(() => ({}))
      console.error(`Error subiendo segmento de audio (${recordingId}, HTTP ${res.status}):`, body?.details || body?.error || body)
    }
    return result
  } catch (err) {
    console.error("Sin red subiendo segmento de audio (queda guardado en el teléfono para reintentar):", err)
    return "retry"
  }
}

async function postLink(responseId: string, recordingIds: string[]): Promise<SendResult> {
  try {
    const res = await fetch("/api/portal-encuestador/recordings/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordingIds, responseId }),
    })
    return classify(res.status)
  } catch {
    return "retry"
  }
}

export function useShiftRecording() {
  const [status, setStatus] = useState<RecordingStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [shiftId, setShiftId] = useState<string | null>(null)
  // Espejo de `status` en un ref: dentro de runExclusive se necesita el
  // status VIGENTE al momento de ejecutar, no el capturado por closure.
  const statusRef = useRef<RecordingStatus>("idle")
  useEffect(() => { statusRef.current = status }, [status])

  const streamRef = useRef<MediaStream | null>(null)
  const currentSegmentRef = useRef<StartedSegment | null>(null)
  const rotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shiftIdRef = useRef<string | null>(null)
  const currentSurveyResponseIdRef = useRef<string | null>(null)
  // Pedido 2026-07-29: con settings.allowAudio=false en la encuesta actual no
  // se graba nada mientras dure (el MediaStream sigue vivo para no perder el
  // permiso). Este ref evita que la verificación de salud lo confunda con una
  // grabación interrumpida y la "retome".
  const audioPausedForSurveyRef = useRef(false)
  // Intento en curso (ítem 26/11/2026): ids de TODOS los segmentos (antes y
  // durante) abiertos desde que el encuestador entró a esta encuesta. Al
  // registrar la incidencia o enviar/abandonar se ligan a esa respuesta.
  // null = no hay intento abierto.
  const attemptSegmentIdsRef = useRef<string[] | null>(null)
  const registrationsRef = useRef<Map<string, Promise<SendResult>>>(new Map())
  const uploadingIdsRef = useRef<Set<string>>(new Set())
  const wakeLockRef = useRef<any>(null)
  const recoveringRef = useRef(false)

  // BUG DE PRODUCCIÓN (2026-07-28): todas las operaciones que abren/cierran
  // un segmento pasan por esta cola — una a la vez, en orden (dos
  // MediaRecorder arrancando a la vez sobre el mismo stream terminaban en
  // "NotSupportedError" y segmentos huérfanos).
  const opQueueRef = useRef<Promise<unknown>>(Promise.resolve())
  const runExclusive = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const run = opQueueRef.current.then(fn, fn)
    opQueueRef.current = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }, [])

  const pickMimeType = () => {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
    for (const c of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) return c
    }
    return undefined
  }

  // Pantalla encendida mientras hay un intento abierto. El navegador la
  // suelta al ocultarse la pestaña; se vuelve a pedir al regresar.
  const acquireWakeLock = useCallback(async () => {
    try {
      if (attemptSegmentIdsRef.current === null) return
      if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return
      if (document.visibilityState !== "visible") return
      if (wakeLockRef.current && !wakeLockRef.current.released) return
      wakeLockRef.current = await (navigator as any).wakeLock.request("screen")
    } catch {
      // Denegado (batería baja, ahorro de energía) — se sigue grabando igual.
    }
  }, [])

  const releaseWakeLock = useCallback(() => {
    try { wakeLockRef.current?.release?.() } catch { /* ya liberado */ }
    wakeLockRef.current = null
  }, [])

  // Arranca a grabar un segmento nuevo YA, sin esperar a la red. El registro
  // en el servidor sale por detrás (segment.registration).
  const startSegment = useCallback((scope: "shift" | "survey"): StartedSegment | null => {
    const stream = streamRef.current
    const currentShiftId = shiftIdRef.current
    if (!stream || !currentShiftId) return null
    const recordingId = newRecordingId()
    try {
      const preferred = pickMimeType()
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined)
      const startedAt = Date.now()
      const segment: StartedSegment = {
        recordingId,
        shiftId: currentShiftId,
        scope,
        recorder,
        mimeType: recorder.mimeType || preferred || "audio/webm",
        chunks: [],
        startedAt,
        endedAt: null,
        persist: Promise.resolve(),
        registration: Promise.resolve("retry"),
      }
      const meta: BufferedSegmentMeta = {
        recordingId,
        shiftId: currentShiftId,
        scope,
        mimeType: segment.mimeType,
        startedAt,
        lastChunkAt: startedAt,
        registered: false,
      }
      // La metadata se escribe primero en la cadena, así ningún trozo queda
      // guardado sin su segmento.
      segment.persist = putSegmentMeta(meta)
      recorder.ondataavailable = (e) => {
        if (e.data.size === 0) return
        segment.chunks.push(e.data)
        segment.persist = segment.persist.then(() => appendChunk(recordingId, e.data))
      }
      recorder.onerror = (e: any) => console.error("Error del MediaRecorder:", e?.error || e)
      // Con timeslice el navegador entrega un trozo cada pocos segundos, que
      // se guarda al instante en el teléfono.
      recorder.start(CHUNK_TIMESLICE_MS)
      attemptSegmentIdsRef.current?.push(recordingId)

      segment.registration = segment.persist.then(async () => {
        const result = await registerSegment(meta)
        if (result === "ok") await updateSegmentMeta(recordingId, { registered: true })
        return result
      })
      registrationsRef.current.set(recordingId, segment.registration)
      return segment
    } catch (err) {
      console.error("Error iniciando MediaRecorder para el segmento:", err)
      return null
    }
  }, [])

  const stopRecorder = (segment: StartedSegment) =>
    new Promise<void>((resolve) => {
      segment.endedAt = Date.now()
      if (segment.recorder.state === "inactive") { resolve(); return }
      segment.recorder.onstop = () => resolve()
      try { segment.recorder.stop() } catch { resolve() }
    })

  // Sube un segmento ya detenido. Solo se borra la copia del teléfono cuando
  // el servidor confirma; si no, queda para recoverPending.
  const uploadSegment = useCallback(async (segment: StartedSegment, responseId?: string | null) => {
    const id = segment.recordingId
    uploadingIdsRef.current.add(id)
    try {
      await segment.persist
      await updateSegmentMeta(id, { closed: true, ...(responseId ? { responseId } : {}) })
      let reg = await segment.registration
      if (reg === "retry") reg = await registerSegment(segment)
      if (reg === "retry") return
      if (reg === "gone") { await deleteSegment(id); return }
      await updateSegmentMeta(id, { registered: true })
      const endedAt = segment.endedAt ?? Date.now()
      const blob = new Blob(segment.chunks, { type: segment.mimeType })
      const durationSecs = Math.max(0, Math.round((endedAt - segment.startedAt) / 1000))
      const result = await sendSegmentFile(id, blob, durationSecs, endedAt, responseId)
      if (result !== "retry") await deleteSegment(id)
    } finally {
      uploadingIdsRef.current.delete(id)
      registrationsRef.current.delete(id)
    }
  }, [])

  // Cambia al siguiente segmento: detiene el actual, arranca el nuevo de
  // inmediato (sin red) y sube el anterior por detrás — el hueco entre uno y
  // otro es de milisegundos y nunca depende de la señal.
  const swapSegment = useCallback(async (scope: "shift" | "survey", closeResponseId?: string | null) => {
    const prev = currentSegmentRef.current
    currentSegmentRef.current = null
    if (rotateTimerRef.current) { clearTimeout(rotateTimerRef.current); rotateTimerRef.current = null }
    if (prev) await stopRecorder(prev)
    const next = startSegment(scope)
    currentSegmentRef.current = next
    if (prev) void uploadSegment(prev, closeResponseId)
    return next
  }, [startSegment, uploadSegment])

  // Corta el segmento actual y espera a que suba (o quede guardado).
  const closeCurrentSegment = useCallback(async (responseId?: string | null) => {
    const segment = currentSegmentRef.current
    if (!segment) return
    currentSegmentRef.current = null
    if (rotateTimerRef.current) { clearTimeout(rotateTimerRef.current); rotateTimerRef.current = null }
    await stopRecorder(segment)
    await uploadSegment(segment, responseId)
  }, [uploadSegment])

  // Liga a la respuesta todos los segmentos del intento y cierra el intento.
  // Si no hay señal, el vínculo queda en cola y además viaja con el audio
  // cuando se suba (responseId en la metadata del teléfono).
  // Recibe los ids ya separados del intento (detachAttempt) — se separan
  // ANTES de abrir el segmento siguiente, para que ese segmento nuevo no
  // quede ligado a la respuesta que se está cerrando.
  const detachAttempt = useCallback((): string[] | null => {
    const ids = attemptSegmentIdsRef.current
    attemptSegmentIdsRef.current = null
    releaseWakeLock()
    return ids
  }, [releaseWakeLock])

  const linkAttemptToResponse = useCallback(async (ids: string[] | null, responseId?: string | null) => {
    if (!responseId || !ids || ids.length === 0) return
    await Promise.all(ids.map((id) => updateSegmentMeta(id, { responseId })))
    await Promise.all(ids.map((id) => registrationsRef.current.get(id) ?? Promise.resolve("ok" as SendResult)))
    const result = await postLink(responseId, ids)
    if (result === "retry") writePendingLinks([...readPendingLinks(), { responseId, recordingIds: ids }])
  }, [])

  // Sube lo que haya quedado guardado en el teléfono (página cerrada por el
  // sistema, sin señal al subir, etc.) y reenvía vínculos pendientes.
  const recoverPending = useCallback(async () => {
    if (recoveringRef.current) return
    recoveringRef.current = true
    try {
      const metas = await listSegments()
      for (const meta of metas) {
        if (meta.recordingId === currentSegmentRef.current?.recordingId) continue
        if (uploadingIdsRef.current.has(meta.recordingId)) continue
        // Abierto y con trozos recientes: puede estar grabando en otra pestaña.
        if (!meta.closed && Date.now() - meta.lastChunkAt < 60 * 1000) continue
        const chunks = await loadChunks(meta.recordingId)
        if (chunks.length === 0) {
          await deleteSegment(meta.recordingId)
          continue
        }
        if (!meta.registered) {
          const reg = await registerSegment(meta)
          if (reg === "retry") break // sin red o sin sesión: se reintenta después
          if (reg === "gone") { await deleteSegment(meta.recordingId); continue }
          await updateSegmentMeta(meta.recordingId, { registered: true })
        }
        const blob = new Blob(chunks, { type: meta.mimeType || "audio/webm" })
        const durationSecs = Math.max(0, Math.round((meta.lastChunkAt - meta.startedAt) / 1000))
        const result = await sendSegmentFile(meta.recordingId, blob, durationSecs, meta.lastChunkAt, meta.responseId)
        if (result === "retry") break
        await deleteSegment(meta.recordingId)
      }

      const pending = readPendingLinks()
      if (pending.length > 0) {
        const stillPending: typeof pending = []
        for (const link of pending) {
          const result = await postLink(link.responseId, link.recordingIds)
          if (result === "retry") stillPending.push(link)
        }
        writePendingLinks(stillPending)
      }
    } finally {
      recoveringRef.current = false
    }
  }, [])

  // Corte periódico del audio de fondo, solo fuera de un intento.
  const scheduleShiftRotation = useCallback(() => {
    if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current)
    rotateTimerRef.current = setTimeout(() => {
      runExclusive(async () => {
        if (currentSegmentRef.current?.scope !== "shift") return
        if (attemptSegmentIdsRef.current !== null) {
          scheduleShiftRotation()
          return
        }
        const next = await swapSegment("shift")
        if (next) scheduleShiftRotation()
      })
    }, SHIFT_SEGMENT_ROTATE_MS)
  }, [runExclusive, swapSegment])

  // Inicia el turno: pide permiso de micrófono, crea el turno en el backend,
  // y arranca la grabación de fondo (scope='shift').
  const startShift = useCallback(async () => {
    setStatus("requesting-permission")
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
    } catch (err) {
      console.error("Permiso de micrófono denegado o no disponible:", err)
      setStatus("denied")
      setError("Necesitamos permiso de micrófono para grabar la encuesta. Actívalo en la configuración del navegador.")
      return
    }

    try {
      const res = await fetch("/api/portal-encuestador/shifts", { method: "POST" })
      if (!res.ok) throw new Error("No se pudo iniciar el turno")
      const { shiftId: newShiftId } = await res.json()
      shiftIdRef.current = newShiftId
      setShiftId(newShiftId)

      await runExclusive(async () => {
        if (currentSegmentRef.current) { setStatus("recording-shift"); return }
        const segment = startSegment("shift")
        if (segment) {
          currentSegmentRef.current = segment
          scheduleShiftRotation()
          setStatus("recording-shift")
        } else {
          setStatus("error")
          setError("No se pudo iniciar la grabación de fondo")
        }
      })
      recoverPending()
    } catch (err) {
      console.error(err)
      setStatus("error")
      setError("No se pudo iniciar el turno")
    }
  }, [runExclusive, startSegment, scheduleShiftRotation, recoverPending])

  // "Iniciar encuesta": corta el audio de fondo y arranca el segmento de la
  // encuesta. Con settings.allowAudio=false no se graba (ver
  // audioPausedForSurveyRef).
  const startSurveySegment = useCallback(async (responseId?: string, recordAudio: boolean = true) => {
    await runExclusive(async () => {
      if (statusRef.current !== "recording-shift" && statusRef.current !== "recording-survey") return
      if (currentSegmentRef.current?.scope === "survey") return
      currentSurveyResponseIdRef.current = responseId ?? null
      if (!recordAudio) {
        const prev = currentSegmentRef.current
        currentSegmentRef.current = null
        if (rotateTimerRef.current) { clearTimeout(rotateTimerRef.current); rotateTimerRef.current = null }
        if (prev) {
          await stopRecorder(prev)
          void uploadSegment(prev)
        }
        audioPausedForSurveyRef.current = true
        setStatus("recording-survey")
        return
      }
      await swapSegment("survey")
      setStatus("recording-survey")
    })
  }, [runExclusive, swapSegment, uploadSegment])

  // Al enviar/abandonar la encuesta: corta el audio de la encuesta, liga todo
  // el intento a su respuesta y retoma la grabación de fondo.
  const endSurveySegment = useCallback(async (responseId?: string) => {
    await runExclusive(async () => {
      if (statusRef.current !== "recording-survey") return
      const finalResponseId = responseId ?? currentSurveyResponseIdRef.current
      audioPausedForSurveyRef.current = false
      const attemptIds = detachAttempt()
      const next = await swapSegment("shift", finalResponseId)
      await linkAttemptToResponse(attemptIds, finalResponseId)
      currentSurveyResponseIdRef.current = null
      if (next) scheduleShiftRotation()
      setStatus("recording-shift")
    })
  }, [runExclusive, swapSegment, detachAttempt, linkAttemptToResponse, scheduleShiftRotation])

  // Al entrar a una encuesta (pantalla "Iniciar encuesta / Registrar
  // incidencia"): corta el audio de fondo y abre un intento nuevo. Lo
  // grabado desde acá es el "antes" de ESTE intento.
  const beginAttempt = useCallback(async () => {
    await runExclusive(async () => {
      if (statusRef.current !== "recording-shift") return
      attemptSegmentIdsRef.current = []
      acquireWakeLock()
      const next = await swapSegment("shift")
      if (next) scheduleShiftRotation()
    })
  }, [runExclusive, swapSegment, scheduleShiftRotation, acquireWakeLock])

  // "Registrar incidencia": corta el audio en este punto, lo liga (con las
  // demás partes del intento) a la incidencia y sigue grabando en un segmento
  // nuevo — el audio de la siguiente incidencia empieza a una hora posterior.
  const markIncidence = useCallback(async (responseId?: string | null) => {
    await runExclusive(async () => {
      const attemptIds = detachAttempt()
      if (statusRef.current !== "recording-shift") return
      const next = await swapSegment("shift", responseId)
      await linkAttemptToResponse(attemptIds, responseId)
      if (next) scheduleShiftRotation()
    })
  }, [runExclusive, swapSegment, detachAttempt, linkAttemptToResponse, scheduleShiftRotation])

  // Cierra todo al cerrar sesión. keepalive:true permite que el cierre del
  // turno siga aunque la pestaña ya se esté descargando (pagehide); si la
  // subida del audio no alcanza, queda en el teléfono para la próxima sesión.
  const endShift = useCallback(async () => {
    attemptSegmentIdsRef.current = null
    releaseWakeLock()
    await closeCurrentSegment()
    audioPausedForSurveyRef.current = false
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (shiftIdRef.current) {
      try {
        await fetch(`/api/portal-encuestador/shifts/${shiftIdRef.current}`, { method: "PATCH", keepalive: true })
      } catch (err) {
        console.error("Error cerrando turno:", err)
      }
    }
    shiftIdRef.current = null
    setShiftId(null)
    setStatus("idle")
  }, [closeCurrentSegment, releaseWakeLock])

  useEffect(() => {
    const handler = () => { endShift() }
    window.addEventListener("pagehide", handler)
    return () => window.removeEventListener("pagehide", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const shouldBeRecording = () =>
    !!shiftIdRef.current &&
    (statusRef.current === "recording-shift" || statusRef.current === "recording-survey") &&
    !audioPausedForSurveyRef.current

  // Verifica que la grabación siga viva; si el sistema cortó el micrófono o
  // el grabador, guarda/sube lo que alcanzó a grabar y retoma sola.
  const ensureRecording = useCallback(async () => {
    await runExclusive(async () => {
      if (!shouldBeRecording()) return
      const track = streamRef.current?.getAudioTracks()[0]
      const streamAlive = !!track && track.readyState === "live"
      const segment = currentSegmentRef.current
      if (streamAlive && segment && segment.recorder.state === "recording") return

      if (!streamAlive) {
        try {
          streamRef.current?.getTracks().forEach((t) => t.stop())
          streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
        } catch (err) {
          console.error("No se pudo recuperar el micrófono:", err)
          return
        }
      }
      const scope: "shift" | "survey" = segment?.scope ?? (statusRef.current === "recording-survey" ? "survey" : "shift")
      const next = await swapSegment(scope)
      if (next && scope === "shift") scheduleShiftRotation()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runExclusive, swapSegment, scheduleShiftRotation])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        // NO se detiene la grabación: solo se fuerza a guardar en el teléfono
        // lo grabado hasta este instante, por si el sistema mata la página.
        const recorder = currentSegmentRef.current?.recorder
        if (recorder && recorder.state === "recording") {
          try { recorder.requestData() } catch { /* best effort */ }
        }
        return
      }
      acquireWakeLock()
      ensureRecording()
      recoverPending()
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [acquireWakeLock, ensureRecording, recoverPending])

  // Con la página a la vista, revisa periódicamente que se esté grabando.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible" || !shouldBeRecording()) return
      const track = streamRef.current?.getAudioTracks()[0]
      const segment = currentSegmentRef.current
      const broken = !segment || !track || track.readyState !== "live" || segment.recorder.state !== "recording"
      if (broken) ensureRecording()
    }, HEALTH_CHECK_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureRecording])

  // Al cargar el portal, al volver la señal y cada minuto, sube lo pendiente
  // (incluido el audio de una página que el sistema mató mientras grababa).
  useEffect(() => {
    recoverPending()
    const onOnline = () => { recoverPending() }
    window.addEventListener("online", onOnline)
    const interval = setInterval(() => { recoverPending() }, 60 * 1000)
    return () => {
      window.removeEventListener("online", onOnline)
      clearInterval(interval)
    }
  }, [recoverPending])

  // Cleanup al desmontar el componente (navegación fuera del portal).
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      try { wakeLockRef.current?.release?.() } catch { /* ya liberado */ }
    }
  }, [])

  return { status, error, shiftId, startShift, endShift, startSurveySegment, endSurveySegment, beginAttempt, markIncidence }
}
