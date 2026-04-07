"use client"

import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, Users, FileText, MapPin, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

interface DashboardData {
  kpis: {
    totalSurveys: number
    surveyGrowth: number
    activeSurveyors: number
    newSurveyorsThisWeek: number
    totalResponses: number
    responseGrowth: number
    activeZones: number
    newZonesThisWeek: number
  }
  recentActivity: { user: string; action: string; time: string }[]
  zoneCompletionRates: { zone: string; completion: number; total: number; completed: number }[]
}

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "Justo ahora"
  if (minutes < 60) return `Hace ${minutes} minuto${minutes !== 1 ? "s" : ""}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} hora${hours !== 1 ? "s" : ""}`
  const days = Math.floor(hours / 24)
  return `Hace ${days} día${days !== 1 ? "s" : ""}`
}

function formatGrowth(value: number, label: string): string {
  if (value === 0) return `Sin cambios ${label}`
  const sign = value > 0 ? "+" : ""
  return `${sign}${value}% ${label}`
}

export default function PaginaDashboard() {
  const { user, loading } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    fetch("/api/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed")
        return res.json()
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch(() => {
        if (!cancelled) setFetchError(true)
      })

    return () => { cancelled = true }
  }, [user])

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }

  if (!user) {
    return null
  }

  const userRole = user.user_metadata?.role || user.app_metadata?.role

  const kpis = data?.kpis
  const isLoading = !data && !fetchError

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold">Panel de Control</h1>
          <div className="flex items-center gap-2">
            {process.env.NODE_ENV === 'development' && (
              <div className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded">
                Rol: {userRole || 'Sin rol'}
              </div>
            )}
            <div className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded">
              Usuario: {user?.email}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Encuestas Totales</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{kpis?.totalSurveys.toLocaleString() ?? "—"}</div>
                  <p className="text-xs text-muted-foreground">
                    {kpis ? formatGrowth(kpis.surveyGrowth, "respecto al mes pasado") : ""}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Encuestadores Activos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{kpis?.activeSurveyors.toLocaleString() ?? "—"}</div>
                  <p className="text-xs text-muted-foreground">
                    {kpis ? `${kpis.newSurveyorsThisWeek} encuestadores activos` : ""}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Respuestas</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{kpis?.totalResponses.toLocaleString() ?? "—"}</div>
                  <p className="text-xs text-muted-foreground">
                    {kpis ? formatGrowth(kpis.responseGrowth, "respecto a la semana pasada") : ""}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Zonas Activas</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{kpis?.activeZones.toLocaleString() ?? "—"}</div>
                  <p className="text-xs text-muted-foreground">
                    {kpis ? `${kpis.newZonesThisWeek} zonas activas` : ""}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Actividad Reciente</CardTitle>
              <CardDescription>Últimas respuestas registradas</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (data?.recentActivity?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No hay actividad reciente</p>
              ) : (
                <div className="space-y-4">
                  {data!.recentActivity.map((actividad, i) => (
                    <div key={i} className="flex items-start gap-4 pb-4 border-b last:border-0">
                      <div className="rounded-full bg-primary/10 p-2">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{actividad.user}</p>
                        <p className="text-sm text-muted-foreground">{actividad.action}</p>
                        <p className="text-xs text-muted-foreground">{formatTimeAgo(actividad.time)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tasa de Finalización de Encuestas</CardTitle>
              <CardDescription>Desempeño por zona</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (data?.zoneCompletionRates?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No hay datos de zonas disponibles</p>
              ) : (
                <div className="space-y-4">
                  {data!.zoneCompletionRates.map((zona, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{zona.zone}</p>
                        <p className="text-sm font-medium">{zona.completion}%</p>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${zona.completion}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}