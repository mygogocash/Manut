-- mkt_campaigns.archived_at — the column the Marketing Campaign CRM filters on,
-- which prod never received.
--
-- 20261119000000_crm_archive_non_project is the ONLY migration that adds
-- archived_at to mkt_campaigns, and it does so through an information_schema
-- FOREACH loop that silently skips absent tables. When it ran on prod
-- (hotfix #950, P3018) the Marketing module had not been promoted, so
-- mkt_campaigns did not exist: the loop skipped it and the migration recorded
-- itself APPLIED. 20261106000000_marketing_crm_campaigns then creates
-- mkt_campaigns WITHOUT archived_at.
--
-- deploy.yml lists 20261119 in the `prisma migrate resolve --rolled-back` loop,
-- but that is NOT a fix: resolve only acts on a migration in a FAILED state and
-- returns P3012 otherwise, which the step's `|| true` swallows. 20261119 has
-- been in the applied state on prod since July (every deploy since would have
-- P3009-aborted otherwise), so it will never re-run.
--
-- Without this migration, `where.archivedAt` on the DEFAULT campaign list path
-- (marketing-campaigns.service.ts:134) and the DAU/MAU attribution query in
-- marketing-analytics.service.ts throw Postgres 42703 in production. Staging
-- cannot catch it: staging syncs with `db:push`, which builds the table from
-- the Prisma schema and therefore always has the column.
--
-- TIMESTAMPTZ(6) matches what 20261119 gave every sibling table. Idempotent, so
-- it is a no-op on any environment that already has the column.

ALTER TABLE "mkt_campaigns" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6);
CREATE INDEX IF NOT EXISTS "mkt_campaigns_archived_at_idx" ON "mkt_campaigns" ("archived_at");
