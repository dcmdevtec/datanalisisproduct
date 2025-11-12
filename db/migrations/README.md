Migration: Convert composite PK (survey_id, respondent_id) to surrogate `id`
=====================================================================

What this does
--------------
- Drops the composite primary key `survey_id, respondent_id` on
  `public.survey_respondent_tracking` and replaces it with a generated UUID `id`.
- Makes `respondent_id` nullable and preserves existing rows by filling `id`.
- Recreates two recommended unique partial indexes for `respondent_public_id`
  and `respondent_user_id`.

Safety first
------------
1. Make a full DB dump BEFORE running this migration. Example (PowerShell):

   # Replace placeholders
   $PGHOST = "your-db-host"
   $PGPORT = "5432"
   $PGUSER = "postgres"
   $PGDATABASE = "your_db"
   $BACKUP = "C:\backups\survey_respondent_tracking_backup_$(Get-Date -Format yyyyMMddHHmmss).sql"
   pg_dump --host $PGHOST --port $PGPORT --username $PGUSER --format=custom --file $BACKUP $PGDATABASE

2. If you use Supabase, prefer the Supabase SQL editor or the `supabase` CLI to run the script
   in a staging environment first.

How to run (PowerShell examples)
--------------------------------
Option A — psql (direct to Postgres):

  psql "postgresql://USER:PASS@HOST:PORT/DBNAME" -f .\db\migrations\2025-11-12_fix_survey_respondent_tracking_pk.sql

Option B — supabase CLI (if configured):

  supabase db query --file .\db\migrations\2025-11-12_fix_survey_respondent_tracking_pk.sql

Rollback
--------
- There is no automatic rollback in this script. Restore the dump created above to roll back.

Notes
-----
- This script uses `gen_random_uuid()` from `pgcrypto`; if your Postgres doesn't have it, change to
  `uuid_generate_v4()` (and ensure `uuid-ossp` extension is available), or generate UUIDs externally.
- Because this changes PKs, any external references to the old composite PK should be reviewed.
