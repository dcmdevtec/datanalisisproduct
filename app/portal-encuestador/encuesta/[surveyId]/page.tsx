"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { useAuth } from "@/components/auth-provider"
import supabase from "@/lib/supabase/client"
import { useRecordingContext } from "@/lib/portal-encuestador/recording-context"
import { IncidenceScreen } from "@/components/portal-encuestador/incidence-screen"
import { AbandonSurveyButton } from "@/components/portal-encuestador/abandon-survey-button"
import { useToast } from "@/components/ui/use-toast"
import { loadSurveyIntoPreviewStorage } from "@/lib/survey-preview-data"
import { Loader2 } from "lucide-react"

// Renderer real de encuestas — se carga dinámico (sin SSR) igual que en
// /encuesta/[id] y /preview/survey, ya que depende de APIs de navegador
// (localStorage, MediaRecorder indirectamente vía el portal, etc).
const SurveyPreviewPage = dynamic(() => import("@/app/preview/survey/page"), { ssr: false })

type Stage = "loading" | "incidence" | "survey" | "denied" | "not-found"

interface AssignmentInfo {
  assignmentId: string
  surveyId: string
  title: string
  description: string | null
  zoneName: string
}

// Ruta autenticada de toma de encuesta para el portal de encuestador. NO usa
// el enlace público /encuesta/[id] (anónimo, sin zona, sin incidencia, sin
// abandonar) — envuelve el mismo motor de encuestas con: verificación de que
// la encuesta pertenece al encuestador logueado, la pantalla de incidencia
// previa (pptx slide 3), el botón abandonar (pptx slide 4), y el wiring de
// los segmentos de grabación por encuesta (ver FASE2_PENDIENTE.md).
export default function PortalEncuestadorSurveyPage() {
  const { surveyId } = useParams<{ surveyId: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const recording = useRecordingContext()

  const [stage, setStage] = useState<Stage>("loading")
  const [assignment, setAssignment] = useState<AssignmentInfo | null>(null)
  const [startingSurvey, setStartingSurvey] = useState(false)
  const verifiedRef = useRef(false)

  // Verifica rol + que la encuesta esté realmente asignada a este encuestador.
  // OJO: recording.status DELIBERADAMENTE no está en las dependencias. Si lo
  // estuviera, cada vez que handleStartSurvey/endSurveySegment cambian el
  // status ("recording-shift" <-> "recording-survey") este efecto se
  // repetiría completo y pisaría stage con "incidence" otra vez, devolviendo
  // al encuestador a la pantalla de incidencia justo después de haber
  // arrancado la encuesta. Solo nos interesa el status en el momento en que
  // se entra a la página (gate inicial), no como trigger de re-verificación.
  useEffect(() => {
    if (verifiedRef.current) return
    if (authLoading) return
    if (!user) { router.push("/login"); return }
    verifiedRef.current = true
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from("users").select("role").eq("id", user.id).single()
      if (cancelled) return
      if ((data as any)?.role !== "surveyor") { router.push("/dashboard"); return }

      // La grabación del turno debe estar activa (se arranca desde el
      // dashboard, apenas se da el consentimiento). Si alguien llega acá
      // directo por URL sin haber pasado por ahí, lo mandamos al dashboard.
      if (recording.status !== "recording-shift" && recording.status !== "recording-survey") {
        router.push("/portal-encuestador")
        return
      }

      try {
        const res = await fetch(`/api/portal-encuestador/assignments/${surveyId}`)
        if (!res.ok) { if (!cancelled) setStage("not-found"); return }
        const json = await res.json()
        if (cancelled) return
        setAssignment(json)
        setStage("incidence")
      } catch {
        if (!cancelled) setStage("not-found")
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, surveyId])

  // "Inicia encuesta": arranca el segmento de grabación dedicado y muestra el renderer.
  //
  // CORRECCIÓN CRÍTICA: SurveyPreviewPage (el motor de encuestas compartido)
  // NUNCA hace fetch por su cuenta — en su montaje SIEMPRE lee
  // localStorage.getItem("surveyPreviewData") y, si no encuentra nada, hace
  // router.push("/") de inmediato. La única razón por la que el link
  // público /encuesta/[id] funciona es que esa página puebla ese localStorage
  // ANTES de montar el motor (ver lib/survey-preview-data.ts). Antes de este
  // fix, esta página montaba el motor directo, sin ese paso — por eso al
  // pulsar "Inicia encuesta" el encuestador terminaba expulsado a la página
  // principal en vez de ver la encuesta.
  const handleStartSurvey = useCallback(async () => {
    if (startingSurvey) return
    setStartingSurvey(true)
    const result = await loadSurveyIntoPreviewStorage(surveyId)
    setStartingSurvey(false)
    if (!result.ok) {
      toast({
        title: "No se pudo abrir la encuesta",
        description: result.message || "Intenta de nuevo.",
        variant: "destructive",
      })
      return
    }
    recording.startSurveySegment()
    setStage("survey")
  }, [recording, surveyId, startingSurvey, toast])

  // Motivo de incidencia seleccionado: registra la respuesta (outcome='incidencia')
  // y vuelve al dashboard. No hubo segmento 'survey' que cerrar (no se llegó a
  // iniciar la encuesta) — el audio de este intento quedó en el segmento de turno.
  const handleReportIncidence = useCallback(async (reason: string) => {
    if (!assignment) return
    try {
      const res = await fetch("/api/portal-encuestador/responses/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: assignment.assignmentId, outcome: "incidencia", incidenceType: reason }),
      })
      if (!res.ok) throw new Error("No se pudo registrar la incidencia")
      toast({ title: "Incidencia registrada", description: reason })
      router.push("/portal-encuestador")
    } catch (err) {
      console.error(err)
      toast({ title: "Error", description: "No se pudo registrar la incidencia", variant: "destructive" })
    }
  }, [assignment, router, toast])

  // Botón "Abandonar encuesta": cierra el segmento de audio de la encuesta
  // (ligándolo al response_id de abandono), registra outcome='abandonada' y
  // vuelve al dashboard, retomando la grabación de fondo del turno.
  const handleAbandon = useCallback(async () => {
    if (!assignment) return
    try {
      const res = await fetch("/api/portal-encuestador/responses/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: assignment.assignmentId, outcome: "abandonada" }),
      })
      const json = await res.json().catch(() => ({}))
      await recording.endSurveySegment(json?.response_id)
      toast({ title: "Encuesta abandonada", description: "Se registró el abandono." })
      router.push("/portal-encuestador")
    } catch (err) {
      console.error(err)
      await recording.endSurveySegment()
      router.push("/portal-encuestador")
    }
  }, [assignment, recording, router, toast])

  // Al enviar la encuesta completa (outcome='efectiva', ya seteado por
  // defecto en /api/responses): cierra el segmento de audio ligándolo al
  // response_id real y vuelve al dashboard tras un momento.
  const handleSubmitted = useCallback((responseId: string) => {
    recording.endSurveySegment(responseId)
    setTimeout(() => router.push("/portal-encuestador"), 1500)
  }, [recording, router])

  if (stage === "loading" || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (stage === "not-found") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <div className="text-center">
          <p className="font-medium">Esta encuesta no está disponible para ti.</p>
          <p className="text-sm text-muted-foreground mt-1">Puede que ya no esté asignada a tu zona.</p>
        </div>
      </div>
    )
  }

  if (stage === "incidence" && assignment) {
    return (
      <IncidenceScreen
        surveyTitle={assignment.title}
        zoneName={assignment.zoneName}
        onStartSurvey={handleStartSurvey}
        onReportIncidence={handleReportIncidence}
        startingSurvey={startingSurvey}
      />
    )
  }

  if (stage === "survey" && assignment) {
    return (
      <>
        <SurveyPreviewPage assignmentId={assignment.assignmentId} onSubmitted={handleSubmitted} />
        <AbandonSurveyButton onAbandon={handleAbandon} />
      </>
    )
  }

  return null
}
