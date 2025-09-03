export interface Survey {
  id: string;
  title: string;
  description: string;
  status: string;
  project_id: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  settings?: SurveySettings;
  start_date?: string | null;
  deadline?: string | null;
  assigned_surveyors?: string[];
  assigned_zones?: string[];
  logo?: string | null;
  theme_config?: ThemeConfig | null;
  security_config?: SecurityConfig | null;
  notification_config?: NotificationConfig | null;
  branding_config?: BrandingConfig | null;
}

export interface ThemeConfig {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
}

export interface SecurityConfig {
  passwordProtected: boolean;
  password?: string;
  preventMultipleSubmissions: boolean;
}

export interface NotificationConfig {
  emailOnSubmission: boolean;
}

export interface BrandingConfig {
  showLogo: boolean;
  logoPosition: string;
  logo?: string | null;
}

export interface SurveySettings {
  collectLocation: boolean;
  allowAudio: boolean;
  offlineMode: boolean;
  distributionMethods: string[];
  theme?: ThemeConfig;
  branding?: BrandingConfig;
  security?: SecurityConfig;
  notifications?: NotificationConfig;
  assignedUsers?: string[];
  assignedZones?: string[];
}

export interface QuestionConfig {
  allowOther?: boolean;
  randomizeOptions?: boolean;
  ratingEmojis?: boolean;
  scaleMin?: number;
  scaleMax?: number;
  matrixCellType?: string;
  scaleLabels?: string[];
  otherText?: string;
  dropdownMulti?: boolean;
  displayLogic?: DisplayLogic;
  skipLogic?: SkipLogic;
  validation?: ValidationRules;
  likertScale?: LikertScaleConfig;
  matrix?: MatrixConfig;
  questionConfig?: any;
  commentBox?: boolean;
  style?: any;
  parentId?: string | null;
}

export interface DisplayLogic {
  enabled: boolean;
  conditions: Array<{
    questionId: string;
    operator: string;
    value: string;
  }>;
}

export interface SkipLogic {
  enabled: boolean;
  rules: Array<{
    condition?: string;
    targetSectionId?: string;
    targetQuestionId?: string;
    targetQuestionText?: string;
    enabled?: boolean;
    operator?: string;
    value?: string;
  }>;
}

export interface ValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  customMessage?: string;
}

export interface LikertScaleConfig {
  min: number;
  max: number;
  step: number;
  startPosition: number;
  labels: string[];
  showZero: boolean;
  zeroLabel?: string;
  showNumbers: boolean;
  showLabels: boolean;
  orientation: 'horizontal' | 'vertical';
  validation: {
    required: boolean;
    customMessage?: string;
  };
  appearance: {
    showGridlines: boolean;
    labelPosition: 'top' | 'bottom' | 'left' | 'right';
    labelAlignment: 'start' | 'center' | 'end';
  };
}

export interface MatrixConfig {
  rows: string[];
  columns: string[];
  cellType: 'radio' | 'checkbox' | 'dropdown' | 'text';
  validation: {
    required: boolean;
    requireAllRows: boolean;
    customMessage?: string;
  };
  appearance: {
    showGridlines: boolean;
    alternateRowColors: boolean;
  };
}

export interface Question {
  id: string;
  type: string;
  text: string;
  options: string[];
  required: boolean;
  image?: string | null;
  matrixRows?: string[];
  matrixCols?: string[];
  ratingScale?: number;
  config?: QuestionConfig;
}

export interface SectionSkipLogic {
  enabled: boolean;
  targetSectionId?: string;
  targetQuestionId?: string;
  targetQuestionText?: string;
  action: "next_section" | "specific_section" | "specific_question" | "end_survey";
}

export interface SurveySection {
  id: string;
  title: string;
  description?: string;
  order_num: number;
  questions: Question[];
  skipLogic?: SectionSkipLogic;
}
