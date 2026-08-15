-- =====================================================================
-- Fix · Buckets response-media / survey-images rechazan audio/video
-- Fecha: 2026-07-28 (actualizado: también corrige file_size_limit)
--
-- CAUSA RAÍZ del error "mime type audio/webm is not supported" al subir
-- las grabaciones del portal de encuestador (PATCH .../recordings/[id] 500):
--
--   El bucket 'response-media' se creó con allowedMimeTypes restringido a
--   SOLO imágenes (image/jpeg, image/png, image/gif, image/webp) — ver
--   lib/supabase-storage.ts, función initializeBuckets(). Ese código ya se
--   corrigió para que, si el bucket se vuelve a crear desde cero, incluya
--   audio/video — pero el bucket YA EXISTE en producción, así que ese fix
--   de código no tiene efecto: hay que corregir el bucket existente.
--
--   Esto probablemente afectó TAMBIÉN a las respuestas de encuestas con
--   preguntas tipo "audio" (no solo a las grabaciones nuevas del portal) si
--   alguna vez se intentó grabar audio de una pregunta y subirlo a este
--   bucket — vale la pena confirmar con el equipo si eso se había reportado
--   como "no se guarda el audio" en algún otro punto de la app.
--
-- Cómo aplicar: correr esto en el SQL Editor de Supabase. Es seguro
-- re-ejecutarlo.
-- =====================================================================

-- file_size_limit también se corrige acá: el bucket ya existía con un límite
-- bajo (probablemente el default de creación, unos pocos MB) — un video de
-- apenas 45 segundos ya lo superaba con el error "The object exceeded the
-- maximum allowed size". Se sube a 100MB para dar margen a videos/audios de
-- turno completo.
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav',
    'video/webm', 'video/mp4'
  ]::text[],
  file_size_limit = 104857600 -- 100 MB
WHERE id = 'response-media';

-- Mismo problema en survey-images: ahora también se sube ahí el video/imagen
-- que se adjunta a una pregunta (ver components/question-editor.tsx, control
-- "Adjuntar imagen o video"). El bucket ya existe y solo permitía imágenes,
-- con un límite de tamaño bajo.
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/webm', 'video/mp4', 'video/quicktime'
  ]::text[],
  file_size_limit = 104857600 -- 100 MB
WHERE id = 'survey-images';

-- Verificación: debe mostrar el array de arriba en allowed_mime_types para
-- cada bucket.
SELECT id, public, allowed_mime_types, file_size_limit
FROM storage.buckets
WHERE id IN ('response-media', 'survey-images');

-- =====================================================================
-- Alternativa sin SQL (si el SQL Editor no tiene permiso sobre el schema
-- storage, que a veces está restringido incluso para el rol de owner):
--
--   1. Supabase Studio -> Storage -> bucket "response-media"
--   2. Menú de tres puntos (⋮) junto al nombre del bucket -> "Edit bucket"
--   3. En "Allowed MIME types": agregar audio/webm, audio/ogg, audio/mp4,
--      audio/mpeg, audio/wav, video/webm, video/mp4 (o dejar el campo
--      completamente vacío para no restringir ningún tipo — más simple y
--      evita este mismo problema si en el futuro se graba en otro formato).
--   4. En "File size limit": subirlo (ej. 100 MB).
--   5. Guardar.
--
-- Si después de correr esto el error de tamaño persiste: Supabase también
-- tiene un límite GLOBAL de subida a nivel de proyecto (Dashboard ->
-- Settings -> Storage -> "Upload file size limit"), separado del límite por
-- bucket. Si el límite del proyecto es menor que el del bucket, gana el más
-- chico — hay que revisarlo ahí también.
-- =====================================================================
