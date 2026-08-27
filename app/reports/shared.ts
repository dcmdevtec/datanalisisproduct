// Tipos y helpers compartidos entre /app/reports/page.tsx y /app/dashboard/page.tsx
// (el Dashboard reusa la forma de datos de /api/reports para su propio fetch
// independiente). Viven fuera de page.tsx porque Next.js no permite exports
// nombrados extra en un archivo page.tsx de App Router.

export interface ReportData {
  companies: { id: string; name: string }[]
  projects: { id: string; name: string; companyId: string }[]
  surveys: { id: string; title: string; projectId: string }[]
  surveyors: { id: string; name: string; supervisorId: string | null }[]
  supervisors?: { id: string; name: string }[]
  coordinators?: { id: string; name: string }[]
  summary: {
    totalResponses: number
    completionRate: number
    avgTime: string
    nps: number | null
    responseGrowth: number
    responsesTimeline: { date: string; count: number }[]
    responsesByHour: { hour: number; count: number }[]
    peakHour: number
    activeDays: number
    avgPerDay: number
    surveysWithData: number
    trendPct: number
    peakDay: { date: string; count: number } | null
    efectivas: number
    incidencias: number
    abandonadas: number
    tasaRespuestasEfectivas: number
  }
  responses: {
    questionBreakdowns: {
      questionId: string
      text: string
      type: string
      totalAnswers: number
      average?: string
      distribution?: { label: string; count: number; percentage: number }[]
      sampleAnswers?: string[]
      timeline?: { date: string; count: number }[]
    }[]
    filterableQuestions?: { questionId: string; text: string; values: string[] }[]
    crosstab?: {
      rowQuestion: string; colQuestion: string
      rows: string[]; cols: string[]; matrix: number[][]
      rowTotals: number[]; colTotals: number[]; total: number
    } | null
  }
  performance: {
    surveyorPerformance: {
      name: string
      supervisorId: string | null
      supervisorName: string | null
      totalAssignments: number
      completedAssignments: number
      completionRate: number
      efectivas: number
      incidencias: number
      abandonadas: number
      totalRegistros: number
      tasaRespuestas: number
      avgTime: string
    }[]
    dailyDistribution: { day: string; count: number }[]
    surveyPerformance: {
      title: string
      totalResponses: number
      completedResponses: number
      completionRate: number
      avgTime: string
    }[]
  }
  geographic: {
    zoneBreakdown: {
      zone: string
      responseCount: number
      completedCount: number
      percentage: number
      completionRate: number
    }[]
    zonePolygons: {
      id: string
      name: string
      geometry: any
      zoneColor: string
      responseCount: number
      completedCount: number
      completionRate: number
    }[]
    responsePoints: {
      lat: number
      lng: number
      status: string
      outcome?: "efectiva" | "incidencia" | "abandonada" | null
      createdAt: string
      surveyorName?: string | null
      respondentName?: string | null
      durationSecs?: number | null
      source?: string
    }[]
  }
}

export function formatGrowth(value: number): string {
  if (value === 0) return "Sin cambios"
  const sign = value > 0 ? "+" : ""
  return `${sign}${value}% vs período anterior`
}
