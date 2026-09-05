-- Backfill TBH Bangladesh entity so existing prod databases pick it up
-- without a manual reseed. Idempotent via the unique `code` constraint.
INSERT INTO "entities" ("id", "name", "code", "country", "currency", "accounting_std", "is_active", "created_at", "updated_at")
VALUES
  ('ent_seed_bd', 'TBH Bangladesh', 'BD', 'Bangladesh', 'BDT', 'BFRS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
