DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'legal_documents'
      AND column_name = 'current_signing_batch_id'
      AND data_type = 'uuid'
  ) THEN
    RAISE EXCEPTION 'legal_documents.current_signing_batch_id is missing or not uuid';
  END IF;

  IF to_regclass('public.legal_documents_current_signing_batch_id_idx') IS NULL THEN
    RAISE EXCEPTION 'current legal signature batch index is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.legal_documents AS document
    WHERE document.current_signing_batch_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.legal_signatures AS signature
        WHERE signature.document_id = document.id
          AND signature.batch_id = document.current_signing_batch_id
      )
  ) THEN
    RAISE EXCEPTION 'a document points at a signing batch it does not own';
  END IF;
END
$$;
