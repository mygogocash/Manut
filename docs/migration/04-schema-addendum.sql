-- =====================================================================
-- Intranet — schema addendum: objects Prisma does NOT emit
--
-- Apply AFTER 03-schema.sql. Every statement is idempotent and safe to
-- re-run.
--
-- Why this file exists: these objects live only in raw migration SQL
-- (packages/database/prisma/migrations/**). They are invisible to
-- `prisma migrate diff` and to `prisma db push`, so a database built
-- from the Prisma schema alone is missing them. Consequences if
-- skipped:
--   * ARIA knowledge retrieval silently degrades to keyword overlap
--     (the vector column and its index are gone).
--   * `investors.tags` / `projects.departments` membership queries lose
--     their GIN indexes and fall back to sequential scans.
--   * Row-Level Security is off. See section 3 for why that may or may
--     not matter on the target.
--
-- VERIFIED: 03-schema.sql + this file apply cleanly to an empty
-- PostgreSQL 16.14 database (274 tables, 3228 columns, 444 FKs).
-- Section 1 requires the `vector` extension to be installable; on a
-- server without it, `CREATE EXTENSION` fails with
-- `ERROR: extension "vector" is not available` -- which is exactly the
-- failure you want to hit in a staging rehearsal rather than in prod.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. pgvector — ARIA knowledge embeddings
--    Origin: migrations/20260509000000_aria_knowledge_embeddings
--    Gemini text-embedding-004, 768 dims, cosine similarity.
--    NOTE: `embedding` is deliberately absent from the Prisma model;
--    apps/api/src/modules/aria/aria.repository.ts reads it through
--    $queryRaw. Do not "fix" this by adding it to the schema without
--    checking Prisma's Unsupported() handling first.
-- ---------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "aria_knowledge_articles"
  ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- IVFFlat index sized for tiny corpora; lists=1 is fine for <100 rows
-- and keeps inserts cheap. Bump the list count if the corpus grows past
-- a few thousand rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'aria_knowledge_articles_embedding_idx'
  ) THEN
    EXECUTE 'CREATE INDEX "aria_knowledge_articles_embedding_idx"
             ON "aria_knowledge_articles"
             USING ivfflat ("embedding" vector_cosine_ops)
             WITH (lists = 1)';
  END IF;
END$$;


-- ---------------------------------------------------------------------
-- 2. GIN indexes on text[] columns
--    Origin: migrations/20261115000000_project_departments_multi
--            migrations/20261227000000_investor_tags
--    Membership predicates ('Product' = ANY(departments), tags @> …)
--    cannot use a btree index. Both migrations carry a comment noting
--    that `prisma db push` -- how staging syncs -- does NOT create them,
--    so staging has never had these indexes.
-- ---------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "projects_departments_idx"
  ON "projects" USING GIN ("departments");

CREATE INDEX IF NOT EXISTS "investors_tags_gin_idx"
  ON "investors" USING GIN ("tags");


-- ---------------------------------------------------------------------
-- 3. Row-Level Security — service-role-only access
--    Origin: migrations/0000_init, re-appliable via `pnpm db:rls`
--    (packages/database/scripts/apply-rls.ts).
--
--    SHAPE. Every listed table gets exactly ONE policy,
--    "service_role_full_access", allowing everything when
--    public.is_service_role() is true. There are no per-user or
--    per-tenant policies -- the Express API is the sole database client
--    and does all authorisation in application code (see
--    apps/api/src/core/guards/auth.guard.ts). This is not a tenancy
--    model; it is a backstop that keeps Supabase's auto-generated REST
--    API from reaching the tables.
--
--    COVERAGE GAP (drift, not decision). The list below is the 94 tables
--    that existed at 0000_init -- 91 of which still exist. The other
--    183 tables were added later and have no policy and RLS disabled.
--    They are still unreachable by anon/authenticated because of the
--    REVOKE + ALTER DEFAULT PRIVILEGES
--    statements, so this is defence-in-depth missing rather than an
--    exposure -- but do NOT assume "RLS is on" for an arbitrary table.
--
--    THREE OF THE 94 NO LONGER EXIST. `survey_definitions`,
--    `survey_waves` and `upload_jobs` were dropped after 0000_init. The
--    verbatim 0000_init block therefore FAILS against a database built
--    from the current schema (`ERROR: relation "public.survey_definitions"
--    does not exist`). The loop below skips any table that is absent,
--    which also makes it safe to re-run mid-migration.
--
--    ON A NON-SUPABASE TARGET (RDS / Aurora) none of this is load
--    bearing: the `anon`, `authenticated`, `service_role` and
--    `supabase_admin` roles do not exist, so the REVOKEs are no-ops and
--    is_service_role() reduces to `current_user = 'postgres'`. The role
--    guards below stop that from being an error. Decide deliberately
--    whether to carry the layer over -- porting it unchanged creates a
--    false impression that RLS is enforcing something.
-- ---------------------------------------------------------------------

-- 3a. Helper function.
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT current_setting('role', true) IN ('service_role', 'supabase_admin')
      OR current_user = 'postgres';
$$;

-- 3b. Revoke direct table access from the Supabase API roles, now and
--     for future tables. Guarded on role existence so the file also
--     applies to a plain PostgreSQL server.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format(
        'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public '
        'REVOKE ALL ON TABLES FROM %I', r);
    ELSE
      RAISE NOTICE 'role % absent — skipping revoke (expected off Supabase)', r;
    END IF;
  END LOOP;
END$$;

-- 3c. Enable RLS + create the policy on each of the 94 tables from
--     0000_init that still exists.
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'applications', 'appraisal_comments', 'appraisal_cycles',
    'appraisal_kras', 'appraisal_ratings', 'appraisals',
    'aria_conversations', 'aria_messages', 'articles', 'assets',
    'audit_log', 'balance_transactions', 'bank_transactions',
    'benefit_enrollments', 'benefits', 'blogs', 'bnry_transactions',
    'chart_of_accounts', 'company_dates', 'company_news',
    'consultant_invoices', 'conversation_members', 'conversations',
    'crm_accounts', 'crm_activities', 'crm_contacts',
    'crm_lead_sources', 'crm_leads', 'crm_lost_reasons',
    'crm_opportunities', 'crm_tasks', 'data_room_documents', 'deals',
    'departments', 'desk_bookings', 'entities', 'esop_grants',
    'exchange_rates', 'expense_categories', 'expenses', 'file_uploads',
    'goals', 'google_oauth_states', 'investments', 'investor_updates',
    'investors', 'invoices', 'jobs', 'journal_entries',
    'journal_entry_lines', 'kra_templates', 'leave_balances',
    'leave_requests', 'leave_types', 'meeting_rooms',
    'message_hidden_for', 'message_reactions', 'messages',
    'module_access', 'module_owners', 'office_desks', 'offices',
    'onboarding_runs', 'partner_contacts', 'partners', 'payroll_runs',
    'payslips', 'project_columns', 'project_members',
    'project_task_activities', 'project_task_comments', 'project_tasks',
    'projects', 'role_permissions', 'roles', 'room_bookings',
    'sessions', 'survey_definitions', 'survey_responses',
    'survey_waves', 'system_settings', 'training_completions',
    'training_modules', 'travel_requests', 'upload_jobs',
    'user_google_connections', 'user_group_members', 'user_groups',
    'user_roles', 'user_settings', 'users', 'visa_records',
    'wall_comments', 'wall_posts'
  ];
  missing text[] := ARRAY[]::text[];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF to_regclass('public.' || quote_ident(tbl)) IS NULL THEN
      missing := missing || tbl;
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format(
      'DROP POLICY IF EXISTS "service_role_full_access" ON public.%I', tbl);

    EXECUTE format(
      'CREATE POLICY "service_role_full_access" ON public.%I
       FOR ALL
       USING (public.is_service_role())
       WITH CHECK (public.is_service_role())',
      tbl);
  END LOOP;

  IF array_length(missing, 1) > 0 THEN
    RAISE NOTICE 'RLS skipped for % retired table(s): %',
      array_length(missing, 1), array_to_string(missing, ', ');
  END IF;
END$$;

-- 3d. Storage: allow service_role uploads. Supabase-specific; the
--     information_schema guard makes it a clean no-op elsewhere, and
--     `auth.jwt()` only exists on Supabase.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "nexora_service_role_storage_objects_all" ON storage.objects';
    EXECUTE $policy$
      CREATE POLICY "nexora_service_role_storage_objects_all"
      ON storage.objects
      FOR ALL
      TO public
      USING (coalesce((auth.jwt() ->> 'role'), '') = 'service_role')
      WITH CHECK (coalesce((auth.jwt() ->> 'role'), '') = 'service_role')
    $policy$;
  ELSE
    RAISE NOTICE 'storage.objects absent — skipping storage policy (expected off Supabase)';
  END IF;
END$$;
