-- IT subscriptions: effective cancellation date, for the monthly spend series.
--
-- Column-only ON PURPOSE. There is deliberately no backfill UPDATE here:
-- staging syncs its schema with `pnpm db:push`, which applies schema changes
-- but never runs the data-migration SQL inside a migration file. A backfill
-- would therefore land on prod and silently skip staging, leaving the two
-- environments computing different spend histories from the same code.
--
-- Instead `endMonth()` in apps/api/src/modules/it-billing/it-billing-monthly.ts
-- resolves a NULL value at read time (renewal_date -> renewal_decision_at ->
-- updated_at) for any row cancelled before this column existed. The fallback is
-- the mechanism; this column is the human override on top of it.
ALTER TABLE "it_subscriptions"
  ADD COLUMN IF NOT EXISTS "cancelled_at" DATE;
