import { SupabaseClient } from '@supabase/supabase-js'

export async function handleCreateSurvey(
  supabase: SupabaseClient,
  projectId: string,
  surveyTitle: string,
  surveyDescription: string,
  startDate: string,
  deadline: string,
  surveyStatus: string,
  settings: any
) {
  // Validar título requerido
  if (!surveyTitle.trim()) {
    throw new Error('El título de la encuesta es requerido')
  }

  // Preparar datos de la encuesta
  const surveyData = {
    title: surveyTitle.trim(),
    description: surveyDescription.trim(),
    project_id: projectId,
    status: surveyStatus || 'draft',
    start_date: startDate || null,
    deadline: deadline || null,
    settings: settings || {},
    branding_config: settings?.branding || {},
    theme_config: settings?.theme || {},
    security_config: settings?.security || {},
    notification_config: settings?.notifications || {},
    assigned_surveyors: settings?.assignedUsers || [],
    assigned_zones: settings?.assignedZones || [],
  }

  try {
    console.log('📝 Creando nueva encuesta con datos:', surveyData)

    // Insertar la encuesta
    const { data: newSurvey, error: surveyError } = await supabase
      .from('surveys')
      .insert(surveyData)
      .select()
      .single()

    if (surveyError) {
      console.error('❌ Error al crear encuesta:', surveyError)
      throw surveyError
    }

    if (!newSurvey) {
      throw new Error('No se pudo crear la encuesta')
    }

    console.log('✅ Encuesta creada exitosamente:', newSurvey)
    return newSurvey.id

  } catch (error: any) {
    console.error('❌ Error en handleCreateSurvey:', error)
    let errorMessage = 'Error al crear la encuesta'
    
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