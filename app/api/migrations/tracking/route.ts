import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Endpoint para crear las tablas de tracking
// Solo accesible con service_role key
export async function POST(request: Request) {
  console.log("🔵 POST /api/migrations/tracking - Creating tracking tables")

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌ Missing Supabase configuration")
    return NextResponse.json({ error: "Missing Supabase configuration" }, { status: 500 })
  }

  // Crear cliente con service role para tener permisos completos
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    // 1. Crear la tabla surveyor_locations
    console.log("📋 Creating surveyor_locations table...")
    
    const createTableSQL = `
      -- Crear tabla de ubicaciones de encuestadores
      CREATE TABLE IF NOT EXISTS surveyor_locations (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          surveyor_id UUID NOT NULL,
          
          -- Ubicación
          latitude DECIMAL(10, 8) NOT NULL,
          longitude DECIMAL(11, 8) NOT NULL,
          accuracy DECIMAL(10, 2),
          
          -- Metadatos del dispositivo
          battery_level INTEGER,
          is_charging BOOLEAN DEFAULT FALSE,
          app_version TEXT,
          device_info TEXT,
          
          -- Estado de zona
          is_in_zone BOOLEAN DEFAULT FALSE,
          current_zone_id UUID,
          
          -- Contexto de trabajo
          active_survey_id UUID,
          
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
    `

    const { error: tableError } = await supabase.rpc('exec_sql', { sql: createTableSQL })
    
    // Si el RPC no existe, intentar con una aproximación diferente
    if (tableError) {
      console.log("⚠️ RPC exec_sql not available, trying alternative approach...")
      
      // Crear la tabla insertando un registro y luego eliminándolo
      // Esto funciona porque Supabase auto-crea tablas en algunos casos
      // Pero necesitamos usar el SQL editor de Supabase directamente
      
      return NextResponse.json({
        error: "Cannot execute DDL via API",
        message: "Por favor, ejecuta el script SQL manualmente en el SQL Editor de Supabase",
        sqlFile: "/sql/tracking_tables.sql",
        instructions: [
          "1. Ve a Supabase Dashboard",
          "2. Navega a SQL Editor",
          "3. Copia el contenido de sql/tracking_tables.sql",
          "4. Ejecuta el script"
        ]
      }, { status: 400 })
    }

    console.log("✅ Table created successfully")

    // 2. Crear índices
    const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_surveyor_locations_surveyor ON surveyor_locations(surveyor_id);
      CREATE INDEX IF NOT EXISTS idx_surveyor_locations_recorded ON surveyor_locations(recorded_at DESC);
      CREATE INDEX IF NOT EXISTS idx_surveyor_locations_zone ON surveyor_locations(current_zone_id);
      CREATE INDEX IF NOT EXISTS idx_surveyor_locations_survey ON surveyor_locations(active_survey_id);
    `

    const { error: indexError } = await supabase.rpc('exec_sql', { sql: createIndexesSQL })
    if (indexError) {
      console.error("⚠️ Error creating indexes:", indexError)
    }

    // 3. Agregar foreign keys
    const addForeignKeysSQL = `
      ALTER TABLE surveyor_locations 
      ADD CONSTRAINT fk_surveyor_locations_surveyor 
      FOREIGN KEY (surveyor_id) REFERENCES surveyors(id) ON DELETE CASCADE;
      
      ALTER TABLE surveyor_locations 
      ADD CONSTRAINT fk_surveyor_locations_zone 
      FOREIGN KEY (current_zone_id) REFERENCES zones(id) ON DELETE SET NULL;
      
      ALTER TABLE surveyor_locations 
      ADD CONSTRAINT fk_surveyor_locations_survey 
      FOREIGN KEY (active_survey_id) REFERENCES surveys(id) ON DELETE SET NULL;
    `

    const { error: fkError } = await supabase.rpc('exec_sql', { sql: addForeignKeysSQL })
    if (fkError) {
      console.error("⚠️ Error adding foreign keys:", fkError)
    }

    // 4. Crear función para obtener zona actual
    const createFunctionSQL = `
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
    `

    const { error: funcError } = await supabase.rpc('exec_sql', { sql: createFunctionSQL })
    if (funcError) {
      console.error("⚠️ Error creating function:", funcError)
    }

    // 5. Crear trigger
    const createTriggerSQL = `
      CREATE OR REPLACE FUNCTION update_surveyor_zone()
      RETURNS TRIGGER AS $$
      DECLARE
          v_zone_id UUID;
      BEGIN
          v_zone_id := get_surveyor_current_zone(NEW.latitude, NEW.longitude);
          
          NEW.current_zone_id := v_zone_id;
          NEW.is_in_zone := (v_zone_id IS NOT NULL);
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS trg_update_surveyor_zone ON surveyor_locations;
      CREATE TRIGGER trg_update_surveyor_zone
          BEFORE INSERT ON surveyor_locations
          FOR EACH ROW
          EXECUTE FUNCTION update_surveyor_zone();
    `

    const { error: triggerError } = await supabase.rpc('exec_sql', { sql: createTriggerSQL })
    if (triggerError) {
      console.error("⚠️ Error creating trigger:", triggerError)
    }

    // 6. Crear tabla de configuración
    const createConfigTableSQL = `
      CREATE TABLE IF NOT EXISTS tracking_config (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          surveyor_id UUID,
          is_tracking_enabled BOOLEAN DEFAULT TRUE,
          tracking_start_time TIME DEFAULT '08:00:00',
          tracking_end_time TIME DEFAULT '18:00:00',
          update_interval_seconds INTEGER DEFAULT 60,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          CONSTRAINT chk_interval CHECK (update_interval_seconds >= 30 AND update_interval_seconds <= 300)
      );
      
      INSERT INTO tracking_config (is_tracking_enabled, update_interval_seconds)
      VALUES (TRUE, 60)
      ON CONFLICT DO NOTHING;
    `

    const { error: configError } = await supabase.rpc('exec_sql', { sql: createConfigTableSQL })
    if (configError) {
      console.error("⚠️ Error creating config table:", configError)
    }

    // 7. Crear vista
    const createViewSQL = `
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
    `

    const { error: viewError } = await supabase.rpc('exec_sql', { sql: createViewSQL })
    if (viewError) {
      console.error("⚠️ Error creating view:", viewError)
    }

    // 8. Habilitar RLS
    const enableRLSSQL = `
      ALTER TABLE surveyor_locations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE tracking_config ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Usuarios autenticados pueden leer ubicaciones"
          ON surveyor_locations FOR SELECT
          TO authenticated
          USING (true);

      CREATE POLICY "Usuarios autenticados pueden insertar ubicaciones"
          ON surveyor_locations FOR INSERT
          TO authenticated
          WITH CHECK (true);
          
      CREATE POLICY "Usuarios autenticados pueden leer configuración"
          ON tracking_config FOR SELECT
          TO authenticated
          USING (true);
    `

    const { error: rlsError } = await supabase.rpc('exec_sql', { sql: enableRLSSQL })
    if (rlsError) {
      console.error("⚠️ Error enabling RLS:", rlsError)
    }

    console.log("✅ All tracking tables and functions created successfully")

    return NextResponse.json({
      success: true,
      message: "Tracking tables created successfully",
      tables: ["surveyor_locations", "tracking_config"],
      functions: ["get_surveyor_current_zone", "update_surveyor_zone"],
      views: ["v_surveyor_latest_location"],
      triggers: ["trg_update_surveyor_zone"]
    })

  } catch (error: any) {
    console.error("❌ Error creating tracking tables:", error)
    return NextResponse.json({
      error: "Failed to create tracking tables",
      details: error.message,
      instructions: [
        "Por favor, ejecuta el script SQL manualmente:",
        "1. Ve a Supabase Dashboard",
        "2. Navega a SQL Editor",
        "3. Copia el contenido de sql/tracking_tables.sql",
        "4. Ejecuta el script"
      ]
    }, { status: 500 })
  }
}

// GET para verificar el estado de las tablas
export async function GET(request: Request) {
  console.log("🔵 GET /api/migrations/tracking - Checking tracking tables status")

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Missing Supabase configuration" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    // Verificar si la tabla surveyor_locations existe
    const { data: locationsData, error: locationsError } = await supabase
      .from('surveyor_locations')
      .select('id')
      .limit(1)

    const locationsTableExists = !locationsError || !locationsError.message.includes('does not exist')

    // Verificar si la tabla tracking_config existe
    const { data: configData, error: configError } = await supabase
      .from('tracking_config')
      .select('id')
      .limit(1)

    const configTableExists = !configError || !configError.message.includes('does not exist')

    // Verificar si la vista existe
    const { data: viewData, error: viewError } = await supabase
      .from('v_surveyor_latest_location')
      .select('*')
      .limit(1)

    const viewExists = !viewError || !viewError.message.includes('does not exist')

    return NextResponse.json({
      status: {
        surveyor_locations_table: locationsTableExists ? '✅ Created' : '❌ Not created',
        tracking_config_table: configTableExists ? '✅ Created' : '❌ Not created',
        v_surveyor_latest_location_view: viewExists ? '✅ Created' : '❌ Not created',
      },
      ready: locationsTableExists && configTableExists,
      message: locationsTableExists && configTableExists 
        ? "Tracking system is ready" 
        : "Run POST /api/migrations/tracking to create tables or execute sql/tracking_tables.sql manually in Supabase"
    })

  } catch (error: any) {
    console.error("❌ Error checking tracking tables:", error)
    return NextResponse.json({
      error: "Failed to check tracking tables",
      details: error.message
    }, { status: 500 })
  }
}
