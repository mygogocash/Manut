-- QA-team feedback (2026-05-26): their Excel template has a Partner
-- column between Date and Product that the web table is missing.
-- Add the column + matching index so the new "Partner" filter on the
-- issue table can stay server-side.

ALTER TABLE "qa_project_tasks"
    ADD COLUMN IF NOT EXISTS "partner" TEXT;

CREATE INDEX IF NOT EXISTS "qa_project_tasks_partner_idx"
    ON "qa_project_tasks"("partner");
