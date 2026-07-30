"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import supabase from "@/lib/supabase/client"
import { useRecordingContext } from "@/lib/portal-encuestador/recording-context"
import { getPendingCount, flushQueue } from "@/lib/offline-queue"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Logo } from "@/components/ui/logo"
import {
  Loader2, Mic, MicOff, LogOut, MapPin, Clock, CheckCircle2, AlertTriangle, XCircle,
  BarChart3, RefreshCw, ChevronRight, ShieldAlert, MessageSquare,
} from "lucide-react"

interface SurveyItem {
  surveyId: string
  title: string
  description: string | null
  logo: string | null
  zoneName: string
  assignmentStatus: string
  deadline: string | null
  isGeneral: boolean
  zoneIds: string[]
}

interface DashboardKpis {
  surveyorName: string
  totalRegistros: number
  efectivas: number
  incidencias: number
  abandonadas: number
  lastUpdatedAt: string | null
}

export default function PortalEncuestadorPage() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const recording = useRecordingContext()

  const [roleChecked, setRoleChecked] = useState(false)
  const [isSurveyor, setIsSurveyor] = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)

  const [surveys, setSurveys] = useState<SurveyItem[]>([])
  const [surveysLoading, setSurveysLoading] = useState(true)
  const [kpis, setKpis] = useState<DashboardKpis | null>(null)
  const [kpisLoading, setKpisLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  // Contador de mensajes directos sin leer, para el botón de Mensajes del
  // header (módulo de mensajes del encuestador — antes no existía acceso
  // a esto desde el portal).
  const [unreadMessages, setUnreadMessages] = useState(0)
  // Cola offline (auditoría 2026-07-29): respuestas que un encuestador
  // completó sin señal y quedaron guardadas en IndexedDB (lib/offline-queue.ts)
  // esperando a sincronizarse. syncing evita disparar varios flush a la vez.
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const shiftStartedRef = useRef(false)

  // Verifica que el usuario logueado sea realmente un encuestador (role='surveyor'
  // + vinculado en surveyors.user_id). Si no, lo saca del portal — esta vista no
  // es para admins/supervisores.
  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push("/login"); return }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from("users").select("role").eq("id", user.id).single()
      if (cancelled) return
      if ((data as any)?.role !== "surveyor") {
        router.push("/dashboard")
        return
      }
      setIsSurveyor(true)
      setRoleChecked(true)
    })()
    return () => { cancelled = true }
  }, [user, authLoading, router])

  const fetchSurveys = useCallback(async () => {
    setSurveysLoading(true)
    try {
      const res = await fetch("/api/portal-encuestador/surveys")
      if (!res.ok) throw new Error("fetch failed")
      const json = await res.json()
      setSurveys(json.items || [])
    } catch {
      setSurveys([])
    } finally {
      setSurveysLoading(false)
    }
  }, [])

  const fetchKpis = useCallback(async () => {
    setKpisLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)
      const res = await fetch(`/api/portal-encuestador/dashboard?${params}`)
      if (!res.ok) throw new Error("fetch failed")
      const json = await res.json()
      setKpis(json)
    } catch {
      setKpis(null)
    } finally {
      setKpisLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    if (!roleChecked) return
    fetchSurveys()
  }, [roleChecked, fetchSurveys])

  useEffect(() => {
    if (!roleChecked) return
    fetchKpis()
  }, [roleChecked, fetchKpis])

  // Badge de mensajes sin leer en el header — polling liviano cada 15s.
  useEffect(() => {
    if (!roleChecked || !user) return
    const fetchUnread = async () => {
      try {
        const res = await fetch(`/api/messages?userId=${user.id}&limit=200`)
        if (!res.ok) return
        const data = await res.json()
        if (Array.isArray(data)) {
          setUnreadMessages(data.filter((m: any) => m.receiver === user.id && !m.read).length)
        }
      } catch {
        // silencioso, no es crítico para el dashboard
      }
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 15000)
    return () => clearInterval(interval)
  }, [roleChecked, user])

  // Cola offline (auditoría 2026-07-29): intenta sincronizar respuestas
  // pendientes al entrar al dashboard, cada vez que vuelve la conexión
  // (evento 'online'), y en un polling liviano cada 20s por si el navegador
  // nunca dispara 'online' explícitamente (pasa con conexiones que van y
  // vienen sin llegar a marcarse "offline" del todo).
  useEffect(() => {
    if (!roleChecked) return
    let cancelled = false
    const syncNow = async () => {
      setSyncing(true)
      try {
        await flushQueue()
      } finally {
        if (!cancelled) {
          setPendingSyncCount(await getPendingCount())
          setSyncing(false)
        }
      }
    }
    const refreshCountOnly = async () => {
      if (!cancelled) setPendingSyncCount(await getPendingCount())
    }
    refreshCountOnly()
    syncNow()
    const onOnline = () => syncNow()
    window.addEventListener("online", onOnline)
    const interval = setInterval(syncNow, 20000)
    return () => {
      cancelled = true
      window.removeEventListener("online", onOnline)
      clearInterval(interval)
    }
  }, [roleChecked])

  const handleSyncNow = useCallback(async () => {
    setSyncing(true)
    try {
      await flushQueue()
    } finally {
      setPendingSyncCount(await getPendingCount())
      setSyncing(false)
    }
  }, [])

  // Arranca el turno (y por lo tanto la grabación) apenas se confirma el
  // consentimiento — que a su vez se pide apenas se confirma que es un
  // encuestador válido, es decir, "apenas inician sesión".
  useEffect(() => {
    if (roleChecked && consentGiven && !shiftStartedRef.current) {
      shiftStartedRef.current = true
      recording.startShift()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleChecked, consentGiven])

  // Cierra el turno de grabación al cerrar sesión.
  const handleSignOut = async () => {
    await recording.endShift()
    await signOut()
  }

  // Nota: el listener de "pagehide" para cerrar el turno vive ahora dentro
  // de useShiftRecording (lib/portal-encuestador/use-shift-recording.ts),
  // no aquí — así sigue activo aunque el encuestador esté en una encuesta
  // (/portal-encuestador/encuesta/[surveyId]) y no en este dashboard.

  if (authLoading || !roleChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isSurveyor) return null // ya redirigiendo

  // Pantalla de consentimiento de grabación — se muestra una sola vez al
  // entrar, antes de pedir el permiso real de micrófono al navegador.
  if (!consentGiven) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center mb-2"><Logo size="lg" showText={false} /></div>
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
                <Mic className="h-6 w-6 text-red-500" />
              </div>
            </div>
            <CardTitle>Grabación de audio activa durante el turno</CardTitle>
            <CardDescription className="text-left space-y-2 pt-2">
              <span className="block">
                Este portal graba audio continuamente mientras tu turno está activo, incluyendo los
                traslados entre encuestas, y guarda además el audio de cada encuesta por separado.
              </span>
              <span className="block">Esto se usa para control de calidad y prevención de fraude en campo.</span>
              <span className="block font-medium text-foreground">
                Al continuar, el navegador te pedirá permiso de micrófono. Debes aceptarlo para poder trabajar.
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setConsentGiven(true)}>
              Entiendo, activar grabación y continuar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const kpiCards = [
    { label: "Total Registros", value: kpis?.totalRegistros ?? 0, icon: BarChart3, color: "text-foreground" },
    { label: "Efectivas", value: kpis?.efectivas ?? 0, icon: CheckCircle2, color: "text-[#18b0a4]" },
    { label: "Incidencias", value: kpis?.incidencias ?? 0, icon: AlertTriangle, color: "text-red-500" },
    { label: "Abandonadas", value: kpis?.abandonadas ?? 0, icon: XCircle, color: "text-amber-500" },
  ]

  return (
    <div className="min-h-screen bg-muted/30 pb-10">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Logo size="sm" showText={false} />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{kpis?.surveyorName ?? "Encuestador"}</p>
              <p className="text-xs text-muted-foreground">
                {kpis?.lastUpdatedAt
                  ? `Última actualización: ${new Date(kpis.lastUpdatedAt).toLocaleString("es-CO")}`
                  : "Sin actividad registrada aún"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <RecordingBadge status={recording.status} />
            <Link href="/portal-encuestador/mensajes">
              <Button variant="ghost" size="sm" className="relative">
                <MessageSquare className="h-4 w-4" />
                {unreadMessages > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none flex items-center justify-center">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </Badge>
                )}
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {recording.status === "denied" && (
          <div className="bg-red-50 border-t border-red-200 px-4 py-2">
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0" />
              {recording.error || "Sin permiso de micrófono — no podrás iniciar encuestas hasta activarlo."}
            </p>
          </div>
        )}
        {/* Bug reportado 2026-07-29 ("no aparezco activo en el mapa"): un
            permiso de ubicación denegado (o rechazado por el servidor) era
            antes completamente invisible en la interfaz — solo se veía en la
            consola del navegador. A diferencia del micrófono esto no bloquea
            el trabajo, pero si no se avisa, nadie sabe por qué no aparece en
            el mapa de seguimiento. */}
        {(recording.locationStatus.status === "denied" || recording.locationStatus.status === "error") && (
          <div className="bg-amber-50 border-t border-amber-200 px-4 py-2">
            <p className="text-xs text-amber-700 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              {recording.locationStatus.status === "denied"
                ? "Sin permiso de ubicación — no aparecerás activo en el mapa de seguimiento. Actívalo en la configuración del navegador."
                : "No se pudo reportar tu ubicación al servidor — puede que no aparezcas activo en el mapa de seguimiento."}
            </p>
          </div>
        )}
        {/* Cola offline (auditoría 2026-07-29): respuestas guardadas en este
            dispositivo mientras no había señal, pendientes de sincronizar. */}
        {pendingSyncCount > 0 && (
          <div className="bg-amber-50 border-t border-amber-200 px-4 py-2 flex items-center justify-between gap-2">
            <p className="text-xs text-amber-700 flex items-center gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 flex-shrink-0 ${syncing ? "animate-spin" : ""}`} />
              {pendingSyncCount === 1
                ? "1 respuesta guardada sin conexión, pendiente de sincronizar."
                : `${pendingSyncCount} respuestas guardadas sin conexión, pendientes de sincronizar.`}
            </p>
            <Button variant="ghost" size="sm" className="h-6 text-xs text-amber-700 hover:text-amber-900" onClick={handleSyncNow} disabled={syncing}>
              {syncing ? "Sincronizando..." : "Sincronizar ahora"}
            </Button>
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-5 space-y-5">
        {/* KPIs (pptx slide 2) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpiCards.map((k) => {
            const Icon = k.icon
            return (
              <Card key={k.label}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`h-3.5 w-3.5 ${k.color}`} />
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{k.label}</span>
                  </div>
                  <div className={`text-2xl font-bold ${k.color}`}>
                    {kpisLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : k.value}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Filtro de rango de fechas (pptx slide 2) */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Desde</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Hasta</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <Button variant="outline" size="icon" onClick={fetchKpis} disabled={kpisLoading}>
            <RefreshCw className={`h-4 w-4 ${kpisLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Lista de encuestas — SOLO las asignadas a este encuestador por zona */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Mis Encuestas</h2>
          {surveysLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : surveys.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <MapPin className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">No tienes encuestas asignadas todavía.</p>
                <p className="text-xs text-muted-foreground mt-1">Cuando un administrador te asigne una encuesta a tu zona, aparecerá aquí.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {surveys.map((s) => {
                // Fix 2026-07-29: bloqueo por zona, espejo de la APK
                // (src/screens/SurveyListScreen.tsx::SurveyCard.handlePress
                // en datapk). Una encuesta "general" (isGeneral) siempre se
                // puede abrir. Si no lo es, el encuestador debe estar
                // dentro de alguna de sus zonas asignadas (zoneIds) según
                // la última ubicación reportada (currentZoneId) — si aún no
                // se detecta ubicación, currentZoneId es null y también se
                // bloquea, igual que la APK exige seleccionar zona primero.
                const requiresZone = !s.isGeneral
                const inRequiredZone =
                  !requiresZone ||
                  (!!recording.locationStatus.currentZoneId && s.zoneIds.includes(recording.locationStatus.currentZoneId))

                const handleOpen = () => {
                  if (recording.status !== "recording-shift" && recording.status !== "recording-survey") return
                  if (!inRequiredZone) {
                    window.alert(
                      recording.locationStatus.currentZoneId
                        ? `Debes estar dentro de «${s.zoneName}» para acceder a esta encuesta. Tu ubicación actual no corresponde a esa zona.`
                        : `Debes estar dentro de «${s.zoneName}» para acceder a esta encuesta. Aún no se ha detectado tu ubicación — espera a que el mapa confirme tu posición.`
                    )
                    return
                  }
                  router.push(`/portal-encuestador/encuesta/${s.surveyId}`)
                }

                const disabled = recording.status === "denied"

                return (
                  <button
                    key={s.surveyId}
                    type="button"
                    onClick={handleOpen}
                    disabled={disabled}
                    className={`w-full text-left ${disabled ? "pointer-events-none opacity-60" : ""}`}
                  >
                    <Card className={`hover:border-primary/40 transition-colors ${!inRequiredZone ? "opacity-70" : ""}`}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{s.title}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className={`h-3 w-3 ${requiresZone && !inRequiredZone ? "text-amber-600" : ""}`} />
                              {s.zoneName}
                              {requiresZone && !inRequiredZone && " · Fuera de zona"}
                            </span>
                            {s.deadline && (
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(s.deadline).toLocaleDateString("es-CO")}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </CardContent>
                    </Card>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RecordingBadge({ status }: { status: string }) {
  if (status === "recording-shift") {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        Grabando turno
      </Badge>
    )
  }
  if (status === "recording-survey") {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        Grabando encuesta
      </Badge>
    )
  }
  if (status === "requesting-permission") {
    return <Badge variant="outline" className="gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Solicitando micrófono</Badge>
  }
  if (status === "denied" || status === "error") {
    return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 gap-1.5"><MicOff className="h-3 w-3" /> Sin grabación</Badge>
  }
  return null
}
