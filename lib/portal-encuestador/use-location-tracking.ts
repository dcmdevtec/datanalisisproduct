"use client"

import { useEffect, useRef, useState } from "react"
import type { RecordingStatus } from "./use-shift-recording"

// Mismo intervalo que usa la APK por defecto (tracking_config.update_interval_seconds
// = 60, ver comentarios en app/api/tracking/route.ts) — así el mapa de
// seguimiento se comporta igual sin importar si el encuestador trabaja desde
// la APK o desde el navegador.
const LOCATION_UPDATE_INTERVAL_MS = 60 * 1000

export type LocationTrackingStatus = "idle" | "active" | "denied" | "error"

// Pregunta del usuario (2026-07-29): "[el mapa de encuestadores activo/
// inactivo] ya lo hace con la apk pero con el de la web no se si lo hace" —
// confirmado por búsqueda en el código: no había NINGÚN lugar en el portal
// web (/portal-encuestador) que llamara a /api/location. Solo la APK
// reportaba ubicación; un encuestador trabajando desde el navegador nunca
// aparecía como "activo" en el mapa del admin, sin importar cuánto
// trabajara.
//
// Este hook reporta la ubicación mientras el turno está grabando
// (recording-shift o recording-survey) — deliberadamente ligado al estado
// de grabación, no a estar simplemente en la página, para no reportar
// ubicación de alguien que ni siquiera pasó la pantalla de consentimiento.
// A diferencia del micrófono, el permiso de geolocalización NO bloquea el
// trabajo si se niega: solo significa que ese encuestador no se verá en el
// mapa, igual que pasaría con la APK sin GPS disponible.
//
// BUG encontrado en la primera versión (2026-07-29, "no aparezco activo en
// el mapa"): tanto un permiso de ubicación denegado por el navegador como un
// rechazo del servidor (401/500) quedaban en un simple console.warn/error —
// invisibles para cualquiera que no tuviera las herramientas de desarrollador
// abiertas. A diferencia de `fetch` fallando por RED (que sí rechaza la
// promesa y entra al .catch), una respuesta HTTP no-ok como 401 resuelve la
// promesa igual — sin revisar `res.ok` ese caso pasaba completamente
// desapercibido. Ahora el hook expone un status que la UI puede mostrar.
// enabled (pedido 2026-07-29): igual que con el audio, el toggle
// "Recolección de Ubicación" de la encuesta ahora sí pausa el reporte de
// ubicación mientras el encuestador está DENTRO de esa encuesta puntual —
// fuera de una encuesta (dashboard, caminando entre asignaciones) el
// tracking de fondo sigue funcionando siempre, solo se pausa para la
// encuesta específica que lo desactivó.
export function useLocationTracking(status: RecordingStatus, activeSurveyId?: string | null, enabled: boolean = true) {
  const [trackingStatus, setTrackingStatus] = useState<LocationTrackingStatus>("idle")
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeSurveyIdRef = useRef<string | null | undefined>(activeSurveyId)
  useEffect(() => {
    activeSurveyIdRef.current = activeSurveyId
  }, [activeSurveyId])

  useEffect(() => {
    const tracking = (status === "recording-shift" || status === "recording-survey") && enabled
    if (!tracking) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setTrackingStatus("idle")
      return
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setTrackingStatus("error")
      return
    }

    const sendUpdate = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetch("/api/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              app_version: "web",
              active_survey_id: activeSurveyIdRef.current || undefined,
              is_foreground: typeof document !== "undefined" ? document.visibilityState === "visible" : true,
            }),
          })
            .then(async (res) => {
              if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                console.error("[location-tracking] El servidor rechazó la ubicación:", res.status, body?.error || body)
                setTrackingStatus("error")
                return
              }
              setTrackingStatus("active")
            })
            .catch((err) => {
              console.error("[location-tracking] Error de red enviando ubicación:", err)
              setTrackingStatus("error")
            })
        },
        (err) => {
          console.warn("[location-tracking] No se pudo obtener la ubicación:", err.message)
          setTrackingStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error")
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      )
    }

    sendUpdate() // primer reporte inmediato apenas arranca la grabación, no esperar 60s
    timerRef.current = setInterval(sendUpdate, LOCATION_UPDATE_INTERVAL_MS)
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [status, enabled])

  return trackingStatus
}
