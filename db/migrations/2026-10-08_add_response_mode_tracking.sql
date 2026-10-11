-- Ítem "Cuando el estado de una encuesta la paso de PRUEBA a ACTIVA" (acta de
-- ajustes 05/10/2026): hasta ahora, al activar una encuesta (draft→active) se
-- borraban TODAS las respuestas recogidas mientras estaba en "prueba" (ver
-- app/api/surveys/[id]/route.ts). El cliente ahora pide lo contrario: no
-- borrar nada, sino dejar identificado con qué estado de la encuesta
-- (Prueba/Activa) se recogió cada respuesta, para poder filtrarlas en
-- Reportes sin perder el registro de calidad de las pruebas realizadas.

alter table public.responses
  add column if not exists response_mode text not null default 'activa';

alter table public.responses
  drop constraint if exists responses_response_mode_check;

alter table public.responses
  add constraint responses_response_mode_check
  check (response_mode = any (array['prueba'::text, 'activa'::text]));

comment on column public.responses.response_mode is
  'Estado de la encuesta (prueba/activa) en el momento en que se recibió esta respuesta. No se recalcula si la encuesta cambia de estado después.';
