-- Ítem pedido 09/09/2026: "restringir el cierre de sesión del encuestador —
-- una vez iniciada la jornada, el encuestador no debería poder cerrar su
-- propia sesión. Solo el supervisor o administrador podría cerrarla
-- remotamente desde la lista de encuestadores."
--
-- Mecanismo: el admin/supervisor marca esta columna con `now()` (ver
-- POST /api/surveyors/[id]/force-logout). El portal del encuestador ya
-- manda un ping periódico a /api/location mientras el turno está activo
-- (lib/portal-encuestador/use-location-tracking.ts) — esa misma respuesta
-- ahora avisa `force_logout: true` si esta columna está seteada, y la
-- limpia en el mismo request (set-y-consume, sin necesitar un endpoint de
-- confirmación aparte). El portal, al recibir el aviso, cierra la sesión
-- localmente de inmediato.
ALTER TABLE public.surveyors
  ADD COLUMN IF NOT EXISTS force_logout_requested_at timestamptz;
