-- Amount-band + category approval routing (May 2026, Sarah/Sid feedback):
--
-- Travel + expense approval chains now support filtering individual
-- steps by:
--   * a category whitelist (apply only when the request/report has one
--     of these category strings), and
--   * a THB amount band (apply only when the request's THB-equivalent
--     amount falls inside [min, max]).
--
-- That lets HR carve out, e.g., a "Sarah approval ≤ 2,000 THB BD" step
-- and a "Sid approval > 2,000 THB BD" step inside the same chain
-- without duplicating the entire chain per category.
--
-- Migration is idempotent (IF NOT EXISTS).

ALTER TABLE "travel_requests"
  ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'general';

ALTER TABLE "travel_approval_steps"
  ADD COLUMN IF NOT EXISTS "category_filter" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "travel_approval_steps"
  ADD COLUMN IF NOT EXISTS "amount_min_baht" DECIMAL(15, 2);
ALTER TABLE "travel_approval_steps"
  ADD COLUMN IF NOT EXISTS "amount_max_baht" DECIMAL(15, 2);

ALTER TABLE "expense_reports"
  ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'general';

ALTER TABLE "expense_approval_steps"
  ADD COLUMN IF NOT EXISTS "category_filter" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "expense_approval_steps"
  ADD COLUMN IF NOT EXISTS "amount_min_baht" DECIMAL(15, 2);
ALTER TABLE "expense_approval_steps"
  ADD COLUMN IF NOT EXISTS "amount_max_baht" DECIMAL(15, 2);

CREATE INDEX IF NOT EXISTS "travel_requests_category_idx"
  ON "travel_requests" ("category");
CREATE INDEX IF NOT EXISTS "expense_reports_category_idx"
  ON "expense_reports" ("category");
