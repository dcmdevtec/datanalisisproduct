-- =====================================================================
-- Migración aditiva · Portal web de encuestadores
-- Fecha: 2026-07-27
-- Origen: pedido de dashboard de encuestador similar a la APK, con
-- encuestas restringidas por zona y grabación de audio continua.
--
-- Contexto importante:
--   Hoy `public.surveyors` es solo una tabla de contacto (nombre, email,
--   teléfono) SIN ningún vínculo con el sistema de login (`public.users`
--   + Supabase Auth). No existe ningún encuestador que pueda iniciar
--   sesión en la web hoy. Esta migración crea ese vínculo y las tablas
--   necesarias para el turno de grabación.
--
--   100% ADITIVO: columnas y tablas nuevas, nada se borra ni se
--   renombra. El resto de la aplicación sigue funcionando igual.
--
-- Cómo aplicar: correr completo contra Supabase (SQL Editor o psql).
-- Seguro de re-ejecutar (usa IF NOT EXISTS / DO blocks).
-- =====================================================================

-- 1. Vínculo encuestador -> cuenta de login ------------------------------
ALTER TABLE public.surveyors
  ADD COLUMN IF NOT EXISTS user_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'surveyors_user_id_fkey'
  ) THEN
    ALTER TABLE public.surveyors
      ADD CONSTRAINT surveyors_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.surveyors.user_id IS
  'Cuenta de login (public.users, con role=''surveyor'') asociada a este encuestador. '
  'NULL = el encuestador todavía no tiene acceso al portal web. Un admin debe crear el '
  'usuario (role=surveyor) y vincularlo aquí para habilitar el login.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_surveyors_user_id_unique
  ON public.surveyors (user_id) WHERE user_id IS NOT NULL;

-- 2. Turnos de trabajo (pptx: "grabar todo el turno del encuestador") ---
CREATE TABLE IF NOT EXISTS public.surveyor_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surveyor_id uuid NOT NULL REFERENCES public.surveyors(id) ON DELETE CASCADE,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT surveyor_shifts_status_check CHECK (status = ANY (ARRAY['active'::text, 'ended'::text]))
);

COMMENT ON TABLE public.surveyor_shifts IS
  'Un turno = desde que el encuestador inicia sesión en el portal hasta que cierra sesión '
  'o el turno se corta por inactividad. Ancla temporal para reconstruir el audio completo del turno.';

CREATE INDEX IF NOT EXISTS idx_surveyor_shifts_surveyor_id ON public.surveyor_shifts (surveyor_id);
CREATE INDEX IF NOT EXISTS idx_surveyor_shifts_status ON public.surveyor_shifts (status);

-- 3. Segmentos de grabación (doble granularidad: turno completo + por encuesta)
-- Cada fila es un pedazo continuo de audio. scope='survey' + response_id
-- permite reproducir el audio de UNA encuesta específica (como cualquier
-- otro segmento en media_files). scope='shift' son los tramos grabados
-- entre encuestas (traslados, tiempos muertos) que solo tienen sentido
-- dentro del turno completo. Concatenando todos los segmentos de un
-- shift_id en orden de started_at se reconstruye el audio del turno.
CREATE TABLE IF NOT EXISTS public.surveyor_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.surveyor_shifts(id) ON DELETE CASCADE,
  surveyor_id uuid NOT NULL REFERENCES public.surveyors(id) ON DELETE CASCADE,
  response_id uuid NULL REFERENCES public.responses(id) ON DELETE SET NULL,
  scope text NOT NULL DEFAULT 'shift',
  started_at timestamp with time zone NOT NULL,
  ended_at timestamp with time zone NULL,
  storage_path text NULL,
  remote_url text NULL,
  duration_secs integer NULL,
  upload_status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT surveyor_recordings_scope_check CHECK (scope = ANY (ARRAY['shift'::text, 'survey'::text])),
  CONSTRAINT surveyor_recordings_upload_status_check CHECK (upload_status = ANY (ARRAY['pending'::text, 'uploaded'::text, 'failed'::text]))
);

COMMENT ON COLUMN public.surveyor_recordings.scope IS
  '''survey'' = segmento grabado durante una encuesta específica (response_id obligatorio en ese caso). '
  '''shift'' = segmento de fondo entre encuestas, solo pertenece al turno.';

CREATE INDEX IF NOT EXISTS idx_surveyor_recordings_shift_id ON public.surveyor_recordings (shift_id);
CREATE INDEX IF NOT EXISTS idx_surveyor_recordings_response_id ON public.surveyor_recordings (response_id);
CREATE INDEX IF NOT EXISTS idx_surveyor_recordings_surveyor_id ON public.surveyor_recordings (surveyor_id);

-- =====================================================================
-- Próximos pasos manuales (fuera de este archivo):
--   1. Para cada encuestador que deba tener acceso al portal, un admin
--      crea una cuenta en public.users con role='surveyor' (o 'admin'
--      la crea vía el flujo de registro existente) y luego actualiza:
--        UPDATE public.surveyors SET user_id = '<uuid del user>'
--        WHERE id = '<uuid del surveyor>';
--   2. El bucket de Storage 'response-media' (privado) ya existe en este
--      proyecto — se reutiliza para subir los audios de shift y survey.
--   3. Verificar políticas RLS del bucket 'response-media' para permitir
--      INSERT a usuarios autenticados con role='surveyor' sobre sus
--      propios archivos (path prefijado por surveyor_id).
-- =====================================================================
