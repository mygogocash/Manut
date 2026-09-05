-- Delete-account on Sales CRM was failing with "Related data is
-- missing or invalid" whenever the account had any opportunity
-- attached. Root cause: the `crm_opportunities.account_id` FK
-- defaulted to ON DELETE RESTRICT while every other Account-pointing
-- table (`crm_contacts`, `crm_activities`) cascaded.
--
-- Drop + recreate the FK with ON DELETE CASCADE so deleting an
-- account sweeps its opportunities (and the per-opportunity tasks +
-- activities cascade transitively, because those FKs already cascade
-- from Opportunity).
--
-- Idempotent: the DROP is guarded with IF EXISTS and the constraint
-- name follows Prisma's standard `{table}_{column}_fkey` convention,
-- so re-running the migration on a partially-applied DB is safe.

ALTER TABLE "crm_opportunities"
  DROP CONSTRAINT IF EXISTS "crm_opportunities_account_id_fkey";

ALTER TABLE "crm_opportunities"
  ADD CONSTRAINT "crm_opportunities_account_id_fkey"
  FOREIGN KEY ("account_id")
  REFERENCES "crm_accounts"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
