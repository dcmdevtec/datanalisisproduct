"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, AlertCircle, Eye, ArrowRight, Settings, ArrowDown, CheckCircle } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

interface Question {
  id: string
  type: string
  text: string
  options: string[]
  required: boolean
  config?: {
    validation?: {
      required?: boolean
      minLength?: number
      maxLength?: number
      pattern?: string
      customMessage?: string
      minValue?: number
      maxValue?: number
      allowDecimals?: boolean
    }
    displayLogic?: {
      enabled: boolean
      conditions: Array<{
        questionId: string
        operator: string
        value: string
        logicalOperator?: "AND" | "OR"
      }>
    }
    skipLogic?: {
      enabled: boolean
      rules: Array<{
        condition: string
        operator: string
        value: string
        targetSectionId: string
        targetQuestionId?: string
      }>
    }
    appearance?: {
      showNumbers?: boolean
      randomizeOptions?: boolean
      allowOther?: boolean
      otherText?: string
      placeholder?: string
      helpText?: string
    }
    advanced?: {
      allowMultiple?: boolean
      maxSelections?: number
      minSelections?: number
      showProgressBar?: boolean
      timeLimit?: number
      autoAdvance?: boolean
    }
    [key: string]: any
  }
}

interface SurveySection {
  id: string
  title: string
  description?: string
  order_num: number
  questions: Question[]
}

interface AdvancedQuestionConfigProps {
  isOpen: boolean
  onClose: () => void
  question: Question
  allSections: SurveySection[]
  allQuestions: Question[]
  onSave: (config: any) => void
}

interface DisplayCondition {
  questionId: string
  questionText?: string // Agregar campo para mantener el texto de referencia
  operator: string
  value: string
}

interface DisplayLogic {
  enabled: boolean
  conditions: DisplayCondition[]
}

interface SkipLogic {
  enabled: boolean
  rules: any[]
}

interface QuestionConfig {
  displayLogic?: DisplayLogic
  skipLogic?: SkipLogic
  validation?: any
  appearance?: any
  advanced?: any
  [key: string]: any
}

function QuestionPreview({ question, isConditionMet = false }: { question: Question; isConditionMet?: boolean }) {
  const renderQuestionContent = () => {
    switch (question.type) {
      case "multiple_choice":
        return (
          <div className="space-y-2">
            {question.options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-gray-300 rounded-full"></div>
                <span className="text-sm">{option}</span>
              </div>
            ))}
          </div>
        )
      case "checkbox":
        return (
          <div className="space-y-2">
            {question.options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-gray-300 rounded"></div>
                <span className="text-sm">{option}</span>
              </div>
            ))}
          </div>
        )
      case "text":
        return <div className="w-full h-8 border-2 border-gray-300 rounded bg-gray-50"></div>
      case "textarea":
        return <div className="w-full h-20 border-2 border-gray-300 rounded bg-gray-50"></div>
      default:
        return <div className="w-full h-8 border-2 border-gray-300 rounded bg-gray-50"></div>
    }
  }

  return (
    <div
      className={`p-4 border-2 rounded-lg transition-all ${
        isConditionMet ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-medium text-sm">{question.text.replace(/<[^>]*>/g, "") || "Pregunta sin título"}</h4>
        {isConditionMet && (
          <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
            <CheckCircle className="w-3 h-3 mr-1" />
            Condición cumplida
          </Badge>
        )}
      </div>
      {renderQuestionContent()}
    </div>
  )
}

function ValueSelector({
  question,
  operator,
  value,
  onChange,
  allQuestions,
}: {
  question: Question
  operator: string
  value: string
  onChange: (value: string) => void
  allQuestions: Question[]
}) {
  const sourceQuestion = allQuestions.find((q) => q.id === question.id) || question

  // For operators that don't need a value
  if (operator === "is_empty" || operator === "is_not_empty") {
    return null
  }

  // For multiple choice and checkbox questions, show option selector
  if (
    (sourceQuestion.type === "multiple_choice" || sourceQuestion.type === "checkbox") &&
    sourceQuestion.options?.length > 0
  ) {
    if (sourceQuestion.type === "checkbox" && (operator === "contains" || operator === "not_contains")) {
      // For checkbox with contains/not_contains, allow multiple selection
      const selectedValues = value ? value.split(",") : []

      return (
        <div className="space-y-2 p-3 border rounded-lg bg-gray-50 max-w-xs">
          <Label className="text-xs font-medium">Seleccionar opciones:</Label>
          {sourceQuestion.options.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Checkbox
                id={`option-${index}`}
                checked={selectedValues.includes(option)}
                onCheckedChange={(checked) => {
                  let newValues = [...selectedValues]
                  if (checked) {
                    newValues.push(option)
                  } else {
                    newValues = newValues.filter((v) => v !== option)
                  }
                  onChange(newValues.join(","))
                }}
              />
              <Label htmlFor={`option-${index}`} className="text-sm cursor-pointer">
                {option}
              </Label>
            </div>
          ))}
        </div>
      )
    } else {
      // For single selection
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Seleccionar opción" />
          </SelectTrigger>
          <SelectContent>
            {sourceQuestion.options.map((option, index) => (
              <SelectItem key={index} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }
  }

  // For number questions with range operators, show number input
  if (
    sourceQuestion.type === "number" &&
    (operator === "greater_than" || operator === "less_than" || operator === "equals" || operator === "not_equals")
  ) {
    return (
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Valor numérico"
        className="w-[150px]"
      />
    )
  }

  // Default text input for other cases
  return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Valor" className="w-[200px]" />
}

function SkipLogicVisualizer({
  rules,
  question,
  allSections,
  allQuestions,
  onUpdateRule,
}: {
  rules: any[]
  question: Question
  allSections: SurveySection[]
  allQuestions: Question[]
  onUpdateRule: (index: number, field: string, value: any) => void
}) {
  return (
    <div className="space-y-6">
      {rules.map((rule, index) => {
        const targetSection = allSections.find((s) => {
          const match = s.id === rule.targetSectionId
          const matchTrimmed = s.id === rule.targetSectionId?.trim()
          const matchString = String(s.id) === String(rule.targetSectionId)
          
          // Usar la comparación más robusta
          return match || matchTrimmed || matchString
        })
        
        // Si no se encuentra la sección, crear un objeto temporal con la información guardada
        const displayTargetSection = targetSection || {
          id: rule.targetSectionId,
          title: `⚠️ Sección no encontrada (ID: ${rule.targetSectionId?.substring(0, 8)}...)`,
          questions: []
        }

        // Encontrar la pregunta objetivo si existe
        const targetQuestion = rule.targetQuestionId ? 
          allQuestions.find(q => q.id === rule.targetQuestionId) : null

        return (
          <Card key={index} className={`${!targetSection ? 'border-red-300 bg-red-50' : 'border-2 border-emerald-200 bg-gradient-to-br from-white via-emerald-50/50 to-teal-100/50'} shadow-lg hover:shadow-xl transition-all duration-300`}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-full text-sm font-bold">
                    {index + 1}
                  </div>
                  Regla {index + 1}
                  {!targetSection && (
                    <Badge variant="destructive" className="text-xs">
                      ⚠️ Sección inválida
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.enabled !== false}
                    onCheckedChange={(checked) => onUpdateRule(index, "enabled", checked)}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                  <span className="text-xs text-muted-foreground">Activa</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Question Preview - Enhanced */}
              <div className="bg-gradient-to-r from-green-100 to-green-50 p-4 rounded-xl border-2 border-green-300 relative">
                <div className="absolute top-2 right-2">
                  <div className="flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded-full text-xs">
                    <CheckCircle className="h-3 w-3" />
                    Condición cumplida
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-green-800">{question.text}</h4>
                  {question.type === "multiple_choice" && (
                    <div className="space-y-2">
                      {question.options.map((option, optIndex) => (
                        <div key={optIndex} className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            rule.value === option ? 'border-green-500 bg-green-500' : 'border-gray-300'
                          }`}></div>
                          <span className="text-sm text-green-700">{option}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {question.type === "checkbox" && (
                    <div className="space-y-2">
                      {question.options.map((option, optIndex) => (
                        <div key={optIndex} className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border-2 ${
                            (rule.value || "").split(",").includes(option) ? 'border-green-500 bg-green-500' : 'border-gray-300'
                          }`}></div>
                          <span className="text-sm text-green-700">{option}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Flow Arrow */}
              <div className="flex items-center justify-center">
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                  <ArrowDown className="h-5 w-5 text-white" />
                </div>
              </div>

              {/* Condition Builder - Enhanced */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border-2 border-dashed border-green-300">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-emerald-800">Si la respuesta</span>
                  </div>

                  <Select value={rule.operator} onValueChange={(value) => {
                    onUpdateRule(index, "operator", value)
                  }}>
                    <SelectTrigger className="w-full bg-white border-emerald-300 focus:border-emerald-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">es igual a</SelectItem>
                      <SelectItem value="not_equals">no es igual a</SelectItem>
                      <SelectItem value="contains">contiene</SelectItem>
                      <SelectItem value="not_contains">no contiene</SelectItem>
                      <SelectItem value="greater_than">es mayor que</SelectItem>
                      <SelectItem value="less_than">es menor que</SelectItem>
                      <SelectItem value="is_empty">está vacía</SelectItem>
                      <SelectItem value="is_not_empty">no está vacía</SelectItem>
                    </SelectContent>
                  </Select>

                  {(question.type === "multiple_choice" || question.type === "checkbox") &&
                    (rule.operator === "equals" || rule.operator === "not_equals") && (
                      <Select value={rule.value} onValueChange={(value) => {
                        onUpdateRule(index, "value", value)
                      }}>
                        <SelectTrigger className="w-full bg-white border-emerald-300 focus:border-emerald-500">
                          <SelectValue placeholder="Seleccionar opción" />
                        </SelectTrigger>
                        <SelectContent>
                          {question.options.map((option, optIndex) => (
                            <SelectItem key={optIndex} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                  {question.type === "checkbox" && (rule.operator === "contains" || rule.operator === "not_contains") && (
                    <div className="col-span-full">
                      <div className="flex flex-wrap gap-3">
                        {question.options.map((option, optIndex) => (
                          <label key={optIndex} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(rule.value || "").split(",").includes(option)}
                              onChange={(e) => {
                                const currentValues = (rule.value || "").split(",").filter(Boolean)
                                const newValues = e.target.checked
                                  ? [...currentValues, option]
                                  : currentValues.filter((v: string) => v !== option)
                                onUpdateRule(index, "value", newValues.join(","))
                              }}
                              className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-emerald-700">{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {(question.type === "text" || question.type === "number") && 
                   (rule.operator === "equals" || rule.operator === "not_equals" || rule.operator === "contains" || rule.operator === "not_contains") && (
                    <Input
                      value={rule.value || ""}
                      onChange={(e) => onUpdateRule(index, "value", e.target.value)}
                      placeholder="Valor a comparar"
                      className="w-full bg-white border-emerald-300 focus:border-emerald-500"
                    />
                  )}

                  {(question.type === "number") && 
                   (rule.operator === "greater_than" || rule.operator === "not_equals") && (
                    <Input
                      type="number"
                      value={rule.value || ""}
                      onChange={(e) => onUpdateRule(index, "value", e.target.value)}
                      placeholder="Número"
                      className="w-full bg-white border-emerald-300 focus:border-emerald-500"
                    />
                  )}
                </div>
              </div>

              {/* Flow Arrow */}
              <div className="flex items-center justify-center">
                <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
                  <ArrowDown className="h-5 w-5 text-white" />
                </div>
              </div>

              {/* Action Block - Enhanced */}
              <div className="bg-gradient-to-r from-emerald-100 to-green-50 p-6 rounded-xl border-2 border-emerald-300">
                <div className="space-y-4">
                  <h4 className="font-semibold text-emerald-800 text-center">Entonces ir a:</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Target Section Selection */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-emerald-700">Sección:</label>
                      <Select value={rule.targetSectionId} onValueChange={(value) => {
                        onUpdateRule(index, "targetSectionId", value)
                        // Reset target question when section changes
                        onUpdateRule(index, "targetQuestionId", "")
                      }}>
                        <SelectTrigger className="w-full bg-white border-teal-300 focus:border-teal-500">
                          <SelectValue placeholder="Seleccionar sección" />
                        </SelectTrigger>
                        <SelectContent>
                          {allSections.map((section) => (
                            <SelectItem key={section.id} value={section.id}>
                              {section.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Target Question Selection */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-emerald-700">Pregunta específica (opcional):</label>
                      <Select 
                        value={rule.targetSectionId || "section_start"} 
                        onValueChange={(value) => {
                          // Si se selecciona "section_start", guardar undefined para indicar inicio de sección
                          const actualValue = value === "section_start" ? undefined : value
                          onUpdateRule(index, "targetQuestionId", actualValue)
                          // Store question text for reference
                          if (actualValue) {
                            const selectedQuestion = allQuestions.find(q => q.id === actualValue)
                            if (selectedQuestion) {
                              onUpdateRule(index, "targetQuestionText", selectedQuestion.text)
                            }
                          } else {
                            // Si es inicio de sección, limpiar el texto de pregunta
                            onUpdateRule(index, "targetQuestionText", undefined)
                          }
                        }}
                        disabled={!rule.targetSectionId}
                      >
                        <SelectTrigger className="w-full bg-white border-teal-300 focus:border-teal-500 disabled:bg-gray-100">
                          <SelectValue placeholder={rule.targetSectionId ? "Seleccionar pregunta o inicio de sección" : "Primero selecciona una sección"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="section_start">Ir al inicio de la sección</SelectItem>
                          {rule.targetSectionId && allQuestions
                            .filter(q => {
                              const section = allSections.find(s => s.id === rule.targetSectionId)
                              return section && section.questions.some(sq => sq.id === q.id)
                            })
                            .map((question) => (
                              <SelectItem key={question.id} value={question.id}>
                                {question.text.length > 50 ? `${question.text.substring(0, 50)}...` : question.text}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Visual Flow Preview */}
                  {rule.targetSectionId && (
                    <div className="mt-4 p-3 bg-white rounded-lg border border-emerald-200">
                      <div className="flex items-center gap-2 text-sm text-emerald-700">
                        <ArrowRight className="h-4 w-4" />
                        <span>Saltar a: <strong>{displayTargetSection.title}</strong></span>
                        {rule.targetQuestionId && targetQuestion ? (
                          <>
                            <span>→</span>
                            <span><strong>{targetQuestion.text.length > 30 ? `${targetQuestion.text.substring(0, 30)}...` : targetQuestion.text}</strong></span>
                          </>
                        ) : (
                          <span className="text-emerald-600">(inicio de la sección)</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export function AdvancedQuestionConfig({
  isOpen,
  onClose,
  question,
  allSections,
  allQuestions,
  onSave,
}: AdvancedQuestionConfigProps) {
  // Log simple para debugging
  console.log(`📋 Secciones disponibles: ${allSections?.length || 0}`)
  console.log(`🔍 Preguntas disponibles: ${allQuestions?.length || 0}`)
  console.log(`📝 Pregunta actual:`, question)
  console.log(`🔑 IDs de preguntas disponibles:`, allQuestions?.map(q => ({ id: q.id, text: q.text.substring(0, 30) + '...' })))
  
  // Inicializar el estado con la configuración de la pregunta
  const [config, setConfig] = useState<QuestionConfig>(() => {
    console.log("🚀 Inicializando estado de configuración para pregunta:", question.id)
    console.log("📋 Configuración base de la pregunta:", question.config)
    
    // Construir la configuración completa desde los campos de la base de datos
    const baseConfig = question.config || {}
    
    const initialConfig = {
      // Configuraciones generales
      ...baseConfig,
      
      // Lógica de visualización - desde campo específico display_logic
      displayLogic: baseConfig.displayLogic || { enabled: false, conditions: [] },
      
      // Lógica de salto - desde campo específico skip_logic
      skipLogic: baseConfig.skipLogic || { enabled: false, rules: [] },
      
      // Reglas de validación - desde campo específico validation_rules
      validation: baseConfig.validation || { required: question.required || false },
      
      // Configuración de apariencia
      appearance: baseConfig.appearance || {
        showNumbers: false,
        randomizeOptions: false,
        allowOther: false,
        otherText: "",
        placeholder: "",
        helpText: "",
      },
      
      // Configuración avanzada
      advanced: baseConfig.advanced || {
        allowMultiple: false,
        maxSelections: 1,
        minSelections: 1,
        showProgressBar: false,
        timeLimit: 0,
        autoAdvance: false,
      },
    }
    
    console.log("✅ Configuración inicial creada:", initialConfig)
    return initialConfig
  })
  
  const [activeTab, setActiveTab] = useState("validation")

  // Función para reconciliación automática de IDs obsoletos
  const reconcileObsoleteIds = useCallback(() => {
    if (!allQuestions || allQuestions.length === 0) return
    
    console.log("🔄 Iniciando reconciliación automática de IDs obsoletos...")
    setIsReconciling(true)
    
    setConfig((prev) => {
      const updatedConditions = (prev.displayLogic?.conditions || []).map(condition => {
        // Si ya tiene un ID válido, no hacer nada
        if (condition.questionId && allQuestions.find(q => q.id === condition.questionId)) {
          return condition
        }
        
        // Si tiene texto pero no ID válido, intentar encontrar por texto
        if (condition.questionText && !condition.questionId) {
          const foundQuestion = allQuestions.find(q => q.text === condition.questionText)
          if (foundQuestion) {
            console.log(`✅ Reconciliación automática: "${condition.questionText}" → ID: ${foundQuestion.id}`)
            return {
              ...condition,
              questionId: foundQuestion.id
            }
          }
        }
        
        // Si tiene ID pero no se encuentra, intentar por texto
        if (condition.questionId && condition.questionText) {
          const foundQuestion = allQuestions.find(q => q.text === condition.questionText)
          if (foundQuestion) {
            console.log(`✅ Reconciliación automática: ID obsoleto ${condition.questionId} → nuevo ID: ${foundQuestion.id}`)
            return {
              ...condition,
              questionId: foundQuestion.id
            }
          }
        }
        
        return condition
      })
      
      // Solo actualizar si hay cambios
      if (JSON.stringify(updatedConditions) !== JSON.stringify(prev.displayLogic?.conditions)) {
        console.log("🔄 Condiciones reconciliadas automáticamente")
        return {
          ...prev,
          displayLogic: {
            ...prev.displayLogic,
            conditions: updatedConditions
          }
        }
      }
      
      return prev
    })
    
    // Ocultar el indicador después de un breve delay
    setTimeout(() => setIsReconciling(false), 1000)
  }, [allQuestions])

  // Estado para mostrar cuando se está ejecutando la reconciliación
  const [isReconciling, setIsReconciling] = useState(false)

  useEffect(() => {
    if (isOpen && question.config) {
      console.log("🔍 Modal abierto, configuración de pregunta recibida:", question.config)
      
      // Actualizar la configuración cuando se abre el modal
      const baseConfig = question.config || {}
      
      const updatedConfig = {
        ...baseConfig,
        displayLogic: baseConfig.displayLogic || { enabled: false, conditions: [] },
        skipLogic: baseConfig.skipLogic || { enabled: false, rules: [] },
        validation: baseConfig.validation || { required: question.required || false },
        appearance: baseConfig.appearance || {
          showNumbers: false,
          randomizeOptions: false,
          allowOther: false,
          otherText: "",
          placeholder: "",
          helpText: "",
        },
        advanced: baseConfig.advanced || {
          allowMultiple: false,
          maxSelections: 1,
          minSelections: 1,
          showProgressBar: false,
          timeLimit: 0,
          autoAdvance: false,
        },
      }
      
      console.log("🔄 Configuración actualizada en useEffect:", updatedConfig)
      setConfig(updatedConfig)
      
      // Ejecutar reconciliación automática después de actualizar la configuración
      setTimeout(() => {
        reconcileObsoleteIds()
      }, 100)
    }
  }, [isOpen, question.config, question.required, reconcileObsoleteIds])

  // Ejecutar reconciliación automática cuando cambien las preguntas disponibles
  useEffect(() => {
    if (isOpen && allQuestions && allQuestions.length > 0) {
      console.log("🔄 Preguntas disponibles cambiaron, ejecutando reconciliación automática...")
      reconcileObsoleteIds()
    }
  }, [isOpen, allQuestions, reconcileObsoleteIds])

  const updateConfig = (field: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const updateValidation = (field: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      validation: {
        ...prev.validation,
        [field]: value,
      },
    }))
  }

  const updateDisplayLogic = (field: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      displayLogic: {
        ...prev.displayLogic,
        [field]: value,
      },
    }))
  }

  const updateSkipLogic = (field: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      skipLogic: {
        ...prev.skipLogic,
        [field]: value,
      },
    }))
  }

  const updateAppearance = (field: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        [field]: value,
      },
    }))
  }

  const updateAdvanced = (field: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      advanced: {
        ...prev.advanced,
        [field]: value,
      },
    }))
  }

  const addDisplayCondition = () => {
    console.log("➕ Agregando nueva condición de visualización")
    
    const newCondition: DisplayCondition = {
      questionId: "",
      questionText: "", // Agregar campo para el texto
      operator: "equals",
      value: "",
    }
    
    console.log("🆕 Nueva condición creada:", newCondition)
    
    setConfig((prev) => {
      const updatedConfig = {
        ...prev,
        displayLogic: {
          ...prev.displayLogic,
          conditions: [...(prev.displayLogic?.conditions || []), newCondition],
        },
      }
      
      console.log("📋 Configuración después de agregar condición:", updatedConfig)
      return updatedConfig
    })
  }

  const updateDisplayCondition = (index: number, field: string, value: any) => {
    console.log("🔄 Actualizando condición", index, field, value)
    
    setConfig((prev) => {
      const updatedConfig = {
        ...prev,
        displayLogic: {
          ...prev.displayLogic,
          conditions: (prev.displayLogic?.conditions || []).map((condition, i) => {
            if (i === index) {
              // Si se está actualizando el questionId, también actualizar el questionText
              if (field === "questionId" && value) {
                const selectedQuestion = allQuestions.find(q => q.id === value)
                if (selectedQuestion) {
                  console.log(`✅ Actualizando questionText para pregunta: ${selectedQuestion.text}`)
                  return {
                    ...condition,
                    [field]: value,
                    questionText: selectedQuestion.text
                  }
                }
              }
              
              return { ...condition, [field]: value }
            }
            return condition
          }),
        },
      }
      
      console.log(`✅ Condición ${index} actualizada:`, updatedConfig.displayLogic?.conditions?.[index])
      console.log("💾 Configuración actualizada:", updatedConfig)
      return updatedConfig
    })
  }

  const removeDisplayCondition = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      displayLogic: {
        ...prev.displayLogic,
        conditions: (prev.displayLogic?.conditions || []).filter((_, i) => i !== index),
      },
    }))
  }

  const addSkipRule = () => {
    const newRule = {
      condition: "",
      operator: "equals",
      value: "",
      targetSectionId: "",
      targetQuestionId: "",
      targetQuestionText: "",
      enabled: true,
    }
    setConfig((prev) => ({
      ...prev,
      skipLogic: {
        ...prev.skipLogic,
        rules: [...(prev.skipLogic?.rules || []), newRule],
      },
    }))
  }

  const updateSkipRule = (index: number, field: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      skipLogic: {
        ...prev.skipLogic,
        rules: (prev.skipLogic?.rules || []).map((rule, i) =>
          i === index ? { ...rule, [field]: value } : rule
        ),
      },
    }))
  }

  const removeSkipRule = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      skipLogic: {
        ...prev.skipLogic,
        rules: (prev.skipLogic?.rules || []).filter((_, i) => i !== index),
      },
    }))
  }

  const handleSave = () => {
    console.log("💾 Guardando configuración de pregunta:", config)
    
    // Validar y limpiar IDs inválidos antes de guardar
    const validatedConfig = {
      ...config,
      displayLogic: {
        enabled: config.displayLogic?.enabled || false,
        conditions: (config.displayLogic?.conditions || []).map(condition => {
          const sourceQuestion = allQuestions.find(q => q.id === condition.questionId)
          if (!sourceQuestion) {
            console.log(`⚠️ Limpiando condición con ID inválido: ${condition.questionId}`)
            return {
              ...condition,
              questionId: "",
              questionText: "", // También limpiar el texto
              value: ""
            }
          }
          return condition
        }).filter(condition => condition.questionId) // Solo mantener condiciones válidas
      },
      skipLogic: {
        enabled: config.skipLogic?.enabled || false,
        rules: config.skipLogic?.rules || []
      }
    }
    
    console.log("✅ Configuración validada a guardar:", validatedConfig)
    
    // Llamar a la función onSave con la configuración validada
    onSave(validatedConfig)
    onClose()
  }

  const tabs = [
    {
      id: "validation",
      label: "Validación",
      icon: AlertCircle,
      content: (
        <div className="space-y-6">
          <Card className="border-2 border-green-200 bg-gradient-to-br from-white via-green-50/50 to-emerald-100/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-green-500" />
                Reglas de Validación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="required"
                  checked={config.validation?.required || false}
                  onCheckedChange={(checked) => updateValidation("required", checked)}
                />
                <label
                  htmlFor="required"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Pregunta obligatoria
                </label>
              </div>

              {config.validation?.required && (
                <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-green-800">Longitud mínima</label>
                      <Input
                        type="number"
                        value={config.validation?.minLength || ""}
                        onChange={(e) => updateValidation("minLength", e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="Sin límite"
                        className="bg-white border-green-300 focus:border-green-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-green-800">Longitud máxima</label>
                      <Input
                        type="number"
                        value={config.validation?.maxLength || ""}
                        onChange={(e) => updateValidation("maxLength", e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="Sin límite"
                        className="bg-white border-green-300 focus:border-green-500"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-green-800">Patrón de validación (regex)</label>
                    <Input
                      value={config.validation?.pattern || ""}
                      onChange={(e) => updateValidation("pattern", e.target.value)}
                      placeholder="Ej: ^[A-Za-z]+$"
                      className="bg-white border-green-300 focus:border-green-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-green-800">Mensaje de error personalizado</label>
                    <Textarea
                      value={config.validation?.customMessage || ""}
                      onChange={(e) => updateValidation("customMessage", e.target.value)}
                      placeholder="Mensaje que se mostrará cuando la validación falle"
                      className="bg-white border-green-300 focus:border-green-500"
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: "logic",
      label: "Lógica",
      icon: Eye,
      content: (
        <div className="space-y-6 h-[500px] overflow-y-auto">
          {/* Lógica de Visualización */}
          <Card className="border-2 border-green-200 bg-gradient-to-br from-white via-green-50/50 to-emerald-100/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-green-600" />
                  Lógica de Visualización
                </div>
                <Switch
                  checked={config.displayLogic?.enabled || false}
                  onCheckedChange={(checked) => {
                    updateDisplayLogic("enabled", checked)
                  }}
                  className="data-[state=checked]:bg-green-500"
                />
              </CardTitle>
              <CardDescription>
                Controla cuándo se muestra esta pregunta basándose en las respuestas de otras preguntas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.displayLogic?.enabled && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-green-800">Condiciones de visualización</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addDisplayCondition}
                      className="bg-green-500 text-white hover:bg-green-600 border-green-500"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Condición
                    </Button>
                  </div>

                  {/* Condiciones de visualización mejoradas */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-green-700">Condiciones de visualización</h3>
                      {isReconciling && (
                        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          Reconciliando IDs...
                        </div>
                      )}
                    </div>
                    
                    {config.displayLogic?.conditions?.map((condition, index) => {
                      console.log(`🔍 Buscando pregunta con ID: ${condition.questionId}`)
                      console.log(`📋 Todas las preguntas:`, allQuestions?.map(q => ({ id: q.id, text: q.text.substring(0, 30) + '...' })))
                      
                      const sourceQuestion = allQuestions.find((q) => q.id === condition.questionId)
                      
                      console.log(`✅ Pregunta fuente encontrada:`, sourceQuestion)
                      
                      return (
                        <Card key={index} className="bg-gradient-to-br from-white via-green-50/30 to-emerald-100/30 border-2 border-green-200 shadow-lg hover:shadow-xl transition-all duration-300">
                          <CardContent className="pt-6">
                            <div className="space-y-6">
                              {/* Header de la condición */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                    {index + 1}
                                  </div>
                                  <span className="text-lg font-semibold text-green-800">Condición {index + 1}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {/* Debug info */}
                                  <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    ID: {condition.questionId || "No seleccionado"}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeDisplayCondition(index)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-full"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              {/* Selector de pregunta */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-green-700">Si la respuesta de:</label>
                                <Select
                                  value={condition.questionId}
                                  onValueChange={(value) => updateDisplayCondition(index, "questionId", value)}
                                >
                                  <SelectTrigger className={`w-full ${!sourceQuestion ? 'border-red-300 bg-red-50' : 'border-green-300'} focus:border-green-500`}>
                                    <SelectValue placeholder="Seleccionar pregunta" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allQuestions
                                      .filter((q) => q.id !== question.id)
                                      .map((q) => (
                                        <SelectItem key={q.id} value={q.id}>
                                          {q.text.length > 40 ? `${q.text.substring(0, 40)}...` : q.text}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                                
                                {/* Mostrar texto de la pregunta seleccionada */}
                                {condition.questionText && (
                                  <div className={`p-2 border rounded text-sm ${
                                    sourceQuestion 
                                      ? 'bg-green-50 border-green-200 text-green-700' 
                                      : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                                  }`}>
                                    <span className="font-medium">
                                      {sourceQuestion ? '✅ Pregunta encontrada:' : '⚠️ Pregunta guardada:'}
                                    </span> {condition.questionText}
                                    {!sourceQuestion && (
                                      <div className="text-xs mt-1 text-yellow-600">
                                        La pregunta original ya no existe en la encuesta
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Indicador de error si no se encuentra la pregunta */}
                                {!sourceQuestion && condition.questionId && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                                      <AlertCircle className="h-4 w-4" />
                                      <span>⚠️ Pregunta no encontrada. El ID "{condition.questionId}" no existe en la encuesta actual.</span>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        console.log("🧹 Limpiando ID inválido:", condition.questionId)
                                        updateDisplayCondition(index, "questionId", "")
                                        updateDisplayCondition(index, "value", "")
                                        updateDisplayCondition(index, "questionText", "")
                                      }}
                                      className="text-red-600 hover:text-red-700 border-red-300"
                                    >
                                      Limpiar ID inválido
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {/* Operador */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-green-700">Operador:</label>
                                <Select
                                  value={condition.operator}
                                  onValueChange={(value) => updateDisplayCondition(index, "operator", value)}
                                >
                                  <SelectTrigger className="w-full bg-white border-green-300 focus:border-green-500">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="equals">es igual a</SelectItem>
                                    <SelectItem value="not_equals">no es igual a</SelectItem>
                                    <SelectItem value="contains">contiene</SelectItem>
                                    <SelectItem value="not_contains">no contiene</SelectItem>
                                    <SelectItem value="is_empty">está vacía</SelectItem>
                                    <SelectItem value="is_not_empty">no está vacía</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Valor */}
                              {condition.operator !== "is_empty" && condition.operator !== "is_not_empty" && (
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-green-700">Valor:</label>
                                  {sourceQuestion && (
                                    sourceQuestion.type === "multiple_choice" || sourceQuestion.type === "checkbox" ? (
                                      /* Para preguntas de opción múltiple y checkbox */
                                      <div className="space-y-2 p-3 border rounded-lg bg-gray-50 max-w-xs">
                                        <Label className="text-xs font-medium">Seleccionar opciones:</Label>
                                        {sourceQuestion.options.map((option, optionIndex) => (
                                          <div key={optionIndex} className="flex items-center space-x-2">
                                            <Checkbox
                                              id={`option-${index}-${optionIndex}`}
                                              checked={condition.value.includes(option)}
                                              onCheckedChange={(checked) => {
                                                let newValues = condition.value ? condition.value.split(",") : []
                                                if (checked) {
                                                  newValues.push(option)
                                                } else {
                                                  newValues = newValues.filter((v) => v !== option)
                                                }
                                                updateDisplayCondition(index, "value", newValues.join(","))
                                              }}
                                            />
                                            <Label htmlFor={`option-${index}-${optionIndex}`} className="text-sm cursor-pointer">
                                              {option}
                                            </Label>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      /* Para preguntas de texto o número */
                                      <Input
                                        value={condition.value}
                                        onChange={(e) => updateDisplayCondition(index, "value", e.target.value)}
                                        placeholder={sourceQuestion.type === "number" ? "Número" : "Texto"}
                                        className="w-full bg-white border-green-300 focus:border-green-500"
                                      />
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lógica de Salto - Enhanced Visual Version */}
          <Card className="border-2 border-emerald-200 bg-gradient-to-br from-white via-emerald-50/50 to-teal-100/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-emerald-600" />
                  Lógica de Salto
                </div>
                <Switch
                  checked={config.skipLogic?.enabled || false}
                  onCheckedChange={(checked) => {
                    updateSkipLogic("enabled", checked)
                  }}
                  className="data-[state=checked]:bg-emerald-500"
                />
              </CardTitle>
              <CardDescription>
                Define qué sucede cuando se cumple una condición específica en esta pregunta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 ">
              {config.skipLogic?.enabled && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-emerald-800">Reglas de salto</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addSkipRule}
                      className="bg-emerald-500 text-white hover:bg-emerald-600 border-emerald-500"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Regla
                    </Button>
                  </div>

                  <SkipLogicVisualizer
                    rules={config.skipLogic?.rules || []}
                    question={question}
                    allSections={allSections}
                    allQuestions={allQuestions}
                    onUpdateRule={updateSkipRule}
                  />

                  {/* Botones de eliminar regla mejorados */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                    {(config.skipLogic?.rules || []).map((rule, index) => (
                      <div key={index} className="flex flex-col items-center p-4 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border-2 border-red-200 hover:border-red-300 transition-all duration-200">
                        <div className="text-center mb-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-2">
                            {index + 1}
                          </div>
                          <span className="text-sm font-medium text-red-800">Regla {index + 1}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeSkipRule(index)}
                          className="w-full bg-gradient-to-r from-red-500 to-pink-600 text-white hover:from-red-600 hover:to-pink-700 border-red-500 hover:border-red-600 transition-all duration-200"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar Regla
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: "appearance",
      label: "Apariencia",
      icon: Settings,
      content: (
        <div className="space-y-6">
          <Card className="border-2 border-teal-200 bg-gradient-to-br from-white via-teal-50/50 to-emerald-100/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-teal-600" />
                Configuración de Apariencia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showNumbers"
                      checked={config.appearance?.showNumbers || false}
                      onCheckedChange={(checked) => updateAppearance("showNumbers", checked)}
                    />
                    <label htmlFor="showNumbers" className="text-sm font-medium text-teal-800">
                      Mostrar números de pregunta
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="randomizeOptions"
                      checked={config.appearance?.randomizeOptions || false}
                      onCheckedChange={(checked) => updateAppearance("randomizeOptions", checked)}
                    />
                    <label htmlFor="randomizeOptions" className="text-sm font-medium text-teal-800">
                      Aleatorizar opciones
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allowOther"
                      checked={config.appearance?.allowOther || false}
                      onCheckedChange={(checked) => updateAppearance("allowOther", checked)}
                    />
                    <label htmlFor="allowOther" className="text-sm font-medium text-teal-800">
                      Permitir "Otra" opción
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  {config.appearance?.allowOther && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-teal-800">Texto para "Otra" opción</label>
                      <Input
                        value={config.appearance?.otherText || ""}
                        onChange={(e) => updateAppearance("otherText", e.target.value)}
                        placeholder="Otra"
                        className="bg-white border-teal-300 focus:border-teal-500"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-teal-800">Texto de placeholder</label>
                    <Input
                      value={config.appearance?.placeholder || ""}
                      onChange={(e) => updateAppearance("placeholder", e.target.value)}
                      placeholder="Texto de ayuda"
                      className="bg-white border-teal-300 focus:border-teal-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-teal-800">Texto de ayuda</label>
                    <Textarea
                      value={config.appearance?.helpText || ""}
                      onChange={(e) => updateAppearance("helpText", e.target.value)}
                      placeholder="Texto explicativo adicional"
                      className="bg-white border-teal-300 focus:border-teal-500"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: "advanced",
      label: "Avanzado",
      icon: ArrowRight,
      content: (
        <div className="space-y-6">
          <Card className="border-2 border-green-200 bg-gradient-to-br from-white via-green-50/50 to-emerald-100/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRight className="h-5 w-5 text-green-600" />
                Configuración Avanzada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allowMultiple"
                      checked={config.advanced?.allowMultiple || false}
                      onCheckedChange={(checked) => updateAdvanced("allowMultiple", checked)}
                    />
                    <label htmlFor="allowMultiple" className="text-sm font-medium text-green-800">
                      Permitir múltiples selecciones
                    </label>
                  </div>

                  {config.advanced?.allowMultiple && (
                    <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-green-800">Selección mínima</label>
                        <Input
                          type="number"
                          value={config.advanced?.minSelections || 1}
                          onChange={(e) => updateAdvanced("minSelections", parseInt(e.target.value))}
                          min={1}
                          className="bg-white border-green-300 focus:border-green-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-green-800">Selección máxima</label>
                        <Input
                          type="number"
                          value={config.advanced?.minSelections || 1}
                          onChange={(e) => updateAdvanced("maxSelections", parseInt(e.target.value))}
                          min={1}
                          className="bg-white border-green-300 focus:border-green-500"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showProgressBar"
                      checked={config.advanced?.showProgressBar || false}
                      onCheckedChange={(checked) => updateAdvanced("showProgressBar", checked)}
                    />
                    <label htmlFor="showProgressBar" className="text-sm font-medium text-green-800">
                      Mostrar barra de progreso
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-green-800">Límite de tiempo (segundos)</label>
                    <Input
                      type="number"
                      value={config.advanced?.timeLimit || 0}
                      onChange={(e) => updateAdvanced("timeLimit", parseInt(e.target.value) || 0)}
                      placeholder="Sin límite"
                      min={0}
                      className="bg-white border-green-300 focus:border-green-500"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="autoAdvance"
                      checked={config.advanced?.autoAdvance || false}
                      onCheckedChange={(checked) => updateAdvanced("autoAdvance", checked)}
                    />
                    <label htmlFor="autoAdvance" className="text-sm font-medium text-green-800">
                      Avance automático
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Settings className="h-6 w-6" />
            Configuración Avanzada
          </DialogTitle>
          <DialogDescription className="text-base">
            Personaliza el comportamiento y apariencia de la pregunta: "{question.text}"
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col h-full">
          {/* Navigation Tabs */}
          <div className="border-b">
            <nav className="flex space-x-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-all duration-200 whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg"
                      : "text-gray-600 hover:text-gray-800 hover:bg-green-50/50"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {tabs.find((tab) => tab.id === activeTab)?.content}
          </div>

          {/* Footer Actions */}
          <div className="border-t bg-gray-50 px-6 py-4 flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-200">
              Guardar Cambios
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
