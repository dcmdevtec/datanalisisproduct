"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import dynamic from "next/dynamic"
import { useCallback } from "react"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowRight, Loader2, Star } from "lucide-react"
import { Grip } from "lucide-react" // Import Grip component

const MapWithDrawing = dynamic(() => import("@/components/map-with-drawing"), {
  ssr: false,
})

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
        condition: string // e.g., "answer === 'Yes'" or "answer.includes('Option A')"
        targetSectionId: string // ID of the section to jump to
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
  sections: SurveySection[] // Now sections
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedData = localStorage.getItem("surveyPreviewData")
    if (storedData) {
      setSurveyData(JSON.parse(storedData))
    } else {
      router.push("/") // Redirect if no preview data
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

  const getRatingEmojis = (scale: number) => {
    const emojiSets = {
      3: ["😞", "😐", "😊"],
      4: ["😞", "😐", "🙂", "😊"],
      5: ["😞", "😕", "😐", "🙂", "😊"],
      6: ["😞", "😕", "😐", "🙂", "😊", "😍"],
      7: ["😞", "😕", "😐", "🙂", "😊", "😍", "🤩"],
      10: ["😞", "😕", "😐", "🙂", "😊", "😍", "🤩", "🥰", "😘", "🤗"],
    }
    return emojiSets[scale as keyof typeof emojiSets] || emojiSets[5]
  }

  const validateCurrentSection = useCallback(() => {
    if (!currentSection) return true

    let isValid = true
    const newErrors: { [questionId: string]: string } = {}

    currentSection.questions.forEach((question) => {
      // Check display logic first
      if (question.config?.displayLogic?.enabled) {
        const shouldDisplay = question.config.displayLogic.conditions.every((condition) => {
          const answeredQuestion = currentSection.questions.find((q) => q.id === condition.questionId)
          if (!answeredQuestion) return true // If condition question not found, assume true

          const answer = answers[answeredQuestion.id]
          if (answer === undefined || answer === null || answer === "") return false // If condition question not answered, don't display

          try {
            // Simple evaluation for preview. In production, use a safer parser.
            // This is a simplified example. Real-world logic might need more robust parsing.
            if (typeof answer === "string" && condition.operator === "includes") {
              return answer.includes(condition.value)
            }
            return eval(`"${answer}" ${condition.operator} "${condition.value}"`)
          } catch (e) {
            console.warn("Error evaluating display logic condition:", e)
            return false
          }
        })
        if (!shouldDisplay) {
          // If question should not be displayed, it's not required
          return
        }
      }

      // Now check validation rules for displayed questions
      if (
        question.required &&
        (answers[question.id] === undefined || answers[question.id] === null || answers[question.id] === "")
      ) {
        newErrors[question.id] = "Esta pregunta es obligatoria."
        isValid = false
      } else if (answers[question.id] !== undefined && answers[question.id] !== null && answers[question.id] !== "") {
        const value = answers[question.id]
        const validation = question.config?.validation

        if (validation?.minLength && String(value).length < validation.minLength) {
          newErrors[question.id] = validation.customMessage || `Debe tener al menos ${validation.minLength} caracteres.`
          isValid = false
        }
        if (validation?.maxLength && String(value).length > validation.maxLength) {
          newErrors[question.id] = validation.customMessage || `No debe exceder los ${validation.maxLength} caracteres.`
          isValid = false
        }
        if (validation?.pattern && !new RegExp(validation.pattern).test(String(value))) {
          newErrors[question.id] = validation.customMessage || "El formato no es válido."
          isValid = false
        }
      }
    })

    setValidationErrors(newErrors)
    return isValid
  }, [currentSection, answers])

  const handleNextSection = useCallback(() => {
    if (!currentSection) return

    if (!validateCurrentSection()) {
      return // Stop if validation fails
    }

    let targetSectionIndex: number | null = null

    // Verificar skip logic en todas las preguntas de la sección actual
    for (const question of currentSection.questions) {
      if (question.config?.skipLogic?.enabled && question.config.skipLogic.rules) {
        const answer = answers[question.id]
        if (answer !== undefined && answer !== null && answer !== "") {
          for (const rule of question.config.skipLogic.rules) {
            try {
              let conditionMet = false

              // Evaluar condición de manera más segura
              if (rule.condition) {
                // Parsear la condición de manera más robusta
                if (rule.condition.includes("===")) {
                  const [, operator, value] =
                    rule.condition.match(/answer\s*(===|!==|==|!=)\s*['"]?([^'"]+)['"]?/) || []
                  if (operator === "===" || operator === "==") {
                    conditionMet = String(answer) === String(value)
                  } else if (operator === "!==" || operator === "!=") {
                    conditionMet = String(answer) !== String(value)
                  }
                } else if (rule.condition.includes("includes")) {
                  const valueMatch = rule.condition.match(/includes$$['"]([^'"]+)['"]$$/)
                  if (valueMatch && Array.isArray(answer)) {
                    conditionMet = answer.includes(valueMatch[1])
                  }
                } else if (rule.condition.includes("!includes")) {
                  const valueMatch = rule.condition.match(/!includes$$['"]([^'"]+)['"]$$/)
                  if (valueMatch && Array.isArray(answer)) {
                    conditionMet = !answer.includes(valueMatch[1])
                  }
                }
              }

              if (conditionMet) {
                if (rule.targetSectionId === "end_survey") {
                  // Finalizar encuesta
                  alert("¡Encuesta completada!")
                  router.push(`/projects/${surveyData?.projectData?.id}`)
                  return
                } else if (rule.targetSectionId) {
                  // Saltar a sección específica
                  const targetIndex = surveyData?.sections.findIndex((s) => s.id === rule.targetSectionId)
                  if (targetIndex !== undefined && targetIndex !== -1) {
                    targetSectionIndex = targetIndex
                    break // Usar la primera regla que coincida
                  }
                }
              }
            } catch (e) {
              console.warn("Error evaluating skip logic condition:", e)
            }
          }

          if (targetSectionIndex !== null) break // Salir del loop si encontramos un salto
        }
      }
    }

    if (targetSectionIndex === null && currentSection.skip_logic?.enabled) {
      const sectionSkipLogic = currentSection.skip_logic
      if (sectionSkipLogic.target_type === "section" && sectionSkipLogic.target_section_id) {
        const targetIndex = surveyData?.sections.findIndex((s) => s.id === sectionSkipLogic.target_section_id)
        if (targetIndex !== undefined && targetIndex !== -1) {
          targetSectionIndex = targetIndex
        }
      } else if (
        sectionSkipLogic.target_type === "question" &&
        sectionSkipLogic.target_section_id &&
        sectionSkipLogic.target_question_id
      ) {
        const targetIndex = surveyData?.sections.findIndex((s) => s.id === sectionSkipLogic.target_section_id)
        if (targetIndex !== undefined && targetIndex !== -1) {
          targetSectionIndex = targetIndex
          // TODO: Implementar salto a pregunta específica dentro de la sección
        }
      } else if (sectionSkipLogic.target_type === "end") {
        alert("¡Encuesta completada!")
        router.push(`/projects/${surveyData?.projectData?.id}`)
        return
      }
    }

    // Saltar a la sección objetivo o continuar secuencialmente
    if (targetSectionIndex !== null) {
      setCurrentSectionIndex(targetSectionIndex)
    } else if (currentSectionIndex < totalSections - 1) {
      setCurrentSectionIndex((prev) => prev + 1)
    } else {
      alert("¡Encuesta completada en la previsualización!")
      router.push(`/projects/${surveyData?.projectData?.id}`)
    }
  }, [
    currentSection,
    currentSectionIndex,
    totalSections,
    answers,
    surveyData?.sections,
    surveyData?.projectData?.id,
    validateCurrentSection,
    router,
  ])

  const handlePreviousSection = useCallback(() => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex((prev) => prev - 1)
    }
  }, [currentSectionIndex])

  const renderQuestion = useCallback(
    (question: Question, questionIndex: number) => {
      const isDisplayed = (() => {
        if (!question.config?.displayLogic?.enabled) return true

        return question.config.displayLogic.conditions.every((condition) => {
          // Find the question that the condition refers to, potentially in any section
          let answeredQuestion: Question | undefined
          let answeredValue: any

          for (const section of surveyData?.sections || []) {
            const q = section.questions.find((q) => q.id === condition.questionId)
            if (q) {
              answeredQuestion = q
              answeredValue = answers[q.id]
              break
            }
          }

          if (!answeredQuestion || answeredValue === undefined || answeredValue === null || answeredValue === "") {
            return false // If condition question not found or not answered, don't display
          }

          try {
            // Simple evaluation for preview. In production, use a safer parser.
            // This is a simplified example. Real-world logic might need more robust parsing.
            if (typeof answeredValue === "string" && condition.operator === "includes") {
              return answeredValue.includes(condition.value)
            }
            // For other operators, assume direct comparison or simple eval
            return eval(`"${answeredValue}" ${condition.operator} "${condition.value}"`)
          } catch (e) {
            console.warn("Error evaluating display logic condition:", e)
            return false
          }
        })
      })()

      if (!isDisplayed) return null

      const commonProps = {
        id: question.id,
        className: "w-full",
        value: answers[question.id] || "",
        onChange: (e: any) => handleAnswerChange(question.id, e.target.value),
        placeholder: "Tu respuesta...",
        disabled: false, // Enable for preview interaction
      }

      const error = validationErrors[question.id]

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
                {question.config?.allowOther && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value={question.config.otherText || "Otro (especificar)"}
                      id={`${question.id}-other`}
                    />
                    <Label htmlFor={`${question.id}-other`}>{question.config.otherText || "Otro (especificar)"}</Label>
                    {answers[question.id] === (question.config.otherText || "Otro (especificar)") && (
                      <Input
                        value={answers[`${question.id}-other-text`] || ""}
                        onChange={(e) => handleAnswerChange(`${question.id}-other-text`, e.target.value)}
                        placeholder="Especificar..."
                        className="ml-4 flex-1"
                      />
                    )}
                  </div>
                )}
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
                {question.config?.allowOther && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`${question.id}-other`}
                      checked={(answers[question.id] || []).includes(question.config.otherText || "Otro (especificar)")}
                      onCheckedChange={(checked) => {
                        const currentAnswers = new Set(answers[question.id] || [])
                        const otherOptionText = question.config.otherText || "Otro (especificar)"
                        if (checked) {
                          currentAnswers.add(otherOptionText)
                        } else {
                          currentAnswers.delete(otherOptionText)
                        }
                        handleAnswerChange(question.id, Array.from(currentAnswers))
                      }}
                    />
                    <Label htmlFor={`${question.id}-other`}>{question.config.otherText || "Otro (especificar)"}</Label>
                    {(answers[question.id] || []).includes(question.config.otherText || "Otro (especificar)") && (
                      <Input
                        value={answers[`${question.id}-other-text`] || ""}
                        onChange={(e) => handleAnswerChange(`${question.id}-other-text`, e.target.value)}
                        placeholder="Especificar..."
                        className="ml-4 flex-1"
                      />
                    )}
                  </div>
                )}
              </div>
            )
          case "dropdown":
            return (
              <Select
                value={answers[question.id] || ""}
                onValueChange={(value) => handleAnswerChange(question.id, value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una opción" />
                </SelectTrigger>
                <SelectContent>
                  {(question.options || []).map((option, idx) => (
                    <SelectItem key={idx} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                  {question.config?.allowOther && (
                    <SelectItem value={question.config.otherText || "Otro (especificar)"}>
                      {question.config.otherText || "Otro (especificar)"}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )
          case "scale":
            const min = question.config?.scaleMin || 1
            const max = question.config?.scaleMax || 5
            const labels = question.config?.scaleLabels || []
            return (
              <div className="flex items-center gap-2">
                {labels[0] && <span className="text-sm">{labels[0]}</span>}
                {Array.from({ length: max - min + 1 }, (_, i) => (
                  <Button
                    key={i}
                    variant={answers[question.id] === min + i ? "default" : "outline"}
                    onClick={() => handleAnswerChange(question.id, min + i)}
                    className="w-10 h-10 rounded-full"
                  >
                    {min + i}
                  </Button>
                ))}
                {labels[1] && <span className="text-sm">{labels[1]}</span>}
              </div>
            )
          case "matrix":
            const matrixRows = question.matrixRows || ["Fila 1"]
            const matrixCols = question.matrixCols || ["Columna 1"]
            return (
              <div className="overflow-x-auto">
                <table className="border w-full min-w-[500px]">
                  <thead>
                    <tr className="bg-muted">
                      <th className="border p-2 text-left"></th>
                      {matrixCols.map((col, idx) => (
                        <th key={idx} className="border p-2 text-center font-medium">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixRows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td className="border p-2 font-medium">{row}</td>
                        {matrixCols.map((col, cIdx) => (
                          <td key={cIdx} className="border p-2 text-center">
                            <input
                              type="radio"
                              name={`${question.id}-row-${rIdx}`}
                              checked={answers[question.id]?.[rIdx] === col}
                              onChange={() => {
                                const newMatrixAnswers = { ...(answers[question.id] || {}) }
                                newMatrixAnswers[rIdx] = col
                                handleAnswerChange(question.id, newMatrixAnswers)
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case "ranking":
            // Simplified ranking for preview
            return (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Arrastra y suelta para ordenar (funcionalidad completa no disponible en preview)
                </p>
                {(question.options || []).map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 border rounded-md bg-muted/20">
                    <Grip className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {idx + 1}. {option}
                    </span>
                  </div>
                ))}
              </div>
            )
          case "date":
            return <Input {...commonProps} type="date" className="w-fit" />
          case "time":
            return <Input {...commonProps} type="time" className="w-fit" />
          case "email":
            return <Input {...commonProps} type="email" placeholder="ejemplo@correo.com" />
          case "phone":
            return <Input {...commonProps} type="tel" placeholder="+1 (555) 123-4567" />
          case "number":
            return <Input {...commonProps} type="number" placeholder="123" />
          case "rating":
            const ratingScale = question.ratingScale || 5
            const emojis = getRatingEmojis(ratingScale)
            return (
              <div className="flex gap-2">
                {Array.from({ length: ratingScale }, (_, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    {question.config?.ratingEmojis !== false && <span className="text-2xl">{emojis[i]}</span>}
                    <Button
                      variant={answers[question.id] === i + 1 ? "default" : "outline"}
                      onClick={() => handleAnswerChange(question.id, i + 1)}
                      className="w-8 h-8 rounded-full"
                    >
                      {i + 1}
                    </Button>
                  </div>
                ))}
              </div>
            )
          case "file":
            return <Input {...commonProps} type="file" />
          case "image_upload":
            return <Input {...commonProps} type="file" accept="image/*" />
          case "signature":
            return (
              <div className="border-2 border-dashed border-muted-foreground/50 rounded p-8 text-center text-muted-foreground">
                Área de firma digital (no funcional en preview)
              </div>
            )
          case "likert":
            const likertScale = question.config?.likertScale || 5
            const likertType = question.config?.likertType || "agreement"
            const presetLabels = {
              agreement: [
                "Totalmente en desacuerdo",
                "En desacuerdo",
                "Neutral",
                "De acuerdo",
                "Totalmente de acuerdo",
              ],
              satisfaction: ["Muy insatisfecho", "Insatisfecho", "Neutral", "Satisfecho", "Muy satisfecho"],
              frequency: ["Nunca", "Raramente", "A veces", "Frecuentemente", "Siempre"],
              importance: ["Sin importancia", "Poco importante", "Neutral", "Importante", "Muy importante"],
              quality: ["Muy mala", "Mala", "Regular", "Buena", "Excelente"],
              likelihood: ["Muy improbable", "Improbable", "Neutral", "Probable", "Muy probable"],
            }
            let likertLabels = []
            if (likertType === "custom" && question.config?.customLabels) {
              likertLabels = question.config.customLabels.split(",").map((l: string) => l.trim())
            } else {
              likertLabels = presetLabels[likertType as keyof typeof presetLabels] || presetLabels.agreement
            }

            if (likertScale === 3) {
              likertLabels = [likertLabels[0], likertLabels[2], likertLabels[4]]
            } else if (likertScale === 4) {
              likertLabels = [likertLabels[0], likertLabels[1], likertLabels[3], likertLabels[4]]
            } else if (likertScale === 7) {
              likertLabels = [
                likertLabels[0],
                likertLabels[1],
                "Ligeramente en desacuerdo",
                likertLabels[2],
                "Ligeramente de acuerdo",
                likertLabels[3],
                likertLabels[4],
              ]
            }

            const isSlider = question.config?.likertStyle === "slider"

            if (isSlider) {
              return (
                <div className="space-y-4">
                  <Slider
                    defaultValue={[answers[question.id] || Math.ceil(likertScale / 2)]}
                    min={1}
                    max={likertScale}
                    step={1}
                    onValueChange={(val) => handleAnswerChange(question.id, val[0])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground px-2">
                    <span>{likertLabels[0]}</span>
                    <span className="font-medium">Valor: {answers[question.id] || Math.ceil(likertScale / 2)}</span>
                    <span>{likertLabels[likertLabels.length - 1]}</span>
                  </div>
                </div>
              )
            }

            return (
              <RadioGroup
                value={answers[question.id] || ""}
                onValueChange={(value) => handleAnswerChange(question.id, value)}
                className="space-y-2"
              >
                {likertLabels.slice(0, likertScale).map((label, i) => (
                  <div key={i} className="flex items-center space-x-2">
                    <RadioGroupItem value={label} id={`${question.id}-likert-${i}`} />
                    <Label htmlFor={`${question.id}-likert-${i}`}>{label}</Label>
                  </div>
                ))}
              </RadioGroup>
            )
          case "net_promoter":
            return (
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Muy poco probable</span>
                  <span className="text-sm text-muted-foreground">Extremadamente probable</span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 11 }, (_, i) => (
                    <Button
                      key={i}
                      variant={answers[question.id] === i ? "default" : "outline"}
                      onClick={() => handleAnswerChange(question.id, i)}
                      className="w-8 h-8 rounded"
                    >
                      {i}
                    </Button>
                  ))}
                </div>
              </div>
            )
          case "slider":
            const sliderMin = question.config?.scaleMin || 0
            const sliderMax = question.config?.scaleMax || 100
            return (
              <div className="space-y-2">
                <Slider
                  defaultValue={[answers[question.id] || Math.floor((sliderMin + sliderMax) / 2)]}
                  min={sliderMin}
                  max={sliderMax}
                  step={1}
                  onValueChange={(val) => handleAnswerChange(question.id, val[0])}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground mt-1">
                  <span>{sliderMin}</span>
                  <span>{sliderMax}</span>
                </div>
              </div>
            )
          case "comment_box":
            return <Textarea {...commonProps} rows={4} placeholder="Deja tu comentario aquí..." />
          case "star_rating":
            const starCount = question.config?.starCount || 5
            return (
              <div className="flex gap-1">
                {Array.from({ length: starCount }, (_, i) => (
                  <Button
                    key={i}
                    variant="ghost"
                    size="icon"
                    onClick={() => handleAnswerChange(question.id, i + 1)}
                    className={`text-3xl ${answers[question.id] && answers[question.id] >= i + 1 ? "text-yellow-400" : "text-muted-foreground"}`}
                  >
                    <Star fill="currentColor" />
                    {question.config?.showLabels !== false && (
                      <span className="absolute bottom-0 text-xs">{i + 1}</span>
                    )}
                  </Button>
                ))}
              </div>
            )
          case "demographic":
            const demographicType = question.config?.demographicType || "age"
            const demographicOptions = {
              age: ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
              gender: ["Masculino", "Femenino", "No binario", "Prefiero no decir"],
              education: ["Secundaria", "Técnico", "Universitario", "Postgrado"],
              income: ["Menos de $500k", "$500k-$1M", "$1M-$2M", "$2M-$5M", "Más de $5M"],
              occupation: ["Estudiante", "Empleado", "Independiente", "Empresario", "Jubilado"],
              location: ["Urbana", "Suburbana", "Rural"],
            }
            return (
              <RadioGroup
                value={answers[question.id] || ""}
                onValueChange={(value) => handleAnswerChange(question.id, value)}
                className="space-y-2"
              >
                {demographicOptions[demographicType as keyof typeof demographicOptions].map((option, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`${question.id}-demo-${idx}`} />
                    <Label htmlFor={`${question.id}-demo-${idx}`}>{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            )
          case "contact_info":
            return (
              <div className="space-y-3">
                {question.config?.includeFirstName !== false && (
                  <Input
                    placeholder="Nombre"
                    value={answers[`${question.id}-firstName`] || ""}
                    onChange={(e) => handleAnswerChange(`${question.id}-firstName`, e.target.value)}
                  />
                )}
                {question.config?.includeLastName !== false && (
                  <Input
                    placeholder="Apellido"
                    value={answers[`${question.id}-lastName`] || ""}
                    onChange={(e) => handleAnswerChange(`${question.id}-lastName`, e.target.value)}
                  />
                )}
                {question.config?.includeEmail !== false && (
                  <Input
                    placeholder="Email"
                    type="email"
                    value={answers[`${question.id}-email`] || ""}
                    onChange={(e) => handleAnswerChange(`${question.id}-email`, e.target.value)}
                  />
                )}
                {question.config?.includePhone && (
                  <Input
                    placeholder="Teléfono"
                    type="tel"
                    value={answers[`${question.id}-phone`] || ""}
                    onChange={(e) => handleAnswerChange(`${question.id}-phone`, e.target.value)}
                  />
                )}
                {question.config?.includeCompany && (
                  <Input
                    placeholder="Empresa"
                    value={answers[`${question.id}-company`] || ""}
                    onChange={(e) => handleAnswerChange(`${question.id}-company`, e.target.value)}
                  />
                )}
                {question.config?.includeAddress && (
                  <Textarea
                    placeholder="Dirección"
                    rows={2}
                    value={answers[`${question.id}-address`] || ""}
                    onChange={(e) => handleAnswerChange(`${question.id}-address`, e.target.value)}
                  />
                )}
              </div>
            )
          case "single_textbox":
            return <Input {...commonProps} />
          case "multiple_textboxes":
            const textboxLabels = question.config?.textboxLabels || ["Etiqueta 1"]
            return (
              <div className="space-y-3">
                {textboxLabels.map((label: string, i: number) => (
                  <div key={i} className="space-y-1">
                    <Label className="text-sm">{label}</Label>
                    <Input
                      placeholder={`Ingresa ${label.toLowerCase()}`}
                      value={answers[`${question.id}-textbox-${i}`] || ""}
                      onChange={(e) => handleAnswerChange(`${question.id}-textbox-${i}`, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )
          default:
            return <Input {...commonProps} placeholder="Tipo de pregunta no soportado en preview" disabled />
        }
      }

      return (
        <div key={question.id} className="mb-6 p-4 border rounded-lg bg-card">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg font-semibold text-primary">{questionIndex + 1}.</span>
            <div
              className="text-lg font-semibold flex-1"
              dangerouslySetInnerHTML={{ __html: question.text || "Pregunta sin texto" }}
            />
            {question.required && <span className="text-red-500 text-sm">*</span>}
          </div>
          {question.config?.description && (
            <p className="text-sm text-muted-foreground mb-4">{question.config.description}</p>
          )}
          {question.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={question.image || "/placeholder.svg"}
              alt="Question image"
              className="max-w-full h-auto rounded-md mb-4"
            />
          )}
          <div className="mt-4">{renderInput()}</div>
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </div>
      )
    },
    [answers, handleAnswerChange, validationErrors, surveyData?.sections],
  )

  if (loading || !surveyData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!currentSection) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4 text-center">
        <h2 className="text-2xl font-bold mb-4">No hay secciones o preguntas para previsualizar.</h2>
        <Button onClick={() => router.push(`/projects/${surveyData.projectData.id}/create-survey`)}>
          Volver al editor de encuestas
        </Button>
      </div>
    )
  }

  const progress = ((currentSectionIndex + 1) / totalSections) * 100

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center p-4 sm:p-8">
      <Card className="w-full max-w-3xl shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" onClick={() => router.back()} className="text-muted-foreground">
              <ArrowLeft className="h-5 w-5 mr-2" /> Volver
            </Button>
            {surveyData.projectData?.companies?.logo && surveyData.settings?.branding?.showLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={surveyData.projectData.companies.logo || "/placeholder.svg"}
                alt="Company Logo"
                className="h-10 max-w-[120px] object-contain"
              />
            )}
            {surveyData.projectData?.companies?.name && !surveyData.projectData?.companies?.logo && (
              <Avatar className="h-10 w-10">
                <AvatarFallback>{surveyData.projectData.companies.name.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            )}
          </div>
          <CardTitle className="text-3xl font-bold text-center mb-2">{surveyData.title}</CardTitle>
          {surveyData.description && <p className="text-center text-muted-foreground">{surveyData.description}</p>}
          <div className="mt-4">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-center text-muted-foreground mt-2">
              Sección {currentSectionIndex + 1} de {totalSections}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">{currentSection.title}</h2>
            {currentSection.description && <p className="text-muted-foreground">{currentSection.description}</p>}
            <Separator />
            {currentSection.questions.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">Esta sección no tiene preguntas.</div>
            ) : (
              currentSection.questions.map((question, qIndex) => renderQuestion(question, qIndex))
            )}
          </div>

          <div className="flex justify-between mt-8">
            <Button onClick={handlePreviousSection} disabled={currentSectionIndex === 0} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" /> Anterior
            </Button>
            <Button onClick={handleNextSection}>
              {currentSectionIndex === totalSections - 1 ? "Finalizar" : "Siguiente"}{" "}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SurveyPreviewPage() {
  return <PreviewSurveyPageContent />
}
