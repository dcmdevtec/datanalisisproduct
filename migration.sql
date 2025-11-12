ALTER TABLE public.responses
ADD COLUMN respondent_document_type TEXT,
ADD COLUMN respondent_document_number TEXT,
ADD COLUMN respondent_name TEXT;

ALTER TABLE public.responses
ALTER COLUMN respondent_id DROP NOT NULL;

-- Create table to store public (unauthenticated) respondents for specific surveys
CREATE TABLE IF NOT EXISTS public.public_respondents (
	id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
	survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
	document_type text NOT NULL,
	document_number text NOT NULL,
	full_name text,
	created_at timestamptz DEFAULT now()
);

-- Table to track the interaction of respondents (both public and authenticated) with surveys.
CREATE TABLE IF NOT EXISTS public.survey_respondent_tracking (
	id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
	survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
	respondent_public_id uuid REFERENCES public.public_respondents(id) ON DELETE CASCADE,
	respondent_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
	response_id uuid REFERENCES public.responses(id) ON DELETE SET NULL,
	status text NOT NULL DEFAULT 'started',
	started_at timestamptz DEFAULT now(),
	completed_at timestamptz
);

-- Indexes to speed up lookups by survey + respondent
CREATE UNIQUE INDEX IF NOT EXISTS survey_respondent_tracking_unique_public ON public.survey_respondent_tracking(survey_id, respondent_public_id) WHERE respondent_public_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS survey_respondent_tracking_unique_user ON public.survey_respondent_tracking(survey_id, respondent_user_id) WHERE respondent_user_id IS NOT NULL;

COMMENT ON COLUMN public.survey_respondent_tracking.status IS 'Registra el estado de la encuesta para un encuestado: started, completed, abandoned';
