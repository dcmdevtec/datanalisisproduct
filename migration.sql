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

-- Añade started_at a responses: created_at/completed_at quedaban casi
-- simultáneos (se setean en el mismo INSERT al enviar), por lo que
-- "tiempo promedio por encuesta" en /reports siempre daba 0:00. started_at
-- se captura en el cliente cuando el encuestado empieza a responder.
ALTER TABLE public.responses
ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- Agrega "descalificado" como cuarto valor de responses.outcome, separado de
-- incidencia/abandonada (pedido del cliente: un salto de lógica "Descalificar
-- y terminar" — ej. edad menor a la requerida — no debe contar como
-- "Incidencia" ni como "Efectiva", sino como su propia categoría dentro de
-- "Registros no efectivos" en el módulo de Reportes).
ALTER TABLE public.responses DROP CONSTRAINT IF EXISTS responses_outcome_check;
ALTER TABLE public.responses
  ADD CONSTRAINT responses_outcome_check
  CHECK (outcome IS NULL OR outcome = ANY (ARRAY['efectiva'::text, 'incidencia'::text, 'abandonada'::text, 'descalificado'::text]));

-- Bucket público para la imagen de "rich preview" (Open Graph) del link
-- compartido de reportes — a diferencia de "response-media" (privado, con
-- URLs firmadas de corta duración), esta imagen la deben poder ver
-- WhatsApp/Slack/Facebook sin autenticación y de forma permanente, así que
-- necesita un bucket público de verdad.
INSERT INTO storage.buckets (id, name, public)
VALUES ('share-previews', 'share-previews', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Política: cualquiera puede LEER (necesario para que los crawlers de
-- WhatsApp/Slack/etc. carguen la imagen); solo el service role (backend)
-- puede escribir — la subida pasa por /api/shared-reports/upload-image,
-- nunca directo desde el navegador.
DROP POLICY IF EXISTS "share-previews public read" ON storage.objects;
CREATE POLICY "share-previews public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'share-previews');
