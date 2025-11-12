-- Migration: add optional preview fields to responses
-- Add device_info and respondent document fields so preview submissions succeed
-- Run this in staging first and backup DB before applying in production

BEGIN;

ALTER TABLE public.responses
  ADD COLUMN IF NOT EXISTS device_info jsonb NULL,
  ADD COLUMN IF NOT EXISTS respondent_document_type text NULL,
  ADD COLUMN IF NOT EXISTS respondent_document_number text NULL,
  ADD COLUMN IF NOT EXISTS respondent_name text NULL;

-- Index to speed up lookups by survey + respondent document
CREATE INDEX IF NOT EXISTS idx_responses_survey_respondent_doc ON public.responses (survey_id, respondent_document_type, respondent_document_number);

COMMIT;
