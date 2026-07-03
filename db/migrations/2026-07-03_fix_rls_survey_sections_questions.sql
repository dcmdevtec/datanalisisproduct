-- ============================================================
-- MIGRACIÓN: Políticas RLS para usuarios autenticados
-- ============================================================
-- Problema: survey_sections y questions tienen RLS habilitado
-- pero sin políticas INSERT/UPDATE/DELETE para usuarios autenticados.
-- El cliente browser recibe 403 al intentar guardar secciones/preguntas.
--
-- Solución: Agregar políticas ALL para usuarios autenticados propietarios.
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── surveys ──────────────────────────────────────────────────────────────────
-- Asegurarse de que los usuarios autenticados puedan gestionar sus propias encuestas

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'authenticated_manage_own_surveys'
    AND tablename = 'surveys'
  ) THEN
    CREATE POLICY "authenticated_manage_own_surveys"
      ON surveys FOR ALL
      TO authenticated
      USING (created_by = auth.uid())
      WITH CHECK (created_by = auth.uid());
  END IF;
END $$;

-- ── survey_sections ───────────────────────────────────────────────────────────
-- Permitir a usuarios autenticados gestionar secciones de sus propias encuestas

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'authenticated_manage_own_sections'
    AND tablename = 'survey_sections'
  ) THEN
    CREATE POLICY "authenticated_manage_own_sections"
      ON survey_sections FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM surveys
          WHERE surveys.id = survey_sections.survey_id
          AND surveys.created_by = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM surveys
          WHERE surveys.id = survey_sections.survey_id
          AND surveys.created_by = auth.uid()
        )
      );
  END IF;
END $$;

-- ── questions ─────────────────────────────────────────────────────────────────
-- Permitir a usuarios autenticados gestionar preguntas de sus propias encuestas

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'authenticated_manage_own_questions'
    AND tablename = 'questions'
  ) THEN
    CREATE POLICY "authenticated_manage_own_questions"
      ON questions FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM surveys
          WHERE surveys.id = questions.survey_id
          AND surveys.created_by = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM surveys
          WHERE surveys.id = questions.survey_id
          AND surveys.created_by = auth.uid()
        )
      );
  END IF;
END $$;

-- ── Verificación ─────────────────────────────────────────────────────────────
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('surveys', 'survey_sections', 'questions')
ORDER BY tablename, policyname;
