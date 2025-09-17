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