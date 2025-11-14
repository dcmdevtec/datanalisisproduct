"use client"

import React, { useEffect, useState, useCallback, useRef } from "react"
// Utilidad para extraer fuentes de un HTML
function extractFontFamilies(html: string): string[] {
  if (!html) return [];
  const regex = /font-family\s*:\s*([^;"']+)/gi;
  const matches = Array.from(html.matchAll(regex));
  const fonts = matches.map(m => m[1].split(',')[0].replace(/['"]/g, '').trim());
  return Array.from(new Set(fonts));
}

// Utilidad para cargar Google Fonts dinámicamente
function loadGoogleFont(font: string) {
  if (!font) return;
  const fontParam = font.replace(/ /g, '+');
  const id = `dynamic-googlefont-${fontParam}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fontParam}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}
import { RankingPreviewDraggable } from "@/components/RankingPreviewDraggable"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import EmailAutocompleteInput from "@/components/EmailAutocompleteInput";

import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, ArrowRight, Loader2, Star, CheckCircle, AlertCircle, Info, Target } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ContactInfoQuestion } from "@/components/contact-info-question"

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
        questionText?: string // Agregar campo para reconciliación automática
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
    primaryColor?: string
    backgroundColor?: string
    textColor?: string
  }
  branding?: {
    showLogo?: boolean
    logoPosition?: string
    // Allow optional logo (base64 or URL) used by preview
    logo?: string | null
  }
  security?: {
    passwordProtected?: boolean
    password?: string
    preventMultipleSubmissions?: boolean
  }
  notifications?: {
    emailOnSubmission?: boolean
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
  // Modal / verification state
  // We'll infer the surveyId from the path and keep respondent id per-survey using localStorage key `respondent_public_id_${surveyId}`
  const [inferredSurveyId, setInferredSurveyId] = useState<string | null>(null)
  const [showVerifyModal, setShowVerifyModal] = useState(true)
  const [docType, setDocType] = useState("")
  const [docNumber, setDocNumber] = useState("")
  const [fullName, setFullName] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const { toast } = useToast()
  // Estado para mostrar cuando se está ejecutando la reconciliación automática
  const [isReconciling, setIsReconciling] = useState(false)
  const [hasReconciled, setHasReconciled] = useState(false)
  const [appLoadError, setAppLoadError] = useState<string[] | null>(null)


  // Efecto para manejar la reconciliación automática
  useEffect(() => {
    // Runtime check: detect undefined UI/component imports that would cause
    // 'element type is invalid' React errors in production (minified -> #306).
    const missing: string[] = []
    const checks: { [key: string]: any } = {
      Button,
      Input,
      Select,
      Label,
      Card,
      CardContent,
      CardHeader,
      CardTitle,
    }
    Object.entries(checks).forEach(([name, val]) => {
      if (typeof val === "undefined") missing.push(name)
    })
    if (missing.length > 0) {
      console.error("❌ Missing UI exports detected (this will crash in production):", missing)
      setAppLoadError(missing)
      // Early return: avoid running other mount logic that may assume components exist
      return
    }
    if (surveyData && !hasReconciled) {
      const hasDisplayLogic = surveyData.sections.some(section => 
        section.questions.some(q => q.config?.displayLogic?.enabled)
      )
      if (hasDisplayLogic) {
        setIsReconciling(true)
        setHasReconciled(true)
        setTimeout(() => setIsReconciling(false), 2000)
      }
    }
    // --- Cargar fuentes de Google Fonts para secciones y preguntas ---
    if (surveyData) {
      // Secciones
      surveyData.sections.forEach(section => {
        if (section.title_html) {
          extractFontFamilies(section.title_html).forEach(loadGoogleFont);
        }
        // Preguntas
        section.questions.forEach(q => {
          if (q.text_html) {
            extractFontFamilies(q.text_html).forEach(loadGoogleFont);
          }
        });
      });
    }
  }, [surveyData, hasReconciled])

  useEffect(() => {
    const storedData = localStorage.getItem("surveyPreviewData")
    if (storedData) {
            const parsedData = JSON.parse(storedData)
  
      
      // Debug: Verificar estructura de skip logic
      if (parsedData.sections) {

        parsedData.sections.forEach((section: any, sectionIndex: number) => {
          
          if (section.questions) {
            section.questions.forEach((question: any, questionIndex: number) => {
              if (question.config?.skipLogic?.enabled) {

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

  // On mount, check if respondent_public_id already stored
  useEffect(() => {
    // Infer surveyId from pathname early so we decide storage key
    try {
      const parts = window.location.pathname.split("/").filter(Boolean)
      const idx = parts.indexOf("survey")
      if (idx !== -1 && parts.length > idx + 1) {
        const id = parts[idx + 1]
        setInferredSurveyId(id)
        const perKey = `respondent_public_id_${id}`
        const existing = localStorage.getItem(perKey)
        if (existing) {
          setShowVerifyModal(false)
        } else {
          // show modal if surveyId present and no stored respondent id
          setShowVerifyModal(true)
        }
        return
      }
    } catch (e) {
      // ignore
    }

    // Fallback: global respondent_public_id (legacy behavior)
    const existing = localStorage.getItem("respondent_public_id")
    if (existing) setShowVerifyModal(false)
  }, [])

  const handleVerify = async () => {
    setVerifyError(null)
    if (!docType || !docNumber) {
      setVerifyError("Tipo y número de documento son obligatorios")
      return
    }
    setVerifying(true)
    try {
      // Try to infer surveyId from URL path: /preview/survey/[id]
      let inferredSurveyId: string | null = null
      try {
        const parts = window.location.pathname.split("/").filter(Boolean)
        const idx = parts.indexOf("survey")
        if (idx !== -1 && parts.length > idx + 1) inferredSurveyId = parts[idx + 1]
      } catch {}

      const fetchUrl = inferredSurveyId ? `/api/surveys/${inferredSurveyId}/verify-respondent` : `/api/surveys/verify-respondent`
      const bodyToSend: any = { document_type: docType, document_number: docNumber, full_name: fullName }
      if (inferredSurveyId) bodyToSend.survey_id = inferredSurveyId

      const res = await fetch(fetchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyToSend),
      })
      const json = await res.json()
      if (!res.ok) {
        setVerifyError(json.error || "Error del servidor")
        setVerifying(false)
        return
      }

      if (json.allowed_to_proceed) {
        // store per-survey respondent id and document details when surveyId available
        if (inferredSurveyId) {
          localStorage.setItem(`respondent_public_id_${inferredSurveyId}`, json.respondent_public_id)
          if (docType) localStorage.setItem(`respondent_document_type_${inferredSurveyId}`, docType)
          if (docNumber) localStorage.setItem(`respondent_document_number_${inferredSurveyId}`, docNumber)
          if (fullName) localStorage.setItem(`respondent_name_${inferredSurveyId}`, fullName)
        } else {
          localStorage.setItem("respondent_public_id", json.respondent_public_id)
          if (docType) localStorage.setItem("respondent_document_type", docType)
          if (docNumber) localStorage.setItem("respondent_document_number", docNumber)
          if (fullName) localStorage.setItem("respondent_name", fullName)
        }
        setShowVerifyModal(false)
      } else {
        // Prefer server-provided message when available
        setVerifyError(json.message || "Ya ha completado esta encuesta.")
      }
    } catch (err: any) {
      console.error("Error verificando encuestado:", err)
      setVerifyError("Error de red")
    } finally {
      setVerifying(false)
    }
  }

  // Defensive fallback: some production builds may end up with undefined imports for the
  // Radix-based Select components (causing React error #306: element type is undefined).
  // Render a native <select> if the Select exports are missing.
  function DocTypeSelect() {
    // @ts-ignore - runtime existence check
    const HasRadixSelect = typeof Select !== "undefined" && typeof SelectTrigger !== "undefined" && typeof SelectContent !== "undefined" && typeof SelectItem !== "undefined" && typeof SelectValue !== "undefined"

    if (!HasRadixSelect) {
      return (
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option value="">Selecciona el tipo de documento</option>
          <option value="CC">Cédula de Ciudadanía (CC)</option>
          <option value="CE">Cédula de Extranjería (CE)</option>
          <option value="NIT">NIT</option>
          <option value="TI">Tarjeta de Identidad (TI)</option>
          <option value="PEP">Permiso Especial de Permanencia (PEP)</option>
          <option value="PA">Pasaporte (PA)</option>
          <option value="RC">Registro Civil (RC)</option>
          <option value="N/D">N/D</option>
        </select>
      )
    }

    return (
      <Select value={docType} onValueChange={(value: string) => setDocType(value)}>
        <SelectTrigger>
          <SelectValue placeholder="Selecciona el tipo de documento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="CC">Cédula de Ciudadanía (CC)</SelectItem>
          <SelectItem value="CE">Cédula de Extranjería (CE)</SelectItem>
          <SelectItem value="NIT">NIT</SelectItem>
          <SelectItem value="TI">Tarjeta de Identidad (TI)</SelectItem>
          <SelectItem value="PEP">Permiso Especial de Permanencia (PEP)</SelectItem>
          <SelectItem value="PA">Pasaporte (PA)</SelectItem>
          <SelectItem value="RC">Registro Civil (RC)</SelectItem>
          <SelectItem value="N/D">N/D</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  // Cargar respuestas guardadas al inicializar
  useEffect(() => {
    if (surveyData) {
      const storedAnswers = localStorage.getItem("surveyPreviewAnswers")
      if (storedAnswers) {
        try {
          const parsedAnswers = JSON.parse(storedAnswers)
  
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

    // La reconciliación automática se maneja en un efecto separado

    // Debug: Mostrar información de la lógica de visualización
    

    // Evaluar cada condición
    for (const condition of conditions) {
      const { questionId, operator, value } = condition
      
      // RECONCILIACIÓN AUTOMÁTICA: Si el questionId no se encuentra, intentar por texto
      let actualQuestionId = questionId
      let answer = answers[questionId]
      
      // Si no hay respuesta para este ID, intentar reconciliación automática
      if (answer === undefined || answer === null || answer === "") {

        
        // Buscar la pregunta por texto en todas las secciones
        let foundQuestion: Question | null = null
        for (const section of surveyData?.sections || []) {
          const found = section.questions.find(q => q.text === condition.questionText)
          if (found) {
            foundQuestion = found
    
            actualQuestionId = foundQuestion.id
            answer = answers[foundQuestion.id]
            break
          }
        }
        
        // Si aún no se encuentra, intentar por ID similar o buscar en respuestas existentes
        if (!foundQuestion) {
  
          
          // Buscar en las respuestas existentes para encontrar la pregunta correcta
          for (const [responseId, responseValue] of Object.entries(answers)) {
            // Buscar la pregunta que corresponde a esta respuesta
            for (const section of surveyData?.sections || []) {
              const responseQuestion = section.questions.find(q => q.id === responseId)
              if (responseQuestion && responseQuestion.text === condition.questionText) {
        
                actualQuestionId = responseId
                answer = responseValue
                foundQuestion = responseQuestion
                break
              }
            }
            if (foundQuestion) break
          }
        }
        
        if (!foundQuestion) {
  
          return false
        }
      }
      
      
      
      if (answer === undefined || answer === null || answer === "") {

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
  }, [answers, surveyData])

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
    if (!currentSection) return true;

    let isValid = true;
    const newErrors: { [questionId:string]: string } = {};

    currentSection.questions.forEach((question) => {
      // Don't validate questions that are hidden by display logic
      if (!shouldShowQuestion(question)) {
        return;
      }

      if (question.required) {
        if (question.type === 'matrix') {
          const config = question.config || question.settings || {};
          const matrixRows = config.matrixRows || question.matrixRows || [];
          
          if (matrixRows.length > 0) {
            const allRowsAnswered = matrixRows.every((row, i) => {
              // Check for row-level answer (radio, checkbox)
              const rowKey = `${question.id}_${i}`;
              const rowAnswer = answers[rowKey];
              if (rowAnswer !== undefined && rowAnswer !== null && rowAnswer !== "") {
                if (Array.isArray(rowAnswer)) {
                  return rowAnswer.length > 0;
                }
                return true; // It's a non-empty string or other value
              }

              // If no row-level answer, check for cell-level answers (text, number, etc.)
              const matrixCols = config.matrixCols || question.matrixCols || [];
              return matrixCols.some((col, j) => {
                const cellKey = `${question.id}_${i}_${j}`;
                const cellAnswer = answers[cellKey];
                return cellAnswer !== undefined && cellAnswer !== null && cellAnswer !== "";
              });
            });

            if (!allRowsAnswered) {
              isValid = false;
              newErrors[question.id] = "Esta pregunta es obligatoria. Por favor, responde todas las filas.";
            }
          }
        } else {
          // Standard validation for all other question types
          const answer = answers[question.id];
          if (answer === undefined || answer === null || answer === "" || (Array.isArray(answer) && answer.length === 0)) {
            isValid = false;
            newErrors[question.id] = "Esta pregunta es obligatoria.";
          }
        }
      }
    });

    setValidationErrors(newErrors);
    return isValid;
  }, [currentSection, answers, shouldShowQuestion])

  // Submit responses helper: includes respondent_public_id and document fields if available
  const submitResponses = useCallback(async () => {
    if (!surveyData) return
    // infer survey id from pathname
    let surveyId: string | null = inferredSurveyId
    if (!surveyId) {
      try {
        const parts = window.location.pathname.split("/").filter(Boolean)
        const idx = parts.indexOf("survey")
        if (idx !== -1 && parts.length > idx + 1) surveyId = parts[idx + 1]
      } catch {}
    }

    const respondentKey = surveyId ? `respondent_public_id_${surveyId}` : "respondent_public_id"
    const respondentId = localStorage.getItem(respondentKey) || null
    const docTypeKey = surveyId ? `respondent_document_type_${surveyId}` : "respondent_document_type"
    const docNumKey = surveyId ? `respondent_document_number_${surveyId}` : "respondent_document_number"
    const nameKey = surveyId ? `respondent_name_${surveyId}` : "respondent_name"

    const payload: any = {
      survey_id: surveyId,
      response_answers: Object.entries(answers).map(([question_id, value]) => ({ question_id, value })),
      timestamp: new Date().toISOString(),
    }

    if (respondentId) payload.respondent_public_id = respondentId
    const dt = localStorage.getItem(docTypeKey)
    const dn = localStorage.getItem(docNumKey)
    const rn = localStorage.getItem(nameKey)
    if (dt) payload.respondent_document_type = dt
    if (dn) payload.respondent_document_number = dn
    if (rn) payload.respondent_name = rn

    try {
      const res = await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const status = res.status
      let json: any = null
      try {
        json = await res.json()
      } catch (parseErr) {
        // Body was not valid JSON; capture raw text for diagnostics
        try {
          const raw = await res.text()
          json = { _raw: raw }
        } catch (tErr) {
          json = { _raw_error: String(tErr) }
        }
      }

      if (!res.ok) {
        console.error('Error enviando respuestas:', { status, body: json })
        const description = (json && (json.error || json.message || json.details || json._raw)) || 'No se pudo enviar la respuesta'
        toast({ title: 'Error', description, variant: 'destructive' })
        return false
      }

      toast({ title: 'Encuesta completada', description: 'Gracias por tu participación' })
      return true
    } catch (err) {
      console.error('Error de red al enviar respuestas:', err)
      toast({ title: 'Error', description: 'Error de red al enviar respuestas', variant: 'destructive' })
      return false
    }
  }, [answers, inferredSurveyId, surveyData, toast])

  const handleNextSection = useCallback(async () => {
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
      // We're at the end: submit responses including respondent_public_id if present
      setSubmissionStatus("idle")
      const ok = await submitResponses()
      if (ok) setSubmissionStatus("success")
      else setSubmissionStatus("error")
    }
  }, [currentSection, answers, currentSectionIndex, totalSections, surveyData, submitResponses, validateCurrentSection])

  const handlePreviousSection = useCallback(() => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex((prev) => prev - 1)
    }
  }, [currentSectionIndex])

  // Componente Likert con segmentos clickeables - GARANTIZA que nunca quede entre opciones
  const LikertSliderWithDivisions = ({ 
    questionId,
    min, 
    max, 
    step, 
    value, 
    onValueChange,
    labels,
    showZero,
    zeroLabel,
    themeColors,
    originalMin
  }: { 
    questionId: string
    min: number
    max: number
    step: number
    value: number
    onValueChange: (value: number) => void
    labels: string[]
    showZero: boolean
    zeroLabel: string
    themeColors: { primary: string; background: string; text: string }
    originalMin?: number
  }) => {
    // Si no se pasa originalMin, calcularlo: si showZero es true, entonces originalMin es 1
    const actualOriginalMin = originalMin !== undefined ? originalMin : (showZero ? 1 : min)
    const [localValue, setLocalValue] = useState<number>(value)
    
    // Sincronizar con valor externo
    useEffect(() => {
      setLocalValue(value)
    }, [value])
    
    // Generar SOLO valores que tienen labels configurados (left, center, right)
    const allValues: number[] = []
    // Si showZero, agregar 0 primero (siempre tiene label)
    if (showZero) {
      allValues.push(0)
    }
    // Agregar valores que tienen labels configurados explícitamente
    for (let i = originalMin !== undefined ? originalMin : min; i <= max; i += step) {
      const labelIndex = i - actualOriginalMin
      // Solo incluir valores que tienen label configurado (no vacío)
      const hasLabel = labelIndex >= 0 && labelIndex < labels.length && labels[labelIndex] && labels[labelIndex].trim()
      
      if (hasLabel) {
        if (!showZero || i !== 0) {
          allValues.push(i)
        }
      }
    }
    
    const handleClick = (val: number) => {
      setLocalValue(val)
      onValueChange(val)
    }
    
    // Calcular posición del valor seleccionado (0-100%)
    const selectedValue = localValue
    // Usar el rango basado en los valores reales que existen, no en min/max
    const actualMinValue = allValues.length > 0 ? allValues[0] : (showZero ? 0 : min)
    const actualMaxValue = allValues.length > 0 ? allValues[allValues.length - 1] : max
    const actualRange = actualMaxValue - actualMinValue
    
    // Obtener el label de la opción seleccionada
    const getSelectedLabel = () => {
      if (selectedValue === 0 && showZero) {
        return zeroLabel
      }
      const labelIndex = selectedValue - actualOriginalMin
      if (labelIndex >= 0 && labelIndex < labels.length) {
        return labels[labelIndex] || String(selectedValue)
      }
      return String(selectedValue)
    }
    
    const selectedLabel = getSelectedLabel()
    
    return (
      <div className="space-y-4">
        {/* Track con segmentos clickeables */}
        <div className="relative px-2 py-4">
          {/* Track base */}
          <div className="relative h-2 w-full flex items-center">
            {/* Fondo del track */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gray-200 rounded-full"></div>
            
            {/* Rango seleccionado - solo hasta la opción seleccionada */}
            {(() => {
              const selectedIndex = allValues.findIndex(v => v === selectedValue)
              if (selectedIndex === -1 || allValues.length === 0) return null
              
              const startPosition = 0
              const endPosition = actualRange > 0 ? ((selectedValue - actualMinValue) / actualRange) * 100 : 0
              
              return (
                <div
                  className="absolute top-0 h-2 rounded-full transition-all duration-200"
                  style={{
                    left: `${startPosition}%`,
                    width: `${endPosition}%`,
                    backgroundColor: themeColors.primary,
                  }}
                ></div>
              )
            })()}
            
            {/* Segmentos clickeables para cada opción */}
            {allValues.map((val, index) => {
              const valPosition = actualRange > 0 ? ((val - actualMinValue) / actualRange) * 100 : 0
              const nextPosition = index === allValues.length - 1 
                ? 100 
                : (actualRange > 0 ? ((allValues[index + 1] - actualMinValue) / actualRange) * 100 : 0)
              const width = nextPosition - valPosition
              const isSelected = selectedValue === val
              
              return (
                <button
                  key={`segment-${val}`}
                  type="button"
                  onClick={() => handleClick(val)}
                  className="absolute top-0 h-2 rounded-full transition-all duration-200 hover:bg-opacity-80 z-10"
                  style={{
                    left: `${valPosition}%`,
                    width: `${width}%`,
                    backgroundColor: isSelected ? themeColors.primary : 'transparent',
                    cursor: 'pointer'
                  }}
                  aria-label={`Seleccionar opción ${val}`}
                >
                  {/* Marcador visual para opción seleccionada */}
                  {isSelected && (
                    <div 
                      className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-4 bg-white shadow-lg transition-all duration-200"
                      style={{
                        borderColor: themeColors.primary,
                      }}
                    >
                      <div 
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold"
                        style={{ color: themeColors.primary }}
                      >
                        {val}
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
            
            {/* Marcadores para todas las opciones (no solo la seleccionada) */}
            {allValues.map((val, index) => {
              const valPosition = actualRange > 0 ? ((val - actualMinValue) / actualRange) * 100 : 0
              const isSelected = selectedValue === val
              
              if (isSelected) return null // Ya se muestra arriba
              
              return (
                <button
                  key={`marker-${val}`}
                  type="button"
                  onClick={() => handleClick(val)}
                  className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-2 bg-white hover:border-gray-400 hover:scale-110 transition-all duration-200 z-20 cursor-pointer"
                  style={{
                    left: `${valPosition}%`,
                    borderColor: '#d1d5db',
                  }}
                  aria-label={`Seleccionar opción ${val}`}
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-gray-600">
                    {val}
                  </div>
                </button>
              )
            })}
            
            {/* Líneas de división entre segmentos */}
            {allValues.slice(1).map((val, index) => {
              const valPosition = actualRange > 0 ? ((val - actualMinValue) / actualRange) * 100 : 0
              return (
                <div
                  key={`divider-${index}-${val}`}
                  className="absolute top-0 w-px h-2 bg-gray-300 z-0"
                  style={{
                    left: `${valPosition}%`,
                  }}
                ></div>
              )
            })}
          </div>
          
          {/* Labels debajo del slider - SOLO mostrar valores con labels */}
          <div className="flex justify-between text-xs text-muted-foreground mt-6">
            {allValues.map((val, index) => {
              const labelIndex = val === 0 ? -1 : val - actualOriginalMin
              const label = val === 0 ? zeroLabel : (labelIndex >= 0 && labelIndex < labels.length ? labels[labelIndex] || "" : "")
              const isSelected = selectedValue === val
              
              // Solo mostrar si tiene label (ya está filtrado arriba)
              if (val === 0 || (label && label.trim())) {
                const valPosition = actualRange > 0 ? ((val - actualMinValue) / actualRange) * 100 : 0
                
                return (
                  <div 
                    key={`label-${val}`}
                    className="text-center absolute"
                    style={{ 
                      left: `${valPosition}%`,
                      transform: 'translateX(-50%)',
                      color: isSelected ? themeColors.primary : undefined,
                      fontWeight: isSelected ? 'bold' : 'normal',
                      minWidth: '80px'
                    }}
                  >
                    <div className="font-medium">{val}</div>
                    {label && label.trim() && (
                      <div className="text-xs mt-1 max-w-[100px] mx-auto whitespace-nowrap">{label}</div>
                    )}
                  </div>
                )
              }
              return null
            })}
          </div>
        </div>
        
        {/* Indicador siempre visible de la opción seleccionada */}
        <div className="text-center pt-4 border-t border-gray-200">
          <div 
            className="inline-flex items-center gap-3 px-6 py-3 rounded-lg font-semibold shadow-sm"
            style={{
              backgroundColor: `${themeColors.primary}15`,
              color: themeColors.primary,
              border: `2px solid ${themeColors.primary}30`
            }}
          >
            <span className="text-sm">Opción seleccionada:</span>
            <span className="text-2xl font-bold">{selectedValue}</span>
            {selectedLabel && selectedLabel.trim() && (
              <span className="text-sm font-medium opacity-90">
                ({selectedLabel})
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

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
                {(question.options || []).map((option, idx) => {
                  const optionLabel = typeof option === 'object' && option !== null ? (option as any).label : option;
                  const optionValue = typeof option === 'object' && option !== null ? ((option as any).value || optionLabel) : option;
                  const imageUrl = typeof option === 'object' && option !== null ? ((option as any).image || (option as any).url || (option as any).src) : null;
                  return (
                    <div key={idx} className="flex items-center space-x-2">
                      <RadioGroupItem value={optionValue} id={`${question.id}-option-${idx}`} />
                      <Label htmlFor={`${question.id}-option-${idx}`} className="flex items-center gap-4">
                        {imageUrl && <img src={imageUrl} alt={optionLabel} className="w-16 h-16 object-cover rounded-md" />}
                        <span dangerouslySetInnerHTML={{ __html: optionLabel }} />
                      </Label>
                    </div>
                  );
                })}
                {question.config?.allowOther && (
                  <div className="flex items-center space-x-2 mt-2">
                    <RadioGroupItem value="__other__" id={`${question.id}-option-other`} />
                    <Label htmlFor={`${question.id}-option-other`}>
                      {question.config.otherText || 'Otro (especificar)'}
                    </Label>
                    {answers[question.id] === "__other__" && (
                      <input
                        type="text"
                        className="ml-2 border rounded px-2 py-1"
                        value={answers[`${question.id}_other`] || ""}
                        onChange={e => handleAnswerChange(`${question.id}_other`, e.target.value)}
                        placeholder="Especifica..."
                      />
                    )}
                  </div>
                )}
              </RadioGroup>
            )
          case "checkbox": {
            const selected = Array.isArray(answers[question.id]) ? answers[question.id] : [];
            const minSel = question.config?.minSelections ?? 0;
            const maxSel = question.config?.maxSelections ?? (question.options?.length || 99);
            const isMaxReached = selected.length >= maxSel;
            return (
              <div className="space-y-2">
                {(question.options || []).map((option, idx) => {
                  const optionLabel = typeof option === 'object' && option !== null ? (option as any).label : option;
                  const optionValue = typeof option === 'object' && option !== null ? ((option as any).value || optionLabel) : option;
                  const imageUrl = typeof option === 'object' && option !== null ? ((option as any).image || (option as any).url || (option as any).src) : null;
                  const checked = selected.includes(optionValue);
                  const disabled = !checked && isMaxReached;
                  return (
                    <div key={idx} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${question.id}-option-${idx}`}
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(checked) => {
                          const currentAnswers = new Set(selected);
                          if (checked) {
                            currentAnswers.add(optionValue);
                          } else {
                            currentAnswers.delete(optionValue);
                          }
                          handleAnswerChange(question.id, Array.from(currentAnswers));
                        }}
                      />
                      <Label htmlFor={`${question.id}-option-${idx}`} className="flex items-center gap-4">
                        {imageUrl && <img src={imageUrl} alt={optionLabel} className="w-16 h-16 object-cover rounded-md" />}
                        {optionLabel}
                      </Label>
                    </div>
                  );
                })}
                {question.config?.allowOther && (
                  <div className="flex items-center space-x-2 mt-2">
                    <Checkbox
                      id={`${question.id}-option-other`}
                      checked={selected.includes("__other__")}
                      disabled={!selected.includes("__other__") && isMaxReached}
                      onCheckedChange={(checked) => {
                        let currentAnswers = new Set(selected);
                        if (checked) {
                          currentAnswers.add("__other__");
                        } else {
                          currentAnswers.delete("__other__");
                        }
                        handleAnswerChange(question.id, Array.from(currentAnswers));
                      }}
                    />
                    <Label htmlFor={`${question.id}-option-other`}>
                      {question.config.otherText || 'Otro (especificar)'}
                    </Label>
                    {selected.includes("__other__") && (
                      <input
                        type="text"
                        className="ml-2 border rounded px-2 py-1"
                        value={answers[`${question.id}_other`] || ""}
                        onChange={e => handleAnswerChange(`${question.id}_other`, e.target.value)}
                        placeholder="Especifica..."
                      />
                    )}
                  </div>
                )}
                {(minSel > 0 || maxSel < (question.options?.length || 99)) && (
                  <div className="text-xs text-muted-foreground mt-2">
                    {minSel > 0 && maxSel < (question.options?.length || 99)
                      ? `Selecciona entre ${minSel} y ${maxSel} opciones.`
                      : minSel > 0
                        ? `Selecciona al menos ${minSel} opción${minSel > 1 ? 'es' : ''}.`
                        : `Selecciona hasta ${maxSel} opción${maxSel > 1 ? 'es' : ''}.`}
                  </div>
                )}
              </div>
            );
          }
          case "dropdown":
            return (
              <div>
                <Select value={answers[question.id] || ""} onValueChange={(value) => handleAnswerChange(question.id, value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una opción..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(question.options || []).map((option, idx) => {
                      const optionLabel = typeof option === 'object' && option !== null ? (option as any).label : option;
                      const optionValue = typeof option === 'object' && option !== null ? ((option as any).value || optionLabel) : option;
                      return (
                        <SelectItem key={idx} value={optionValue}>
                          {optionLabel}
                        </SelectItem>
                      );
                    })}
                    {question.config?.allowOther && (
                      <SelectItem value="__other__">{question.config.otherText || 'Otro (especificar)'}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {question.config?.allowOther && answers[question.id] === "__other__" && (
                  <input
                    type="text"
                    className="mt-2 border rounded px-2 py-1"
                    value={answers[`${question.id}_other`] || ""}
                    onChange={e => handleAnswerChange(`${question.id}_other`, e.target.value)}
                    placeholder="Especifica..."
                  />
                )}
              </div>
            )
          case "rating":
          case "star_rating": {
            // Obtener configuración de emojis personalizados
            const min = question.config?.ratingMin ?? 1;
            const max = question.config?.ratingMax ?? 5;
            const emojis = Array.isArray(question.config?.ratingEmojis)
              ? question.config.ratingEmojis
              : Array.from({ length: max - min + 1 }, (_, i) => ["😞", "😐", "😊", "😁", "😍"][i] || "⭐");
            return (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-muted-foreground">{min}</span>
                <div className="flex space-x-1">
                  {emojis.map((emoji, idx) => {
                    const value = min + idx;
                    const isActive = answers[question.id] === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleAnswerChange(question.id, value)}
                        className={`p-2 rounded-lg transition-colors text-2xl ${
                          isActive
                            ? "bg-primary text-primary-foreground scale-110 shadow-lg"
                            : "bg-muted hover:bg-muted/80"
                        }`}
                        aria-label={`Valoración ${value}`}
                      >
                        {typeof emoji === 'object' && emoji !== null ? (emoji as any).image || (emoji as any).label : emoji}
                      </button>
                    );
                  })}
                </div>
                <span className="text-sm text-muted-foreground">{max}</span>
              </div>
            );
          }
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
            const defaultLabels = ["Muy en desacuerdo", "Neutral", "Muy de acuerdo"];
            const likertScale = question.config?.likertScale || {};
            const showZero = !!likertScale.showZero;
            const zeroLabel = likertScale.zeroLabel || 'No Sabe / No Responde';
            
            // Obtener min/max originales para el cálculo de labels (sin considerar showZero)
            const originalMin = typeof likertScale.min === 'number' ? likertScale.min : 
                               typeof question.config?.scaleMin === 'number' ? question.config.scaleMin : 1;
            const originalMax = typeof likertScale.max === 'number' ? likertScale.max : 
                               typeof question.config?.scaleMax === 'number' ? question.config.scaleMax : 5;
            const step = typeof likertScale.step === 'number' ? likertScale.step : 1;
            
            // min para el slider (0 si showZero, sino originalMin)
            const min = showZero ? 0 : originalMin;
            const max = originalMax;
            
            let labels = [];
            // Si labels es un objeto tipo {left, center, right}, mapearlo a un array para el slider
            if (likertScale.labels && typeof likertScale.labels === 'object' && !Array.isArray(likertScale.labels)) {
              // Calcular totalSteps usando originalMin (no 0) para los labels
              const totalSteps = Math.floor((originalMax - originalMin) / step) + 1;
              labels = Array(totalSteps).fill("");
              // left - siempre en índice 0 del array de labels (corresponde a valor originalMin)
              labels[0] = likertScale.labels.left || "";
              // right - siempre en el último índice
              labels[labels.length - 1] = likertScale.labels.right || "";
              // center - solo si hay un punto medio y el número de pasos es impar
              if (typeof likertScale.labels.center === 'string' && totalSteps % 2 === 1) {
                const centerIdx = Math.floor(totalSteps / 2);
                labels[centerIdx] = likertScale.labels.center;
              }
            } else if (Array.isArray(likertScale.labels)) {
              labels = likertScale.labels;
            } else {
              // fallback
              labels = defaultLabels;
            }
            
            // Validar que los labels tengan la cantidad correcta
            const totalSteps = Math.floor((originalMax - originalMin) / step) + 1;
            if (labels.length !== totalSteps) {
              // Si hay 3 labels y muchos pasos, solo poner left/center/right
              if (labels.length === 3 && totalSteps > 3) {
                const arr = Array(totalSteps).fill("");
                arr[0] = labels[0]; // left
                arr[Math.floor(arr.length / 2)] = labels[1]; // center
                arr[arr.length - 1] = labels[2]; // right
                labels = arr;
              } else {
                // Si no, rellenar con vacíos y poner defaults
                labels = Array(totalSteps).fill("");
                labels[0] = defaultLabels[0];
                labels[labels.length - 1] = defaultLabels[2];
                if (labels.length % 2 === 1) {
                  labels[Math.floor(labels.length / 2)] = defaultLabels[1];
                }
              }
            }
            // Si showZero, agregar el label de 0 al inicio visualmente
            const value = answers[question.id] !== undefined ? answers[question.id] : min;
            
            return (
              <LikertSliderWithDivisions
                questionId={question.id}
                min={min}
                max={max}
                step={step}
                value={value}
                onValueChange={(val) => handleAnswerChange(question.id, val)}
                labels={labels}
                showZero={showZero}
                zeroLabel={zeroLabel}
                themeColors={themeColors}
                originalMin={originalMin}
              />
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
          case "time": {
            const timeFormat = question.config?.timeFormat || "24";
            const value = answers[question.id] || ""; // e.g., "14:30"

            if (timeFormat === "12") {
              const [currentHourStr, currentMinuteStr] = value ? value.split(':') : ["", ""];
              let currentHour = parseInt(currentHourStr, 10);
              const currentMinute = parseInt(currentMinuteStr, 10);
              let currentAmpm = 'AM';

              if (!isNaN(currentHour)) {
                  if (currentHour >= 12) {
                      currentAmpm = 'PM';
                      if (currentHour > 12) {
                          currentHour -= 12;
                      }
                  }
                  if (currentHour === 0) {
                      currentHour = 12; // 12 AM
                  }
              }

              const handle12hChange = (part: 'hour' | 'minute' | 'ampm', val: string) => {
                  let h12 = !isNaN(currentHour) ? currentHour : 12;
                  let m = !isNaN(currentMinute) ? currentMinute : 0;
                  let ampm = currentAmpm;

                  if (part === 'hour') h12 = parseInt(val, 10);
                  if (part === 'minute') m = parseInt(val, 10);
                  if (part === 'ampm') ampm = val;

                  let h24 = h12;
                  if (ampm === 'PM' && h12 < 12) {
                      h24 = h12 + 12;
                  } else if (ampm === 'AM' && h12 === 12) { // 12 AM (midnight)
                      h24 = 0;
                  } else if (ampm === 'PM' && h12 === 12) { // 12 PM (noon)
                      h24 = 12;
                  }

                  const finalTime = `${h24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                  handleAnswerChange(question.id, finalTime);
              };

              return (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                      <Select value={!isNaN(currentHour) ? currentHour.toString() : ""} onValueChange={(v) => handle12hChange('hour', v)}>
                          <SelectTrigger className="w-[90px]">
                              <SelectValue placeholder="Hora" />
                          </SelectTrigger>
                          <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                  <SelectItem key={h} value={h.toString()}>{h.toString().padStart(2, '0')}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                      <span className="font-bold">:</span>
                      <Select value={!isNaN(currentMinute) ? currentMinute.toString().padStart(2, '0') : "00"} onValueChange={(v) => handle12hChange('minute', v)}>
                          <SelectTrigger className="w-[90px]">
                              <SelectValue placeholder="Min" />
                          </SelectTrigger>
                          <SelectContent>
                              {Array.from({ length: 60 }, (_, i) => i).map(m => (
                                  <SelectItem key={m} value={m.toString().padStart(2, '0')}>{m.toString().padStart(2, '0')}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                      <Select value={currentAmpm} onValueChange={(v) => handle12hChange('ampm', v)}>
                          <SelectTrigger className="w-[90px]">
                              <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="AM">AM</SelectItem>
                              <SelectItem value="PM">PM</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Formato 12 horas (AM/PM)</div>
                </div>
              );

            } else { // 24 hour format
              const [currentHour, currentMinute] = value ? value.split(':') : ["", ""];

              const handle24hChange = (part: 'hour' | 'minute', val: string) => {
                  let h = currentHour || "00";
                  let m = currentMinute || "00";
                  if (part === 'hour') h = val;
                  if (part === 'minute') m = val;
                  handleAnswerChange(question.id, `${h}:${m}`);
              };

              return (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                      <Select value={currentHour} onValueChange={(v) => handle24hChange('hour', v)}>
                          <SelectTrigger className="w-[90px]">
                              <SelectValue placeholder="Hora" />
                          </SelectTrigger>
                          <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => i).map(h => (
                                  <SelectItem key={h} value={h.toString().padStart(2, '0')}>{h.toString().padStart(2, '0')}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                      <span className="font-bold">:</span>
                      <Select value={currentMinute} onValueChange={(v) => handle24hChange('minute', v)}>
                          <SelectTrigger className="w-[90px]">
                              <SelectValue placeholder="Min" />
                          </SelectTrigger>
                          <SelectContent>
                              {Array.from({ length: 60 }, (_, i) => i).map(m => (
                                  <SelectItem key={m} value={m.toString().padStart(2, '0')}>{m.toString().padStart(2, '0')}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Formato 24 horas (00:00 - 23:59)</div>
                </div>
              );
            }
          }
          case "email":
    
            return (
              <EmailAutocompleteInput
                value={answers[question.id] || ""}
                onChange={val => handleAnswerChange(question.id, val)}
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
                    const file = e.target.files?.[0];
                    if (file) {
                      // Validar tipo y tamaño
                      const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
                      const maxSize = 20 * 1024 * 1024; // 20 MB
                      if (!allowedTypes.includes(file.type)) {
                        alert("Solo se permiten archivos JPG, PNG o PDF.");
                        e.target.value = "";
                        return;
                      }
                      if (file.size > maxSize) {
                        alert("El archivo no debe superar los 20 MB.");
                        e.target.value = "";
                        return;
                      }
                      handleAnswerChange(question.id, file.name);
                    }
                  }}
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="w-full"
                />
                <div className="text-xs text-blue-700 bg-blue-50 rounded px-3 py-2 border border-blue-100">
                  Formatos permitidos: <b>JPG, PNG, PDF</b> &nbsp;|&nbsp; Tamaño máximo: <b>20 MB</b>
                </div>
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
            const questionConfig = question.config || question.settings || {};
            
            const contactInfoConfig = {
                showName: !!questionConfig.includeFirstName,
                showPhone: !!questionConfig.includePhone,
                showDocument: !!questionConfig.includeDocument,
                showEmail: questionConfig.includeEmail !== undefined ? !!questionConfig.includeEmail : true,
            };

            return (
              <ContactInfoQuestion
                surveyId={inferredSurveyId || ""}
                onChange={(value) => handleAnswerChange(question.id, value)}
                config={contactInfoConfig}
              />
            )
          case "ranking": {
            // Guardar el orden en answers[question.id] como array
            const currentOrder = Array.isArray(answers[question.id]) && answers[question.id].length === (question.options || []).length
              ? answers[question.id]
              : question.options || [];
            return (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-2">Arrastra para ordenar las opciones</p>
                <RankingPreviewDraggable
                  options={question.options || []}
                  value={currentOrder}
                  onChange={(newOrder) => handleAnswerChange(question.id, newOrder)}
                />
              </div>
            );
          }
          case "matrix": {
            // Siempre priorizar config/settings sobre el root
            const config = question.config || question.settings || {};
            const matrixRows = config.matrixRows || question.matrixRows || [];
            const matrixCols = config.matrixCols || question.matrixCols || [];
            const matrixColOptions = config.matrixColOptions || question.matrixColOptions || [];
            const cellType = config.matrixCellType || question.matrixCellType || "radio";
            const matrixRatingScale = config.matrixRatingScale || question.matrixRatingScale || 5;
            // Debug: Mostrar configuración de la matriz en consola
            console.log("[PREVIEW MATRIX CONFIG]", {
              matrixRows,
              matrixCols,
              matrixColOptions,
              cellType,
              config,
              question
            });
            return (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border p-2 bg-muted"></th>
                        {matrixCols.map((col, idx) => (
                          <th key={idx} className="border p-2 bg-muted text-center">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrixRows.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          <td className="border p-2 bg-muted font-medium">{row}</td>
                          {matrixCols.map((col, colIdx) => (
                            <td key={colIdx} className="border p-2 text-center">
                              {(() => {
                                const cellKey = `${question.id}_${rowIdx}_${colIdx}`;
                                switch (cellType) {
                                  case "checkbox": {
                                    // Para cada fila, la respuesta es un array de columnas seleccionadas
                                    const rowKey = `${question.id}_${rowIdx}`;
                                    const selected = Array.isArray(answers[rowKey]) ? answers[rowKey] : [];
                                    // Permitir min/max por fila si se configura (puedes extender esto si lo necesitas)
                                    const minSel = config.minSelections ?? 0;
                                    const maxSel = config.maxSelections ?? matrixCols.length;
                                    const isChecked = selected.includes(colIdx);
                                    const isMaxReached = selected.length >= maxSel && !isChecked;
                                    return (
                                      <Checkbox
                                        checked={isChecked}
                                        disabled={isMaxReached}
                                        onCheckedChange={(checked) => {
                                          let currentAnswers = new Set(selected);
                                          if (checked) {
                                            currentAnswers.add(colIdx);
                                          } else {
                                            currentAnswers.delete(colIdx);
                                          }
                                          handleAnswerChange(rowKey, Array.from(currentAnswers));
                                        }}
                                      />
                                    );
                                  }
                                  case "text":
                                    return (
                                      <Input
                                        value={answers[cellKey] || ""}
                                        onChange={(e) => handleAnswerChange(cellKey, e.target.value)}
                                        className="w-full"
                                        placeholder="Texto..."
                                      />
                                    );
                                  case "number":
                                    return (
                                      <Input
                                        type="number"
                                        value={answers[cellKey] || ""}
                                        onChange={(e) => handleAnswerChange(cellKey, e.target.value)}
                                        className="w-full"
                                        placeholder="0"
                                      />
                                    );
                                  case "select": {
                                    const colOptions = matrixColOptions[colIdx] || ["Opción 1"];
                                    return (
                                      <Select
                                        value={answers[cellKey] || ""}
                                        onValueChange={(value) => handleAnswerChange(cellKey, value)}
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue placeholder="Seleccionar..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {colOptions.map((opt, i) => {
                                            const cleanOpt = typeof opt === 'string' ? opt.trim() : '';
                                            return (
                                              <SelectItem key={i} value={cleanOpt}>{cleanOpt || <span className="text-gray-400">(vacío)</span>}</SelectItem>
                                            );
                                          })}
                                        </SelectContent>
                                      </Select>
                                    );
                                  }
                                  case "rating": {
                                    const stars = Number(matrixRatingScale);
                                    return (
                                      <div className="flex justify-center gap-1">
                                        {Array.from({ length: stars }, (_, i) => (
                                          <button
                                            key={i}
                                            type="button"
                                            className={`text-yellow-400 text-lg ${answers[cellKey] === i + 1 ? "font-bold" : "opacity-50"}`}
                                            onClick={() => handleAnswerChange(cellKey, i + 1)}
                                          >
                                            ★
                                          </button>
                                        ))}
                                      </div>
                                    );
                                  }
                                  case "ranking":
                                    // Simulación simple: input para posición
                                    return (
                                      <Input
                                        type="number"
                                        min={1}
                                        max={matrixRows.length}
                                        value={answers[cellKey] || ""}
                                        onChange={(e) => handleAnswerChange(cellKey, e.target.value)}
                                        className="w-16 text-center"
                                        placeholder={`#`}
                                      />
                                    );
                                  case "radio": {
                                    // Cada fila debe tener un grupo de radios, cada celda es una opción
                                    const radioKey = `${question.id}_${rowIdx}`;
                                    return (
                                      <input
                                        type="radio"
                                        name={radioKey}
                                        value={col}
                                        checked={answers[radioKey] === col}
                                        onChange={() => handleAnswerChange(radioKey, col)}
                                        className="cursor-pointer"
                                      />
                                    );
                                  }
                                  default:
                                    return <Input disabled className="w-full" placeholder={`Tipo ${cellType} no soportado`} />;
                                }
                              })()}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }
          case "multiple_textboxes":
            {
              const labels = question.config?.textboxLabels || question.options || [];
              return (
                <div className="space-y-4">
                  {labels.map((label, idx) => (
                    <div key={idx} className="space-y-2">
                      <Label>{label}</Label>
                      <Input
                        value={answers[`${question.id}_${idx}`] || ""}
                        onChange={(e) => handleAnswerChange(`${question.id}_${idx}`, e.target.value)}
                        placeholder={`Respuesta para ${label}`}
                      />
                    </div>
                  ))}
                </div>
              )
            }
          default:
            return <Input {...commonProps} placeholder={`Tipo de pregunta "${question.type}" no soportado en preview`} disabled />
        }
      }

      return (
        <div key={question.id} id={`question-${question.id}`} className="mb-8 p-8 border-2 rounded-2xl bg-gradient-to-br from-white via-gray-50/50 to-green-50/30 hover:shadow-2xl transition-all duration-500 transform hover:scale-[1.02] border-gray-200/60 preview-content">
          <style jsx global>{`
            .preview-content h1 {
              font-size: 2.25rem;
              font-weight: bold;
              margin: 0.5em 0;
            }
            .preview-content h2 {
              font-size: 1.5rem;
              font-weight: bold;
              margin: 0.5em 0;
            }
          `}</style>
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
                  className="question-title-html flex-1"
                  dangerouslySetInnerHTML={{ __html: question.text_html || question.text || "Pregunta sin texto" }}
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

  // Estilos dinámicos para aplicar el color de fondo y color primario
  const dynamicStyles = (
    <style jsx global>{`
      body, .preview-bg {
        background: ${themeColors.background} !important;
      }
      .preview-header {
        background: transparent;
      }
      .preview-title {
        color: ${themeColors.text} !important;
        background: none !important;
        -webkit-background-clip: initial !important;
        -webkit-text-fill-color: initial !important;
      }
      .preview-progress-bar {
        background: ${themeColors.primary} !important;
      }
      .preview-card {
        background: ${themeColors.background} !important;
      }
      .preview-btn-primary {
        background: ${themeColors.primary} !important;
        border-color: ${themeColors.primary} !important;
        color: #fff !important;
      }
    `}</style>
  )

  return (
    <div className="min-h-screen preview-bg flex flex-col items-center p-4 sm:p-8">
      {appLoadError && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-6">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full text-left">
            <h3 className="text-xl font-bold mb-2">Error de carga de la aplicación</h3>
            <p className="mb-4 text-sm text-muted-foreground">Se detectaron exports faltantes que impedirán el render en producción. Componentes faltantes:</p>
            <ul className="mb-4 list-disc pl-5 text-sm text-red-700">
              {appLoadError.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setAppLoadError(null)}>Ignorar (no recomendado)</Button>
            </div>
          </div>
        </div>
      )}
      {/* Verification modal shown before survey */}
      {/* {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">Verificación de encuestado</h3>
            <p className="text-sm text-muted-foreground mb-4">Antes de iniciar, por favor ingresa tu tipo y número de documento para verificar si ya respondiste.</p>
            <div className="space-y-3">
              <div>
                <Label className="mb-2">Tipo de documento</Label>
                <DocTypeSelect />
              </div>
              <Input placeholder="Número de documento" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
              <Input placeholder="Nombre completo (opcional)" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              {verifyError && <div className="text-sm text-red-600">{verifyError}</div>}
            </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowVerifyModal(false)
                    if (inferredSurveyId) {
                      localStorage.setItem(`respondent_public_id_${inferredSurveyId}`, "anonymous")
                    } else {
                      localStorage.setItem("respondent_public_id", "anonymous")
                    }
                  }}
                  disabled={verifying}
                >
                  Continuar como invitado
                </Button>
                <Button onClick={handleVerify} disabled={verifying} className="ml-2">
                  {verifying ? <Loader2 className="animate-spin h-4 w-4" /> : "Verificar y continuar"}
                </Button>
              </div>
          </div>
        </div>
      )} */}
      {dynamicStyles}
      {/* Header principal */}
      <div className="w-full max-w-5xl mb-8 preview-header">
        <Card className="border-0 shadow-2xl preview-card">
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
            <div className="flex flex-col items-center justify-center">
              {/* Mostrar logo si existe en branding_config.logo (base64) */}
              {surveyData?.settings?.branding?.showLogo && surveyData?.settings?.branding?.logo && (
                <img
                  src={surveyData.settings.branding.logo}
                  alt="Logo de la encuesta"
                  className="mx-auto mb-4 max-h-24 max-w-xs object-contain rounded-xl shadow"
                  style={{
                    display: 'block',
                  }}
                />
              )}
              <CardTitle 
                className="text-5xl font-bold mb-4 preview-title"
                style={{
                  color: themeColors.text
                }}
              >
                {surveyData.title}
              </CardTitle>
              {surveyData.description && (
                <div className="flex justify-center mb-6">
                  <div className="max-w-3xl w-full bg-blue-50/80 rounded-xl shadow p-5 text-center text-blue-900 text-lg border border-blue-100 font-normal leading-relaxed">
                    {surveyData.description}
                  </div>
                </div>
              )}
              {/* Barra de progreso mejorada */}
              <div className="mt-8 max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700">Progreso de la encuesta</span>
                  <span className="text-sm font-semibold text-gray-700">
                    {currentSectionIndex + 1} de {totalSections}
                  </span>
                </div>
                <div className="relative w-full">
                  <div className="w-full h-4 rounded-full bg-gray-100" />
                  <div
                    className="absolute top-0 left-0 h-4 rounded-full preview-progress-bar"
                    style={{
                      width: `${progress}%`,
                      background: themeColors.primary,
                      transition: 'width 0.4s cubic-bezier(.4,2,.6,1)',
                    }}
                  />
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
      <Card className="w-full max-w-5xl shadow-2xl border-0 preview-card">
        <CardContent className="p-10">
          {/* Header de la sección */}
          <div className="text-center mb-10 preview-content">
      <style jsx global>{`
        .preview-content h1 {
          font-size: 2.25rem;
          font-weight: bold;
          margin: 0.5em 0;
        }
        .preview-content h2 {
          font-size: 1.5rem;
          font-weight: bold;
          margin: 0.5em 0;
        }
      `}</style>
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
            {currentSection.title_html ? (
              <div
                dangerouslySetInnerHTML={{ __html: currentSection.title_html }}
              />
            ) : (
              <div className="text-4xl font-bold text-center mb-3">
                {currentSection.title ? currentSection.title : `Sección ${currentSectionIndex + 1}`}
              </div>
            )}
            {currentSection.description && (
              <div className="flex justify-center mt-2 mb-6">
                <div className="max-w-2xl w-full bg-emerald-50/80 rounded-lg shadow p-4 text-center text-emerald-900 text-base border border-emerald-100 font-normal leading-relaxed">
                  {currentSection.description.replace(/<[^>]+>/g, "")}
                </div>
              </div>
            )}
      {/* Eliminado el CSS global que sobrescribía h1/h2 para respetar el HTML enriquecido */}
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

          {/* Indicador de reconciliación automática */}
          {isReconciling && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-800 font-medium">Reconciliando IDs automáticamente...</span>
              </div>
              <AlertDescription className="text-green-700 text-sm mt-1">
                El sistema está verificando y corrigiendo automáticamente las referencias de preguntas en la lógica de visualización.
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
                renderQuestion(question, qIndex)
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
  // El fondo general ahora se maneja con .preview-bg
  return <PreviewSurveyPageContent />
}
