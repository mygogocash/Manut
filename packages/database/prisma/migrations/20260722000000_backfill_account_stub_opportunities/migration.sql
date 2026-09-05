-- Backfill stub Opportunity for every Account that doesn't already
-- have one. BD feedback (Vivek, 2026-05-22): Accounts and Pipeline
-- totals must agree — every Account is a deal we're tracking, and
-- the previous `dealHasPipelineFields` gate in `syncAccountDeal`
-- left Accounts orphaned when the user didn't fill the deal subsection
-- on the form. From this migration onwards every Account has at least
-- one Opportunity row (`qualified` / $0 USD / 20% probability — the
-- same defaults `syncAccountDeal` now uses on the create path).
--
-- Idempotent: re-running on a partially-applied DB is safe because
-- the INSERT is gated on `NOT EXISTS` — any Account that's already
-- gained an Opportunity by then is skipped.
--
-- ID generation: Opportunity.id is a `String` column populated by
-- Prisma's `cuid()` at write time. Postgres has no cuid generator,
-- so we synthesise a cuid-shape value here using a 'c' prefix plus
-- a 24-char random hex (gen_random_bytes returns the bytes, encode
-- formats them). The result satisfies the column's string type and
-- is collision-safe at the scale we run.

INSERT INTO "crm_opportunities" (
  "id",
  "name",
  "account_id",
  "stage",
  "value",
  "currency",
  "probability",
  "probability_custom",
  "owner_id",
  "created_at",
  "updated_at"
)
SELECT
  'c' || encode(gen_random_bytes(12), 'hex'),
  a."name",
  a."id",
  'qualified',
  0,
  'USD',
  20,
  FALSE,
  a."owner_id",
  NOW(),
  NOW()
FROM "crm_accounts" a
WHERE NOT EXISTS (
  SELECT 1
  FROM "crm_opportunities" o
  WHERE o."account_id" = a."id"
);
