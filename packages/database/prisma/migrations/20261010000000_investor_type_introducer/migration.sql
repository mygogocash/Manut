-- Add "Introducer" to the configurable investor type options (DK request).
-- Idempotent: ON CONFLICT DO NOTHING so it can re-run safely. Slots it
-- just before "Other" by bumping Other only when it's still on the
-- seeded default sort_order (10) — admin reorders are left untouched.

INSERT INTO "investor_type_options" ("key", "label", "sort_order", "updated_at")
VALUES ('introducer', 'Introducer', 10, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

UPDATE "investor_type_options"
SET "sort_order" = 11, "updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'other' AND "sort_order" = 10;
