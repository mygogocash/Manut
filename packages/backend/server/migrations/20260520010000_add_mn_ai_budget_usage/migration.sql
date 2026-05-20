-- Manut Wave 6 (E1.12 — T-1.12.1.a): per-workspace AI budget usage tracking.
--
-- One row per (workspace_id, period_start) tracks the running monthly
-- spend in USD cents. Read by AiBudgetService.assertWithinCap to gate
-- chat invocations against the workspace's tier cap (FREE=$5, PRO=$50,
-- per IMPLEMENTATION_PLAN §0.3 decision #19 + #26 — same tiers exported
-- from packages/backend/server/src/core/quota/tiers.ts).
--
-- Distinct from the M4 mn_budgets table (which is scope-chained:
-- project / agent / task / goal / workspace). This is the simpler
-- plan-tier ceiling that sits in front of every chat turn; M4's
-- scope-chain enforcer stays independent.
--
-- Idempotent on purpose: re-applying this migration MUST be safe so
-- partial-run / replay scenarios don't leave the column or index
-- missing. CLAUDE.md §1 Honesty Rule R0 — untested migrations on a
-- critical path are automatically R0; the IF NOT EXISTS guards turn
-- this into a single-step replayable change.

CREATE TABLE IF NOT EXISTS "mn_ai_budget_usage" (
  "workspace_id" varchar NOT NULL,
  "period_start" timestamptz NOT NULL,
  "spent_cents" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_id", "period_start")
);

CREATE INDEX IF NOT EXISTS "mn_ai_budget_usage_period_idx"
  ON "mn_ai_budget_usage" ("period_start" DESC);
