-- Seed Shahab's four ESOP instruments (from his Equity Summary Report) so the
-- per-employee breakdown has real data matching the reference sheet:
--   CXO Equity            50,000 shares, 36mo linear vesting from 2025-01
--   Equity from Contract     640 shares, 24mo monthly (THB) from 2025-09
--   Sign-up Equity         1,000 shares, no vesting (immediate)
--   Golden Handcuff       20,000 shares, no vesting (immediate)
-- Idempotent: only inserts when a matching Shahab user exists AND has no ESOP
-- grants yet, so it's safe to re-run and a no-op when the user is absent.
-- NOTE: staging syncs schema via `db:push` (migrations are not applied there);
-- run this block manually against staging if the demo data is needed.

INSERT INTO "esop_grants" (
  "id", "employee_id", "grant_date", "grant_type", "value_type", "shares",
  "currency_code", "currency_amount", "vesting_months", "lock_months",
  "strike_price", "allocation_mode", "monthly_amount", "allocation_start_month",
  "allocation_end_month", "source", "status", "exercised_shares",
  "created_at", "updated_at"
)
SELECT
  gen_random_uuid(), u.id, v.grant_date, v.grant_type, v.value_type, v.shares,
  v.currency_code, v.currency_amount, v.vesting_months, NULL,
  0, v.allocation_mode, v.monthly_amount, v.allocation_start_month,
  v.allocation_end_month, 'Shahab Equity Summary (seed)', 'active', 0,
  now(), now()
FROM (
  SELECT id FROM "users"
  WHERE lower("email") LIKE 'shahab%' OR "name" ILIKE '%shahab%'
  ORDER BY "created_at"
  LIMIT 1
) u
CROSS JOIN (VALUES
  (DATE '2025-01-01', 'cxo_equity',      'shares',   50000, NULL::text, NULL::numeric, 36,        'one_time',          NULL::numeric, NULL::date,        NULL::date),
  (DATE '2025-09-01', 'equity',          'currency',   640, 'THB',      2111400::numeric, 24,      'monthly_recurring', 87975::numeric, DATE '2025-09-01', DATE '2027-08-01'),
  (DATE '2024-01-01', 'sign_up_bonus',   'shares',    1000, NULL,       NULL,           NULL::int, 'one_time',          NULL,          NULL,              NULL),
  (DATE '2024-01-01', 'golden_handcuff', 'shares',   20000, NULL,       NULL,           NULL,      'one_time',          NULL,          NULL,              NULL)
) AS v(grant_date, grant_type, value_type, shares, currency_code, currency_amount, vesting_months, allocation_mode, monthly_amount, allocation_start_month, allocation_end_month)
WHERE NOT EXISTS (
  SELECT 1 FROM "esop_grants" e WHERE e."employee_id" = u.id
);
