-- Migration: Remove foreign key constraint from responses.respondent_id
-- Created: 2025-11-25
-- Description: Elimina la restricción que obliga a respondent_id a ser un usuario registrado,
--              permitiendo así almacenar IDs de public_respondents.

ALTER TABLE public.responses 
DROP CONSTRAINT IF EXISTS responses_respondent_id_fkey;

-- Opcional: Agregar un comentario explicando que esta columna es polimórfica
COMMENT ON COLUMN public.responses.respondent_id IS 'ID del encuestado. Puede ser un ID de public.users o public.public_respondents. No tiene FK estricta para permitir ambos.';
