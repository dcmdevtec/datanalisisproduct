"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Camera, Loader2, RotateCcw, X } from "lucide-react"

// Modal de captura de foto vía getUserMedia (auditoría de producción
// 2026-07-29: el botón "Tomar foto" solo usaba
// <input type="file" capture="environment">, que en desktop cualquier
// navegador lo ignora y muestra el selector de archivos normal — el pedido
// explícito fue que la cámara funcione igual en PC (webcam) y en
// celular/tablet (cámara trasera). getUserMedia funciona en ambos, así que
// esto reemplaza el truco del input nativo como método principal; ese input
// se mantiene como respaldo silencioso en el componente que llama a este
// modal, por si getUserMedia no está disponible en el navegador.
//
// Uso: <CameraCaptureModal open={open} onClose={...} onCapture={(file) => ...} />

interface CameraCaptureModalProps {
  open: boolean
  onClose: () => void
  onCapture: (file: File) => void
}

// Espera una confirmación real de que el <video> tiene frames (evento
// loadedmetadata) — separado de startStream para poder envolverlo en un
// timeout independiente del de getUserMedia.
function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 1) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onLoaded)
      video.removeEventListener("error", onError)
    }
    const onLoaded = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error("No se pudo iniciar la vista previa de la cámara"))
    }
    video.addEventListener("loadedmetadata", onLoaded, { once: true })
    video.addEventListener("error", onError, { once: true })
  })
}

// Timeout genérico: si `promise` no resuelve/rechaza dentro de `ms`, se
// rechaza con `timeoutTag` (un marcador interno, no un mensaje para el
// usuario — el llamador decide qué mostrar).
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutTag: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutTag)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

export function CameraCaptureModal({ open, onClose, onCapture }: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<"starting" | "ready" | "error">("starting")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // En algunos laptops/tablets con más de una cámara, permite alternar sin
  // cerrar el modal. No es crítico — si falla, simplemente no se ofrece.
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")

  // Bug reportado 2026-07-29 ("se queda cargando, está bugueada"): el modal
  // ahora queda siempre montado (fix anterior del cierre que no funcionaba),
  // así que un intento de startStream() en curso puede seguir vivo después
  // de que el usuario cerró y volvió a abrir el modal — sin esto, el
  // resultado del intento viejo (éxito o error) podía pisar el estado del
  // intento nuevo. requestIdRef marca cada intento; si al resolver ya no es
  // el intento vigente, se descarta (y se libera el stream si llegó tarde).
  const requestIdRef = useRef(0)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const startStream = useCallback(async (mode: "environment" | "user") => {
    const requestId = ++requestIdRef.current
    setStatus("starting")
    setErrorMsg(null)
    stopStream()
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Este navegador no soporta acceso a la cámara")
      }
      // Bug reportado 2026-07-29: getUserMedia() no tenía ningún timeout —
      // si el diálogo de permiso quedaba colgado (frecuente en algunos
      // WebView de Android/tablet) o la cámara seguía "ocupada" un instante
      // por el intento anterior, el modal se quedaba en "Abriendo cámara..."
      // para siempre, sin forma de recuperarse salvo cerrar. Ahora cada paso
      // tiene su propio límite de tiempo y cae a un estado de error claro
      // con opción de reintentar.
      const stream = await withTimeout(
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode } },
          audio: false,
        }),
        10000,
        "TIMEOUT_PERMISO"
      )
      if (requestId !== requestIdRef.current) {
        // El usuario cerró/reintentó mientras esperábamos el permiso — este
        // resultado ya no aplica, pero igual hay que liberar la cámara.
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = stream
      const video = videoRef.current
      if (!video) {
        throw new Error("No se pudo inicializar la vista previa de la cámara")
      }
      video.srcObject = stream
      // Bug reportado antes: la vista previa se veía en negro pero el botón
      // "Capturar" estaba habilitado porque se ignoraba el resultado de
      // play(). Ahora se espera una confirmación real de frames y un
      // play() fallido se trata como error real.
      await withTimeout(waitForVideoReady(video), 8000, "TIMEOUT_PREVIEW")
      if (requestId !== requestIdRef.current) return
      await video.play()
      if (requestId !== requestIdRef.current) return
      setStatus("ready")
    } catch (err: any) {
      if (requestId !== requestIdRef.current) return
      console.error("Error abriendo la cámara:", err)
      const denied = err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError"
      const timedOut = err?.message === "TIMEOUT_PERMISO" || err?.message === "TIMEOUT_PREVIEW"
      setErrorMsg(
        denied
          ? "No se concedió permiso de cámara. Actívalo en la configuración del navegador o usa 'Agregar archivos'."
          : timedOut
          ? "La cámara está tardando demasiado en responder (puede estar en uso por otra app). Pulsa 'Reintentar' o usa 'Agregar archivos'."
          : "No se pudo acceder a la cámara en este dispositivo. Puedes usar 'Agregar archivos' en su lugar."
      )
      setStatus("error")
    }
  }, [stopStream])

  useEffect(() => {
    if (open) {
      startStream(facingMode)
    } else {
      requestIdRef.current += 1 // invalida cualquier intento en curso de inmediato
      stopStream()
    }
    // Cierra la cámara si el modal se desmonta sin pasar por onClose
    // (navegación, cierre de pestaña, etc.) — evita dejar el foco de cámara
    // prendido en segundo plano.
    return () => {
      requestIdRef.current += 1
      stopStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleCapture = () => {
    const video = videoRef.current
    if (!video || status !== "ready") return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" })
        stopStream()
        onCapture(file)
      },
      "image/jpeg",
      0.9
    )
  }

  const handleFlip = () => {
    const next = facingMode === "environment" ? "user" : "environment"
    setFacingMode(next)
    startStream(next)
  }

  const handleClose = () => {
    requestIdRef.current += 1
    stopStream()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" /> Tomar foto
          </DialogTitle>
        </DialogHeader>

        <div className="relative bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
          {status === "starting" && (
            <div className="text-white flex flex-col items-center gap-2 text-sm">
              <Loader2 className="h-6 w-6 animate-spin" /> Abriendo cámara...
            </div>
          )}
          {status === "error" && (
            <div className="text-white text-sm text-center px-6 flex flex-col items-center gap-3">
              <span>{errorMsg}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="bg-transparent text-white border-white/40 hover:bg-white/10 hover:text-white"
                onClick={() => startStream(facingMode)}
              >
                Reintentar
              </Button>
            </div>
          )}
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${status === "ready" ? "" : "hidden"}`}
          />
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            <X className="h-4 w-4 mr-1.5" /> Cancelar
          </Button>
          <div className="flex gap-2">
            {status === "ready" && (
              <Button type="button" variant="outline" onClick={handleFlip} title="Cambiar cámara">
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            <Button type="button" onClick={handleCapture} disabled={status !== "ready"}>
              <Camera className="h-4 w-4 mr-1.5" /> Capturar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
