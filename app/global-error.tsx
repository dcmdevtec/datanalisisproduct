"use client"

// global-error.tsx: captura errores de render no manejados en toda la app,
// incluidos ChunkLoadError (deploy con caché vieja), errores de hidratación,
// y excepciones de componentes sin ErrorBoundary propio.
// Reemplaza la pantalla genérica de Next.js "Application error: a client-side
// exception has occurred" con una UI que el usuario puede recuperar.

import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // ChunkLoadError ocurre cuando el navegador cachea HTML viejo y los
    // chunks JS ya cambiaron de hash en el nuevo deploy. La solución es
    // forzar un hard-reload para que el browser pida el HTML fresco.
    const isChunkError =
      error?.name === "ChunkLoadError" ||
      error?.message?.includes("Loading chunk") ||
      error?.message?.includes("Failed to fetch dynamically imported module") ||
      error?.message?.includes("Importing a module script failed")

    if (isChunkError) {
      // Esperamos un tick para que Next.js termine su ciclo antes del reload
      const timer = setTimeout(() => {
        window.location.reload()
      }, 300)
      return () => clearTimeout(timer)
    }

    // Log en producción (console.error sobrevive removeConsole porque
    // viene de un ErrorBoundary de React, no de código de la app)
    console.error("[GlobalError]", error?.message, error?.digest)
  }, [error])

  const isChunkError =
    error?.name === "ChunkLoadError" ||
    error?.message?.includes("Loading chunk") ||
    error?.message?.includes("Failed to fetch dynamically imported module") ||
    error?.message?.includes("Importing a module script failed")

  if (isChunkError) {
    return (
      <html lang="es">
        <body style={{ margin: 0, fontFamily: "sans-serif", background: "#f9fafb" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 12 }}>
            <p style={{ color: "#6b7280", fontSize: 14 }}>Actualizando la aplicación…</p>
          </div>
        </body>
      </html>
    )
  }

  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "sans-serif", background: "#f9fafb" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16, padding: 24 }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>
            Algo salió mal
          </h1>
          <p style={{ color: "#6b7280", fontSize: 14, textAlign: "center", maxWidth: 360, margin: 0 }}>
            Ocurrió un error inesperado. Puedes intentar recargar la página.
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "8px 20px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}
            >
              Recargar página
            </button>
            <button
              onClick={reset}
              style={{ padding: "8px 20px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
            >
              Reintentar
            </button>
          </div>
          {process.env.NODE_ENV !== "production" && (
            <pre style={{ fontSize: 11, color: "#9ca3af", maxWidth: 500, overflowX: "auto", padding: 12, background: "#f3f4f6", borderRadius: 6 }}>
              {error?.message}
            </pre>
          )}
        </div>
      </body>
    </html>
  )
}
