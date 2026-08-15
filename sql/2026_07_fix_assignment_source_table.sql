-- ============================================================
-- Corrección crítica: responses.assignment_id apuntaba a la
-- tabla equivocada.
-- Ejecutar en: Supabase SQL Editor, DESPUÉS de
-- 2026_07_surveyor_portal.sql y su backfill.
-- ============================================================
--
-- DIAGNÓSTICO:
-- La UI de administración (crear/editar encuesta -> asignar
-- encuestadores por zona) SIEMPRE ha guardado esas asignaciones en
-- public.survey_surveyor_zones (ver app/projects/[id]/create-survey/page.tsx,
-- líneas ~1849-1897). La tabla public.assignments también existe en el
-- esquema, tiene columnas parecidas (survey_id, surveyor_id, zone_id,
-- status), y responses.assignment_id tiene su FK apuntando ahí — pero
-- NINGÚN flujo del producto (ni la app web ni, hasta donde este código
-- muestra, la APK) inserta filas en `assignments`. Es una tabla legacy
-- que quedó huérfana de escritura.
--
-- Efecto: todo el código que se apoyaba en `assignments` para saber qué
-- encuestas tiene asignadas un encuestador (el portal /portal-encuestador
-- construido en julio 2026, y el módulo de Reportes) consulta una tabla
-- que siempre está vacía, aunque el admin sí haya asignado correctamente
-- encuestadores a zonas desde la pantalla de creación de encuestas.
--
-- POR QUÉ ES SEGURO CAMBIAR EL FK AHORA:
-- La columna responses.assignment_id recién se empezó a poblar en este
-- ciclo de desarrollo (portal de encuestador, julio 2026), que todavía no
-- se ha usado en campo — por lo tanto no debería existir ningún response
-- real con assignment_id distinto de NULL. El ALTER de abajo fallará
-- fuerte (en vez de corromper datos en silencio) si esa suposición
-- resultara falsa, porque Postgres exige que todo assignment_id existente
-- sea un id válido de la nueva tabla referenciada.

ALTER TABLE public.responses
  DROP CONSTRAINT IF EXISTS responses_assignment_id_fkey;

ALTER TABLE public.responses
  ADD CONSTRAINT responses_assignment_id_fkey
  FOREIGN KEY (assignment_id)
  REFERENCES public.survey_surveyor_zones(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.responses.assignment_id IS
  'Referencia a survey_surveyor_zones.id (encuestador+zona asignados a esta '
  'encuesta) — NO a la tabla legacy `assignments`, que nadie escribe. '
  'NULL = respuesta no vinculada a una asignación (ej. encuesta pública, o '
  'enviada antes de este cambio).';

-- No se toca la tabla `assignments` en sí — queda tal cual, sin usarse.
-- Si en el futuro se decide reutilizarla o eliminarla, requiere revisión
-- aparte (app/api/dashboard/route.ts todavía la lee para un widget de
-- "tasa de completitud por zona" que hoy siempre muestra vacío).
