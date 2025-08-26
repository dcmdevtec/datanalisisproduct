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
import { ArrowLeft, ArrowRight, Loader2, Star, CheckCircle, AlertCircle, Info, Target } from "lucide-react"
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



function PreviewSurveyPageContent() {
  const router = useRouter()
  const [surveyData, setSurveyData] = useState<PreviewSurveyData | null>(null)
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [answers, setAnswers] = useState<{ [questionId: string]: any }>({})
  const [submissionStatus, setSubmissionStatus] = useState<"idle" | "success" | "error">("idle")
  const [validationErrors, setValidationErrors] = useState<{ [questionId: string]: string }>({})
  const [skipLogicHistory, setSkipLogicHistory] = useState<string[]>([])
  const [skipLogicNotification, setSkipLogicNotification] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)


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

  // Cargar respuestas guardadas al inicializar
  useEffect(() => {
    if (surveyData) {
      const storedAnswers = localStorage.getItem("surveyPreviewAnswers")
      if (storedAnswers) {
        try {
          const parsedAnswers = JSON.parse(storedAnswers)
          console.log("🔄 Respuestas cargadas del localStorage:", parsedAnswers)
          setAnswers(parsedAnswers)
        } catch (error) {
          console.error("❌ Error cargando respuestas guardadas:", error)
        }
      }
    }
  }, [surveyData])

  // Guardar respuestas automáticamente cuando cambien
  useEffect(() => {
    if (surveyData && Object.keys(answers).length > 0) {
      try {
        localStorage.setItem("surveyPreviewAnswers", JSON.stringify(answers))
        console.log("💾 Respuestas guardadas en localStorage:", answers)
      } catch (error) {
        console.error("❌ Error guardando respuestas:", error)
      }
    }
  }, [answers, surveyData])

  // Función para evaluar las condiciones de visualización
  const shouldShowQuestion = useCallback((question: Question): boolean => {
    // Si no hay lógica de visualización habilitada, mostrar la pregunta
    if (!question.config?.displayLogic?.enabled) {
      return true
    }

    const { conditions } = question.config.displayLogic
    
    // Si no hay condiciones, mostrar la pregunta
    if (!conditions || conditions.length === 0) {
      return true
    }

    // Debug: Mostrar información de la lógica de visualización
    console.log(`🔍 Evaluando lógica de visualización para pregunta "${question.text}":`)
    console.log(`   Condiciones:`, conditions)
    console.log(`   Respuestas actuales:`, answers)

    // Evaluar cada condición
    for (const condition of conditions) {
      const { questionId, operator, value } = condition
      const answer = answers[questionId]
      
      console.log(`   Evaluando condición: ${questionId} ${operator} ${value}`)
      console.log(`   Respuesta encontrada:`, answer)
      
      if (answer === undefined || answer === null || answer === "") {
        console.log(`   ❌ No hay respuesta para ${questionId}, ocultando pregunta`)
        return false // Si no hay respuesta, no mostrar la pregunta
      }

      let conditionMet = false
      
      switch (operator) {
        case "equals":
          conditionMet = answer === value
          break
        case "not_equals":
          conditionMet = answer !== value
          break
        case "contains":
          conditionMet = Array.isArray(answer) ? answer.includes(value) : String(answer).includes(value)
          break
        case "not_contains":
          conditionMet = Array.isArray(answer) ? !answer.includes(value) : !String(answer).includes(value)
          break
        case "greater_than":
          conditionMet = Number(answer) > Number(value)
          break
        case "less_than":
          conditionMet = Number(answer) < Number(value)
          break
        case "greater_than_or_equal":
          conditionMet = Number(answer) >= Number(value)
          break
        case "less_than_or_equal":
          conditionMet = Number(answer) <= Number(value)
          break
        default:
          conditionMet = false
      }

      console.log(`   Condición cumplida: ${conditionMet}`)

      // Si alguna condición no se cumple, no mostrar la pregunta
      if (!conditionMet) {
        console.log(`   ❌ Condición no cumplida, ocultando pregunta`)
        return false
      }
    }

    console.log(`   ✅ Todas las condiciones cumplidas, mostrando pregunta`)
    // Si todas las condiciones se cumplen, mostrar la pregunta
    return true
  }, [answers])

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

  // Obtener colores del tema de la encuesta
  const getThemeColors = () => {
    if (surveyData?.settings?.theme) {
      return {
        primary: surveyData.settings.theme.primaryColor || '#10b981', // verde por defecto
        background: surveyData.settings.theme.backgroundColor || '#f0fdf4',
        text: surveyData.settings.theme.textColor || '#1f2937'
      }
    }
    return {
      primary: '#10b981',
      background: '#f0fdf4', 
      text: '#1f2937'
    }
  }

  const themeColors = getThemeColors()



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

              // Verificar skip logic en todas las preguntas de la sección actual
     for (const question of currentSection.questions) {
       if (question.config?.skipLogic?.enabled && question.config.skipLogic.rules) {
         const answer = answers[question.id]
         
         if (answer !== undefined && answer !== null && answer !== "") {
           for (const rule of question.config.skipLogic.rules) {
             // Verificar si la regla está habilitada
             if (rule.enabled === false) {
               continue
             }
             
             // Verificar que la regla tenga los campos necesarios
             if (!rule.targetSectionId) {
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

               if (conditionMet) {
                 // Si hay una sección objetivo, calcular el índice
                 if (rule.targetSectionId) {
                   const foundSectionIndex = surveyData?.sections.findIndex(s => s.id === rule.targetSectionId)
                   if (foundSectionIndex !== -1) {
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
      // Verificar si la pregunta debe mostrarse según la lógica de visualización
      if (!shouldShowQuestion(question)) {
        return null // No renderizar la pregunta si no debe mostrarse
      }

      const commonProps = {
        id: question.id,
        className: "w-full",
        value: answers[question.id] || "",
        onChange: (e: any) => handleAnswerChange(question.id, e.target.value),
        placeholder: "Tu respuesta...",
        disabled: false,
      }

      const error = validationErrors[question.id]

      const renderInput = () => {
        switch (question.type) {
          case "text":
          case "single_textbox":
            return <Input {...commonProps} />
          case "textarea":
          case "comment_box":
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
          case "dropdown":
            return (
              <Select value={answers[question.id] || ""} onValueChange={(value) => handleAnswerChange(question.id, value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una opción..." />
                </SelectTrigger>
                <SelectContent>
                  {(question.options || []).map((option, idx) => (
                    <SelectItem key={idx} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          case "rating":
          case "star_rating":
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
          case "scale":
            return (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => handleAnswerChange(question.id, scale)}
                      className={`w-10 h-10 rounded-full transition-colors ${
                        answers[question.id] === scale
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      {scale}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Muy en desacuerdo</span>
                  <span>Muy de acuerdo</span>
                </div>
              </div>
            )
          case "likert":
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-5 gap-2">
                  {["Muy en desacuerdo", "En desacuerdo", "Neutral", "De acuerdo", "Muy de acuerdo"].map((option, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAnswerChange(question.id, option)}
                      className={`p-3 text-sm rounded-lg transition-colors ${
                        answers[question.id] === option
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )
          case "net_promoter":
            return (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => handleAnswerChange(question.id, score)}
                      className={`w-12 h-12 rounded-full transition-colors ${
                        answers[question.id] === score
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Muy improbable</span>
                  <span>Muy probable</span>
                </div>
              </div>
            )
          case "date":
            return (
              <Input
                type="date"
                value={answers[question.id] || ""}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                className="w-full"
              />
            )
          case "time":
            return (
              <Input
                type="time"
                value={answers[question.id] || ""}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                className="w-full"
              />
            )
          case "email":
            return (
              <Input
                type="email"
                value={answers[question.id] || ""}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                placeholder="ejemplo@email.com"
                className="w-full"
              />
            )
          case "phone":
            return (
              <Input
                type="tel"
                value={answers[question.id] || ""}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="w-full"
              />
            )
          case "number":
            return (
              <Input
                type="number"
                value={answers[question.id] || ""}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                placeholder="Ingresa un número"
                className="w-full"
              />
            )
          case "file":
          case "image_upload":
            return (
              <div className="space-y-2">
                <Input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleAnswerChange(question.id, file.name)
                    }
                  }}
                  accept={question.type === "image_upload" ? "image/*" : "*"}
                  className="w-full"
                />
                {answers[question.id] && (
                  <p className="text-sm text-muted-foreground">Archivo seleccionado: {answers[question.id]}</p>
                )}
              </div>
            )
          case "signature":
            return (
              <div className="space-y-2">
                <div className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                  <p className="text-muted-foreground">Área para firma (simulado en preview)</p>
                </div>
                <p className="text-sm text-muted-foreground">En la encuesta real, aquí aparecería un canvas para firmar</p>
              </div>
            )
          case "demographic":
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Edad</Label>
                    <Input
                      type="number"
                      value={answers[`${question.id}_age`] || ""}
                      onChange={(e) => handleAnswerChange(`${question.id}_age`, e.target.value)}
                      placeholder="Edad"
                    />
                  </div>
                  <div>
                    <Label>Género</Label>
                    <Select value={answers[`${question.id}_gender`] || ""} onValueChange={(value) => handleAnswerChange(`${question.id}_gender`, value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="femenino">Femenino</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                        <SelectItem value="prefiero_no_decir">Prefiero no decir</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )
          case "contact_info":
            return (
              <div className="space-y-4">
                <div>
                  <Label>Nombre completo</Label>
                  <Input
                    value={answers[`${question.id}_name`] || ""}
                    onChange={(e) => handleAnswerChange(`${question.id}_name`, e.target.value)}
                    placeholder="Nombre completo"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={answers[`${question.id}_email`] || ""}
                    onChange={(e) => handleAnswerChange(`${question.id}_email`, e.target.value)}
                    placeholder="ejemplo@email.com"
                  />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input
                    type="tel"
                    value={answers[`${question.id}_phone`] || ""}
                    onChange={(e) => handleAnswerChange(`${question.id}_phone`, e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
            )
          case "ranking":
            return (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Ordena las opciones arrastrándolas (simulado en preview)</p>
                {(question.options || []).map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <span className="text-sm text-muted-foreground">#{idx + 1}</span>
                    <span>{option}</span>
                  </div>
                ))}
              </div>
            )
          case "matrix":
            return (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border p-2 bg-muted"></th>
                        {(question.matrixCols || []).map((col, idx) => (
                          <th key={idx} className="border p-2 bg-muted text-center">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(question.matrixRows || []).map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          <td className="border p-2 bg-muted font-medium">{row}</td>
                          {(question.matrixCols || []).map((col, colIdx) => (
                            <td key={colIdx} className="border p-2 text-center">
                              <input
                                type="radio"
                                name={`matrix-${question.id}-${rowIdx}`}
                                value={`${row}-${col}`}
                                onChange={(e) => handleAnswerChange(question.id, { ...answers[question.id], [row]: col })}
                                className="mr-2"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          case "multiple_textboxes":
            return (
              <div className="space-y-4">
                {(question.options || []).map((option, idx) => (
                  <div key={idx} className="space-y-2">
                    <Label>{option}</Label>
                    <Input
                      value={answers[`${question.id}_${idx}`] || ""}
                      onChange={(e) => handleAnswerChange(`${question.id}_${idx}`, e.target.value)}
                      placeholder={`Respuesta para ${option}`}
                    />
                  </div>
                ))}
              </div>
            )
          default:
            return <Input {...commonProps} placeholder={`Tipo de pregunta "${question.type}" no soportado en preview`} disabled />
        }
      }

      return (
        <div key={question.id} id={`question-${question.id}`} className="mb-8 p-8 border-2 rounded-2xl bg-gradient-to-br from-white via-gray-50/50 to-green-50/30 hover:shadow-2xl transition-all duration-500 transform hover:scale-[1.02] border-gray-200/60">
          {/* Header de la pregunta */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0">
              <div 
                className="w-12 h-12 text-white rounded-2xl flex items-center justify-center text-lg font-bold shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.primary}dd, ${themeColors.primary}bb)`
                }}
              >
                {questionIndex + 1}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="text-xl font-semibold text-gray-900 flex-1 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: question.text || "Pregunta sin texto" }}
                />
                <div className="flex gap-2">
                  {question.required && (
                    <Badge variant="destructive" className="text-xs px-3 py-1 rounded-full">
                      Requerida
                    </Badge>
                  )}
                  {question.config?.displayLogic?.enabled && (
                    <Badge variant="secondary" className="text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-700 border-blue-200">
                      Condicional
                    </Badge>
                  )}
                </div>
              </div>
              
              
            </div>
          </div>

          {/* Contenido de la pregunta */}
          <div className="ml-16">
            <div className="mt-6">{renderInput()}</div>
            {error && (
              <div className="mt-4 p-4 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-xl">
                <div className="flex items-center gap-3 text-red-700">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )
    },
    [answers, handleAnswerChange, validationErrors, shouldShowQuestion],
  )

  if (loading || !surveyData) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-green-50 to-emerald-100">
        <div className="text-center">
          <div className="relative mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 via-emerald-600 to-teal-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xl">
              <Loader2 className="h-10 w-10 animate-spin text-white" />
            </div>
            <div className="absolute -inset-4 bg-gradient-to-br from-green-500/20 to-emerald-600/20 rounded-3xl blur-xl animate-pulse"></div>
          </div>
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Cargando encuesta...</h2>
          <p className="text-muted-foreground">Preparando la vista previa para ti</p>
        </div>
      </div>
    )
  }

  if (!currentSection) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-slate-50 via-green-50 to-emerald-100">
        <div className="max-w-lg">
          <div className="relative mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-300 to-gray-400 rounded-2xl flex items-center justify-center mx-auto shadow-xl">
              <AlertCircle className="h-12 w-12 text-gray-500" />
            </div>
            <div className="absolute -inset-6 bg-gradient-to-br from-gray-300/20 to-gray-400/20 rounded-3xl blur-xl"></div>
          </div>
          <h2 className="text-3xl font-bold mb-4 text-gray-700 bg-gradient-to-r from-gray-700 to-gray-500 bg-clip-text text-transparent">No hay secciones o preguntas para previsualizar.</h2>
          <p className="text-lg text-muted-foreground mb-6">La encuesta no tiene contenido configurado para mostrar en la vista previa.</p>
          <Button 
            onClick={() => router.push(`/projects/${surveyData.projectData?.id}/create-survey`)}
            className="px-8 py-3 text-base rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            style={{
              background: `linear-gradient(to right, ${themeColors.primary}, ${themeColors.primary}dd)`,
              color: 'white'
            }}
          >
            Volver al editor de encuestas
          </Button>
        </div>
      </div>
    )
  }

  const progress = ((currentSectionIndex + 1) / totalSections) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-100 flex flex-col items-center p-4 sm:p-8">
      {/* Header principal */}
      <div className="w-full max-w-5xl mb-8">
        <Card className="border-0 shadow-2xl bg-gradient-to-br from-white via-green-50/50 to-emerald-100/50 backdrop-blur-sm">
          <CardHeader className="pb-6">
            <div className="flex items-center justify-between mb-6">
              <Button 
                variant="ghost" 
                onClick={() => router.back()} 
                className="text-muted-foreground hover:bg-green-100/80 transition-all duration-200 rounded-xl px-4 py-2"
              >
                <ArrowLeft className="h-5 w-5 mr-2" /> Volver
              </Button>
              
              {/* Botón para limpiar respuestas (testing) */}
              <Button 
                variant="outline" 
                onClick={() => {
                  localStorage.removeItem("surveyPreviewAnswers")
                  setAnswers({})
                  console.log("🧹 Respuestas limpiadas")
                }}
                className="text-orange-600 border-orange-200 hover:bg-orange-50 transition-all duration-200 rounded-xl px-4 py-2"
              >
                Limpiar Respuestas
              </Button>
            </div>
            
            <div className="text-center">
              <CardTitle 
                className="text-5xl font-bold mb-4 bg-clip-text text-transparent"
                style={{
                  background: `linear-gradient(to right, ${themeColors.primary}, ${themeColors.primary}dd, ${themeColors.primary}bb)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                {surveyData.title}
              </CardTitle>
              {surveyData.description && (
                <p className="text-xl text-muted-foreground mb-6 max-w-3xl mx-auto leading-relaxed">{surveyData.description}</p>
              )}
              
              {/* Barra de progreso mejorada */}
              <div className="mt-8 max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700">Progreso de la encuesta</span>
                  <span className="text-sm font-semibold text-gray-700">
                    {currentSectionIndex + 1} de {totalSections}
                  </span>
                </div>
                <div className="relative">
                  <Progress 
                    value={progress} 
                    className="w-full h-4 rounded-full" 
                    style={{
                      '--progress-background': themeColors.primary
                    } as React.CSSProperties}
                  />
                  <div 
                    className="absolute inset-0 rounded-full opacity-30"
                    style={{
                      background: `linear-gradient(to right, ${themeColors.primary}40, ${themeColors.primary}60)`
                    }}
                  ></div>
                </div>
                <div className="flex justify-between mt-3 text-xs text-muted-foreground font-medium">
                  <span>Inicio</span>
                  <span>Final</span>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Contenido principal */}
      <Card className="w-full max-w-5xl shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
        <CardContent className="p-10">
          {/* Header de la sección */}
          <div className="text-center mb-10">
            <div 
              className="inline-flex items-center gap-3 px-6 py-3 rounded-full text-sm font-semibold mb-4 shadow-sm"
              style={{
                background: `linear-gradient(to right, ${themeColors.primary}20, ${themeColors.primary}30)`,
                color: themeColors.primary
              }}
            >
              <Target className="h-4 w-4" />
              Sección {currentSectionIndex + 1}
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-3 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">{currentSection.title}</h2>
            {currentSection.description && (
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">{currentSection.description}</p>
            )}
          </div>

          {/* Indicador de lógica de visualización */}
          {currentSection.questions.some(q => q.config?.displayLogic?.enabled) && (
            <Alert className="mb-4 border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Lógica de Visualización Activa:</strong> Algunas preguntas en esta sección solo se mostrarán cuando se cumplan ciertas condiciones.
                <div className="mt-2 text-sm">
                  <strong>Preguntas con condiciones:</strong>
                  {currentSection.questions
                    .filter(q => q.config?.displayLogic?.enabled)
                    .map((q, idx) => (
                      <div key={q.id} className="ml-4 text-blue-700">
                        • {q.text.substring(0, 50)}...
                      </div>
                    ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Progress value={(currentSectionIndex + 1) / currentSection.questions.length * 100} className="mb-4" />

          <Separator className="my-10" />

          {/* Preguntas */}
          <div className="space-y-8">
            {currentSection.questions.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <AlertCircle className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-3">Esta sección no tiene preguntas</h3>
                <p className="text-muted-foreground text-lg">No hay preguntas configuradas para esta sección.</p>
              </div>
            ) : (
                             currentSection.questions.map((question, qIndex) => (
                 <div key={question.id}>
                   {renderQuestion(question, qIndex)}
                 </div>
               ))
            )}
          </div>

          {/* Navegación */}
          <div className="flex justify-between mt-16 pt-10 border-t border-gray-200">
            <Button 
              onClick={handlePreviousSection} 
              disabled={currentSectionIndex === 0} 
              variant="outline"
              className="px-8 py-4 text-base rounded-xl border-2 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50"
            >
              <ArrowLeft className="h-5 w-5 mr-2" /> Anterior
            </Button>
            
            <Button 
              onClick={handleNextSection}
              className="px-10 py-4 text-base rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              style={{
                background: `linear-gradient(to right, ${themeColors.primary}, ${themeColors.primary}dd, ${themeColors.primary}bb)`,
                color: 'white'
              }}
            >
              {currentSectionIndex === totalSections - 1 ? "Finalizar Encuesta" : "Siguiente Sección"}{" "}
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>


    </div>
  )
}

export default function SurveyPreviewPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-100">
      <PreviewSurveyPageContent />
    </div>
  )
}
