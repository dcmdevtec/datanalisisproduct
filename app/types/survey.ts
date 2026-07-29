// ============================================================
// TIPOS CENTRALIZADOS DEL MÓDULO DE ENCUESTAS
// ============================================================
// Este archivo es la ÚNICA fuente de verdad para todos los tipos
// relacionados con encuestas, secciones, preguntas y respuestas.
// NO definir estas interfaces en otros archivos.
// ============================================================

// --- Tipos de Pregunta ---

export type QuestionType =
  | "text"
  | "textarea"
  | "multiple_choice"
  | "checkbox"
  | "dropdown"
  | "scale"
  | "matrix"
  | "ranking"
  | "date"
  | "time"
  | "email"
  | "phone"
  | "number"
  | "rating"
  | "file"
  | "image_upload"
  | "signature"
  | "likert"
  | "net_promoter"
  | "slider"
  | "comment_box"
  | "star_rating"
  | "demographic"
  | "contact_info"
  | "single_textbox"
  | "multiple_textboxes"
  | "location"

// --- Display Logic ---

export interface DisplayLogicCondition {
  questionId: string
  questionText?: string
  operator: string
  value: string
  logicalOperator?: "AND" | "OR"
}

export interface DisplayLogic {
  enabled: boolean
  conditions: DisplayLogicCondition[]
}

// --- Skip Logic ---

export interface SkipLogicRule {
  condition?: string
  targetSectionId?: string
  targetQuestionId?: string
  targetQuestionText?: string
  enabled?: boolean
  operator?: string
  value?: string
}

export interface SkipLogic {
  enabled: boolean
  rules: SkipLogicRule[]
}

export interface SectionSkipLogic {
  enabled: boolean
  targetSectionId?: string
  targetQuestionId?: string
  targetQuestionText?: string
  action: "next_section" | "specific_section" | "specific_question" | "end_survey"
  conditions?: Array<{
    questionId: string
    operator: string
    value: string | number
  }>
}

// --- Validación ---

export interface ValidationRules {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: string
  customMessage?: string
}

// --- Configuración de Pregunta ---

export interface QuestionConfig {
  dropdownMulti?: boolean
  matrixCellType?: string
  scaleMin?: number
  scaleMax?: number
  scaleMinLabel?: string
  scaleMaxLabel?: string
  scaleLabels?: string[]
  allowOther?: boolean
  otherText?: string
  randomizeOptions?: boolean
  ratingEmojis?: boolean | string[]
  displayLogic?: DisplayLogic
  skipLogic?: SkipLogic
  validation?: ValidationRules
  likertScale?: LikertScaleConfig
  likertConfig?: LikertScaleConfig
  matrix?: MatrixConfig
  commentBox?: boolean
  style?: Record<string, unknown>
  parentId?: string | null
  questionConfig?: Record<string, unknown>
  [key: string]: unknown
}

// --- Pregunta ---

export interface Question {
  id: string
  type: string
  text: string
  text_html?: string
  options: Array<string | QuestionOption>
  required: boolean
  image?: string | null
  imageUrl?: string
  matrixRows?: string[]
  matrixCols?: string[]
  ratingScale?: number
  order_num?: number
  section_id?: string
  survey_id?: string
  config?: QuestionConfig
  // Campos directos de BD (se mapean a config en el frontend)
  display_logic?: Record<string, unknown>
  skip_logic?: Record<string, unknown>
  validation_rules?: Record<string, unknown>
  question_config?: Record<string, unknown>
  comment_box?: boolean
  style?: Record<string, unknown>
  settings?: Record<string, unknown>
}

export interface QuestionOption {
  value?: string
  label?: string
  image?: string | null
  image_base64?: string | null
  image_url?: string | null
  order_num?: number
  metadata?: Record<string, unknown>
}

// --- Sección ---

export interface SurveySection {
  id: string
  title: string
  title_html?: string
  description?: string
  order_num: number
  questions: Question[]
  skipLogic?: SectionSkipLogic
  // Campo de BD (se mapea a skipLogic en el frontend)
  skip_logic?: Record<string, unknown>
}

// --- Settings y Configuración de Encuesta ---

export interface ThemeConfig {
  primaryColor: string
  backgroundColor: string
  textColor: string
}

export interface SecurityConfig {
  passwordProtected: boolean
  password?: string
  preventMultipleSubmissions: boolean
}

export interface NotificationConfig {
  emailOnSubmission: boolean
}

export interface BrandingConfig {
  showLogo: boolean
  logoPosition: string
  logo?: string | null
}

export interface SurveySettings {
  collectLocation: boolean
  allowAudio: boolean
  offlineMode: boolean
  distributionMethods: string[]
  theme?: ThemeConfig
  branding?: BrandingConfig
  security?: SecurityConfig
  notifications?: NotificationConfig
  assignedUsers?: string[]
  assignedZones?: string[]
  publicLink?: string
}

// --- Encuesta ---

export interface Survey {
  id: string
  title: string
  description?: string
  status: string
  project_id?: string
  created_by?: string
  created_at?: string
  updated_at?: string
  settings?: SurveySettings
  start_date?: string | null
  deadline?: string | null
  assigned_surveyors?: string[]
  assigned_zones?: string[]
  logo?: string | null
  theme_config?: ThemeConfig | null
  security_config?: SecurityConfig | null
  notification_config?: NotificationConfig | null
  branding_config?: BrandingConfig | null
}

// --- Respondente Público ---

export interface PublicRespondent {
  id?: string
  survey_id: string
  document_type: string
  document_number: string
  full_name?: string
  email?: string
  phone?: string
  address?: string
  company?: string
}

// --- Respuesta ---

export interface SurveyResponse {
  id?: string
  survey_id: string
  respondent_id?: string | null
  public_respondent_id?: string | null
  respondent_document_type?: string
  respondent_document_number?: string
  respondent_name?: string
  location?: { lat: number; lng: number } | null
  status: string
  completed_at: string
}

export interface SurveyAnswer {
  question_id: string
  value: unknown
}

// --- Likert Config ---

export interface LikertScaleConfig {
  min: number
  max: number
  step: number
  startPosition?: number | string
  labels: string[]
  showZero?: boolean
  zeroLabel?: string
  showNumbers?: boolean
  showLabels?: boolean
  orientation?: "horizontal" | "vertical"
  validation?: {
    required: boolean
    customMessage?: string
  }
  appearance?: {
    showGridlines?: boolean
    labelPosition?: "top" | "bottom" | "left" | "right"
    labelAlignment?: "start" | "center" | "end"
  }
}

// --- Matrix Config ---

export interface MatrixConfig {
  rows?: string[]
  columns?: string[]
  cellType?: "radio" | "checkbox" | "dropdown" | "text" | "number" | "rating"
  allowMultiple?: boolean
  randomizeRows?: boolean
  randomizeColumns?: boolean
  validation?: {
    required?: boolean
    requireAllRows?: boolean
    customMessage?: string
  }
  appearance?: {
    showGridlines?: boolean
    alternateRowColors?: boolean
    compactMode?: boolean
    showHeaders?: boolean
  }
}

// --- Preview Data (para el modal y la página pública) ---

export interface SurveyPreviewData {
  title: string
  description: string
  startDate?: string
  deadline?: string
  sections: SurveySection[]
  settings: SurveySettings
  logo?: string | null
  projectData?: {
    id: string
    name: string
    companies: {
      id: string
      name: string
      logo: string | null
    } | null
  } | null
}

// --- Props de componentes compartidos ---

export interface SortableSectionProps {
  section: SurveySection
  index: number
  sectionIndex: number
  sections: SurveySection[]
  setSections: (sections: SurveySection[]) => void
  onRemoveSection: (sectionId: string) => void
  onEditSection: (sectionId: string) => void
  onSelectQuestion: (sectionId: string, questionId: string) => void
  surveyId: string
  isDragging?: boolean
}
