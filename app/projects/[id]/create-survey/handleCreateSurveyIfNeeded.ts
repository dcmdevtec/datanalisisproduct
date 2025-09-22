import { toast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase-browser"

export async function handleCreateSurveyIfNeeded({
  currentSurveyId,
  surveyTitle,
  surveyDescription,
  projectId,
  user,
  startDate,
  deadline,
  settings,
  setCurrentSurveyId,
  setIsEditMode,
  setIsSaving,
}) {
  if (currentSurveyId) return currentSurveyId;

  if (!surveyTitle || !surveyTitle.trim()) {
    toast({
      title: "Error",
      description: "El título de la encuesta es obligatorio",
      variant: "destructive",
    });
    return null;
  }

  setIsSaving(true);
  try {
    const surveyData = {
      title: surveyTitle,
      description: surveyDescription,
      project_id: projectId,
      created_by: user?.id,
      status: "draft",
      start_date: startDate || null,
      deadline: deadline || null,
      settings: settings || {
        collectLocation: true,
        allowAudio: false,
        offlineMode: true,
        distributionMethods: ["app"],
      },
    };

    const { data: newSurvey, error: surveyError } = await supabase
      .from("surveys")
      .insert([surveyData])
      .select()
      .single();

    if (surveyError) throw surveyError;

    setCurrentSurveyId(newSurvey.id);
    setIsEditMode(true);
    toast({
      title: "Encuesta creada",
      description: "Ahora puedes agregar preguntas y secciones.",
    });
    return newSurvey.id;
  } catch (error) {
    toast({
      title: "Error",
      description: error.message || "No se pudo crear la encuesta",
      variant: "destructive",
    });
    return null;
  } finally {
    setIsSaving(false);
  }
}
