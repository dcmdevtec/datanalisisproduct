-- Script para prevenir cambios de ID en survey_sections y questions
-- Este script configura triggers que previenen que los IDs cambien

-- 1. Crear función para prevenir cambios de ID en survey_sections
CREATE OR REPLACE FUNCTION prevent_survey_sections_id_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.id IS DISTINCT FROM NEW.id THEN
        RAISE EXCEPTION 'No se permite cambiar el ID de la tabla survey_sections. El ID original era: %, el nuevo ID es: %', 
                       OLD.id, NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Crear función para prevenir cambios de ID en questions
CREATE OR REPLACE FUNCTION prevent_questions_id_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.id IS DISTINCT FROM NEW.id THEN
        RAISE EXCEPTION 'No se permite cambiar el ID de la tabla questions. El ID original era: %, el nuevo ID es: %', 
                       OLD.id, NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear trigger para survey_sections
DROP TRIGGER IF EXISTS prevent_survey_sections_id_change ON survey_sections;
CREATE TRIGGER prevent_survey_sections_id_change
BEFORE UPDATE ON survey_sections
FOR EACH ROW
EXECUTE FUNCTION prevent_survey_sections_id_change();

-- 4. Crear trigger para questions
DROP TRIGGER IF EXISTS prevent_questions_id_change ON questions;
CREATE TRIGGER prevent_questions_id_change
BEFORE UPDATE ON questions
FOR EACH ROW
EXECUTE FUNCTION prevent_questions_id_change();

-- 5. Verificar que los triggers se crearon
SELECT 
    'survey_sections' as tabla,
    t.tgname as trigger_name,
    p.proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'survey_sections'::regclass
AND t.tgname = 'prevent_survey_sections_id_change'

UNION ALL

SELECT 
    'questions' as tabla,
    t.tgname as trigger_name,
    p.proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'questions'::regclass
AND t.tgname = 'prevent_questions_id_change';

-- 6. Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE '✅ Triggers configurados exitosamente!';
    RAISE NOTICE '✅ Los IDs de survey_sections y questions están protegidos contra cambios.';
    RAISE NOTICE '💡 Ahora las secciones mantendrán sus IDs al editar encuestas.';
END $$;
