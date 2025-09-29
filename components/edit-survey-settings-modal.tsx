"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import ColorInput from "./mantine-color-input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Palette, Share2, Database, Shield, Bell, Building2, MapPin, Mic, Clock, Settings } from "lucide-react"

interface SurveySettings {
  collectLocation: boolean
  allowAudio: boolean
  offlineMode: boolean
  distributionMethods: string[]
  theme?: {
    primaryColor: string
    backgroundColor: string
    textColor: string
  }
  branding?: {
    showLogo: boolean
    logoPosition: string
    logo?: string
  }
  security?: {
    passwordProtected: boolean
    password?: string
    preventMultipleSubmissions: boolean
  }
  notifications?: {
    emailOnSubmission: boolean
  }
  assignedUsers?: string[]
  assignedZones?: string[]
}

interface EditSurveySettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentSettings: SurveySettings
  onSave: (newSettings: SurveySettings) => void
}

export function EditSurveySettingsModal({ isOpen, onClose, currentSettings, onSave }: EditSurveySettingsModalProps) {
  // Ensure distributionMethods is always an array
  const getSafeSettings = (settings: SurveySettings): SurveySettings => ({
    ...settings,
    distributionMethods: Array.isArray(settings?.distributionMethods) ? settings.distributionMethods : [],
  })

  const [editedSettings, setEditedSettings] = useState<SurveySettings>(getSafeSettings(currentSettings))
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setEditedSettings(getSafeSettings(currentSettings))
    }
  }, [isOpen, currentSettings])

  const handleThemeChange = (field: string, value: string) => {
    setEditedSettings((prev) => ({
      ...prev,
      theme: {
        primaryColor: "#18b0a4",
        backgroundColor: "#ffffff", 
        textColor: "#1f2937",
        ...prev.theme,
        [field]: value,
      },
    }))
  }

  const handleBrandingChange = (field: string, value: any) => {
    setEditedSettings((prev) => ({
      ...prev,
      branding: {
        showLogo: false,
        logoPosition: "top",
        ...prev.branding,
        [field]: value,
      },
    }))
  }

  const handleSecurityChange = (field: string, value: any) => {
    setEditedSettings((prev) => ({
      ...prev,
      security: {
        passwordProtected: false,
        password: "",
        preventMultipleSubmissions: false,
        ...prev.security,
        [field]: value,
      },
    }))
  }

  const handleNotificationsChange = (field: string, value: any) => {
    setEditedSettings((prev) => ({
      ...prev,
      notifications: {
        emailOnSubmission: false,
        ...prev.notifications,
        [field]: value,
      },
    }))
  }

  const handleDistributionMethodChange = (method: string, checked: boolean) => {
    setEditedSettings((prev) => {
      const updatedMethods = checked
        ? [...(prev.distributionMethods || []), method]
        : (prev.distributionMethods || []).filter((m) => m !== method)
      return {
        ...prev,
        distributionMethods: updatedMethods,
      }
    })
  }

  const handleSubmit = () => {
    setIsSaving(true)
    onSave(editedSettings)
    setIsSaving(false)
    onClose()
  }

  // Temas predefinidos
  const predefinedThemes = [
    { name: "Verde Pastel", primary: "#10b981", background: "#f0fdf4", text: "#064e3b" },
    { name: "Azul Profesional", primary: "#3b82f6", background: "#eff6ff", text: "#1e3a8a" },
    { name: "Púrpura Moderno", primary: "#8b5cf6", background: "#faf5ff", text: "#5b21b6" },
    { name: "Naranja Energético", primary: "#f97316", background: "#fff7ed", text: "#9a3412" },
    { name: "Rosa Suave", primary: "#ec4899", background: "#fdf2f8", text: "#be185d" },
  ]

  const applyPredefinedTheme = (theme: typeof predefinedThemes[0]) => {
    handleThemeChange("primaryColor", theme.primary)
    handleThemeChange("backgroundColor", theme.background)
    handleThemeChange("textColor", theme.text)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Settings className="h-6 w-6 text-teal-600" />
            Editar Configuración de la Encuesta
          </DialogTitle>
          <DialogDescription className="text-base">
            Ajusta las opciones de distribución, recolección de datos, tema y seguridad de tu encuesta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-4">
          {/* Distribución */}
          <Card className="border-2 border-blue-200 bg-gradient-to-br from-white via-blue-50/50 to-indigo-100/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <Share2 className="h-5 w-5 text-blue-600" />
                Distribución
              </CardTitle>
              <CardDescription className="text-blue-700">
                Configura cómo se puede compartir y acceder a tu encuesta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-blue-700">Métodos Principales</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <span className="font-medium text-blue-800">Enlace público</span>
                      <Badge variant="default" className="bg-blue-500">Activo</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <span className="font-medium text-blue-800">Email</span>
                      <Badge variant="default" className="bg-blue-500">Activo</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-blue-700">Métodos Adicionales</h4>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-blue-200">
                      <Checkbox
                        id="qr_code"
                        checked={editedSettings.distributionMethods.includes("qr_code")}
                        onCheckedChange={(checked) => handleDistributionMethodChange("qr_code", !!checked)}
                        className="data-[state=checked]:bg-blue-500"
                      />
                      <Label htmlFor="qr_code" className="font-medium text-blue-800">Código QR</Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-blue-200">
                      <Checkbox
                        id="whatsapp"
                        checked={editedSettings.distributionMethods?.includes("whatsapp")}
                        onCheckedChange={(checked) => handleDistributionMethodChange("whatsapp", !!checked)}
                        className="data-[state=checked]:bg-blue-500"
                      />
                      <Label htmlFor="whatsapp" className="font-medium text-blue-800">WhatsApp</Label>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recolección de Datos */}
          <Card className="border-2 border-green-200 bg-gradient-to-br from-white via-green-50/50 to-emerald-100/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <Database className="h-5 w-5 text-green-600" />
                Recolección de Datos
              </CardTitle>
              <CardDescription className="text-green-700">
                Configura cómo se recopilan y procesan los datos de la encuesta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">Modo offline</span>
                    </div>
                    <Switch
                      checked={editedSettings.offlineMode}
                      onCheckedChange={(checked) => setEditedSettings(prev => ({ ...prev, offlineMode: checked }))}
                      className="data-[state=checked]:bg-green-500"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">Geolocalización</span>
                    </div>
                    <Switch
                      checked={editedSettings.collectLocation}
                      onCheckedChange={(checked) => setEditedSettings(prev => ({ ...prev, collectLocation: checked }))}
                      className="data-[state=checked]:bg-green-500"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-3">
                      <Mic className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">Grabación de audio</span>
                    </div>
                    <Switch
                      checked={editedSettings.allowAudio}
                      onCheckedChange={(checked) => setEditedSettings(prev => ({ ...prev, allowAudio: checked }))}
                      className="data-[state=checked]:bg-green-500"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">Tiempo de encuesta</span>
                    </div>
                    <Badge variant="outline" className="text-green-700 border-green-300">No editable aquí</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tema y Colores */}
          <Card className="border-2 border-purple-200 bg-gradient-to-br from-white via-purple-50/50 to-violet-100/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-800">
                <Palette className="h-5 w-5 text-purple-600" />
                Tema y Colores
              </CardTitle>
              <CardDescription className="text-purple-700">
                Personaliza la apariencia visual de tu encuesta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Previsualización del Tema */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-purple-700">Previsualización del Tema</h4>
                <div className="p-4 bg-white rounded-lg border-2 border-purple-200 shadow-lg">
                  <div className="space-y-3">
                    <Button 
                      className="w-full"
                      style={{ backgroundColor: editedSettings.theme?.primaryColor || "#18b0a4" }}
                    >
                      Título
                    </Button>
                    <p 
                      className="text-center"
                      style={{ color: editedSettings.theme?.textColor || "#1f2937" }}
                    >
                      Texto de ejemplo
                    </p>
                  </div>
                  <div className="mt-4 text-sm text-purple-700 space-y-1">
                    <p>• Color primario: {editedSettings.theme?.primaryColor || "#18b0a4"}</p>
                    <p>• Color de fondo: {editedSettings.theme?.backgroundColor || "#ffffff"}</p>
                    <p>• Color de texto: {editedSettings.theme?.textColor || "#1f2937"}</p>
                  </div>
                </div>
              </div>

              {/* Selectores de Color */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-purple-800">Color Primario</Label>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded border-2 border-purple-200"
                      style={{ backgroundColor: editedSettings.theme?.primaryColor || "#18b0a4" }}
                    />
                    <div className="flex-1">
                      <ColorInput
                        value={editedSettings.theme?.primaryColor || "#18b0a4"}
                        onChange={(color: string) => handleThemeChange("primaryColor", color)}
                        format="hex"
                        swatches={["#10b981", "#3b82f6", "#8b5cf6", "#f97316", "#ec4899", "#18b0a4", "#ffffff", "#1f2937"]}
                        withPicker
                        size="md"
                        styles={{ input: { width: '100%' } }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-purple-600">Color principal para botones y elementos destacados</p>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-purple-800">Color de Fondo</Label>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded border-2 border-purple-200"
                      style={{ backgroundColor: editedSettings.theme?.backgroundColor || "#ffffff" }}
                    />
                    <div className="flex-1">
                      <ColorInput
                        value={editedSettings.theme?.backgroundColor || "#ffffff"}
                        onChange={(color: string) => handleThemeChange("backgroundColor", color)}
                        format="hex"
                        swatches={["#ffffff", "#f0fdf4", "#eff6ff", "#faf5ff", "#fff7ed", "#fdf2f8", "#f0fdf4", "#f9fafb"]}
                        withPicker
                        size="md"
                        styles={{ input: { width: '100%' } }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-purple-600">Color de fondo principal de la encuesta</p>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-purple-800">Color de Texto</Label>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded border-2 border-purple-200"
                      style={{ backgroundColor: editedSettings.theme?.textColor || "#1f2937" }}
                    />
                    <div className="flex-1">
                      <ColorInput
                        value={editedSettings.theme?.textColor || "#1f2937"}
                        onChange={(color: string) => handleThemeChange("textColor", color)}
                        format="hex"
                        swatches={["#1f2937", "#064e3b", "#1e3a8a", "#5b21b6", "#9a3412", "#be185d", "#374151", "#000000"]}
                        withPicker
                        size="md"
                        styles={{ input: { width: '100%' } }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-purple-600">Color del texto principal</p>
                </div>
              </div>

              {/* Temas Predefinidos */}
              <div className="space-y-3">
                <h4 className="text-lg font-semibold text-purple-700">Temas Predefinidos</h4>
                <div className="flex flex-wrap gap-3">
                  {predefinedThemes.map((theme, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => applyPredefinedTheme(theme)}
                      className="border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-400"
                    >
                      {theme.name}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Marca */}
          <Card className="border-2 border-orange-200 bg-gradient-to-br from-white via-orange-50/50 to-amber-100/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <Building2 className="h-5 w-5 text-orange-600" />
                Marca
              </CardTitle>
              <CardDescription className="text-orange-700">
                Personaliza la identidad visual de tu encuesta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <Checkbox
                      id="showLogo"
                      checked={editedSettings.branding?.showLogo}
                      onCheckedChange={(checked) => handleBrandingChange("showLogo", checked)}
                      className="data-[state=checked]:bg-orange-500"
                    />
                    <Label htmlFor="showLogo" className="font-medium text-orange-800">Mostrar logo</Label>
                  </div>
                  
                  {editedSettings.branding?.showLogo && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-orange-800">Posición del logo</Label>
                      <Select
                        value={editedSettings.branding?.logoPosition || "top"}
                        onValueChange={(value) => handleBrandingChange("logoPosition", value)}
                      >
                        <SelectTrigger className="bg-white border-orange-300 focus:border-orange-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top">Arriba</SelectItem>
                          <SelectItem value="center">Centro</SelectItem>
                          <SelectItem value="bottom">Abajo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <Label className="text-sm font-medium text-orange-800">URL del Logo</Label>
                  <Input
                    value={editedSettings.branding?.logo || ""}
                    onChange={(e) => handleBrandingChange("logo", e.target.value)}
                    placeholder="https://ejemplo.com/logo.png"
                    className="bg-white border-orange-300 focus:border-orange-500"
                  />
                  <p className="text-xs text-orange-600">Ingresa la URL de tu logo</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seguridad */}
          <Card className="border-2 border-red-200 bg-gradient-to-br from-white via-red-50/50 to-rose-100/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-800">
                <Shield className="h-5 w-5 text-red-600" />
                Seguridad
              </CardTitle>
              <CardDescription className="text-red-700">
                Configura las opciones de seguridad y privacidad
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 p-3 bg-red-50 rounded-lg border border-red-200">
                    <Checkbox
                      id="passwordProtected"
                      checked={editedSettings.security?.passwordProtected}
                      onCheckedChange={(checked) => handleSecurityChange("passwordProtected", checked)}
                      className="data-[state=checked]:bg-red-500"
                    />
                    <Label htmlFor="passwordProtected" className="font-medium text-red-800">Protegida con contraseña</Label>
                  </div>
                  
                  {editedSettings.security?.passwordProtected && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-red-800">Contraseña</Label>
                      <Input
                        type="password"
                        value={editedSettings.security?.password || ""}
                        onChange={(e) => handleSecurityChange("password", e.target.value)}
                        placeholder="Ingresa la contraseña"
                        className="bg-white border-red-300 focus:border-red-500"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-3 p-3 bg-red-50 rounded-lg border border-red-200">
                    <Checkbox
                      id="preventMultipleSubmissions"
                      checked={editedSettings.security?.preventMultipleSubmissions}
                      onCheckedChange={(checked) => handleSecurityChange("preventMultipleSubmissions", checked)}
                      className="data-[state=checked]:bg-red-500"
                    />
                    <Label htmlFor="preventMultipleSubmissions" className="font-medium text-red-800">Prevenir múltiples envíos</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notificaciones */}
          <Card className="border-2 border-cyan-200 bg-gradient-to-br from-white via-cyan-50/50 to-sky-100/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-cyan-800">
                <Bell className="h-5 w-5 text-cyan-600" />
                Notificaciones
              </CardTitle>
              <CardDescription className="text-cyan-700">
                Configura las notificaciones automáticas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-3 p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                <Checkbox
                  id="emailOnSubmission"
                  checked={editedSettings.notifications?.emailOnSubmission}
                  onCheckedChange={(checked) => handleNotificationsChange("emailOnSubmission", checked)}
                  className="data-[state=checked]:bg-cyan-500"
                />
                <Label htmlFor="emailOnSubmission" className="font-medium text-cyan-800">
                  Enviar email al completar la encuesta
                </Label>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex-shrink-0 pt-6 border-t">
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 sm:flex-none"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex-1 sm:flex-none bg-teal-600 hover:bg-teal-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Guardando...
                </>
              ) : (
                <>
                  <Settings className="h-4 w-4 mr-2" />
                  Guardar Configuración
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
