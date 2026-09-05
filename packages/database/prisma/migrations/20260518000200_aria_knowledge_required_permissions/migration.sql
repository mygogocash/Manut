-- ARIA knowledge articles — per-permission gating (May 2026):
--
-- ARIA today injects retrieved knowledge articles into the chat prompt
-- with no permission filter, so an employee without `payroll:read` can
-- still surface the payroll-formula article by asking the right
-- question. `required_permissions` is a JSON-array-of-strings column
-- that the chat service checks at retrieval time:
--   * empty array = public (signed-in users only).
--   * non-empty   = user must hold at least one of these codes.
--
-- Idempotent via IF NOT EXISTS.

ALTER TABLE "aria_knowledge_articles"
  ADD COLUMN IF NOT EXISTS "required_permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
