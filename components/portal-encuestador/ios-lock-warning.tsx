"use client"

import { useEffect, useState } from "react"
import { Smartphone, X } from "lucide-react"

// iPhone/iPad: iOS apaga el micrófono de una página web mientras la pantalla
// está bloqueada (limitación del sistema, ninguna página web puede evitarlo
// — ver lib/portal-encuestador/use-shift-recording.ts). El portal ya evita
// el apagado automático de la pantalla durante el intento, pero si el
// encuestador la bloquea con el botón, ese tramo no se graba. Este aviso se
// lo recuerda solo a quien usa iPhone/iPad (en Android sí se sigue grabando).
export function isAppleMobile(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  // iPadOS se presenta como Mac de escritorio, pero con pantalla táctil.
  return /Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1
}

export function IosLockWarning({ onDismiss, className = "" }: { onDismiss: () => void; className?: string }) {
  // Se detecta en el cliente después de montar, para no desajustar el HTML
  // inicial renderizado en el servidor.
  const [show, setShow] = useState(false)
  const [keepsScreenOn, setKeepsScreenOn] = useState(true)
  useEffect(() => {
    setShow(isAppleMobile())
    // Wake Lock existe desde iOS 16.4; en versiones anteriores la pantalla
    // sí se apaga sola y hay que decirle al encuestador que la toque.
    setKeepsScreenOn("wakeLock" in navigator)
  }, [])
  if (!show) return null

  return (
    <div className={`mx-auto w-full max-w-lg px-4 ${className}`}>
      <div role="alert" className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 shadow-sm">
        <Smartphone className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
        <div className="flex-1 text-sm">
          <p className="font-semibold">No bloquees la pantalla durante la encuesta</p>
          <p className="mt-0.5 text-amber-800">
            En iPhone, mientras la pantalla está bloqueada no se graba el audio.{" "}
            {keepsScreenOn
              ? "La pantalla se mantiene encendida sola; no presiones el botón de bloqueo hasta terminar."
              : "Toca la pantalla de vez en cuando para que no se apague sola, y no presiones el botón de bloqueo hasta terminar."}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar aviso"
          className="-m-1 rounded p-1 text-amber-700 hover:bg-amber-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
