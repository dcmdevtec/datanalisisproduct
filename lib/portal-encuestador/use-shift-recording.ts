"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// Motor de grabación continua del portal de encuestador.
//
// Diseño (según lo pedido): se graba TODO el turno del encuestador desde que
// inicia sesión, Y ADEMÁS cada encuesta individual queda grabada por separado
// para poder reproducirla en "Respuestas Individuales". Se logra con
// SEGMENTOS: un único MediaStream de micrófono se mantiene abierto todo el
// turno, y se van creando instancias de MediaRecorder de scope 'shift'
// (fondo, entre encuestas) o 'survey' (una encuesta puntual, con response_id).
// Al cortar un segmento se sube inmediatamente y se abre el siguiente, así
// nunca hay huecos largos sin grabar y nunca se pierde más que el segmento
// en curso si algo falla.
//
// LÍMITE TÉCNICO CONOCIDO (ya conversado con el usuario): un navegador NO
// puede grabar de forma confiable si la pestaña pasa a segundo plano o el
// teléfono se bloquea — eso solo lo puede garantizar una app nativa con
// foreground service (la APK). Este hook hace el mejor esfuerzo posible
// dentro de esas limitaciones: intenta cerrar y subir el segmento en curso
// cuando detecta que la pestaña se oculta o se va a cerrar.

const SHIFT_SEGMENT_ROTATE_MS = 2 * 60 * 1000 // corta y sube cada 2 min mientras graba de fondo

export type RecordingStatus =
  | "idle"
  | "requesting-permission"
  | "recording-shift"
  | "recording-survey"
  | "denied"
  | "error"

interface StartedSegment {
  recordingId: string
  scope: "shift" | "survey"
  recorder: MediaRecorder
  chunks: BlobPart[]
  startedAt: number
}

export function useShiftRecording() {
  const [status, setStatus] = useState<RecordingStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [shiftId, setShiftId] = useState<string | null>(null)
  // Espejo de `status` en un ref: dentro de runExclusive necesitamos leer el
  // status VIGENTE en el momento en que la operación realmente se ejecuta
  // (que puede ser más tarde de cuando se llamó, si había otra operación en
  // curso) — el `status` capturado por closure en el useCallback puede estar
  // obsoleto para ese momento.
  const statusRef = useRef<RecordingStatus>("idle")
  useEffect(() => { statusRef.current = status }, [status])

  const streamRef = useRef<MediaStream | null>(null)
  const currentSegmentRef = useRef<StartedSegment | null>(null)
  const rotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shiftIdRef = useRef<string | null>(null)
  // Recuerdan qué se estaba grabando justo antes de ocultarse la pestaña,
  // para retomar el mismo scope/encuesta al volver a primer plano.
  const pendingResumeScopeRef = useRef<"shift" | "survey">("shift")
  const pendingResumeResponseIdRef = useRef<string | null>(null)
  const currentSurveyResponseIdRef = useRef<string | null>(null)

  // BUG DE PRODUCCIÓN (2026-07-28): "Inicia encuesta" sin protección contra
  // reentrancia dejaba que startSurveySegment, la rotación automática del
  // segmento de turno, y el handler de visibilitychange corrieran en
  // paralelo cuando coincidían (ej. un doble click, o un cambio de
  // visibilidad justo al iniciar encuesta). Todas mutan currentSegmentRef y
  // llaman new MediaRecorder(streamRef.current) sobre el MISMO stream
  // compartido — al superponerse, el navegador terminaba lanzando
  // "NotSupportedError: Failed to execute 'start' on 'MediaRecorder'" y
  // varios segmentos quedaban huérfanos (los PATCH de cierre fallaban con
  // 500 porque el segmento ya había sido reemplazado). Fix: todas las
  // operaciones que abren/cierran un segmento pasan por esta cola — se
  // ejecutan una a la vez, en orden, nunca en paralelo.
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

  // Sube el blob acumulado de un segmento y lo marca terminado en el backend.
  // responseId es opcional: para segmentos scope='survey' recién se conoce al
  // enviar/abandonar la encuesta, así que se adjunta en este punto (cierre),
  // no al abrir el segmento.
  const uploadSegment = useCallback(async (segment: StartedSegment, responseId?: string | null) => {
    const blob = new Blob(segment.chunks, { type: segment.recorder.mimeType || "audio/webm" })
    const durationSecs = Math.round((Date.now() - segment.startedAt) / 1000)
    const formData = new FormData()
    formData.append("file", blob, `${segment.recordingId}.webm`)
    formData.append("durationSecs", String(durationSecs))
    if (responseId) formData.append("responseId", responseId)
    try {
      await fetch(`/api/portal-encuestador/recordings/${segment.recordingId}`, {
        method: "PATCH",
        body: formData,
      })
    } catch (err) {
      console.error("Error subiendo segmento de audio:", err)
    }
  }, [])

  // Crea un segmento nuevo en el backend y arranca un MediaRecorder para él.
  const openSegment = useCallback(async (scope: "shift" | "survey", responseId?: string) => {
    if (!streamRef.current || !shiftIdRef.current) return null
    const res = await fetch("/api/portal-encuestador/recordings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId: shiftIdRef.current, scope, responseId }),
    })
    if (!res.ok) {
      console.error("No se pudo crear el segmento de grabación")
      return null
    }
    const { recordingId } = await res.json()

    // recorder.start() puede lanzar NotSupportedError si el MediaStream
    // quedó en un estado inválido (ej. dos MediaRecorder intentando arrancar
    // casi al mismo tiempo sobre el mismo stream — ver runExclusive arriba).
    // Sin este try/catch, el error se propagaba como una promesa rechazada
    // sin capturar y el segmento en el backend quedaba "pending" para
    // siempre (nunca se sube ni se marca failed). Ahora, si falla, se marca
    // el segmento como failed en el backend y se devuelve null como
    // cualquier otro caso de fallo — el llamador ya sabe manejar null.
    try {
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined)
      const segment: StartedSegment = { recordingId, scope, recorder, chunks: [], startedAt: Date.now() }
      recorder.ondataavailable = (e) => { if (e.data.size > 0) segment.chunks.push(e.data) }
      recorder.start()
      return segment
    } catch (err) {
      console.error("Error iniciando MediaRecorder para el segmento:", err)
      try {
        // Sin campo "file" -> el backend lo marca upload_status='failed' (ver
        // app/api/portal-encuestador/recordings/[id]/route.ts).
        await fetch(`/api/portal-encuestador/recordings/${recordingId}`, {
          method: "PATCH",
          body: new FormData(),
        })
      } catch { /* best effort */ }
      return null
    }
  }, [])

  // Corta el segmento actual (si hay uno) y sube su audio. responseId opcional:
  // se pasa cuando ya se conoce (fin de encuesta enviada/abandonada) para
  // ligar el segmento 'survey' a su fila real en `responses`.
  const closeCurrentSegment = useCallback(async (responseId?: string | null) => {
    const segment = currentSegmentRef.current
    if (!segment) return
    currentSegmentRef.current = null
    if (rotateTimerRef.current) { clearTimeout(rotateTimerRef.current); rotateTimerRef.current = null }

    await new Promise<void>((resolve) => {
      if (segment.recorder.state === "inactive") { resolve(); return }
      segment.recorder.onstop = () => resolve()
      segment.recorder.stop()
    })
    await uploadSegment(segment, responseId)
  }, [uploadSegment])

  // Programa el corte/reinicio automático de un segmento 'shift' cada N minutos,
  // para no perder audio largo en un solo blob y para subirlo incrementalmente.
  const scheduleShiftRotation = useCallback(() => {
    if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current)
    rotateTimerRef.current = setTimeout(() => {
      runExclusive(async () => {
        // Solo rota si seguimos en modo 'shift' (si ya se abrió una encuesta, no interferir)
        if (currentSegmentRef.current?.scope === "shift") {
          await closeCurrentSegment()
          const next = await openSegment("shift")
          if (next) {
            currentSegmentRef.current = next
            scheduleShiftRotation()
          }
        }
      })
    }, SHIFT_SEGMENT_ROTATE_MS)
  }, [runExclusive, closeCurrentSegment, openSegment])

  // Inicia el turno: pide permiso de micrófono, crea el turno en el backend,
  // y arranca la grabación de fondo (scope='shift'). Se llama automáticamente
  // al entrar al portal, apenas el encuestador inicia sesión.
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
        // Defensivo: si por alguna razón ya hay un segmento abierto (ej.
        // startShift llamado dos veces), no pisarlo con uno nuevo.
        if (currentSegmentRef.current) { setStatus("recording-shift"); return }
        const segment = await openSegment("shift")
        if (segment) {
          currentSegmentRef.current = segment
          scheduleShiftRotation()
          setStatus("recording-shift")
        } else {
          setStatus("error")
          setError("No se pudo iniciar la grabación de fondo")
        }
      })
    } catch (err) {
      console.error(err)
      setStatus("error")
      setError("No se pudo iniciar el turno")
    }
  }, [runExclusive, openSegment, scheduleShiftRotation])

  // Al abrir una encuesta: corta el segmento de fondo y arranca uno dedicado
  // a esa encuesta. responseId es opcional y normalmente NO se conoce en este
  // punto (la fila en `responses` recién se crea al enviar/abandonar) — se
  // liga después, en endSurveySegment, cuando ya existe.
  const startSurveySegment = useCallback(async (responseId?: string) => {
    await runExclusive(async () => {
      if (statusRef.current !== "recording-shift" && statusRef.current !== "recording-survey") return
      // Ya estamos en la encuesta (llamada duplicada, ej. doble click) — no
      // abrir un segundo segmento sobre el mismo MediaStream.
      if (currentSegmentRef.current?.scope === "survey") return
      await closeCurrentSegment()
      const segment = await openSegment("survey", responseId)
      if (segment) {
        currentSegmentRef.current = segment
        currentSurveyResponseIdRef.current = responseId ?? null
        setStatus("recording-survey")
      }
    })
  }, [runExclusive, closeCurrentSegment, openSegment])

  // Al terminar/abandonar la encuesta: corta el segmento de la encuesta y
  // retoma automáticamente la grabación de fondo del turno. responseId se
  // pasa aquí (ya se conoce: se acaba de enviar o registrar el abandono) para
  // ligar el audio de esta encuesta a su fila real en `responses`.
  const endSurveySegment = useCallback(async (responseId?: string) => {
    await runExclusive(async () => {
      if (statusRef.current !== "recording-survey") return
      await closeCurrentSegment(responseId ?? currentSurveyResponseIdRef.current)
      currentSurveyResponseIdRef.current = null
      const segment = await openSegment("shift")
      if (segment) {
        currentSegmentRef.current = segment
        scheduleShiftRotation()
        setStatus("recording-shift")
      }
    })
  }, [runExclusive, closeCurrentSegment, openSegment, scheduleShiftRotation])

  // Cierra todo: corta el segmento en curso, sube el audio y marca el turno
  // como terminado. Se llama al cerrar sesión. keepalive:true permite que el
  // fetch de cierre siga en curso brevemente aunque la pestaña ya se esté
  // descargando (caso pagehide, ver más abajo) — sin esto, el navegador
  // puede cancelar la petición a mitad de camino y el turno queda "activo"
  // para siempre en la base de datos.
  const endShift = useCallback(async () => {
    await closeCurrentSegment()
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
  }, [closeCurrentSegment])

  // Mejor esfuerzo: si se cierra la pestaña/navegador desde CUALQUIER página
  // del portal (dashboard o una encuesta en curso), intenta cerrar el turno.
  // Vive aquí (a nivel del hook, instanciado una sola vez en
  // app/portal-encuestador/layout.tsx) y no en cada página, porque si
  // viviera en la página del dashboard se perdería al navegar a una
  // encuesta (esa página se desmonta y se lleva su listener con ella).
  useEffect(() => {
    const handler = () => { endShift() }
    window.addEventListener("pagehide", handler)
    return () => window.removeEventListener("pagehide", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mejor esfuerzo: si la pestaña se oculta o se está por cerrar, intenta
  // cortar y subir el segmento en curso. No hay garantía de que complete
  // (limitación de navegador, ver comentario arriba del archivo).
  useEffect(() => {
    const handleVisibility = () => {
      runExclusive(async () => {
        if (document.visibilityState === "hidden" && currentSegmentRef.current) {
          // Best effort: sube lo grabado hasta ahora antes de que el navegador
          // pueda suspender la pestaña. Recordamos qué scope tenía el segmento
          // para poder retomarlo exactamente igual al volver.
          pendingResumeScopeRef.current = currentSegmentRef.current.scope
          pendingResumeResponseIdRef.current = currentSegmentRef.current.scope === "survey"
            ? currentSurveyResponseIdRef.current
            : null
          await closeCurrentSegment()
        } else if (document.visibilityState === "visible" && !currentSegmentRef.current && shiftIdRef.current && streamRef.current) {
          // Volvimos a primer plano sin un segmento activo — retoma grabando
          // en el mismo scope en el que estaba antes de ocultarse.
          const scope = pendingResumeScopeRef.current ?? "shift"
          const responseId = pendingResumeResponseIdRef.current ?? undefined
          const segment = await openSegment(scope, responseId)
          if (segment) {
            currentSegmentRef.current = segment
            if (scope === "shift") scheduleShiftRotation()
          }
        }
      })
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [runExclusive, closeCurrentSegment, openSegment, scheduleShiftRotation])

  // Cleanup al desmontar el componente (navegación fuera del portal).
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return { status, error, shiftId, startShift, endShift, startSurveySegment, endSurveySegment }
}
