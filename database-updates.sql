-- =====================================================
-- ACTUALIZACIONES DE BASE DE DATOS PARA MÓDULO 2
-- =====================================================

-- Agregar campos para escalas personalizables
ALTER TABLE questions ADD COLUMN IF NOT EXISTS scale_config jsonb DEFAULT '{}';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS rich_text_config jsonb DEFAULT '{}';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS advanced_validation jsonb DEFAULT '{}';

-- Agregar campos para ranking
ALTER TABLE questions ADD COLUMN IF NOT EXISTS ranking_config jsonb DEFAULT '{}';

-- Agregar campos para tiempo
ALTER TABLE questions ADD COLUMN IF NOT EXISTS time_config jsonb DEFAULT '{}';

-- Agregar campo para configuración de duplicados en encuestas
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS duplicate_prevention jsonb DEFAULT '{}';

-- Crear índices para los nuevos campos JSONB
CREATE INDEX IF NOT EXISTS idx_questions_scale_config ON questions USING gin (scale_config);
CREATE INDEX IF NOT EXISTS idx_questions_rich_text_config ON questions USING gin (rich_text_config);
CREATE INDEX IF NOT EXISTS idx_questions_advanced_validation ON questions USING gin (advanced_validation);
CREATE INDEX IF NOT EXISTS idx_questions_ranking_config ON questions USING gin (ranking_config);
CREATE INDEX IF NOT EXISTS idx_questions_time_config ON questions USING gin (time_config);
CREATE INDEX IF NOT EXISTS idx_surveys_duplicate_prevention ON surveys USING gin (duplicate_prevention);

-- =====================================================
-- ACTUALIZAR TIPOS DE PREGUNTA EXISTENTES
-- =====================================================

-- Actualizar preguntas de escala existentes con configuración por defecto
UPDATE questions 
SET scale_config = jsonb_build_object(
  'min', 1,
  'max', 10,
  'step', 1,
  'startPosition', 'left',
  'labels', jsonb_build_object(
    'left', 'Muy en desacuerdo',
    'right', 'Muy de acuerdo'
  ),
  'showZero', false,
  'zeroLabel', 'No Sabe / No Responde'
)
WHERE type IN ('scale', 'likert', 'slider') 
AND scale_config IS NULL OR scale_config = '{}';

-- Actualizar preguntas de tiempo existentes
UPDATE questions 
SET time_config = jsonb_build_object(
  'format', '24h',
  'showSeconds', false,
  'minTime', '00:00',
  'maxTime', '23:59',
  'step', 900,
  'placeholder', 'Selecciona una hora'
)
WHERE type = 'time' 
AND time_config IS NULL OR time_config = '{}';

-- Actualizar preguntas de ranking existentes
UPDATE questions 
SET ranking_config = jsonb_build_object(
  'allowPartial', false,
  'minRanked', 1,
  'maxRanked', 10,
  'showNumbers', true,
  'dragAnimation', true,
  'validation', jsonb_build_object(
    'requireAll', true,
    'allowTies', false
  )
)
WHERE type = 'ranking' 
AND ranking_config IS NULL OR ranking_config = '{}';

-- =====================================================
-- FUNCIONES DE VALIDACIÓN
-- =====================================================

-- Función para validar escalas personalizables
CREATE OR REPLACE FUNCTION validate_scale_config(config jsonb)
RETURNS boolean AS $$
BEGIN
  -- Verificar que min < max
  IF (config->>'min')::int >= (config->>'max')::int THEN
    RETURN false;
  END IF;
  
  -- Verificar que step > 0
  IF (config->>'step')::int <= 0 THEN
    RETURN false;
  END IF;
  
  -- Verificar que el rango es divisible por el step
  IF ((config->>'max')::int - (config->>'min')::int) % (config->>'step')::int != 0 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Función para validar configuración de tiempo
CREATE OR REPLACE FUNCTION validate_time_config(config jsonb)
RETURNS boolean AS $$
BEGIN
  -- Verificar formato válido
  IF NOT (config->>'format') IN ('12h', '24h') THEN
    RETURN false;
  END IF;
  
  -- Verificar que minTime < maxTime
  IF (config->>'minTime') >= (config->>'maxTime') THEN
    RETURN false;
  END IF;
  
  -- Verificar que step > 0
  IF (config->>'step')::int <= 0 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS DE VALIDACIÓN
-- =====================================================

-- Trigger para validar scale_config antes de insertar/actualizar
CREATE OR REPLACE FUNCTION validate_question_scale_config()
RETURNS trigger AS $$
BEGIN
  IF NEW.scale_config IS NOT NULL AND NEW.scale_config != '{}' THEN
    IF NOT validate_scale_config(NEW.scale_config) THEN
      RAISE EXCEPTION 'Configuración de escala inválida';
    END IF;
  END IF;
  
  IF NEW.time_config IS NOT NULL AND NEW.time_config != '{}' THEN
    IF NOT validate_time_config(NEW.time_config) THEN
      RAISE EXCEPTION 'Configuración de tiempo inválida';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_validate_question_config ON questions;
CREATE TRIGGER trigger_validate_question_config
  BEFORE INSERT OR UPDATE ON questions
  FOR EACH ROW
  EXECUTE FUNCTION validate_question_scale_config();

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista para preguntas con escalas personalizables
CREATE OR REPLACE VIEW questions_with_scales AS
SELECT 
  q.id,
  q.text,
  q.type,
  q.scale_config,
  q.rich_text_config,
  q.advanced_validation,
  q.ranking_config,
  q.time_config,
  s.title as survey_title
FROM questions q
JOIN surveys s ON q.survey_id = s.id
WHERE q.scale_config IS NOT NULL 
   OR q.rich_text_config IS NOT NULL
   OR q.advanced_validation IS NOT NULL
   OR q.ranking_config IS NOT NULL
   OR q.time_config IS NOT NULL;

-- Vista para encuestas con prevención de duplicados
CREATE OR REPLACE VIEW surveys_with_duplicate_prevention AS
SELECT 
  id,
  title,
  duplicate_prevention,
  created_at
FROM surveys
WHERE duplicate_prevention IS NOT NULL AND duplicate_prevention != '{}';

-- =====================================================
-- DATOS DE PRUEBA
-- =====================================================

-- Insertar configuración de ejemplo para escalas
INSERT INTO questions (id, survey_id, type, text, options, required, order_num, scale_config)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM surveys LIMIT 1),
  'scale',
  'Ejemplo de escala personalizable del 1 al 100',
  '[]',
  true,
  1,
  '{
    "min": 1,
    "max": 100,
    "step": 1,
    "startPosition": "left",
    "labels": {
      "left": "Muy insatisfecho",
      "center": "Neutral",
      "right": "Muy satisfecho"
    },
    "showZero": true,
    "zeroLabel": "No Sabe / No Responde"
  }'
) ON CONFLICT DO NOTHING;

-- =====================================================
-- LIMPIEZA Y OPTIMIZACIÓN
-- =====================================================

-- Vacuum y analyze para optimizar la base de datos
VACUUM ANALYZE questions;
VACUUM ANALYZE surveys;

-- Verificar que todos los campos se crearon correctamente
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'questions' 
  AND column_name IN ('scale_config', 'rich_text_config', 'advanced_validation', 'ranking_config', 'time_config')
ORDER BY column_name;

-- Verificar que todos los campos se crearon correctamente en surveys
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'surveys' 
  AND column_name = 'duplicate_prevention';

-- =====================================================
-- ROLLBACK (en caso de problemas)
-- =====================================================

/*
-- Para revertir cambios en caso de problemas:
ALTER TABLE questions DROP COLUMN IF EXISTS scale_config;
ALTER TABLE questions DROP COLUMN IF EXISTS rich_text_config;
ALTER TABLE questions DROP COLUMN IF EXISTS advanced_validation;
ALTER TABLE questions DROP COLUMN IF EXISTS ranking_config;
ALTER TABLE questions DROP COLUMN IF EXISTS time_config;
ALTER TABLE surveys DROP COLUMN IF EXISTS duplicate_prevention;

-- Eliminar índices
DROP INDEX IF EXISTS idx_questions_scale_config;
DROP INDEX IF EXISTS idx_questions_rich_text_config;
DROP INDEX IF EXISTS idx_questions_advanced_validation;
DROP INDEX IF EXISTS idx_questions_ranking_config;
DROP INDEX IF EXISTS idx_questions_time_config;
DROP INDEX IF EXISTS idx_surveys_duplicate_prevention;

-- Eliminar funciones
DROP FUNCTION IF EXISTS validate_scale_config(jsonb);
DROP FUNCTION IF EXISTS validate_time_config(jsonb);
DROP FUNCTION IF EXISTS validate_question_scale_config();

-- Eliminar vistas
DROP VIEW IF EXISTS questions_with_scales;
DROP VIEW IF EXISTS surveys_with_duplicate_prevention;
*/
