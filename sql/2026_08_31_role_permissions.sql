-- Permisos por módulo/acción a nivel de ROL (editable desde /users → pestaña
-- "Roles y permisos"), corrigiendo el enfoque de la migración anterior.
--
-- Contexto: sql/2026_08_30_user_permissions.sql agregó un override POR
-- USUARIO (users.permissions) con su editor metido en el modal de Editar
-- Usuario. Pedido explícito del cliente: "te pedí un módulo completo o un
-- tab [...] esto es para que se vea mucho mejor en otro tab en el módulo de
-- usuario, lo que se edita son los permisos del ROL" — es decir, un admin
-- necesita poder cambiar "qué puede hacer un Coordinador" (o un Supervisor)
-- para TODOS los usuarios de ese rol a la vez, desde una pantalla propia,
-- no editar usuario por usuario. Esta migración agrega esa capa nueva SIN
-- tocar ni reemplazar la anterior (el override por usuario se deja andando
-- por si hace falta más adelante, ver lib/permissions.ts).
--
-- ANTES DE APLICAR: igual que las migraciones anteriores — este entorno no
-- tiene acceso de red a la base de producción para probarlo antes de
-- entregarlo, así que revisar con calma / correr primero en un ambiente de
-- prueba si es posible.
--
-- Qué hace:
--   1) Crea public.role_permissions — una fila por rol con su grid de
--      permisos "de fábrica" editado por un admin. Ausencia de fila (o
--      permissions = {}) = se comporta exactamente como ROLE_DEFAULTS en
--      lib/permissions.ts, sin cambios, así que esta migración tampoco
--      cambia el acceso de nadie hasta que un admin guarde algo desde la
--      pestaña nueva.
--   2) RLS: SELECT abierto a cualquier autenticado (no es información
--      sensible — "qué puede hacer un Coordinador" ya se infiere del propio
--      comportamiento de la app) para que hooks/use-permissions.ts pueda
--      leerlo del lado del cliente igual que hace con users.permissions.
--      Sin políticas de INSERT/UPDATE/DELETE para roles normales — los
--      únicos escritores son app/api/role-permissions/route.ts (admin-only,
--      vía service-role, que ignora RLS).
--   3) Reemplaza auth.user_has_permission(module, action) para intercalar
--      esta capa nueva entre el default de rol y el override de usuario —
--      mismo orden que getEffectivePermissions() en lib/permissions.ts:
--      ROLE_DEFAULTS → role_permissions[rol] → users.permissions[usuario].

-- ═══════════════════════════════════════════════════════════════════════
-- 1) public.role_permissions
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role text PRIMARY KEY,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id)
);

COMMENT ON TABLE public.role_permissions IS
  'Default de permisos por módulo/acción EDITABLE por rol (admin, coordinator, supervisor), editado desde /users → pestaña "Roles y permisos". Se aplica ENCIMA de ROLE_DEFAULTS (lib/permissions.ts) y POR DEBAJO del override puntual de users.permissions. Ausencia de fila = usa ROLE_DEFAULTS sin cambios.';

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_permissions_select_authenticated" ON public.role_permissions;
CREATE POLICY "role_permissions_select_authenticated"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (true);

-- Sin políticas de escritura a propósito: INSERT/UPDATE/DELETE los hace
-- únicamente app/api/role-permissions/route.ts con el cliente de
-- service-role (admin-only, verificado con requireRole(["admin"])), que
-- ignora RLS. Un usuario autenticado normal no puede escribir esta tabla
-- ni con la anon key.

-- ═══════════════════════════════════════════════════════════════════════
-- 2) auth.user_has_permission(module, action) — agrega la capa de rol
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION auth.user_has_permission(p_module text, p_action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_user_override jsonb;
  v_role_override jsonb;
  v_value jsonb;
  v_default boolean;
BEGIN
  SELECT role, permissions INTO v_role, v_user_override
  FROM public.users
  WHERE id = auth.uid();

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- 1) Override puntual del usuario (users.permissions) — máxima prioridad.
  IF v_user_override IS NOT NULL THEN
    v_value := v_user_override #> ARRAY[p_module, p_action];
    IF v_value IS NOT NULL THEN
      RETURN v_value = 'true'::jsonb;
    END IF;
  END IF;

  -- 2) Default editable del ROL (public.role_permissions).
  SELECT permissions INTO v_role_override
  FROM public.role_permissions
  WHERE role = v_role;

  IF v_role_override IS NOT NULL THEN
    v_value := v_role_override #> ARRAY[p_module, p_action];
    IF v_value IS NOT NULL THEN
      RETURN v_value = 'true'::jsonb;
    END IF;
  END IF;

  -- 3) Default hardcodeado (mismo grid que ROLE_DEFAULTS en lib/permissions.ts).
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
