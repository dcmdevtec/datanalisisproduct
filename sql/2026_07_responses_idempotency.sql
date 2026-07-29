-- Idempotencia en el envío de respuestas (auditoría de producción 2026-07-29).
--
-- Problema: el botón "Finalizar Encuesta" (app/preview/survey/page.tsx) no
-- tenía guardia de reentrada ni deshabilitaba el botón mientras se enviaba.
-- Un doble tap (muy común en campo, con conexión lenta) o un reintento tras
-- un error de red podían crear DOS filas en public.responses para el mismo
-- envío del encuestado, inflando los conteos de "efectivas" en Reportes.
--
-- Solución: el cliente ahora genera una llave de idempotencia estable
-- (client_submission_id, un UUID) por sesión de llenado del formulario y la
-- reenvía en cada intento. POST /api/responses busca primero si ya existe
-- una respuesta con esa misma llave para la misma encuesta; si existe, la
-- devuelve tal cual en vez de insertar un duplicado.
--
-- Esta migración es aditiva y segura de correr en producción sin downtime:
-- agrega una columna nullable y un índice único parcial (solo aplica cuando
-- la columna no es null, así que no afecta ninguna fila histórica).

alter table public.responses
  add column if not exists client_submission_id text null;

comment on column public.responses.client_submission_id is
  'Llave de idempotencia generada por el cliente (crypto.randomUUID) para evitar respuestas duplicadas por doble envío o reintento de red. Nullable: las respuestas creadas antes de esta migración, o por integraciones que aún no la envíen, quedan sin valor y siguen funcionando igual que antes.';

-- Único parcial: dos respuestas de la MISMA encuesta no pueden compartir la
-- misma client_submission_id. No se incluye survey_id como columna aparte
-- porque el token ya es efectivamente único por sesión de llenado, pero se
-- deja el índice compuesto por si en el futuro se reutiliza el mismo token
-- entre pestañas/encuestas (defensivo, sin costo adicional real).
create unique index if not exists responses_client_submission_id_unique
  on public.responses (survey_id, client_submission_id)
  where client_submission_id is not null;
