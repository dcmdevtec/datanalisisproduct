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
import { Plus, Trash2, AlertCircle, Eye, ArrowRight, Settings, ArrowDown, CheckCircle, Sliders } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"


// Use imported types for props
import type { Question, SurveySection } from "@/types-updated"

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

function stripHtmlTags(text: string | undefined): string {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').trim();
}

// ...existing code...

function SkipLogicVisualizer({
  question,
  rules,
  allSections,
  allQuestions,
  onAddRule,
  onDeleteRule,
  onUpdateRule,
}: {
  question: Question;
  rules: any[];
  allSections: SurveySection[];
  allQuestions: Question[];
  onAddRule: (rule: any) => void;
  onDeleteRule: (index: number) => void;
  onUpdateRule?: (index: number, field: string, value: any) => void;
}) {
  // Estados para la nueva regla
  const [conditionOperator, setConditionOperator] = useState("equals");
  const [conditionValue, setConditionValue] = useState("");
  const [showDestSelectors, setShowDestSelectors] = useState(false);
  const [newSectionId, setNewSectionId] = useState("");
  const [newQuestionId, setNewQuestionId] = useState("");

  // Opciones de operadores
  const operatorOptions = [
    { value: "equals", label: "es igual a" },
    { value: "not_equals", label: "no es igual a" },
    { value: "contains", label: "contiene" },
    { value: "not_contains", label: "no contiene" },
    { value: "greater_than", label: "es mayor que" },
    { value: "less_than", label: "es menor que" },
    { value: "is_empty", label: "está vacía" },
    { value: "is_not_empty", label: "no está vacía" },
  ];
  
  // Reset condition value when operator changes
  useEffect(() => {
    setConditionValue("");
  }, [conditionOperator]);

  // Reset condition value when question type that needs options changes
  useEffect(() => {
    if (question.type === 'multiple_choice' || question.type === 'checkbox') {
        setConditionValue("");
    }
  }, [question.type]);


  // Mostrar selectores de destino solo si hay valor definido
  useEffect(() => {
    if (
      (conditionOperator !== "is_empty" && conditionOperator !== "is_not_empty" && conditionValue !== "") ||
      (conditionOperator === "is_empty" || conditionOperator === "is_not_empty")
    ) {
      setShowDestSelectors(true);
    } else {
      setShowDestSelectors(false);
    }
  }, [conditionOperator, conditionValue]);

  // Preguntas de la sección seleccionada
  const sectionQuestions = allSections.find(s => s.id === newSectionId)?.questions || [];

  return (
    <div className="overflow-x-auto">
      {/* If question has explicit options (multiple_choice, dropdown, checkbox), show per-option jump editor */}
      {(question.type === 'multiple_choice' || question.type === 'dropdown' || question.type === 'checkbox') &&
        question.options && question.options.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-emerald-800 mb-2">Saltos por opción</h4>
          <div className="bg-white border border-emerald-100 rounded-lg shadow-sm p-3">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-emerald-700">
                  <th className="py-2">Opción</th>
                  <th className="py-2">Saltar a</th>
                  <th className="py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {question.options.map((option, optIdx) => {
                  // buscar regla existente que aplique a esta opción
                  const existingRuleIndex = rules.findIndex(
                    (r) => (r.condition === 'equals' || r.operator === 'equals') && String(r.value) === String(option),
                  )
                  const existingRule = existingRuleIndex > -1 ? rules[existingRuleIndex] : null
                  return (
                    <tr key={optIdx} className="border-t">
                      <td className="py-3 align-top">
                        <div className="text-sm text-emerald-900">{option}</div>
                      </td>
                      <td className="py-2">
                        <select
                          className="border rounded-lg px-3 py-2 bg-white text-emerald-900 focus:ring-2 focus:ring-emerald-400 w-full"
                          value={existingRule?.targetSectionId || ''}
                          onChange={(e) => {
                            const dest = e.target.value
                            // Si existe regla, actualizar destino o eliminar si vacío
                            if (existingRuleIndex > -1) {
                              if (!dest) {
                                onDeleteRule(existingRuleIndex)
                              } else if (onUpdateRule) {
                                onUpdateRule(existingRuleIndex, 'targetSectionId', dest)
                              }
                            } else {
                              // crear nueva regla para esta opción
                              if (dest) {
                                onAddRule({
                                  condition: 'equals',
                                  operator: 'equals',
                                  value: option,
                                  targetSectionId: dest,
                                  targetQuestionId: '',
                                  targetQuestionText: '',
                                  enabled: true,
                                })
                              }
                            }
                          }}
                        >
                          <option value="">-- Elegir sección --</option>
                          {allSections.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.title}
                            </option>
                          ))}
                          <option value="END_SURVEY">Finalizar Encuesta</option>
                        </select>
                      </td>
                      <td className="py-2 align-top">
                        {existingRuleIndex > -1 ? (
                          <button className="text-red-600 hover:underline" onClick={() => onDeleteRule(existingRuleIndex)}>
                            Eliminar
                          </button>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin salto</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* For other question types render a generic rule editor (single rule per condition/value) */}
      {!(question.type === 'multiple_choice' || question.type === 'dropdown' || question.type === 'checkbox') && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-emerald-800 mb-2">Saltos por valor</h4>
          <div className="bg-white border border-emerald-100 rounded-lg shadow-sm p-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="text-xs text-emerald-700">Operador</label>
                <Select value={conditionOperator} onValueChange={(v) => setConditionOperator(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operatorOptions.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-emerald-700">Valor</label>
                {/* Render a context-aware value input */}
                {question.type === 'number' ? (
                  <Input type="number" value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} />
                ) : question.type === 'date' || question.type === 'time' ? (
                  <Input type={question.type === 'date' ? 'date' : 'time'} value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} />
                ) : (
                  <Input value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} />
                )}
              </div>

              <div>
                <label className="text-xs text-emerald-700">Saltar a</label>
                <select
                  className="border rounded-lg px-3 py-2 bg-white text-emerald-900 focus:ring-2 focus:ring-emerald-400 w-full"
                  value={newSectionId}
                  onChange={(e) => setNewSectionId(e.target.value)}
                >
                  <option value="">-- Elegir sección --</option>
                  {allSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                  <option value="END_SURVEY">Finalizar Encuesta</option>
                </select>
              </div>

              <div className="md:col-span-3 flex justify-end">
                <Button
                  variant="default"
                  onClick={() => {
                    if (!newSectionId) return
                    // create or update rule: if a matching rule by operator+value exists, update it
                    const idx = rules.findIndex((r) => r.operator === conditionOperator && String(r.value) === String(conditionValue))
                    if (idx > -1) {
                      if (onUpdateRule) onUpdateRule(idx, 'targetSectionId', newSectionId)
                    } else {
                      onAddRule({
                        condition: conditionOperator,
                        operator: conditionOperator,
                        value: conditionValue,
                        targetSectionId: newSectionId,
                        targetQuestionId: '',
                        targetQuestionText: '',
                        enabled: true,
                      })
                    }
                    // reset
                    setConditionValue('')
                    setNewSectionId('')
                  }}
                >
                  Agregar/Actualizar Regla
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Formulario inline para agregar nueva regla */}
      
    </div>
  );
}

export function AdvancedQuestionConfig({
  isOpen,
  onClose,
  question,
  allSections,
  allQuestions,
  onSave,
} : {
  isOpen: boolean;
  onClose: () => void;
  question: Question;
  allSections: SurveySection[];
  allQuestions: Question[];
  onSave: (config: any) => void;
}) {
  // Log simple para debugging
  console.log(`📋 Secciones disponibles: ${allSections?.length || 0}`)
  console.log(`🔍 Preguntas disponibles: ${allQuestions?.length || 0}`)
  console.log(`📝 Pregunta actual:`, question)
  console.log(`🔑 IDs de preguntas disponibles:`, allQuestions?.map((q: Question) => ({ id: q.id, text: q.text.substring(0, 30) + '...' })))
  
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
      const updatedConditions = (prev.displayLogic?.conditions || []).map((condition) => {
        // Si ya tiene un ID válido, no hacer nada
        if (condition.questionId && allQuestions.find((q: Question) => q.id === condition.questionId)) {
          return condition;
        }
        // Si tiene texto pero no ID válido, intentar encontrar por texto
        if (condition.questionText && !condition.questionId) {
          const foundQuestion = allQuestions.find((q: Question) => q.text === condition.questionText);
          if (foundQuestion) {
            console.log(`✅ Reconciliación automática: "${condition.questionText}" → ID: ${foundQuestion.id}`);
            return {
              ...condition,
              questionId: foundQuestion.id,
            };
          }
        }
        // Si tiene ID pero no se encuentra, intentar por texto
        if (condition.questionId && condition.questionText) {
          const foundQuestion = allQuestions.find((q: Question) => q.text === condition.questionText);
          if (foundQuestion) {
            console.log(`✅ Reconciliación automática: ID obsoleto ${condition.questionId} → nuevo ID: ${foundQuestion.id}`);
            return {
              ...condition,
              questionId: foundQuestion.id,
            };
          }
        }
        return condition;
      });
      // Solo actualizar si hay cambios
      if (JSON.stringify(updatedConditions) !== JSON.stringify(prev.displayLogic?.conditions)) {
        console.log("🔄 Condiciones reconciliadas automáticamente");
        return {
          ...prev,
          displayLogic: {
            ...prev.displayLogic,
            conditions: updatedConditions,
          },
        };
      }
      return prev;
    });
    
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
                const selectedQuestion = allQuestions.find((q: Question) => q.id === value)
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
          const sourceQuestion = allQuestions.find((q: Question) => q.id === condition.questionId)
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
                Validación de Longitud
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <label className="text-sm font-medium text-green-800">Mensaje de error personalizado</label>
                <Textarea
                  value={config.validation?.customMessage || ""}
                  onChange={(e) => updateValidation("customMessage", e.target.value)}
                  placeholder="Mensaje que se mostrará cuando la validación falle"
                  className="bg-white border-green-300 focus:border-green-500"
                  rows={2}
                />
              </div>
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
                      className="bg-green-100 text-green-700 hover:bg-green-200 border-green-300 hover:border-green-400"
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
                          Reconciliando IDs..
                        </div>
                      )}
                    </div>
                    
                    {config.displayLogic?.conditions?.map((condition, index) => {
                      console.log(`🔍 Buscando pregunta con ID: ${condition.questionId}`)
                      console.log(`📋 Todas las preguntas:`, allQuestions?.map((q: Question) => ({ id: q.id, text: q.text.substring(0, 30) + '...' })))
                      
                      const sourceQuestion = allQuestions.find((q: Question) => q.id === condition.questionId)
                      
                      console.log(`✅ Pregunta fuente encontrada:`, sourceQuestion)
                      
                      const [saving, setSaving] = useState(false);
                      return (
                        <Card key={index} className="bg-gradient-to-br from-white via-green-50/30 to-emerald-100/30 border-2 border-green-200 shadow-lg hover:shadow-xl transition-all duration-300">
                          <CardContent className="pt-6">
                            <div className="space-y-6">
                              {/* Header de la condición */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-green-200 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">
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
                                      .filter((q: Question) => q.id !== question.id)
                                      .map((q: Question) => (
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
                                        {sourceQuestion.options.map((option: string, optionIndex: number) => (
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

                              {/* Botón Guardar condición */}
                              <div className="flex justify-end pt-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  disabled={saving}
                                  onClick={async () => {
                                    setSaving(true);
                                    // Simula guardado (puedes poner aquí lógica real de guardado si lo necesitas)
                                    await new Promise(res => setTimeout(res, 1000));
                                    setSaving(false);
                                  }}
                                  className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                                >
                                  {saving && (
                                    <svg className="animate-spin h-4 w-4 mr-1 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                    </svg>
                                  )}
                                  {saving ? 'Guardando...' : 'Guardar condición'}
                                </Button>
                              </div>
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
                  

                  <SkipLogicVisualizer
                    question={question}
                    rules={config.skipLogic?.rules || []}
                    allSections={allSections}
                    allQuestions={allQuestions}
                    onAddRule={(rule) => {
                      setConfig((prev) => ({
                        ...prev,
                        skipLogic: {
                          ...prev.skipLogic,
                          rules: [...(prev.skipLogic?.rules || []), rule],
                        },
                      }));
                    }}
                    onDeleteRule={removeSkipRule}
                    onUpdateRule={(index, field, value) => updateSkipRule(index, field, value)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: "likert",
      label: "Escala Likert",
      icon: Sliders,
      content: (
        <div className="space-y-6 h-[500px] overflow-y-auto">
          <Card className="border-2 border-blue-200 bg-gradient-to-br from-white via-blue-50/50 to-indigo-100/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <Sliders className="h-5 w-5 text-blue-600" />
                Configuración de Escala Likert
              </CardTitle>
              <CardDescription className="text-blue-700">
                Configura completamente tu escala Likert según los requerimientos del MÓDULO 2
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Configuración Básica de la Escala */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-blue-800">Configuración Básica de la Escala</h4>
                <p className="text-sm text-blue-700">Define el rango y comportamiento básico de tu escala Likert</p>
                
                {/* Escalas Predefinidas */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-blue-800">Escalas Predefinidas</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { name: "Escala 1-5", min: 1, max: 5, description: "Escala estándar de 5 puntos" },
                      { name: "Escala 1-7", min: 1, max: 7, description: "Escala de 7 puntos (Likert extendida)" },
                      { name: "Escala 1-10", min: 1, max: 10, description: "Escala de 10 puntos" },
                      { name: "Escala 1-100", min: 1, max: 100, description: "Escala de 100 puntos (control deslizante)" },
                    ].map((scale) => (
                      <Button
                        key={scale.name}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const updatedConfig = {
                            ...config,
                            likertScale: {
                              min: scale.min,
                              max: scale.max,
                              step: 1,
                              startPosition: 'left'
                            }
                          }
                          setConfig(updatedConfig)
                        }}
                        className={`border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 ${
                          config.likertScale?.min === scale.min && config.likertScale?.max === scale.max 
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
                        value={config.likertScale?.min || 1}
                        onChange={(e) => {
                          const updatedConfig = {
                            ...config,
                            likertScale: {
                              ...config.likertScale,
                              min: parseInt(e.target.value) || 1
                            }
                          }
                          setConfig(updatedConfig)
                        }}
                        min={1}
                        className="bg-white border-blue-300 focus:border-blue-500"
                      />
                      <p className="text-xs text-blue-600">Siempre debe ser 1 según requerimientos</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Valor máximo</Label>
                      <Input
                        type="number"
                        value={config.likertScale?.max || 5}
                        onChange={(e) => {
                          const updatedConfig = {
                            ...config,
                            likertScale: {
                              ...config.likertScale,
                              max: parseInt(e.target.value) || 5
                            }
                          }
                          setConfig(updatedConfig)
                        }}
                        min={2}
                        className="bg-white border-blue-300 focus:border-blue-500"
                      />
                      <p className="text-xs text-blue-600">Puede ser 5, 7, 10, 100, etc.</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Tamaño del paso</Label>
                      <Input
                        type="number"
                        value={config.likertScale?.step || 1}
                        onChange={(e) => {
                          const updatedConfig = {
                            ...config,
                            likertScale: {
                              ...config.likertScale,
                              step: parseInt(e.target.value) || 1
                            }
                          }
                          setConfig(updatedConfig)
                        }}
                        min={1}
                        className="bg-white border-blue-300 focus:border-blue-500"
                      />
                      <p className="text-xs text-blue-600">Siempre debe ser 1 según requerimientos</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Etiquetas Personalizables */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-blue-800">Etiquetas Personalizables</h4>
                <p className="text-sm text-blue-700">Personaliza las etiquetas de texto para los extremos y centro de tu escala</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-blue-800">Lado Izquierdo</Label>
                    <Input
                      value={config.likertScale?.labels?.left || ""}
                      onChange={(e) => {
                        const updatedConfig = {
                          ...config,
                          likertScale: {
                            ...config.likertScale,
                            labels: {
                              ...config.likertScale?.labels,
                              left: e.target.value
                            }
                          }
                        }
                        setConfig(updatedConfig)
                      }}
                      placeholder="Ej: Muy Insatisfecho"
                      className="bg-white border-blue-300 focus:border-blue-500"
                    />
                    <p className="text-xs text-blue-600">Etiqueta para el valor mínimo</p>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-blue-800">Centro (Opcional)</Label>
                    <Input
                      value={config.likertScale?.labels?.center || ""}
                      onChange={(e) => {
                        const updatedConfig = {
                          ...config,
                          likertScale: {
                            ...config.likertScale,
                            labels: {
                              ...config.likertScale?.labels,
                              center: e.target.value
                            }
                          }
                        }
                        setConfig(updatedConfig)
                      }}
                      placeholder="Ingresar una etiqueta (opcional)"
                      className="bg-white border-blue-300 focus:border-blue-500"
                    />
                    <p className="text-xs text-blue-600">Etiqueta para el centro de la escala</p>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-blue-800">Lado Derecho</Label>
                    <Input
                      value={config.likertScale?.labels?.right || ""}
                      onChange={(e) => {
                        const updatedConfig = {
                          ...config,
                          likertScale: {
                            ...config.likertScale,
                            labels: {
                              ...config.likertScale?.labels,
                              right: e.target.value
                            }
                          }
                        }
                        setConfig(updatedConfig)
                      }}
                      placeholder="Ej: Muy Satisfecho"
                      className="bg-white border-blue-300 focus:border-blue-500"
                    />
                    <p className="text-xs text-blue-600">Etiqueta para el valor máximo</p>
                  </div>
                </div>
              </div>

              {/* Opción "0 = No Sabe / No Responde" */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-blue-800">Opción "No Sabe / No Responde"</h4>
                <p className="text-sm text-blue-700">Incluye una opción adicional para respuestas no informativas</p>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <Checkbox
                      id="showZero"
                      checked={config.likertScale?.showZero || false}
                      onCheckedChange={(checked) => {
                        const updatedConfig = {
                          ...config,
                          likertScale: {
                            ...config.likertScale,
                            showZero: checked
                          }
                        }
                        setConfig(updatedConfig)
                      }}
                      className="data-[state=checked]:bg-blue-500"
                    />
                    <Label htmlFor="showZero" className="font-medium text-blue-800">
                      Incluir opción "0 = No Sabe / No Responde"
                    </Label>
                  </div>
                  
                  {config.likertScale?.showZero && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-blue-800">Texto de la etiqueta</Label>
                      <Input
                        value={config.likertScale?.zeroLabel || "No Sabe / No Responde"}
                        onChange={(e) => {
                          const updatedConfig = {
                            ...config,
                            likertScale: {
                              ...config.likertScale,
                              zeroLabel: e.target.value
                            }
                          }
                          setConfig(updatedConfig)
                        }}
                        placeholder="No Sabe / No Responde"
                        className="bg-white border-blue-300 focus:border-blue-500"
                      />
                      <p className="text-xs text-blue-600">Esta opción aparecerá como "0 = [tu texto]" en la escala</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Configuración de Posición y Apariencia */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-blue-800">Apariencia y Comportamiento</h4>
                <p className="text-sm text-blue-700">Personaliza la apariencia visual y el comportamiento de tu escala</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-blue-800">Posición Inicial</Label>
                      <Select
                        value={config.likertScale?.startPosition || 'left'}
                        onValueChange={(value) => {
                          const updatedConfig = {
                            ...config,
                            likertScale: {
                              ...config.likertScale,
                              startPosition: value
                            }
                          }
                          setConfig(updatedConfig)
                        }}
                      >
                        <SelectTrigger className="bg-white border-blue-300 focus:border-blue-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Lado izquierdo</SelectItem>
                          <SelectItem value="center">Centro</SelectItem>
                          <SelectItem value="right">Lado derecho</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-blue-600">Posición inicial del control deslizante</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-blue-800">Tipo de Control</Label>
                      <div className="text-sm text-blue-700 bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <strong>Control Deslizante (Slider)</strong><br/>
                        Esta escala Likert se renderizará como un control deslizante para una experiencia de usuario óptima.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    
  ]
const visibleTabs = question.type === 'likert'
  ? tabs
  : tabs.filter(tab => tab.id !== 'likert');
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Settings className="h-6 w-6" />
            Configuración Avanzada
          </DialogTitle>
          <DialogDescription className="text-base">
            Personaliza el comportamiento y apariencia de la pregunta: "{question.text?.replace(/<[^>]+>/g, '')}"
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col h-full">
          {/* Navigation Tabs */}
          <div className="border-b">
            <nav className="flex space-x-1 overflow-x-auto">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-all duration-200 whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-white text-black shadow-lg border border-gray-200"
                      : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
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
            <Button onClick={handleSave} className="bg-white text-black border border-gray-200 shadow-lg hover:shadow-xl hover:bg-gray-50 transition-all duration-200">
              Guardar Cambios
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
