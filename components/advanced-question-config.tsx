"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, AlertCircle, Eye, ArrowRight, Settings2, ArrowDown, CheckCircle } from "lucide-react"
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
    <div className="space-y-4">
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

        return (
          <Card key={index} className={`${!targetSection ? 'border-red-300 bg-red-50' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  Regla {index + 1}
                  {!targetSection && (
                    <Badge variant="destructive" className="text-xs">
                      ⚠️ Sección inválida
                    </Badge>
                  )}
                </CardTitle>
              </div>
            </CardHeader>

            {/* Question Preview */}
            <QuestionPreview question={question} isConditionMet={true} />

            <div className="flex items-center justify-center my-4">
              <ArrowDown className="h-6 w-6 text-blue-500" />
            </div>

            {/* Condition Builder */}
            <div className="bg-white p-4 rounded-lg border-2 border-dashed border-blue-200 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">Si la respuesta</span>

                <Select value={rule.operator} onValueChange={(value) => {
                  onUpdateRule(index, "operator", value)
                }}>
                  <SelectTrigger className="w-[150px]">
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
                      <SelectTrigger className="w-[150px]">
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
                  <div className="flex flex-wrap gap-2">
                    {question.options.map((option, optIndex) => (
                      <label key={optIndex} className="flex items-center gap-1 text-sm">
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
                          className="rounded"
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                )}

                {!(
                  (question.type === "multiple_choice" || question.type === "checkbox") &&
                  (rule.operator === "equals" ||
                    rule.operator === "not_equals" ||
                    rule.operator === "contains" ||
                    rule.operator === "not_contains")
                ) &&
                  rule.operator !== "is_empty" &&
                  rule.operator !== "is_not_empty" && (
                    <Input
                      value={rule.value}
                      onChange={(e) => onUpdateRule(index, "value", e.target.value)}
                      placeholder="Valor"
                      className="w-[150px]"
                    />
                  )}
              </div>
            </div>

            <div className="flex items-center justify-center my-4">
              <ArrowDown className="h-6 w-6 text-green-500" />
            </div>

            <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Entonces ir a:</span>
                  <Select
                    value={rule.targetSectionId}
                    onValueChange={(value) => {
                      onUpdateRule(index, "targetSectionId", value)
                    }}
                  >
                    <SelectTrigger className={`w-[200px] ${!targetSection ? 'border-yellow-300 bg-yellow-50' : ''}`}>
                      <SelectValue placeholder="Seleccionar sección" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="end_survey">Finalizar encuesta</SelectItem>
                      {allSections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.title || `Sección ${section.order_num + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!targetSection && (
                    <span className="text-xs text-yellow-600">⚠️ Sección no encontrada</span>
                  )}
                </div>

                {rule.targetSectionId && rule.targetSectionId !== "end_survey" && displayTargetSection && (
                  <div className="space-y-3">
                    {!targetSection && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          ⚠️ <strong>Advertencia:</strong> La sección objetivo de esta regla ya no existe. 
                          Por favor, selecciona una nueva sección válida.
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-sm text-gray-600">Pregunta específica:</span>
                      <Select
                        value={rule.targetQuestionId || "section_start"}
                        onValueChange={(value) => {
                          const actualValue = value === "section_start" ? undefined : value
                          onUpdateRule(index, "targetQuestionId", actualValue)
                        }}
                      >
                        <SelectTrigger className="w-[250px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="section_start">Ir al inicio de la sección</SelectItem>
                          {displayTargetSection.questions.map((q, qIndex) => (
                            <SelectItem key={q.id} value={q.id}>
                              Pregunta {qIndex + 1}: {q.text.replace(/<[^>]*>/g, "").substring(0, 40)}...
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="mt-4 p-3 bg-white rounded-lg border">
                  {!targetSection && (
                    <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                      ⚠️ Sección objetivo no encontrada
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="text-xs">
                      Preview
                    </Badge>
                    <ArrowRight className="h-4 w-4" />
                    {rule.targetSectionId === "end_survey" ? (
                      <Badge variant="destructive" className="text-xs">
                        Fin de encuesta
                      </Badge>
                    ) : displayTargetSection ? (
                      <div className="flex items-center gap-2">
                        <Badge variant={targetSection ? "default" : "secondary"} className="text-xs">
                          {displayTargetSection.title}
                        </Badge>
                        {rule.targetQuestionId && (
                          <>
                            <ArrowRight className="h-3 w-3" />
                            <Badge variant="secondary" className="text-xs">
                              Pregunta específica
                            </Badge>
                          </>
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Seleccionar destino
                      </Badge>
                    )}
                  </div>
                  {displayTargetSection && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {displayTargetSection.questions.length} pregunta{displayTargetSection.questions.length !== 1 ? "s" : ""} en esta
                      sección
                    </p>
                  )}
                </div>
              </div>
            </div>
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
  
  // Inicializar el estado con la configuración de la pregunta
  const [config, setConfig] = useState(() => {
    // Construir la configuración completa desde los campos de la base de datos
    const baseConfig = question.config || {}
    
    // Asegurar que los campos principales existan con la estructura correcta de la BD
    return {
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
  })
  
  const [activeTab, setActiveTab] = useState("validation")

  useEffect(() => {
    if (isOpen && question.config) {
      const baseConfig = question.config || {}
      // console.log("🔍 Inicializando estado con config:", baseConfig) // Removed log
      const newConfig = {
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
      setConfig(newConfig)
      
      // Limpiar reglas inválidas después de inicializar
      setTimeout(() => {
        detectSectionIdChanges()
        cleanInvalidSkipRules()
      }, 100)
    }
  }, [isOpen, question.config, question.required])

  // Función para validar reglas de salto
  const getInvalidSkipRules = () => {
    return config.skipLogic?.rules?.filter(rule => {
      if (!rule.targetSectionId || rule.targetSectionId === "end_survey") return false
      return !allSections?.find(s => s.id === rule.targetSectionId)
    }) || []
  }

  // Función para detectar cambios de ID en secciones
  const detectSectionIdChanges = () => {
    if (!question.config?.skipLogic?.rules) return
    
    const rules = question.config.skipLogic.rules
    rules.forEach((rule, index) => {
      if (rule.targetSectionId && rule.targetSectionId !== "end_survey") {
        const sectionExists = allSections?.find(s => s.id === rule.targetSectionId)
        if (!sectionExists) {
          console.log(`🚨 ALERTA: Regla ${index + 1} apunta a sección inexistente: ${rule.targetSectionId}`)
          console.log(`🚨 Esto puede indicar que los IDs de las secciones han cambiado`)
        }
      }
    })
  }

  // Función para limpiar reglas inválidas
  const cleanInvalidSkipRules = () => {
    const invalidRules = getInvalidSkipRules()
    if (invalidRules.length > 0) {
      console.log(`🧹 Limpiando ${invalidRules.length} regla(s) de salto inválida(s)`)
      const validRules = config.skipLogic?.rules?.filter(rule => {
        if (!rule.targetSectionId || rule.targetSectionId === "end_survey") return true
        return !!allSections?.find(s => s.id === rule.targetSectionId)
      }) || []
      updateSkipLogic("rules", validRules)
    }
  }

  const handleSave = () => {
    // Validar que todas las reglas de salto apunten a secciones válidas
    const invalidSkipRules = config.skipLogic?.rules?.filter(rule => {
      if (!rule.targetSectionId || rule.targetSectionId === "end_survey") return false
      return !allSections?.find(s => s.id === rule.targetSectionId)
    }) || []

    if (invalidSkipRules.length > 0) {
      alert(`❌ No se puede guardar: ${invalidSkipRules.length} regla(s) de salto apuntan a secciones inexistentes.\n\nPor favor, elimina o corrige estas reglas antes de guardar.`)
      return
    }

    // Asegurar que la configuración tenga la estructura correcta para la BD
    const finalConfig = {
      ...config,
      // Asegurar que los campos principales existan con la estructura correcta
      displayLogic: {
        enabled: config.displayLogic?.enabled || false,
        conditions: config.displayLogic?.conditions || []
      },
      skipLogic: {
        enabled: config.skipLogic?.enabled || false,
        rules: config.skipLogic?.rules || []
      },
      validation: {
        required: config.validation?.required || question.required || false,
        ...config.validation
      },
      appearance: config.appearance || {
        showNumbers: false,
        randomizeOptions: false,
        allowOther: false,
        otherText: "",
        placeholder: "",
        helpText: "",
      },
      advanced: config.advanced || {
        allowMultiple: false,
        maxSelections: 1,
        minSelections: 1,
        showProgressBar: false,
        timeLimit: 0,
        autoAdvance: false,
      },
    }
    
    onSave(finalConfig)
    onClose()
  }

  const updateValidation = (field: string, value: any) => {
    
    setConfig((prev) => {
      const newConfig = {
        ...prev,
        validation: {
          ...prev.validation,
          [field]: value,
        },
      }
      return newConfig
    })
  }

  const updateDisplayLogic = (field: string, value: any) => {
    
    setConfig((prev) => {
      const newConfig = {
        ...prev,
        displayLogic: {
          ...prev.displayLogic,
          [field]: value,
        },
      }
      return newConfig
    })
  }

  const updateSkipLogic = (field: string, value: any) => {
    
    setConfig((prev) => {
      const newConfig = {
        ...prev,
        skipLogic: {
          ...prev.skipLogic,
          [field]: value,
        },
      }
      return newConfig
    })
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
    const newCondition = {
      questionId: "", // ID de la pregunta que se evalúa
      operator: "equals", // Operador por defecto
      value: "", // Valor por defecto
      logicalOperator: "AND" as const, // Operador lógico por defecto
    }
    const currentConditions = config.displayLogic?.conditions || []
    updateDisplayLogic("conditions", [...currentConditions, newCondition])
  }

  const removeDisplayCondition = (index: number) => {
    const conditions = config.displayLogic?.conditions || []
    const newConditions = conditions.filter((_, i) => i !== index)
    updateDisplayLogic("conditions", newConditions)
  }

  const addSkipRule = () => {
    const newRule = {
      value: "", // Valor por defecto (ej: "Opción 2")
      operator: "equals", // Operador por defecto
      condition: "", // Condición por defecto
      questionId: question.id, // ID de la pregunta actual
      targetSectionId: "", // ID de la sección destino
      targetQuestionId: undefined, // ID de la pregunta específica (opcional)
    }
    const currentRules = config.skipLogic?.rules || []
    updateSkipLogic("rules", [...currentRules, newRule])
  }

  const removeSkipRule = (index: number) => {
    const rules = config.skipLogic?.rules || []
    const newRules = rules.filter((_, i) => i !== index)
    updateSkipLogic("rules", newRules)
  }

  const updateSkipRule = (index: number, field: string, value: any) => {
    
    const rules = [...(config.skipLogic?.rules || [])]
    if (rules[index]) {
      rules[index] = { ...rules[index], [field]: value }
      updateSkipLogic("rules", rules)
    }
  }

  const getValidationOptions = () => {
    const baseOptions = [
      { key: "required", label: "Campo obligatorio", type: "boolean" },
      { key: "customMessage", label: "Mensaje de error personalizado", type: "text" },
    ]

    const typeSpecificOptions: { [key: string]: any[] } = {
      text: [
        { key: "minLength", label: "Longitud mínima", type: "number" },
        { key: "maxLength", label: "Longitud máxima", type: "number" },
        { key: "pattern", label: "Patrón (RegEx)", type: "text" },
        { key: "allowOnlyNumbers", label: "Solo números", type: "boolean" },
        { key: "allowOnlyLetters", label: "Solo letras", type: "boolean" },
        { key: "allowOnlyAlphanumeric", label: "Solo alfanumérico", type: "boolean" },
      ],
      textarea: [
        { key: "minLength", label: "Longitud mínima", type: "number" },
        { key: "maxLength", label: "Longitud máxima", type: "number" },
        { key: "minWords", label: "Mínimo de palabras", type: "number" },
        { key: "maxWords", label: "Máximo de palabras", type: "number" },
      ],
      number: [
        { key: "minValue", label: "Valor mínimo", type: "number" },
        { key: "maxValue", label: "Valor máximo", type: "number" },
        { key: "allowDecimals", label: "Permitir decimales", type: "boolean" },
        { key: "decimalPlaces", label: "Lugares decimales", type: "number" },
        { key: "allowNegative", label: "Permitir negativos", type: "boolean" },
        { key: "mustBeInteger", label: "Solo números enteros", type: "boolean" },
      ],
      email: [
        { key: "pattern", label: "Patrón de email", type: "text", defaultValue: "^[^@]+@[^@]+\\.[^@]+$" },
        { key: "allowMultiple", label: "Permitir múltiples emails", type: "boolean" },
        {
          key: "separator",
          label: "Separador (si múltiples)",
          type: "text",
          defaultValue: ",",
        },
      ],
      phone: [
        { key: "pattern", label: "Patrón de teléfono", type: "text", defaultValue: "\\d{3}-\\d{3}-\\d{4}" },
        { key: "countryCode", label: "Código de país requerido", type: "boolean" },
        {
          key: "format",
          label: "Formato",
          type: "select",
          options: [
            { value: "international", label: "Internacional (+1234567890)" },
            { value: "national", label: "Nacional (123-456-7890)" },
            { value: "local", label: "Local (1234567890)" },
          ],
        },
      ],
      date: [
        { key: "minDate", label: "Fecha mínima", type: "date" },
        { key: "maxDate", label: "Fecha máxima", type: "date" },
        {
          key: "dateFormat",
          label: "Formato de fecha",
          type: "select",
          options: [
            { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
            { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
            { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
          ],
        },
        { key: "allowFutureDates", label: "Permitir fechas futuras", type: "boolean" },
        { key: "allowPastDates", label: "Permitir fechas pasadas", type: "boolean" },
      ],
      multiple_choice: [
        { key: "minSelections", label: "Selecciones mínimas", type: "number" },
        { key: "maxSelections", label: "Selecciones máximas", type: "number" },
      ],
      checkbox: [
        { key: "minSelections", label: "Selecciones mínimas", type: "number" },
        { key: "maxSelections", label: "Selecciones máximas", type: "number" },
        { key: "exactSelections", label: "Número exacto de selecciones", type: "number" },
      ],
      rating: [
        { key: "minRating", label: "Calificación mínima", type: "number" },
        { key: "maxRating", label: "Calificación máxima", type: "number" },
      ],
      matrix: [
        { key: "requireAllRows", label: "Requerir todas las filas", type: "boolean" },
        { key: "allowSameAnswer", label: "Permitir misma respuesta", type: "boolean" },
      ],
    }

    return [...baseOptions, ...(typeSpecificOptions[question.type] || [])]
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configuración Avanzada
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="validation" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Validación
            </TabsTrigger>
            <TabsTrigger value="logic" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Lógica
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Apariencia
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Avanzado
            </TabsTrigger>
          </TabsList>

          {/* VALIDACIÓN */}
          <TabsContent value="validation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Reglas de Validación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {getValidationOptions().map((option) => (
                  <div key={option.key} className="space-y-2">
                    <Label>{option.label}</Label>
                    {option.type === "boolean" ? (
                      <Switch
                        checked={(config.validation as any)?.[option.key] || false}
                        onCheckedChange={(checked) => updateValidation(option.key, checked)}
                      />
                    ) : option.type === "number" ? (
                      <Input
                        type="number"
                        value={(config.validation as any)?.[option.key] || ""}
                        onChange={(e) => updateValidation(option.key, Number.parseInt(e.target.value) || undefined)}
                        placeholder={option.placeholder || `Ingrese ${option.label.toLowerCase()}`}
                      />
                    ) : option.type === "date" ? (
                      <Input
                        type="date"
                        value={(config.validation as any)?.[option.key] || ""}
                        onChange={(e) => updateValidation(option.key, e.target.value)}
                      />
                    ) : option.type === "select" ? (
                      <Select
                        value={(config.validation as any)?.[option.key] || ""}
                        onValueChange={(value) => updateValidation(option.key, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Seleccionar ${option.label.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {option.options?.map((opt: any) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={(config.validation as any)?.[option.key] || option.defaultValue || "Default Value"}
                        onChange={(e) => updateValidation(option.key, e.target.value)}
                        placeholder={option.placeholder || `Ingrese ${option.label.toLowerCase()}`}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* LÓGICA */}
          <TabsContent value="logic" className="space-y-6">
            {/* Lógica de Visualización */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Lógica de Visualización
                  <Switch
                    checked={config.displayLogic?.enabled || false}
                    onCheckedChange={(checked) => {
                      updateDisplayLogic("enabled", checked)
                    }}
                  />
                </CardTitle>
              </CardHeader>
              {config.displayLogic?.enabled && (
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrar esta pregunta solo si se cumplen ciertas condiciones
                  </p>

                  {(config.displayLogic?.conditions || []).map((condition, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                      <Select
                        value={condition.questionId}
                        onValueChange={(value) => {
                          const conditions = [...(config.displayLogic?.conditions || [])]
                          conditions[index] = { ...condition, questionId: value }
                          updateDisplayLogic("conditions", conditions)
                        }}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Seleccionar pregunta" />
                        </SelectTrigger>
                        <SelectContent>
                          {allQuestions
                            .filter((q) => q.id !== question.id)
                            .map((q) => (
                              <SelectItem key={q.id} value={String(q.id)}>
                                {q.text.replace(/<[^>]*>/g, "").substring(0, 50)}...
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={condition.operator}
                        onValueChange={(value) => {
                          const conditions = [...(config.displayLogic?.conditions || [])]
                          conditions[index] = { ...condition, operator: value }
                          updateDisplayLogic("conditions", conditions)
                        }}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equals">Es igual a</SelectItem>
                          <SelectItem value="not_equals">No es igual a</SelectItem>
                          <SelectItem value="contains">Contiene</SelectItem>
                          <SelectItem value="not_contains">No contiene</SelectItem>
                          <SelectItem value="greater_than">Mayor que</SelectItem>
                          <SelectItem value="less_than">Menor que</SelectItem>
                          <SelectItem value="is_empty">Está vacío</SelectItem>
                          <SelectItem value="is_not_empty">No está vacío</SelectItem>
                        </SelectContent>
                      </Select>

                      <ValueSelector
                        question={allQuestions.find((q) => q.id === condition.questionId) || question}
                        operator={condition.operator}
                        value={condition.value}
                        onChange={(value) => {
                          const conditions = [...(config.displayLogic?.conditions || [])]
                          conditions[index] = { ...condition, value }
                          updateDisplayLogic("conditions", conditions)
                        }}
                        allQuestions={allQuestions}
                      />

                      {index > 0 && (
                        <Select
                          value={condition.logicalOperator || "AND"}
                          onValueChange={(value: "AND" | "OR") => {
                            const conditions = [...(config.displayLogic?.conditions || [])]
                            conditions[index] = { ...condition, logicalOperator: value }
                            updateDisplayLogic("conditions", conditions)
                          }}
                        >
                          <SelectTrigger className="w-[80px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AND">Y</SelectItem>
                            <SelectItem value="OR">O</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      <Button variant="ghost" size="sm" onClick={() => removeDisplayCondition(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <Button variant="outline" onClick={addDisplayCondition} className="w-full bg-transparent">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Condición
                  </Button>
                </CardContent>
              )}
            </Card>

            {/* Lógica de Salto - Enhanced Visual Version */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Lógica de Salto
                  <Switch
                    checked={config.skipLogic?.enabled || false}
                    onCheckedChange={(checked) => {
                      updateSkipLogic("enabled", checked)
                    }}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Lógica de Salto</h3>
                  <Switch
                    checked={config.skipLogic?.enabled || false}
                    onCheckedChange={(checked) => updateSkipLogic("enabled", checked)}
                  />
                </div>
                
                {config.skipLogic?.enabled && (
                  <SkipLogicVisualizer
                    rules={config.skipLogic?.rules || []}
                    question={question}
                    allSections={allSections}
                    allQuestions={allQuestions}
                    onUpdateRule={updateSkipRule}
                  />
                )}

                {(config.skipLogic?.rules || []).map((rule, index) => (
                  <div key={index} className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSkipRule(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar Regla
                    </Button>
                  </div>
                ))}

                <Button variant="outline" onClick={addSkipRule} className="w-full bg-transparent">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Regla de Salto
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* APARIENCIA */}
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Opciones de Apariencia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <Label>Mostrar números en opciones</Label>
                    <Switch
                      checked={config.appearance?.showNumbers || false}
                      onCheckedChange={(checked) => updateAppearance("showNumbers", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Aleatorizar opciones</Label>
                    <Switch
                      checked={config.appearance?.randomizeOptions || false}
                      onCheckedChange={(checked) => updateAppearance("randomizeOptions", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Permitir "Otro"</Label>
                    <Switch
                      checked={config.appearance?.allowOther || false}
                      onCheckedChange={(checked) => updateAppearance("allowOther", checked)}
                    />
                  </div>
                </div>

                {config.appearance?.allowOther && (
                  <div className="space-y-2">
                    <Label>Texto para "Otro"</Label>
                    <Input
                      value={config.appearance?.otherText || ""}
                      onChange={(e) => updateAppearance("otherText", e.target.value)}
                      placeholder="Otro (especificar)"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Texto de ayuda</Label>
                  <Textarea
                    value={config.appearance?.helpText || ""}
                    onChange={(e) => updateAppearance("helpText", e.target.value)}
                    placeholder="Texto de ayuda opcional para la pregunta"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Placeholder</Label>
                  <Input
                    value={config.appearance?.placeholder || ""}
                    onChange={(e) => updateAppearance("placeholder", e.target.value)}
                    placeholder="Texto placeholder para campos de entrada"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AVANZADO */}
          <TabsContent value="advanced" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuración Avanzada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(question.type === "checkbox" || question.type === "multiple_choice") && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Selecciones mínimas</Label>
                        <Input
                          type="number"
                          value={config.advanced?.minSelections || ""}
                          onChange={(e) =>
                            updateAdvanced("minSelections", Number.parseInt(e.target.value) || undefined)
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Selecciones máximas</Label>
                        <Input
                          type="number"
                          value={config.advanced?.maxSelections || ""}
                          onChange={(e) =>
                            updateAdvanced("maxSelections", Number.parseInt(e.target.value) || undefined)
                          }
                          placeholder="Sin límite"
                        />
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <Label>Mostrar barra de progreso</Label>
                    <Switch
                      checked={config.advanced?.showProgressBar || false}
                      onCheckedChange={(checked) => updateAdvanced("showProgressBar", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Avance automático</Label>
                    <Switch
                      checked={config.advanced?.autoAdvance || false}
                      onCheckedChange={(checked) => updateAdvanced("autoAdvance", checked)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Límite de tiempo (segundos)</Label>
                  <Input
                    type="number"
                    value={config.advanced?.timeLimit || ""}
                    onChange={(e) => updateAdvanced("timeLimit", Number.parseInt(e.target.value) || undefined)}
                    placeholder="Sin límite"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Guardar Configuración</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
