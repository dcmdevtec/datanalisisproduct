-- ==========================================
-- SOLUCIÓN TEMPORAL: DESHABILITAR RLS PARA DESARROLLO
-- ==========================================
-- 
-- PROBLEMA: RLS ahora bloquea tanto producción como desarrollo
-- SOLUCIÓN: Políticas más permisivas o deshabilitar RLS para dev
-- 
-- EJECUTAR EN: Supabase Dashboard → SQL Editor
-- ==========================================

-- OPCIÓN 1: DESHABILITAR RLS TEMPORALMENTE (DESARROLLO)
-- ⚠️ SOLO PARA DESARROLLO - NO USAR EN PRODUCCIÓN
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- VERIFICAR QUE RLS ESTÁ DESHABILITADO
-- ==========================================
SELECT 
    schemaname, 
    tablename, 
    rowsecurity,
    CASE 
        WHEN rowsecurity = false THEN '✅ RLS DESHABILITADO'
        ELSE '⚠️ RLS HABILITADO'
    END as status
FROM pg_tables 
WHERE schemaname = 'storage' 
    AND tablename IN ('objects', 'buckets');

-- ==========================================
-- LIMPIAR POLÍTICAS EXISTENTES (OPCIONAL)
-- ==========================================
-- Si quieres empezar desde cero:

DROP POLICY IF EXISTS "Public read access for image buckets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete access" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access" ON storage.objects;
DROP POLICY IF EXISTS "Public bucket read access" ON storage.buckets;
DROP POLICY IF EXISTS "Service role bucket management" ON storage.buckets;