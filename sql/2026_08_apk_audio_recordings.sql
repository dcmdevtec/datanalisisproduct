-- =====================================================================
-- Migración aditiva · Audio de encuestas tomadas desde la APK
-- Fecha: 2026-08-16
-- Origen: hoy la APK graba un audio completo por encuestado (clip
-- 'background' + clip 'survey', ver useAudioRecording.ts) pero lo sube a un
-- bucket propio ('audio-recordings') SIN crear ninguna fila en
-- `public.surveyor_recordings` — que es la tabla que lee
-- app/api/reports/individual/[id]/route.ts para "pegar" el audio al
-- encuestado en el reporte web (components/reports/individual-responses-tab.tsx,
-- detail.surveyorRecording.audioUrl). Resultado: el audio grabado en la APK
-- nunca aparece en ese reporte, aunque el grabado desde el portal web sí.
--
-- Este archivo NO cambia nada de lo que ya usa el portal web (que sigue
-- subiendo con la service-role key vía app/api/portal-encuestador/recordings,
-- eso no toca RLS). Solo añade lo que le falta a `surveyor_recordings` /
-- `response-media` para que la APK pueda escribir ahí directo con la sesión
-- del encuestador (Supabase Auth, mismo patrón que ya usa para `responses`,
-- `answers`, `public_respondents`).
--
-- 100% ADITIVO: nada se borra ni se renombra. Seguro de re-ejecutar.
-- Cómo aplicar: pegar completo en Supabase Dashboard -> SQL Editor -> Run.
-- =====================================================================

-- 1. La APK no tiene concepto de "turno" (surveyor_shifts) — cada respuesta
--    es independiente, no hay login/logout de portal detrás. shift_id era
--    NOT NULL porque solo lo usaba el portal web (turno completo). Se afloja
--    para permitir filas de la APK con shift_id = NULL; el portal web sigue
--    mandando su shift_id normalmente, sin cambio de comportamiento.
ALTER TABLE public.surveyor_recordings
  ALTER COLUMN shift_id DROP NOT NULL;

COMMENT ON COLUMN public.surveyor_recordings.shift_id IS
  'Turno del portal web (surveyor_shifts). NULL cuando la fila la creó la APK, '
  'que no tiene concepto de turno — cada respuesta es independiente.';

-- 2. RLS de `surveyor_recordings`: la tabla se creó sin RLS habilitado (ver
--    sql/2026_07_surveyor_portal.sql). El portal web nunca lo necesitó porque
--    sus API routes usan la service-role key (bypassa RLS siempre). La APK sí
--    lo necesita: escribe directo con supabase-js autenticado como el
--    encuestador. Se habilita RLS y se agregan políticas "solo mis propias
--    filas", resolviendo el encuestador de las DOS formas que ya coexisten en
--    el proyecto (ver lib/portal-encuestador/auth.ts): surveyors.user_id
--    (esquema nuevo) o surveyors.id = auth.uid() (esquema legado, el que usa
--    la APK hoy — ver src/services/sync.ts).
ALTER TABLE public.surveyor_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS surveyor_recordings_own_select ON public.surveyor_recordings;
CREATE POLICY surveyor_recordings_own_select
  ON public.surveyor_recordings FOR SELECT
  TO authenticated
  USING (
    surveyor_id IN (
      SELECT id FROM public.surveyors WHERE user_id = auth.uid() OR id = auth.uid()
    )
  );

DROP POLICY IF EXISTS surveyor_recordings_own_insert ON public.surveyor_recordings;
CREATE POLICY surveyor_recordings_own_insert
  ON public.surveyor_recordings FOR INSERT
  TO authenticated
  WITH CHECK (
    surveyor_id IN (
      SELECT id FROM public.surveyors WHERE user_id = auth.uid() OR id = auth.uid()
    )
  );

DROP POLICY IF EXISTS surveyor_recordings_own_update ON public.surveyor_recordings;
CREATE POLICY surveyor_recordings_own_update
  ON public.surveyor_recordings FOR UPDATE
  TO authenticated
  USING (
    surveyor_id IN (
      SELECT id FROM public.surveyors WHERE user_id = auth.uid() OR id = auth.uid()
    )
  )
  WITH CHECK (
    surveyor_id IN (
      SELECT id FROM public.surveyors WHERE user_id = auth.uid() OR id = auth.uid()
    )
  );

-- El backend admin (service role) sigue teniendo acceso total siempre —
-- RLS no aplica a esa key, así que el portal web (app/api/portal-encuestador/
-- recordings/*, app/api/reports/individual/[id], app/api/surveys/[id]/
-- recordings/*) no necesita ninguna política adicional para seguir
-- funcionando exactamente igual que hoy.

-- 3. Bucket 'response-media': permitía imagen/video/algunos audios de
--    navegador (ver sql/2026_07_fix_response_media_mime_types.sql) pero NO
--    'audio/amr' — el formato que graba la APK (react-native-sound-recorder,
--    AMR-NB nativo de Android). Sin esto, Storage rechaza el archivo con
--    "mime type audio/amr is not supported" antes de llegar a RLS.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav',
  'audio/amr', 'audio/3gpp',
  'video/webm', 'video/mp4'
]::text[]
WHERE id = 'response-media'
  AND NOT ('audio/amr' = ANY(allowed_mime_types));

-- 4. Política RLS de storage.objects para INSERT en 'response-media' (ver
--    scripts/storage/storage_policies.sql, policy "response_media"): la
--    whitelist de extensiones solo tenía imagen/video ('jpg','jpeg','png',
--    'gif','webp','mp4','mov','avi'), nunca se agregó audio ahí tampoco. Se
--    reemplaza por una que también acepta las extensiones de audio ya
--    permitidas por el bucket (mismo criterio, solo se le suma audio).
DROP POLICY IF EXISTS "response_media" ON storage.objects;
CREATE POLICY "response_media"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'response-media'
    AND storage.extension(name) IN (
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi',
      'webm', 'ogg', 'm4a', 'mp3', 'wav', 'amr', '3gp'
    )
);

-- Verificación:
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'surveyor_recordings' AND column_name = 'shift_id';

SELECT id, allowed_mime_types FROM storage.buckets WHERE id = 'response-media';

SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'surveyor_recordings';
-- =====================================================================
