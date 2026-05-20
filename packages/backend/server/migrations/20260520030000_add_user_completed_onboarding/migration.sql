-- Manut Wave 2 B6 — 4-question onboarding wizard at /welcome.
--
-- Adds a `completed_onboarding` flag on `users`. Set to true once the
-- user finishes (or skips) the wizard so we don't redirect them back
-- to /welcome on every sign-in. Existing rows default to false; that
-- shows the wizard once, which is the right behaviour — they'll click
-- skip if they don't want it.
--
-- Idempotent per CLAUDE.md §1 Honesty Rule R0: untested critical-path
-- migrations are R0. `ADD COLUMN IF NOT EXISTS` guards a replay.
-- Default `false` (not NULL) so the boolean is safe to read at the
-- resolver/SQL boundary without coalescing — Prisma column type is
-- still nullable to match the schema, but the DB default fills in the
-- value on insert.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "completed_onboarding" boolean NOT NULL DEFAULT false;
