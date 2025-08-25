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
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

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
  const [editedSettings, setEditedSettings] = useState<SurveySettings>(currentSettings)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setEditedSettings(currentSettings)
    }
  }, [isOpen, currentSettings])

  const handleSettingChange = (field: keyof SurveySettings, value: any) => {
    setEditedSettings((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleThemeChange = (field: keyof NonNullable<SurveySettings["theme"]>, value: string) => {
    setEditedSettings((prev) => ({
      ...prev,
      theme: {
        ...prev.theme,
        [field]: value,
      },
    }))
  }

  const handleBrandingChange = (field: keyof NonNullable<SurveySettings["branding"]>, value: any) => {
    setEditedSettings((prev) => ({
      ...prev,
      branding: {
        ...prev.branding,
        [field]: value,
      },
    }))
  }

  const handleSecurityChange = (field: keyof NonNullable<SurveySettings["security"]>, value: any) => {
    setEditedSettings((prev) => ({
      ...prev,
      security: {
        ...prev.security,
        [field]: value,
      },
    }))
  }

  const handleNotificationsChange = (field: keyof NonNullable<SurveySettings["notifications"]>, value: any) => {
    setEditedSettings((prev) => ({
      ...prev,
      notifications: {
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Configuración de la Encuesta</DialogTitle>
          <DialogDescription>
            Ajusta las opciones de distribución, recolección de datos, tema y seguridad de tu encuesta.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {/* Distribución */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Distribución</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="public-link">Enlace público</Label>
                <Checkbox
                  id="public-link"
                  checked={editedSettings.distributionMethods?.includes("public_link")}
                  onCheckedChange={(checked) => handleDistributionMethodChange("public_link", checked as boolean)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="qr-code">Código QR</Label>
                <Checkbox
                  id="qr-code"
                  checked={editedSettings.distributionMethods?.includes("qr_code")}
                  onCheckedChange={(checked) => handleDistributionMethodChange("qr_code", checked as boolean)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="email">Email</Label>
                <Checkbox
                  id="email"
                  checked={editedSettings.distributionMethods?.includes("email")}
                  onCheckedChange={(checked) => handleDistributionMethodChange("email", checked as boolean)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Checkbox
                  id="whatsapp"
                  checked={editedSettings.distributionMethods?.includes("whatsapp")}
                  onCheckedChange={(checked) => handleDistributionMethodChange("whatsapp", checked as boolean)}
                />
              </div>
            </div>
          </div>

          {/* Recolección de Datos */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Recolección de Datos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="offline-mode">Modo offline</Label>
                <Switch
                  id="offline-mode"
                  checked={editedSettings.offlineMode}
                  onCheckedChange={(checked) => handleSettingChange("offlineMode", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="collect-location">Geolocalización</Label>
                <Switch
                  id="collect-location"
                  checked={editedSettings.collectLocation}
                  onCheckedChange={(checked) => handleSettingChange("collectLocation", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="allow-audio">Grabación de audio</Label>
                <Switch
                  id="allow-audio"
                  checked={editedSettings.allowAudio}
                  onCheckedChange={(checked) => handleSettingChange("allowAudio", checked)}
                />
              </div>
              {/* Assuming "Tiempo de encuesta" is a display-only setting or requires more complex input not covered by simple switch */}
              <div className="flex items-center justify-between">
                <Label htmlFor="survey-time">Tiempo de encuesta</Label>
                {/* Placeholder for survey time setting, if it's editable */}
                <span className="text-sm text-muted-foreground">No editable aquí</span>
              </div>
            </div>
          </div>

          {/* Tema (Theme) */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Tema</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary-color">Color Primario</Label>
                <Input
                  id="primary-color"
                  type="color"
                  value={editedSettings.theme?.primaryColor || "#18b0a4"}
                  onChange={(e) => handleThemeChange("primaryColor", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="background-color">Color de Fondo</Label>
                <Input
                  id="background-color"
                  type="color"
                  value={editedSettings.theme?.backgroundColor || "#ffffff"}
                  onChange={(e) => handleThemeChange("backgroundColor", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="text-color">Color de Texto</Label>
                <Input
                  id="text-color"
                  type="color"
                  value={editedSettings.theme?.textColor || "#1f2937"}
                  onChange={(e) => handleThemeChange("textColor", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Branding */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Marca (Branding)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-logo">Mostrar Logo</Label>
                <Switch
                  id="show-logo"
                  checked={editedSettings.branding?.showLogo}
                  onCheckedChange={(checked) => handleBrandingChange("showLogo", checked)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo-position">Posición del Logo</Label>
                <Select
                  value={editedSettings.branding?.logoPosition || "top"}
                  onValueChange={(value) => handleBrandingChange("logoPosition", value)}
                >
                  <SelectTrigger id="logo-position">
                    <SelectValue placeholder="Seleccionar posición" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">Superior</SelectItem>
                    <SelectItem value="bottom">Inferior</SelectItem>
                    <SelectItem value="left">Izquierda</SelectItem>
                    <SelectItem value="right">Derecha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Seguridad */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Seguridad</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="password-protected">Protegida con Contraseña</Label>
                <Switch
                  id="password-protected"
                  checked={editedSettings.security?.passwordProtected}
                  onCheckedChange={(checked) => handleSecurityChange("passwordProtected", checked)}
                />
              </div>
              {editedSettings.security?.passwordProtected && (
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={editedSettings.security?.password || ""}
                    onChange={(e) => handleSecurityChange("password", e.target.value)}
                    placeholder="Introduce una contraseña"
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label htmlFor="prevent-multiple-submissions">Prevenir Múltiples Envíos</Label>
                <Switch
                  id="prevent-multiple-submissions"
                  checked={editedSettings.security?.preventMultipleSubmissions}
                  onCheckedChange={(checked) => handleSecurityChange("preventMultipleSubmissions", checked)}
                />
              </div>
            </div>
          </div>

          {/* Notificaciones */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Notificaciones</h3>
            <div className="flex items-center justify-between">
              <Label htmlFor="email-on-submission">Email al Enviar</Label>
              <Switch
                id="email-on-submission"
                checked={editedSettings.notifications?.emailOnSubmission}
                onCheckedChange={(checked) => handleNotificationsChange("emailOnSubmission", checked)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
              </>
            ) : (
              "Guardar Cambios"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
