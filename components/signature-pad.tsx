"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Eraser } from "lucide-react"

interface SignaturePadProps {
  // Firma actual como data URL PNG (ej. lo que ya haya respondido el
  // encuestador si vuelve a esta sección), o null/undefined si está vacía.
  value?: string | null
  onChange: (dataUrl: string | null) => void
  disabled?: boolean
}

// Canvas de firma real (antes esto era un placeholder estático: "Área para
// firma (simulado en preview)", sin ninguna forma de firmar de verdad).
// Usa la Pointer Events API (pointerdown/move/up) en vez de mouse+touch por
// separado — esa API unificada cubre mouse, dedo (touch) y lápiz óptico con
// el mismo código, y evita el problema clásico de que el navegador dispare
// eventos de touch Y de mouse sintéticos para la misma interacción.
export function SignaturePad({ value, onChange, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const [hasContent, setHasContent] = useState(!!value)

  const drawStoredValue = useCallback((dataUrl: string) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const img = new Image()
    img.onload = () => {
      const dpr = window.devicePixelRatio || 1
      ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr)
    }
    img.src = dataUrl
  }, [])

  // Ajusta el canvas a la resolución real de pantalla (devicePixelRatio)
  // para que la firma no se vea pixelada en móviles/retina, y lo re-arma si
  // el contenedor cambia de tamaño (responsive) — redimensionar un canvas
  // borra su contenido, así que se vuelve a dibujar la firma guardada.
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const rect = container.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.scale(dpr, dpr)
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.lineWidth = 2.5
      ctx.strokeStyle = "#1f2937"
    }
    if (value) drawStoredValue(value)
  }, [value, drawStoredValue])

  useEffect(() => {
    setupCanvas()
    window.addEventListener("resize", setupCanvas)
    return () => window.removeEventListener("resize", setupCanvas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    drawingRef.current = true
    setHasContent(true)
    lastPointRef.current = getPoint(e)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || !lastPointRef.current) return
    const point = getPoint(e)
    ctx.beginPath()
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    lastPointRef.current = point
  }

  const handlePointerUp = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastPointRef.current = null
    const canvas = canvasRef.current
    if (canvas) onChange(canvas.toDataURL("image/png"))
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasContent(false)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative w-full h-48 rounded-lg border-2 border-dashed border-gray-300 bg-white overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          // touch-none: evita que el navegador interprete el gesto de firmar
          // como un scroll de la página en móviles/tablets.
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        {!hasContent && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none px-4 text-center">
            Firma aquí con el mouse o el dedo
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Usa el mouse, el dedo o un lápiz óptico para firmar.</p>
        <Button type="button" variant="outline" size="sm" onClick={handleClear} disabled={disabled || !hasContent}>
          <Eraser className="h-3.5 w-3.5 mr-1.5" />
          Borrar firma
        </Button>
      </div>
    </div>
  )
}
