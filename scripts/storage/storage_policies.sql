-- Políticas de Seguridad (RLS) para Supabase Storage
-- Ejecuta este script en el editor SQL de tu proyecto Supabase
-- Formato adaptado al que usa Supabase Dashboard manualmente

BEGIN;

-- Habilitar Row Level Security en la tabla storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ========================================
-- POLÍTICAS DE LECTURA (SELECT) - PÚBLICO
-- ========================================

-- Lectura pública para survey-images
DROP POLICY IF EXISTS "survey_images_select" ON storage.objects;
CREATE POLICY "survey_images_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'survey-images');

-- Lectura pública para survey-logos
DROP POLICY IF EXISTS "survey_logos_select" ON storage.objects;
CREATE POLICY "survey_logos_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'survey-logos');

-- Lectura pública para project-logos
DROP POLICY IF EXISTS "project_logos_select" ON storage.objects;
CREATE POLICY "project_logos_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-logos');

-- Lectura pública para company-logos
DROP POLICY IF EXISTS "company_logos_select" ON storage.objects;
CREATE POLICY "company_logos_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

-- Lectura pública para zone-maps
DROP POLICY IF EXISTS "zone_maps_select" ON storage.objects;
CREATE POLICY "zone_maps_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'zone-maps');

-- ========================================
-- POLÍTICAS DE INSERCIÓN (INSERT)
-- ========================================

-- Inserción para survey-images (usuarios autenticados)
DROP POLICY IF EXISTS "survey_images" ON storage.objects;
CREATE POLICY "survey_images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'survey-images' 
    AND storage.extension(name) IN ('jpg', 'jpeg', 'png', 'gif', 'webp')
);

-- Inserción para survey-logos (usuarios autenticados)
DROP POLICY IF EXISTS "survey_logos" ON storage.objects;
CREATE POLICY "survey_logos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'survey-logos' 
    AND storage.extension(name) IN ('jpg', 'jpeg', 'png', 'svg', 'webp')
);

-- Inserción para project-logos (usuarios autenticados)
DROP POLICY IF EXISTS "project_logos" ON storage.objects;
CREATE POLICY "project_logos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'project-logos' 
    AND storage.extension(name) IN ('jpg', 'jpeg', 'png', 'svg', 'webp')
);

-- Inserción para company-logos (usuarios autenticados)
DROP POLICY IF EXISTS "company_logos" ON storage.objects;
CREATE POLICY "company_logos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'company-logos' 
    AND storage.extension(name) IN ('jpg', 'jpeg', 'png', 'svg', 'webp')
);

-- Inserción para zone-maps (usuarios autenticados)
DROP POLICY IF EXISTS "zone_maps" ON storage.objects;
CREATE POLICY "zone_maps"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'zone-maps' 
    AND storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp')
);

-- Inserción para response-media (usuarios autenticados, bucket privado)
DROP POLICY IF EXISTS "response_media" ON storage.objects;
CREATE POLICY "response_media"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'response-media' 
    AND storage.extension(name) IN ('jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi')
);

-- ========================================
-- POLÍTICAS DE LECTURA (SELECT) - PRIVADO
-- ========================================

-- Lectura para response-media (solo archivos propios)
DROP POLICY IF EXISTS "response_media_select" ON storage.objects;
CREATE POLICY "response_media_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'response-media' AND auth.uid() = owner);

-- ========================================
-- POLÍTICAS DE ACTUALIZACIÓN (UPDATE)
-- ========================================

-- Actualizar solo archivos propios
DROP POLICY IF EXISTS "authenticated_update" ON storage.objects;
CREATE POLICY "authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (auth.uid() = owner);

-- ========================================
-- POLÍTICAS DE ELIMINACIÓN (DELETE)
-- ========================================

-- Eliminar solo archivos propios
DROP POLICY IF EXISTS "authenticated_delete" ON storage.objects;
CREATE POLICY "authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (auth.uid() = owner);

COMMIT;
