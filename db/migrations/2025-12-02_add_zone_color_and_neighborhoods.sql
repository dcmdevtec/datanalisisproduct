-- Migration: Add zone_color and selected_neighborhoods columns to zones table
-- Date: 2025-12-02
-- Description: Adds support for zone colors and storing selected neighborhoods for choropleth mode

-- Add zone_color column (hex color value)
ALTER TABLE zones 
ADD COLUMN IF NOT EXISTS zone_color TEXT DEFAULT '#3388ff';

-- Add selected_neighborhoods column (array of neighborhood names)
ALTER TABLE zones 
ADD COLUMN IF NOT EXISTS selected_neighborhoods TEXT[] DEFAULT '{}';

-- Add comment to columns for documentation
COMMENT ON COLUMN zones.zone_color IS 'Hex color code for the zone visualization (e.g., #3388ff)';
COMMENT ON COLUMN zones.selected_neighborhoods IS 'Array of neighborhood names selected in choropleth mode';

-- Create index for better query performance on selected_neighborhoods
CREATE INDEX IF NOT EXISTS idx_zones_selected_neighborhoods 
ON zones USING GIN (selected_neighborhoods);

-- Verify the changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'zones' 
AND column_name IN ('zone_color', 'selected_neighborhoods');
