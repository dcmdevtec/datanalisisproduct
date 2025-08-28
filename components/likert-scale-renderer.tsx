"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { AlertCircle } from "lucide-react"

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

interface LikertScaleRendererProps {
  question: {
    id: string
    text: string
    required: boolean
    config?: {
      scaleConfig?: ScaleConfig
    }
  }
  value?: number
  onChange: (value: number | null) => void
  disabled?: boolean
}

export function LikertScaleRenderer({ question, value, onChange, disabled = false }: LikertScaleRendererProps) {
  const [localValue, setLocalValue] = useState<number | null>(value || null)
  
  // Configuración por defecto si no hay configuración personalizada
  const config: ScaleConfig = question.config?.scaleConfig || {
    min: 1,
    max: 5,
    step: 1,
    startPosition: 'left',
    labels: {
      left: 'Muy en desacuerdo',
      right: 'Muy de acuerdo'
    },
    showZero: false,
    zeroLabel: 'No Sabe / No Responde',
    showNumbers: true,
    showLabels: true,
    orientation: 'horizontal',
    validation: {
      requireAnswer: true,
      allowZero: true,
    },
    appearance: {
      size: 'medium',
      color: '#4CAF50',
      showTicks: true,
      showValue: true,
    }
  }

  const handleValueChange = (newValue: number | null) => {
    setLocalValue(newValue)
    onChange(newValue)
  }

  const getSizeClasses = () => {
    switch (config.appearance.size) {
      case 'small': return 'text-sm'
      case 'large': return 'text-lg'
      default: return 'text-base'
    }
  }

  const getSliderSize = () => {
    switch (config.appearance.size) {
      case 'small': return 'h-2'
      case 'large': return 'h-4'
      default: return 'h-3'
    }
  }

  const renderScale = () => {
    if (config.orientation === 'vertical') {
      return renderVerticalScale()
    }
    return renderHorizontalScale()
  }

  const renderHorizontalScale = () => {
    const range = config.max - config.min + 1
    const showCenter = config.labels.center && range > 2
    
    return (
      <div className="space-y-4">
        {/* Control deslizante */}
        <div className="px-2">
          <Slider
            value={localValue !== null ? [localValue] : undefined}
            onValueChange={(values) => handleValueChange(values[0] || null)}
            min={config.showZero ? 0 : config.min}
            max={config.max}
            step={config.step}
            disabled={disabled}
            className={`w-full ${getSliderSize()}`}
            style={{
              '--slider-color': config.appearance.color,
            } as React.CSSProperties}
          />
        </div>

        {/* Etiquetas y números */}
        <div className="flex justify-between items-end text-sm">
          {config.showZero && (
            <div className="text-center flex-1">
              <div className={`font-bold ${getSizeClasses()}`}>0</div>
              <div className="text-xs text-gray-600 max-w-[80px] mx-auto">
                {config.zeroLabel}
              </div>
            </div>
          )}
          
          <div className="text-center flex-1">
            <div className={`font-bold ${getSizeClasses()}`}>{config.min}</div>
            <div className="text-xs text-gray-600 max-w-[80px] mx-auto">
              {config.labels.left}
            </div>
          </div>

          {showCenter && (
            <div className="text-center flex-1">
              <div className={`font-bold ${getSizeClasses()}`}>
                {Math.ceil((config.min + config.max) / 2)}
              </div>
              <div className="text-xs text-gray-600 max-w-[80px] mx-auto">
                {config.labels.center}
              </div>
            </div>
          )}

          <div className="text-center flex-1">
            <div className={`font-bold ${getSizeClasses()}`}>{config.max}</div>
            <div className="text-xs text-gray-600 max-w-[80px] mx-auto">
              {config.labels.right}
            </div>
          </div>
        </div>

        {/* Valor seleccionado */}
        {config.appearance.showValue && localValue !== null && (
          <div className="text-center">
            <Badge variant="outline" className="text-lg px-4 py-2">
              Valor seleccionado: {localValue}
            </Badge>
          </div>
        )}
      </div>
    )
  }

  const renderVerticalScale = () => {
    const range = config.max - config.min + 1
    const showCenter = config.labels.center && range > 2
    
    return (
      <div className="flex items-center space-x-4">
        {/* Control deslizante vertical */}
        <div className="py-2">
          <Slider
            value={localValue !== null ? [localValue] : undefined}
            onValueChange={(values) => handleValueChange(values[0] || null)}
            min={config.showZero ? 0 : config.min}
            max={config.max}
            step={config.step}
            disabled={disabled}
            orientation="vertical"
            className={`h-32 ${getSliderSize()}`}
            style={{
              '--slider-color': config.appearance.color,
            } as React.CSSProperties}
          />
        </div>

        {/* Etiquetas verticales */}
        <div className="flex flex-col justify-between h-32 text-sm">
          {config.showZero && (
            <div className="text-center">
              <div className={`font-bold ${getSizeClasses()}`}>0</div>
              <div className="text-xs text-gray-600 max-w-[100px]">
                {config.zeroLabel}
              </div>
            </div>
          )}
          
          <div className="text-center">
            <div className={`font-bold ${getSizeClasses()}`}>{config.max}</div>
            <div className="text-xs text-gray-600 max-w-[100px]">
              {config.labels.right}
            </div>
          </div>

          {showCenter && (
            <div className="text-center">
              <div className={`font-bold ${getSizeClasses()}`}>
                {Math.ceil((config.min + config.max) / 2)}
              </div>
              <div className="text-xs text-gray-600 max-w-[100px]">
                {config.labels.center}
              </div>
            </div>
          )}

          <div className="text-center">
            <div className={`font-bold ${getSizeClasses()}`}>{config.min}</div>
            <div className="text-xs text-gray-600 max-w-[100px]">
              {config.labels.left}
            </div>
          </div>
        </div>

        {/* Valor seleccionado */}
        {config.appearance.showValue && localValue !== null && (
          <div className="text-center">
            <Badge variant="outline" className="text-lg px-4 py-2">
              {localValue}
            </Badge>
          </div>
        )}
      </div>
    )
  }

  const renderRadioScale = () => {
    const range = config.max - config.min + 1
    const showCenter = config.labels.center && range > 2
    
    return (
      <RadioGroup
        value={localValue?.toString() || ""}
        onValueChange={(value) => handleValueChange(parseInt(value))}
        disabled={disabled}
        className="space-y-3"
      >
        {config.showZero && (
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="0" id={`scale-0-${question.id}`} />
            <Label htmlFor={`scale-0-${question.id}`} className="flex-1">
              <div className="font-bold">0</div>
              <div className="text-sm text-gray-600">{config.zeroLabel}</div>
            </Label>
          </div>
        )}
        
        {Array.from({ length: range }, (_, i) => {
          const value = config.min + i
          const isCenter = showCenter && value === Math.ceil((config.min + config.max) / 2)
          
          return (
            <div key={value} className="flex items-center space-x-3">
              <RadioGroupItem value={value.toString()} id={`scale-${value}-${question.id}`} />
              <Label htmlFor={`scale-${value}-${question.id}`} className="flex-1">
                <div className="font-bold">{value}</div>
                <div className="text-sm text-gray-600">
                  {isCenter ? config.labels.center : 
                   value === config.min ? config.labels.left :
                   value === config.max ? config.labels.right : ''}
                </div>
              </Label>
            </div>
          )
        })}
      </RadioGroup>
    )
  }

  const renderCheckboxScale = () => {
    const range = config.max - config.min + 1
    const showCenter = config.labels.center && range > 2
    
    return (
      <div className="space-y-3">
        {config.showZero && (
          <div className="flex items-center space-x-3">
            <Checkbox
              id={`scale-0-${question.id}`}
              checked={localValue === 0}
              onCheckedChange={(checked) => handleValueChange(checked ? 0 : null)}
              disabled={disabled}
            />
            <Label htmlFor={`scale-0-${question.id}`} className="flex-1">
              <div className="font-bold">0</div>
              <div className="text-sm text-gray-600">{config.zeroLabel}</div>
            </Label>
          </div>
        )}
        
        {Array.from({ length: range }, (_, i) => {
          const value = config.min + i
          const isCenter = showCenter && value === Math.ceil((config.min + config.max) / 2)
          
          return (
            <div key={value} className="flex items-center space-x-3">
              <Checkbox
                id={`scale-${value}-${question.id}`}
                checked={localValue === value}
                onCheckedChange={(checked) => handleValueChange(checked ? value : null)}
                disabled={disabled}
              />
              <Label htmlFor={`scale-${value}-${question.id}`} className="flex-1">
                <div className="font-bold">{value}</div>
                <div className="text-sm text-gray-600">
                  {isCenter ? config.labels.center : 
                   value === config.min ? config.labels.left :
                   value === config.max ? config.labels.right : ''}
                </div>
              </Label>
            </div>
          )
        })}
      </div>
    )
  }

  // Determinar el tipo de renderizado basado en el rango
  const getRenderType = () => {
    if (config.max <= 7) return 'radio'      // Para escalas pequeñas (1-5, 1-7)
    if (config.max <= 10) return 'checkbox'  // Para escalas medianas (1-10)
    return 'slider'                          // Para escalas grandes (1-100)
  }

  const renderType = getRenderType()

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-white via-blue-50/50 to-indigo-100/50">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Pregunta */}
          <div>
            <Label className="text-lg font-medium text-blue-800">
              {question.text}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
          </div>

          {/* Escala según el tipo */}
          {renderType === 'slider' && renderScale()}
          {renderType === 'radio' && renderRadioScale()}
          {renderType === 'checkbox' && renderCheckboxScale()}

          {/* Mensaje de validación */}
          {config.validation.customMessage && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-700">{config.validation.customMessage}</span>
            </div>
          )}

          {/* Información de la escala */}
          <div className="text-xs text-blue-600 space-y-1">
            <p>• Rango: {config.min} a {config.max}</p>
            <p>• Paso: {config.step}</p>
            {config.showZero && <p>• Incluye opción cero: {config.zeroLabel}</p>}
            <p>• Tipo de renderizado: {renderType}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
