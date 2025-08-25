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

create trigger update_questions_updated_at BEFORE
update on questions for EACH row
execute FUNCTION update_updated_at_column ();

create table public.zones (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  description text null,
  geometry geometry null,
  status text not null default 'active'::text,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  map_snapshot text null,
  constraint zones_pkey primary key (id),
  constraint zones_created_by_fkey foreign KEY (created_by) references users (id),
  constraint zones_status_check check (
    (
      status = any (array['active'::text, 'inactive'::text])
    )
  )
) TABLESPACE pg_default;

create trigger update_zones_updated_at BEFORE
update on zones for EACH row
execute FUNCTION update_updated_at_column ();
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
create table public.spatial_ref_sys (
  srid integer not null,
  auth_name character varying(256) null,
  auth_srid integer null,
  srtext character varying(2048) null,
  proj4text character varying(2048) null,
  constraint spatial_ref_sys_pkey primary key (srid),
  constraint spatial_ref_sys_srid_check check (
    (
      (srid > 0)
      and (srid <= 998999)
    )
  )
) TABLESPACE pg_default;
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
  constraint survey_sections_survey_id_fkey foreign KEY (survey_id) references surveys (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_survey_sections_skip_logic on public.survey_sections using gin (skip_logic) TABLESPACE pg_default
where
  (skip_logic is not null);

create trigger update_survey_sections_updated_at BEFORE
update on survey_sections for EACH row
execute FUNCTION update_updated_at_column ();
create view public.geometry_columns as
select
  current_database()::character varying(256) as f_table_catalog,
  n.nspname as f_table_schema,
  c.relname as f_table_name,
  a.attname as f_geometry_column,
  COALESCE(postgis_typmod_dims (a.atttypmod), sn.ndims, 2) as coord_dimension,
  COALESCE(
    NULLIF(postgis_typmod_srid (a.atttypmod), 0),
    sr.srid,
    0
  ) as srid,
  replace(
    replace(
      COALESCE(
        NULLIF(
          upper(postgis_typmod_type (a.atttypmod)),
          'GEOMETRY'::text
        ),
        st.type,
        'GEOMETRY'::text
      ),
      'ZM'::text,
      ''::text
    ),
    'Z'::text,
    ''::text
  )::character varying(30) as type
from
  pg_class c
  join pg_attribute a on a.attrelid = c.oid
  and not a.attisdropped
  join pg_namespace n on c.relnamespace = n.oid
  join pg_type t on a.atttypid = t.oid
  left join (
    select
      s.connamespace,
      s.conrelid,
      s.conkey,
      replace(
        split_part(s.consrc, ''''::text, 2),
        ')'::text,
        ''::text
      ) as type
    from
      (
        select
          pg_constraint.connamespace,
          pg_constraint.conrelid,
          pg_constraint.conkey,
          pg_get_constraintdef(pg_constraint.oid) as consrc
        from
          pg_constraint
      ) s
    where
      s.consrc ~~* '%geometrytype(% = %'::text
  ) st on st.connamespace = n.oid
  and st.conrelid = c.oid
  and (a.attnum = any (st.conkey))
  left join (
    select
      s.connamespace,
      s.conrelid,
      s.conkey,
      replace(
        split_part(s.consrc, ' = '::text, 2),
        ')'::text,
        ''::text
      )::integer as ndims
    from
      (
        select
          pg_constraint.connamespace,
          pg_constraint.conrelid,
          pg_constraint.conkey,
          pg_get_constraintdef(pg_constraint.oid) as consrc
        from
          pg_constraint
      ) s
    where
      s.consrc ~~* '%ndims(% = %'::text
  ) sn on sn.connamespace = n.oid
  and sn.conrelid = c.oid
  and (a.attnum = any (sn.conkey))
  left join (
    select
      s.connamespace,
      s.conrelid,
      s.conkey,
      replace(
        replace(
          split_part(s.consrc, ' = '::text, 2),
          ')'::text,
          ''::text
        ),
        '('::text,
        ''::text
      )::integer as srid
    from
      (
        select
          pg_constraint.connamespace,
          pg_constraint.conrelid,
          pg_constraint.conkey,
          pg_get_constraintdef(pg_constraint.oid) as consrc
        from
          pg_constraint
      ) s
    where
      s.consrc ~~* '%srid(% = %'::text
  ) sr on sr.connamespace = n.oid
  and sr.conrelid = c.oid
  and (a.attnum = any (sr.conkey))
where
  (
    c.relkind = any (
      array[
        'r'::"char",
        'v'::"char",
        'm'::"char",
        'f'::"char",
        'p'::"char"
      ]
    )
  )
  and not c.relname = 'raster_columns'::name
  and t.typname = 'geometry'::name
  and not pg_is_other_temp_schema(c.relnamespace)
  and has_table_privilege(c.oid, 'SELECT'::text);
  create view public.geography_columns as
select
  current_database() as f_table_catalog,
  n.nspname as f_table_schema,
  c.relname as f_table_name,
  a.attname as f_geography_column,
  postgis_typmod_dims (a.atttypmod) as coord_dimension,
  postgis_typmod_srid (a.atttypmod) as srid,
  postgis_typmod_type (a.atttypmod) as type
from
  pg_class c,
  pg_attribute a,
  pg_type t,
  pg_namespace n
where
  t.typname = 'geography'::name
  and a.attisdropped = false
  and a.atttypid = t.oid
  and a.attrelid = c.oid
  and c.relnamespace = n.oid
  and (
    c.relkind = any (
      array[
        'r'::"char",
        'v'::"char",
        'm'::"char",
        'f'::"char",
        'p'::"char"
      ]
    )
  )
  and not pg_is_other_temp_schema(c.relnamespace)
  and has_table_privilege(c.oid, 'SELECT'::text); 
  create table public.surveyors (
  id uuid not null default gen_random_uuid (),
  name text not null,
  email text not null,
  phone_number text null,
  status text not null default 'active'::text,
  created_at timestamp with time zone not null default now(),
  constraint surveyors_pkey primary key (id),
  constraint surveyors_email_key unique (email)
) TABLESPACE pg_default;
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

create table public.surveyors (
  id uuid not null default gen_random_uuid (),
  name text not null,
  email text not null,
  phone_number text null,
  status text not null default 'active'::text,
  created_at timestamp with time zone not null default now(),
  constraint surveyors_pkey primary key (id),
  constraint surveyors_email_key unique (email)
) TABLESPACE pg_default;

create table public.users (
  id uuid not null,
  email text not null,
  name text not null,
  role text not null,
  status text not null default 'active'::text,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email),
  constraint users_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE,
  constraint users_role_check check (
    (
      role = any (
        array[
          'admin'::text,
          'supervisor'::text,
          'surveyor'::text,
          'client'::text
        ]
      )
    )
  ),
  constraint users_status_check check (
    (
      status = any (array['active'::text, 'inactive'::text])
    )
  )
) TABLESPACE pg_default;

create trigger update_users_updated_at BEFORE
update on users for EACH row
execute FUNCTION update_updated_at_column ();
create table public.zones (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  description text null,
  geometry geometry null,
  status text not null default 'active'::text,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  map_snapshot text null,
  constraint zones_pkey primary key (id),
  constraint zones_created_by_fkey foreign KEY (created_by) references users (id),
  constraint zones_status_check check (
    (
      status = any (array['active'::text, 'inactive'::text])
    )
  )
) TABLESPACE pg_default;

create trigger update_zones_updated_at BEFORE
update on zones for EACH row
execute FUNCTION update_updated_at_column ();
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