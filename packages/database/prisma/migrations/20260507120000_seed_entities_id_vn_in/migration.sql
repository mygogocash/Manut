-- Backfill TBH Indonesia / Vietnam / India entities so existing prod
-- databases pick them up without a manual reseed. Idempotent via the
-- unique `code` constraint.
INSERT INTO "entities" ("id", "name", "code", "country", "currency", "accounting_std", "is_active", "created_at", "updated_at")
VALUES
  ('ent_seed_id', 'TBH Indonesia', 'ID', 'Indonesia', 'IDR', 'PSAK', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_seed_vn', 'TBH Vietnam',   'VN', 'Vietnam',   'VND', 'VAS',  true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ent_seed_in', 'TBH India',     'IN', 'India',     'INR', 'Ind AS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
