-- Public holidays per entity. Mirrors LeaveType.entityId so the same
-- Entity selector drives both Leave Policies and Holidays. India team
-- gets the 2026 calendar HR sent and the three statutory leave types
-- (Sick / Personal / Earned) seeded for the TBH India entity.

CREATE TABLE IF NOT EXISTS "public_holidays" (
  "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id"  TEXT         NOT NULL,
  "date"       DATE         NOT NULL,
  "name"       VARCHAR(120) NOT NULL,
  "notes"      TEXT,
  "is_active"  BOOLEAN      NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "public_holidays_entity_id_date_key"
  ON "public_holidays" ("entity_id", "date");

CREATE INDEX IF NOT EXISTS "public_holidays_entity_id_date_idx"
  ON "public_holidays" ("entity_id", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'public_holidays_entity_id_fkey'
  ) THEN
    ALTER TABLE "public_holidays"
      ADD CONSTRAINT "public_holidays_entity_id_fkey"
      FOREIGN KEY ("entity_id") REFERENCES "entities"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 2026 India holiday calendar. ON CONFLICT DO NOTHING keeps the migration
-- idempotent if HR re-uploads the same dates.
INSERT INTO "public_holidays" ("entity_id", "date", "name") VALUES
  ('ent_seed_in', '2026-01-01', 'New Year'),
  ('ent_seed_in', '2026-01-14', 'Makar Sankranti / Pongal'),
  ('ent_seed_in', '2026-01-26', 'Republic Day'),
  ('ent_seed_in', '2026-02-15', 'Maha Shivratri'),
  ('ent_seed_in', '2026-03-19', 'Ugadi'),
  ('ent_seed_in', '2026-03-21', 'Id-ul-Fitr'),
  ('ent_seed_in', '2026-03-31', 'Mahavir Jayanti'),
  ('ent_seed_in', '2026-04-03', 'Good Friday'),
  ('ent_seed_in', '2026-04-14', 'B R Ambedkar Jayanthi'),
  ('ent_seed_in', '2026-05-01', 'Labour Day'),
  ('ent_seed_in', '2026-05-27', 'Id-ul-Zuha (Bakrid)'),
  ('ent_seed_in', '2026-06-26', 'Muharram'),
  ('ent_seed_in', '2026-08-15', 'Independence Day'),
  ('ent_seed_in', '2026-08-26', 'Milad-un-Nabi'),
  ('ent_seed_in', '2026-09-04', 'Krishna Janmasthami'),
  ('ent_seed_in', '2026-09-14', 'Ganesh Chaturthi'),
  ('ent_seed_in', '2026-10-02', 'Gandhi Jayanthi'),
  ('ent_seed_in', '2026-10-20', 'Maha Navami'),
  ('ent_seed_in', '2026-10-21', 'Dussehra (Vijaya Dashmi)'),
  ('ent_seed_in', '2026-11-08', 'Diwali (Tentative)'),
  ('ent_seed_in', '2026-12-25', 'Christmas Day'),
  ('ent_seed_in', '2026-12-31', 'New Year Eve')
ON CONFLICT ("entity_id", "date") DO NOTHING;

-- TBH India leave entitlements (HR spreadsheet columns F–H).
INSERT INTO "leave_types" (
  "id", "entity_id", "name", "code", "description", "category",
  "days_per_year", "requires_approval", "is_paid", "is_active"
) VALUES
  ('ltype_seed_in_sl', 'ent_seed_in', 'Sick Leave',     'SL', '7 days of paid sick leave per year for medical reasons.',                              'sick',   7,  true, true, true),
  ('ltype_seed_in_pl', 'ent_seed_in', 'Personal Leave', 'PL', '5 days of paid personal leave per year for urgent personal matters.',                 'casual', 5,  true, true, true),
  ('ltype_seed_in_el', 'ent_seed_in', 'Earned Leave',   'EL', 'Earned leave accrued at 1 day per month (12 days per year). Carry-over per policy.',  'earned', 12, true, true, true)
ON CONFLICT ("entity_id", "code") DO NOTHING;
