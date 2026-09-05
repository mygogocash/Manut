-- Sales CRM — seed the 6 default lead sources (PRD §11.7). The
-- `seed.ts` script upserts these rows on dev / staging, but prod
-- never ran the seed so the `crm_lead_sources` table is empty —
-- reps can't pick a Source on the New Lead form, and the form's
-- "Source is required" zod check blocks submit.
--
-- 2026-05-28 follow-up: prior version of this file omitted
-- `created_at` / `updated_at`, which is fine on dev (Prisma's
-- shadow DB applies defaults) but failed on prod with P3018
-- (NOT NULL constraint on updated_at). Explicit `NOW()` on both
-- timestamp columns + `ON CONFLICT (code) DO NOTHING` keeps the
-- migration idempotent for the resolve-then-redeploy retry path.

INSERT INTO "crm_lead_sources" (
  "id",
  "code",
  "label",
  "is_system",
  "is_active",
  "sort_order",
  "created_at",
  "updated_at"
)
VALUES
  ('seed_web', 'web', 'Web inbound', true, true, 10, NOW(), NOW()),
  ('seed_referral', 'referral', 'Referral', true, true, 20, NOW(), NOW()),
  ('seed_conference', 'conference', 'Conference', true, true, 30, NOW(), NOW()),
  ('seed_partner', 'partner', 'Partner', true, true, 40, NOW(), NOW()),
  ('seed_cold', 'cold', 'Cold outreach', true, true, 50, NOW(), NOW()),
  ('seed_other', 'other', 'Other', true, true, 60, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;
