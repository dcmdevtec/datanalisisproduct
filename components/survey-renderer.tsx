"use client"

import React, { useState, useCallback, useEffect, useMemo } from "react"
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
import { ArrowLeft, ArrowRight, Star, AlertCircle, Target, Send, Loader2 } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import type {
  Question,
  SurveySection,
  SurveySettings,
  ThemeConfig,
  BrandingConfig,
  SurveyAnswer,
} from "@/app/types/survey"

// --- Interfaces del componente ---

export interface SurveyRendererProps {
  survey: {
    id: string
    title: string
    description?: string
    logo?: string | null
    settings?: SurveySettings
    theme_config?: ThemeConfig | null
    branding_config?: BrandingConfig | null
  }
  sections: SurveySection[]
  onSubmit: (answers: SurveyAnswer[]) => Promise<void>
  mode: "preview" | "live"
  className?: string
}

// --- Componente Principal ---

export function SurveyRenderer({
  survey,
  sections,
  onSubmit,
  mode,
  className,
}: SurveyRendererProps) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  const currentSection = sections[currentSectionIndex]
  const totalSections = sections.length

  // --- Theme ---
  const themeColors = useMemo(() => {
    const theme = survey.theme_config || survey.settings?.theme
    return {
      primary: theme?.primaryColor || "#10b981",
      background: theme?.backgroundColor || "#f0fdf4",
      text: theme?.textColor || "#1f2937",
    }
  }, [survey.theme_config, survey.settings?.theme])

  // --- Handlers ---
  const handleAnswerChange = useCallback((questionId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    setValidationErrors((prev) => {
      const next = { ...prev }
      delete next[questionId]
      return next
    })
  }, [])

  // --- Display Logic ---
  const isQuestionVisible = useCallback(
    (question: Question): boolean => {
      const dl = question.config?.displayLogic
      if (!dl?.enabled || !dl.conditions?.length) return true

      return dl.conditions.every((cond) => {
        const answer = answers[cond.questionId]
        if (answer === undefined || answer === null) return false
        const answerStr = String(answer)
        switch (cond.operator) {
          case "equals":
            return answerStr === cond.value
          case "not_equals":
            return answerStr !== cond.value
          case "contains":
            return answerStr.includes(cond.value)
          case "not_empty":
            return answerStr.length > 0
          case "is_empty":
            return answerStr.length === 0
          default:
            return true
        }
      })
    },
    [answers]
  )

  // --- Skip Logic de Sección ---
  const getNextSectionIndex = useCallback(
    (currentIdx: number): number | "end" => {
      const section = sections[currentIdx]
      if (!section?.skipLogic?.enabled) return currentIdx + 1

      const sl = section.skipLogic
      if (sl.action === "end_survey") return "end"
      if (sl.action === "specific_section" && sl.targetSectionId) {
        const targetIdx = sections.findIndex((s) => s.id === sl.targetSectionId)
        if (targetIdx >= 0) return targetIdx
      }
      return currentIdx + 1
    },
    [sections]
  )

  // --- Validación ---
  const validateCurrentSection = useCallback(() => {
    if (!currentSection) return true
    let isValid = true
    const newErrors: Record<string, string> = {}

    currentSection.questions.forEach((question) => {
      if (!isQuestionVisible(question)) return
      if (question.required) {
        const answer = answers[question.id]
        if (answer === undefined || answer === null || answer === "" || (Array.isArray(answer) && answer.length === 0)) {
          newErrors[question.id] = "Esta pregunta es obligatoria."
          isValid = false
        }
      }
    })

    setValidationErrors(newErrors)
    return isValid
  }, [currentSection, answers, isQuestionVisible])

  // --- Navegación ---
  const handleNext = useCallback(async () => {
    if (!validateCurrentSection()) return

    if (currentSectionIndex === totalSections - 1) {
      // Última sección → enviar
      if (mode === "preview") {
        setIsCompleted(true)
        return
      }
      setIsSubmitting(true)
      try {
        const surveyAnswers: SurveyAnswer[] = Object.entries(answers).map(
          ([question_id, value]) => ({ question_id, value })
        )
        await onSubmit(surveyAnswers)
        setIsCompleted(true)
      } catch {
        setValidationErrors({ _form: "Error al enviar. Intenta de nuevo." })
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    const next = getNextSectionIndex(currentSectionIndex)
    if (next === "end") {
      if (mode === "preview") {
        setIsCompleted(true)
        return
      }
      setIsSubmitting(true)
      try {
        const surveyAnswers: SurveyAnswer[] = Object.entries(answers).map(
          ([question_id, value]) => ({ question_id, value })
        )
        await onSubmit(surveyAnswers)
        setIsCompleted(true)
      } catch {
        setValidationErrors({ _form: "Error al enviar. Intenta de nuevo." })
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    setCurrentSectionIndex(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [currentSectionIndex, totalSections, validateCurrentSection, getNextSectionIndex, mode, answers, onSubmit])

  const handlePrevious = useCallback(() => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [currentSectionIndex])

  // --- Renderizado de Preguntas ---
  const renderQuestion = useCallback(
    (question: Question, questionIndex: number) => {
      if (!isQuestionVisible(question)) return null

      const answer = answers[question.id]
      const error = validationErrors[question.id]

      const renderInput = () => {
        switch (question.type) {
          case "text":
          case "single_textbox":
            return (
              <Input
                value={(answer as string) || ""}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                placeholder="Tu respuesta..."
              />
            )

          case "textarea":
          case "comment_box":
            return (
              <Textarea
                value={(answer as string) || ""}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                placeholder="Tu respuesta..."
                rows={4}
              />
            )

          case "multiple_choice":
            return (
              <RadioGroup
                value={(answer as string) || ""}
                onValueChange={(v) => handleAnswerChange(question.id, v)}
                className="space-y-2"
              >
                {(question.options || []).map((option, idx) => {
                  const optionText = typeof option === "string" ? option : option.label || option.value || ""
                  return (
                    <div key={idx} className="flex items-center space-x-2">
                      <RadioGroupItem value={optionText} id={`${question.id}-opt-${idx}`} />
                      <Label htmlFor={`${question.id}-opt-${idx}`}>{optionText}</Label>
                    </div>
                  )
                })}
              </RadioGroup>
            )

          case "checkbox":
            return (
              <div className="space-y-2">
                {(question.options || []).map((option, idx) => {
                  const optionText = typeof option === "string" ? option : option.label || option.value || ""
                  const checked = Array.isArray(answer) && (answer as string[]).includes(optionText)
                  return (
                    <div key={idx} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${question.id}-opt-${idx}`}
                        checked={checked}
                        onCheckedChange={(c) => {
                          const current = new Set((answer as string[]) || [])
                          if (c) current.add(optionText)
                          else current.delete(optionText)
                          handleAnswerChange(question.id, Array.from(current))
                        }}
                      />
                      <Label htmlFor={`${question.id}-opt-${idx}`}>{optionText}</Label>
                    </div>
                  )
                })}
              </div>
            )

          case "dropdown":
            return (
              <Select
                value={(answer as string) || ""}
                onValueChange={(v) => handleAnswerChange(question.id, v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una opción..." />
                </SelectTrigger>
                <SelectContent>
                  {(question.options || []).map((option, idx) => {
                    const optionText = typeof option === "string" ? option : option.label || option.value || ""
                    return (
                      <SelectItem key={idx} value={optionText}>
                        {optionText}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            )

          case "scale":
          case "slider": {
            const min = question.config?.scaleMin ?? 1
            const max = question.config?.scaleMax ?? (question.ratingScale || 10)
            return (
              <div className="space-y-3">
                <Slider
                  value={[typeof answer === "number" ? answer : min]}
                  onValueChange={(v) => handleAnswerChange(question.id, v[0])}
                  min={min}
                  max={max}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{question.config?.scaleLabels?.[0] || min}</span>
                  <span className="text-lg font-semibold" style={{ color: themeColors.primary }}>
                    {typeof answer === "number" ? answer : "—"}
                  </span>
                  <span>{question.config?.scaleLabels?.[1] || max}</span>
                </div>
              </div>
            )
          }

          case "rating":
          case "star_rating": {
            const maxStars = question.ratingScale || 5
            return (
              <div className="flex items-center gap-1">
                {Array.from({ length: maxStars }, (_, i) => i + 1).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleAnswerChange(question.id, r)}
                    className="p-1 rounded transition-colors hover:scale-110"
                  >
                    <Star
                      className="h-7 w-7"
                      fill={typeof answer === "number" && answer >= r ? themeColors.primary : "none"}
                      color={typeof answer === "number" && answer >= r ? themeColors.primary : "#d1d5db"}
                    />
                  </button>
                ))}
                {typeof answer === "number" && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    {answer}/{maxStars}
                  </span>
                )}
              </div>
            )
          }

          case "net_promoter":
            return (
              <div className="space-y-2">
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleAnswerChange(question.id, n)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                        answer === n
                          ? "text-white"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                      style={answer === n ? { backgroundColor: themeColors.primary } : {}}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Nada probable</span>
                  <span>Muy probable</span>
                </div>
              </div>
            )

          case "matrix": {
            const rows = question.matrixRows || []
            const cols = question.matrixCols || []
            const matrixAnswers = (answer as Record<string, string>) || {}
            return (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="p-2 text-left" />
                      {cols.map((col, idx) => (
                        <th key={idx} className="p-2 text-center font-medium">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rIdx) => (
                      <tr key={rIdx} className={rIdx % 2 === 0 ? "bg-muted/30" : ""}>
                        <td className="p-2 font-medium">{row}</td>
                        {cols.map((col, cIdx) => (
                          <td key={cIdx} className="p-2 text-center">
                            <input
                              type="radio"
                              name={`${question.id}-row-${rIdx}`}
                              checked={matrixAnswers[row] === col}
                              onChange={() => {
                                handleAnswerChange(question.id, {
                                  ...matrixAnswers,
                                  [row]: col,
                                })
                              }}
                              className="h-4 w-4"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }

          case "date":
            return (
              <Input
                type="date"
                value={(answer as string) || ""}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              />
            )

          case "time":
            return (
              <Input
                type="time"
                value={(answer as string) || ""}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              />
            )

          case "email":
            return (
              <Input
                type="email"
                value={(answer as string) || ""}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                placeholder="correo@ejemplo.com"
              />
            )

          case "phone":
            return (
              <Input
                type="tel"
                value={(answer as string) || ""}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                placeholder="+57 300 000 0000"
              />
            )

          case "number":
            return (
              <Input
                type="number"
                value={(answer as string) || ""}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                placeholder="0"
              />
            )

          case "ranking": {
            const options = (question.options || []).map((o) => (typeof o === "string" ? o : o.label || o.value || ""))
            const ranked = Array.isArray(answer) ? (answer as string[]) : []
            const unranked = options.filter((o) => !ranked.includes(o))
            return (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Haz clic en las opciones en el orden deseado:</p>
                {ranked.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {ranked.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-red-50"
                        style={{ borderColor: themeColors.primary }}
                        onClick={() => handleAnswerChange(question.id, ranked.filter((r) => r !== item))}
                      >
                        <span
                          className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center"
                          style={{ backgroundColor: themeColors.primary }}
                        >
                          {idx + 1}
                        </span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
                {unranked.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded border border-dashed cursor-pointer hover:bg-muted/50"
                    onClick={() => handleAnswerChange(question.id, [...ranked, item])}
                  >
                    {item}
                  </div>
                ))}
              </div>
            )
          }

          case "contact_info":
            return <ContactInfoRenderer questionId={question.id} answer={answer} onChange={handleAnswerChange} />

          case "demographic":
            return <DemographicRenderer questionId={question.id} answer={answer} onChange={handleAnswerChange} />

          case "likert": {
            const config = question.config?.likertConfig || question.config?.likertScale
            const labels = config?.labels || ["Muy en desacuerdo", "En desacuerdo", "Neutral", "De acuerdo", "Muy de acuerdo"]
            return (
              <div className="space-y-1">
                {labels.map((label, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      answer === idx + 1 ? "ring-2" : "hover:bg-muted/50"
                    }`}
                    style={answer === idx + 1 ? { borderColor: themeColors.primary, backgroundColor: `${themeColors.primary}10` } : {}}
                    onClick={() => handleAnswerChange(question.id, idx + 1)}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        answer === idx + 1 ? "border-current" : "border-gray-300"
                      }`}
                      style={answer === idx + 1 ? { color: themeColors.primary } : {}}
                    >
                      {answer === idx + 1 && (
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: themeColors.primary }} />
                      )}
                    </div>
                    <span className="text-sm">{label}</span>
                  </div>
                ))}
              </div>
            )
          }

          case "multiple_textboxes": {
            const fields = (question.options || []).map((o) => (typeof o === "string" ? o : o.label || ""))
            const values = (answer as Record<string, string>) || {}
            return (
              <div className="space-y-3">
                {fields.map((field, idx) => (
                  <div key={idx}>
                    <Label className="text-sm mb-1">{field}</Label>
                    <Input
                      value={values[field] || ""}
                      onChange={(e) =>
                        handleAnswerChange(question.id, { ...values, [field]: e.target.value })
                      }
                      placeholder={`Ingresa ${field.toLowerCase()}...`}
                    />
                  </div>
                ))}
              </div>
            )
          }

          default:
            return (
              <Input
                value={(answer as string) || ""}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                placeholder="Tu respuesta..."
              />
            )
        }
      }

      return (
        <div key={question.id} className="p-5 border rounded-xl bg-white shadow-sm">
          <div className="flex items-start gap-4">
            <div
              className="flex-shrink-0 w-9 h-9 text-white rounded-lg flex items-center justify-center text-sm font-semibold"
              style={{ backgroundColor: themeColors.primary }}
            >
              {questionIndex + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                {question.text_html ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: question.text_html }}
                    className="text-base font-medium"
                  />
                ) : (
                  <p className="text-base font-medium">{question.text}</p>
                )}
                {question.required && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    *
                  </Badge>
                )}
              </div>
              <div>{renderInput()}</div>
              {error && (
                <Alert variant="destructive" className="mt-2 py-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </div>
      )
    },
    [answers, handleAnswerChange, validationErrors, themeColors.primary, isQuestionVisible]
  )

  // --- Pantalla de completado (modo preview) ---
  if (isCompleted && mode === "preview") {
    return (
      <div className={`max-w-2xl mx-auto p-6 ${className || ""}`}>
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${themeColors.primary}20` }}>
              <Send className="h-8 w-8" style={{ color: themeColors.primary }} />
            </div>
            <h3 className="text-xl font-bold mb-2">Vista Previa Finalizada</h3>
            <p className="text-muted-foreground">
              Así se vería la encuesta para los respondentes.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // En modo live, el padre (la página pública) maneja la pantalla de agradecimiento
  if (isCompleted && mode === "live") return null

  if (!currentSection) {
    return (
      <div className={`max-w-2xl mx-auto p-6 text-center ${className || ""}`}>
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No hay secciones</h3>
        <p className="text-muted-foreground">Esta encuesta no tiene preguntas configuradas.</p>
      </div>
    )
  }

  const progress = ((currentSectionIndex + 1) / totalSections) * 100

  return (
    <div className={`max-w-2xl mx-auto ${className || ""}`}>
      {/* Header con título y logo */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="text-center mb-4">
            {survey.logo && (
              <div className="mb-4">
                <img
                  src={survey.logo}
                  alt="Logo"
                  className="h-16 mx-auto object-contain"
                />
              </div>
            )}
            <h2 className="text-2xl font-bold mb-1" style={{ color: themeColors.primary }}>
              {survey.title}
            </h2>
            {survey.description && (
              <div className="text-muted-foreground text-sm prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: survey.description }} />
            )}
          </div>

          {/* Barra de progreso */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progreso</span>
              <span className="font-medium">
                Sección {currentSectionIndex + 1} de {totalSections}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-gray-100 flex overflow-hidden">
              {sections.map((s, i) => {
                const segmentWidth = `${100 / totalSections}%`
                const isActive = i === currentSectionIndex
                const isPast = i < currentSectionIndex
                return (
                  <div
                    key={s.id}
                    className="h-2.5 transition-all"
                    style={{
                      width: segmentWidth,
                      background: isPast || isActive
                        ? themeColors.primary
                        : `${themeColors.primary}25`,
                    }}
                  />
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sección actual */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-2">
          <div
            className="px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: `${themeColors.primary}15`, color: themeColors.primary }}
          >
            <Target className="h-3.5 w-3.5 inline-block mr-1.5" />
            Sección {currentSectionIndex + 1}
          </div>
        </div>

        <div className="space-y-1">
          {currentSection.title_html ? (
            <h3 className="text-lg font-semibold" dangerouslySetInnerHTML={{ __html: currentSection.title_html }} />
          ) : (
            <h3 className="text-lg font-semibold">{currentSection.title}</h3>
          )}
          {currentSection.description && (
            <div className="text-sm text-muted-foreground prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: currentSection.description }} />
          )}
        </div>

        <Separator />

        {currentSection.questions.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Esta sección no tiene preguntas.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentSection.questions.map((q, idx) => renderQuestion(q, idx))}
          </div>
        )}
      </div>

      {/* Error global */}
      {validationErrors._form && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationErrors._form}</AlertDescription>
        </Alert>
      )}

      {/* Navegación */}
      <div className="flex justify-between items-center border-t pt-4 pb-6">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentSectionIndex === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Anterior
        </Button>

        <Button
          onClick={handleNext}
          disabled={isSubmitting}
          style={{ backgroundColor: themeColors.primary }}
          className="text-white"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          {currentSectionIndex === totalSections - 1 ? (
            <>
              {mode === "live" ? "Enviar Respuestas" : "Finalizar Vista Previa"}
              <Send className="h-4 w-4 ml-2" />
            </>
          ) : (
            <>
              Siguiente <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// --- Sub-componentes para tipos complejos ---

function ContactInfoRenderer({
  questionId,
  answer,
  onChange,
}: {
  questionId: string
  answer: unknown
  onChange: (id: string, value: unknown) => void
}) {
  const data = (answer as Record<string, string>) || {}
  const update = (field: string, value: string) => {
    onChange(questionId, { ...data, [field]: value })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <Label className="text-xs">Tipo de documento</Label>
        <Select value={data.documentType || ""} onValueChange={(v) => update("documentType", v)}>
          <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
            <SelectItem value="CE">Cédula de Extranjería</SelectItem>
            <SelectItem value="TI">Tarjeta de Identidad</SelectItem>
            <SelectItem value="NIT">NIT</SelectItem>
            <SelectItem value="PP">Pasaporte</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Número de documento</Label>
        <Input value={data.documentNumber || ""} onChange={(e) => update("documentNumber", e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Nombre completo</Label>
        <Input value={data.fullName || ""} onChange={(e) => update("fullName", e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Correo electrónico</Label>
        <Input type="email" value={data.email || ""} onChange={(e) => update("email", e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Teléfono</Label>
        <Input type="tel" value={data.phone || ""} onChange={(e) => update("phone", e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Empresa</Label>
        <Input value={data.company || ""} onChange={(e) => update("company", e.target.value)} />
      </div>
    </div>
  )
}

function DemographicRenderer({
  questionId,
  answer,
  onChange,
}: {
  questionId: string
  answer: unknown
  onChange: (id: string, value: unknown) => void
}) {
  const data = (answer as Record<string, string>) || {}
  const update = (field: string, value: string) => {
    onChange(questionId, { ...data, [field]: value })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <Label className="text-xs">Edad</Label>
        <Input type="number" value={data.age || ""} onChange={(e) => update("age", e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Género</Label>
        <Select value={data.gender || ""} onValueChange={(v) => update("gender", v)}>
          <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Masculino</SelectItem>
            <SelectItem value="female">Femenino</SelectItem>
            <SelectItem value="non_binary">No binario</SelectItem>
            <SelectItem value="prefer_not">Prefiero no decir</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Nivel educativo</Label>
        <Select value={data.education || ""} onValueChange={(v) => update("education", v)}>
          <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Primaria</SelectItem>
            <SelectItem value="secondary">Secundaria</SelectItem>
            <SelectItem value="technical">Técnico</SelectItem>
            <SelectItem value="university">Universitario</SelectItem>
            <SelectItem value="postgraduate">Posgrado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Ciudad</Label>
        <Input value={data.city || ""} onChange={(e) => update("city", e.target.value)} />
      </div>
    </div>
  )
}
