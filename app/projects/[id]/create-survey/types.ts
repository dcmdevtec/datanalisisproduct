export interface QuestionConfig {
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
      enabled?: boolean
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
  config?: QuestionConfig
}

export interface SectionSkipLogic {
  enabled: boolean
  targetSectionId?: string
  targetQuestionId?: string
  targetQuestionText?: string
  action: "next_section" | "specific_section" | "specific_question" | "end_survey"
}

export interface SurveySection {
  id: string
  title: string
  description?: string
  order_num: number
  questions: Question[]
  skipLogic?: SectionSkipLogic
}

export interface SurveySaveResponse {
  success: boolean
  sectionId: string
  surveyId: string | null
}