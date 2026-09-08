-- Ítem pedido 08/09/2026: "un identificador único de la encuesta que nos va
-- a servir para muchas cosas adelante". Decisiones confirmadas con el
-- cliente:
--   - Formato: secuencial legible por año, ej. ENC-2026-0001.
--   - Lo genera el sistema (no se escribe a mano por defecto).
--   - Mientras la encuesta está en estado "draft" (Prueba), el usuario SÍ
--     puede editarlo manualmente desde el tab Detalles del builder.
--   - En cuanto la encuesta deja de estar en "draft" (se activa), el código
--     queda bloqueado para siempre: único en todo el sistema, no se puede
--     volver a cambiar por ningún camino (autosave, API, futuro código).
--
-- Se implementa todo con triggers en la propia base de datos (no solo en el
-- código de la app) para que la regla se cumpla sin importar qué camino
-- toque la fila — este proyecto tiene varios: inserts directos desde el
-- browser (Supabase client), rutas /api/surveys/*, etc.

-- 1) Contador atómico por año — un INSERT ... ON CONFLICT DO UPDATE es una
--    sola sentencia, así que dos creaciones simultáneas no pueden pisarse
--    (a diferencia de "contar filas existentes + 1" desde la aplicación).
CREATE TABLE IF NOT EXISTS public.survey_code_counters (
  year integer PRIMARY KEY,
  last_value integer NOT NULL DEFAULT 0
);

-- 2) Función que entrega el siguiente código formateado, ej. 'ENC-2026-0001'.
CREATE OR REPLACE FUNCTION public.next_survey_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  yr integer := extract(year from now())::integer;
  next_val integer;
BEGIN
  INSERT INTO public.survey_code_counters (year, last_value)
  VALUES (yr, 1)
  ON CONFLICT (year) DO UPDATE SET last_value = public.survey_code_counters.last_value + 1
  RETURNING last_value INTO next_val;

  RETURN 'ENC-' || yr || '-' || lpad(next_val::text, 4, '0');
END;
$$;

-- 3) Columna + índice único (parcial: solo aplica a filas que ya tengan
--    código — evita romper filas viejas sin código todavía sin backfill).
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS code text;

CREATE UNIQUE INDEX IF NOT EXISTS surveys_code_unique_idx
  ON public.surveys (code)
  WHERE code IS NOT NULL;

-- 4) Trigger de creación: toda encuesta nueva sin código explícito recibe
--    uno automáticamente. No se dispara si algún código legado ya trae uno
--    (backfill manual, importación, etc.) — respeta el que ya venga.
CREATE OR REPLACE FUNCTION public.assign_survey_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := public.next_survey_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_survey_code ON public.surveys;
CREATE TRIGGER trg_assign_survey_code
  BEFORE INSERT ON public.surveys
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_survey_code();

-- 5) Trigger de bloqueo: una vez la encuesta YA tenía código Y YA estaba
--    fuera de "draft" (es decir, esto no es la primera transición
--    draft->active, sino una actualización posterior), cualquier intento de
--    cambiar el código se ignora en silencio — se revierte al valor que ya
--    estaba guardado, en vez de fallar con un error (evita romper updates
--    del resto de la app que no tocan este campo a propósito).
CREATE OR REPLACE FUNCTION public.prevent_survey_code_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.code IS NOT NULL
     AND OLD.status IS DISTINCT FROM 'draft'
     AND NEW.code IS DISTINCT FROM OLD.code THEN
    NEW.code := OLD.code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_survey_code_change ON public.surveys;
CREATE TRIGGER trg_prevent_survey_code_change
  BEFORE UPDATE ON public.surveys
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_survey_code_change();

-- 6) Backfill: encuestas existentes sin código. Se les asigna uno en el
--    orden en que fueron creadas, para que el correlativo tenga sentido
--    histórico. El año usado es el de created_at (no el actual), para no
--    mezclar encuestas viejas bajo el año en que se corre esta migración.
DO $$
DECLARE
  r record;
  yr integer;
  next_val integer;
BEGIN
  FOR r IN
    SELECT id, created_at FROM public.surveys WHERE code IS NULL ORDER BY created_at ASC
  LOOP
    yr := extract(year from COALESCE(r.created_at, now()))::integer;
    INSERT INTO public.survey_code_counters (year, last_value)
    VALUES (yr, 1)
    ON CONFLICT (year) DO UPDATE SET last_value = public.survey_code_counters.last_value + 1
    RETURNING last_value INTO next_val;

    UPDATE public.surveys
    SET code = 'ENC-' || yr || '-' || lpad(next_val::text, 4, '0')
    WHERE id = r.id;
  END LOOP;
END;
$$;
