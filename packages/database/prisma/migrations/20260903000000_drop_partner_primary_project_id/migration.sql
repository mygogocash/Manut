-- Phase 4b of the Partner ↔ Project decouple (Marketing incident,
-- 2026-05-26). Drops the legacy `partners.primary_project_id`
-- column. Phase 4a (#607) retired the API + auto-create that
-- populated it; nothing reads or writes the column anymore.
--
-- Backward-compat note: the Project graph that USED to back each
-- Partner workspace still exists. The FK from Partner is gone but
-- those Project rows remain queryable by `project.partner_id`
-- (separate, intentionally-kept relation for BD reporting).

-- Drop the FK constraint first — Postgres requires the constraint
-- to be removed before the column can vanish. Use IF EXISTS so a
-- partial-apply incident can re-run cleanly.
ALTER TABLE "partners"
    DROP CONSTRAINT IF EXISTS "partners_primary_project_id_fkey";

DROP INDEX IF EXISTS "partners_primary_project_id_key";

ALTER TABLE "partners"
    DROP COLUMN IF EXISTS "primary_project_id";
