-- Script de diagnóstico para identificar problemas con IDs de encuestas
-- Ejecutar este script para entender qué está pasando con los IDs

-- 1. Verificar la estructura de las tablas
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('surveys', 'survey_sections', 'questions')
ORDER BY table_name, ordinal_position;

-- 2. Verificar si hay triggers activos
SELECT 
    t.tgname as trigger_name,
    t.tgrelid::regclass as table_name,
    t.tgenabled as enabled,
    p.proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid IN ('surveys'::regclass, 'survey_sections'::regclass, 'questions'::regclass);

-- 3. Verificar si las funciones de protección existen
SELECT 
    proname as function_name,
    prosrc as function_source
FROM pg_proc 
WHERE proname IN ('prevent_survey_sections_id_change', 'prevent_questions_id_change');

-- 4. Verificar el formato de los IDs existentes
SELECT 
    'surveys' as table_name,
    id,
    CASE 
        WHEN id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' 
        THEN 'UUID válido' 
        ELSE 'UUID inválido' 
    END as id_status,
    LENGTH(id) as id_length
FROM surveys
LIMIT 10;

SELECT 
    'survey_sections' as table_name,
    id,
    CASE 
        WHEN id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' 
        THEN 'UUID válido' 
        ELSE 'UUID inválido' 
    END as id_status,
    LENGTH(id) as id_length
FROM survey_sections
LIMIT 10;

SELECT 
    'questions' as table_name,
    id,
    CASE 
        WHEN id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' 
        THEN 'UUID válido' 
        ELSE 'UUID inválido' 
    END as id_status,
    LENGTH(id) as id_length
FROM questions
LIMIT 10;

-- 5. Verificar si hay IDs numéricos o con formato incorrecto
SELECT 
    'survey_sections' as table_name,
    id,
    'ID numérico detectado' as problema
FROM survey_sections 
WHERE id ~ '^[0-9]+$'
LIMIT 5;

SELECT 
    'questions' as table_name,
    id,
    'ID numérico detectado' as problema
FROM questions 
WHERE id ~ '^[0-9]+$'
LIMIT 5;

-- 6. Verificar la integridad referencial
SELECT 
    'Secciones sin encuesta válida' as problema,
    COUNT(*) as cantidad
FROM survey_sections ss
LEFT JOIN surveys s ON ss.survey_id = s.id
WHERE s.id IS NULL;

SELECT 
    'Preguntas sin sección válida' as problema,
    COUNT(*) as cantidad
FROM questions q
LEFT JOIN survey_sections ss ON q.section_id = ss.id
WHERE ss.id IS NULL;

-- 7. Verificar si hay datos duplicados o inconsistentes
SELECT 
    'Secciones duplicadas por ID' as problema,
    id,
    COUNT(*) as cantidad
FROM survey_sections
GROUP BY id
HAVING COUNT(*) > 1;

SELECT 
    'Preguntas duplicadas por ID' as problema,
    id,
    COUNT(*) as cantidad
FROM questions
GROUP BY id
HAVING COUNT(*) > 1;

-- 8. Verificar el estado de las restricciones
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN ('surveys', 'survey_sections', 'questions')
ORDER BY tc.table_name, tc.constraint_type;

-- 9. Verificar si hay problemas con la secuencia de UUIDs
SELECT 
    'Extensiones UUID disponibles' as info,
    extname as extension_name,
    extversion as version
FROM pg_extension 
WHERE extname IN ('uuid-ossp', 'pgcrypto');

-- 10. Resumen del diagnóstico
DO $$
DECLARE
    survey_count INTEGER;
    section_count INTEGER;
    question_count INTEGER;
    invalid_section_ids INTEGER;
    invalid_question_ids INTEGER;
BEGIN
    -- Contar registros
    SELECT COUNT(*) INTO survey_count FROM surveys;
    SELECT COUNT(*) INTO section_count FROM survey_sections;
    SELECT COUNT(*) INTO question_count FROM questions;
    
    -- Contar IDs inválidos
    SELECT COUNT(*) INTO invalid_section_ids 
    FROM survey_sections 
    WHERE id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
    
    SELECT COUNT(*) INTO invalid_question_ids 
    FROM questions 
    WHERE id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
    
    RAISE NOTICE '📊 RESUMEN DEL DIAGNÓSTICO:';
    RAISE NOTICE '📋 Encuestas: %', survey_count;
    RAISE NOTICE '📋 Secciones: %', section_count;
    RAISE NOTICE '❓ Preguntas: %', question_count;
    RAISE NOTICE '⚠️  IDs de sección inválidos: %', invalid_section_ids;
    RAISE NOTICE '⚠️  IDs de pregunta inválidos: %', invalid_question_ids;
    
    IF invalid_section_ids > 0 OR invalid_question_ids > 0 THEN
        RAISE NOTICE '🚨 PROBLEMA DETECTADO: Hay IDs que no son UUIDs válidos!';
        RAISE NOTICE '💡 Solución: Ejecutar el script fix-survey-sections-ids.sql';
    ELSE
        RAISE NOTICE '✅ Todos los IDs parecen ser UUIDs válidos';
    END IF;
END $$;
