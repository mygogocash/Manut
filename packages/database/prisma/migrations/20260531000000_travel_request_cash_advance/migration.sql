-- Add optional `cash_advance` (amount the traveler requests up-front,
-- separate from `estimated_budget`) to travel requests. Same currency
-- as the request's `currency` column. Nullable so existing rows are
-- untouched; populated only when the submitter ticks the field.

ALTER TABLE "travel_requests"
  ADD COLUMN IF NOT EXISTS "cash_advance" DECIMAL(15, 2);
