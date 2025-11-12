-- Migration: enable RLS on responses and add INSERT policy
-- WARNING: Test in staging first. Adjust policy to your security needs before applying to production.

BEGIN;

-- Enable row level security if not already enabled
ALTER TABLE public.responses
  ENABLE ROW LEVEL SECURITY;

-- Policy to allow inserts from service role, authenticated users, and preview/anon flows.
-- Supabase exposes auth.role() and auth.uid() in RLS expressions.
-- This policy is permissive for INSERT only; you should tighten it for your production requirements.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname = 'responses' AND p.polname = 'responses_allow_insert_preview'
  ) THEN
    CREATE POLICY responses_allow_insert_preview
      ON public.responses
      FOR INSERT
      WITH CHECK (
        auth.role() = 'service_role'
        OR auth.role() = 'authenticated'
        OR auth.role() = 'anon'
      );
  END IF;
END
$$;

-- Optionally, create a read policy so the preview can read its own data (if needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname = 'responses' AND p.polname = 'responses_allow_select_authenticated'
  ) THEN
    CREATE POLICY responses_allow_select_authenticated
      ON public.responses
      FOR SELECT
      USING (
        auth.role() = 'service_role'
        OR auth.role() = 'authenticated'
      );
  END IF;
END
$$;

COMMIT;
