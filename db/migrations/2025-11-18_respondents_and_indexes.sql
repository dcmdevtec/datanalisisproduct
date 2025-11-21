-- Migration: Add public respondents, tracking and indexes
-- Created: 2025-11-18
-- WARNING: Run in a controlled environment and BACKUP your DB before applying in production.

-- 1) Add respondent document fields to responses (if not already present)
ALTER TABLE IF EXISTS public.responses
  ADD COLUMN IF NOT EXISTS respondent_document_type TEXT,
  ADD COLUMN IF NOT EXISTS respondent_document_number TEXT,
  ADD COLUMN IF NOT EXISTS respondent_name TEXT;

-- Make respondent_id nullable to allow anonymous/public respondents if needed
ALTER TABLE IF EXISTS public.responses
  ALTER COLUMN IF EXISTS respondent_id DROP NOT NULL;

-- 2) Create table to store public (unauthenticated) respondents for specific surveys
CREATE TABLE IF NOT EXISTS public.public_respondents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_number text NOT NULL,
  full_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 3) Table to track respondent interactions (optional usage)
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

-- 4) Indexes to speed up lookups by survey + respondent
CREATE UNIQUE INDEX IF NOT EXISTS survey_respondent_tracking_unique_public ON public.survey_respondent_tracking(survey_id, respondent_public_id) WHERE respondent_public_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS survey_respondent_tracking_unique_user ON public.survey_respondent_tracking(survey_id, respondent_user_id) WHERE respondent_user_id IS NOT NULL;

-- Indexes to speed up document lookups (used by verify/lookup endpoints)
CREATE INDEX IF NOT EXISTS idx_public_respondents_document ON public.public_respondents(document_type, document_number);
CREATE INDEX IF NOT EXISTS idx_responses_respondent_document ON public.responses(respondent_document_type, respondent_document_number);

COMMENT ON COLUMN public.survey_respondent_tracking.status IS 'Registra el estado de la encuesta para un encuestado: started, completed, abandoned';

-- Optional: ensure there are no duplicate public_respondents per survey + document
CREATE UNIQUE INDEX IF NOT EXISTS uq_public_respondents_survey_document ON public.public_respondents(survey_id, document_type, document_number);

-- End of migration
