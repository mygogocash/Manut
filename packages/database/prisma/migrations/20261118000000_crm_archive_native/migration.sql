-- Archive (Active / Archived tabs) for the native project-family CRMs — QA,
-- Legal, Accounting, Product — mirroring it_projects.archived_at. Additive +
-- idempotent + reversible. Null = active; a set timestamp = archived.
ALTER TABLE "qa_projects" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6);
CREATE INDEX IF NOT EXISTS "qa_projects_archived_at_idx" ON "qa_projects" ("archived_at");

ALTER TABLE "legal_projects" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6);
CREATE INDEX IF NOT EXISTS "legal_projects_archived_at_idx" ON "legal_projects" ("archived_at");

ALTER TABLE "accounting_projects" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6);
CREATE INDEX IF NOT EXISTS "accounting_projects_archived_at_idx" ON "accounting_projects" ("archived_at");

ALTER TABLE "product_projects" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6);
CREATE INDEX IF NOT EXISTS "product_projects_archived_at_idx" ON "product_projects" ("archived_at");
