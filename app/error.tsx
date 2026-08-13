"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

// error.tsx: captura errores en el árbol de componentes de una ruta.
// A diferencia de global-error.tsx, aquí el layout sigue funcionando
// (header, auth, etc.) y solo la sección de contenido muestra el error.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    const isChunkError =
      error?.name === "ChunkLoadError" ||
      error?.message?.includes("Loading chunk") ||
      error?.message?.includes("Failed to fetch dynamically imported module") ||
      error?.message?.includes("Importing a module script failed")

    if (isChunkError) {
      const timer = setTimeout(() => window.location.reload(), 300)
      return () => clearTimeout(timer)
    }

    console.error("[Error boundary]", error?.message)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
      <div className="text-4xl">⚠️</div>
      <h2 className="text-lg font-semibold text-gray-900">Algo salió mal</h2>
      <p className="text-sm text-gray-500 text-center max-w-sm">
        Ocurrió un error inesperado en esta sección. Puedes intentar recargar.
      </p>
      <div className="flex gap-3">
        <Button onClick={() => window.location.reload()}>Recargar</Button>
        <Button variant="outline" onClick={reset}>Reintentar</Button>
      </div>
      {process.env.NODE_ENV !== "production" && (
        <pre className="text-xs text-gray-400 max-w-md overflow-x-auto p-3 bg-gray-50 rounded-lg mt-2">
          {error?.message}
        </pre>
      )}
    </div>
  )
}
