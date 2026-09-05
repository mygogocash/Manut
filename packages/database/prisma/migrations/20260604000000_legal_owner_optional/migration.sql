-- Legal team feedback (Juthamas, May 2026): allow legal documents
-- without an owner so the form can be saved without picking a
-- specific person. Drops the NOT NULL on owner_id and switches the
-- FK to ON DELETE SET NULL so deleting a user no longer blocks
-- referenced legal rows. Idempotent so partial-apply retries are safe.

ALTER TABLE "legal_documents"
  ALTER COLUMN "owner_id" DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'legal_documents_owner_id_fkey'
  ) THEN
    ALTER TABLE "legal_documents" DROP CONSTRAINT "legal_documents_owner_id_fkey";
  END IF;

  ALTER TABLE "legal_documents"
    ADD CONSTRAINT "legal_documents_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
END $$;
