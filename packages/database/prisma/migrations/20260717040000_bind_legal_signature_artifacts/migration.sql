BEGIN;

SET LOCAL lock_timeout = '5s';
LOCK TABLE public.legal_signatures IN ACCESS EXCLUSIVE MODE;

-- A cryptographic artifact identity cannot be reconstructed from historical
-- database rows alone. Refuse to create apparently valid evidence rather than
-- silently binding an old signature to whichever mutable file exists today.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'legal_signatures'
      AND column_name = 'document_snapshot_sha256'
  ) AND EXISTS (SELECT 1 FROM public.legal_signatures) THEN
    RAISE EXCEPTION
      'legal signatures exist without immutable artifact hashes; export and resolve them before applying this migration';
  END IF;
END
$$;

ALTER TABLE public.legal_signatures
  ADD COLUMN IF NOT EXISTS document_snapshot_bucket text,
  ADD COLUMN IF NOT EXISTS document_snapshot_path text,
  ADD COLUMN IF NOT EXISTS document_snapshot_upload_id uuid,
  ADD COLUMN IF NOT EXISTS document_snapshot_sha256 varchar(64),
  ADD COLUMN IF NOT EXISTS document_snapshot_size integer,
  ADD COLUMN IF NOT EXISTS document_snapshot_mime_type text,
  ADD COLUMN IF NOT EXISTS document_snapshot_file_name text,
  ADD COLUMN IF NOT EXISTS document_snapshot_title text,
  ADD COLUMN IF NOT EXISTS document_snapshot_kind text;

ALTER TABLE public.legal_signatures
  ALTER COLUMN document_snapshot_bucket SET NOT NULL,
  ALTER COLUMN document_snapshot_path SET NOT NULL,
  ALTER COLUMN document_snapshot_upload_id SET NOT NULL,
  ALTER COLUMN document_snapshot_sha256 SET NOT NULL,
  ALTER COLUMN document_snapshot_size SET NOT NULL,
  ALTER COLUMN document_snapshot_mime_type SET NOT NULL,
  ALTER COLUMN document_snapshot_file_name SET NOT NULL,
  ALTER COLUMN document_snapshot_title SET NOT NULL,
  ALTER COLUMN document_snapshot_kind SET NOT NULL;

CREATE INDEX IF NOT EXISTS legal_signatures_document_snapshot_upload_id_idx
  ON public.legal_signatures (document_snapshot_upload_id);

-- Signed evidence must keep its parent document in every environment. The
-- baseline used CASCADE, which could still be reproduced by `prisma db push`
-- even though the trigger below blocks deletes in migration-managed databases.
ALTER TABLE public.legal_signatures
  DROP CONSTRAINT IF EXISTS legal_signatures_document_id_fkey;
ALTER TABLE public.legal_signatures
  ADD CONSTRAINT legal_signatures_document_id_fkey
  FOREIGN KEY (document_id)
  REFERENCES public.legal_documents(id)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

DO $$
BEGIN
  ALTER TABLE public.legal_signatures
    ADD CONSTRAINT legal_signatures_document_snapshot_upload_id_fkey
    FOREIGN KEY (document_snapshot_upload_id)
    REFERENCES public.file_uploads(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE public.legal_signatures
    ADD CONSTRAINT legal_signatures_document_snapshot_identity_check
    CHECK (
      document_snapshot_bucket = 'documents'
      AND document_snapshot_path <> ''
      AND document_snapshot_sha256 ~ '^[0-9a-f]{64}$'
      AND document_snapshot_size >= 0
      AND document_snapshot_mime_type <> ''
      AND document_snapshot_file_name <> ''
      AND document_snapshot_title <> ''
      AND document_snapshot_kind <> ''
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.protect_legal_signature_artifact()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'legal signature evidence cannot be deleted';
  END IF;

  IF NEW.document_snapshot_bucket IS DISTINCT FROM OLD.document_snapshot_bucket
    OR NEW.document_snapshot_path IS DISTINCT FROM OLD.document_snapshot_path
    OR NEW.document_snapshot_upload_id IS DISTINCT FROM OLD.document_snapshot_upload_id
    OR NEW.document_snapshot_sha256 IS DISTINCT FROM OLD.document_snapshot_sha256
    OR NEW.document_snapshot_size IS DISTINCT FROM OLD.document_snapshot_size
    OR NEW.document_snapshot_mime_type IS DISTINCT FROM OLD.document_snapshot_mime_type
    OR NEW.document_snapshot_file_name IS DISTINCT FROM OLD.document_snapshot_file_name
    OR NEW.document_snapshot_title IS DISTINCT FROM OLD.document_snapshot_title
    OR NEW.document_snapshot_kind IS DISTINCT FROM OLD.document_snapshot_kind
  THEN
    RAISE EXCEPTION 'legal signature artifact identity is immutable';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS protect_legal_signature_artifact_trigger
  ON public.legal_signatures;
CREATE TRIGGER protect_legal_signature_artifact_trigger
  BEFORE UPDATE OR DELETE ON public.legal_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_legal_signature_artifact();

COMMIT;
