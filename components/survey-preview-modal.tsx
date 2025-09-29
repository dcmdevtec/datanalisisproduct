import React, { useState, useCallback, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, ArrowRight, Star, AlertCircle, Info, Target, X } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"

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
        questionText?: string
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

interface PreviewData {
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

interface SurveyPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  previewData: PreviewData
}

export function SurveyPreviewModal({ isOpen, onClose, previewData }: SurveyPreviewModalProps) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [answers, setAnswers] = useState<{ [questionId: string]: any }>({})
  const [validationErrors, setValidationErrors] = useState<{ [questionId: string]: string }>({})

  useEffect(() => {
    if (!isOpen) {
      setCurrentSectionIndex(0)
      setAnswers({})
      setValidationErrors({})
    }
  }, [isOpen])

  const currentSection = previewData.sections[currentSectionIndex]
  const totalSections = previewData.sections.length

  // Get theme colors from settings
  const getThemeColors = () => {
    if (previewData.settings?.theme) {
      return {
        primary: previewData.settings.theme.primaryColor || '#10b981',
        background: previewData.settings.theme.backgroundColor || '#f0fdf4',
        text: previewData.settings.theme.textColor || '#1f2937'
      }
    }
    return {
      primary: '#10b981',
      background: '#f0fdf4',
      text: '#1f2937'
    }
  }

  const themeColors = getThemeColors()

  const handleAnswerChange = useCallback((questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    setValidationErrors((prev) => {
      const newErrors = { ...prev }
      delete newErrors[questionId]
      return newErrors
    })
  }, [])

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
    if (!validateCurrentSection()) return

    if (currentSectionIndex < totalSections - 1) {
      setCurrentSectionIndex((prev) => prev + 1)
    }
  }, [currentSectionIndex, totalSections, validateCurrentSection])

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
          default:
            return <Input {...commonProps} placeholder={`Tipo de pregunta "${question.type}" no soportado en preview`} disabled />
        }
      }

      return (
        <div key={question.id} className="mb-8 p-6 border rounded-lg bg-white">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0">
              <div 
                className="w-10 h-10 text-white rounded-lg flex items-center justify-center text-lg font-semibold"
                style={{ backgroundColor: themeColors.primary }}
              >
                {questionIndex + 1}
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div
                  dangerouslySetInnerHTML={{ __html: question.text }}
                  className="text-lg font-semibold"
                />
                {question.required && (
                  <Badge variant="destructive" className="text-xs">
                    Requerida
                  </Badge>
                )}
              </div>
              <div className="mt-4">{renderInput()}</div>
              {error && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </div>
      )
    },
    [answers, handleAnswerChange, validationErrors, themeColors.primary],
  )

  if (!currentSection) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl h-[90vh]">
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="text-2xl font-bold">Vista Previa de la Encuesta</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-col items-center justify-center h-full">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No hay secciones para previsualizar</h3>
            <p className="text-muted-foreground">Agrega secciones y preguntas para ver la vista previa.</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const progress = ((currentSectionIndex + 1) / totalSections) * 100

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh]">
        <div className="flex items-center justify-between border-b pb-4">
          <h2 className="text-2xl font-bold">Vista Previa de la Encuesta</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4" style={{ height: "calc(100% - 140px)" }}>
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2" style={{ color: themeColors.primary }}>
                  {previewData.title}
                </h3>
                {previewData.description && (
                  <p className="text-muted-foreground">{previewData.description}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progreso</span>
                  <span className="font-medium">
                    Sección {currentSectionIndex + 1} de {totalSections}
                  </span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <div 
                className="px-4 py-2 rounded-full text-sm font-medium"
                style={{ 
                  backgroundColor: `${themeColors.primary}20`,
                  color: themeColors.primary
                }}
              >
                <Target className="h-4 w-4 inline-block mr-2" />
                Sección {currentSectionIndex + 1}
              </div>
            </div>

            <div className="space-y-2 mb-6">
              {currentSection.title_html ? (
                <h3 className="text-xl font-semibold" dangerouslySetInnerHTML={{ __html: currentSection.title_html }} />
              ) : (
                <h3 className="text-xl font-semibold">{currentSection.title}</h3>
              )}
              {currentSection.description && (
                <p className="text-muted-foreground">{currentSection.description}</p>
              )}
            </div>

            <Separator className="my-6" />

            {currentSection.questions.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                <h4 className="text-lg font-semibold mb-2">No hay preguntas</h4>
                <p className="text-muted-foreground">Esta sección no tiene preguntas configuradas.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {currentSection.questions.map((question, qIndex) => renderQuestion(question, qIndex))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center border-t pt-4">
          <Button
            variant="outline"
            onClick={handlePreviousSection}
            disabled={currentSectionIndex === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Anterior
          </Button>

          <Button
            onClick={handleNextSection}
            style={{ backgroundColor: themeColors.primary }}
          >
            {currentSectionIndex === totalSections - 1 ? (
              "Finalizar Vista Previa"
            ) : (
              <>
                Siguiente <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
