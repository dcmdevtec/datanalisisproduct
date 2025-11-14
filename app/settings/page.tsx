"use client"

import { Textarea } from "@/components/ui/textarea"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const isMounted = useRef(true)

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  const handleSave = () => {
    setLoading(true)
    const timer = setTimeout(() => {
      if (isMounted.current) {
        setLoading(false)
        toast({
          title: "Configuración guardada",
          description: "Los cambios han sido guardados correctamente.",
        })
      }
    }, 1000)

    return () => clearTimeout(timer)
  }

  if (authLoading || !user) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }



  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Configuración</h1>
          <p className="text-muted-foreground">Administra la configuración de la plataforma</p>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="appearance">Apariencia</TabsTrigger>
            <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
            <TabsTrigger value="security">Seguridad</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información de la Plataforma</CardTitle>
                <CardDescription>Configura la información básica de la plataforma</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="platform-name">Nombre de la Plataforma</Label>
                  <Input id="platform-name" defaultValue="SurveyPro" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Correo de Contacto</Label>
                  <Input id="contact-email" type="email" defaultValue="soporte@surveypro.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Zona Horaria</Label>
                  <Select defaultValue="America/Mexico_City">
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder="Selecciona una zona horaria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Mexico_City">Ciudad de México (GMT-6)</SelectItem>
                      <SelectItem value="America/Bogota">Bogotá (GMT-5)</SelectItem>
                      <SelectItem value="America/Santiago">Santiago (GMT-4)</SelectItem>
                      <SelectItem value="America/Buenos_Aires">Buenos Aires (GMT-3)</SelectItem>
                      <SelectItem value="Europe/Madrid">Madrid (GMT+1)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Idioma Predeterminado</Label>
                  <Select defaultValue="es">
                    <SelectTrigger id="language">
                      <SelectValue placeholder="Selecciona un idioma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">Inglés</SelectItem>
                      <SelectItem value="pt">Portugués</SelectItem>
                      <SelectItem value="fr">Francés</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configuración de Encuestas</CardTitle>
                <CardDescription>Configura los ajustes predeterminados para las encuestas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="offline-mode">Modo Offline Predeterminado</Label>
                    <p className="text-sm text-muted-foreground">
                      Habilitar el modo offline para todas las encuestas por defecto
                    </p>
                  </div>
                  <Switch id="offline-mode" defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="geolocation">Geolocalización Predeterminada</Label>
                    <p className="text-sm text-muted-foreground">
                      Recopilar datos de ubicación para todas las encuestas por defecto
                    </p>
                  </div>
                  <Switch id="geolocation" defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="audio-recording">Grabación de Audio Predeterminada</Label>
                    <p className="text-sm text-muted-foreground">
                      Permitir grabación de audio para todas las encuestas por defecto
                    </p>
                  </div>
                  <Switch id="audio-recording" />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="default-expiry">Tiempo de Expiración Predeterminado</Label>
                  <Select defaultValue="30">
                    <SelectTrigger id="default-expiry">
                      <SelectValue placeholder="Selecciona un período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 días</SelectItem>
                      <SelectItem value="14">14 días</SelectItem>
                      <SelectItem value="30">30 días</SelectItem>
                      <SelectItem value="60">60 días</SelectItem>
                      <SelectItem value="90">90 días</SelectItem>
                      <SelectItem value="never">Sin expiración</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Personalización</CardTitle>
                <CardDescription>Personaliza la apariencia de la plataforma</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="logo">Logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-md border flex items-center justify-center">
                      <span className="text-muted-foreground">Logo</span>
                    </div>
                    <Button variant="outline" size="sm">
                      Cambiar Logo
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primary-color">Color Primario</Label>
                  <div className="flex gap-2">
                    <Input id="primary-color" type="color" defaultValue="#3b82f6" className="w-12 h-10 p-1" />
                    <Input defaultValue="#3b82f6" className="flex-1" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondary-color">Color Secundario</Label>
                  <div className="flex gap-2">
                    <Input id="secondary-color" type="color" defaultValue="#10b981" className="w-12 h-10 p-1" />
                    <Input defaultValue="#10b981" className="flex-1" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="dark-mode">Modo Oscuro</Label>
                    <p className="text-sm text-muted-foreground">Habilitar modo oscuro por defecto</p>
                  </div>
                  <Switch id="dark-mode" />
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Notificaciones</CardTitle>
                <CardDescription>Administra las notificaciones del sistema</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-notifications">Notificaciones por Email</Label>
                    <p className="text-sm text-muted-foreground">Enviar notificaciones por correo electrónico</p>
                  </div>
                  <Switch id="email-notifications" defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="push-notifications">Notificaciones Push</Label>
                    <p className="text-sm text-muted-foreground">Enviar notificaciones push a dispositivos móviles</p>
                  </div>
                  <Switch id="push-notifications" defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="sms-notifications">Notificaciones SMS</Label>
                    <p className="text-sm text-muted-foreground">Enviar notificaciones por SMS</p>
                  </div>
                  <Switch id="sms-notifications" />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Eventos de Notificación</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch id="notify-new-response" defaultChecked />
                      <Label htmlFor="notify-new-response">Nuevas respuestas de encuesta</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="notify-survey-completion" defaultChecked />
                      <Label htmlFor="notify-survey-completion">Encuesta completada</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="notify-user-registration" defaultChecked />
                      <Label htmlFor="notify-user-registration">Registro de nuevo usuario</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="notify-system-updates" />
                      <Label htmlFor="notify-system-updates">Actualizaciones del sistema</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Seguridad</CardTitle>
                <CardDescription>Administra la seguridad de la plataforma</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password-policy">Política de Contraseñas</Label>
                  <Select defaultValue="strong">
                    <SelectTrigger id="password-policy">
                      <SelectValue placeholder="Selecciona una política" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Básica (mínimo 8 caracteres)</SelectItem>
                      <SelectItem value="medium">Media (mínimo 8 caracteres, incluir números)</SelectItem>
                      <SelectItem value="strong">Fuerte (mínimo 10 caracteres, incluir números y símbolos)</SelectItem>
                      <SelectItem value="very-strong">
                        Muy fuerte (mínimo 12 caracteres, incluir mayúsculas, números y símbolos)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session-timeout">Tiempo de Expiración de Sesión</Label>
                  <Select defaultValue="60">
                    <SelectTrigger id="session-timeout">
                      <SelectValue placeholder="Selecciona un tiempo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutos</SelectItem>
                      <SelectItem value="30">30 minutos</SelectItem>
                      <SelectItem value="60">1 hora</SelectItem>
                      <SelectItem value="120">2 horas</SelectItem>
                      <SelectItem value="240">4 horas</SelectItem>
                      <SelectItem value="480">8 horas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="two-factor">Autenticación de Dos Factores</Label>
                    <p className="text-sm text-muted-foreground">Requerir 2FA para todos los usuarios</p>
                  </div>
                  <Switch id="two-factor" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="ip-restriction">Restricción de IP</Label>
                    <p className="text-sm text-muted-foreground">Limitar acceso a IPs específicas</p>
                  </div>
                  <Switch id="ip-restriction" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="allowed-ips">IPs Permitidas</Label>
                  <Textarea
                    id="allowed-ips"
                    placeholder="Ingresa las IPs permitidas, una por línea"
                    className="h-20"
                    disabled
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="api" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de API</CardTitle>
                <CardDescription>Administra las claves y permisos de la API</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="api-key">Clave de API</Label>
                  <div className="flex gap-2">
                    <Input id="api-key" value="sk_live_51NxXxXxXxXxXxXxXxXxXxXxXx" readOnly className="font-mono" />
                    <Button variant="outline" size="sm">
                      Regenerar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Esta clave te permite acceder a la API. Mantenla segura y no la compartas.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">URL de Webhook</Label>
                  <Input id="webhook-url" placeholder="https://tu-dominio.com/webhook" />
                </div>
                <div className="space-y-2">
                  <Label>Permisos de API</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch id="api-read" defaultChecked />
                      <Label htmlFor="api-read">Lectura</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="api-write" defaultChecked />
                      <Label htmlFor="api-write">Escritura</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="api-delete" />
                      <Label htmlFor="api-delete">Eliminación</Label>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate-limit">Límite de Tasa</Label>
                  <Select defaultValue="1000">
                    <SelectTrigger id="rate-limit">
                      <SelectValue placeholder="Selecciona un límite" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">100 solicitudes por minuto</SelectItem>
                      <SelectItem value="500">500 solicitudes por minuto</SelectItem>
                      <SelectItem value="1000">1,000 solicitudes por minuto</SelectItem>
                      <SelectItem value="5000">5,000 solicitudes por minuto</SelectItem>
                      <SelectItem value="unlimited">Sin límite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
