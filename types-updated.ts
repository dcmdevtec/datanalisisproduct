// =====================================================
// INTERFACES ACTUALIZADAS PARA MÓDULO 2
// =====================================================

// =====================================================
// CONFIGURACIONES DE ESCALAS PERSONALIZABLES
// =====================================================

export interface ScaleConfig {
  min: number
  max: number
  step: number
  startPosition: 'left' | 'center' | 'right'
  labels: {
    left: string
    center?: string
    right: string
  }
  showZero: boolean
  zeroLabel: string
  customSteps?: number[]
  showLabels: boolean
  showNumbers: boolean
  orientation: 'horizontal' | 'vertical'
}

// =====================================================
// EDITOR DE TEXTO RICO
// =====================================================

export interface RichTextConfig {
  fontSize: number
  fontFamily: string
  fontWeight: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'
  fontStyle: 'normal' | 'italic'
  textDecoration: 'none' | 'underline' | 'line-through' | 'overline'
  color: string
  backgroundColor: string
  listStyle: 'none' | 'bullet' | 'numbered' | 'alpha' | 'roman'
  highlight: boolean
  highlightColor: string
  alignment: 'left' | 'center' | 'right' | 'justify'
  lineHeight: number
  letterSpacing: number
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  textShadow: {
    x: number
    y: number
    blur: number
    color: string
  }
}

// =====================================================
// VALIDACIÓN AVANZADA
// =====================================================

export interface AdvancedValidation {
  preventDuplicates: boolean
  duplicateCheckFields: string[]
  fileValidation: {
    maxSize: number // en bytes
    allowedTypes: string[]
    maxFiles: number
    minFiles: number
    customValidation?: (file: File) => boolean
  }
  numericRange: {
    min: number
    max: number
    step: number
    allowDecimals: boolean
    decimalPlaces: number
  }
  customPattern: {
    regex: string
    message: string
    flags?: string
  }
  conditionalValidation: {
    enabled: boolean
    rules: ValidationRule[]
  }
  crossFieldValidation: {
    enabled: boolean
    rules: CrossFieldRule[]
  }
  timeValidation: {
    minTime: string
    maxTime: string
    allowedDays: number[]
    businessHours: {
      start: string
      end: string
    }
  }
}

export interface ValidationRule {
  condition: string
  message: string
  severity: 'error' | 'warning' | 'info'
}

export interface CrossFieldRule {
  field1: string
  field2: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than'
  message: string
}

// =====================================================
// CONFIGURACIÓN DE RANKING
// =====================================================

export interface RankingConfig {
  allowPartial: boolean
  minRanked: number
  maxRanked: number
  showNumbers: boolean
  dragAnimation: boolean
  validation: {
    requireAll: boolean
    allowTies: boolean
    allowIncomplete: boolean
  }
  display: {
    showDragHandle: boolean
    showRankNumbers: boolean
    highlightSelected: boolean
    animationDuration: number
  }
  options: {
    allowReordering: boolean
    allowDeselection: boolean
    maxSelections: number
    minSelections: number
  }
}

// =====================================================
// CONFIGURACIÓN DE TIEMPO
// =====================================================

export interface TimeConfig {
  format: '12h' | '24h'
  showSeconds: boolean
  minTime: string
  maxTime: string
  step: number // en segundos
  placeholder: string
  timezone: string
  businessHours: {
    enabled: boolean
    start: string
    end: string
    days: number[]
  }
  validation: {
    requireBusinessHours: boolean
    allowPastTime: boolean
    allowFutureTime: boolean
    maxAdvanceDays: number
  }
}

// =====================================================
// PREVENCIÓN DE DUPLICADOS
// =====================================================

export interface DuplicatePreventionConfig {
  enabled: boolean
  method: 'strict' | 'flexible' | 'custom'
  checkFields: string[]
  customLogic?: string
  action: 'block' | 'warn' | 'redirect'
  message: string
  redirectUrl?: string
  cooldownPeriod: number // en minutos
  maxSubmissions: number
  allowMultipleFromSameIP: boolean
  allowMultipleFromSameDevice: boolean
  fingerprinting: {
    enabled: boolean
    methods: ('ip' | 'userAgent' | 'fingerprint' | 'session')[]
  }
}

// =====================================================
// CONFIGURACIÓN DE MATRICES
// =====================================================

export interface MatrixConfig {
  cellType: 'radio' | 'checkbox' | 'text' | 'number' | 'rating' | 'dropdown'
  allowMultiple: boolean
  maxSelections: number
  minSelections: number
  randomizeRows: boolean
  randomizeColumns: boolean
  showTotals: boolean
  showAverages: boolean
  validation: {
    requireAllRows: boolean
    requireAllColumns: boolean
    minSelectionsPerRow: number
    maxSelectionsPerRow: number
  }
  appearance: {
    showBorders: boolean
    alternateRowColors: boolean
    compactMode: boolean
    showHeaders: boolean
  }
}

// =====================================================
// CONFIGURACIÓN DE ARCHIVOS
// =====================================================

export interface FileUploadConfig {
  maxSize: number
  allowedTypes: string[]
  maxFiles: number
  minFiles: number
  allowMultiple: boolean
  dragAndDrop: boolean
  preview: boolean
  compression: {
    enabled: boolean
    quality: number
    maxWidth: number
    maxHeight: number
  }
  storage: {
    provider: 'local' | 's3' | 'gcs' | 'azure'
    bucket?: string
    path?: string
    public: boolean
  }
  validation: {
    checkVirus: boolean
    checkMalware: boolean
    validateImage: boolean
    maxDimensions: {
      width: number
      height: number
    }
  }
}

// =====================================================
// CONFIGURACIÓN DE APARIENCIA
// =====================================================

export interface AppearanceConfig {
  theme: 'light' | 'dark' | 'auto' | 'custom'
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    surface: string
    text: string
    textSecondary: string
    border: string
    error: string
    warning: string
    success: string
    info: string
  }
  typography: {
    fontFamily: string
    fontSize: number
    lineHeight: number
    fontWeight: number
  }
  spacing: {
    padding: number
    margin: number
    gap: number
    borderRadius: number
  }
  animations: {
    enabled: boolean
    duration: number
    easing: string
  }
  responsive: {
    mobileFirst: boolean
    breakpoints: {
      sm: number
      md: number
      lg: number
      xl: number
    }
  }
}

// =====================================================
// INTERFAZ PRINCIPAL DE PREGUNTA ACTUALIZADA
// =====================================================

export interface Question {
  id: string
  type: string
  text: string
  options: string[]
  required: boolean
  image?: string | null
  matrixRows?: string[]
  matrixCols?: string[]
  ratingScale?: number
  section_id?: string
  survey_id?: string
  order_num?: number
  
  // Configuraciones existentes
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
    displayLogic?: DisplayLogic
    skipLogic?: SkipLogic
    validation?: ValidationConfig
    appearance?: AppearanceConfig
    [key: string]: any
  }
  
  // Nuevas configuraciones del MÓDULO 2
  scaleConfig?: ScaleConfig
  richTextConfig?: RichTextConfig
  advancedValidation?: AdvancedValidation
  rankingConfig?: RankingConfig
  timeConfig?: TimeConfig
  matrixConfig?: MatrixConfig
  fileUploadConfig?: FileUploadConfig
  
  // Campos de la base de datos
  settings?: any
  matrix?: any
  comment_box?: boolean
  rating?: number
  style?: any
  display_logic?: any
  skip_logic?: any
  validation_rules?: any
  question_config?: any
}

// =====================================================
// INTERFACES EXISTENTES (mantener compatibilidad)
// =====================================================

export interface DisplayLogic {
  enabled: boolean
  conditions: Array<{
    questionId: string
    questionText?: string
    operator: string
    value: string
    logicalOperator?: 'AND' | 'OR'
  }>
}

export interface SkipLogic {
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

export interface ValidationConfig {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: string
  customMessage?: string
}

// =====================================================
// INTERFACES DE ENCUESTA ACTUALIZADA
// =====================================================

export interface Survey {
  id: string
  title: string
  description?: string
  status: string
  deadline?: string
  settings?: SurveySettings
  created_by?: string
  created_at?: string
  updated_at?: string
  project_id?: string
  logo?: string
  theme_config?: any
  security_config?: any
  notification_config?: any
  branding_config?: any
  assigned_surveyors?: string[]
  start_date?: string
  assigned_zones?: string[]
  
  // Nueva configuración del MÓDULO 2
  duplicatePrevention?: DuplicatePreventionConfig
}

export interface SurveySettings {
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

// =====================================================
// INTERFACES DE SECCIÓN
// =====================================================

export interface SurveySection {
  id: string
  survey_id: string
  title: string
  description?: string
  order_num: number
  created_at?: string
  updated_at?: string
  skip_logic?: any
  questions: Question[]
}

// =====================================================
// TIPOS DE PREGUNTA SOPORTADOS
// =====================================================

export type QuestionType = 
  | 'text'
  | 'textarea'
  | 'multiple_choice'
  | 'checkbox'
  | 'dropdown'
  | 'scale'
  | 'matrix'
  | 'ranking'
  | 'date'
  | 'time'
  | 'email'
  | 'phone'
  | 'number'
  | 'rating'
  | 'file'
  | 'image_upload'
  | 'signature'
  | 'likert'
  | 'net_promoter'
  | 'slider'
  | 'comment_box'
  | 'star_rating'
  | 'demographic'
  | 'contact_info'
  | 'single_textbox'
  | 'multiple_textboxes'

// =====================================================
// OPERADORES DE VALIDACIÓN
// =====================================================

export type ValidationOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'is_empty'
  | 'is_not_empty'
  | 'starts_with'
  | 'ends_with'
  | 'regex_match'
  | 'between'
  | 'not_between'

// =====================================================
// CONFIGURACIONES PREDEFINIDAS
// =====================================================

export const DEFAULT_SCALE_CONFIG: ScaleConfig = {
  min: 1,
  max: 10,
  step: 1,
  startPosition: 'left',
  labels: {
    left: 'Muy en desacuerdo',
    right: 'Muy de acuerdo'
  },
  showZero: false,
  zeroLabel: 'No Sabe / No Responde',
  showLabels: true,
  showNumbers: true,
  orientation: 'horizontal'
}

export const DEFAULT_RICH_TEXT_CONFIG: RichTextConfig = {
  fontSize: 16,
  fontFamily: 'Inter',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  color: '#000000',
  backgroundColor: 'transparent',
  listStyle: 'none',
  highlight: false,
  highlightColor: '#ffff00',
  alignment: 'left',
  lineHeight: 1.5,
  letterSpacing: 0,
  textTransform: 'none',
  textShadow: {
    x: 0,
    y: 0,
    blur: 0,
    color: 'transparent'
  }
}

export const DEFAULT_TIME_CONFIG: TimeConfig = {
  format: '24h',
  showSeconds: false,
  minTime: '00:00',
  maxTime: '23:59',
  step: 900,
  placeholder: 'Selecciona una hora',
  timezone: 'UTC',
  businessHours: {
    enabled: false,
    start: '09:00',
    end: '17:00',
    days: [1, 2, 3, 4, 5]
  },
  validation: {
    requireBusinessHours: false,
    allowPastTime: true,
    allowFutureTime: true,
    maxAdvanceDays: 365
  }
}

// =====================================================
// UTILIDADES
// =====================================================

export function isScaleQuestion(type: QuestionType): boolean {
  return ['scale', 'likert', 'slider', 'rating'].includes(type)
}

export function isTimeQuestion(type: QuestionType): boolean {
  return type === 'time'
}

export function isRankingQuestion(type: QuestionType): boolean {
  return type === 'ranking'
}

export function isMatrixQuestion(type: QuestionType): boolean {
  return type === 'matrix'
}

export function isFileQuestion(type: QuestionType): boolean {
  return ['file', 'image_upload', 'signature'].includes(type)
}

export function getQuestionConfig(question: Question): any {
  return {
    ...question.config,
    scaleConfig: question.scaleConfig,
    richTextConfig: question.richTextConfig,
    advancedValidation: question.advancedValidation,
    rankingConfig: question.rankingConfig,
    timeConfig: question.timeConfig,
    matrixConfig: question.matrixConfig,
    fileUploadConfig: question.fileUploadConfig
  }
}
