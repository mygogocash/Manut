-- Drop the last two orchestrator tables that the earlier cleanup missed.
--
-- `20261111000000_drop_orchestrator_schema` removed the orchestrator columns and
-- its main child tables, but `orchestrator_reviewers` and
-- `orchestrator_notification_preferences` survived. Neither is referenced by the
-- Prisma schema or by any application code, and nothing holds a foreign key to
-- either one, so both are dead schema.
--
-- Same archive-then-drop contract as the earlier migration: no row is destroyed.
-- `orchestrator_reviewers` carries real data, so it is copied into
-- `_archive_orchestrator_reviewers` first. Idempotent — safe to re-run.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'orchestrator_reviewers'
  ) THEN
    -- Snapshot each row as JSONB so the archive does not depend on the source
    -- column layout (which differed across orchestrator iterations).
    CREATE TABLE IF NOT EXISTS "_archive_orchestrator_reviewers" (
      "id"          text PRIMARY KEY,
      "data"        jsonb NOT NULL,
      "archived_at" timestamptz NOT NULL DEFAULT now()
    );

    EXECUTE 'INSERT INTO "_archive_orchestrator_reviewers" ("id", "data")
             SELECT r.id::text, to_jsonb(r) FROM orchestrator_reviewers r
             WHERE NOT EXISTS (
               SELECT 1 FROM "_archive_orchestrator_reviewers" a
               WHERE a.id = r.id::text
             )';

    DROP TABLE "orchestrator_reviewers";
  END IF;
END $$;

-- Empty at time of writing; dropped without an archive.
DROP TABLE IF EXISTS "orchestrator_notification_preferences";
