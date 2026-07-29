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

export function CameraCaptureModal({ open, onClose, onCapture }: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<"starting" | "ready" | "error">("starting")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // En algunos laptops/tablets con más de una cámara, permite alternar sin
  // cerrar el modal. No es crítico — si falla, simplemente no se ofrece.
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const startStream = useCallback(async (mode: "environment" | "user") => {
    setStatus("starting")
    setErrorMsg(null)
    stopStream()
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Este navegador no soporta acceso a la cámara")
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => { })
      }
      setStatus("ready")
    } catch (err: any) {
      console.error("Error abriendo la cámara:", err)
      const denied = err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError"
      setErrorMsg(
        denied
          ? "No se concedió permiso de cámara. Actívalo en la configuración del navegador o usa 'Agregar archivos'."
          : "No se pudo acceder a la cámara en este dispositivo. Puedes usar 'Agregar archivos' en su lugar."
      )
      setStatus("error")
    }
  }, [stopStream])

  useEffect(() => {
    if (open) {
      startStream(facingMode)
    } else {
      stopStream()
    }
    // Cierra la cámara si el modal se desmonta sin pasar por onClose
    // (navegación, cierre de pestaña, etc.) — evita dejar el foco de cámara
    // prendido en segundo plano.
    return () => stopStream()
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
            <div className="text-white text-sm text-center px-6">{errorMsg}</div>
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
