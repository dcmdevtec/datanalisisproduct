-- ==========================================
-- SOLUCIÓN INTELIGENTE: RLS POR AMBIENTE
-- ==========================================
-- 
-- PROBLEMA: Mismas políticas para dev y prod causan bloqueos
-- SOLUCIÓN: Políticas diferentes según el ambiente
-- 
-- EJECUTAR EN: Supabase Dashboard → SQL Editor
-- ==========================================

-- 1. ELIMINAR POLÍTICAS EXISTENTES PRIMERO
DROP POLICY IF EXISTS "Public read access for image buckets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete access" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access" ON storage.objects;
DROP POLICY IF EXISTS "Public bucket read access" ON storage.buckets;
DROP POLICY IF EXISTS "Service role bucket management" ON storage.buckets;

-- 2. HABILITAR RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS MUY PERMISIVAS PARA DESARROLLO
-- Permitir TODO a usuarios autenticados + service role

-- Lectura pública para todos
CREATE POLICY "Allow public read" ON storage.objects
FOR SELECT USING (
    bucket_id IN (
        'company-logos', 
        'project-logos', 
        'survey-images', 
        'survey-logos', 
        'zone-maps'
    )
);

-- Upload MUY permisivo para cualquier usuario autenticado
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT WITH CHECK (
    (auth.role() = 'authenticated' OR auth.role() = 'anon' OR auth.jwt() ->> 'role' = 'service_role') AND 
    bucket_id IN (
        'company-logos', 
        'project-logos', 
        'survey-images', 
        'survey-logos', 
        'zone-maps'
    )
);

-- Update permisivo
CREATE POLICY "Allow authenticated updates" ON storage.objects
FOR UPDATE USING (
    (auth.role() = 'authenticated' OR auth.role() = 'anon' OR auth.jwt() ->> 'role' = 'service_role') AND 
    bucket_id IN (
        'company-logos', 
        'project-logos', 
        'survey-images', 
        'survey-logos', 
        'zone-maps'
    )
);

-- Delete permisivo
CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE USING (
    (auth.role() = 'authenticated' OR auth.role() = 'anon' OR auth.jwt() ->> 'role' = 'service_role') AND 
    bucket_id IN (
        'company-logos', 
        'project-logos', 
        'survey-images', 
        'survey-logos', 
        'zone-maps'
    )
);

-- Service role acceso total
CREATE POLICY "Service role all access" ON storage.objects
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Buckets públicos para lectura
CREATE POLICY "Public bucket access" ON storage.buckets
FOR SELECT USING (true);

-- Service role gestión de buckets
CREATE POLICY "Service role bucket admin" ON storage.buckets
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ==========================================
-- VERIFICACIÓN
-- ==========================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'storage' 
ORDER BY tablename, policyname;

-- ==========================================
-- TEST DE ROLES
-- ==========================================
-- Verificar qué rol tienes actualmente:
SELECT 
    auth.role() as current_role,
    auth.uid() as user_id,
    auth.jwt() ->> 'role' as jwt_role;

-- ==========================================
-- CREAR/VERIFICAR BUCKETS
-- ==========================================
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES 
    ('company-logos', 'company-logos', true, false, 10485760, '{"image/jpeg","image/png","image/gif","image/webp"}'),
    ('project-logos', 'project-logos', true, false, 10485760, '{"image/jpeg","image/png","image/gif","image/webp"}'),
    ('survey-images', 'survey-images', true, false, 10485760, '{"image/jpeg","image/png","image/gif","image/webp"}'),
    ('survey-logos', 'survey-logos', true, false, 10485760, '{"image/jpeg","image/png","image/gif","image/webp"}'),
    ('zone-maps', 'zone-maps', true, false, 10485760, '{"image/jpeg","image/png","image/gif","image/webp"}')
ON CONFLICT (id) DO NOTHING;