DO $$
BEGIN
  IF to_regclass('public.cash_advance_requests') IS NULL THEN
    RAISE EXCEPTION 'required table public.cash_advance_requests is missing';
  END IF;

  IF to_regclass('public.file_uploads') IS NULL THEN
    RAISE EXCEPTION 'required table public.file_uploads is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cash_advance_requests'
      AND column_name = 'disbursement_proof_url'
  ) THEN
    RAISE EXCEPTION 'cash_advance_requests.disbursement_proof_url is missing';
  END IF;

  IF (
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'file_uploads'
      AND column_name IN (
        'id',
        'bucket',
        'path',
        'purpose',
        'linked_to',
        'linked_id',
        'uploaded_by'
      )
  ) <> 7 THEN
    RAISE EXCEPTION 'file_uploads is missing proof-binding columns';
  END IF;
END
$$;
