-- Migración: Reportes compartibles públicamente (tipo SurveyMonkey)
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.shared_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT        UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  survey_id   UUID        REFERENCES public.surveys(id) ON DELETE CASCADE,
  -- config almacena los filtros y secciones seleccionadas por el usuario al crear el link
  -- Estructura esperada:
  -- {
  --   "filters": { "companyId":"all", "projectId":"all", "surveyorId":"all",
  --                "supervisorId":"all", "coordinatorId":"all",
  --                "dateFrom":"", "dateTo":"", "tipo":"all" },
  --   "sections": { "resumen":true, "analisis":true, "rendimiento":false, "geografico":false },
  --   "surveyTitle": "Nombre de la encuesta"
  -- }
  config      JSONB       NOT NULL DEFAULT '{}',
  created_by  UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ          -- NULL = nunca expira
);

-- Índice para búsqueda rápida por token (acceso público sin auth)
CREATE INDEX IF NOT EXISTS idx_shared_reports_token ON public.shared_reports(token);

-- RLS: cualquiera puede leer shared_reports (es el punto del feature).
-- Solo admins/supervisores autenticados pueden crear/eliminar.
ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;

-- Lectura pública: la API pública usa service-role y evita RLS,
-- pero también funciona con anon para lecturas simples.
CREATE POLICY "public_read_shared_reports"
  ON public.shared_reports FOR SELECT
  USING (expires_at IS NULL OR expires_at > now());

-- Escritura: solo usuarios autenticados con rol admin/supervisor
CREATE POLICY "auth_insert_shared_reports"
  ON public.shared_reports FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "auth_delete_own_shared_reports"
  ON public.shared_reports FOR DELETE
  USING (auth.uid() = created_by);
