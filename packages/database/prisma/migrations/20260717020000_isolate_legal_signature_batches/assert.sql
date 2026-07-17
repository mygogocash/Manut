DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'legal_signatures'
      AND column_name = 'batch_id'
      AND data_type = 'uuid'
      AND is_nullable = 'NO'
      AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'legal_signatures.batch_id is missing, nullable, defaulted, or not uuid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.legal_signatures
    WHERE batch_id IS NULL
  ) THEN
    RAISE EXCEPTION 'legal signature rows remain without a batch boundary';
  END IF;

  IF to_regclass('public.legal_signatures_document_id_batch_id_idx') IS NULL THEN
    RAISE EXCEPTION 'legal signature batch index is missing';
  END IF;
END
$$;
