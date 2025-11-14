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
    const range = config.max - config.min
    const steps = range / config.step
    const showCenter = config.labels.center && range > 2

    // 🐛 DEBUG: Ver configuración recibida
    console.log('🎯 LIKERT CONFIG:', {
      min: config.min,
      max: config.max,
      step: config.step,
      showZero: config.showZero,
      labels: config.labels,
      range,
      steps
    })

    // Generar SOLO los puntos que tienen labels configurados
    const points: number[] = []
    
    // Si showZero, agregar 0 primero (siempre tiene label)
    if (config.showZero) {
      points.push(0)
    }
    
    // Agregar puntos que tienen labels configurados
    // Left label (siempre en config.min)
    if (config.labels.left) {
      points.push(config.min)
    }
    
    // Center label (en el punto medio si existe)
    if (config.labels.center && showCenter) {
      const centerValue = Math.ceil((config.min + config.max) / 2)
      if (!points.includes(centerValue)) {
        points.push(centerValue)
      }
    }
    
    // Right label (siempre en config.max)
    if (config.labels.right) {
      if (!points.includes(config.max)) {
        points.push(config.max)
      }
    }
    
    // Ordenar los puntos
    points.sort((a, b) => a - b)

    console.log('🎯 PUNTOS GENERADOS:', points)

    // Función para calcular la posición real en porcentaje basada en el valor
    const getPointPosition = (pointValue: number): number => {
      const min = config.showZero ? 0 : config.min;
      const max = config.max;
      return ((pointValue - min) / (max - min)) * 100;
    };

    const getPointColor = (pointValue: number) => {
      if (localValue === null) return 'bg-gray-300'
      if (pointValue === localValue) return `bg-green-500` // Color más brillante para el seleccionado
      if (pointValue < localValue) return `bg-green-400`
      return 'bg-gray-300'
    }

    return (
      <div className="space-y-6">
        {/* Control deslizante visual con puntos */}
        <div className="relative flex items-center">
          <div className="h-1 flex-grow bg-gray-200 rounded-full">
            <div 
              className="h-1 rounded-full transition-all duration-200"
              style={{ 
                backgroundColor: config.appearance.color,
                width: localValue !== null 
                  ? `${getPointPosition(localValue)}%` 
                  : '0%'
              }}
            ></div>
          </div>
          <div className="absolute w-full h-5 top-1/2 -translate-y-1/2">
            {points.map((point) => (
              <button
                key={point}
                type="button"
                onClick={() => handleValueChange(point)}
                className={`
                  w-5 h-5 rounded-full flex items-center justify-center 
                  transition-all duration-150 ease-in-out
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                  ${getPointColor(point)}
                  ${localValue === point ? 'transform scale-125 shadow-lg' : 'hover:scale-110'}
                `}
                style={{
                  position: 'absolute',
                  left: `${getPointPosition(point)}%`,
                  transform: 'translateX(-50%)'
                }}
                disabled={disabled}
              >
                {config.showNumbers && (
                  <span className={`text-xs ${localValue === point ? 'text-white font-bold' : 'text-gray-600'}`}>
                    {/* No mostramos el número dentro del punto para no sobrecargar */}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Etiquetas y números */}
        <div className="relative w-full" style={{ minHeight: '50px' }}>
          {points.map((point) => {
            let label = ''
            if (point === 0 && config.showZero) label = config.zeroLabel
            if (point === config.min) label = config.labels.left
            if (showCenter && point === Math.ceil((config.min + config.max) / 2)) label = config.labels.center || ''
            if (point === config.max) label = config.labels.right

            return (
              <div 
                key={point} 
                className="absolute text-center"
                style={{
                  left: `${getPointPosition(point)}%`,
                  transform: 'translateX(-50%)',
                  width: '80px'
                }}
              >
                {config.showNumbers && (
                  <div className={`font-bold ${getSizeClasses()} ${localValue === point ? 'text-green-600' : ''}`}>
                    {point}
                  </div>
                )}
                {config.showLabels && label && (
                  <div className="text-xs text-gray-600 max-w-[80px] mx-auto mt-1 break-words">
                    {label}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Valor seleccionado */}
        {config.appearance.showValue && localValue !== null && (
          <div className="text-center pt-2">
            <Badge variant="outline" className="text-lg px-4 py-2 border-green-500 bg-green-50">
              Valor seleccionado: <span className="font-bold ml-2">{localValue}</span>
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
          {/* Función helper para forzar snapping al step más cercano */}
          {(() => {
            const min = config.showZero ? 0 : config.min;
            const snapToStep = (rawValue: number): number => {
              const rounded = Math.round((rawValue - min) / config.step) * config.step + min;
              return Math.max(min, Math.min(config.max, rounded));
            };
            
            return (
              <Slider
                value={localValue !== null ? [localValue] : undefined}
                onValueChange={(values) => {
                  const rawValue = values[0];
                  if (rawValue !== undefined) {
                    const snappedValue = snapToStep(rawValue);
                    handleValueChange(snappedValue);
                  }
                }}
                onValueCommit={(values) => {
                  const rawValue = values[0];
                  if (rawValue !== undefined) {
                    const snappedValue = snapToStep(rawValue);
                    handleValueChange(snappedValue);
                  }
                }}
                min={min}
                max={config.max}
                step={config.step}
                disabled={disabled}
                orientation="vertical"
                className={`h-32 ${getSliderSize()}`}
                style={{
                  '--slider-color': config.appearance.color,
                } as React.CSSProperties}
              />
            );
          })()}
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
