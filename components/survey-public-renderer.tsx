"use client"

import React, { useState, useCallback, useEffect, useMemo } from "react"
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
import {
  ArrowLeft, ArrowRight, Star, AlertCircle, Target, Upload, Send,
  Loader2, Lock, CheckCircle2,
} from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { ContactInfoQuestion } from "@/components/contact-info-question"
import { LikertScaleRenderer } from "@/components/likert-scale-renderer"

/* ================================================================
   Interfaces
   ================================================================ */

interface Question {
  id: string
  type: string
  text: string
  text_html?: string
  options: any[]
  required: boolean
  image?: string | null
  matrixRows?: string[]
  matrixCols?: string[]
  ratingScale?: number
  config?: Record<string, any>
}

interface SurveySection {
  id: string
  title: string
  title_html?: string
  description?: string
  order_num: number
  questions: Question[]
  skip_logic?: {
    enabled: boolean
    action?: string
    target_type?: string
    target_section_id?: string
    targetSectionId?: string
  }
}

interface SurveySettings {
  collectLocation?: boolean
  allowAudio?: boolean
  offlineMode?: boolean
  distributionMethods?: string[]
  theme?: {
    primaryColor: string
    backgroundColor: string
    textColor: string
  }
  branding?: {
    showLogo?: boolean
    logoPosition?: string
    logo?: string
  }
  security?: {
    passwordProtected?: boolean
    password?: string
    preventMultipleSubmissions?: boolean
  }
  notifications?: {
    emailOnSubmission?: boolean
  }
}

export interface PublicSurveyData {
  id: string
  title: string
  description?: string
  status: string
  logo?: string | null
  settings?: SurveySettings
  theme_config?: { primaryColor: string; backgroundColor: string; textColor: string } | null
  security_config?: { passwordProtected?: boolean; password?: string; preventMultipleSubmissions?: boolean } | null
  branding_config?: { showLogo?: boolean; logoPosition?: string; logo?: string | null } | null
  sections: SurveySection[]
  projects?: {
    id: string
    name: string
    companies?: { name: string; logo?: string | null } | null
  } | null
}

type PageState =
  | "loading" | "error" | "not_found" | "inactive"
  | "password" | "survey" | "submitting" | "completed"

interface SurveyPublicRendererProps {
  surveyId: string
}

/* ================================================================
   Helpers
   ================================================================ */

const optLabel = (o: any): string =>
  typeof o === "string" ? o : o?.label || o?.value || String(o)
const optValue = (o: any): string =>
  typeof o === "string" ? o : o?.value || o?.label || String(o)

/* ================================================================
   Componente principal — Renderizado público de encuesta
   Clonado del preview modal, adaptado para uso público (full-page)
   ================================================================ */

export function SurveyPublicRenderer({ surveyId }: SurveyPublicRendererProps) {
  const [pageState, setPageState] = useState<PageState>("loading")
  const [survey, setSurvey] = useState<PublicSurveyData | null>(null)
  const [errorMessage, setErrorMessage] = useState("")


  const [passwordInput, setPasswordInput] = useState("")
  const [passwordError, setPasswordError] = useState("")

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  /* ======================= Carga de datos ======================= */

  useEffect(() => {
    if (!surveyId) return
    ;(async () => {
      try {
        const res = await fetch(`/api/surveys/${surveyId}`)
        if (!res.ok) {
          if (res.status === 404) { setPageState("not_found"); return }
          setErrorMessage("Error al cargar la encuesta")
          setPageState("error")
          return
        }
        const data = await res.json()
        if (data.status !== "active" && data.status !== "draft") {
          setPageState("inactive"); return
        }
        const sections = organizeSections(data)
        setSurvey({ ...data, sections })
        const sec = data.security_config || data.settings?.security
        setPageState(sec?.passwordProtected ? "password" : "survey")
      } catch {
        setErrorMessage("Error de conexión")
        setPageState("error")
      }
    })()
  }, [surveyId])

  /* =================== Organización de datos =================== */

  const organizeSections = (data: any): SurveySection[] => {
    const rawSections: any[] = data.survey_sections || []
    const rawQuestions: any[] = data.questions || []

    if (rawSections.length > 0) {
      return rawSections
        .sort((a: any, b: any) => (a.order_num || 0) - (b.order_num || 0))
        .map((s: any) => ({
          id: s.id,
          title: s.title || "Sección",
          title_html: s.title_html,
          description: s.description,
          order_num: s.order_num || 0,
          questions: rawQuestions
            .filter((q: any) => q.section_id === s.id)
            .sort((a: any, b: any) => (a.order_num || 0) - (b.order_num || 0))
            .map(mapQuestion),
          skip_logic: s.skip_logic,
        }))
    }
    if (rawQuestions.length > 0) {
      return [{
        id: "default",
        title: "Encuesta",
        order_num: 0,
        questions: rawQuestions
          .sort((a: any, b: any) => (a.order_num || 0) - (b.order_num || 0))
          .map(mapQuestion),
      }]
    }
    return []
  }

  const mapQuestion = (q: any): Question => ({
    id: q.id,
    type: q.type || "text",
    text: q.text || "",
    text_html: q.text_html,
    options: q.options || [],
    required: q.required ?? true,
    image: q.image || q.file_url,
    matrixRows: q.matrix_rows || q.settings?.matrixRows,
    matrixCols: q.matrix_cols || q.settings?.matrixCols,
    ratingScale: q.rating_scale || q.settings?.ratingScale || 5,
    config: {
      ...(q.settings || {}),
      ...(q.question_config || {}),
      displayLogic: q.display_logic,
      skipLogic: q.skip_logic,
      validation: q.validation_rules,
    },
  })

  /* ====================== Theme ===================== */

  const themeColors = useMemo(() => {
    const t = survey?.theme_config || survey?.settings?.theme
    return {
      primary: t?.primaryColor || "#10b981",
      background: t?.backgroundColor || "#f0fdf4",
      text: t?.textColor || "#1f2937",
    }
  }, [survey])

  const logo =
    survey?.logo ||
    survey?.branding_config?.logo ||
    survey?.settings?.branding?.logo ||
    survey?.projects?.companies?.logo
  const companyName = survey?.projects?.companies?.name
  const currentSection = survey?.sections[currentSectionIndex]
  const totalSections = survey?.sections.length || 0

  /* ==================== Lógica de visualización ================= */

  const isQuestionVisible = useCallback(
    (question: Question): boolean => {
      const dl = question.config?.displayLogic
      if (!dl?.enabled || !dl.conditions?.length) return true
      return dl.conditions.every((cond: any) => {
        const ans = answers[cond.questionId]
        if (ans === undefined || ans === null) return false
        const s = String(ans)
        switch (cond.operator) {
          case "equals": return s === cond.value
          case "not_equals": return s !== cond.value
          case "contains": return s.includes(cond.value)
          case "not_contains": return !s.includes(cond.value)
          case "is_empty": return s.length === 0
          case "is_not_empty": case "not_empty": return s.length > 0
          default: return true
        }
      })
    },
    [answers],
  )

  /* ===================== Lógica de salto ======================== */

  const getNextSectionIndex = useCallback(
    (idx: number): number | "end" => {
      const section = survey?.sections[idx]
      const sl = section?.skip_logic
      if (!sl?.enabled) return idx + 1
      if (sl.action === "end_survey" || sl.target_type === "end_survey") return "end"
      const targetId = sl.targetSectionId || sl.target_section_id
      if ((sl.action === "specific_section" || sl.target_type === "specific_section") && targetId) {
        const ti = (survey?.sections || []).findIndex((s) => s.id === targetId)
        if (ti >= 0) return ti
      }
      return idx + 1
    },
    [survey?.sections],
  )

  /* ======================= Handlers ============================ */

  const handleAnswerChange = useCallback((questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    setValidationErrors((prev) => {
      const n = { ...prev }; delete n[questionId]; return n
    })
  }, [])

  const validateCurrentSection = useCallback(() => {
    if (!currentSection) return true
    let ok = true
    const errs: Record<string, string> = {}
    for (const q of currentSection.questions) {
      if (!isQuestionVisible(q)) continue
      if (!q.required) continue
      const a = answers[q.id]
      if (a === undefined || a === null || a === "" || (Array.isArray(a) && a.length === 0)) {
        errs[q.id] = "Esta pregunta es obligatoria."
        ok = false
      }
      const v = q.config?.validation
      if (v && a !== undefined && a !== null && a !== "") {
        const s = String(a)
        if (v.minLength && s.length < v.minLength) {
          errs[q.id] = v.customMessage || `Mínimo ${v.minLength} caracteres.`
          ok = false
        }
        if (v.maxLength && s.length > v.maxLength) {
          errs[q.id] = v.customMessage || `Máximo ${v.maxLength} caracteres.`
          ok = false
        }
        if (v.pattern) {
          try {
            if (!new RegExp(v.pattern).test(s)) {
              errs[q.id] = v.customMessage || "Formato inválido."
              ok = false
            }
          } catch { /* ignore bad regex */ }
        }
      }
    }
    setValidationErrors(errs)
    return ok
  }, [currentSection, answers, isQuestionVisible])

  const handleSubmitSurvey = useCallback(async () => {
    if (!survey) return
    setPageState("submitting")
    try {
      const body = {
        survey_id: survey.id,
        answers: Object.entries(answers).map(([question_id, value]) => ({
          question_id,
          value,
        })),
      }
      const res = await fetch("/api/public/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || "Error al enviar")
      }
      setPageState("completed")
    } catch (err: any) {
      setValidationErrors({ _form: err.message || "Error al enviar. Intenta de nuevo." })
      setPageState("survey")
    }
  }, [survey, answers])

  const handleNextSection = useCallback(() => {
    if (!validateCurrentSection()) return
    const next = getNextSectionIndex(currentSectionIndex)
    if (next === "end" || currentSectionIndex >= totalSections - 1) {
      handleSubmitSurvey()
    } else {
      setCurrentSectionIndex(typeof next === "number" ? next : currentSectionIndex + 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [currentSectionIndex, totalSections, validateCurrentSection, getNextSectionIndex, handleSubmitSurvey])

  const handlePreviousSection = useCallback(() => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex((p) => p - 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [currentSectionIndex])

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!survey) return
    const sec = survey.security_config || survey.settings?.security
    if (passwordInput === sec?.password) setPageState("survey")
    else setPasswordError("Contraseña incorrecta")
  }

  /* ===================== renderQuestion ========================= */
  /* Clonado del preview modal — misma lógica de renderizado */

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
                value={(answer as string) ?? ""}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                placeholder="Tu respuesta..."
              />
            )

          case "textarea":
          case "comment_box":
            return (
              <Textarea
                value={(answer as string) ?? ""}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                placeholder="Tu respuesta..."
                rows={4}
              />
            )

          case "multiple_choice":
            return (
              <RadioGroup
                value={(answer as string) ?? ""}
                onValueChange={(v) => handleAnswerChange(question.id, v)}
                className="space-y-2"
              >
                {(question.options || []).map((o: any, i: number) => {
                  const lbl = optLabel(o), val = optValue(o)
                  return (
                    <div key={i} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/40 transition-colors">
                      <RadioGroupItem value={val} id={`${question.id}-o-${i}`} />
                      <Label htmlFor={`${question.id}-o-${i}`} className="cursor-pointer flex-1">{lbl}</Label>
                    </div>
                  )
                })}
                {question.config?.allowOther && (
                  <div className="flex items-center space-x-2 p-2">
                    <RadioGroupItem value="__other__" id={`${question.id}-other`} />
                    <Input
                      className="flex-1"
                      placeholder={question.config?.otherText || "Otro..."}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value || "__other__")}
                    />
                  </div>
                )}
              </RadioGroup>
            )

          case "checkbox": {
            const selected: string[] = Array.isArray(answer) ? answer : []
            return (
              <div className="space-y-2">
                {(question.options || []).map((o: any, i: number) => {
                  const lbl = optLabel(o), val = optValue(o)
                  return (
                    <div key={i} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/40 transition-colors">
                      <Checkbox
                        id={`${question.id}-o-${i}`}
                        checked={selected.includes(val)}
                        onCheckedChange={(c) => {
                          const s = new Set(selected)
                          if (c) s.add(val); else s.delete(val)
                          handleAnswerChange(question.id, Array.from(s))
                        }}
                      />
                      <Label htmlFor={`${question.id}-o-${i}`} className="cursor-pointer flex-1">{lbl}</Label>
                    </div>
                  )
                })}
              </div>
            )
          }

          case "dropdown":
            return (
              <Select
                value={(answer as string) ?? ""}
                onValueChange={(v) => handleAnswerChange(question.id, v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona una opción..." /></SelectTrigger>
                <SelectContent>
                  {(question.options || []).map((o: any, i: number) => (
                    <SelectItem key={i} value={optValue(o)}>{optLabel(o)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )

          case "rating":
          case "star_rating": {
            const max = question.ratingScale || 5
            return (
              <div className="flex items-center gap-1 flex-wrap">
                {Array.from({ length: max }, (_, i) => i + 1).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleAnswerChange(question.id, r)}
                    className="p-1.5 rounded-lg transition-transform hover:scale-110"
                  >
                    <Star
                      className="h-7 w-7 sm:h-8 sm:w-8"
                      fill={typeof answer === "number" && answer >= r ? themeColors.primary : "none"}
                      color={typeof answer === "number" && answer >= r ? themeColors.primary : "#d1d5db"}
                    />
                  </button>
                ))}
                {typeof answer === "number" && (
                  <span className="ml-2 text-sm text-muted-foreground">{answer}/{max}</span>
                )}
              </div>
            )
          }

          case "slider":
          case "scale": {
            const min = question.config?.scaleMin ?? 1
            const max = question.config?.scaleMax ?? (question.ratingScale || 10)
            return (
              <div className="space-y-3">
                <Slider
                  value={[typeof answer === "number" ? answer : min]}
                  onValueChange={(v) => handleAnswerChange(question.id, v[0])}
                  min={min} max={max} step={1}
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

          case "matrix": {
            const rows = question.matrixRows || []
            const cols = question.matrixCols || []
            const ma: Record<string, string> = (answer as any) || {}
            return (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm border-collapse min-w-[400px]">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left font-medium text-muted-foreground w-2/5">Pregunta</th>
                      {cols.map((col, ci) => (
                        <th key={ci} className="p-2 text-center font-medium text-muted-foreground whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri} className={`border-b last:border-0 ${ri % 2 === 0 ? "" : "bg-muted/30"}`}>
                        <td className="p-3 align-middle">
                          <div className="flex items-center gap-3">
                            <span className="flex-shrink-0 w-7 h-7 rounded-full text-white text-xs flex items-center justify-center font-semibold" style={{ backgroundColor: themeColors.primary }}>{ri + 1}</span>
                            <span className="text-sm">{row}</span>
                          </div>
                        </td>
                        {cols.map((col, ci) => (
                          <td key={ci} className="p-2 text-center align-middle">
                            <input
                              type="radio"
                              name={`matrix-${question.id}-${ri}`}
                              checked={ma[row] === col}
                              onChange={() => handleAnswerChange(question.id, { ...ma, [row]: col })}
                              className="h-4 w-4 accent-emerald-600 cursor-pointer"
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

          case "net_promoter":
            return (
              <div className="space-y-3">
                <div className="flex gap-1 flex-wrap justify-center sm:justify-start">
                  {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                    <button
                      key={n} type="button"
                      onClick={() => handleAnswerChange(question.id, n)}
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-sm font-medium transition-colors ${
                        answer === n ? "text-white shadow-md" : "bg-muted hover:bg-muted/80"
                      }`}
                      style={answer === n ? { backgroundColor: themeColors.primary } : {}}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground px-1">
                  <span>Nada probable</span>
                  <span>Muy probable</span>
                </div>
              </div>
            )

          case "likert": {
            if (question.config?.scaleConfig) {
              return (
                <LikertScaleRenderer
                  question={{ id: question.id, text: question.text, required: question.required, config: { scaleConfig: question.config.scaleConfig } }}
                  value={typeof answer === "number" ? answer : undefined}
                  onChange={(v) => handleAnswerChange(question.id, v)}
                />
              )
            }
            const rawLabels = question.config?.likertConfig?.labels || question.config?.likertScale?.labels
            const labels: string[] = Array.isArray(rawLabels) ? rawLabels : [
              "Muy en desacuerdo", "En desacuerdo", "Neutral", "De acuerdo", "Muy de acuerdo",
            ]
            return (
              <div className="space-y-1">
                {labels.map((label, idx) => {
                  const val = idx + 1
                  const selected = answer === val
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selected ? "ring-2" : "hover:bg-muted/50"}`}
                      style={selected ? { borderColor: themeColors.primary, backgroundColor: `${themeColors.primary}10` } : {}}
                      onClick={() => handleAnswerChange(question.id, val)}
                    >
                      <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected ? "border-current" : "border-gray-300"}`} style={selected ? { color: themeColors.primary } : {}}>
                        {selected && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: themeColors.primary }} />}
                      </div>
                      <span className="text-sm">{label}</span>
                    </div>
                  )
                })}
              </div>
            )
          }

          case "ranking": {
            const opts = (question.options || []).map((o: any) => optLabel(o))
            const ranked: string[] = Array.isArray(answer) ? answer : []
            const unranked = opts.filter((o) => !ranked.includes(o))
            return (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Haz clic en las opciones en el orden deseado:</p>
                {ranked.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer hover:bg-red-50 transition-colors" style={{ borderColor: themeColors.primary }}
                    onClick={() => handleAnswerChange(question.id, ranked.filter((r) => r !== item))}>
                    <span className="flex-shrink-0 w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-semibold" style={{ backgroundColor: themeColors.primary }}>{idx + 1}</span>
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
                {unranked.map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg border border-dashed cursor-pointer hover:bg-muted/50 transition-colors text-sm"
                    onClick={() => handleAnswerChange(question.id, [...ranked, item])}>
                    {item}
                  </div>
                ))}
              </div>
            )
          }

          case "date":
            return <Input type="date" value={(answer as string) ?? ""} onChange={(e) => handleAnswerChange(question.id, e.target.value)} className="max-w-xs" />
          case "time":
            return <Input type="time" value={(answer as string) ?? ""} onChange={(e) => handleAnswerChange(question.id, e.target.value)} className="max-w-xs" />
          case "email":
            return <Input type="email" value={(answer as string) ?? ""} onChange={(e) => handleAnswerChange(question.id, e.target.value)} placeholder="correo@ejemplo.com" />
          case "phone":
            return <Input type="tel" value={(answer as string) ?? ""} onChange={(e) => handleAnswerChange(question.id, e.target.value)} placeholder="+57 300 000 0000" />
          case "number":
            return <Input type="number" value={(answer as string) ?? ""} onChange={(e) => handleAnswerChange(question.id, e.target.value)} placeholder="0" />

          case "contact_info":
            return (
              <ContactInfoQuestion
                surveyId={surveyId}
                config={question.config}
                initialData={(answer as any) || undefined}
                onChange={(data) => handleAnswerChange(question.id, data)}
              />
            )

          case "demographic": {
            const data: Record<string, string> = (answer as any) || {}
            const upd = (f: string, v: string) => handleAnswerChange(question.id, { ...data, [f]: v })
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Edad</Label>
                  <Input type="number" value={data.age || ""} onChange={(e) => upd("age", e.target.value)} placeholder="Ej: 30" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Género</Label>
                  <Select value={data.gender || ""} onValueChange={(v) => upd("gender", v)}>
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
                  <Label className="text-xs mb-1 block">Nivel educativo</Label>
                  <Select value={data.education || ""} onValueChange={(v) => upd("education", v)}>
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
                  <Label className="text-xs mb-1 block">Ocupación</Label>
                  <Input value={data.occupation || ""} onChange={(e) => upd("occupation", e.target.value)} placeholder="Ej: Ingeniero" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs mb-1 block">Ciudad</Label>
                  <Input value={data.city || ""} onChange={(e) => upd("city", e.target.value)} placeholder="Ej: Bogotá" />
                </div>
              </div>
            )
          }

          case "multiple_textboxes": {
            const fields = (question.options || []).map((o: any) => optLabel(o))
            const vals: Record<string, string> = (answer as any) || {}
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fields.map((field, idx) => (
                  <div key={idx}>
                    <Label className="text-xs mb-1 block">{field}</Label>
                    <Input value={vals[field] || ""} onChange={(e) => handleAnswerChange(question.id, { ...vals, [field]: e.target.value })} placeholder={`Ingresa ${field.toLowerCase()}...`} />
                  </div>
                ))}
              </div>
            )
          }

          case "signature":
            return (
              <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Firma digital no disponible en esta vista.</p>
              </div>
            )

          case "file":
          case "image_upload":
            return (
              <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Subida de archivos no disponible en esta vista.</p>
              </div>
            )

          default:
            return (
              <Input
                value={(answer as string) ?? ""}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                placeholder="Tu respuesta..."
              />
            )
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
                  dangerouslySetInnerHTML={{ __html: question.text_html || question.text }}
                  className="text-lg font-semibold"
                />
                {question.required && (
                  <Badge variant="destructive" className="text-xs">
                    Requerida
                  </Badge>
                )}
              </div>
              {question.image && (
                <div className="mb-3">
                  <img src={question.image} alt="" className="max-w-full h-auto rounded-lg max-h-64 object-contain" />
                </div>
              )}
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
    [answers, handleAnswerChange, validationErrors, themeColors.primary, isQuestionVisible, surveyId],
  )

  /* ================================================================
     RENDERS POR ESTADO
     ================================================================ */

  if (pageState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando encuesta...</p>
        </div>
      </div>
    )
  }

  if (pageState === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Encuesta no encontrada</h2>
            <p className="text-muted-foreground">El enlace que abriste no corresponde a una encuesta válida.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (pageState === "inactive") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Encuesta no disponible</h2>
            <p className="text-muted-foreground">Esta encuesta no está activa actualmente.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (pageState === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Error</h2>
            <p className="text-muted-foreground">{errorMessage}</p>
            <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (pageState === "password" && survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-8 pb-8">
            {logo && (
              <div className="flex justify-center mb-6">
                <img src={logo} alt="Logo" className="h-16 object-contain" />
              </div>
            )}
            <div className="text-center mb-6">
              <Lock className="h-10 w-10 mx-auto mb-3" style={{ color: themeColors.primary }} />
              <h2 className="text-xl font-bold mb-1">{survey.title}</h2>
              <p className="text-sm text-muted-foreground">Esta encuesta está protegida con contraseña.</p>
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <Input
                type="password"
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError("") }}
                placeholder="Ingresa la contraseña"
                autoComplete="off"
              />
              {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
              <Button type="submit" className="w-full text-white" style={{ backgroundColor: themeColors.primary }}>Acceder</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (pageState === "completed" && survey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#f8fafc" }}>
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-10 pb-10">
            {logo && (
              <div className="flex justify-center mb-6">
                <img src={logo} alt="Logo" className="h-16 object-contain" />
              </div>
            )}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: `${themeColors.primary}15` }}>
                <CheckCircle2 className="h-12 w-12" style={{ color: themeColors.primary }} />
              </div>
            </div>
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-bold" style={{ color: themeColors.primary }}>¡Gracias por participar!</h2>
              <p className="text-muted-foreground">Tu respuesta a la encuesta &quot;{survey.title}&quot; ha sido registrada exitosamente.</p>
              {companyName && <p className="text-sm text-muted-foreground">— {companyName}</p>}
            </div>
            <div className="mt-8 text-center">
              <Button variant="outline" onClick={() => window.close()} className="text-sm">Cerrar ventana</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (pageState === "submitting") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4" style={{ color: themeColors.primary }} />
          <p className="text-muted-foreground">Enviando respuestas...</p>
        </div>
      </div>
    )
  }

  /* ================================================================
     RENDER PRINCIPAL — ENCUESTA ACTIVA
     (Misma estructura que el preview modal pero full-page)
     ================================================================ */

  if (pageState === "survey" && survey && currentSection) {
    return (
      <div className="min-h-screen bg-slate-50 py-6 sm:py-8 px-3 sm:px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header — idéntico al preview modal */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                {logo && (
                  <div className="mb-4">
                    <img src={logo} alt="Logo" className="h-14 sm:h-16 mx-auto object-contain" />
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-2" style={{ color: themeColors.primary }}>
                  {survey.title}
                </h3>
                {survey.description && (
                  <p className="text-muted-foreground">{survey.description}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progreso</span>
                  <span className="font-medium">
                    Sección {currentSectionIndex + 1} de {totalSections}
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-gray-100 flex overflow-hidden">
                  {(survey.sections || []).map((s, i) => {
                    const segmentWidth = `${100 / totalSections}%`
                    const isActive = i === currentSectionIndex
                    return (
                      <button
                        key={s.id}
                        onClick={() => setCurrentSectionIndex(i)}
                        title={`${i + 1}. ${s.title || `Sección ${i + 1}`}`}
                        className={`h-3 focus:outline-none transition-all ${isActive ? "scale-y-105" : ""}`}
                        style={{
                          width: segmentWidth,
                          background: isActive ? themeColors.primary : `${themeColors.primary}55`,
                          border: "none",
                          cursor: "pointer",
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contenido — idéntico al preview modal */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="px-4 py-2 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: `${themeColors.primary}20`,
                  color: themeColors.primary,
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

            {validationErrors._form && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <AlertDescription>{validationErrors._form}</AlertDescription>
              </Alert>
            )}

            {currentSection.questions.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                <h4 className="text-lg font-semibold mb-2">No hay preguntas</h4>
                <p className="text-muted-foreground">Esta sección no tiene preguntas configuradas.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {currentSection.questions.map((q, i) => renderQuestion(q, i))}
              </div>
            )}
          </div>

          {/* Navegación — idéntico al preview modal */}
          <div className="flex justify-between items-center border-t pt-4 mt-6 pb-6">
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
              className="text-white"
            >
              {currentSectionIndex === totalSections - 1 ? (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Encuesta
                </>
              ) : (
                <>
                  Siguiente <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
