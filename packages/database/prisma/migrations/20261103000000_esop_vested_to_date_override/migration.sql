-- "Total Vesting to date" can now be overridden per grant. NULL keeps the
-- auto-computed value (vestedSharesToDate: linear by elapsed months); a
-- value pins HR's hand-entered figure when the linear formula can't
-- reproduce it (e.g. a row valued at a different date than the report).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS survives a partial-apply re-run and
-- the staging `db:push` path. Existing rows default to NULL (auto), so the
-- pool KPIs and per-row totals are unchanged until an admin sets a value.
ALTER TABLE "esop_grants" ADD COLUMN IF NOT EXISTS "vested_to_date_override" INTEGER;
