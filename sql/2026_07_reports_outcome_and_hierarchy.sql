-- =====================================================================
-- Migración aditiva · Módulo de Reportes (Web)
-- Fecha: 2026-07-27
-- Origen: "AJUSTES APLICACIÓN APP - 16072026.pptx", slides 19-24
--
-- Contexto:
--   El módulo de Reportes necesita clasificar cada respuesta como
--   Efectiva / Incidencia / Abandonada, y necesita una jerarquía
--   Encuestador -> Supervisor -> Coordinador para los filtros y
--   tablas de rendimiento pedidos en el pptx.
--
--   Hoy esas dos cosas NO EXISTEN en el schema:
--     - responses.status solo distingue 'completed' / otros valores
--       (no hay concepto de incidencia ni abandono explícito)
--     - surveyors no tiene relación con supervisor
--     - users.role no admite 'coordinator'
--
--   Esta migración es 100% ADITIVA: agrega columnas NULLABLES y
--   amplía un CHECK constraint. No borra ni renombra nada, no rompe
--   ninguna query ni vista existente, y el código ya desplegado
--   sigue funcionando exactamente igual si estas columnas quedan
--   vacías.
--
--   IMPORTANTE: esta migración por sí sola NO llena los datos.
--   Para que "Incidencias" y "Abandonadas" muestren números reales,
--   la app (APK) debe empezar a escribir responses.outcome cuando
--   el usuario reporta una incidencia (pantalla previa a la encuesta,
--   slide 3 del pptx) o abandona la encuesta (slide 4). Eso es
--   trabajo de la APP, fuera del alcance de este cambio web.
--
--   Mientras tanto, la API de reportes usa un fallback:
--   outcome IS NULL AND status = 'completed'  -> se muestra como 'efectiva'
--   outcome IS NULL AND status != 'completed' -> se muestra como 'abandonada'
--   (nunca infiere 'incidencia' por proxy, porque no hay forma segura
--   de derivarla de los datos actuales)
--
-- Cómo aplicar: correr este archivo completo contra la base de
-- Supabase del proyecto (SQL Editor o `psql`). Es seguro re-ejecutarlo
-- (usa IF NOT EXISTS / DO blocks) si algo queda a mitad de camino.
-- =====================================================================

-- 1. Clasificación de resultado de la respuesta -------------------------
ALTER TABLE public.responses
  ADD COLUMN IF NOT EXISTS outcome text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'responses_outcome_check'
  ) THEN
    ALTER TABLE public.responses
      ADD CONSTRAINT responses_outcome_check
      CHECK (outcome IS NULL OR outcome = ANY (ARRAY['efectiva'::text, 'incidencia'::text, 'abandonada'::text]));
  END IF;
END $$;

COMMENT ON COLUMN public.responses.outcome IS
  'Clasificación de la respuesta según pptx slides 2-4: efectiva | incidencia | abandonada. '
  'NULL = dato no reportado aún por la APK (usar fallback por status en la API).';

-- 2. Detalle de incidencia (motivo, según lista del slide 3) -------------
ALTER TABLE public.responses
  ADD COLUMN IF NOT EXISTS incidence_type text NULL;

COMMENT ON COLUMN public.responses.incidence_type IS
  'Motivo de incidencia cuando outcome = ''incidencia''. Valores esperados (slide 3): '
  'vivienda_cerrada | vivienda_desocupada | senales_ocupacion_sin_atender | rechazo | '
  'menor_sin_adulto | negocio_local | propiedad_horizontal_sin_acceso | idioma_discapacidad | '
  'no_cumple_cuota | otro. Texto libre permitido para "otro".';

-- 3. Jerarquía Encuestador -> Supervisor ---------------------------------
ALTER TABLE public.surveyors
  ADD COLUMN IF NOT EXISTS supervisor_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'surveyors_supervisor_id_fkey'
  ) THEN
    ALTER TABLE public.surveyors
      ADD CONSTRAINT surveyors_supervisor_id_fkey
      FOREIGN KEY (supervisor_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.surveyors.supervisor_id IS
  'Supervisor asignado a este encuestador (users.role = ''supervisor''). NULL = sin asignar aún.';

-- 4. Rol Coordinador ------------------------------------------------------
-- Amplía el CHECK existente de users.role para admitir 'coordinator'
-- sin tocar los valores ya usados (admin, supervisor, surveyor, client).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE public.users DROP CONSTRAINT users_role_check;
  END IF;
  ALTER TABLE public.users
    ADD CONSTRAINT users_role_check
    CHECK (role = ANY (ARRAY['admin'::text, 'supervisor'::text, 'coordinator'::text, 'surveyor'::text, 'client'::text]));
END $$;

-- Coordinador -> Supervisor (opcional, para jerarquía completa) ----------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS coordinator_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_coordinator_id_fkey'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_coordinator_id_fkey
      FOREIGN KEY (coordinator_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.users.coordinator_id IS
  'Coordinador asignado a este usuario (users.role = ''coordinator''). Usado para filtros de reportes (slide 19).';

-- 5. Índices para los nuevos filtros de reportes -------------------------
CREATE INDEX IF NOT EXISTS idx_responses_outcome ON public.responses (outcome);
CREATE INDEX IF NOT EXISTS idx_surveyors_supervisor_id ON public.surveyors (supervisor_id);
CREATE INDEX IF NOT EXISTS idx_users_coordinator_id ON public.users (coordinator_id);

-- =====================================================================
-- Fin de la migración.
--
-- Próximos pasos (fuera de este archivo):
--   1. La APK debe escribir responses.outcome y responses.incidence_type
--      al enviar cada respuesta (pantallas de slides 2-4).
--   2. Un admin debe asignar surveyors.supervisor_id y
--      users.coordinator_id desde el módulo de usuarios/encuestadores
--      (no existe UI para esto todavía — feature separado).
--   3. Hasta que 1 y 2 tengan datos reales, el módulo de Reportes web
--      sigue funcionando con el fallback descrito arriba.
-- =====================================================================
