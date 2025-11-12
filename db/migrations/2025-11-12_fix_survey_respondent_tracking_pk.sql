-- Migration: Replace composite PK (survey_id, respondent_id) with surrogate id
-- Filename: 2025-11-12_fix_survey_respondent_tracking_pk.sql
-- NOTE: This script was provided by the user. It runs inside a transaction and
-- will attempt to preserve existing data. Read the README in this folder and
-- make a backup before running on production.

BEGIN;

-- Ensure extension for gen_random_uuid exists (Postgres >= 13 / pgcrypto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Drop current PK (según tu output el nombre es survey_respondent_tracking_pkey)
ALTER TABLE public.survey_respondent_tracking
  DROP CONSTRAINT IF EXISTS survey_respondent_tracking_pkey;

-- 2) Add id column if missing
ALTER TABLE public.survey_respondent_tracking
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- 3) Fill existing rows (si hay)
UPDATE public.survey_respondent_tracking
  SET id = gen_random_uuid()
  WHERE id IS NULL;

-- 4) Ensure id NOT NULL
ALTER TABLE public.survey_respondent_tracking
  ALTER COLUMN id SET NOT NULL;

-- 5) Set id as new PK
ALTER TABLE public.survey_respondent_tracking
  ADD PRIMARY KEY (id);

-- 6) Allow respondent_id to be nullable now that it's not part of PK
ALTER TABLE public.survey_respondent_tracking
  ALTER COLUMN respondent_id DROP NOT NULL;

-- 7) Recreate recommended unique conditional indexes
CREATE UNIQUE INDEX IF NOT EXISTS survey_respondent_tracking_unique_public
  ON public.survey_respondent_tracking(survey_id, respondent_public_id)
  WHERE respondent_public_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS survey_respondent_tracking_unique_user
  ON public.survey_respondent_tracking(survey_id, respondent_user_id)
  WHERE respondent_user_id IS NOT NULL;

COMMIT;

-- End of migration
