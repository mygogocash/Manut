-- Remove the seven UAT demo projects left over from orchestrator testing.
--
-- NOT RUN AUTOMATICALLY AND NOT A MIGRATION. This deletes rows from a shared
-- database, so it is left as a reviewed script for a human to execute
-- deliberately. Read it, confirm the SELECT returns exactly what you expect,
-- then run the DELETE.
--
--   psql "$DATABASE_URL" -f packages/database/scripts/cleanup-demo-projects.sql
--
-- The seven rows (verified 2026-07-30) are:
--   Demo 1 — Awaiting PM Review
--   Demo 2 — Cross-Functional Review (in progress)
--   Demo 3 — Ready for Business Head
--   Demo 4 — Product Admin Review
--   Demo 5 — Approved (Development Queue)
--   Demo 6 — In Development (broadcast + warning)
--   Demo 7 — Rejected
--
-- Names 2 and 6 still reference removed orchestrator concepts, which is the
-- main reason to clear them before go-live.

-- STEP 1 — Review. Run this first and confirm the output is exactly 7 rows.
SELECT id, name, workflow_status, created_at
FROM projects
WHERE name ~ '^Demo [1-7] — '
ORDER BY name;

-- STEP 2 — Delete. Uncomment only after STEP 1 looks right.
--
-- Children are removed explicitly rather than relying on cascade, so the
-- statement is safe whatever the current FK options are. Wrapped in a
-- transaction: if any statement fails, nothing is removed.
--
-- BEGIN;
--
-- CREATE TEMP TABLE _demo_ids AS
--   SELECT id FROM projects WHERE name ~ '^Demo [1-7] — ';
--
-- DELETE FROM project_workflow_emails      WHERE project_id IN (SELECT id FROM _demo_ids);
-- DELETE FROM project_workflow_transitions WHERE project_id IN (SELECT id FROM _demo_ids);
-- DELETE FROM project_tasks                WHERE project_id IN (SELECT id FROM _demo_ids);
-- DELETE FROM project_members              WHERE project_id IN (SELECT id FROM _demo_ids);
-- DELETE FROM project_columns              WHERE project_id IN (SELECT id FROM _demo_ids);
-- DELETE FROM projects                     WHERE id         IN (SELECT id FROM _demo_ids);
--
-- -- Confirm 0 before committing.
-- SELECT count(*) AS should_be_zero FROM projects WHERE name ~ '^Demo [1-7] — ';
--
-- COMMIT;
