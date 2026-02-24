-- =====================================================
-- SCRIPT DE CREACIÓN DE TABLAS PARA RASTREO DE ENCUESTADORES
-- =====================================================

-- 1. Crear la extensión PostGIS si no existe (requerido para operaciones geoespaciales)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Crear tabla de ubicaciones de encuestadores
CREATE TABLE IF NOT EXISTS surveyor_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    surveyor_id UUID NOT NULL,
    
    -- Ubicación
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(10, 2), -- precisión en metros
    
    -- Metadatos del dispositivo
    battery_level INTEGER, -- 0-100
    is_charging BOOLEAN DEFAULT FALSE,
    app_version TEXT,
    device_info TEXT,
    
    -- Estado de zona
    is_in_zone BOOLEAN DEFAULT FALSE,
    current_zone_id UUID,
    
    -- Contexto de trabajo
    active_survey_id UUID, -- encuesta activa al momento del registro
    
    -- Timestamps
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_coordinates CHECK (
        latitude >= -90 AND latitude <= 90 AND
        longitude >= -180 AND longitude <= 180
    ),
    CONSTRAINT valid_battery CHECK (
        battery_level IS NULL OR (battery_level >= 0 AND battery_level <= 100)
    )
);

-- 3. Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_surveyor_locations_surveyor ON surveyor_locations(surveyor_id);
CREATE INDEX IF NOT EXISTS idx_surveyor_locations_recorded ON surveyor_locations(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_surveyor_locations_zone ON surveyor_locations(current_zone_id);
CREATE INDEX IF NOT EXISTS idx_surveyor_locations_survey ON surveyor_locations(active_survey_id);

-- 4. Crear índice espacial para consultas geográficas
CREATE INDEX IF NOT EXISTS idx_surveyor_locations_spatial ON surveyor_locations 
USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326));

-- 5. Crear índice compuesto para obtener última ubicación de cada encuestador
CREATE INDEX IF NOT EXISTS idx_surveyor_locations_latest ON surveyor_locations(surveyor_id, recorded_at DESC);

-- 6. Agregar columna de referencia a surveyors si existe la tabla
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'surveyors') THEN
        -- Agregar foreign key
        ALTER TABLE surveyor_locations 
        ADD CONSTRAINT fk_surveyor_locations_surveyor 
        FOREIGN KEY (surveyor_id) REFERENCES surveyors(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Foreign key a surveyors agregada';
    ELSE
        RAISE NOTICE 'Tabla surveyors no existe, se agregará FK manualmente';
    END IF;
END $$;

-- 7. Agregar foreign key a zones si existe
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'zones') THEN
        ALTER TABLE surveyor_locations 
        ADD CONSTRAINT fk_surveyor_locations_zone 
        FOREIGN KEY (current_zone_id) REFERENCES zones(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Foreign key a zones agregada';
    END IF;
END $$;

-- 8. Agregar foreign key a surveys si existe
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'surveys') THEN
        ALTER TABLE surveyor_locations 
        ADD CONSTRAINT fk_surveyor_locations_survey 
        FOREIGN KEY (active_survey_id) REFERENCES surveys(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Foreign key a surveys agregada';
    END IF;
END $$;

-- 9. Crear función para verificar si un punto está dentro de una zona
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
            z.geometry::geometry,
            ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)
        ) as is_inside
    FROM zones z
    WHERE z.status = 'active'
    AND z.geometry IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- 10. Crear función para obtener la zona actual de un encuestador
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
    AND ST_Contains(
        z.geometry::geometry,
        ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)
    )
    LIMIT 1;
    
    RETURN v_zone_id;
END;
$$ LANGUAGE plpgsql;

-- 11. Crear trigger para actualizar automáticamente el campo is_in_zone y current_zone_id
CREATE OR REPLACE FUNCTION update_surveyor_zone()
RETURNS TRIGGER AS $$
DECLARE
    v_zone_id UUID;
BEGIN
    -- Buscar si el punto está en alguna zona
    v_zone_id := get_surveyor_current_zone(NEW.latitude, NEW.longitude);
    
    -- Actualizar campos
    NEW.current_zone_id := v_zone_id;
    NEW.is_in_zone := (v_zone_id IS NOT NULL);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Crear el trigger
DROP TRIGGER IF EXISTS trg_update_surveyor_zone ON surveyor_locations;
CREATE TRIGGER trg_update_surveyor_zone
    BEFORE INSERT ON surveyor_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_surveyor_zone();

-- 13. Crear tabla de configuración de tracking
CREATE TABLE IF NOT EXISTS tracking_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    surveyor_id UUID,
    is_tracking_enabled BOOLEAN DEFAULT TRUE,
    tracking_start_time TIME DEFAULT '08:00:00',
    tracking_end_time TIME DEFAULT '18:00:00',
    update_interval_seconds INTEGER DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Si surveyor_id es NULL, aplica a todos
    CONSTRAINT chk_interval CHECK (update_interval_seconds >= 30 AND update_interval_seconds <= 300)
);

-- 14. Insertar configuración por defecto
INSERT INTO tracking_config (is_tracking_enabled, update_interval_seconds)
VALUES (TRUE, 60)
ON CONFLICT DO NOTHING;

-- 15. Crear vista para obtener la última ubicación de cada encuestador
CREATE OR REPLACE VIEW v_surveyor_latest_location AS
SELECT DISTINCT ON (sl.surveyor_id)
    sl.id,
    sl.surveyor_id,
    s.name as surveyor_name,
    s.email as surveyor_email,
    s.phone_number as surveyor_phone,
    sl.latitude,
    sl.longitude,
    sl.accuracy,
    sl.battery_level,
    sl.is_charging,
    sl.is_in_zone,
    sl.current_zone_id,
    z.name as zone_name,
    sl.active_survey_id,
    sv.title as survey_title,
    sl.recorded_at,
    sl.app_version,
    CASE 
        WHEN sl.recorded_at > NOW() - INTERVAL '5 minutes' THEN 'active'
        WHEN sl.recorded_at > NOW() - INTERVAL '30 minutes' THEN 'inactive'
        ELSE 'offline'
    END as status
FROM surveyor_locations sl
LEFT JOIN surveyors s ON sl.surveyor_id = s.id
LEFT JOIN zones z ON sl.current_zone_id = z.id
LEFT JOIN surveys sv ON sl.active_survey_id = sv.id
ORDER BY sl.surveyor_id, sl.recorded_at DESC;

-- 16. Crear función para limpiar ubicaciones antiguas
CREATE OR REPLACE FUNCTION clean_old_locations(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM surveyor_locations
    WHERE recorded_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 17. Comentarios en las tablas
COMMENT ON TABLE surveyor_locations IS 'Almacena las ubicaciones en tiempo real de los encuestadores';
COMMENT ON TABLE tracking_config IS 'Configuración del sistema de tracking';
COMMENT ON COLUMN surveyor_locations.accuracy IS 'Precisión de la ubicación en metros';
COMMENT ON COLUMN surveyor_locations.battery_level IS 'Nivel de batería del dispositivo (0-100)';
COMMENT ON COLUMN surveyor_locations.is_in_zone IS 'Indica si el encuestador está dentro de una zona asignada';
COMMENT ON COLUMN surveyor_locations.current_zone_id IS 'ID de la zona donde se encuentra el encuestador';

-- 18. Habilitar RLS (Row Level Security)
ALTER TABLE surveyor_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_config ENABLE ROW LEVEL SECURITY;

-- 19. Políticas RLS para surveyor_locations
CREATE POLICY "Usuarios autenticados pueden leer ubicaciones"
    ON surveyor_locations FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar ubicaciones"
    ON surveyor_locations FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 20. Políticas RLS para tracking_config
CREATE POLICY "Usuarios autenticados pueden leer configuración"
    ON tracking_config FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins pueden actualizar configuración"
    ON tracking_config FOR UPDATE
    TO authenticated
    USING (true);

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
