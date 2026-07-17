DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cash_advance_requests'
      AND column_name = 'disbursement_proof_upload_id'
      AND data_type = 'uuid'
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'cash-advance disbursement proof upload binding is missing or malformed';
  END IF;

  IF to_regclass(
    'public.cash_advance_requests_disbursement_proof_upload_id_key'
  ) IS NULL THEN
    RAISE EXCEPTION 'cash-advance disbursement proof unique index is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_index
    WHERE indexrelid =
      'public.cash_advance_requests_disbursement_proof_upload_id_key'::regclass
      AND indisunique
  ) THEN
    RAISE EXCEPTION 'cash-advance disbursement proof upload index is not unique';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.cash_advance_requests'::regclass
      AND conname = 'cash_advance_requests_disbursement_proof_upload_id_fkey'
      AND confrelid = 'public.file_uploads'::regclass
      AND confdeltype = 'r'
      AND confupdtype = 'c'
  ) THEN
    RAISE EXCEPTION 'cash-advance proof upload retention constraint is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.cash_advance_requests'::regclass
      AND conname = 'cash_advance_requests_disbursement_proof_binding_check'
      AND contype = 'c'
  ) THEN
    RAISE EXCEPTION 'cash-advance proof URL/upload pairing constraint is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cash_advance_requests AS request
    LEFT JOIN public.file_uploads AS upload
      ON upload.id = request.disbursement_proof_upload_id
    WHERE
      (
        request.disbursement_proof_url IS NULL
        AND request.disbursement_proof_upload_id IS NOT NULL
      )
      OR (
        request.disbursement_proof_url IS NOT NULL
        AND (
          request.disbursement_proof_upload_id IS NULL
          OR upload.id IS NULL
          OR upload.bucket IS DISTINCT FROM 'documents'
          OR upload.path = ''
          OR upload.purpose IS DISTINCT FROM 'cash-advance-disbursement-proof'
          OR upload.linked_to IS DISTINCT FROM 'cash-advance'
          OR upload.linked_id IS DISTINCT FROM request.id::text
          OR NOT (
            split_part(
              split_part(
                request.disbursement_proof_url,
                '/storage/v1/object/public/documents/',
                2
              ),
              '?',
              1
            ) = upload.path
            OR split_part(
              split_part(
                request.disbursement_proof_url,
                '/storage/v1/object/sign/documents/',
                2
              ),
              '?',
              1
            ) = upload.path
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'cash-advance proof rows are not bound to exact registered uploads';
  END IF;
END
$$;
