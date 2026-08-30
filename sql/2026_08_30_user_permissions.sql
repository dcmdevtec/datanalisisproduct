-- Permisos por módulo/acción por usuario (auditoría 2026-08-30: "no existe
-- forma de decirle a un usuario en particular qué módulo/acción puede
-- hacer, todo es por rol fijo").
--
-- ANTES DE APLICAR: igual que sql/2026_07_rls_hardening.sql — este entorno
-- no tiene acceso de red a la base de producción para probarlo antes de
-- entregarlo, así que revisar con calma / correr primero en un ambiente de
-- prueba si es posible.
--
-- Qué hace:
--   1) Agrega users.permissions (jsonb, nullable, default NULL) — un
--      OVERRIDE opcional sobre el default de rol definido en
--      lib/permissions.ts (ROLE_DEFAULTS). NULL o {} = se comporta
--      exactamente como hoy (el usuario usa el default de su rol), así que
--      esta migración no cambia el acceso de NADIE hasta que un admin edite
--      permisos puntuales desde el módulo de Usuarios.
--   2) auth.user_has_permission(module, action) — función helper para usar
--      en políticas RLS (mismo patrón ya en uso: auth.user_has_role(),
--      auth.user_is_admin_or_supervisor(), ver sql/2026_07_rls_hardening.sql).
--      Lee el rol de public.users y el JSON de permissions; si no hay
--      override para ese módulo/acción, cae al mismo default codificado en
--      lib/permissions.ts (duplicado a propósito — incompatibilidad entre
--      ambos se detecta en code review, no es un problema de esta función).
--   3) Políticas de escritura para public.companies y public.projects —
--      hoy estas dos tablas NO tienen NINGÚN control de rol (se consultan
--      directo desde el navegador vía @supabase/ssr con la anon key, sin
--      pasar por una ruta /api/* — ver app/companies/page.tsx,
--      app/projects/page.tsx). Cualquier sesión válida podía crear/editar/
--      borrar. Se agrega SELECT abierto (igual que zones) + INSERT/UPDATE/
--      DELETE solo para quien tenga permiso companies.* / projects.*.

-- ═══════════════════════════════════════════════════════════════════════
-- 1) users.permissions
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS permissions jsonb;

COMMENT ON COLUMN public.users.permissions IS
  'Override opcional de permisos por módulo/acción sobre el default de su rol (ver lib/permissions.ts ROLE_DEFAULTS). NULL = usa el default del rol sin cambios. Forma: {"companies": {"create": true}, "reports": {"share": false}, ...}';

-- ═══════════════════════════════════════════════════════════════════════
-- 2) auth.user_has_permission(module, action)
-- ═══════════════════════════════════════════════════════════════════════
--
-- Defaults por rol — MISMA matriz que ROLE_DEFAULTS en lib/permissions.ts.
-- Si se agrega/cambia un módulo ahí, replicar acá.
CREATE OR REPLACE FUNCTION auth.user_has_permission(p_module text, p_action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_override jsonb;
  v_override_value jsonb;
  v_default boolean;
BEGIN
  SELECT role, permissions INTO v_role, v_override
  FROM public.users
  WHERE id = auth.uid();

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- Override explícito del usuario, si existe, manda sobre el default.
  IF v_override IS NOT NULL THEN
    v_override_value := v_override #> ARRAY[p_module, p_action];
    IF v_override_value IS NOT NULL THEN
      RETURN v_override_value = 'true'::jsonb;
    END IF;
  END IF;

  -- Default por rol (mismo grid que ROLE_DEFAULTS en lib/permissions.ts).
  v_default := CASE
    WHEN v_role = 'admin' THEN true
    WHEN v_role = 'coordinator' AND p_module IN ('dashboard','companies','projects','surveys','geolocation','zones','reports','messages') AND p_action = 'view' THEN true
    WHEN v_role = 'coordinator' AND p_module = 'projects' AND p_action = 'export' THEN true
    WHEN v_role = 'coordinator' AND p_module = 'reports' AND p_action = 'export' THEN true
    WHEN v_role = 'supervisor' AND p_module IN ('dashboard','companies','projects','surveys','surveyors','geolocation','users','zones','reports','messages') AND p_action = 'view' THEN true
    WHEN v_role = 'supervisor' AND p_module = 'projects' AND p_action = 'export' THEN true
    WHEN v_role = 'supervisor' AND p_module = 'surveys' AND p_action IN ('create','edit','delete','export') THEN true
    WHEN v_role = 'supervisor' AND p_module = 'reports' AND p_action IN ('export','share') THEN true
    WHEN v_role IN ('surveyor','client') AND p_module IN ('surveys','zones') AND p_action = 'view' THEN true
    ELSE false
  END;

  RETURN v_default;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3) public.companies / public.projects — hoy sin ningún control de rol
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_select_authenticated" ON public.companies;
CREATE POLICY "companies_select_authenticated"
  ON public.companies FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "companies_insert_permitted" ON public.companies;
CREATE POLICY "companies_insert_permitted"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (auth.user_has_permission('companies', 'create'));

DROP POLICY IF EXISTS "companies_update_permitted" ON public.companies;
CREATE POLICY "companies_update_permitted"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (auth.user_has_permission('companies', 'edit'))
  WITH CHECK (auth.user_has_permission('companies', 'edit'));

DROP POLICY IF EXISTS "companies_delete_permitted" ON public.companies;
CREATE POLICY "companies_delete_permitted"
  ON public.companies FOR DELETE
  TO authenticated
  USING (auth.user_has_permission('companies', 'delete'));

DROP POLICY IF EXISTS "projects_select_authenticated" ON public.projects;
CREATE POLICY "projects_select_authenticated"
  ON public.projects FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "projects_insert_permitted" ON public.projects;
CREATE POLICY "projects_insert_permitted"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.user_has_permission('projects', 'create'));

DROP POLICY IF EXISTS "projects_update_permitted" ON public.projects;
CREATE POLICY "projects_update_permitted"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (auth.user_has_permission('projects', 'edit'))
  WITH CHECK (auth.user_has_permission('projects', 'edit'));

DROP POLICY IF EXISTS "projects_delete_permitted" ON public.projects;
CREATE POLICY "projects_delete_permitted"
  ON public.projects FOR DELETE
  TO authenticated
  USING (auth.user_has_permission('projects', 'delete'));
