-- ARIA Phase 3 — tool-call telemetry on the query log.
-- Idempotent.

ALTER TABLE "aria_query_logs"
  ADD COLUMN IF NOT EXISTS "tool_use_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tool_names"     TEXT[]  NOT NULL DEFAULT ARRAY[]::TEXT[];
