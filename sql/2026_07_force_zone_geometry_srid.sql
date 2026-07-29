-- Fix permanente: forzar SRID 4326 en toda geometría de `zones` al guardar.
--
-- Causa raíz encontrada 2026-07-29 al investigar el error de ubicación:
-- app/api/zones/route.ts inserta la geometría de una zona pasando el GeoJSON
-- crudo a Supabase (`.insert([{ geometry: processedGeometry, ... }])`).
-- Postgres/PostgREST convierte ese JSON a `geometry` con
-- ST_GeomFromGeoJSON() por debajo, función que NO asigna SRID — queda en 0.
-- Esto no es un caso aislado: afectó tanto a las zonas de prueba como a
-- "LOS ALPES" (zona real). El código de la ruta nunca toca SQL directo, así
-- que no hay forma de "forzar" el SRID desde ahí — el único punto donde se
-- puede garantizar consistentemente es un trigger en la tabla, que es
-- exactamente el mismo patrón que ya usa este sistema para
-- surveyor_locations (trg_update_surveyor_zone, sql/tracking_tables.sql).
--
-- Qué hace: en cada INSERT o UPDATE sobre `zones`, si la geometría no es
-- NULL y su SRID es 0 (sin definir), la normaliza a 4326 (WGS84 — el mismo
-- sistema que usan lat/lng normales). Si ya tiene un SRID válido, no la
-- toca. 100% aditivo, no borra ni renombra nada, seguro de re-ejecutar.

CREATE OR REPLACE FUNCTION normalize_zone_geometry_srid()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.geometry IS NOT NULL AND ST_SRID(NEW.geometry::geometry) = 0 THEN
        NEW.geometry := ST_SetSRID(NEW.geometry::geometry, 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_zone_geometry_srid ON public.zones;
CREATE TRIGGER trg_normalize_zone_geometry_srid
    BEFORE INSERT OR UPDATE ON public.zones
    FOR EACH ROW
    EXECUTE FUNCTION normalize_zone_geometry_srid();
