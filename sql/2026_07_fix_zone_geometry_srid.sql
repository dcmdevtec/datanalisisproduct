-- Fix: POST /api/location fallaba con:
--   "contains: Operation on mixed SRID geometries (LineString, 0) != (Point, 4326)"
--
-- Causa: el trigger trg_update_surveyor_zone (sql/tracking_tables.sql) corre
-- en CADA insert a surveyor_locations y llama a get_surveyor_current_zone(),
-- que hace ST_Contains(zona.geometry, punto) contra TODAS las zonas activas.
-- Si una sola fila de `zones` tiene geometry mal guardada — geometría de
-- tipo LineString en vez de Polygon (probablemente un polígono que quedó
-- sin cerrar al dibujarlo en el mapa), y/o sin SRID (SRID 0 en vez de 4326,
-- WGS84) — la consulta completa falla, y con ella CUALQUIER inserción de
-- ubicación de CUALQUIER encuestador, no solo el que estaba probando.
--
-- Fix: hacer las funciones defensivas en vez de solo arreglar el dato de
-- una zona puntual (que puede volver a pasar si se dibuja mal otra zona):
--   1. Solo evalúa geometrías de tipo Polygon/MultiPolygon (una LineString
--      o Point nunca puede "contener" un punto de forma útil para esto).
--   2. Si el SRID es 0 (sin definir), asume 4326 (WGS84, el mismo que usan
--      lat/lng normales) en vez de fallar por mezcla de SRID.
--
-- Es 100% aditivo (CREATE OR REPLACE de funciones ya existentes) — no borra
-- ni renombra nada. Seguro de re-ejecutar.

CREATE OR REPLACE FUNCTION check_point_in_zones(
    p_latitude DECIMAL,
    p_longitude DECIMAL
) RETURNS TABLE (
    zone_id UUID,
    zone_name TEXT,
    is_inside BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        z.id::UUID,
        z.name::TEXT,
        ST_Contains(
            CASE WHEN ST_SRID(z.geometry::geometry) = 0
                 THEN ST_SetSRID(z.geometry::geometry, 4326)
                 ELSE z.geometry::geometry
            END,
            ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)
        ) as is_inside
    FROM zones z
    WHERE z.status = 'active'
      AND z.geometry IS NOT NULL
      AND ST_GeometryType(z.geometry::geometry) IN ('ST_Polygon', 'ST_MultiPolygon');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_surveyor_current_zone(
    p_latitude DECIMAL,
    p_longitude DECIMAL
) RETURNS UUID AS $$
DECLARE
    v_zone_id UUID;
BEGIN
    SELECT id INTO v_zone_id
    FROM zones z
    WHERE z.status = 'active'
      AND z.geometry IS NOT NULL
      AND ST_GeometryType(z.geometry::geometry) IN ('ST_Polygon', 'ST_MultiPolygon')
      AND ST_Contains(
          CASE WHEN ST_SRID(z.geometry::geometry) = 0
               THEN ST_SetSRID(z.geometry::geometry, 4326)
               ELSE z.geometry::geometry
          END,
          ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)
      )
    LIMIT 1;

    RETURN v_zone_id;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────
-- Diagnóstico opcional (correr aparte, no es parte del fix): identifica
-- cuál(es) zona(s) tienen la geometría mal guardada, para poder editarla o
-- volver a dibujarla desde el módulo de Zonas si hace falta.
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT id, name, status, ST_GeometryType(geometry::geometry) AS tipo, ST_SRID(geometry::geometry) AS srid
-- FROM zones
-- WHERE status = 'active'
--   AND geometry IS NOT NULL
--   AND (ST_GeometryType(geometry::geometry) NOT IN ('ST_Polygon', 'ST_MultiPolygon') OR ST_SRID(geometry::geometry) = 0);
