-- Endurecimiento de RLS en tablas de ubicación/zonas (auditoría de
-- producción 2026-07-29, bucket "Corto plazo": "habilitar RLS con políticas
-- por dueño en users, surveyors, zones, surveyor_locations, messages").
--
-- ANTES DE APLICAR: revisar este archivo con calma y correrlo primero en un
-- entorno de prueba si es posible. A diferencia de los demás cambios de esta
-- sesión (que son solo código de la app, verificados con `tsc --noEmit`),
-- esto toca políticas de base de datos en producción y este entorno no tiene
-- acceso de red a la base para probarlo antes de entregarlo — por eso cada
-- decisión de este archivo está documentada con el archivo/línea del código
-- real que depende de ella, para que se pueda auditar antes de correrlo.
--
-- ─────────────────────────────────────────────────────────────────────────
-- QUÉ SE REVISÓ (auditoría de las 5 tablas pedidas) Y POR QUÉ SOLO SE TOCAN 2
-- ─────────────────────────────────────────────────────────────────────────
--
-- public.users        → YA está bien: RLS habilitado, con políticas
--                        "Los usuarios pueden ver su propio perfil" (propia
--                        fila), "...administradores..." y "...supervisores
--                        pueden ver encuestadores y clientes" (admin/
--                        supervisor ven todo). No hay políticas de
--                        INSERT/UPDATE/DELETE para authenticated — correcto,
--                        todas las escrituras ya pasan por rutas API con
--                        service_role (bypasea RLS). No se toca: no hay nada
--                        que arreglar y tocar políticas de auth ya en uso es
--                        el mayor riesgo de esta tabla.
--
-- public.surveyors    → YA está razonable: RLS habilitado, SELECT abierto a
--                        cualquier `authenticated` (coincide con el uso real:
--                        el editor de encuestas y el modal de asignación
--                        cargan TODOS los encuestadores por nombre/email para
--                        armar dropdowns — app/projects/[id]/create-survey/page.tsx,
--                        components/assign-surveyors-modal.tsx,
--                        app/surveys/[id]/page.tsx). Escrituras ya
--                        restringidas a service_role. No se toca en esta
--                        pasada — se podría acotar el SELECT a admin/
--                        supervisor/dueño más adelante, pero no es la fuga
--                        real (nombre/email de encuestador es poco sensible
--                        comparado con GPS en vivo) y acotarlo sin poder
--                        probar contra la base real es más riesgo que
--                        beneficio hoy.
--
-- public.messages     → YA está cerrado: RLS habilitado y CERO políticas
--                        definidas, lo que en Postgres significa acceso
--                        denegado por defecto para todo el que no sea
--                        service_role. Coincide con lo encontrado en el
--                        código: no existe NINGÚN `.from("messages")` fuera
--                        de rutas /api/* (todas usan service_role). No se
--                        toca — ya está correctamente cerrado.
--
-- public.zones            → SIN RLS habilitado (gap real). Se corrige abajo.
-- public.surveyor_locations → RLS habilitado pero con políticas
--                        "USING (true)" / "WITH CHECK (true)" para
--                        CUALQUIER usuario autenticado — es decir, hoy
--                        cualquier cuenta logueada (incluso un encuestador)
--                        puede leer el rastro GPS completo de TODOS los
--                        encuestadores e insertar ubicaciones falsas para
--                        cualquier surveyor_id, llamando directo a Supabase
--                        sin pasar por la app. Se corrige abajo.
--
-- ─────────────────────────────────────────────────────────────────────────
-- POR QUÉ ESTAS DOS TABLAS SÍ NECESITAN RLS CORRECTO (no es solo "defensa en
-- profundidad" — dos rutas activas dependen de esto)
-- ─────────────────────────────────────────────────────────────────────────
-- A diferencia de casi toda la app (que usa el cliente service_role y por
-- lo tanto ignora RLS), estas rutas usan el cliente de sesión normal
-- (createServerClient de @supabase/ssr, con la anon key + cookies del
-- usuario logueado), así que SÍ dependen de que las políticas de RLS estén
-- bien puestas para funcionar:
--   - app/api/location/route.ts   (POST inserta, GET lee — con `surveyor_id`)
--   - app/api/tracking/route.ts   (GET lee todas las ubicaciones — mapa admin)
--   - app/api/zones/route.ts      (GET/POST/PUT/DELETE)
--   - app/projects/[id]/create-survey/page.tsx (SELECT zones/surveyors desde el navegador)
--   - app/surveys/[id]/page.tsx   (SELECT zones/surveyors desde el navegador)
-- El control de rol de estas rutas (requireRole / chequeo de ownership) ya
-- se agregó a nivel de código en esta misma sesión — este archivo es el
-- complemento a nivel de base de datos: si alguien tiene una sesión válida
-- pero llama a Supabase directo (sin pasar por la ruta API), RLS es lo único
-- que sigue protegiendo el dato.

-- ═══════════════════════════════════════════════════════════════════════
-- 1) public.zones — habilitar RLS (hoy no tiene, o sea sin esta migración
--    queda con los permisos por defecto de Postgres/Supabase, que suelen
--    ser más abiertos de lo que cualquiera esperaría para una tabla nueva).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario autenticado (mismo criterio ya usado en
-- "Allow authenticated users to view surveyors" sobre public.surveyors —
-- el nombre/geometría de una zona no es sensible, y GET /api/location
-- necesita poder mostrar el nombre de zona incluso para un encuestador
-- viendo su propia última ubicación).
CREATE POLICY "zones_select_authenticated"
  ON public.zones FOR SELECT
  TO authenticated
  USING (true);

-- Escritura: solo admin (coincide exactamente con requireRole(["admin"])
-- en POST/PUT/DELETE de app/api/zones/route.ts).
CREATE POLICY "zones_write_admin"
  ON public.zones FOR INSERT
  TO authenticated
  WITH CHECK (auth.user_has_role('admin'::text));

CREATE POLICY "zones_update_admin"
  ON public.zones FOR UPDATE
  TO authenticated
  USING (auth.user_has_role('admin'::text))
  WITH CHECK (auth.user_has_role('admin'::text));

CREATE POLICY "zones_delete_admin"
  ON public.zones FOR DELETE
  TO authenticated
  USING (auth.user_has_role('admin'::text));

-- ═══════════════════════════════════════════════════════════════════════
-- 2) public.surveyor_locations — reemplazar las políticas "USING (true)"
--    por políticas reales por dueño + admin/supervisor.
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Usuarios autenticados pueden leer ubicaciones" ON public.surveyor_locations;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar ubicaciones" ON public.surveyor_locations;

-- Lectura — admin/supervisor ven TODAS las ubicaciones (mapa de rastreo,
-- app/api/tracking/route.ts). auth.user_is_admin_or_supervisor() ya existe
-- y está en uso en public.users, así que es un patrón probado en esta
-- misma base, no uno nuevo.
CREATE POLICY "surveyor_locations_select_staff"
  ON public.surveyor_locations FOR SELECT
  TO authenticated
  USING (auth.user_is_admin_or_supervisor());

-- Lectura — un encuestador puede ver su propia ubicación (GET
-- /api/location?surveyor_id=<el suyo>, ya validado a nivel de ruta en
-- app/api/location/route.ts — esta política es el respaldo a nivel de BD).
-- Contempla tanto surveyors.user_id (vínculo correcto) como el fallback
-- legado surveyors.id = auth.uid() (cuentas creadas antes del backfill de
-- sql/2026_07_surveyor_portal_backfill.sql), igual que
-- lib/portal-encuestador/auth.ts::resolveCurrentSurveyor().
CREATE POLICY "surveyor_locations_select_own"
  ON public.surveyor_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.surveyors s
      WHERE s.id = surveyor_locations.surveyor_id
        AND (s.user_id = auth.uid() OR s.id = auth.uid())
    )
  );

-- Escritura — un encuestador solo puede insertar ubicaciones para SÍ MISMO.
-- Esto es lo que hoy falta a nivel de BD: la app ya valida esto en
-- app/api/location/route.ts (POST rechaza con 403 si surveyor_id no es el
-- propio), pero la política actual en producción es WITH CHECK(true), así
-- que cualquier cuenta logueada podía insertar ubicaciones para cualquier
-- encuestador llamando a Supabase directamente. Esta política cierra eso.
CREATE POLICY "surveyor_locations_insert_own"
  ON public.surveyor_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.surveyors s
      WHERE s.id = surveyor_locations.surveyor_id
        AND (s.user_id = auth.uid() OR s.id = auth.uid())
    )
  );

-- No se agregan políticas de UPDATE/DELETE: ninguna parte del código hace
-- update/delete de surveyor_locations con el cliente de sesión (solo se
-- inserta), así que quedan denegadas por defecto — correcto, nadie debería
-- poder alterar/borrar el historial de ubicaciones desde el navegador.

-- ═══════════════════════════════════════════════════════════════════════
-- NOTA (no incluido en esta migración, seguimiento opcional de baja
-- prioridad): public.tracking_config también tiene una política
-- "Admins pueden actualizar configuración" con USING(true) para
-- `authenticated` (cualquier usuario logueado, no solo admins, a pesar del
-- nombre de la política) — ver sql/tracking_tables.sql líneas 262-265. Es
-- una tabla de configuración (intervalo de refresco, etc.), no datos
-- personales, así que el riesgo es bajo, pero el nombre de la política es
-- engañoso respecto a lo que realmente permite. Se deja fuera de esta
-- migración para mantenerla enfocada en las dos fugas de datos personales
-- reales (ubicación GPS y zonas sin RLS).
