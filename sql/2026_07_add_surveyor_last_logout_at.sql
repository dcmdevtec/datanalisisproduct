-- Fix: al cerrar sesión en el portal web, el encuestador seguía apareciendo
-- "Activo" en el mapa de rastreo hasta que pasaran los 5 min del umbral
-- pasivo de inactividad (no había ninguna señal explícita de "cerré sesión
-- ahora mismo").
--
-- Se agrega una columna simple para registrar el momento del cierre de
-- sesión. app/api/portal-encuestador/shifts/[id]/route.ts la actualiza al
-- cerrar el turno (mismo flujo que ya dispara el botón "Salir" del portal),
-- y app/api/tracking/route.ts (calcStatus()) la usa para forzar "offline"
-- de inmediato si el cierre de sesión es más reciente que la última
-- ubicación registrada. Es 100% aditivo, no toca la vista
-- surveyor_tracking_view ni ninguna tabla existente.

ALTER TABLE public.surveyors
  ADD COLUMN IF NOT EXISTS last_logout_at timestamptz NULL;

COMMENT ON COLUMN public.surveyors.last_logout_at IS
  'Momento del último cierre de sesión explícito desde el portal web (botón "Salir"). '
  'Usado por app/api/tracking/route.ts para mostrar "offline" de inmediato en el mapa '
  'de rastreo en vez de esperar el umbral pasivo de 5 minutos por falta de señal.';
