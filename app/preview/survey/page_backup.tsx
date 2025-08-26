"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, ArrowRight, Loader2, Star, CheckCircle, AlertCircle, Info, Zap, Navigation, Target, SkipForward } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Tipos para la lógica de secciones y preguntas
interface Question {
  id: string
  type: string
  text: string
  options: string[]
  required: boolean
  image?: string | null
  matrixRows?: string[]
  matrixCols?: string[]
  ratingScale?: number
  config?: {
    dropdownMulti?: boolean
    matrixCellType?: string
    scaleMin?: number
    scaleMax?: number
    scaleLabels?: string[]
    allowOther?: boolean
    otherText?: string
    randomizeOptions?: boolean
    ratingEmojis?: boolean
    displayLogic?: {
      enabled: boolean
      conditions: Array<{
        questionId: string
        operator: string
        value: string
      }>
    }
    skipLogic?: {
      enabled: boolean
      rules: Array<{
        condition: string
        targetSectionId: string
        targetQuestionId?: string
        targetQuestionText?: string
        enabled: boolean
        operator: string
        value: string
      }>
    }
    validation?: {
      required?: boolean
      minLength?: number
      maxLength?: number
      pattern?: string
      customMessage?: string
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
  skip_logic?: {
    enabled: boolean
    target_type: string
    target_section_id?: string
    target_question_id?: string
  }
}

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

interface PreviewSurveyData {
  title: string
  description: string
  startDate: string
  deadline: string
  sections: SurveySection[]
  settings: SurveySettings
  projectData: {
    id: string
    name: string
    companies: {
      id: string
      name: string
      logo: string | null
    } | null
  } | null
}

// Componente para mostrar el flujo de lógica de salto
function SkipLogicFlowVisualizer({ 
  question, 
  rules, 
  currentAnswer 
}: { 
  question: Question
  rules: any[]
  currentAnswer: any 
}) {
  if (!rules || rules.length === 0) return null

  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-dashed border-blue-300">
      <div className="flex items-center gap-2 mb-3">
        <SkipForward className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-semibold text-blue-800">Flujo de Lógica de Salto</span>
      </div>
      
      <div className="space-y-3">
        {rules.map((rule, index) => {
          const isActive = rule.enabled !== false
          const isConditionMet = currentAnswer !== undefined && currentAnswer !== null && currentAnswer !== ""
          
          return (
            <div key={index} className={`p-3 rounded-lg border-2 transition-all duration-300 ${
              isActive 
                ? isConditionMet 
                  ? 'border-green-300 bg-green-50' 
                  : 'border-blue-300 bg-blue-50'
                : 'border-gray-300 bg-gray-50 opacity-60'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${
                  isActive 
                    ? isConditionMet 
                      ? 'bg-green-500' 
                      : 'bg-blue-500'
                    : 'bg-gray-400'
                }`}></div>
                <span className={`text-xs font-medium ${
                  isActive 
                    ? isConditionMet 
                      ? 'text-green-700' 
                      : 'text-blue-700'
                    : 'text-gray-500'
                }`}>
                  Regla {index + 1} {!isActive && '(Deshabilitada)'}
                </span>
              </div>
              
              <div className="text-xs text-gray-600 space-y-1">
                <div>
                  <span className="font-medium">Condición:</span> Si la respuesta {rule.operator} "{rule.value}"
                </div>
                <div>
                  <span className="font-medium">Acción:</span> Ir a sección objetivo
                </div>
                {rule.targetQuestionText && (
                  <div>
                    <span className="font-medium">Pregunta específica:</span> {rule.targetQuestionText}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PreviewSurveyPageContent() {
  const router = useRouter()
  const [surveyData, setSurveyData] = useState<PreviewSurveyData | null>(null)
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [answers, setAnswers] = useState<{ [questionId: string]: any }>({})
  const [submissionStatus, setSubmissionStatus] = useState<"idle" | "success" | "error">("idle")
  const [validationErrors, setValidationErrors] = useState<{ [questionId: string]: string }>({})
  const [loading, setLoading] = useState(true)
  const [skipLogicNotification, setSkipLogicNotification] = useState<{
    message: string
    type: "info" | "success" | "warning"
    show: boolean
  } | null>(null)
  const [skipLogicHistory, setSkipLogicHistory] = useState<Array<{
    questionText: string
    answer: string
    targetSection: string
    targetQuestion?: string
    timestamp: Date
  }>>([])

  useEffect(() => {
    const storedData = localStorage.getItem("surveyPreviewData")
    if (storedData) {
      const parsedData = JSON.parse(storedData)
      console.log("🔍 Datos cargados del preview:", parsedData)
      
      // Debug: Verificar estructura de skip logic
      if (parsedData.sections) {
        console.log("🔍 Verificando estructura de skip logic en secciones:")
        parsedData.sections.forEach((section: any, sectionIndex: number) => {
          console.log(`  Sección ${sectionIndex + 1}: "${section.title}"`)
          if (section.questions) {
            section.questions.forEach((question: any, questionIndex: number) => {
              if (question.config?.skipLogic?.enabled) {
                console.log(`    Pregunta ${questionIndex + 1}: "${question.text}"`)
                console.log(`      Skip Logic:`, question.config.skipLogic)
                console.log(`      Reglas:`, question.config.skipLogic.rules)
              }
            })
          }
        })
      }
      
      setSurveyData(parsedData)
    } else {
      router.push("/")
    }
    setLoading(false)
  }, [router])

  const handleAnswerChange = useCallback((questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    setValidationErrors((prev) => {
      const newErrors = { ...prev }
      delete newErrors[questionId]
      return newErrors
    })
  }, [])

  const currentSection = surveyData?.sections[currentSectionIndex]
  const totalSections = surveyData?.sections.length || 0

  // Función para probar la lógica de salto
  const testSkipLogic = useCallback(() => {
    if (!currentSection) return
    
    console.log("🧪 Probando lógica de salto...")
    console.log("🔍 Sección actual:", currentSection.title)
    console.log("🔍 Preguntas con lógica de salto:")
    
    currentSection.questions.forEach((question, index) => {
      if (question.config?.skipLogic?.enabled && question.config.skipLogic.rules) {
        console.log(`  ${index + 1}. "${question.text}"`)
        console.log(`     Reglas:`, question.config.skipLogic.rules)
        console.log(`     Respuesta actual:`, answers[question.id])
      }
    })
    
    // Mostrar notificación de prueba
    setSkipLogicNotification({
      message: "Lógica de salto verificada. Revisa la consola para más detalles.",
      type: "info",
      show: true
    })
    
    setTimeout(() => {
      setSkipLogicNotification(null)
    }, 3000)
  }, [currentSection, answers])

  const validateCurrentSection = useCallback(() => {
    if (!currentSection) return true

    let isValid = true
    const newErrors: { [questionId: string]: string } = {}

    currentSection.questions.forEach((question) => {
      if (question.required && (answers[question.id] === undefined || answers[question.id] === null || answers[question.id] === "")) {
        newErrors[question.id] = "Esta pregunta es obligatoria."
        isValid = false
      }
    })

    setValidationErrors(newErrors)
    return isValid
  }, [currentSection, answers])

  const handleNextSection = useCallback(() => {
    if (!currentSection) return

    if (!validateCurrentSection()) {
      return
    }

    console.log("🔍 Verificando lógica de salto en sección:", currentSection.title)
    console.log("🔍 Respuestas actuales:", answers)
    
    // Verificar skip logic en todas las preguntas de la sección actual
    for (const question of currentSection.questions) {
      console.log(`🔍 Revisando pregunta: "${question.text}" (ID: ${question.id})`)
      console.log(`🔍 Config de lógica de salto:`, question.config?.skipLogic)
      
      if (question.config?.skipLogic?.enabled && question.config.skipLogic.rules) {
        const answer = answers[question.id]
        console.log(`🔍 Respuesta para pregunta "${question.text}":`, answer)
        
        if (answer !== undefined && answer !== null && answer !== "") {
          console.log(`🔍 Evaluando reglas para respuesta: "${answer}"`)
          
          for (const rule of question.config.skipLogic.rules) {
            console.log(`🔍 Evaluando regla:`, rule)
            
            // Verificar si la regla está habilitada
            if (rule.enabled === false) {
              console.log(`⚠️ Regla deshabilitada, saltando...`)
              continue
            }
            
            // Verificar que la regla tenga los campos necesarios
            if (!rule.targetSectionId) {
              console.log(`⚠️ Regla sin targetSectionId, saltando...`)
              continue
            }

            try {
              let conditionMet = false

              // Evaluar condición de manera más robusta
              if (rule.operator === "equals") {
                if (Array.isArray(answer)) {
                  // Para checkbox, verificar si el valor está en el array
                  conditionMet = answer.includes(rule.value)
                } else {
                  conditionMet = String(answer) === String(rule.value)
                }
              } else if (rule.operator === "not_equals") {
                if (Array.isArray(answer)) {
                  conditionMet = !answer.includes(rule.value)
                } else {
                  conditionMet = String(answer) !== String(rule.value)
                }
              } else if (rule.operator === "contains") {
                if (Array.isArray(answer)) {
                  // Para checkbox, verificar si el valor está en el array
                  conditionMet = answer.includes(rule.value)
                } else {
                  conditionMet = String(answer).includes(String(rule.value))
                }
              } else if (rule.operator === "not_contains") {
                if (Array.isArray(answer)) {
                  conditionMet = !answer.includes(rule.value)
                } else {
                  conditionMet = !String(answer).includes(String(rule.value))
                }
              } else if (rule.operator === "greater_than") {
                conditionMet = Number(answer) > Number(rule.value)
              } else if (rule.operator === "less_than") {
                conditionMet = Number(answer) < Number(rule.value)
              } else if (rule.operator === "is_empty") {
                conditionMet = !answer || (Array.isArray(answer) ? answer.length === 0 : String(answer).trim() === "")
              } else if (rule.operator === "is_not_empty") {
                conditionMet = answer && (Array.isArray(answer) ? answer.length > 0 : String(answer).trim() !== "")
              }
              
              console.log(`🔍 Evaluando: ${rule.operator} "${rule.value}" vs respuesta "${answer}" = ${conditionMet}`)
              console.log(`🔍 Tipos: valor="${typeof rule.value}", respuesta="${typeof answer}"`)

              console.log(`🔍 Evaluando regla: ${rule.operator} "${rule.value}" vs respuesta "${answer}" = ${conditionMet}`)

              if (conditionMet) {
                console.log(`✅ Condición cumplida para pregunta "${question.text}": ${rule.operator} ${rule.value}`)
                
                // Encontrar la sección objetivo
                const targetSection = surveyData?.sections.find(s => s.id === rule.targetSectionId)
                const targetSectionTitle = targetSection?.title || "Sección desconocida"
                
                // Agregar al historial de lógica de salto
                setSkipLogicHistory(prev => [...prev, {
                  questionText: question.text,
                  answer: String(answer),
                  targetSection: targetSectionTitle,
                  targetQuestion: rule.targetQuestionText,
                  timestamp: new Date()
                }])
                
                // Mostrar notificación de lógica de salto
                setSkipLogicNotification({
                  message: `Lógica de salto aplicada: "${question.text}" → ${rule.operator} "${rule.value}" → ${targetSectionTitle}`,
                  type: "success",
                  show: true
                })
                
                // Ocultar notificación después de 4 segundos
                setTimeout(() => {
                  setSkipLogicNotification(null)
                }, 4000)
                
                // Si hay una sección objetivo, calcular el índice
                if (rule.targetSectionId) {
                  const foundSectionIndex = surveyData?.sections.findIndex(s => s.id === rule.targetSectionId)
                  if (foundSectionIndex !== -1) {
                    console.log(`🔄 Saltando a sección: ${surveyData?.sections[foundSectionIndex]?.title}`)
                    
                    // Si hay una pregunta específica objetivo, guardarla
                    if (rule.targetQuestionId) {
                      console.log(`🎯 Saltando a pregunta específica: ${rule.targetQuestionId}`)
                    }
                    
                    // Aplicar el salto inmediatamente
                    setCurrentSectionIndex(foundSectionIndex)
                    
                    // Si hay una pregunta específica, hacer scroll a ella después de un breve delay
                    if (rule.targetQuestionId) {
                      setTimeout(() => {
                        const questionElement = document.getElementById(`question-${rule.targetQuestionId}`)
                        if (questionElement) {
                          questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          questionElement.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-50', 'animate-pulse')
                          setTimeout(() => {
                            questionElement.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-50', 'animate-pulse')
                          }, 3000)
                        }
                      }, 100)
                    }
                    
                    return // Salir después de aplicar el primer salto válido
                  } else {
                    console.warn(`⚠️ Sección objetivo no encontrada: ${rule.targetSectionId}`)
                  }
                }
              }
            } catch (error) {
              console.error(`❌ Error evaluando lógica de salto para pregunta "${question.text}":`, error)
            }
          }
        }
      }
    }

    // Si no se aplicó ningún salto, ir a la siguiente sección
    if (currentSectionIndex < totalSections - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1)
    } else {
      setSubmissionStatus("success")
    }
  }, [currentSection, answers, currentSectionIndex, totalSections, surveyData])

  const handlePreviousSection = useCallback(() => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex((prev) => prev - 1)
    }
  }, [currentSectionIndex])

  const renderQuestion = useCallback(
    (question: Question, questionIndex: number) => {
      const commonProps = {
        id: question.id,
        className: "w-full",
        value: answers[question.id] || "",
        onChange: (e: any) => handleAnswerChange(question.id, e.target.value),
        placeholder: "Tu respuesta...",
        disabled: false,
      }

      const error = validationErrors[question.id]
      const hasSkipLogic = question.config?.skipLogic?.enabled && question.config.skipLogic.rules?.length > 0

      const renderInput = () => {
        switch (question.type) {
          case "text":
            return <Input {...commonProps} />
          case "textarea":
            return <Textarea {...commonProps} rows={4} />
          case "multiple_choice":
            return (
              <RadioGroup
                value={answers[question.id] || ""}
                onValueChange={(value) => handleAnswerChange(question.id, value)}
                className="space-y-2"
              >
                {(question.options || []).map((option, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`${question.id}-option-${idx}`} />
                    <Label htmlFor={`${question.id}-option-${idx}`}>{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            )
          case "checkbox":
            return (
              <div className="space-y-2">
                {(question.options || []).map((option, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${question.id}-option-${idx}`}
                      checked={(answers[question.id] || []).includes(option)}
                      onCheckedChange={(checked) => {
                        const currentAnswers = new Set(answers[question.id] || [])
                        if (checked) {
                          currentAnswers.add(option)
                        } else {
                          currentAnswers.delete(option)
                        }
                        handleAnswerChange(question.id, Array.from(currentAnswers))
                      }}
                    />
                    <Label htmlFor={`${question.id}-option-${idx}`}>{option}</Label>
                  </div>
                ))}
              </div>
            )
          case "rating":
            return (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-muted-foreground">1</span>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => handleAnswerChange(question.id, rating)}
                      className={`p-2 rounded-lg transition-colors ${
                        answers[question.id] === rating
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      <Star className="h-5 w-5" fill={answers[question.id] === rating ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">5</span>
              </div>
            )
          case "slider":
            return (
              <div className="space-y-2">
                <Slider
                  value={[answers[question.id] || 1]}
                  onValueChange={(value) => handleAnswerChange(question.id, value[0])}
                  max={question.ratingScale || 10}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>1</span>
                  <span>{question.ratingScale || 10}</span>
                </div>
                <div className="text-center">
                  <span className="text-lg font-semibold text-primary">
                    {answers[question.id] || 1}
                  </span>
                </div>
              </div>
            )
          default:
            return <Input {...commonProps} placeholder="Tipo de pregunta no soportado en preview" disabled />
        }
      }

      return (
        <div key={question.id} id={`question-${question.id}`} className="mb-6 p-6 border-2 rounded-xl bg-gradient-to-br from-white to-gray-50 hover:shadow-lg transition-all duration-300">
          {/* Header de la pregunta */}
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                {questionIndex + 1}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="text-lg font-semibold text-gray-900 flex-1"
                  dangerouslySetInnerHTML={{ __html: question.text || "Pregunta sin texto" }}
                />
                {question.required && (
                  <Badge variant="destructive" className="text-xs">
                    Requerida
                  </Badge>
                )}
                {hasSkipLogic && (
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                    <SkipForward className="h-3 w-3 mr-1" />
                    Lógica de salto
                  </Badge>
                )}
              </div>
              
              {/* Indicador de lógica de salto */}
              {hasSkipLogic && (
                <Alert className="mt-3 bg-blue-50 border-blue-200">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800 text-sm">
                    Esta pregunta tiene lógica de salto configurada. Tu respuesta puede cambiar el flujo de la encuesta.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          {/* Contenido de la pregunta */}
          <div className="ml-11">
            <div className="mt-4">{renderInput()}</div>
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )
    },
    [answers, handleAnswerChange, validationErrors],
  )

  if (loading || !surveyData) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">Cargando encuesta...</h2>
        </div>
      </div>
    )
  }

  if (!currentSection) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md">
          <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4 text-gray-700">No hay secciones o preguntas para previsualizar.</h2>
          <Button onClick={() => router.push(`/projects/${surveyData.projectData?.id}/create-survey`)}>
            Volver al editor de encuestas
          </Button>
        </div>
      </div>
    )
  }

  const progress = ((currentSectionIndex + 1) / totalSections) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col items-center p-4 sm:p-8">
      {/* Notificación de Lógica de Salto */}
      {skipLogicNotification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl max-w-md transition-all duration-500 transform ${
          skipLogicNotification.type === "success" 
            ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white" 
            : skipLogicNotification.type === "warning"
            ? "bg-gradient-to-r from-yellow-500 to-orange-600 text-white"
            : "bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
            <div className="flex-1">
              <div className="font-medium text-sm">{skipLogicNotification.message}</div>
              <div className="text-xs opacity-90 mt-1">Lógica de salto aplicada</div>
            </div>
          </div>
        </div>
      )}

      {/* Header principal */}
      <div className="w-full max-w-4xl mb-6">
        <Card className="border-0 shadow-xl bg-gradient-to-r from-white to-blue-50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" onClick={() => router.back()} className="text-muted-foreground hover:bg-blue-100">
                <ArrowLeft className="h-5 w-5 mr-2" /> Volver
              </Button>
              
                             {/* Botones de utilidad */}
               <div className="flex items-center gap-2">
                 <Button
                   variant="outline"
                   onClick={testSkipLogic}
                   className="text-purple-600 border-purple-200 hover:bg-purple-50"
                 >
                   <Zap className="h-4 w-4 mr-2" />
                   Probar Lógica
                 </Button>
                 
                 {skipLogicHistory.length > 0 && (
                   <Button
                     variant="outline"
                     onClick={() => setSkipLogicHistory([])}
                     className="text-blue-600 border-blue-200 hover:bg-blue-50"
                   >
                     <Navigation className="h-4 w-4 mr-2" />
                     Limpiar historial ({skipLogicHistory.length})
                   </Button>
                 )}
                 
                 <Button
                   onClick={() => {
                     console.log("🔍 Estado actual de respuestas:", answers)
                     console.log("🔍 Sección actual:", currentSection)
                     if (currentSection?.questions) {
                       currentSection.questions.forEach((q, idx) => {
                         if (q.config?.skipLogic?.enabled) {
                           console.log(`🔍 Pregunta ${idx + 1}: "${q.text}"`)
                           console.log(`   Respuesta:`, answers[q.id])
                           console.log(`   Skip Logic:`, q.config.skipLogic)
                         }
                       })
                     }
                   }}
                   variant="outline"
                   size="sm"
                   className="bg-green-500 text-white hover:bg-green-600 border-green-500"
                 >
                   <Info className="h-4 w-4 mr-2" />
                   Debug Respuestas
                 </Button>
               </div>
            </div>
            
            <div className="text-center">
              <CardTitle className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {surveyData.title}
              </CardTitle>
              {surveyData.description && (
                <p className="text-lg text-muted-foreground mb-4">{surveyData.description}</p>
              )}
              
              {/* Barra de progreso mejorada */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Progreso de la encuesta</span>
                  <span className="text-sm font-medium text-gray-700">
                    {currentSectionIndex + 1} de {totalSections}
                  </span>
                </div>
                <Progress value={progress} className="w-full h-3" />
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>Inicio</span>
                  <span>Final</span>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Contenido principal */}
      <Card className="w-full max-w-4xl shadow-xl border-0 bg-white">
        <CardContent className="p-8">
          {/* Header de la sección */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-3">
              <Target className="h-4 w-4" />
              Sección {currentSectionIndex + 1}
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">{currentSection.title}</h2>
            {currentSection.description && (
              <p className="text-lg text-muted-foreground">{currentSection.description}</p>
            )}
          </div>

          <Separator className="my-8" />

          {/* Preguntas */}
          <div className="space-y-6">
            {currentSection.questions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">Esta sección no tiene preguntas</h3>
                <p className="text-muted-foreground">No hay preguntas configuradas para esta sección.</p>
              </div>
                          ) : (
                currentSection.questions.map((question, qIndex) => {
                  const hasSkipLogic = question.config?.skipLogic?.enabled && question.config.skipLogic.rules?.length > 0
                  return (
                    <div key={question.id}>
                      {renderQuestion(question, qIndex)}
                      {hasSkipLogic && (
                        <SkipLogicFlowVisualizer
                          question={question}
                          rules={question.config?.skipLogic?.rules || []}
                          currentAnswer={answers[question.id]}
                        />
                      )}
                    </div>
                  )
                })
              )}
          </div>

          {/* Navegación */}
          <div className="flex justify-between mt-12 pt-8 border-t">
            <Button 
              onClick={handlePreviousSection} 
              disabled={currentSectionIndex === 0} 
              variant="outline"
              className="px-6 py-3 text-base"
            >
              <ArrowLeft className="h-5 w-5 mr-2" /> Anterior
            </Button>
            
            <Button 
              onClick={handleNextSection}
              className="px-8 py-3 text-base bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {currentSectionIndex === totalSections - 1 ? "Finalizar Encuesta" : "Siguiente Sección"}{" "}
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Historial de lógica de salto flotante */}
      {skipLogicHistory.length > 0 && (
        <div className="fixed bottom-4 left-4 z-40">
          <Card className="w-80 shadow-2xl border-blue-200 bg-blue-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-blue-800">
                <Zap className="h-4 w-4" />
                Historial de Lógica de Salto
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {skipLogicHistory.slice(-5).reverse().map((item, index) => (
                  <div key={index} className="p-2 bg-white rounded-lg border border-blue-200">
                    <div className="text-xs text-blue-600 font-medium">{item.questionText}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Respuesta: <span className="font-medium">{item.answer}</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      → {item.targetSection}
                      {item.targetQuestion && (
                        <span className="text-blue-600"> → {item.targetQuestion}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function SurveyPreviewPage() {
  return <PreviewSurveyPageContent />
}
