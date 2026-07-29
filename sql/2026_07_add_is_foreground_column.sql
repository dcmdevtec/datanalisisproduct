-- Fix: POST /api/location fallaba con:
--   "Could not find the 'is_foreground' column of 'surveyor_locations' in the schema cache"
--
-- Causa: app/api/location/route.ts y app/api/tracking/route.ts ya usan la
-- columna `is_foreground` (indicador de primer plano/segundo plano del APK,
-- ver isInApp() en app/api/tracking/route.ts) pero nunca se agregó a la
-- tabla real en producción. Es 100% aditiva — no rompe nada existente.
--
-- Cómo aplicar: correr esto en el SQL Editor de Supabase (o psql) contra la
-- base de datos de producción. Seguro de re-ejecutar (usa IF NOT EXISTS).

ALTER TABLE public.surveyor_locations
  ADD COLUMN IF NOT EXISTS is_foreground boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.surveyor_locations.is_foreground IS
  'true = la app estaba en primer plano (usuario activo en ella) cuando se registró esta ubicación; '
  'false = en segundo plano o el APK no lo reporta. Usado por isInApp() en app/api/tracking/route.ts '
  'para el indicador "en la app" del mapa de rastreo.';

-- IMPORTANTE: si el mapa de rastreo (app/surveyors/page.tsx) lee de una vista
-- llamada `surveyor_tracking_view` (no encontramos su definición en este
-- repo — parece haberse creado directo en Supabase, fuera de control de
-- versiones) y esa vista lista columnas explícitas en vez de usar `SELECT *`,
-- también hay que agregar `is_foreground` a esa vista con
-- `CREATE OR REPLACE VIEW surveyor_tracking_view AS SELECT ..., is_foreground, ...`
-- Si el indicador "en la app" del mapa sigue sin reflejar el estado real
-- después de correr esta migración, es la señal de que falta ese paso —
-- comparte la definición actual de la vista (`\d+ surveyor_tracking_view`
-- en psql, o el SQL Editor de Supabase) y la actualizamos.
