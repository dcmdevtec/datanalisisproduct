"use client"

import { createContext, useContext, ReactNode, useState, useCallback } from "react"
import { useShiftRecording } from "./use-shift-recording"
import { useLocationTracking } from "./use-location-tracking"

// El hook useShiftRecording mantiene un MediaStream de micrófono vivo en un
// ref — si se instanciara por página (un hook distinto en /portal-encuestador
// y otro en /portal-encuestador/encuesta/[id]), cada navegación entre esas
// rutas desmontaría el componente dueño del hook y el cleanup cortaría el
// stream, perdiendo la grabación continua del turno. Por eso se crea UNA sola
// instancia a nivel de layout (ver app/portal-encuestador/layout.tsx), que
// persiste mientras el usuario se mueve entre el dashboard y una encuesta.
type RecordingContextValue = ReturnType<typeof useShiftRecording> & {
  locationStatus: ReturnType<typeof useLocationTracking>
  setLocationEnabled: (enabled: boolean) => void
}

const RecordingContext = createContext<RecordingContextValue | null>(null)

export function RecordingProvider({ children }: { children: ReactNode }) {
  const recording = useShiftRecording()
  // Pedido 2026-07-29: settings.collectLocation de la encuesta actual pausa
  // el reporte de ubicación mientras se está DENTRO de esa encuesta (fuera
  // de una encuesta, el tracking de fondo del turno sigue siempre activo).
  // La página de toma de encuesta llama a setLocationEnabled(false/true) al
  // entrar/salir de una encuesta según su configuración — por defecto
  // arranca en true para que el dashboard (sin encuesta abierta) siempre
  // reporte ubicación.
  const [locationEnabled, setLocationEnabled] = useState(true)
  const setLocationEnabledStable = useCallback((enabled: boolean) => setLocationEnabled(enabled), [])
  // Reporta ubicación a /api/location mientras el turno está grabando (ver
  // use-location-tracking.ts) — vive aquí, junto al motor de grabación, para
  // que también persista al navegar entre el dashboard y una encuesta.
  // locationStatus se expone en el contexto (bug 2026-07-29: "no aparezco
  // activo en el mapa" — antes un fallo de permiso o del servidor era
  // invisible salvo abriendo la consola) para poder mostrar un aviso en el
  // dashboard cuando la ubicación no se está reportando de verdad.
  const locationStatus = useLocationTracking(recording.status, undefined, locationEnabled)
  return (
    <RecordingContext.Provider value={{ ...recording, locationStatus, setLocationEnabled: setLocationEnabledStable }}>
      {children}
    </RecordingContext.Provider>
  )
}

export function useRecordingContext() {
  const ctx = useContext(RecordingContext)
  if (!ctx) {
    throw new Error("useRecordingContext debe usarse dentro de <RecordingProvider> (app/portal-encuestador/layout.tsx)")
  }
  return ctx
}
