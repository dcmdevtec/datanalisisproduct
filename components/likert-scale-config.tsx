"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { 
  Settings, 
  Sliders, 
  Type, 
  Palette, 
  Eye, 
  EyeOff, 
  Hash, 
  Minus, 
  Plus,
  AlertCircle,
  CheckCircle
} from "lucide-react"

interface ScaleConfig {
  min: number
  max: number
  step: number
  startPosition: 'left' | 'center' | 'right'
  labels: {
    left: string
    center?: string
    right: string
  }
  showZero: boolean
  zeroLabel: string
  showNumbers: boolean
  showLabels: boolean
  orientation: 'horizontal' | 'vertical'
  validation: {
    requireAnswer: boolean
    allowZero: boolean
    customMessage?: string
  }
  appearance: {
    size: 'small' | 'medium' | 'large'
    color: string
    showTicks: boolean
    showValue: boolean
  }
}

interface LikertScaleConfigProps {
  config: ScaleConfig
  onChange: (config: ScaleConfig) => void
}

export function LikertScaleConfig({ config, onChange }: LikertScaleConfigProps) {
  const [localConfig, setLocalConfig] = useState<ScaleConfig>(config)

  useEffect(() => {
    setLocalConfig(config)
  }, [config])

  const updateConfig = (field: string, value: any) => {
    const newConfig = { ...localConfig }
    
    // Navegar por la estructura anidada
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      if (parent === 'labels') {
        newConfig.labels = { ...newConfig.labels, [child]: value }
      } else if (parent === 'validation') {
        newConfig.validation = { ...newConfig.validation, [child]: value }
      } else if (parent === 'appearance') {
        newConfig.appearance = { ...newConfig.appearance, [child]: value }
      }
    } else {
      (newConfig as any)[field] = value
    }
    
    setLocalConfig(newConfig)
    onChange(newConfig)
  }

  // Escalas predefinidas según los requerimientos
  const predefinedScales = [
    { name: "Escala 1-5", min: 1, max: 5, description: "Escala estándar de 5 puntos" },
    { name: "Escala 1-7", min: 1, max: 7, description: "Escala de 7 puntos (Likert extendida)" },
    { name: "Escala 1-10", min: 1, max: 10, description: "Escala de 10 puntos" },
    { name: "Escala 1-100", min: 1, max: 100, description: "Escala de 100 puntos (control deslizante)" },
  ]

  const applyPredefinedScale = (scale: typeof predefinedScales[0]) => {
    updateConfig('min', scale.min)
    updateConfig('max', scale.max)
    updateConfig('step', 1) // Siempre paso 1 según requerimientos
  }

  // Validar configuración
  const isValidConfig = localConfig.min < localConfig.max && localConfig.step > 0

  return (
    <div className="space-y-6">
      {/* Configuración Básica */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-white via-blue-50/50 to-indigo-100/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Sliders className="h-5 w-5 text-blue-600" />
            Configuración Básica de la Escala
          </CardTitle>
          <CardDescription className="text-blue-700">
            Define el rango y comportamiento básico de tu escala Likert
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Escalas Predefinidas */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-blue-800">Escalas Predefinidas</Label>
            <div className="grid grid-cols-2 gap-3">
              {predefinedScales.map((scale) => (
                <Button
                  key={scale.name}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPredefinedScale(scale)}
                  className={`border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 ${
                    localConfig.min === scale.min && localConfig.max === scale.max 
                      ? 'bg-blue-100 border-blue-500' 
                      : ''
                  }`}
                >
                  <div className="text-left">
                    <div className="font-medium">{scale.name}</div>
                    <div className="text-xs text-blue-600">{scale.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Configuración Manual */}
          <div className="space-y-4">
            <Label className="text-sm font-medium text-blue-800">Configuración Manual</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Valor mínimo</Label>
                <Input
                  type="number"
                  value={localConfig.min}
                  onChange={(e) => updateConfig('min', parseInt(e.target.value))}
                  min={1}
                  className="bg-white border-blue-300 focus:border-blue-500"
                />
                <p className="text-xs text-blue-600">Siempre debe ser 1 según requerimientos</p>
              </div>
              
              <div className="space-y-2">
                <Label>Valor máximo</Label>
                <Input
                  type="number"
                  value={localConfig.max}
                  onChange={(e) => updateConfig('max', parseInt(e.target.value))}
                  min={2}
                  className="bg-white border-blue-300 focus:border-blue-500"
                />
                <p className="text-xs text-blue-600">Puede ser 5, 7, 10, 100, etc.</p>
              </div>
              
              <div className="space-y-2">
                <Label>Tamaño del paso</Label>
                <Input
                  type="number"
                  value={localConfig.step}
                  onChange={(e) => updateConfig('step', parseInt(e.target.value))}
                  min={1}
                  className="bg-white border-blue-300 focus:border-blue-500"
                />
                <p className="text-xs text-blue-600">Siempre debe ser 1 según requerimientos</p>
              </div>
            </div>
          </div>

          {/* Validación de Configuración */}
          {!isValidConfig && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-700">
                Configuración inválida: El valor mínimo debe ser menor al máximo y el paso debe ser mayor a 0
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Etiquetas Personalizables */}
      <Card className="border-2 border-green-200 bg-gradient-to-br from-white via-green-50/50 to-emerald-100/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <Type className="h-5 w-5 text-green-600" />
            Etiquetas Personalizables
          </CardTitle>
          <CardDescription className="text-green-700">
            Personaliza las etiquetas de texto para los extremos y centro de tu escala
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-green-800">Lado Izquierdo</Label>
              <Input
                value={localConfig.labels.left}
                onChange={(e) => updateConfig('labels.left', e.target.value)}
                placeholder="Ej: Muy Insatisfecho"
                className="bg-white border-green-300 focus:border-green-500"
              />
              <p className="text-xs text-green-600">Etiqueta para el valor mínimo ({localConfig.min})</p>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-green-800">Centro (Opcional)</Label>
              <Input
                value={localConfig.labels.center || ''}
                onChange={(e) => updateConfig('labels.center', e.target.value)}
                placeholder="Ingresar una etiqueta (opcional)"
                className="bg-white border-green-300 focus:border-green-500"
              />
              <p className="text-xs text-green-600">Etiqueta para el centro de la escala</p>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-green-800">Lado Derecho</Label>
              <Input
                value={localConfig.labels.right}
                onChange={(e) => updateConfig('labels.right', e.target.value)}
                placeholder="Ej: Muy Satisfecho"
                className="bg-white border-green-300 focus:border-green-500"
              />
              <p className="text-xs text-green-600">Etiqueta para el valor máximo ({localConfig.max})</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opción "0 = No Sabe / No Responde" */}
      <Card className="border-2 border-orange-200 bg-gradient-to-br from-white via-orange-50/50 to-amber-100/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <Minus className="h-5 w-5 text-orange-600" />
            Opción "No Sabe / No Responde"
          </CardTitle>
          <CardDescription className="text-orange-700">
            Incluye una opción adicional para respuestas no informativas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
            <Checkbox
              id="showZero"
              checked={localConfig.showZero}
              onCheckedChange={(checked) => updateConfig('showZero', checked)}
              className="data-[state=checked]:bg-orange-500"
            />
            <Label htmlFor="showZero" className="font-medium text-orange-800">
              Incluir opción "0 = {localConfig.zeroLabel}"
            </Label>
          </div>
          
          {localConfig.showZero && (
            <div className="space-y-3">
              <Label className="text-sm font-medium text-orange-800">Texto de la etiqueta</Label>
              <Input
                value={localConfig.zeroLabel}
                onChange={(e) => updateConfig('zeroLabel', e.target.value)}
                placeholder="No Sabe / No Responde"
                className="bg-white border-orange-300 focus:border-orange-500"
              />
              <p className="text-xs text-orange-600">
                Esta opción aparecerá como "0 = [tu texto]" en la escala
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuración de Posición y Apariencia */}
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-white via-purple-50/50 to-violet-100/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-800">
            <Palette className="h-5 w-5 text-purple-600" />
            Apariencia y Comportamiento
          </CardTitle>
          <CardDescription className="text-purple-700">
            Personaliza la apariencia visual y el comportamiento de tu escala
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium text-purple-800">Posición Inicial</Label>
                <Select
                  value={localConfig.startPosition}
                  onValueChange={(value: 'left' | 'center' | 'right') => updateConfig('startPosition', value)}
                >
                  <SelectTrigger className="bg-white border-purple-300 focus:border-purple-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Lado izquierdo</SelectItem>
                    <SelectItem value="center">Centro</SelectItem>
                    <SelectItem value="right">Lado derecho</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-purple-600">Posición inicial del control deslizante</p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium text-purple-800">Orientación</Label>
                <Select
                  value={localConfig.orientation}
                  onValueChange={(value: 'horizontal' | 'vertical') => updateConfig('orientation', value)}
                >
                  <SelectTrigger className="bg-white border-purple-300 focus:border-purple-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="horizontal">Horizontal</SelectItem>
                    <SelectItem value="vertical">Vertical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium text-purple-800">Tamaño</Label>
                <Select
                  value={localConfig.appearance.size}
                  onValueChange={(value: 'small' | 'medium' | 'large') => updateConfig('appearance.size', value)}
                >
                  <SelectTrigger className="bg-white border-purple-300 focus:border-purple-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Pequeño</SelectItem>
                    <SelectItem value="medium">Mediano</SelectItem>
                    <SelectItem value="large">Grande</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium text-purple-800">Color</Label>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded border-2 border-purple-200"
                    style={{ backgroundColor: localConfig.appearance.color }}
                  />
                  <Input
                    value={localConfig.appearance.color}
                    onChange={(e) => updateConfig('appearance.color', e.target.value)}
                    className="bg-white border-purple-300 focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Opciones de Visualización */}
          <div className="space-y-4">
            <Label className="text-sm font-medium text-purple-800">Opciones de Visualización</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="showNumbers"
                  checked={localConfig.showNumbers}
                  onCheckedChange={(checked) => updateConfig('showNumbers', checked)}
                  className="data-[state=checked]:bg-purple-500"
                />
                <Label htmlFor="showNumbers" className="text-sm">Mostrar números</Label>
              </div>
              
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="showLabels"
                  checked={localConfig.showLabels}
                  onCheckedChange={(checked) => updateConfig('showLabels', checked)}
                  className="data-[state=checked]:bg-purple-500"
                />
                <Label htmlFor="showLabels" className="text-sm">Mostrar etiquetas</Label>
              </div>
              
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="showTicks"
                  checked={localConfig.appearance.showTicks}
                  onCheckedChange={(checked) => updateConfig('appearance.showTicks', checked)}
                  className="data-[state=checked]:bg-purple-500"
                />
                <Label htmlFor="showTicks" className="text-sm">Mostrar marcas</Label>
              </div>
              
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="showValue"
                  checked={localConfig.appearance.showValue}
                  onCheckedChange={(checked) => updateConfig('appearance.showValue', checked)}
                  className="data-[state=checked]:bg-purple-500"
                />
                <Label htmlFor="showValue" className="text-sm">Mostrar valor</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validación */}
      <Card className="border-2 border-red-200 bg-gradient-to-br from-white via-red-50/50 to-rose-100/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-800">
            <CheckCircle className="h-5 w-5 text-red-600" />
            Validación y Requisitos
          </CardTitle>
          <CardDescription className="text-red-700">
            Configura las reglas de validación para tu escala
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <Checkbox
                  id="requireAnswer"
                  checked={localConfig.validation.requireAnswer}
                  onCheckedChange={(checked) => updateConfig('validation.requireAnswer', checked)}
                  className="data-[state=checked]:bg-red-500"
                />
                <Label htmlFor="requireAnswer" className="font-medium text-red-800">
                  Requerir respuesta
                </Label>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <Checkbox
                  id="allowZero"
                  checked={localConfig.validation.allowZero}
                  onCheckedChange={(checked) => updateConfig('validation.allowZero', checked)}
                  className="data-[state=checked]:bg-red-500"
                />
                <Label htmlFor="allowZero" className="font-medium text-red-800">
                  Permitir selección de cero
                </Label>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-red-800">Mensaje de error personalizado</Label>
              <Input
                value={localConfig.validation.customMessage || ''}
                onChange={(e) => updateConfig('validation.customMessage', e.target.value)}
                placeholder="Mensaje de error personalizado"
                className="bg-white border-red-300 focus:border-red-500"
              />
              <p className="text-xs text-red-600">Mensaje que se mostrará cuando la validación falle</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Previsualización */}
      <Card className="border-2 border-cyan-200 bg-gradient-to-br from-white via-cyan-50/50 to-sky-100/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-cyan-800">
            <Eye className="h-5 w-5 text-cyan-600" />
            Previsualización de la Escala
          </CardTitle>
          <CardDescription className="text-cyan-700">
            Ve cómo se verá tu escala configurada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-6 bg-white rounded-lg border-2 border-cyan-200 shadow-lg">
            <div className="space-y-4">
              {/* Control deslizante simulado */}
              <div className="px-2">
                <Slider
                  defaultValue={[Math.ceil(localConfig.max / 2)]}
                  min={localConfig.showZero ? 0 : localConfig.min}
                  max={localConfig.max}
                  step={localConfig.step}
                  disabled
                  className="w-full"
                />
              </div>
              
              {/* Etiquetas */}
              <div className="flex justify-between text-sm text-cyan-700">
                {localConfig.showZero && (
                  <div className="text-center">
                    <div className="font-bold">0</div>
                    <div className="text-xs">{localConfig.zeroLabel}</div>
                  </div>
                )}
                <div className="text-center">
                  <div className="font-bold">{localConfig.min}</div>
                  <div className="text-xs">{localConfig.labels.left}</div>
                </div>
                {localConfig.labels.center && (
                  <div className="text-center">
                    <div className="font-bold">{Math.ceil(localConfig.max / 2)}</div>
                    <div className="text-xs">{localConfig.labels.center}</div>
                  </div>
                )}
                <div className="text-center">
                  <div className="font-bold">{localConfig.max}</div>
                  <div className="text-xs">{localConfig.labels.right}</div>
                </div>
              </div>
              
              {/* Información de configuración */}
              <div className="text-xs text-cyan-600 space-y-1">
                <p>• Rango: {localConfig.min} a {localConfig.max}</p>
                <p>• Paso: {localConfig.step}</p>
                <p>• Posición inicial: {localConfig.startPosition}</p>
                <p>• Orientación: {localConfig.orientation}</p>
                {localConfig.showZero && <p>• Incluye opción cero: {localConfig.zeroLabel}</p>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
