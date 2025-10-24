-- Ensure required extensions and helper functions exist
-- Create extension for UUID generation if not present (try pgcrypto and uuid-ossp fallback)
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- Function to update the updated_at timestamp on row updates
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Prevent accidental ID changes (no-op guard used by some tables)
create or replace function public.prevent_questions_id_change()
returns trigger language plpgsql as $$
begin
  if (old.id is distinct from new.id) then
    raise exception 'ID change not allowed';
  end if;
  return new;
end;
$$;

-- Prevent ID change for survey_sections
create or replace function public.prevent_survey_sections_id_change()
returns trigger language plpgsql as $$
begin
  if (old.id is distinct from new.id) then
    raise exception 'ID change not allowed on survey_sections';
  end if;
  return new;
end;
$$;

create table public.questions (
  id uuid not null default extensions.uuid_generate_v4 (),
  survey_id uuid not null,
  type text not null,
  text text not null,
  options jsonb null default '[]'::jsonb,
  required boolean not null default false,
  order_num integer not null,
  settings jsonb null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  parent_id uuid null,
  file_url text null,
  matrix jsonb null default '[]'::jsonb,
  comment_box boolean not null default false,
  rating integer null,
  style jsonb null default '{}'::jsonb,
  matrix_rows text[] null,
  matrix_cols text[] null,
  display_logic jsonb null,
  skip_logic jsonb null,
  validation_rules jsonb null,
  question_config jsonb null,
  rating_scale integer null default 5,
  section_id uuid null,
  text_html text null,
  constraint questions_pkey primary key (id),
  constraint questions_section_id_fkey foreign KEY (section_id) references survey_sections (id),
  constraint questions_survey_id_fkey foreign KEY (survey_id) references surveys (id) on delete CASCADE,
  constraint questions_type_check check (
    (
      type = any (
        array[
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
          'multiple_textboxes'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_questions_survey_id on public.questions using btree (survey_id) TABLESPACE pg_default;

create index IF not exists idx_questions_display_logic on public.questions using gin (display_logic) TABLESPACE pg_default;

create index IF not exists idx_questions_skip_logic on public.questions using gin (skip_logic) TABLESPACE pg_default;

create index IF not exists idx_questions_config on public.questions using gin (question_config) TABLESPACE pg_default;

create index IF not exists idx_questions_section_id on public.questions using btree (section_id) TABLESPACE pg_default;

create trigger prevent_questions_id_change BEFORE
update on questions for EACH row
execute FUNCTION prevent_questions_id_change ();

create trigger update_questions_updated_at BEFORE
update on questions for EACH row
execute FUNCTION update_updated_at_column ();


--------------------------------------------------
create table public.survey_sections (
  id uuid not null default gen_random_uuid (),
  survey_id uuid not null,
  title text not null,
  description text null,
  order_num integer not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  skip_logic jsonb null,
  title_html text null,
  constraint survey_sections_pkey primary key (id),
  constraint survey_sections_survey_id_fkey foreign KEY (survey_id) references surveys (id) on delete CASCADE,
  constraint check_id_not_changed check ((id = id))
) TABLESPACE pg_default;

create index IF not exists idx_survey_sections_skip_logic on public.survey_sections using gin (skip_logic) TABLESPACE pg_default
where
  (skip_logic is not null);

create unique INDEX IF not exists idx_survey_sections_id_unique on public.survey_sections using btree (id) TABLESPACE pg_default;

create trigger prevent_survey_sections_id_change BEFORE
update on survey_sections for EACH row
execute FUNCTION prevent_survey_sections_id_change ();

create trigger update_survey_sections_updated_at BEFORE
update on survey_sections for EACH row
execute FUNCTION update_updated_at_column ();

--------------------------------------------------
create table public.survey_surveyor_zones (
  survey_id uuid not null,
  surveyor_id uuid not null,
  zone_id uuid not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint survey_surveyor_zones_pkey primary key (survey_id, surveyor_id, zone_id),
  constraint survey_surveyor_zones_survey_id_fkey foreign KEY (survey_id) references surveys (id) on delete CASCADE,
  constraint survey_surveyor_zones_surveyor_id_fkey foreign KEY (surveyor_id) references surveyors (id) on delete CASCADE,
  constraint survey_surveyor_zones_zone_id_fkey foreign KEY (zone_id) references zones (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_survey_surveyor_zones_survey_id on public.survey_surveyor_zones using btree (survey_id) TABLESPACE pg_default;

create index IF not exists idx_survey_surveyor_zones_surveyor_id on public.survey_surveyor_zones using btree (surveyor_id) TABLESPACE pg_default;

create index IF not exists idx_survey_surveyor_zones_zone_id on public.survey_surveyor_zones using btree (zone_id) TABLESPACE pg_default;

create trigger update_survey_surveyor_zones_updated_at BEFORE
update on survey_surveyor_zones for EACH row
execute FUNCTION update_updated_at_column ();

--------------------------------------------------
create table public.surveys (
  id uuid not null default extensions.uuid_generate_v4 (),
  title text not null,
  description text null,
  status text not null default 'draft'::text,
  deadline timestamp with time zone null,
  settings jsonb null default '{"allowAudio": false, "offlineMode": true, "collectLocation": true, "distributionMethods": ["app"]}'::jsonb,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  project_id uuid null,
  logo text null,
  theme_config jsonb null,
  security_config jsonb null,
  notification_config jsonb null,
  branding_config jsonb null,
  assigned_surveyors uuid[] null,
  start_date timestamp with time zone null,
  assigned_zones uuid[] null,
  constraint surveys_pkey primary key (id),
  constraint surveys_created_by_fkey foreign KEY (created_by) references users (id),
  constraint surveys_project_id_fkey foreign KEY (project_id) references projects (id),
  constraint surveys_status_check check (
    (
      status = any (
        array[
          'draft'::text,
          'active'::text,
          'completed'::text,
          'archived'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_surveys_status on public.surveys using btree (status) TABLESPACE pg_default;

create index IF not exists surveys_assigned_surveyors_idx on public.surveys using gin (assigned_surveyors) TABLESPACE pg_default;

create index IF not exists surveys_assigned_zones_idx on public.surveys using gin (assigned_zones) TABLESPACE pg_default;

create trigger update_surveys_updated_at BEFORE
update on surveys for EACH row
execute FUNCTION update_updated_at_column ();

-- ==================================================
-- Nueva tabla: question_options (opciones normalizadas)
-- Soporta almacenamiento de imagenes en Base64 (campo image_base64)
-- ==================================================
create table if not exists public.question_options (
  id uuid not null default gen_random_uuid(),
  question_id uuid not null,
  value text null,
  label text not null,
  image_url text null,
  image_base64 text null,
  order_num integer not null default 0,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint question_options_pkey primary key (id),
  constraint question_options_question_id_fkey foreign key (question_id) references public.questions (id) on delete cascade
) TABLESPACE pg_default;

create index if not exists idx_question_options_question_id on public.question_options using btree (question_id) TABLESPACE pg_default;
create index if not exists idx_question_options_image_url on public.question_options using btree (image_url) TABLESPACE pg_default;
create index if not exists idx_question_options_metadata_gin on public.question_options using gin (metadata) TABLESPACE pg_default;

create trigger update_question_options_updated_at BEFORE
update on public.question_options for EACH row
execute FUNCTION update_updated_at_column ();

-- =====================================================================
-- Nota de migración (EJEMPLO - ejecutar en staging primero):
-- 1) Migrar las opciones almacenadas en questions.options (jsonb) a filas
-- 2) image_url se poblra si existía; image_base64 quedará NULL hasta que
--    un script descargue la imagen y guarde su Base64 en image_base64.
-- =====================================================================

/*
do $$
declare
  rec record;
  opt jsonb;
  idx int;
  opt_value text;
  opt_label text;
  opt_image text;
begin
  for rec in select id, options from public.questions loop
    if rec.options is null then
      continue;
    end if;
    idx := 0;
    for opt in select * from jsonb_array_elements(rec.options) loop
      idx := idx + 1;
      if jsonb_typeof(opt) = 'string' then
        opt_value := opt #>> '{}';
        opt_label := opt_value;
        opt_image := null;
      else
        opt_value := (opt->>'value')::text;
        opt_label := coalesce(opt->>'label', opt->>'value', '')::text;
        opt_image := opt->>'image';
      end if;

      insert into public.question_options(question_id, value, label, image_url, order_num, metadata)
      values (rec.id, opt_value, opt_label, opt_image, idx, opt)
      on conflict do nothing;
    end loop;
  end loop;
end $$;
*/

-- =====================================================================
-- Script externo sugerido: descargar imágenes desde image_url y guardar
-- su Base64 en image_base64 usando la API/Postgres. No realizar desde SQL
-- puro si las imágenes están en servidores externos (usar node/python).
-- =====================================================================
