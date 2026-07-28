"use client"

import { ReactNode } from "react"
import { RecordingProvider } from "@/lib/portal-encuestador/recording-context"

// Layout compartido por /portal-encuestador y /portal-encuestador/encuesta/[id].
// El RecordingProvider vive aquí (no dentro de cada página) para que el turno
// de grabación siga activo al navegar del dashboard a una encuesta y de vuelta.
export default function PortalEncuestadorLayout({ children }: { children: ReactNode }) {
  return <RecordingProvider>{children}</RecordingProvider>
}
