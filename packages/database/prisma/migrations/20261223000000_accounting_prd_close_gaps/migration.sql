-- PRD close-gaps overlay (schema-only). Staging applies via db:push.

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "carrying_rate" DECIMAL(18,8);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "deleted_by" UUID;

ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "deleted_by" UUID;

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "write_off_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "write_off_reason" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "wht_certificate_received_at" TIMESTAMP(3);

ALTER TABLE "file_uploads" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "file_uploads" ADD COLUMN IF NOT EXISTS "deleted_by" UUID;

CREATE INDEX IF NOT EXISTS "file_uploads_deleted_at_idx" ON "file_uploads" ("deleted_at");
