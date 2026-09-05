-- Sync the leave-type catalogue to match the HR policy table from the
-- May feedback round:
--   - Annual 14 (existing) · Sick 30 (existing) · Personal 3 (existing)
--   - WFH no-limit (was 60) · Maternity 120 (was 90) · Paternity 15
--   - LWP no-limit (was 30, was named "Unpaid Leave" with code UL)
--
-- Idempotent — uses INSERT … ON CONFLICT DO UPDATE so re-running the
-- migration is safe and so an admin who already tweaked rows in prod
-- gets snapped back to the canonical values.

-- 1. Rename the legacy "Unpaid Leave / UL" row to "Leave Without Pay / LWP"
--    if it still exists. Skip if the new code is already taken (admin
--    may have created it manually).
UPDATE "leave_types"
   SET "code" = 'LWP',
       "name" = 'Leave Without Pay',
       "days_per_year" = 365
 WHERE "code" = 'UL'
   AND NOT EXISTS (
     SELECT 1 FROM "leave_types" WHERE "code" = 'LWP'
   );

-- 2. Upsert the canonical types so the dropdown always offers the full
--    list. We let an existing row keep its id; only fields that drifted
--    are corrected.
INSERT INTO "leave_types"
  ("id", "name", "code", "category", "days_per_year", "requires_approval", "is_paid", "is_active")
VALUES
  ('lt_seed_al',   'Annual Leave',         'AL',  'earned',  14, true,  true, true),
  ('lt_seed_sl',   'Sick Leave',           'SL',  'sick',    30, false, true, true),
  ('lt_seed_pl',   'Personal Leave',       'PL',  'casual',   3, true,  true, true),
  ('lt_seed_wfh',  'Work From Home',       'WFH', 'casual', 365, true,  true, true),
  ('lt_seed_ml',   'Maternity Leave',      'ML',  'other',  120, true,  true, true),
  ('lt_seed_ptl',  'Paternity Leave',      'PTL', 'other',   15, true,  true, true),
  ('lt_seed_cl',   'Compassionate Leave',  'CL',  'other',    5, true,  true, true),
  ('lt_seed_lwp',  'Leave Without Pay',    'LWP', 'unpaid', 365, true,  false, true),
  ('lt_seed_bl',   'Bereavement Leave',    'BL',  'other',    7, true,  true, true)
ON CONFLICT ("code") DO UPDATE
  SET "name" = EXCLUDED."name",
      "category" = EXCLUDED."category",
      "days_per_year" = EXCLUDED."days_per_year",
      "requires_approval" = EXCLUDED."requires_approval",
      "is_paid" = EXCLUDED."is_paid",
      "is_active" = true;
