-- Benefits had no created_at / updated_at columns, which meant the list
-- could only be sorted alphabetically. HR complained that newly-created
-- plans didn't show up — the row landed wherever the alphabet placed it
-- (often page 2+). Add timestamps so we can sort newest-first.
ALTER TABLE "benefits"
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
