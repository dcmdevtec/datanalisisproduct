-- Script para hacer los IDs de survey_sections únicos e inmutables
-- Ejecutar en tu base de datos PostgreSQL

-- 1. Verificar si hay IDs duplicados
SELECT id, COUNT(*) as count
FROM survey_sections 
GROUP BY id 
HAVING COUNT(*) > 1;

-- 2. Crear un índice único en el ID (si no existe)
CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_sections_id_unique 
ON survey_sections (id);

-- 3. Crear una función de validación para prevenir cambios de ID
CREATE OR REPLACE FUNCTION prevent_id_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Si se está intentando cambiar el ID, lanzar error
    IF OLD.id != NEW.id THEN
        RAISE EXCEPTION 'No se puede cambiar el ID de una sección. ID original: %, ID nuevo: %', OLD.id, NEW.id;
    END IF;
    
    -- Permitir la actualización de otros campos
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Crear un trigger que prevenga cambios de ID
DROP TRIGGER IF EXISTS prevent_survey_sections_id_change ON survey_sections;
CREATE TRIGGER prevent_survey_sections_id_change
    BEFORE UPDATE ON survey_sections
    FOR EACH ROW
    EXECUTE FUNCTION prevent_id_change();

-- 5. Verificar que el trigger se creó correctamente
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'survey_sections';

-- 6. Opcional: Agregar restricción CHECK adicional
ALTER TABLE survey_sections 
ADD CONSTRAINT check_id_not_changed 
CHECK (id = id);

-- 7. Verificar la estructura final de la tabla
\d survey_sections
