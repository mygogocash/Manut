-- M1 — best-effort seed of the GL posting account-role mapping.
--
-- The posting engine (apps/api/.../gl-posting.service.ts) routes every AR/AP/
-- bank event to a concrete chart-of-accounts row via
-- account_mappings(entity_id, role). Automatic posting is gated on this mapping
-- being COMPLETE (GET /accounting/posting-readiness) AND on the
-- ACCOUNTING_GL_POSTING flag, so an incomplete or wrong-free seed can never
-- mis-post — an unmapped role simply shows as "not ready" in the settings UI.
--
-- Matching is by ACCOUNT NAME (the production chart of accounts was xlsx-
-- imported under an unknown code scheme, so names are the portable signal) and
-- is intentionally CONSERVATIVE: a role with no confident match is left
-- unmapped for an admin to fill via PUT /accounting/account-mappings. A wrong
-- mapping is worse than a missing one (it would silently mis-post), so we would
-- rather map nothing than guess.
--
-- Safety:
--   * INSERT-only + ON CONFLICT (entity_id, role) DO NOTHING — never overwrites
--     a choice an admin already made, and safe to re-run after a P3009 partial
--     deploy.
--   * DISTINCT ON (entity_id) picks exactly one account per entity per role.
--   * Data-migration SQL does NOT run on staging (db:push) — staging mappings
--     stay empty until configured by hand. See CLAUDE.md.

-- ar_control — Accounts Receivable control (asset)
INSERT INTO "account_mappings" (id, entity_id, role, chart_of_account_id)
SELECT DISTINCT ON (c.entity_id)
  gen_random_uuid()::text, c.entity_id, 'ar_control', c.id
FROM "chart_of_accounts" c
WHERE c.deleted_at IS NULL AND c.is_active = TRUE
  AND c.type = 'asset'
  AND (c.name ILIKE '%account%receivable%' OR c.name ILIKE 'trade receivable%')
ORDER BY c.entity_id, c.code ASC
ON CONFLICT (entity_id, role) DO NOTHING;

-- ap_control — Accounts Payable control (liability)
INSERT INTO "account_mappings" (id, entity_id, role, chart_of_account_id)
SELECT DISTINCT ON (c.entity_id)
  gen_random_uuid()::text, c.entity_id, 'ap_control', c.id
FROM "chart_of_accounts" c
WHERE c.deleted_at IS NULL AND c.is_active = TRUE
  AND c.type = 'liability'
  AND (c.name ILIKE '%account%payable%' OR c.name ILIKE 'trade payable%')
ORDER BY c.entity_id, c.code ASC
ON CONFLICT (entity_id, role) DO NOTHING;

-- revenue_default — default sales/service revenue account
INSERT INTO "account_mappings" (id, entity_id, role, chart_of_account_id)
SELECT DISTINCT ON (c.entity_id)
  gen_random_uuid()::text, c.entity_id, 'revenue_default', c.id
FROM "chart_of_accounts" c
WHERE c.deleted_at IS NULL AND c.is_active = TRUE
  AND c.type = 'revenue'
ORDER BY c.entity_id,
  CASE
    WHEN c.name ILIKE '%sales%' THEN 0
    WHEN c.name ILIKE '%service income%' OR c.name ILIKE '%service revenue%' THEN 1
    WHEN c.name ILIKE '%revenue%' OR c.name ILIKE '%income%' THEN 2
    ELSE 3
  END,
  c.code ASC
ON CONFLICT (entity_id, role) DO NOTHING;

-- expense_default — default expense account
INSERT INTO "account_mappings" (id, entity_id, role, chart_of_account_id)
SELECT DISTINCT ON (c.entity_id)
  gen_random_uuid()::text, c.entity_id, 'expense_default', c.id
FROM "chart_of_accounts" c
WHERE c.deleted_at IS NULL AND c.is_active = TRUE
  AND c.type = 'expense'
ORDER BY c.entity_id,
  CASE
    WHEN c.name ILIKE '%cost of%' THEN 0
    WHEN c.name ILIKE '%general%' OR c.name ILIKE '%administrat%' THEN 1
    WHEN c.name ILIKE '%expense%' THEN 2
    ELSE 3
  END,
  c.code ASC
ON CONFLICT (entity_id, role) DO NOTHING;

-- vat_output — output VAT payable (on sales)
INSERT INTO "account_mappings" (id, entity_id, role, chart_of_account_id)
SELECT DISTINCT ON (c.entity_id)
  gen_random_uuid()::text, c.entity_id, 'vat_output', c.id
FROM "chart_of_accounts" c
WHERE c.deleted_at IS NULL AND c.is_active = TRUE
  AND (
    c.name ILIKE '%output%vat%' OR c.name ILIKE '%vat%output%'
    OR c.name ILIKE '%output%tax%' OR c.name ILIKE '%vat payable%'
  )
ORDER BY c.entity_id, c.code ASC
ON CONFLICT (entity_id, role) DO NOTHING;

-- vat_input — input VAT receivable (on purchases)
INSERT INTO "account_mappings" (id, entity_id, role, chart_of_account_id)
SELECT DISTINCT ON (c.entity_id)
  gen_random_uuid()::text, c.entity_id, 'vat_input', c.id
FROM "chart_of_accounts" c
WHERE c.deleted_at IS NULL AND c.is_active = TRUE
  AND (
    c.name ILIKE '%input%vat%' OR c.name ILIKE '%vat%input%'
    OR c.name ILIKE '%input%tax%' OR c.name ILIKE '%vat receivable%'
  )
ORDER BY c.entity_id, c.code ASC
ON CONFLICT (entity_id, role) DO NOTHING;

-- wht_payable — withholding tax withheld from suppliers, owed to the RD (liability)
INSERT INTO "account_mappings" (id, entity_id, role, chart_of_account_id)
SELECT DISTINCT ON (c.entity_id)
  gen_random_uuid()::text, c.entity_id, 'wht_payable', c.id
FROM "chart_of_accounts" c
WHERE c.deleted_at IS NULL AND c.is_active = TRUE
  AND c.type = 'liability'
  AND (c.name ILIKE '%withhold%' OR c.name ILIKE '%wht%')
ORDER BY c.entity_id, c.code ASC
ON CONFLICT (entity_id, role) DO NOTHING;

-- wht_receivable — withholding tax withheld by customers, a prepaid asset
INSERT INTO "account_mappings" (id, entity_id, role, chart_of_account_id)
SELECT DISTINCT ON (c.entity_id)
  gen_random_uuid()::text, c.entity_id, 'wht_receivable', c.id
FROM "chart_of_accounts" c
WHERE c.deleted_at IS NULL AND c.is_active = TRUE
  AND c.type = 'asset'
  AND (c.name ILIKE '%withhold%' OR c.name ILIKE '%wht%')
ORDER BY c.entity_id, c.code ASC
ON CONFLICT (entity_id, role) DO NOTHING;

-- retained_earnings — accumulated prior-year earnings (equity)
INSERT INTO "account_mappings" (id, entity_id, role, chart_of_account_id)
SELECT DISTINCT ON (c.entity_id)
  gen_random_uuid()::text, c.entity_id, 'retained_earnings', c.id
FROM "chart_of_accounts" c
WHERE c.deleted_at IS NULL AND c.is_active = TRUE
  AND c.type = 'equity'
  AND (c.name ILIKE '%retained earning%' OR c.name ILIKE '%accumulated profit%')
ORDER BY c.entity_id, c.code ASC
ON CONFLICT (entity_id, role) DO NOTHING;

-- rounding — rounding difference clearing account
INSERT INTO "account_mappings" (id, entity_id, role, chart_of_account_id)
SELECT DISTINCT ON (c.entity_id)
  gen_random_uuid()::text, c.entity_id, 'rounding', c.id
FROM "chart_of_accounts" c
WHERE c.deleted_at IS NULL AND c.is_active = TRUE
  AND c.name ILIKE '%rounding%'
ORDER BY c.entity_id, c.code ASC
ON CONFLICT (entity_id, role) DO NOTHING;
