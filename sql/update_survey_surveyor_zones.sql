-- Migration: Update survey_surveyor_zones table to support general surveyors
-- This migration adds support for surveyors that are not assigned to a specific zone

-- Step 1: Add general_status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'survey_surveyor_zones' 
    AND column_name = 'general_status'
  ) THEN
    ALTER TABLE public.survey_surveyor_zones ADD COLUMN general_status boolean NULL;
  END IF;
END $$;

-- Step 2: Add id column if it doesn't exist (for new primary key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'survey_surveyor_zones' 
    AND column_name = 'id'
  ) THEN
    ALTER TABLE public.survey_surveyor_zones ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
  END IF;
END $$;

-- Step 3: Modify zone_id to allow NULL if not already
ALTER TABLE public.survey_surveyor_zones ALTER COLUMN zone_id DROP NOT NULL;

-- Step 4: Drop old primary key constraint if exists (survey_id, surveyor_id, zone_id)
-- We need to check if the constraint exists and drop it
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint 
  WHERE conrelid = 'public.survey_surveyor_zones'::regclass
  AND contype = 'p';
  
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.survey_surveyor_zones DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- Step 5: Add new primary key on id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.survey_surveyor_zones'::regclass
    AND contype = 'p'
  ) THEN
    ALTER TABLE public.survey_surveyor_zones ADD CONSTRAINT survey_surveyor_zones_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Step 6: Add check constraint for general_status consistency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_survey_surveyor_zones_general_zone_consistency'
  ) THEN
    ALTER TABLE public.survey_surveyor_zones 
    ADD CONSTRAINT chk_survey_surveyor_zones_general_zone_consistency 
    CHECK (
      (
        (zone_id IS NULL AND general_status IS TRUE)
        OR (zone_id IS NOT NULL)
      )
    );
  END IF;
END $$;

-- Step 7: Create unique index for zone-specific assignments (where zone_id is not null)
CREATE UNIQUE INDEX IF NOT EXISTS ux_survey_surveyor_zones_survey_surveyor_zone 
ON public.survey_surveyor_zones (survey_id, surveyor_id, zone_id) 
WHERE (zone_id IS NOT NULL);

-- Step 8: Create unique index for general assignments (where zone_id is null)
CREATE UNIQUE INDEX IF NOT EXISTS ux_survey_surveyor_zones_survey_surveyor_general 
ON public.survey_surveyor_zones (survey_id, surveyor_id) 
WHERE (zone_id IS NULL);

-- Step 9: Update existing records to set general_status based on zone_id
-- If zone_id is null and general_status is null, set general_status to true
UPDATE public.survey_surveyor_zones 
SET general_status = true 
WHERE zone_id IS NULL AND general_status IS NULL;

-- Verification query (run this to check the structure)
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'survey_surveyor_zones';
