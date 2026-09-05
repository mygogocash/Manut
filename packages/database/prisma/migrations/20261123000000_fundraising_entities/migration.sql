-- Configurable fundraising vehicles (The Binary Holdings / The Binary Labs)
-- plus a fundraising_entity column on Investor CRM rows. Existing records
-- default to tbh so the live pipeline stays on Holdings.
-- Idempotent: CREATE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS "fundraising_entities" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fundraising_entities_pkey" PRIMARY KEY ("key")
);
CREATE INDEX IF NOT EXISTS "fundraising_entities_sort_order_idx" ON "fundraising_entities"("sort_order");

INSERT INTO "fundraising_entities" ("key", "label", "sort_order", "updated_at") VALUES
    ('tbh', 'The Binary Holdings', 0, CURRENT_TIMESTAMP),
    ('tbl', 'The Binary Labs', 1, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

ALTER TABLE "investors" ADD COLUMN IF NOT EXISTS "fundraising_entity" TEXT NOT NULL DEFAULT 'tbh';
CREATE INDEX IF NOT EXISTS "investors_fundraising_entity_idx" ON "investors"("fundraising_entity");

ALTER TABLE "investor_leads" ADD COLUMN IF NOT EXISTS "fundraising_entity" TEXT NOT NULL DEFAULT 'tbh';
CREATE INDEX IF NOT EXISTS "investor_leads_fundraising_entity_idx" ON "investor_leads"("fundraising_entity");

ALTER TABLE "investor_accounts" ADD COLUMN IF NOT EXISTS "fundraising_entity" TEXT NOT NULL DEFAULT 'tbh';
CREATE INDEX IF NOT EXISTS "investor_accounts_fundraising_entity_idx" ON "investor_accounts"("fundraising_entity");

ALTER TABLE "investor_contacts" ADD COLUMN IF NOT EXISTS "fundraising_entity" TEXT NOT NULL DEFAULT 'tbh';
CREATE INDEX IF NOT EXISTS "investor_contacts_fundraising_entity_idx" ON "investor_contacts"("fundraising_entity");
