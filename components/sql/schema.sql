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