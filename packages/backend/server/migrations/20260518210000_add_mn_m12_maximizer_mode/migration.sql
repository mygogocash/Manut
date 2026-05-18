-- M12 — MAXIMIZER MODE flag on mn_agents.
--
-- Adds one nullable BOOLEAN column with a DEFAULT FALSE so existing rows
-- get the safe value without a backfill. Tightens execution policy at
-- runtime; see plugins/manut/manut-maximizer.service.ts for the
-- orchestrator behavior that consumes this flag.
--
-- Idempotent ADD COLUMN per CLAUDE.md §1 deploy hygiene (v1.10.x scar —
-- removing IF NOT EXISTS from a migration that already ran is R0).

ALTER TABLE "mn_agents" ADD COLUMN IF NOT EXISTS "maximizer_mode" BOOLEAN NOT NULL DEFAULT FALSE;
