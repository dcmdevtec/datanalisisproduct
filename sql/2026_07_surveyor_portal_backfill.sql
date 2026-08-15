-- ============================================================
-- Backfill: encuestadores creados ANTES de la corrección de
-- POST /api/surveyors (2026-07-28)
-- Ejecutar en: Supabase SQL Editor (una sola vez, es idempotente)
-- ============================================================
--
-- BUG QUE ESTO CORRIGE:
-- "Añadir Encuestador" (app/api/surveyors/route.ts POST) creaba la cuenta
-- en Supabase Auth y la fila en public.surveyors, pero NUNCA una fila en
-- public.users. Como login/page.tsx, middleware.ts y DashboardLayout
-- deciden a dónde mandar a cada usuario consultando public.users.role, un
-- encuestador sin fila ahí no era reconocido como role='surveyor' y caía
-- por defecto al panel de administrador completo (que no filtra por rol —
-- "menú simplificado sin permisos"). Esto ya se corrigió en el código; este
-- script arregla las cuentas que se crearon ANTES de esa corrección
-- (ej. "Vera Judith Pelaez", "Heidy Yuranis Pinzón", "ENCUESTADOR 1").
--
-- Es seguro correrlo más de una vez: usa ON CONFLICT DO NOTHING y solo
-- actualiza filas que todavía están en el estado roto.

-- 1. Crear la fila faltante en public.users para cada encuestador que no
--    tenga una (mismo patrón que POST /api/users). role='surveyor' siempre,
--    porque estas filas de `surveyors` solo se crean desde el flujo de
--    "Añadir Encuestador".
INSERT INTO public.users (id, email, name, role, status, metadata)
SELECT s.id, s.email, s.name, 'surveyor', 'active', '{}'::jsonb
FROM public.surveyors s
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = s.id)
ON CONFLICT (id) DO NOTHING;

-- 2. Vincular surveyors.user_id -> su propia cuenta de login. En el flujo
--    viejo (y en el corregido) surveyors.id ES el id de la cuenta de Auth,
--    así que basta con igualar user_id = id una vez que sabemos que existe
--    la fila correspondiente en public.users (requisito de la FK
--    surveyors_user_id_fkey).
UPDATE public.surveyors s
SET user_id = s.id
WHERE s.user_id IS NULL
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = s.id);

-- 3. Diagnóstico: encuestadores que TODAVÍA no quedaron vinculados después
--    de los pasos anteriores (ej. su `id` no corresponde a ninguna cuenta
--    real de Supabase Auth — datos importados sin cuenta de login). Estos
--    necesitan que un admin les cree el acceso manualmente desde /surveyors
--    (editar y asignar una cuenta) o desde /users.
SELECT s.id, s.name, s.email, s.status
FROM public.surveyors s
WHERE s.user_id IS NULL;

-- 4. Diagnóstico adicional: por si alguna de estas cuentas YA tenía una
--    fila en public.users pero con un rol distinto de 'surveyor' (el script
--    no la tocó a propósito, para no pisar algo intencional) — revisar a
--    mano si corresponde cambiarle el rol.
SELECT s.id, s.name AS surveyor_name, u.name AS user_name, u.role
FROM public.surveyors s
JOIN public.users u ON u.id = s.id
WHERE u.role IS DISTINCT FROM 'surveyor';
