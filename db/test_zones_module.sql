-- ============================================
-- SCRIPT DE PRUEBA: Módulo de Zonas
-- ============================================
-- Este script te ayuda a verificar que el módulo
-- de zonas esté funcionando correctamente
-- ============================================

-- PASO 1: Verificar estructura de la tabla zones
-- Debe mostrar todas las columnas incluyendo zone_color y selected_neighborhoods
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'zones'
ORDER BY ordinal_position;

-- PASO 2: Verificar índices
-- Debe incluir idx_zones_selected_neighborhoods
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'zones';

-- PASO 3: Consultar zonas existentes con todos los campos
SELECT 
    id,
    name,
    description,
    status,
    zone_color,
    selected_neighborhoods,
    ST_GeometryType(geometry) as geometry_type,
    ST_NPoints(geometry) as num_points,
    created_at,
    map_snapshot IS NOT NULL as has_snapshot
FROM zones
ORDER BY created_at DESC
LIMIT 10;

-- PASO 4: Verificar zona específica (reemplaza 'ZONE_ID' con un ID real)
-- SELECT 
--     id,
--     name,
--     zone_color,
--     selected_neighborhoods,
--     ST_AsGeoJSON(geometry) as geometry_json,
--     map_snapshot
-- FROM zones
-- WHERE id = 'ZONE_ID';

-- PASO 5: Estadísticas de zonas
SELECT 
    COUNT(*) as total_zones,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_zones,
    COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_zones,
    COUNT(CASE WHEN array_length(selected_neighborhoods, 1) > 0 THEN 1 END) as zones_with_neighborhoods,
    COUNT(CASE WHEN geometry IS NOT NULL THEN 1 END) as zones_with_geometry,
    COUNT(CASE WHEN map_snapshot IS NOT NULL THEN 1 END) as zones_with_snapshot,
    AVG(array_length(selected_neighborhoods, 1)) as avg_neighborhoods_per_zone
FROM zones;

-- PASO 6: Zonas creadas en las últimas 24 horas
SELECT 
    id,
    name,
    zone_color,
    array_length(selected_neighborhoods, 1) as num_neighborhoods,
    ST_GeometryType(geometry) as geom_type,
    created_at
FROM zones
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- PASO 7: Test de inserción (comentado por seguridad)
-- Descomenta para probar una inserción básica
/*
INSERT INTO zones (
    name,
    description,
    geometry,
    zone_color,
    selected_neighborhoods,
    status,
    created_by
) VALUES (
    'Zona de Prueba',
    'Esta es una zona de prueba',
    ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-74.8,10.9],[-74.8,11.0],[-74.7,11.0],[-74.7,10.9],[-74.8,10.9]]]}'),
    '#ff6b6b',
    ARRAY['Barrio Test 1', 'Barrio Test 2'],
    'active',
    '00000000-0000-0000-0000-000000000000' -- Reemplaza con un user_id real
) RETURNING *;
*/

-- PASO 8: Limpieza de zona de prueba (comentado por seguridad)
-- Ejecuta esto para eliminar la zona de prueba
/*
DELETE FROM zones 
WHERE name = 'Zona de Prueba' 
AND description = 'Esta es una zona de prueba';
*/

-- ============================================
-- RESULTADOS ESPERADOS
-- ============================================
-- PASO 1: Debe mostrar columnas incluyendo:
--   - zone_color (text)
--   - selected_neighborhoods (text[])
--   - geometry (geometry)
--   - map_snapshot (text)
--
-- PASO 2: Debe incluir índice:
--   - idx_zones_selected_neighborhoods
--
-- PASO 3-6: Deben ejecutarse sin errores
--
-- Si todos los pasos funcionan, el módulo está
-- correctamente configurado en la base de datos.
-- ============================================
