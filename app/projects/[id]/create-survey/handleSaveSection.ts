import { SupabaseClient } from '@    // Validar todos los datos antes de guardar
    const validationErrors = validateSurveyData(
      surveyTitle,
      surveyDescription,
      startDate,
      deadline,
      sections
    )

    if (validationErrors.length > 0) {
      const errorMessages = validationErrors.map(error => error.message).join('\n')
      throw new Error(errorMessages)
    }ase-js'
import { handleCreateSurvey } from './handleCreateSurvey'
import type { Question, SurveySection, SurveySaveResponse } from './types'

export async function handleSaveSection(
  supabase: SupabaseClient,
  sectionId: string,
  currentSurveyId: string | null,
  projectId: string,
  userId: string,
  surveyTitle: string,
  surveyDescription: string,
  startDate: string,
  deadline: string,
  surveyStatus: string,
  settings: any,
  sections: SurveySection[],
  setCurrentSurveyId: (id: string) => void,
  setSectionSaveStates: (states: { [key: string]: 'saved' | 'not-saved' | 'error' }) => void,
): Promise<SurveySaveResponse> {
  try {
    console.log("🚀 Iniciando proceso de guardado de sección...")

    if (!sectionId) {
      throw new Error("ID de sección no proporcionado")
    }

    // Obtener la sección actual
    const currentSection = sections.find((s) => s.id === sectionId)
    if (!currentSection) {
      throw new Error("Sección no encontrada")
    }

    // Validar todos los datos de la encuesta
    const validationErrors = validateSurveyData(
      surveyTitle,
      surveyDescription,
      startDate,
      deadline,
      sections
    )

    if (validationErrors.length > 0) {
      const errorMessages = validationErrors.map(error => error.message).join('\n')
      throw new Error(errorMessages)
    }

    // Si no hay surveyId, crear la encuesta primero
    let surveyIdToUse = currentSurveyId
    if (!surveyIdToUse) {
      surveyIdToUse = await handleCreateSurvey(
        supabase,
        projectId,
        surveyTitle,
        surveyDescription,
        startDate,
        deadline,
        surveyStatus,
        settings
      )
      setCurrentSurveyId(surveyIdToUse)
    }

    // Preparar datos de la sección para guardar/actualizar
    const sectionData = {
      survey_id: surveyIdToUse,
      title: currentSection.title.trim(),
      description: currentSection.description || "",
      order_num: sections.indexOf(currentSection),
      skip_logic: currentSection.skipLogic || null,
    }

    // Guardar/actualizar la sección
    let savedSection
    if (currentSection.id) {
      const { data, error: sectionError } = await supabase
        .from('survey_sections')
        .upsert([{ id: currentSection.id, ...sectionData }])
        .select()
        .single()
      if (sectionError) throw sectionError
      savedSection = data
    } else {
      const { data, error: sectionError } = await supabase
        .from('survey_sections')
        .insert([sectionData])
        .select()
        .single()
      if (sectionError) throw sectionError
      savedSection = data
    }

    // Preparar y guardar las preguntas
    const questionsData = currentSection.questions.map((question, index) => ({
      survey_id: surveyIdToUse,
      section_id: savedSection.id,
      type: question.type,
      text: question.text.trim(),
      options: question.options || [],
      required: question.required || false,
      order_num: index,
      settings: question.config || {},
      matrix_rows: question.matrixRows || [],
      matrix_cols: question.matrixCols || [],
      rating_scale: question.ratingScale || 5,
      file_url: question.image || null,
      display_logic: question.config?.displayLogic || null,
      skip_logic: question.config?.skipLogic || null,
      validation_rules: question.config?.validation || null,
      question_config: question.config || null,
    }))

    // Eliminar preguntas existentes de la sección si las hay
    await supabase
      .from('questions')
      .delete()
      .eq('section_id', savedSection.id)

    // Insertar las nuevas preguntas
    const { error: questionsError } = await supabase
      .from('questions')
      .insert(questionsData)

    if (questionsError) {
      throw questionsError
    }

    // Actualizar estado de guardado
    setSectionSaveStates(sections.reduce((acc, section) => ({
        ...acc,
        [section.id]: section.id === savedSection.id ? 'saved' : 'not-saved'
      }), {} as { [key: string]: 'saved' | 'not-saved' | 'error' }))

    return {
      success: true,
      sectionId: savedSection.id,
      surveyId: surveyIdToUse
    }

  } catch (error: any) {
    console.error("Error al guardar sección:", error)
    
    let errorMessage = "Error al guardar la sección"
    if (error.message) {
      errorMessage = error.message
    } else if (error.error_description) {
      errorMessage = error.error_description
    } else if (error.details) {
      errorMessage = error.details
    }

    throw new Error(errorMessage)
  }
}