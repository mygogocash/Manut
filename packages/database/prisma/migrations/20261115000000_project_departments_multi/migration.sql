-- Allow a project to span several departments.
--
-- Additive. The existing scalar `department` stays and remains authoritative
-- as the PRIMARY department, because the projects dashboard groups on it
-- (`groupBy(["department"])`) and a scalar list cannot be grouped. The new
-- `departments` array carries the full selection; the service keeps
-- `department` equal to `departments[0]`.
--
-- Existing rows are backfilled from their current value, so nothing reads as
-- "no departments" after this runs.
--
-- Idempotent: safe to re-run.

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "departments" text[] NOT NULL DEFAULT '{}';

-- Backfill only rows that have a department but an empty array, so re-running
-- never clobbers a real multi-department selection made after the first run.
UPDATE "projects"
SET "departments" = ARRAY["department"]
WHERE "department" IS NOT NULL
  AND "department" <> ''
  AND cardinality("departments") = 0;

-- Membership lookups (`'Product' = ANY(departments)`) use GIN.
CREATE INDEX IF NOT EXISTS "projects_departments_idx"
  ON "projects" USING GIN ("departments");
