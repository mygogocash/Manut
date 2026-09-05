-- Split the leave-balance carried bucket into its own consumption
-- counter + expiry date, and tag every leave request with the bucket
-- it draws from when approved.
--
-- Prior behaviour: `LeaveBalance.used` consumed both the current-year
-- entitlement and any carry-over indistinguishably, and the carried
-- bucket had no expiry — once HR seeded it, the days persisted
-- forever. Going forward:
--   * `carried_used` tracks consumption against the carry-over bucket
--     separately from `used` (which now means "entitlement bucket
--     consumed").
--   * `carried_expiry` lets HR set a deadline (e.g. 31-Mar of the new
--     year) after which the carried bucket is no longer a valid
--     source for new leave requests.
--   * `leave_requests.source` records which bucket an approved
--     request drew from so an approval/reject flip toggles the right
--     counter.
--
-- All columns nullable (or defaulted) so the migration is idempotent
-- and historic rows keep working unchanged.

ALTER TABLE "leave_balances"
  ADD COLUMN IF NOT EXISTS "carried_used"   DECIMAL(4,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "carried_expiry" DATE;

ALTER TABLE "leave_requests"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'entitled';
