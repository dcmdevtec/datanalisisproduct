"use client"

import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, Users, FileText, MapPin } from "lucide-react"

export default function PaginaDashboard() {
  const { user, loading } = useAuth()

  // Solo mostrar loading si está cargando
  if (loading) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }

  // Si no hay usuario, el middleware se encargará de la redirección
  // No necesitamos manejar redirecciones aquí
  if (!user) {
    return <div className="flex h-screen items-center justify-center">Redirigiendo...</div>
  }

  // Obtener el rol correctamente
  const userRole = user.user_metadata?.role || user.app_metadata?.role
  
  // Solo mostrar información de debug en desarrollo
  if (process.env.NODE_ENV === 'development') {
    console.log('👤 Usuario en dashboard:', {
      email: user.email,
      role: userRole,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata
    })
  }

  // Verificar permisos para esta página específica
  // Si el usuario no tiene permisos, mostrar un mensaje
  if (userRole && !["admin", "supervisor"].includes(userRole)) {
    return (
      <DashboardLayout>
        <div className="flex h-screen items-center justify-center flex-col gap-4">
          <h2 className="text-2xl font-bold">Acceso Restringido</h2>
          <p className="text-muted-foreground">No tienes permisos para acceder al dashboard administrativo.</p>
          <p className="text-sm text-muted-foreground">Serás redirigido automáticamente...</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold">Panel de Control</h1>
          {process.env.NODE_ENV === 'development' && (
            <div className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded">
              Rol: {userRole || 'Sin rol'}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Encuestas Totales</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">24</div>
              <p className="text-xs text-muted-foreground">+10% respecto al mes pasado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Encuestadores Activos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">+2 nuevos esta semana</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Respuestas</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,234</div>
              <p className="text-xs text-muted-foreground">+24% respecto a la semana pasada</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Zonas Activas</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8</div>
              <p className="text-xs text-muted-foreground">+1 nueva zona esta semana</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Actividad Reciente</CardTitle>
              <CardDescription>Últimas acciones en la plataforma</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { user: "María López", action: "Completó encuesta en Zona A", time: "Hace 10 minutos" },
                  { user: "Juan Pérez", action: "Inició nueva encuesta", time: "Hace 25 minutos" },
                  { user: "Usuario Admin", action: "Creó nueva plantilla de encuesta", time: "Hace 1 hora" },
                  { user: "Sara Gómez", action: "Exportó resultados a Excel", time: "Hace 2 horas" },
                  { user: "Carlos Rodríguez", action: "Asignado a nueva zona", time: "Hace 3 horas" },
                ].map((actividad, i) => (
                  <div key={i} className="flex items-start gap-4 pb-4 border-b last:border-0">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Users className="h-4 w-4 " />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{actividad.user}</p>
                      <p className="text-sm text-muted-foreground">{actividad.action}</p>
                      <p className="text-xs text-muted-foreground">{actividad.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tasa de Finalización de Encuestas</CardTitle>
              <CardDescription>Desempeño por zona</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { zone: "Zona A", completion: 85 },
                  { zone: "Zona B", completion: 72 },
                  { zone: "Zona C", completion: 64 },
                  { zone: "Zona D", completion: 92 },
                  { zone: "Zona E", completion: 45 },
                ].map((zona, i) => (
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
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}