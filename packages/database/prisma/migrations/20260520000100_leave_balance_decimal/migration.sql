-- Promote LeaveBalance numeric columns from int to numeric(4,1) so half-day
-- leave (e.g. Thailand 2026 used-leave roster) can round-trip without
-- truncation. Mirrors `LeaveRequest.days` which is already Decimal(4,1).
-- USING is idempotent: re-running on already-numeric columns is a no-op.

ALTER TABLE "leave_balances"
  ALTER COLUMN "entitled" TYPE numeric(4, 1) USING ("entitled"::numeric(4, 1)),
  ALTER COLUMN "used" TYPE numeric(4, 1) USING ("used"::numeric(4, 1)),
  ALTER COLUMN "carried" TYPE numeric(4, 1) USING ("carried"::numeric(4, 1)),
  ALTER COLUMN "adjustment" TYPE numeric(4, 1) USING ("adjustment"::numeric(4, 1));

ALTER TABLE "leave_balances"
  ALTER COLUMN "entitled" SET DEFAULT 0,
  ALTER COLUMN "used" SET DEFAULT 0,
  ALTER COLUMN "carried" SET DEFAULT 0,
  ALTER COLUMN "adjustment" SET DEFAULT 0;
