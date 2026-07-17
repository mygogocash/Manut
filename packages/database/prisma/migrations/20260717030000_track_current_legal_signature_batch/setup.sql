DO $$
BEGIN
  IF to_regclass('public.legal_documents') IS NULL THEN
    RAISE EXCEPTION 'required table public.legal_documents is missing';
  END IF;

  IF to_regclass('public.legal_signatures') IS NULL THEN
    RAISE EXCEPTION 'required table public.legal_signatures is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'legal_signatures'
      AND column_name = 'batch_id'
  ) THEN
    RAISE EXCEPTION 'legal_signatures.batch_id must exist first';
  END IF;
END
$$;
