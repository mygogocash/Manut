-- Manut Wave 6 (E2.5 — M2 epic: tabbed multi-chat in the floating chat panel).
--
-- Adds an optional `pinned_doc_id` column to `ai_sessions_metadata`. When set,
-- the floating chat tab locks its context to that doc and ignores nav-driven
-- doc swaps; when null, context follows the current page (existing behavior).
--
-- Distinct from the existing `doc_id` column on AiSession:
--   - `doc_id` is the doc the session was originally opened against; it can
--     change on update for some chats but is mostly read-only metadata.
--   - `pinned_doc_id` is a user-controlled "this tab is sticky to this doc"
--     flag. UI displays a pin chip when set.
--
-- Idempotent on purpose: re-applying this migration MUST be safe (replay
-- scenarios) — CLAUDE.md §1 Honesty Rule R0 turns untested critical-path
-- migrations into R0. `ADD COLUMN IF NOT EXISTS` guards both the column and
-- a future no-op replay.

ALTER TABLE "ai_sessions_metadata"
  ADD COLUMN IF NOT EXISTS "pinned_doc_id" varchar;
