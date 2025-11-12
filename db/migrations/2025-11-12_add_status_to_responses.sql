-- Migration: add status column to responses
-- Adds a 'status' column with default 'completed' to support preview and other flows
-- Run in staging first and backup DB before running in production

BEGIN;

ALTER TABLE public.responses
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';

COMMIT;
