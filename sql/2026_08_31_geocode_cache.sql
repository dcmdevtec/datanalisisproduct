-- Caché de reverse-geocoding (lat/lng -> ciudad/barrio) para Respuestas
-- Individuales.
--
-- Contexto (reporte 2026-08-31): "ya tenemos la ubicación donde se hace la
-- encuesta, ¿por qué no aparece el barrio o ciudad?" — la respuesta es que
-- Barrio/Ciudad NUNCA se derivaban del GPS crudo (responses.location, lo que
-- alimenta el mapa) — solo se llenaban si la encuesta tenía explícitamente
-- una pregunta tipo "Ubicación" (components/location-question.tsx, que sí
-- hace reverse geocoding vía Nominatim del lado del navegador). La inmensa
-- mayoría de encuestas no tiene esa pregunta, así que la columna quedaba en
-- "—" aunque el punto GPS sí existiera y se viera bien en el mapa.
--
-- Fix: app/api/reports/individual/route.ts ahora hace el mismo reverse
-- geocoding (mismo proveedor, Nominatim/OpenStreetMap, sin costo) como
-- FALLBACK cuando no hay pregunta de Ubicación respondida, pero solo para un
-- puñado de respuestas nuevas por página (Nominatim pide máximo ~1 req/seg,
-- así que no se puede geocodificar una lista entera sin caché). Esta tabla
-- es esa caché: agrupa por coordenada redondeada a 3 decimales (~110m), así
-- que respuestas cercanas entre sí (mismo barrio, mismo edificio) comparten
-- una sola consulta a Nominatim en vez de repetirla.
--
-- ANTES DE APLICAR: mismo criterio que las migraciones anteriores — este
-- entorno no tiene acceso a la base de producción para probarlo antes de
-- entregarlo.

CREATE TABLE IF NOT EXISTS public.geocode_cache (
  lat_round numeric(6,3) NOT NULL,
  lng_round numeric(6,3) NOT NULL,
  ciudad text NULL,
  barrio text NULL,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lat_round, lng_round)
);

COMMENT ON TABLE public.geocode_cache IS
  'Caché de reverse-geocoding Nominatim, redondeado a 3 decimales (~110m). Usada por app/api/reports/individual/route.ts como fallback de Barrio/Ciudad cuando la encuesta no tiene una pregunta tipo "Ubicación" respondida.';

-- Sin RLS: no es información sensible (nombre de ciudad/barrio por
-- coordenada redondeada) y solo la lee/escribe el cliente de service-role
-- desde el propio endpoint — nunca se expone una tabla o columna nueva a
-- una query directa del navegador.
