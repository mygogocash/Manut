-- Investor CRM Leads + Accounts + Contacts (Investor CRM Phase 2, slice 2).
-- Idempotent: CREATE ... IF NOT EXISTS + guarded constraint adds.

CREATE TABLE IF NOT EXISTS "investor_leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "investor_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "investor_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "website" TEXT,
    "location" TEXT,
    "region" TEXT,
    "notes" TEXT,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "investor_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "investor_contacts" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "account_id" TEXT,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "investor_contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "investor_leads_owner_id_status_idx" ON "investor_leads"("owner_id", "status");
CREATE INDEX IF NOT EXISTS "investor_accounts_owner_id_idx" ON "investor_accounts"("owner_id");
CREATE INDEX IF NOT EXISTS "investor_contacts_owner_id_idx" ON "investor_contacts"("owner_id");
CREATE INDEX IF NOT EXISTS "investor_contacts_account_id_idx" ON "investor_contacts"("account_id");

DO $$ BEGIN
  ALTER TABLE "investor_leads" ADD CONSTRAINT "investor_leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "investor_accounts" ADD CONSTRAINT "investor_accounts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "investor_contacts" ADD CONSTRAINT "investor_contacts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "investor_contacts" ADD CONSTRAINT "investor_contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "investor_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
