-- Leave balance ledger integrity.
--
-- 1. `leave_requests.balance_deducted` — explicit flag for "this request's
--    days are currently drawn down from leave_balances". Without it the
--    refund/deduct paths had no idempotency primitive: deleting an approved
--    request left `used` inflated forever, and restoring one could charge
--    the employee twice. Backfilled from the current status, including
--    soft-deleted rows (those ARE deducted today — that is the bug) and
--    legacy `pending_cancellation` rows (approved pre-2026-06-03, cancel
--    requested, never refunded).
--
-- 2. `balance_transactions.amount` Int -> Decimal(6,1) — the ledger is the
--    audit trail for a Decimal(4,1) balance. An Int column rounded every
--    half-day away, so the ledger could never be reconciled against
--    `leave_balances.used`.

ALTER TABLE "leave_requests"
  ADD COLUMN IF NOT EXISTS "balance_deducted" BOOLEAN NOT NULL DEFAULT false;

UPDATE "leave_requests"
SET "balance_deducted" = true
WHERE "status" IN ('approved', 'pending_cancellation')
  AND "balance_deducted" = false;

ALTER TABLE "balance_transactions"
  ALTER COLUMN "amount" TYPE DECIMAL(6, 1);
