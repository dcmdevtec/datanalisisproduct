-- ============================================================
-- MIGRACIÓN: Políticas RLS para Acceso Público a Encuestas
-- ============================================================
-- Ejecutar en Supabase SQL Editor
-- Fecha: 31/03/2026
-- Propósito: Permitir que respondentes anónimos (sin login) puedan:
--   1. Leer encuestas activas
--   2. Leer secciones y preguntas de encuestas activas
--   3. Enviar respuestas
--   4. Gestionar su registro como respondente público
-- ============================================================

-- =====================
-- 1. SURVEYS (lectura pública de encuestas activas)
-- =====================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'public_read_active_surveys' AND tablename = 'surveys'
  ) THEN
    CREATE POLICY "public_read_active_surveys"
      ON surveys FOR SELECT
      TO anon
      USING (status = 'active');
  END IF;
END $$;

-- =====================
-- 2. SURVEY_SECTIONS (secciones de encuestas activas)
-- =====================
ALTER TABLE survey_sections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'public_read_active_sections' AND tablename = 'survey_sections'
  ) THEN
    CREATE POLICY "public_read_active_sections"
      ON survey_sections FOR SELECT
      TO anon
      USING (
        EXISTS (
          SELECT 1 FROM surveys
          WHERE surveys.id = survey_sections.survey_id
          AND surveys.status = 'active'
        )
      );
  END IF;
END $$;

-- =====================
-- 3. QUESTIONS (preguntas de encuestas activas)
-- =====================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'public_read_active_questions' AND tablename = 'questions'
  ) THEN
    CREATE POLICY "public_read_active_questions"
      ON questions FOR SELECT
      TO anon
      USING (
        EXISTS (
          SELECT 1 FROM surveys
          WHERE surveys.id = questions.survey_id
          AND surveys.status = 'active'
        )
      );
  END IF;
END $$;

-- =====================
-- 4. QUESTION_OPTIONS (opciones con imágenes de encuestas activas)
-- =====================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'public_read_active_options' AND tablename = 'question_options'
  ) THEN
    CREATE POLICY "public_read_active_options"
      ON question_options FOR SELECT
      TO anon
      USING (
        EXISTS (
          SELECT 1 FROM questions q
          JOIN surveys s ON s.id = q.survey_id
          WHERE q.id = question_options.question_id
          AND s.status = 'active'
        )
      );
  END IF;
END $$;

-- =====================
-- 5. RESPONSES (inserción pública)
-- =====================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'public_insert_responses' AND tablename = 'responses'
  ) THEN
    CREATE POLICY "public_insert_responses"
      ON responses FOR INSERT
      TO anon
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM surveys
          WHERE surveys.id = responses.survey_id
          AND surveys.status = 'active'
        )
      );
  END IF;
END $$;

-- =====================
-- 6. ANSWERS (inserción pública)
-- =====================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'public_insert_answers' AND tablename = 'answers'
  ) THEN
    CREATE POLICY "public_insert_answers"
      ON answers FOR INSERT
      TO anon
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM responses r
          JOIN surveys s ON s.id = r.survey_id
          WHERE r.id = answers.response_id
          AND s.status = 'active'
        )
      );
  END IF;
END $$;

-- =====================
-- 7. PUBLIC_RESPONDENTS (gestión de respondentes anónimos)
-- =====================
ALTER TABLE public_respondents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'public_manage_respondents' AND tablename = 'public_respondents'
  ) THEN
    CREATE POLICY "public_manage_respondents"
      ON public_respondents FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- =====================
-- 8. SURVEY_RESPONDENT_TRACKING (tracking de respondentes)
-- =====================
ALTER TABLE survey_respondent_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'public_manage_tracking' AND tablename = 'survey_respondent_tracking'
  ) THEN
    CREATE POLICY "public_manage_tracking"
      ON survey_respondent_tracking FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- VERIFICACIÓN: Ejecutar estas queries para confirmar
-- ============================================================
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('surveys', 'survey_sections', 'questions', 'question_options', 'responses', 'answers', 'public_respondents', 'survey_respondent_tracking')
-- ORDER BY tablename, policyname;
