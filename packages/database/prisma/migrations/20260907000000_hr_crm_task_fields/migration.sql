-- HR-team feedback (2026-05-26) — HR CRM uses Project rows as
-- operational HR tasks (visa runs, admin tickets, F&A approvals).
-- These two columns let the HR form drop the BD-style date /
-- dependency / department fields and surface the HR-specific
-- categorisation instead. Nullable so non-HR teams ignore them.

ALTER TABLE "projects"
    ADD COLUMN IF NOT EXISTS "task_type"     TEXT,
    ADD COLUMN IF NOT EXISTS "assigned_team" TEXT;
