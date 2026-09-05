-- Seed the canonical expense category list so HR doesn't have to
-- create them by hand for every fresh workspace. Mirrors the Zoho
-- Expense default categories that the team is migrating from.
--
-- Idempotent: `ON CONFLICT ("name") DO NOTHING` — re-running the
-- migration is safe and won't duplicate or overwrite categories HR
-- has already customised in prod.

INSERT INTO "expense_categories" ("id", "name", "receipt_required", "is_active")
SELECT gen_random_uuid()::text, c.name, c.rcpt, TRUE
FROM (VALUES
  ('Advance Tax',              FALSE),
  ('Air Travel Expense',       TRUE),
  ('Automobile Expense',       TRUE),
  ('Consultant',               FALSE),
  ('Employee Advance',         FALSE),
  ('Fuel/Mileage Expenses',    TRUE),
  ('Meals & Entertainment',    TRUE),
  ('Accommodation',            TRUE),
  ('Office Supplies',          TRUE),
  ('Other Expenses',           FALSE),
  ('Parking',                  FALSE),
  ('Software & Subscriptions', FALSE),
  ('Telephone Expense',        FALSE),
  ('Travel Expense',           TRUE),
  ('Training & Education',     TRUE),
  ('Visa',                     TRUE)
) AS c(name, rcpt)
ON CONFLICT ("name") DO NOTHING;
