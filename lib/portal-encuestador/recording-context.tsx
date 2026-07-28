"use client"

import { createContext, useContext, ReactNode } from "react"
import { useShiftRecording } from "./use-shift-recording"

// El hook useShiftRecording mantiene un MediaStream de micrófono vivo en un
// ref — si se instanciara por página (un hook distinto en /portal-encuestador
// y otro en /portal-encuestador/encuesta/[id]), cada navegación entre esas
// rutas desmontaría el componente dueño del hook y el cleanup cortaría el
// stream, perdiendo la grabación continua del turno. Por eso se crea UNA sola
// instancia a nivel de layout (ver app/portal-encuestador/layout.tsx), que
// persiste mientras el usuario se mueve entre el dashboard y una encuesta.
type RecordingContextValue = ReturnType<typeof useShiftRecording>

const RecordingContext = createContext<RecordingContextValue | null>(null)

export function RecordingProvider({ children }: { children: ReactNode }) {
  const recording = useShiftRecording()
  return <RecordingContext.Provider value={recording}>{children}</RecordingContext.Provider>
}

export function useRecordingContext() {
  const ctx = useContext(RecordingContext)
  if (!ctx) {
    throw new Error("useRecordingContext debe usarse dentro de <RecordingProvider> (app/portal-encuestador/layout.tsx)")
  }
  return ctx
}
