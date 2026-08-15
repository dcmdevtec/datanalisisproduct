-- Migración: agregar tipos de pregunta 'location' (GPS) y 'video' al constraint de la tabla questions
-- Contexto: el constraint questions_type_check no incluía 'location', por lo que intentar
-- guardar una pregunta GPS desde la plataforma fallaba con un error de constraint violation.
-- Se elimina el constraint existente y se recrea incluyendo 'location'.
--
-- Ejecutar en Supabase SQL Editor o via `psql`.

ALTER TABLE questions
  DROP CONSTRAINT IF EXISTS questions_type_check;

ALTER TABLE questions
  ADD CONSTRAINT questions_type_check CHECK (
    type = ANY (ARRAY[
      'text'::text,
      'textarea'::text,
      'multiple_choice'::text,
      'checkbox'::text,
      'dropdown'::text,
      'scale'::text,
      'matrix'::text,
      'ranking'::text,
      'date'::text,
      'time'::text,
      'email'::text,
      'phone'::text,
      'number'::text,
      'rating'::text,
      'file'::text,
      'image_upload'::text,
      'signature'::text,
      'likert'::text,
      'net_promoter'::text,
      'slider'::text,
      'comment_box'::text,
      'star_rating'::text,
      'demographic'::text,
      'contact_info'::text,
      'single_textbox'::text,
      'multiple_textboxes'::text,
      'location'::text,
      'video'::text
    ])
  );

-- Verificar que el constraint quedó correcto
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'questions_type_check';
