-- Campaign CRM: free-text "Levers Pulled (Sequence)" + "Copy" text (designs
-- remain in the versioned creatives table). Idempotent.

ALTER TABLE "mkt_campaigns" ADD COLUMN IF NOT EXISTS "levers_sequence" TEXT;
ALTER TABLE "mkt_campaigns" ADD COLUMN IF NOT EXISTS "copy_text" TEXT;
