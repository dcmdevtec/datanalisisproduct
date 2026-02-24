-- ==========================================
-- SOLUCIÓN PARA ERROR 403: Row Level Security Policy
-- ==========================================
-- 
-- Error: "new row violates row-level security policy"
-- Causa: Faltan políticas RLS para Supabase Storage en producción
-- 
-- EJECUTAR EN: Supabase Dashboard → SQL Editor
-- ==========================================

-- 1. HABILITAR RLS EN STORAGE (si no está habilitado)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- 2. POLÍTICA DE LECTURA PÚBLICA PARA BUCKETS DE IMÁGENES
CREATE POLICY "Public read access for image buckets" ON storage.objects
FOR SELECT USING (
    bucket_id IN (
        'company-logos', 
        'project-logos', 
        'survey-images', 
        'survey-logos', 
        'zone-maps'
    )
);

-- 3. POLÍTICA DE UPLOAD PARA USUARIOS AUTENTICADOS
CREATE POLICY "Authenticated upload access" ON storage.objects
FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND 
    bucket_id IN (
        'company-logos', 
        'project-logos', 
        'survey-images', 
        'survey-logos', 
        'zone-maps'
    ) AND
    -- Validar que el archivo es una imagen
    (storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'gif', 'webp')
);

-- 4. POLÍTICA DE UPDATE PARA USUARIOS AUTENTICADOS
CREATE POLICY "Authenticated update access" ON storage.objects
FOR UPDATE USING (
    auth.role() = 'authenticated' AND 
    bucket_id IN (
        'company-logos', 
        'project-logos', 
        'survey-images', 
        'survey-logos', 
        'zone-maps'
    )
);

-- 5. POLÍTICA DE DELETE PARA USUARIOS AUTENTICADOS
CREATE POLICY "Authenticated delete access" ON storage.objects
FOR DELETE USING (
    auth.role() = 'authenticated' AND 
    bucket_id IN (
        'company-logos', 
        'project-logos', 
        'survey-images', 
        'survey-logos', 
        'zone-maps'
    )
);

-- 6. POLÍTICA PARA SERVICE ROLE (backend)
CREATE POLICY "Service role full access" ON storage.objects
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- 7. POLÍTICA PARA BUCKETS - LECTURA PÚBLICA
CREATE POLICY "Public bucket read access" ON storage.buckets
FOR SELECT USING (true);

-- 8. POLÍTICA PARA BUCKETS - GESTIÓN POR SERVICE ROLE
CREATE POLICY "Service role bucket management" ON storage.buckets
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ==========================================
-- VERIFICACIÓN DE POLÍTICAS
-- ==========================================
-- Ejecuta esto para verificar que las políticas se crearon correctamente:

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
ORDER BY tablename, policyname;

-- ==========================================
-- CREAR BUCKETS SI NO EXISTEN
-- ==========================================
-- Asegurar que los buckets existen con la configuración correcta

INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES 
    ('company-logos', 'company-logos', true, false, 10485760, '{"image/jpeg","image/png","image/gif","image/webp"}'),
    ('project-logos', 'project-logos', true, false, 10485760, '{"image/jpeg","image/png","image/gif","image/webp"}'),
    ('survey-images', 'survey-images', true, false, 10485760, '{"image/jpeg","image/png","image/gif","image/webp"}'),
    ('survey-logos', 'survey-logos', true, false, 10485760, '{"image/jpeg","image/png","image/gif","image/webp"}'),
    ('zone-maps', 'zone-maps', true, false, 10485760, '{"image/jpeg","image/png","image/gif","image/webp"}')
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- COMANDO DE VERIFICACIÓN FINAL
-- ==========================================
-- Para verificar que todo funciona:

SELECT 
    b.id as bucket_id,
    b.name as bucket_name,
    b.public,
    COUNT(o.id) as objects_count
FROM storage.buckets b
LEFT JOIN storage.objects o ON b.id = o.bucket_id
WHERE b.id IN ('company-logos', 'project-logos', 'survey-images', 'survey-logos', 'zone-maps')
GROUP BY b.id, b.name, b.public
ORDER BY b.name;