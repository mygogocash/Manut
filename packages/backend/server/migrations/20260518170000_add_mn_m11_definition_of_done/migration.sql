-- M11 — Enforced Outcomes (Definition of Done).
--
-- Adds one nullable JSONB column to mn_tasks. The column carries an
-- array of typed predicates that the MnOutcomeVerifierService runs to
-- decide whether a task may transition to DONE. Predicate kinds:
--   DOC_EXISTS, URL_REACHABLE, WORK_PRODUCT_EXISTS,
--   EMBEDDING_SIMILARITY, CUSTOM.
--
-- Idempotent column add via IF NOT EXISTS so re-applying this
-- migration on a partially-migrated DB is safe (CLAUDE.md §1 deploy
-- hygiene; v1.10.x scar — removing `IF NOT EXISTS` from a migration
-- that already ran is an R0 operation).

ALTER TABLE "mn_tasks" ADD COLUMN IF NOT EXISTS "definition_of_done" JSONB;
