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
import { SignaturePad } from "@/components/signature-pad"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmailAutocompleteInput } from "@/components/EmailAutocompleteInput";
import LikertSlider from "@/components/LikertSlider"

import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, ArrowRight, Loader2, Star, CheckCircle, AlertCircle, Info, Target, Camera } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ContactInfoQuestion } from "@/components/contact-info-question"
import { LocationQuestion } from "@/components/location-question"
import { CameraCaptureModal } from "@/components/camera-capture-modal"

// Tipos para la lógica de secciones y preguntas
interface Question {
  id: string
  type: string
  text: string
  text_html?: string
  title?: string
  options: string[]
  required: boolean
  image?: string | null
  matrixRows?: string[]
  matrixCols?: string[]
  matrixColOptions?: any[]
  matrixCellType?: string
  matrixRatingScale?: any
  ratingScale?: number
  settings?: any
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
      logicalOperator?: string
      conditions: Array<{
        questionId: string
        questionText?: string
        operator: string
        value: string
        logicalOperator?: string
      }>
    }
    skipLogic?: {
      enabled: boolean
      rules: Array<{
        condition: string
        action?: string
        targetSectionId: string
        targetQuestionId?: string
        targetQuestionText?: string
        enabled: boolean
        operator: string
        value: string
        [key: string]: any
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
  title_html?: string
  description?: string
  order_num: number
  questions: Question[]
  skip_logic?: {
    enabled: boolean
    target_type: string
    target_section_id?: string
    target_question_id?: string
    action?: string
    targetSectionId?: string
    [key: string]: any
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



// Props opcionales, aditivas: si no se pasan, el componente se comporta
// exactamente igual que antes (usado por /preview/survey y /encuesta/[id]
// públicos). El portal de encuestador (/portal-encuestador/encuesta/[id])
// las usa para: (1) ligar la respuesta al assignment del encuestador
// logueado, y (2) enterarse de cuándo termina el envío sin necesidad de
// tocar el flujo interno de envío/skip-logic de este componente.
interface PreviewSurveyPageContentProps {
  assignmentId?: string
  onSubmitted?: (responseId: string) => void
}

function PreviewSurveyPageContent({ assignmentId, onSubmitted }: PreviewSurveyPageContentProps = {}) {
  // ...existing code...
  const router = useRouter()
  const [surveyData, setSurveyData] = useState<PreviewSurveyData | null>(null)
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [answers, setAnswers] = useState<{ [questionId: string]: any }>({})
  const [submissionStatus, setSubmissionStatus] = useState<"idle" | "success" | "error">("idle")
  // SEGURIDAD/INTEGRIDAD (auditoría 2026-07-29): "Finalizar Encuesta" no tenía
  // guardia de reentrada ni deshabilitaba el botón mientras se enviaba, así que
  // un doble tap (común en campo con conexión lenta) creaba dos filas en
  // `responses` para la misma persona. `isSubmittingResponse` deshabilita el
  // botón visualmente; `submissionInFlightRef` bloquea llamadas concurrentes
  // aunque el re-render aún no haya aplicado el disabled; `submissionTokenRef`
  // es una llave de idempotencia estable durante la vida de este componente,
  // reenviada en cada intento (incl. reintentos tras error de red) para que
  // /api/responses pueda detectar y descartar duplicados del mismo envío.
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false)
  const submissionInFlightRef = useRef(false)
  const submissionTokenRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  )
  // Estado para el modal de cámara (desktop) — null = cerrado, questionId = abierto para esa pregunta
  const [cameraModalQuestionId, setCameraModalQuestionId] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<{ [questionId: string]: string }>({})
  const [blockedQuestions, setBlockedQuestions] = useState<Set<string>>(new Set())
  const [skipLogicHistory, setSkipLogicHistory] = useState<string[]>([])
  const [skipLogicNotification, setSkipLogicNotification] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Modal / verification state
  // We'll infer the surveyId from the path and keep respondent id per-survey using localStorage key `respondent_public_id_${surveyId}`
  const [inferredSurveyId, setInferredSurveyId] = useState<string | null>(null)
  const [showVerifyModal, setShowVerifyModal] = useState(true)
  const [showFinishedDialog, setShowFinishedDialog] = useState(false)
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

  // Compact mode toggled when viewport is small (used to clamp long text when window is small)
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    const check = () => setIsCompact(typeof window !== 'undefined' ? window.innerHeight < 520 : false)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Cola offline (auditoría 2026-07-29): reintenta en segundo plano envíos
  // que quedaron guardados en IndexedDB por falta de señal (ver
  // lib/offline-queue.ts y el catch de submitResponses más abajo). Corre
  // tanto en el portal del encuestador como en /preview y /encuesta
  // públicos — si esta misma pestaña recupera conexión mientras el
  // encuestado sigue en ella, no hace falta esperar a que alguien visite
  // el dashboard del portal para que se sincronice.
  useEffect(() => {
    let cancelled = false
    const tryFlush = () => {
      import('@/lib/offline-queue').then(({ flushQueue }) => {
        if (!cancelled) flushQueue().catch(() => { })
      }).catch(() => { })
    }
    tryFlush()
    window.addEventListener('online', tryFlush)
    return () => {
      cancelled = true
      window.removeEventListener('online', tryFlush)
    }
  }, [])


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
      let idx = parts.indexOf("survey")
      if (idx === -1) idx = parts.indexOf("encuesta")
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
      // Try to infer surveyId from URL path: /preview/survey/[id] or /encuesta/[id]
      let inferredSurveyId: string | null = null
      try {
        const parts = window.location.pathname.split("/").filter(Boolean)
        let idx = parts.indexOf("survey")
        if (idx === -1) idx = parts.indexOf("encuesta")
        if (idx !== -1 && parts.length > idx + 1) inferredSurveyId = parts[idx + 1]
      } catch { }

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
          // Prefer server-provided name (json.respondent_name or json.full_name) to autofill
          const serverName = json.respondent_name || json.full_name || null
          if (serverName) {
            localStorage.setItem(`respondent_name_${inferredSurveyId}`, serverName)
            setFullName(serverName)
          } else if (fullName) {
            localStorage.setItem(`respondent_name_${inferredSurveyId}`, fullName)
          }
        } else {
          localStorage.setItem("respondent_public_id", json.respondent_public_id)
          if (docType) localStorage.setItem("respondent_document_type", docType)
          if (docNumber) localStorage.setItem("respondent_document_number", docNumber)
          const serverName = json.respondent_name || json.full_name || null
          if (serverName) {
            localStorage.setItem("respondent_name", serverName)
            setFullName(serverName)
          } else if (fullName) {
            localStorage.setItem("respondent_name", fullName)
          }
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

  // Debounced lookup: when user types docType/docNumber, try to autofill fullName from historical data
  useEffect(() => {
    if (!docType || !docNumber) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        // prefer passing survey id when available to check per-survey records first
        const q = new URLSearchParams({ document_type: docType, document_number: docNumber })
        if (inferredSurveyId) q.set('survey_id', inferredSurveyId)
        const res = await fetch(`/api/surveys/lookup-respondent?${q.toString()}`)
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        if (json.found && (json.respondent_name || json.full_name)) {
          const name = json.respondent_name || json.full_name
          setFullName(name)

          // Auto-rellenar preguntas de tipo contact_info
          if (surveyData && surveyData.sections) {
            setAnswers((prev) => {
              const updated = { ...prev }
              let changed = false

              surveyData.sections.forEach((section: any) => {
                section.questions.forEach((q: any) => {
                  if (q.type === 'contact_info') {
                    // Construir objeto de respuesta para contact_info
                    const contactAnswer = {
                      fullName: name,
                      documentType: docType,
                      documentNumber: docNumber,
                      email: json.email || '',
                      phone: json.phone || '',
                      address: json.address || '',
                      company: json.company || '',
                      // Preservar valores existentes si el usuario ya editó algo específico podría ser complejo,
                      // pero al hacer lookup explícito (cambiar cédula), el usuario espera que se carguen los datos.
                    }

                    updated[q.id] = contactAnswer
                    changed = true
                  }
                })
              })

              return changed ? updated : prev
            })
          }

          // store per-survey name if inferredSurveyId
          try {
            if (inferredSurveyId) localStorage.setItem(`respondent_name_${inferredSurveyId}`, name)
            else localStorage.setItem('respondent_name', name)
          } catch (e) {
            // ignore storage errors
          }
        }
      } catch (e) {
        // ignore lookup errors silently
      }
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [docType, docNumber, inferredSurveyId])

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

  // BUG (reporte 2026-07-29): la key de localStorage para las respuestas EN
  // CURSO (antes de enviar) era el string fijo "surveyPreviewAnswers", sin
  // distinguir de qué encuesta — si en el mismo dispositivo/navegador se
  // abría una encuesta distinta antes de terminar/enviar la anterior (muy
  // real en campo: un encuestador que cambia de encuesta a medio llenar, o
  // abandona una), las respuestas de la primera se colaban como estado
  // inicial de la segunda. Se namespacea por surveyId, igual que ya se hace
  // para respondent_public_id_${surveyId} etc.
  const previewAnswersKey = inferredSurveyId ? `surveyPreviewAnswers_${inferredSurveyId}` : "surveyPreviewAnswers"

  // Cargar respuestas guardadas al inicializar
  useEffect(() => {
    if (!surveyData) return
    try {
      const stored = localStorage.getItem(previewAnswersKey)
      if (stored) {
        setAnswers(JSON.parse(stored))
      } else if (inferredSurveyId) {
        // Migración de una sola vez: una sesión que ya estaba en curso antes
        // de este fix guardó bajo la key vieja sin namespacing.
        const legacy = localStorage.getItem("surveyPreviewAnswers")
        if (legacy) {
          setAnswers(JSON.parse(legacy))
          localStorage.removeItem("surveyPreviewAnswers")
        }
      }
    } catch (error) {
      console.error("❌ Error cargando respuestas guardadas:", error)
    }
    // Solo debe correr al resolverse survey/surveyId, no en cada cambio de answers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyData, inferredSurveyId])

  // Guardar respuestas automáticamente cuando cambien
  useEffect(() => {
    if (surveyData && Object.keys(answers).length > 0) {
      try {
        localStorage.setItem(previewAnswersKey, JSON.stringify(answers))
      } catch (error) {
        console.error("❌ Error guardando respuestas:", error)
      }
    }
  }, [answers, surveyData, previewAnswersKey])

  // Borra el borrador de respuestas en curso guardado en localStorage
  // (reporte 2026-07-29). Antes esto solo pasaba si la persona hacía clic
  // manual en "Iniciar otra" — si cerraba la pestaña justo después de
  // enviar, sin pasar por ese botón, el borrador quedaba cacheado y se
  // precargaba solo si el MISMO link se volvía a abrir después (kiosco,
  // varios respondentes con el mismo link, o el mismo encuestador
  // reabriendo la encuesta para la siguiente persona) — mostrando
  // respuestas de otra persona ya "completadas". Se llama automáticamente
  // apenas el envío queda a salvo (enviado, o encolado offline), no solo
  // al reiniciar manualmente.
  const clearStoredPreviewAnswers = useCallback(() => {
    try {
      localStorage.removeItem(previewAnswersKey)
      localStorage.removeItem("surveyPreviewAnswers") // key vieja sin namespacing, por si acaso
    } catch (e) {
      console.warn("No se pudo limpiar el borrador de respuestas en localStorage", e)
    }
  }, [previewAnswersKey])

  // Función para evaluar las condiciones de visualización
  /** Resuelve el ID real de una pregunta buscando por ID directo o por texto (reconciliación) */
  const resolveQuestionAnswer = useCallback((questionId: string, questionText?: string): any => {
    // Búsqueda directa por ID
    const direct = answers[questionId]
    if (direct !== undefined && direct !== null && direct !== "") return direct

    // Reconciliación: buscar por texto si el ID no tiene respuesta
    if (!questionText) return undefined
    for (const section of surveyData?.sections || []) {
      const found = section.questions.find(q => q.text === questionText)
      if (found && found.id !== questionId) {
        const byText = answers[found.id]
        if (byText !== undefined && byText !== null && byText !== "") return byText
      }
    }
    return undefined
  }, [answers, surveyData])

  /** Evalúa una condición individual de display logic.
   *
   * CORRECCIÓN (2026-08-12): condition.value puede ser una cadena con múltiples
   * valores separados por coma ("opcion1,opcion2") cuando el editor permite
   * seleccionar 2+ respuestas para la misma condición. El evaluador anterior
   * comparaba literalmente ese string, haciendo que nunca se cumpliera la
   * condición cuando había más de una opción seleccionada.
   * Ahora se parsea el CSV y se aplica OR implícito: la condición se cumple si
   * la respuesta del usuario coincide con AL MENOS UNO de los valores.
   */
  const evaluateCondition = useCallback((condition: any): boolean => {
    const answer = resolveQuestionAnswer(condition.questionId, condition.questionText)
    if (answer === undefined || answer === null || answer === "") return false

    // Parsear el valor de la condición: puede ser "a,b,c" (selección múltiple)
    const rawValue = String(condition.value ?? "")
    const condValues = rawValue.includes(",")
      ? rawValue.split(",").map((v) => v.trim()).filter(Boolean)
      : [rawValue]

    // Helper: ¿el answer cumple con UN valor de condición?
    const matchesSingleValue = (cv: string): boolean => {
      switch (condition.operator) {
        case "equals":
          return Array.isArray(answer) ? answer.includes(cv) : String(answer) === cv
        case "not_equals":
          // Para not_equals con múltiples valores: NO debe estar en ninguno
          // (se evalúa luego con every)
          return Array.isArray(answer) ? !answer.includes(cv) : String(answer) !== cv
        case "contains":
          return Array.isArray(answer) ? answer.includes(cv) : String(answer).includes(cv)
        case "not_contains":
          return Array.isArray(answer) ? !answer.includes(cv) : !String(answer).includes(cv)
        default:
          return false
      }
    }

    switch (condition.operator) {
      case "equals":
      case "contains":
        // OR: cumple si la respuesta coincide con AL MENOS UNO de los valores
        return condValues.some(matchesSingleValue)
      case "not_equals":
      case "not_contains":
        // AND negativo: solo cumple si la respuesta NO coincide con NINGUNO de los valores
        return condValues.every(matchesSingleValue)
      case "greater_than":
        return Number(answer) > Number(rawValue)
      case "less_than":
        return Number(answer) < Number(rawValue)
      case "greater_than_or_equal":
        return Number(answer) >= Number(rawValue)
      case "less_than_or_equal":
        return Number(answer) <= Number(rawValue)
      case "is_empty":
        return !answer || (Array.isArray(answer) ? answer.length === 0 : String(answer).trim() === "")
      case "is_not_empty":
        return !!(answer && (Array.isArray(answer) ? answer.length > 0 : String(answer).trim() !== ""))
      default:
        return false
    }
  }, [resolveQuestionAnswer])

  const shouldShowQuestion = useCallback((question: Question): boolean => {
    if (!question.config?.displayLogic?.enabled) return true

    const { conditions, logicalOperator = "AND" } = question.config.displayLogic
    if (!conditions || conditions.length === 0) return true

    if (logicalOperator === "OR") {
      // OR: mostrar si AL MENOS UNA condición se cumple
      return conditions.some((c: any) => evaluateCondition(c))
    }

    // AND (por defecto): mostrar solo si TODAS las condiciones se cumplen
    return conditions.every((c: any) => evaluateCondition(c))
  }, [evaluateCondition])

  const handleAnswerChange = useCallback((questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    setValidationErrors((prev) => {
      const newErrors = { ...prev }
      delete newErrors[questionId]
      return newErrors
    })
  }, [])

  // Resuelve el survey_id igual que submitResponses (infiere de la URL si el
  // state todavía no lo tiene) — factorizado aquí para que también lo use la
  // subida de archivos de preguntas tipo archivo/foto más abajo.
  const resolveSurveyId = useCallback((): string | null => {
    if (inferredSurveyId) return inferredSurveyId
    try {
      const parts = window.location.pathname.split("/").filter(Boolean)
      let idx = parts.indexOf("survey")
      if (idx === -1) idx = parts.indexOf("encuesta")
      if (idx !== -1 && parts.length > idx + 1) return parts[idx + 1]
    } catch { }
    return null
  }, [inferredSurveyId])

  // Sube un archivo real de una pregunta tipo archivo/foto (auditoría
  // 2026-07-29 — antes solo se guardaba el nombre, ver
  // app/api/response-files/upload/route.ts para el porqué). Si falla por
  // red (no por validación del servidor), devuelve un descriptor "pending"
  // con el File embebido para que se guarde igual en la respuesta y se
  // suba después desde la cola offline (lib/offline-queue.ts) — nunca se
  // pierde la foto por falta de señal.
  const uploadResponseFile = useCallback(async (file: File, questionId: string): Promise<any> => {
    const surveyId = resolveSurveyId()
    const base = { name: file.name, type: file.type, size: file.size }
    if (!surveyId) return { ...base, status: "pending", file }
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("survey_id", surveyId)
      form.append("question_id", questionId)
      const res = await fetch("/api/response-files/upload", { method: "POST", body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        // Error de VALIDACIÓN del servidor (tipo/tamaño/pregunta inválida) —
        // no es un problema de red, reintentarlo después no lo arregla.
        toast({ title: "No se pudo subir el archivo", description: body?.error || "Error desconocido", variant: "destructive" })
        return null
      }
      const json = await res.json()
      return { ...base, status: "uploaded", path: json.path }
    } catch (err) {
      console.error("Error de red subiendo archivo de respuesta, se guarda para reintentar:", err)
      return { ...base, status: "pending", file }
    }
  }, [resolveSurveyId, toast])

  const handleStatusChange = useCallback((questionId: string, status: "valid" | "blocked" | "error") => {
    setBlockedQuestions((prev) => {
      const newBlocked = new Set(prev)
      if (status === "blocked") {
        newBlocked.add(questionId)
      } else {
        newBlocked.delete(questionId)
      }
      return newBlocked
    })

    // Si el estado cambia a bloqueado, agregar error de validación inmediatamente
    if (status === "blocked") {
      setValidationErrors((prev) => ({
        ...prev,
        [questionId]: "No puedes continuar porque ya has respondido esta encuesta con este documento."
      }))
    } else if (status === "valid") {
      // Si es válido, limpiar error
      setValidationErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[questionId]
        return newErrors
      })
    }
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
    const newErrors: { [questionId: string]: string } = {};

    // Check for blocked questions first
    const blockedInCurrentSection = currentSection.questions.filter(q => blockedQuestions.has(q.id));
    if (blockedInCurrentSection.length > 0) {
      blockedInCurrentSection.forEach(q => {
        newErrors[q.id] = "No puedes continuar porque ya has respondido esta encuesta con este documento.";
      });
      isValid = false;
    }

    currentSection.questions.forEach((question) => {
      // Don't validate questions that are hidden by display logic
      if (!shouldShowQuestion(question)) {
        return;
      }

      // video: tipo de pregunta solo de visualización, sin respuesta
      if (question.type === 'video') return;

      // displayOnly: pregunta multimedia de solo visualización, sin respuesta requerida
      if (question.config?.displayOnly) return;

      if (question.required) {
        if (question.type === 'matrix') {
          const config = question.config || question.settings || {};
          const matrixRows = config.matrixRows || question.matrixRows || [];
          const matrixCols = config.matrixCols || question.matrixCols || [];
          const advancedConfig = config.advanced || {};
          const cellType = config.matrixCellType || question.matrixCellType || 'radio';

          // Determine the minimum selections required per row. If not configured, default to 1 when required.
          const minSel = (config.minSelections ?? advancedConfig.minSelections ?? question.config?.minSelections) ?? 0;
          const effectiveMin = minSel > 0 ? minSel : 1;

          if (matrixRows.length > 0) {
            const unansweredRows: string[] = [];
            
            const allRowsOk = matrixRows.every((row: any, i: any) => {
              // Checkbox: answers are stored per-row as arrays under `${question.id}_${i}`
              if (cellType === 'checkbox') {
                const rowKey = `${question.id}_${i}`;
                // Keep values like 0 (first column). Only remove null/undefined/empty string
                const sel = Array.isArray(answers[rowKey]) ? answers[rowKey].filter(v => !(v === null || v === undefined || v === '')) : [];
                const isValid = sel.length >= effectiveMin;
                if (!isValid) unansweredRows.push(row || `Fila ${i + 1}`);
                return isValid;
              }

              // Radio: value stored under `${question.id}_${i}` equal to selected column
              if (cellType === 'radio') {
                const radioKey = `${question.id}_${i}`;
                const val = answers[radioKey];
                const isValid = val !== undefined && val !== null && val !== '';
                if (!isValid) unansweredRows.push(row || `Fila ${i + 1}`);
                return isValid;
              }

              // Select / rating / text / number / ranking: check cell-level answers
              if (matrixCols.length === 0) return true;
              let filledCount = 0;
              for (let j = 0; j < matrixCols.length; j++) {
                const cellKey = `${question.id}_${i}_${j}`;
                const a = answers[cellKey];
                if (a !== undefined && a !== null && a !== '') filledCount++;
              }
              const isValid = filledCount >= effectiveMin;
              if (!isValid) unansweredRows.push(row || `Fila ${i + 1}`);
              return isValid;
            });

            if (!allRowsOk) {
              isValid = false;
              const rowList = unansweredRows.slice(0, 3).join(', ') + (unansweredRows.length > 3 ? `... y ${unansweredRows.length - 3} más` : '');
              newErrors[question.id] = `Esta pregunta es obligatoria. Por favor completa estas filas: ${rowList}`;
            }
          }
        } else if (question.type === 'multiple_textboxes') {
          // Las respuestas se guardan como ${question.id}_0, ${question.id}_1, etc.
          const labels = question.config?.textboxLabels || question.options || [];
          const count = Math.max(labels.length, 1);
          const minRequired = (question.config?.validation as any)?.minRequiredBoxes ?? (question.config as any)?.minRequiredBoxes;
          const filledCount = Array.from({ length: count }, (_, idx) => {
            const v = answers[`${question.id}_${idx}`];
            return v !== undefined && v !== null && v !== "" ? 1 : 0;
          }).reduce((a: number, b: number) => a + b, 0);

          if (minRequired && minRequired > 0) {
            // Validar mínimo de campos configurado
            if (filledCount < minRequired) {
              isValid = false;
              newErrors[question.id] = `Debes completar al menos ${minRequired} de ${count} campo(s).`;
            }
          } else {
            // Sin minRequired: si la pregunta es obligatoria, al menos un campo debe tener valor
            if (filledCount === 0) {
              isValid = false;
              newErrors[question.id] = "Esta pregunta es obligatoria. Completa al menos un campo.";
            }
          }
        } else if (question.type === 'demographic') {
          // Las respuestas se guardan como ${question.id}_age y ${question.id}_gender
          // Se requiere al menos edad O género para considerar respondida
          const age = answers[`${question.id}_age`];
          const gender = answers[`${question.id}_gender`];
          const hasAge = age !== undefined && age !== null && age !== "";
          const hasGender = gender !== undefined && gender !== null && gender !== "";
          if (!hasAge && !hasGender) {
            isValid = false;
            newErrors[question.id] = "Esta pregunta es obligatoria.";
          }
        } else if (question.type === 'contact_info') {
          // contact_info se valida por onStatusChange (blockedQuestions / status)
          // Aquí solo verificar que al menos el número de documento esté si includeDocument
          const val = answers[question.id];
          const docNum = val?.documentNumber;
          const hasDoc = docNum !== undefined && docNum !== null && docNum !== "";
          const includeDoc = question.config?.includeDocument !== false;
          if (includeDoc && !hasDoc) {
            isValid = false;
            newErrors[question.id] = "Esta pregunta es obligatoria.";
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
    // Guardia de reentrada: si ya hay un envío en curso, ignora llamadas
    // adicionales (doble tap, doble disparo del handler, etc.) en vez de
    // crear una segunda respuesta.
    if (submissionInFlightRef.current) {
      console.warn('⏳ submitResponses ya está en curso, se ignora llamada duplicada')
      return false
    }
    submissionInFlightRef.current = true
    setIsSubmittingResponse(true)
    try {
      return await submitResponsesInner()
    } finally {
      submissionInFlightRef.current = false
      setIsSubmittingResponse(false)
    }

    async function submitResponsesInner() {
    // infer survey id from pathname
    let surveyId: string | null = inferredSurveyId
    if (!surveyId) {
      try {
        const parts = window.location.pathname.split("/").filter(Boolean)
        let idx = parts.indexOf("survey")
        if (idx === -1) idx = parts.indexOf("encuesta")
        if (idx !== -1 && parts.length > idx + 1) surveyId = parts[idx + 1]
      } catch { }
    }

    const respondentKey = surveyId ? `respondent_public_id_${surveyId}` : "respondent_public_id"
    const respondentId = localStorage.getItem(respondentKey) || null
    const docTypeKey = surveyId ? `respondent_document_type_${surveyId}` : "respondent_document_type"
    const docNumKey = surveyId ? `respondent_document_number_${surveyId}` : "respondent_document_number"
    const nameKey = surveyId ? `respondent_name_${surveyId}` : "respondent_name"

    // Filter answers to only include valid UUID question_ids (for questions that actually exist in the database)
    // Also consolidate matrix-related keys (e.g., ${uuid}_0, ${uuid}_0_1) into their parent UUID
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i
    const uuidPrefixRegex = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})_/i

    const normalizedAnswers: { [questionId: string]: any } = {}
    const matrixAnswers: { [matrixId: string]: any } = {}

    // First pass: collect pure UUID answers and identify matrix cell/row keys
    for (const [key, value] of Object.entries(answers)) {
      if (uuidRegex.test(key)) {
        // Pure UUID - keep it
        normalizedAnswers[key] = value
      } else {
        // Check if it's a matrix-related key (contains a UUID prefix)
        const match = key.match(uuidPrefixRegex)
        if (match && match[1]) {
          const matrixId = match[1]
          if (!matrixAnswers[matrixId]) {
            matrixAnswers[matrixId] = {}
          }
          // Store the composite key data under the matrix ID
          const suffix = key.substring(matrixId.length + 1) // Remove UUID and underscore
          matrixAnswers[matrixId][suffix] = value
        }
      }
    }

    // Second pass: add matrix answers (grouped by matrix question ID)
    for (const [matrixId, matrixData] of Object.entries(matrixAnswers)) {
      if (!normalizedAnswers[matrixId]) {
        normalizedAnswers[matrixId] = matrixData
        continue
      }
      // BUG (auditoría 2026-07-29): "Otro, especificar" guarda la selección
      // bajo answers[question.id] (a veces el marcador literal "__other__",
      // a veces un array que lo incluye, a veces una opción normal cuyo
      // label contiene "otro") y el texto libre bajo answers[`${question.id}_other`].
      // Como normalizedAnswers[matrixId] ya existía desde el primer pase (la
      // selección), esta rama nunca se ejecutaba y el texto que la persona
      // escribió se descartaba silenciosamente — quedaba guardado el literal
      // "__other__" en vez de su respuesta real. Se fusiona aquí en vez de
      // sobreescribir, para no perder ni la selección ni el texto libre.
      const otherText = matrixData && typeof matrixData === 'object' ? (matrixData as any).other : undefined
      if (typeof otherText === 'string' && otherText.trim().length > 0) {
        const current = normalizedAnswers[matrixId]
        if (current === '__other__') {
          // Único valor era el marcador "otro": el texto libre ES la respuesta.
          normalizedAnswers[matrixId] = otherText
        } else if (Array.isArray(current) && current.includes('__other__')) {
          // Selección múltiple: sustituye el marcador por el texto libre,
          // conservando el resto de opciones marcadas.
          normalizedAnswers[matrixId] = current.map((v: any) => (v === '__other__' ? otherText : v))
        } else if (typeof current === 'string' || Array.isArray(current)) {
          // Opción regular con texto adicional (su label contiene "otro"):
          // conserva la opción seleccionada y anexa el texto libre.
          normalizedAnswers[matrixId] = { value: current, otherText }
        }
        // Si current no calza con ninguno de los casos anteriores (p.ej. ya
        // es un objeto de celdas de matriz real), se deja intacto para no
        // romper otros tipos de pregunta que usan esta misma consolidación.
      }
    }

    const validAnswers = Object.entries(normalizedAnswers)
      .map(([question_id, value]) => ({ question_id, value }))

    if (validAnswers.length === 0) {
      console.warn('⚠️ No valid answers to submit (all question_ids appear to be composite keys)')
      toast({ title: 'Error', description: 'No hay respuestas válidas para enviar', variant: 'destructive' })
      return false
    }

    // Debug: log answer normalization
    console.log('📊 Answer normalization:', {
      originalCount: Object.keys(answers).length,
      uuidAnswers: Object.keys(normalizedAnswers).length,
      matrixQuestions: Object.keys(matrixAnswers).length,
      validAnswersToSubmit: validAnswers.length,
    })

    const payload: any = {
      survey_id: surveyId,
      response_answers: validAnswers,
      timestamp: new Date().toISOString(),
      // Llave de idempotencia (auditoría 2026-07-29): estable para todos los
      // intentos de este componente, permite a /api/responses detectar
      // reintentos/doble envío del mismo formulario y devolver la respuesta
      // ya creada en vez de insertar una fila duplicada.
      client_submission_id: submissionTokenRef.current,
    }

    // Portal de encuestador: liga la respuesta al assignment (zona/encuestador)
    // para que Reportes y el rendimiento por encuestador funcionen con datos reales.
    if (assignmentId) payload.assignment_id = assignmentId

    if (respondentId) payload.respondent_public_id = respondentId
    const dt = localStorage.getItem(docTypeKey)
    const dn = localStorage.getItem(docNumKey)
    const rn = localStorage.getItem(nameKey)
    if (dt) payload.respondent_document_type = dt
    if (dn) payload.respondent_document_number = dn
    if (rn) payload.respondent_name = rn

    // Preguntas tipo archivo/foto (auditoría 2026-07-29): si alguna quedó
    // con un File sin subir (falló por red al momento de tomar la foto, o
    // el envío llegó mientras la subida seguía en curso), se reintenta
    // aquí — el JSON.stringify de más abajo no puede serializar un objeto
    // File, así que esto tiene que resolverse ANTES de construir el
    // request. Si sigue sin poder subirse (todavía sin señal), todo el
    // envío se encola completo con el File embebido — lib/offline-queue.ts
    // lo termina de subir cuando vuelva la conexión.
    let hasUnresolvedFiles = false
    for (const ans of validAnswers as any[]) {
      if (!Array.isArray(ans.value)) continue
      for (let i = 0; i < ans.value.length; i++) {
        const item = ans.value[i]
        const pending = item && typeof item === 'object' && (item.status === 'pending' || item.status === 'uploading') && item.file
        if (!pending) continue
        const result = await uploadResponseFile(item.file, ans.question_id)
        if (result && result.status === 'uploaded') {
          ans.value[i] = result
        } else {
          hasUnresolvedFiles = true
        }
      }
    }

    if (hasUnresolvedFiles) {
      try {
        const { enqueueResponse } = await import('@/lib/offline-queue')
        const queuedId = await enqueueResponse(payload)
        if (queuedId) {
          // Ya quedó a salvo en IndexedDB — se limpia el borrador de
          // localStorage para que no se precargue en la siguiente encuesta
          // que abra esta persona/dispositivo (ver clearStoredPreviewAnswers).
          clearStoredPreviewAnswers()
          toast({
            title: 'Sin conexión',
            description: 'No hay señal para subir los archivos adjuntos. Tu respuesta y tus fotos/documentos se guardaron en el dispositivo y se enviarán automáticamente cuando vuelva la conexión.',
            duration: 8000,
          })
          return false
        }
      } catch (queueErr) {
        console.error('No se pudo encolar la respuesta con archivos pendientes:', queueErr)
      }
      toast({ title: 'Error', description: 'No se pudieron subir los archivos adjuntos. Intenta de nuevo cuando tengas señal.', variant: 'destructive' })
      return false
    }

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
        try {
          const raw = await res.text()
          json = { _raw: raw }
        } catch (tErr) {
          json = { _raw_error: String(tErr) }
        }
      }

      if (!res.ok) {
        console.error('Error enviando respuestas:', { status, body: json })

        // Manejo específico para cédula duplicada
        if (status === 400 && json) {
          const errorMsg = json.error || json.message || json.details || ''

          if (errorMsg.toLowerCase().includes('cédula') &&
            (errorMsg.toLowerCase().includes('ya') || errorMsg.toLowerCase().includes('existe') || errorMsg.toLowerCase().includes('duplicad'))) {
            toast({
              title: 'Cédula ya registrada',
              description: 'Esta cédula ya ha respondido esta encuesta. Por favor verifica el número de documento.',
              variant: 'destructive',
              duration: 6000
            })
            return false
          }
        }

        const description = (json && (json.error || json.message || json.details || json._raw)) || 'No se pudo enviar la respuesta'
        toast({ title: 'Error', description, variant: 'destructive' })
        return false
      }

      // Guardar respondent_id si viene en la respuesta
      if (json && json.respondent_id && surveyId) {
        try {
          const respondentKey = `respondent_public_id_${surveyId}`
          localStorage.setItem(respondentKey, json.respondent_id)
        } catch (e) {
          console.warn('No se pudo guardar respondent_id en localStorage', e)
        }
      }

      clearStoredPreviewAnswers()
      toast({ title: 'Encuesta completada', description: 'Gracias por tu participación' })
      // Avisa al contenedor (portal de encuestador) que la respuesta se guardó,
      // pasando el response_id real para cerrar el segmento de audio de esta
      // encuesta y marcarla como 'efectiva'. No-op para /preview y /encuesta
      // públicos, que no pasan este callback.
      if (json && json.response_id) {
        try { onSubmitted?.(json.response_id) } catch (cbErr) { console.error('Error en onSubmitted:', cbErr) }
      }
      return true
    } catch (err) {
      console.error('Error de red al enviar respuestas:', err)
      // COLA OFFLINE (auditoría 2026-07-29): esto es una falla de RED (fetch
      // no llegó al servidor), no un rechazo del backend — típico de un
      // encuestador en campo sin señal. Antes esta rama solo mostraba un
      // toast de error y la respuesta se perdía si cerraba la app; ahora se
      // guarda en IndexedDB (lib/offline-queue.ts) para reintentarse sola
      // cuando vuelva la conexión, usando la misma client_submission_id así
      // que no se duplica si el servidor sí llegó a recibir el envío antes
      // de que se cortara la respuesta.
      try {
        const { enqueueResponse } = await import('@/lib/offline-queue')
        const queuedId = await enqueueResponse(payload)
        if (queuedId) {
          clearStoredPreviewAnswers()
          toast({
            title: 'Sin conexión',
            description: 'No hay señal en este momento. Tu respuesta se guardó en el dispositivo y se enviará automáticamente cuando vuelva la conexión.',
            duration: 8000,
          })
          return false
        }
      } catch (queueErr) {
        console.error('No se pudo encolar la respuesta offline:', queueErr)
      }
      toast({ title: 'Error', description: 'Error de red al enviar respuestas', variant: 'destructive' })
      return false
    }
    }
  }, [answers, inferredSurveyId, surveyData, toast, assignmentId, onSubmitted, uploadResponseFile, clearStoredPreviewAnswers])

  const handleNextSection = useCallback(async () => {
    if (!currentSection) return

    if (!validateCurrentSection()) {
      return
    }

    // Verificar skip logic de la sección actual
    if (currentSection.skip_logic?.enabled) {
      const skipLogic = currentSection.skip_logic

      // Manejar estructura con "action"
      if (skipLogic.action) {
        try {
          // Verificar si es una acción de finalizar encuesta
          if (skipLogic.action === "end_survey") {

            // Finalizar encuesta inmediatamente
            setSubmissionStatus("idle")
            const ok = await submitResponses()
            if (ok) {
              setSubmissionStatus("success")
              setShowFinishedDialog(true)
            } else {
              setSubmissionStatus("error")
            }
            return // Salir después de finalizar
          }

          // Si es salto a sección específica
          if (skipLogic.action === "specific_section" && skipLogic.targetSectionId) {

            const foundSectionIndex = surveyData?.sections.findIndex(s => s.id === skipLogic.targetSectionId)
            if (foundSectionIndex !== -1) {
              // Registrar en historial para que "Atrás" pueda volver aquí
              setSkipLogicHistory((prev) => [...prev, currentSectionIndex as any])
              setCurrentSectionIndex(foundSectionIndex)
              return // Salir después de aplicar el salto de sección
            } else {
              console.warn(`⚠️ Sección objetivo "${skipLogic.targetSectionId}" no encontrada`)
            }
          }
        } catch (error) {
          console.error(`❌ Error aplicando skip logic de sección "${currentSection.title}":`, error)
        }
      }

      // Mantener compatibilidad con estructura anterior (target_section_id)
      const { target_section_id } = skipLogic
      if (target_section_id) {
        try {
          // Verificar si es una acción de finalizar encuesta
          if (target_section_id === "END_SURVEY") {
            // Finalizar encuesta inmediatamente (no registrar historial — es fin)
            setSubmissionStatus("idle")
            const ok = await submitResponses()
            if (ok) {
              setSubmissionStatus("success")
              setShowFinishedDialog(true)
            } else {
              setSubmissionStatus("error")
            }
            return // Salir después de finalizar
          }

          // Si hay una sección objetivo, calcular el índice
          const foundSectionIndex = surveyData?.sections.findIndex(s => s.id === target_section_id)
          if (foundSectionIndex !== -1) {
            // Registrar en historial para que "Atrás" pueda volver aquí
            setSkipLogicHistory((prev) => [...prev, currentSectionIndex as any])
            setCurrentSectionIndex(foundSectionIndex)
            return // Salir después de aplicar el salto de sección
          }
        } catch (error) {
          console.error(`❌ Error aplicando skip logic de sección "${currentSection.title}":`, error)
        }
      }
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

              // CORRECCIÓN (2026-08-12): rule.value puede ser "a,b,c" (CSV) cuando el
              // usuario seleccionó 2+ respuestas para la misma condición de salto.
              // Se parsea el CSV y se aplica OR implícito para equals/contains,
              // AND negativo para not_equals/not_contains.
              const rawRuleValue = String(rule.value ?? "")
              const ruleValues = rawRuleValue.includes(",")
                ? rawRuleValue.split(",").map((v: string) => v.trim()).filter(Boolean)
                : [rawRuleValue]

              const matchOne = (rv: string): boolean => {
                if (Array.isArray(answer)) return answer.includes(rv)
                return String(answer) === rv
              }
              const containsOne = (rv: string): boolean => {
                if (Array.isArray(answer)) return answer.includes(rv)
                return String(answer).includes(rv)
              }

              if (rule.operator === "equals") {
                conditionMet = ruleValues.some(matchOne)
              } else if (rule.operator === "not_equals") {
                conditionMet = ruleValues.every((rv: string) => Array.isArray(answer) ? !answer.includes(rv) : String(answer) !== rv)
              } else if (rule.operator === "contains") {
                conditionMet = ruleValues.some(containsOne)
              } else if (rule.operator === "not_contains") {
                conditionMet = ruleValues.every((rv: string) => Array.isArray(answer) ? !answer.includes(rv) : !String(answer).includes(rv))
              } else if (rule.operator === "greater_than") {
                conditionMet = Number(answer) > Number(rawRuleValue)
              } else if (rule.operator === "less_than") {
                conditionMet = Number(answer) < Number(rawRuleValue)
              } else if (rule.operator === "is_empty") {
                conditionMet = !answer || (Array.isArray(answer) ? answer.length === 0 : String(answer).trim() === "")
              } else if (rule.operator === "is_not_empty") {
                conditionMet = answer && (Array.isArray(answer) ? answer.length > 0 : String(answer).trim() !== "")
              }

              if (conditionMet) {
                // Verificar si es una acción de finalizar encuesta
                if (rule.targetSectionId === "END_SURVEY") {
                  // Finalizar encuesta inmediatamente
                  setSubmissionStatus("idle")
                  const ok = await submitResponses()
                  if (ok) {
                    setSubmissionStatus("success")
                    setShowFinishedDialog(true)
                  } else {
                    setSubmissionStatus("error")
                  }
                  return // Salir después de finalizar
                }

                // Si hay una sección objetivo, calcular el índice
                if (rule.targetSectionId) {
                  const foundSectionIndex = surveyData?.sections.findIndex(s => s.id === rule.targetSectionId)
                  if (foundSectionIndex !== -1) {
                    // Registrar en historial para que "Atrás" pueda volver aquí
                    setSkipLogicHistory((prev) => [...prev, currentSectionIndex as any])
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
      if (ok) {
        setSubmissionStatus("success")
        // Show finished dialog to indicate success and offer to start another
        setShowFinishedDialog(true)
      } else setSubmissionStatus("error")
    }
  }, [currentSection, answers, currentSectionIndex, totalSections, surveyData, submitResponses, validateCurrentSection])

  // CORRECCIÓN (2026-08-12): el botón "Atrás" antes siempre restaba 1 al índice
  // de sección (currentSectionIndex - 1), ignorando los saltos de lógica. Si
  // el encuestador saltó de la sección 1 a la 4, "Atrás" lo llevaba a la 3
  // (una sección que nunca vio) en vez de volver a la 1.
  // Ahora usamos skipLogicHistory (stack): cada vez que se ejecuta un salto de
  // lógica se guarda el índice actual. Al retroceder, si hay historial se
  // restaura desde allí; si no (navegación secuencial normal), se decrementa.
  const handlePreviousSection = useCallback(() => {
    if (skipLogicHistory.length > 0) {
      // Hay saltos en el historial — volver al origen del último salto
      const lastIdx = skipLogicHistory[skipLogicHistory.length - 1]
      setSkipLogicHistory((prev) => prev.slice(0, -1))
      setCurrentSectionIndex(lastIdx as any)
    } else if (currentSectionIndex > 0) {
      setCurrentSectionIndex((prev) => prev - 1)
    }
  }, [currentSectionIndex, skipLogicHistory])

  const clearAndResetSurvey = useCallback(() => {
    // Clear in-memory answers
    setAnswers({})
    // Remove persisted preview answers (key namespaceada por encuesta + la vieja sin namespacing)
    clearStoredPreviewAnswers()

    // Optionally clear respondent ids for this preview survey
    if (inferredSurveyId) {
      try {
        localStorage.removeItem(`respondent_public_id_${inferredSurveyId}`)
        localStorage.removeItem(`respondent_document_type_${inferredSurveyId}`)
        localStorage.removeItem(`respondent_document_number_${inferredSurveyId}`)
        localStorage.removeItem(`respondent_name_${inferredSurveyId}`)
      } catch (e) {
        console.warn('Error clearing respondent keys', e)
      }
    }

    // Reset to first section
    setCurrentSectionIndex(0)
    setValidationErrors({})
    setSubmissionStatus('idle')
    setShowFinishedDialog(false)

    // Show a toast confirming reset
    try {
      toast({ title: 'Listo', description: 'Respuestas limpiadas. Puedes iniciar otra encuesta.' })
    } catch (e) {
      // ignore
    }
  }, [inferredSurveyId, toast, clearStoredPreviewAnswers])

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
    originalMin,
    showNumbers
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
    showNumbers?: boolean
  }) => {
    // Si no se pasa originalMin, calcularlo: si showZero es true, entonces originalMin es 1
    const actualOriginalMin = originalMin !== undefined ? originalMin : (showZero ? 1 : min)
    const [localValue, setLocalValue] = useState<number>(value)

    // Sincronizar con valor externo
    useEffect(() => {
      setLocalValue(value)
    }, [value])

    // Decide si mostrar números en cada marcador.
    const totalStepsCount = Math.floor((max - (showZero ? 0 : actualOriginalMin)) / step) + 1
    const smallRange = (max - (showZero ? 0 : actualOriginalMin)) / step <= 10
    const showMarkersNumbers = !!showNumbers || smallRange

    // Generar la lista completa de pasos (todos los valores del rango) para que
    // los segmentos interactivos cubran todo el rango y permitan seleccionar cualquier número.
    const allValues: number[] = []
    if (showZero) allValues.push(0)
    for (let i = originalMin !== undefined ? originalMin : min; i <= max; i += step) {
      if (!showZero || i !== 0) allValues.push(i)
    }

    // Generar la lista de valores que mostrarán etiquetas/ números visuales según configuración.
    // Si showMarkersNumbers es true mostramos números para cada paso; en caso contrario solo mostramos
    // aquellos valores que tengan una etiqueta definida (left/center/right) y 0 si corresponde.
    const labeledValues: number[] = []
    if (showZero) labeledValues.push(0)
    if (showMarkersNumbers) {
      // copiar allValues en labeledValues
      for (const v of allValues) labeledValues.push(v)
    } else {
      for (let i = originalMin !== undefined ? originalMin : min; i <= max; i += step) {
        const labelIndex = i - actualOriginalMin
        const hasLabel = labelIndex >= 0 && labelIndex < labels.length && labels[labelIndex] && labels[labelIndex].trim()
        if (hasLabel) {
          if (!showZero || i !== 0) labeledValues.push(i)
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
                      className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border-4 bg-white shadow-lg transition-all duration-200 flex items-center justify-center"
                      style={{
                        borderColor: themeColors.primary,
                      }}
                    >
                      <div
                        className="text-sm font-bold"
                        style={{ color: themeColors.primary }}
                      >
                        {/* Si se pidió mostrar números, mostrar el número; si no, mostrar la etiqueta si existe, sino el número */}
                        {showMarkersNumbers ? String(val) : (labels[(val === 0 ? -1 : val - actualOriginalMin)] || String(val))}
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

              // Mostrar marcador compacto: número si showMarkersNumbers, sino un punto pequeño
              return (
                <button
                  key={`marker-${val}`}
                  type="button"
                  onClick={() => handleClick(val)}
                  className={`absolute -top-2 ${showMarkersNumbers ? 'left-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-2 bg-white hover:border-gray-400 hover:scale-110' : 'w-3 h-3 rounded-full bg-white border'} transition-all duration-200 z-20 cursor-pointer`}
                  style={{
                    left: `${valPosition}%`,
                    borderColor: '#d1d5db',
                  }}
                  aria-label={`Seleccionar opción ${val}`}
                >
                  {showMarkersNumbers ? (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-gray-600">
                      {val}
                    </div>
                  ) : null}
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

          {/* Labels debajo del slider - SOLO mostrar valores con labels (labeledValues) */}
          <div className="flex justify-between text-xs text-muted-foreground mt-6 relative">
            {labeledValues.map((val, index) => {
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
                    {/* Mostrar número o etiqueta según configuración. Si no hay etiqueta, mostrar número */}
                    <div className="font-medium">{showMarkersNumbers ? String(val) : (label && label.trim() ? label : String(val))}</div>
                    {label && label.trim() && showMarkersNumbers && (
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
            {/* Mostrar etiqueta solo si existe y no estamos mostrando números como principal */}
            {(!showMarkersNumbers && selectedLabel && selectedLabel.trim()) ? (
              <span className="text-sm font-medium opacity-90">
                ({selectedLabel})
              </span>
            ) : null}
            {/* Si mostramos números y también hay etiqueta, mostrar label en pequeño */}
            {(showMarkersNumbers && selectedLabel && selectedLabel.trim()) ? (
              <span className="text-sm font-medium opacity-70">
                {selectedLabel}
              </span>
            ) : null}
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
          case "single_textbox": {
            const maxLen = question.config?.validation?.maxLength || question.config?.maxLength
            const currentVal = (answers[question.id] as string) || ""
            return (
              <div className="space-y-1">
                <Input
                  {...commonProps}
                  maxLength={maxLen || undefined}
                  value={currentVal}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                />
                {maxLen && (
                  <div className="text-xs text-muted-foreground text-right">
                    <span className={currentVal.length >= maxLen ? "text-red-500 font-medium" : ""}>
                      {currentVal.length}
                    </span>/{maxLen}
                  </div>
                )}
              </div>
            )
          }
          case "textarea":
          case "comment_box": {
            const maxLen = question.config?.validation?.maxLength || question.config?.maxLength
            const currentVal = (answers[question.id] as string) || ""
            return (
              <div className="space-y-1">
                <Textarea
                  {...commonProps}
                  rows={4}
                  maxLength={maxLen || undefined}
                  value={currentVal}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                />
                {maxLen && (
                  <div className="text-xs text-muted-foreground text-right">
                    <span className={currentVal.length >= maxLen ? "text-red-500 font-medium" : ""}>
                      {currentVal.length}
                    </span>/{maxLen}
                  </div>
                )}
              </div>
            )
          }
          case "multiple_choice":
            {
              const opts = question.options || []
              const hasImages = opts.some((option: any) => typeof option === 'object' && option !== null && (option.image || option.url || option.src))
              // If options include images, render a grid of image cards; otherwise fallback to list
              if (hasImages) {
                return (
                  <RadioGroup
                    value={answers[question.id] || ""}
                    onValueChange={(value) => handleAnswerChange(question.id, value)}
                    className=""
                  >
                    <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                      {opts.map((option: any, idx: number) => {
                        const optionLabel = typeof option === 'object' && option !== null ? (option as any).label || (option as any).value || '' : String(option || '')
                        const optionValue = typeof option === 'object' && option !== null ? ((option as any).value || optionLabel) : option
                        const imageUrl = typeof option === 'object' && option !== null ? ((option as any).image || (option as any).url || (option as any).src) : null
                        const id = `${question.id}-option-${idx}`
                        const selectedValue = answers[question.id]
                        const isSelected = selectedValue === optionValue
                        return (
                          <div
                            key={idx}
                            className={`flex flex-col items-center bg-white border rounded-lg p-2 sm:p-3 transition-shadow ${isSelected ? 'ring-2 ring-emerald-300 shadow-lg border-emerald-200' : 'hover:shadow-lg'}`}
                          >
                            <RadioGroupItem value={optionValue} id={id} className="sr-only" />
                            <label
                              htmlFor={id}
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === ' ' || e.key === 'Enter') {
                                  e.preventDefault()
                                  handleAnswerChange(question.id, optionValue)
                                }
                              }}
                              className="relative flex flex-col items-center cursor-pointer select-none focus:outline-none w-full"
                            >
                              {/* selection indicator */}
                              {imageUrl ? (
                                <img src={imageUrl} alt={optionLabel} className="w-full h-28 sm:h-36 md:h-44 object-contain rounded-md bg-gray-50 border" />
                              ) : (
                                <div className="w-full h-28 sm:h-36 md:h-44 flex items-center justify-center rounded-md bg-gray-50 border text-sm text-gray-700">Sin imagen</div>
                              )}
                              <div className="mt-3 flex items-center justify-center gap-2">
                                {/* inline radio indicator next to label */}
                                <span className="w-5 h-5 rounded-full flex items-center justify-center border bg-white">
                                  {answers[question.id] === optionValue ? (
                                    <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <circle cx="12" cy="12" r="6" fill="currentColor" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4 text-gray-300" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.5" />
                                    </svg>
                                  )}
                                </span>
                                <div className="text-sm text-center text-gray-800" dangerouslySetInnerHTML={{ __html: optionLabel }} />
                              </div>
                            </label>
                          </div>
                        )
                      })}
                    </div>
                    {question.config?.allowOther && !( (question.options || []).some((opt: any) => opt && typeof opt === 'object' ? (opt.value === '__other__') : String(opt) === '__other__') ) && (
                      <div className="mt-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="__other__" id={`${question.id}-option-other`} />
                          <Label htmlFor={`${question.id}-option-other`}>
                            {question.config.otherText || 'Otro (especificar)'}
                          </Label>
                        </div>
                        {answers[question.id] === "__other__" && (
                          <div className="mt-2">
                            <Input
                              autoFocus
                              value={answers[`${question.id}_other`] || ""}
                              onChange={e => handleAnswerChange(`${question.id}_other`, e.target.value)}
                              placeholder="Por favor especifica tu respuesta..."
                              className="w-full"
                            />
                          </div>
                        )}
                      </div>
                    )}
                    {/* Campo de texto unificado: muestra Input cuando la opción seleccionada es tipo "Otro" */}
                    {answers[question.id] && (() => {
                      const selectedVal = answers[question.id]
                      // Evitar duplicar el input que ya muestra el bloque allowOther cuando allowOther=true y __other__ no está en opts
                      const handledByAllowOther =
                        question.config?.allowOther &&
                        !opts.some((opt: any) => opt && typeof opt === 'object' ? opt.value === '__other__' : String(opt) === '__other__') &&
                        selectedVal === '__other__'
                      if (handledByAllowOther) return null
                      // Caso 1: valor seleccionado es __other__ (no manejado arriba)
                      if (selectedVal === '__other__') {
                        return (
                          <div className="mt-2">
                            <Input autoFocus value={answers[`${question.id}_other`] || ''}
                              onChange={e => handleAnswerChange(`${question.id}_other`, e.target.value)}
                              placeholder="Por favor especifica tu respuesta..." className="w-full" />
                          </div>
                        )
                      }
                      // Caso 2: opción regular cuyo label contiene "otro" (independiente de allowOther)
                      const selectedOpt = opts.find((opt: any) => {
                        const v = typeof opt === 'object' && opt !== null ? ((opt as any).value || (opt as any).label) : opt
                        return v === selectedVal
                      })
                      const selectedLabel = selectedOpt
                        ? (typeof selectedOpt === 'object' ? ((selectedOpt as any).label || (selectedOpt as any).value || '') : String(selectedOpt))
                        : String(selectedVal || '')
                      if (/otro/i.test(selectedLabel)) {
                        return (
                          <div className="mt-2">
                            <Input autoFocus value={answers[`${question.id}_other`] || ''}
                              onChange={e => handleAnswerChange(`${question.id}_other`, e.target.value)}
                              placeholder="Por favor especifica tu respuesta..." className="w-full" />
                          </div>
                        )
                      }
                      return null
                    })()}
                  </RadioGroup>
                )
              }
              // fallback to original list rendering when there are no images
              return (
                <RadioGroup
                  value={answers[question.id] || ""}
                  onValueChange={(value) => handleAnswerChange(question.id, value)}
                  className="space-y-2"
                >
                  {opts.map((option, idx) => {
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
                    )
                  })}
                  {question.config?.allowOther && !( (question.options || []).some((opt: any) => opt && typeof opt === 'object' ? (opt.value === '__other__') : String(opt) === '__other__') ) && (
                    <div className="space-y-2 mt-2">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="__other__" id={`${question.id}-option-other`} />
                        <Label htmlFor={`${question.id}-option-other`}>
                          {question.config.otherText || 'Otro (especificar)'}
                        </Label>
                      </div>
                      {answers[question.id] === "__other__" && (
                        <div className="ml-6">
                          <Input
                            autoFocus
                            value={answers[`${question.id}_other`] || ""}
                            onChange={e => handleAnswerChange(`${question.id}_other`, e.target.value)}
                            placeholder="Por favor especifica tu respuesta..."
                            className="w-full"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  {/* Campo de texto unificado: muestra Input cuando la opción seleccionada es tipo "Otro" */}
                  {answers[question.id] && (() => {
                    const selectedVal = answers[question.id]
                    // Evitar duplicar el input que ya muestra el bloque allowOther
                    const handledByAllowOther =
                      question.config?.allowOther &&
                      !opts.some((opt: any) => opt && typeof opt === 'object' ? opt.value === '__other__' : String(opt) === '__other__') &&
                      selectedVal === '__other__'
                    if (handledByAllowOther) return null
                    // Caso 1: valor seleccionado es __other__
                    if (selectedVal === '__other__') {
                      return (
                        <div className="mt-2">
                          <Input autoFocus value={answers[`${question.id}_other`] || ''}
                            onChange={e => handleAnswerChange(`${question.id}_other`, e.target.value)}
                            placeholder="Por favor especifica tu respuesta..." className="w-full" />
                        </div>
                      )
                    }
                    // Caso 2: opción regular con label "Otro..." (independiente de allowOther)
                    const selectedOpt = opts.find((opt: any) => {
                      const v = typeof opt === 'object' && opt !== null ? ((opt as any).value || (opt as any).label) : opt
                      return v === selectedVal
                    })
                    const selectedLabel = selectedOpt
                      ? (typeof selectedOpt === 'object' ? ((selectedOpt as any).label || (selectedOpt as any).value || '') : String(selectedOpt))
                      : String(selectedVal || '')
                    if (/otro/i.test(selectedLabel)) {
                      return (
                        <div className="mt-2">
                          <Input autoFocus value={answers[`${question.id}_other`] || ""}
                            onChange={e => handleAnswerChange(`${question.id}_other`, e.target.value)}
                            placeholder="Por favor especifica tu respuesta..." className="w-full" />
                        </div>
                      )
                    }
                    return null
                  })()}
                </RadioGroup>
              )
            }
          case "checkbox": {
            const selected = Array.isArray(answers[question.id]) ? answers[question.id] : [];
            // Check both possible paths for min/max selections
            const minSel = question.config?.minSelections ?? question.config?.advanced?.minSelections ?? 0;
            const maxSel = question.config?.maxSelections ?? question.config?.advanced?.maxSelections ?? (question.options?.length || 99);
            const isMaxReached = selected.length >= maxSel;
            // If any option includes an image, show grid cards; otherwise keep list
            const opts = question.options || []
            const hasImages = opts.some((option: any) => typeof option === 'object' && option !== null && (option.image || option.url || option.src))
            if (hasImages) {
              return (
                <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                  {opts.map((option: any, idx: number) => {
                    const optionLabel = typeof option === 'object' && option !== null ? (option as any).label || (option as any).value || '' : String(option || '')
                    const optionValue = typeof option === 'object' && option !== null ? ((option as any).value || optionLabel) : option
                    const imageUrl = typeof option === 'object' && option !== null ? ((option as any).image || (option as any).url || (option as any).src) : null
                    const checked = selected.includes(optionValue)
                    const disabled = !checked && isMaxReached
                    const id = `${question.id}-option-${idx}`
                    return (
                      <div key={idx} className={`relative flex flex-col items-center p-2 sm:p-3 bg-white border rounded-lg ${disabled ? 'opacity-60' : ''} ${checked ? 'ring-2 ring-emerald-300 shadow-lg border-emerald-200' : 'hover:shadow-lg'}`}>
                        <Checkbox
                          id={id}
                          checked={checked}
                          disabled={disabled}
                          className="sr-only"
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
                        <label
                          htmlFor={id}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                              e.preventDefault()
                              const currentAnswers = new Set(selected);
                              if (!checked) currentAnswers.add(optionValue); else currentAnswers.delete(optionValue);
                              handleAnswerChange(question.id, Array.from(currentAnswers));
                            }
                          }}
                          className="flex flex-col items-center cursor-pointer select-none w-full"
                        >
                          {/* selection indicator for checkbox */}
                          {imageUrl ? (
                            <img src={imageUrl} alt={optionLabel} className="w-full h-28 sm:h-36 md:h-44 object-contain rounded-md bg-gray-50 border" />
                          ) : (
                            <div className="w-full h-28 sm:h-36 md:h-44 flex items-center justify-center rounded-md bg-gray-50 border text-sm text-gray-700">Sin imagen</div>
                          )}
                          <div className="mt-3 flex items-center justify-center gap-2">
                            <span className="w-5 h-5 rounded-sm flex items-center justify-center border bg-white">
                              {checked ? (
                                <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 text-gray-300" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5" />
                                </svg>
                              )}
                            </span>
                            <div className="mt-0 text-sm text-center text-gray-800">{optionLabel}</div>
                          </div>
                        </label>
                      </div>
                    )
                  })}
                </div>
              )
            }
            return (
              <div className="space-y-2">
                {opts.map((option, idx) => {
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
                {question.config?.allowOther && !( (question.options || []).some((opt: any) => opt && typeof opt === 'object' ? (opt.value === '__other__') : String(opt) === '__other__') ) && (
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center space-x-2">
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
                            handleAnswerChange(`${question.id}_other`, "");
                          }
                          handleAnswerChange(question.id, Array.from(currentAnswers));
                        }}
                      />
                      <Label htmlFor={`${question.id}-option-other`}>
                        {question.config.otherText || 'Otro (especificar)'}
                      </Label>
                    </div>
                    {selected.includes("__other__") && (
                      <div className="ml-6">
                        <Input
                          autoFocus
                          value={answers[`${question.id}_other`] || ""}
                          onChange={e => handleAnswerChange(`${question.id}_other`, e.target.value)}
                          placeholder="Por favor especifica tu respuesta..."
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                )}
                {/* Campo de texto unificado para checkbox: muestra Input cuando hay opción "Otro" seleccionada */}
                {(() => {
                  // Evitar duplicar el input cuando allowOther block ya lo maneja (allowOther=true, __other__ no en opts, __other__ seleccionado)
                  const handledByAllowOther =
                    question.config?.allowOther &&
                    !opts.some((opt: any) => opt && typeof opt === 'object' ? opt.value === '__other__' : String(opt) === '__other__') &&
                    selected.includes('__other__')
                  if (handledByAllowOther) return null
                  // Caso 1: __other__ está en la selección (como opción regular)
                  if (selected.includes("__other__")) {
                    return (
                      <div className="mt-2">
                        <Input autoFocus value={answers[`${question.id}_other`] || ""}
                          onChange={e => handleAnswerChange(`${question.id}_other`, e.target.value)}
                          placeholder="Por favor especifica tu respuesta..." className="w-full" />
                      </div>
                    )
                  }
                  // Caso 2: alguna opción seleccionada tiene label que contiene "otro" (independiente de allowOther)
                  const otroSelected = selected.find((sv: string) => {
                    const matchOpt = opts.find((opt: any) => {
                      const v = typeof opt === 'object' && opt !== null ? ((opt as any).value || (opt as any).label) : opt
                      return v === sv
                    })
                    const lbl = matchOpt
                      ? (typeof matchOpt === 'object' ? ((matchOpt as any).label || (matchOpt as any).value || '') : String(matchOpt))
                      : String(sv || '')
                    return /otro/i.test(lbl)
                  })
                  if (otroSelected) {
                    return (
                      <div className="mt-2">
                        <Input autoFocus value={answers[`${question.id}_other`] || ""}
                          onChange={e => handleAnswerChange(`${question.id}_other`, e.target.value)}
                          placeholder="Por favor especifica tu respuesta..." className="w-full" />
                      </div>
                    )
                  }
                  return null
                })()}
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
                    {question.config?.allowOther && !( (question.options || []).some((opt: any) => opt && typeof opt === 'object' ? (opt.value === '__other__') : String(opt) === '__other__') ) && (
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
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <span className="text-xs sm:text-sm text-muted-foreground">{min}</span>
                <div className="flex flex-wrap gap-1">
                  {emojis.map((emoji, idx) => {
                    const value = min + idx;
                    const isActive = answers[question.id] === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleAnswerChange(question.id, value)}
                        className={`p-1.5 sm:p-2 rounded-lg transition-colors text-xl sm:text-2xl ${isActive
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
                <span className="text-xs sm:text-sm text-muted-foreground">{max}</span>
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
          case "scale": {
            // Get configuration from question.config
            const scaleMin = question.config?.scaleMin ?? 1;
            const scaleMax = question.config?.scaleMax ?? 5;
            const scaleRange = scaleMax - scaleMin + 1;
            // Support both array format [min, max] and object format {min, max}
            const scaleLabels = question.config?.scaleLabels || [];
            const minLabel = Array.isArray(scaleLabels)
              ? (scaleLabels[0] || "")
              : ((scaleLabels as any).min || "");
            const maxLabel = Array.isArray(scaleLabels)
              ? (scaleLabels[1] || "")
              : ((scaleLabels as any).max || "");

            // Generate array of scale values
            const scaleValues = Array.from(
              { length: scaleRange },
              (_, i) => scaleMin + i
            );

            // Para rangos grandes (>10), usar tamaños más pequeños y grid
            const isLargeRange = scaleRange > 10;
            const btnClass = isLargeRange
              ? `rounded-md text-xs font-medium transition-colors shrink-0 flex items-center justify-center`
              : `w-10 h-10 rounded-full text-sm font-medium transition-colors shrink-0`;
            const btnStyle = isLargeRange
              ? { width: `calc(${100 / scaleRange}% - 2px)`, minWidth: '28px', height: '32px' }
              : {};

            return (
              <div className="space-y-3">
                {isLargeRange ? (
                  // Grid uniforme para rangos grandes (ej: 1-20 → 10 columnas, 2 filas perfectas)
                  <div className="w-full">
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${Math.min(scaleRange, 10)}, 1fr)`,
                        gap: '4px',
                      }}
                    >
                      {scaleValues.map((scale) => (
                        <button
                          key={scale}
                          type="button"
                          onClick={() => handleAnswerChange(question.id, scale)}
                          style={{ height: '36px', touchAction: 'manipulation' }}
                          className={`rounded-md text-xs font-semibold transition-colors ${answers[question.id] === scale
                            ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30"
                            : "bg-muted hover:bg-muted/80"
                          }`}
                        >
                          {scale}
                        </button>
                      ))}
                    </div>
                    {answers[question.id] !== undefined && (
                      <div className="mt-2 text-sm font-medium text-center" style={{ color: themeColors.primary }}>
                        Seleccionado: {answers[question.id]}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-1 justify-between">
                    {scaleValues.map((scale) => (
                      <button
                        key={scale}
                        type="button"
                        onClick={() => handleAnswerChange(question.id, scale)}
                        className={`${btnClass} ${answers[question.id] === scale
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted hover:bg-muted/80"
                        }`}
                      >
                        {scale}
                      </button>
                    ))}
                  </div>
                )}
                {(minLabel || maxLabel) && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{minLabel}</span>
                    <span>{maxLabel}</span>
                  </div>
                )}
              </div>
            )
          }
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
              <LikertSlider
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(val) => handleAnswerChange(question.id, val)}
                labels={labels}
                showZero={showZero}
                zeroLabel={zeroLabel}
                showNumbers={true}
                showSelectedPanel={false}
                showTicks={true}
                themeColors={themeColors}
              />
            )
          case "net_promoter":
            return (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:justify-between sm:gap-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => handleAnswerChange(question.id, score)}
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full text-sm font-medium transition-colors shrink-0 ${answers[question.id] === score
                        ? score <= 6 ? "bg-red-500 text-white shadow-sm"
                          : score <= 8 ? "bg-yellow-500 text-white shadow-sm"
                          : "bg-green-500 text-white shadow-sm"
                        : "bg-muted hover:bg-muted/80"
                        }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
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
              <div className="space-y-2">
                <EmailAutocompleteInput
                  value={answers[question.id] || ""}
                  onChange={(eOrVal: any) => {
                    // EmailAutocompleteInput may call onChange with the native event
                    // or (in some callers) with a raw string. Normalize to a string.
                    const val = typeof eOrVal === "string" ? eOrVal : eOrVal?.target?.value ?? ""
                    handleAnswerChange(question.id, val)
                  }}
                  placeholder="ejemplo@gmail.com"
                  className="w-full"
                />
                <p className="text-xs text-gray-500">Ej: correo@gmail.com, correo@hotmail.com, correo@outlook.com</p>
              </div>
            )
          case "phone":
            return (
              <Input
                type="tel"
                value={answers[question.id] || ""}
                onChange={(e) => {
                  // Only allow numbers, spaces, dashes, parentheses, and plus sign
                  const value = e.target.value.replace(/[^0-9\s\-\(\)\+]/g, '')
                  handleAnswerChange(question.id, value)
                }}
                onKeyDown={(e) => {
                  // Prevent letters except for allowed characters
                  if (!/[0-9\s\-\(\)\+]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                    e.preventDefault()
                  }
                }}
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
                onKeyDown={(e) => {
                  // Prevent 'e', 'E', '+', '-' in number input
                  if (['e', 'E', '+', '-'].includes(e.key)) {
                    e.preventDefault()
                  }
                }}
                placeholder="Ingresa un número"
                className="w-full"
              />
            )
          case "file":
          case "image_upload":
            {
              // displayOnly: solo muestra la imagen/media configurada, sin input de subida
              if (question.config?.displayOnly) {
                return (
                  <div className="space-y-2">
                    {question.image && (
                      <img
                        src={question.image}
                        alt={question.title || "Imagen"}
                        className="max-w-full rounded-lg border border-gray-200 mx-auto block"
                        style={{ maxHeight: 400, objectFit: "contain" }}
                      />
                    )}
                    {!question.image && (
                      <p className="text-sm text-gray-500 italic">Sin contenido multimedia configurado.</p>
                    )}
                  </div>
                )
              }

              const fileCfg = question.config?.fileUploadConfig || { maxFiles: 1 }
              const maxFilesAllowed = typeof fileCfg.maxFiles === 'number' ? fileCfg.maxFiles : Number(fileCfg.maxFiles) || 1
              // Auditoría 2026-07-29: el valor de esta pregunta ahora es un
              // arreglo de descriptores {status:'uploaded'|'uploading'|'pending',
              // name, type, size, path?, file?} — antes era solo un arreglo de
              // nombres en texto plano y el contenido real nunca se subía (ver
              // app/api/response-files/upload/route.ts). Se soporta el formato
              // viejo (string) por compatibilidad con respuestas ya guardadas
              // en localStorage antes de este cambio.
              const rawCurrent = answers[question.id]
              const currentFiles: any[] = Array.isArray(rawCurrent) ? rawCurrent : (rawCurrent ? [rawCurrent] : [])
              const normalizedCurrent = currentFiles.map((f) => (typeof f === "string" ? { status: "uploaded", name: f } : f))

              const allowedTypes = ["image/jpeg", "image/png", "application/pdf"]
              const maxSize = 20 * 1024 * 1024 // 20 MB

              // Compartido entre "Agregar archivos" (selector nativo) y "Tomar
              // foto" (modal de cámara vía getUserMedia — funciona igual en PC
              // y celular/tablet; ver components/camera-capture-modal.tsx) —
              // pptx slide 14: "Debemos tener la opción de incorporar la cámara
              // del celular".
              //
              // handleAnswerChange guarda el valor directo (no soporta forma de
              // updater funcional), así que la resolución final de cada subida
              // se hace leyendo/escribiendo answers[question.id] secuencialmente
              // en vez de con un setState updater — evita condiciones de carrera
              // entre subidas de varias fotos seleccionadas a la vez.
              const processFilesSequential = async (files: File[]) => {
                if (files.length === 0) return
                const existing = Array.isArray(answers[question.id]) ? answers[question.id] : (answers[question.id] ? [answers[question.id]] : [])
                if (existing.length + files.length > maxFilesAllowed) {
                  toast({
                    title: "Demasiados archivos",
                    description: `Solo se permiten hasta ${maxFilesAllowed} archivo${maxFilesAllowed > 1 ? 's' : ''}. Tienes ${existing.length} y seleccionaste ${files.length}.`,
                    variant: "destructive",
                  })
                  return
                }
                for (const file of files) {
                  if (!allowedTypes.includes(file.type)) {
                    toast({ title: "Formato no permitido", description: "Solo se permiten archivos JPG, PNG o PDF.", variant: "destructive" })
                    return
                  }
                  if (file.size > maxSize) {
                    toast({ title: "Archivo muy grande", description: "El archivo no debe superar los 20 MB.", variant: "destructive" })
                    return
                  }
                }

                // file va embebido incluso en el placeholder "uploading": si el
                // envío ocurre antes de que la subida resuelva (poco probable
                // pero posible con doble tap rápido), submitResponses y la cola
                // offline igual tienen el File real para reintentar en vez de
                // quedarse con un descriptor huérfano sin contenido.
                let working = [...existing, ...files.map((f) => ({ status: "uploading", name: f.name, type: f.type, size: f.size, file: f }))]
                handleAnswerChange(question.id, working)

                for (let i = 0; i < files.length; i++) {
                  const result = await uploadResponseFile(files[i], question.id)
                  const targetIndex = existing.length + i
                  working = working.map((f, idx) => (idx === targetIndex ? (result ?? { status: "error", name: files[i].name }) : f))
                  handleAnswerChange(question.id, working)
                }
              }

              const handleFilesSelected = (fileList: FileList | null, inputEl: HTMLInputElement) => {
                const files = Array.from(fileList || [])
                inputEl.value = ""
                processFilesSequential(files)
              }

              // Detección de dispositivo móvil (solo cliente — "use client").
              // Móvil: capture="environment" abre la cámara nativa del OS directamente
              // (sin permisos del browser, sin HTTPS extra).
              // Desktop: CameraCaptureModal con getUserMedia abre la webcam del PC.
              const isMobile = typeof navigator !== "undefined"
                && /Mobi|Android|iPhone|iPad|iPod|IEMobile/i.test(navigator.userAgent)

              return (
                <div className="space-y-2">
                  {/* Modal de webcam — solo se activa en desktop vía setCameraModalQuestionId */}
                  <CameraCaptureModal
                    open={cameraModalQuestionId === question.id}
                    onClose={() => setCameraModalQuestionId(null)}
                    onCapture={(file) => {
                      setCameraModalQuestionId(null)
                      processFilesSequential([file])
                    }}
                  />

                  {/* Input para "Adjuntar archivo" — selector de archivos normal */}
                  <input
                    type="file"
                    id={`file-input-${question.id}`}
                    className="sr-only"
                    multiple={maxFilesAllowed > 1}
                    onChange={(e) => handleFilesSelected(e.target.files, e.currentTarget)}
                    accept=".jpg,.jpeg,.png,.pdf"
                  />
                  {/* Input de cámara nativa — solo para móvil vía label htmlFor.
                      capture="environment" abre la cámara trasera directamente en iOS/Android.
                      En desktop este input existe pero el botón "Tomar foto" usa el modal
                      en su lugar, así que este input nunca se activa en desktop. */}
                  <input
                    type="file"
                    id={`file-input-camera-${question.id}`}
                    className="sr-only"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleFilesSelected(e.target.files, e.currentTarget)}
                  />

                  <div className="flex items-center flex-wrap gap-2">
                    <label
                      htmlFor={`file-input-${question.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700"
                    >
                      Adjuntar archivo
                    </label>

                    {isMobile ? (
                      /* Móvil: label → input con capture, abre cámara nativa del OS */
                      <label
                        htmlFor={`file-input-camera-${question.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-blue-700 border border-blue-600 rounded-lg cursor-pointer hover:bg-blue-50"
                      >
                        <Camera className="h-4 w-4" /> Tomar foto
                      </label>
                    ) : (
                      /* Desktop: button → CameraCaptureModal con getUserMedia (webcam) */
                      <button
                        type="button"
                        onClick={() => setCameraModalQuestionId(question.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-blue-700 border border-blue-600 rounded-lg cursor-pointer hover:bg-blue-50"
                      >
                        <Camera className="h-4 w-4" /> Tomar foto
                      </button>
                    )}

                    <div className="text-xs text-muted-foreground">Máx archivos: <b>{maxFilesAllowed}</b></div>
                  </div>

                  <div className="text-xs text-blue-700 bg-blue-50 rounded px-3 py-2 border border-blue-100">
                    Formatos permitidos: <b>JPG, PNG, PDF</b> &nbsp;|&nbsp; Tamaño máximo: <b>20 MB</b>
                  </div>

                  {normalizedCurrent.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <div>Archivos seleccionados:</div>
                        <button
                          type="button"
                          className="text-sm text-red-600 hover:underline"
                          onClick={() => handleAnswerChange(question.id, [])}
                        >
                          Eliminar todos
                        </button>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {normalizedCurrent.map((f, i) => (
                          <li key={i} className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 truncate">
                              {f.status === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />}
                              <span className="truncate">{f.name}</span>
                              {f.status === "pending" && (
                                <span className="text-[10px] uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 flex-shrink-0">
                                  Se subirá al recuperar señal
                                </span>
                              )}
                              {f.status === "error" && (
                                <span className="text-[10px] uppercase tracking-wide text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 flex-shrink-0">
                                  Error
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              className="text-sm text-red-600 ml-4 flex-shrink-0"
                              onClick={() => {
                                const arr = Array.isArray(answers[question.id]) ? [...answers[question.id]] : (answers[question.id] ? [answers[question.id]] : [])
                                arr.splice(i, 1)
                                handleAnswerChange(question.id, arr)
                              }}
                            >Eliminar</button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            }
          case "signature":
            // Antes esto era un placeholder estático sin funcionalidad real
            // ("simulado en preview"). Ahora es un canvas de firma real —
            // funciona con mouse, dedo (touch) o lápiz óptico. El valor
            // guardado es un PNG en base64 (data URL), igual de simple que
            // cómo el resto de tipos de pregunta guardan su respuesta en
            // `answers[question.id]`.
            return (
              <SignaturePad
                value={typeof answers[question.id] === "string" ? answers[question.id] : null}
                onChange={(dataUrl) => handleAnswerChange(question.id, dataUrl)}
              />
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
              <ContactInfoQuestion
                surveyId={inferredSurveyId || ""}
                onChange={(value) => handleAnswerChange(question.id, value)}
                onStatusChange={(status) => handleStatusChange(question.id, status)}
                config={question.config}
                initialData={answers[question.id]}
              />
            )
          case "video":
            // Tipo Video: solo muestra el video adjunto, sin campo de respuesta.
            // El enunciado (question.title) actúa como texto introductorio/instrucción.
            return (
              <div className="space-y-2">
                {question.image ? (
                  <video
                    src={question.image}
                    controls
                    className="w-full rounded-lg bg-black"
                    style={{ maxHeight: 420 }}
                  />
                ) : (
                  <div className="flex items-center justify-center py-10 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                    <p className="text-sm text-gray-400">Sin video adjunto</p>
                  </div>
                )}
              </div>
            )
          case "location":
            // Pregunta tipo Ubicación (slide 17): geolocalización automática del
            // navegador + reverse geocoding, campos editables. Solo web.
            return (
              <LocationQuestion
                value={answers[question.id] || null}
                onChange={(val) => handleAnswerChange(question.id, val)}
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
            
            // Obtener configuración de límites
            const advancedConfig = config.advanced || {};
            const minSel = advancedConfig.minSelections ?? 0;
            const maxSel = advancedConfig.maxSelections ?? matrixCols.length;
            
            // Helper para renderizar una celda de la matriz
            const renderMatrixCell = (rowIdx: number, colIdx: number, col: string) => {
              const cellKey = `${question.id}_${rowIdx}_${colIdx}`;
              switch (cellType) {
                case "checkbox": {
                  const rowKey = `${question.id}_${rowIdx}`;
                  const selected = Array.isArray(answers[rowKey]) ? answers[rowKey] : [];
                  const isChecked = selected.includes(colIdx);
                  const isMaxReached = selected.length >= maxSel && !isChecked;
                  return (
                    <Checkbox
                      checked={isChecked}
                      disabled={isMaxReached}
                      onCheckedChange={(checked) => {
                        let cur = new Set(selected);
                        if (checked) cur.add(colIdx); else cur.delete(colIdx);
                        handleAnswerChange(rowKey, Array.from(cur));
                      }}
                    />
                  );
                }
                case "text":
                  return <Input value={answers[cellKey] || ""} onChange={(e) => handleAnswerChange(cellKey, e.target.value)} className="w-full" placeholder="Texto..." />;
                case "number":
                  return <Input type="number" value={answers[cellKey] || ""} onChange={(e) => handleAnswerChange(cellKey, e.target.value)} className="w-full" placeholder="0" />;
                case "select": {
                  const colOptions = matrixColOptions[colIdx] || ["Opción 1"];
                  return (
                    <Select value={answers[cellKey] || ""} onValueChange={(v) => handleAnswerChange(cellKey, v)}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                      <SelectContent>
                        {colOptions.map((opt: any, i: number) => {
                          const cleanOpt = typeof opt === 'string' ? opt.trim() : '';
                          return <SelectItem key={i} value={cleanOpt}>{cleanOpt || <span className="text-gray-400">(vacío)</span>}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  );
                }
                case "rating": {
                  const stars = Number(matrixRatingScale);
                  return (
                    <div className="flex gap-1">
                      {Array.from({ length: stars }, (_, i) => (
                        <button key={i} type="button" className={`text-yellow-400 text-lg ${answers[cellKey] === i + 1 ? "font-bold" : "opacity-50"}`} onClick={() => handleAnswerChange(cellKey, i + 1)}>★</button>
                      ))}
                    </div>
                  );
                }
                case "ranking":
                  return <Input type="number" min={1} max={matrixRows.length} value={answers[cellKey] || ""} onChange={(e) => handleAnswerChange(cellKey, e.target.value)} className="w-16 text-center" placeholder="#" />;
                case "radio": {
                  const radioKey = `${question.id}_${rowIdx}`;
                  const isSelected = answers[radioKey] === col;
                  return (
                    <button
                      type="button"
                      // onPointerDown en lugar de onClick → respuesta visual INMEDIATA en mobile (sin delay de 300ms)
                      onPointerDown={(e) => {
                        e.preventDefault();
                        handleAnswerChange(radioKey, col);
                      }}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center focus:outline-none ${
                        isSelected
                          ? "border-primary"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                      style={{
                        touchAction: 'manipulation',
                        ...(isSelected ? { borderColor: themeColors.primary } : {}),
                      }}
                      aria-pressed={isSelected}
                      title={`Seleccionar: ${col}`}
                    >
                      {isSelected && (
                        <div
                          className="w-3.5 h-3.5 rounded-full"
                          style={{ backgroundColor: themeColors.primary }}
                        />
                      )}
                    </button>
                  );
                }
                default:
                  return <Input disabled className="w-full" placeholder={`Tipo ${cellType} no soportado`} />;
              }
            };

            return (
              <div className="space-y-3">
                {/* ── MÓVIL: tarjetas apiladas por fila ── */}
                <div className="sm:hidden space-y-3">
                  {matrixRows.map((row: any, rowIdx: any) => (
                    <div key={rowIdx} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                        <p className="text-sm font-semibold text-gray-800 leading-snug">{row}</p>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {matrixCols.map((col: any, colIdx: any) => (
                          <label key={colIdx} className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer active:bg-gray-50" style={{ touchAction: 'manipulation' }}>
                            <span className="text-sm text-gray-700 leading-snug flex-1">{col}</span>
                            <div className="shrink-0">
                              {renderMatrixCell(rowIdx, colIdx, col)}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── DESKTOP: tabla horizontal ── */}
                <div className="hidden sm:block overflow-x-auto">
                  <div className="min-w-full bg-white rounded-lg shadow-sm ring-1 ring-gray-100 overflow-hidden border border-gray-100">
                    <table className="w-full divide-y divide-gray-200" style={{ tableLayout: 'auto' }}>
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 w-2/5">Preguntas</th>
                          {matrixCols.map((col: any, idx: any) => (
                            <th key={idx} className="px-3 py-3 text-center text-xs font-semibold text-gray-700 whitespace-normal min-w-[80px]">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {matrixRows.map((row: any, rowIdx: any) => (
                          <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                            <td className="px-4 py-4 align-middle font-medium text-sm text-gray-800 leading-snug">{row}</td>
                            {matrixCols.map((col: any, colIdx: any) => (
                              <td key={colIdx} className="px-3 py-4 align-middle text-center">
                                <div className="flex items-center justify-center">
                                  {renderMatrixCell(rowIdx, colIdx, col)}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {minSel > 0 && (
                  <p className="text-xs text-muted-foreground">Mínimo de selecciones por fila: {minSel}</p>
                )}
              </div>
            );
          }
          case "multiple_textboxes":
            {
              const labels = question.config?.textboxLabels || question.options || [];
              return (
                <div className="space-y-4">
                  {labels.map((label: any, idx: any) => (
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
        <div key={question.id} id={`question-${question.id}`} className="preview-content px-4 py-5 border-b border-gray-100 last:border-b-0 sm:px-8 sm:py-8 sm:mb-0 sm:border-2 sm:rounded-2xl sm:border-gray-200/60 sm:bg-gradient-to-br sm:from-white sm:via-gray-50/50 sm:to-green-50/30 sm:hover:shadow-lg sm:transition-shadow sm:duration-200">
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
          <div className="flex items-start gap-2 sm:gap-4 mb-4 sm:mb-6">
            <div className="flex-shrink-0">
              <div
                className="w-8 h-8 sm:w-12 sm:h-12 text-white rounded-xl sm:rounded-2xl flex items-center justify-center text-sm sm:text-lg font-bold shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.primary}dd, ${themeColors.primary}bb)`
                }}
              >
                {questionIndex + 1}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <div
                  className="question-title-html flex-1"
                  dangerouslySetInnerHTML={{ __html: question.text_html || question.text || "Pregunta sin texto" }}
                />
                <div className="flex gap-2 items-center">
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
                  {/* Small icon to indicate skip/jump logic configured for this question */}
                  {question.config?.skipLogic?.enabled && (
                    <div title="Salto de página" className="flex items-center">
                      {/* Inline SVG: compact Word-like document icon (folded corner + 'W') */}
                      <svg className="h-5 w-5 text-indigo-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <title>Salto de página</title>
                        {/* Document body */}
                        <path d="M6 2h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
                        {/* Folded corner */}
                        <path d="M14 2v4h4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
                        {/* Stylized 'W' inside document */}
                        <path d="M7.2 15.5l1-5 1.2 3 1-3 1 5 1-4 1 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.95" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>


            </div>
          </div>

          {/* Imagen o video adjunto a la pregunta (question.image / questions.file_url).
              Se muestra arriba de la respuesta sin importar el tipo de pregunta —
              permite encuestas "a partir de un video": se adjunta el video acá y
              se responde con el tipo de pregunta normal (opción múltiple, texto, etc).
              Excluir tipo "video": ya renderiza su propio player dentro del switch. */}
          {question.image && question.type !== 'video' && (
            <div className="ml-0 sm:ml-14 mb-4 sm:mb-6">
              {/\.(mp4|webm|mov|ogg)(\?|$)/i.test(question.image) ? (
                <video
                  src={question.image}
                  controls
                  className="w-full max-h-[420px] rounded-xl border border-gray-200 bg-black"
                />
              ) : (
                <img
                  src={question.image}
                  alt=""
                  className="w-full max-h-[420px] rounded-xl border border-gray-200 object-contain bg-gray-50"
                />
              )}
            </div>
          )}

          {/* Contenido de la pregunta */}
          <div className="ml-0 sm:ml-14">
            <div className="mt-3 sm:mt-6">{renderInput()}</div>
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
    [answers, handleAnswerChange, validationErrors, shouldShowQuestion, cameraModalQuestionId, setCameraModalQuestionId],
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
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 text-gray-700 bg-gradient-to-r from-gray-700 to-gray-500 bg-clip-text text-transparent">No hay secciones o preguntas para previsualizar.</h2>
          <p className="text-base sm:text-lg text-muted-foreground mb-6">La encuesta no tiene contenido configurado para mostrar en la vista previa.</p>
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
  // isCompact state + resize effect moved to the top-level hook declarations to preserve stable hook order

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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4 sm:mb-6">
              <Button
                variant="ghost"
                onClick={() => router.back()}
                className="text-muted-foreground hover:bg-green-100/80 transition-all duration-200 rounded-xl px-3 py-2 text-sm sm:text-base"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" /> Volver
              </Button>
              {/*
                SEGURIDAD (auditoría 2026-07-29): existía aquí un botón "Limpiar
                Respuestas" marcado como "(testing)" en el código, visible para
                cualquier persona tomando la encuesta (pública o desde el portal
                del encuestador), sin confirmación ni gating por rol/entorno. Un
                toque accidental borraba todas las respuestas ya diligenciadas
                de la sección actual sin forma de deshacerlo. Se retira por
                completo del flujo de producción — no tiene un uso legítimo
                para el encuestado ni el encuestador en campo.
              */}
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
                className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 preview-title"
                style={{
                  color: themeColors.text
                }}
              >
                {surveyData.title}
              </CardTitle>
              {/* Survey description intentionally hidden in the app per audit requirement */}
              {/* Barra de progreso mejorada */}
              <div className="mt-4 sm:mt-8 w-full max-w-2xl mx-auto px-2 sm:px-0">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700">Progreso de la encuesta</span>
                  <span className="text-sm font-semibold text-gray-700">
                    {currentSectionIndex + 1} de {totalSections}
                  </span>
                </div>
                <div className="relative w-full">
                  {/* Interactive segmented progress bar: one segment per section */}
                  <div className="w-full h-4 rounded-full bg-gray-100 flex overflow-hidden">
                    {(surveyData.sections || []).map((s: any, i: number) => {
                      const isActive = i === currentSectionIndex
                      const segmentWidth = `${100 / (surveyData.sections?.length || 1)}%`
                      return (
                        <button
                          key={s.id}
                          onClick={() => setCurrentSectionIndex(i)}
                          title={`${i + 1}. ${s.title || `Sección ${i + 1}`}`}
                          className={`h-4 focus:outline-none transition-all ${isActive ? 'scale-y-105' : ''}`}
                          style={{
                            width: segmentWidth,
                            background: isActive ? themeColors.primary : `${themeColors.primary}55`,
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        />
                      )
                    })}
                  </div>
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
        <CardContent className="p-0 sm:p-6 md:p-10">
          {/* Header de la sección */}
          <div className="text-center mb-6 sm:mb-10 preview-content px-4 pt-5 sm:px-0 sm:pt-0">
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
                className="rich-html-content text-2xl sm:text-3xl font-bold text-center mb-3"
                dangerouslySetInnerHTML={{ __html: currentSection.title_html }}
              />
            ) : (
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-3">
                {currentSection.title ? currentSection.title : `Sección ${currentSectionIndex + 1}`}
              </div>
            )}
            {/* Descripción de sección oculta en la vista del encuestado (slide 5) */}
            {/* Eliminado el CSS global que sobrescribía h1/h2 para respetar el HTML enriquecido */}
          </div>

          {/* Indicador de lógica de visualización */}
          {currentSection.questions.some(q => q.config?.displayLogic?.enabled) && (
            <Alert className="mb-4 border-blue-200 bg-blue-50 mx-4 sm:mx-0">
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
            <Alert className="mb-4 border-green-200 bg-green-50 mx-4 sm:mx-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-800 font-medium">Reconciliando IDs automáticamente...</span>
              </div>
              <AlertDescription className="text-green-700 text-sm mt-1">
                El sistema está verificando y corrigiendo automáticamente las referencias de preguntas en la lógica de visualización.
              </AlertDescription>
            </Alert>
          )}

          <Progress value={(currentSectionIndex + 1) / currentSection.questions.length * 100} className="mb-4 mx-4 sm:mx-0" />

          <Separator className="my-4 sm:my-8" />

          {/* Preguntas */}
          <div className="sm:space-y-4">
            {currentSection.questions.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <AlertCircle className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-3">Esta sección no tiene preguntas</h3>
                <p className="text-muted-foreground text-lg">No hay preguntas configuradas para esta sección.</p>
              </div>
            ) : (
              currentSection.questions.map((question, qIndex) => {
                // Console log para debugging - muestra la estructura completa de cada pregunta

                return renderQuestion(question, qIndex);
              })
            )}
          </div>

          {/* Navegación */}
          <div className="flex flex-col sm:flex-row justify-between gap-3 mt-4 sm:mt-12 pt-4 sm:pt-8 border-t border-gray-200 px-4 pb-4 sm:px-0 sm:pb-0">
            <Button
              onClick={handlePreviousSection}
              disabled={currentSectionIndex === 0 || isSubmittingResponse}
              variant="outline"
              className="px-4 sm:px-8 py-3 sm:py-4 text-sm sm:text-base rounded-xl border-2 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 order-2 sm:order-1"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 mr-2" /> Anterior
            </Button>

            <Button
              onClick={handleNextSection}
              disabled={isSubmittingResponse}
              className="px-6 sm:px-10 py-3 sm:py-4 text-sm sm:text-base rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 order-1 sm:order-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              style={{
                background: `linear-gradient(to right, ${themeColors.primary}, ${themeColors.primary}dd, ${themeColors.primary}bb)`,
                color: 'white'
              }}
            >
              {isSubmittingResponse
                ? "Enviando..."
                : (currentSectionIndex === totalSections - 1 ? "Finalizar Encuesta" : "Siguiente Sección")}{" "}
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Finished dialog shown after successful submission */}
      <Dialog open={showFinishedDialog} onOpenChange={(open) => setShowFinishedDialog(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Encuesta finalizada</DialogTitle>
            <DialogDescription className="text-base">La encuesta fue enviada correctamente. ¿Deseas iniciar otra?</DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => {
              // go back to start without clearing (close dialog)
              setShowFinishedDialog(false)
              setCurrentSectionIndex(0)
            }}>Ver respuestas</Button>
            <Button onClick={() => clearAndResetSurvey()}>Iniciar otra</Button>
          </div>
        </DialogContent>
      </Dialog>

    </div >
  )
}

export default function SurveyPreviewPage(props: PreviewSurveyPageContentProps = {}) {
  // El fondo general ahora se maneja con .preview-bg
  return <PreviewSurveyPageContent {...props} />
}
