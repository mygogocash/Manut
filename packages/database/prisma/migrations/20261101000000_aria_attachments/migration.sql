-- ARIA chat attachments (image / document / video). Idempotent.
CREATE TABLE IF NOT EXISTS "aria_attachments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "message_id" UUID,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "storage_bucket" TEXT NOT NULL,
  "storage_path" TEXT NOT NULL,
  "extracted_text" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ready',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "aria_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "aria_attachments_user_id_idx" ON "aria_attachments" ("user_id");
CREATE INDEX IF NOT EXISTS "aria_attachments_message_id_idx" ON "aria_attachments" ("message_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aria_attachments_user_id_fkey') THEN
    ALTER TABLE "aria_attachments" ADD CONSTRAINT "aria_attachments_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aria_attachments_message_id_fkey') THEN
    ALTER TABLE "aria_attachments" ADD CONSTRAINT "aria_attachments_message_id_fkey"
      FOREIGN KEY ("message_id") REFERENCES "aria_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
