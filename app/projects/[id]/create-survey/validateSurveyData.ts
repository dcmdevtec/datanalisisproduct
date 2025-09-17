export interface ValidationError {
  field: string
  message: string
}

export function validateSurveyData(
  surveyTitle: string,
  surveyDescription: string,
  startDate: string | null,
  deadline: string | null,
  sections: any[]
): ValidationError[] {
  const errors: ValidationError[] = []

  // Validaciones básicas de la encuesta
  if (!surveyTitle.trim()) {
    errors.push({
      field: 'title',
      message: 'El título de la encuesta es requerido'
    })
  }

  if (surveyTitle.trim().length < 3) {
    errors.push({
      field: 'title',
      message: 'El título debe tener al menos 3 caracteres'
    })
  }

  if (surveyDescription && surveyDescription.trim().length > 1000) {
    errors.push({
      field: 'description',
      message: 'La descripción no puede exceder los 1000 caracteres'
    })
  }

  // Validar fechas
  if (startDate && deadline) {
    const start = new Date(startDate)
    const end = new Date(deadline)
    
    if (start > end) {
      errors.push({
        field: 'dates',
        message: 'La fecha de inicio debe ser anterior a la fecha límite'
      })
    }
  }

  // Validar estructura de secciones
  if (!sections || sections.length === 0) {
    errors.push({
      field: 'sections',
      message: 'La encuesta debe tener al menos una sección'
    })
    return errors // Si no hay secciones, retornar aquí
  }

  // Validar cada sección
  sections.forEach((section, index) => {
    if (!section.title || !section.title.trim()) {
      errors.push({
        field: `section_${index}_title`,
        message: `La sección ${index + 1} debe tener un título`
      })
    }

    if (!section.questions || section.questions.length === 0) {
      errors.push({
        field: `section_${index}_questions`,
        message: `La sección "${section.title || index + 1}" debe tener al menos una pregunta`
      })
      return // Si la sección no tiene preguntas, pasar a la siguiente
    }

    // Validar cada pregunta
    section.questions.forEach((question: any, qIndex: number) => {
      if (!question.text || !question.text.trim()) {
        errors.push({
          field: `section_${index}_question_${qIndex}`,
          message: `La pregunta ${qIndex + 1} en la sección "${section.title}" debe tener un texto`
        })
      }

      // Validar opciones para preguntas de selección
      if (
        ['multiple_choice', 'checkbox', 'dropdown'].includes(question.type) &&
        (!question.options || question.options.length === 0)
      ) {
        errors.push({
          field: `section_${index}_question_${qIndex}_options`,
          message: `La pregunta "${question.text || qIndex + 1}" en la sección "${section.title}" debe tener al menos una opción`
        })
      }

      // Validar configuración de matriz
      if (question.type === 'matrix' && (!question.matrixRows || !question.matrixCols)) {
        errors.push({
          field: `section_${index}_question_${qIndex}_matrix`,
          message: `La pregunta tipo matriz "${question.text || qIndex + 1}" debe tener filas y columnas definidas`
        })
      }

      // Validar rango de calificación
      if (question.type === 'rating' && question.config) {
        const { scaleMin, scaleMax } = question.config
        if (
          typeof scaleMin !== 'number' ||
          typeof scaleMax !== 'number' ||
          scaleMin >= scaleMax
        ) {
          errors.push({
            field: `section_${index}_question_${qIndex}_rating`,
            message: `La escala de calificación en la pregunta "${question.text || qIndex + 1}" debe tener un rango válido`
          })
        }
      }

      // Validar lógica de salto
      if (question.config?.skipLogic?.enabled && question.config.skipLogic.rules) {
        question.config.skipLogic.rules.forEach((rule: any, ruleIndex: number) => {
          if (!rule.targetSectionId && !rule.targetQuestionId) {
            errors.push({
              field: `section_${index}_question_${qIndex}_skip_logic_${ruleIndex}`,
              message: `La regla de salto ${ruleIndex + 1} en la pregunta "${question.text}" debe tener un destino válido`
            })
          }
        })
      }
    })

    // Validar lógica de salto de la sección
    if (section.skipLogic?.enabled) {
      if (section.skipLogic.action === 'specific_section' && !section.skipLogic.targetSectionId) {
        errors.push({
          field: `section_${index}_skip_logic`,
          message: `La sección "${section.title}" tiene lógica de salto a sección específica pero no se ha seleccionado una sección destino`
        })
      }
      if (section.skipLogic.action === 'specific_question' && !section.skipLogic.targetQuestionId) {
        errors.push({
          field: `section_${index}_skip_logic`,
          message: `La sección "${section.title}" tiene lógica de salto a pregunta específica pero no se ha seleccionado una pregunta destino`
        })
      }
    }
  })

  return errors
}