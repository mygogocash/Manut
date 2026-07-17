DO $$
DECLARE
  required_columns text[] := ARRAY[
    'document_snapshot_bucket',
    'document_snapshot_path',
    'document_snapshot_upload_id',
    'document_snapshot_sha256',
    'document_snapshot_size',
    'document_snapshot_mime_type',
    'document_snapshot_file_name',
    'document_snapshot_title',
    'document_snapshot_kind'
  ];
  column_name text;
BEGIN
  FOREACH column_name IN ARRAY required_columns LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'legal_signatures'
        AND information_schema.columns.column_name = column_name
        AND is_nullable = 'NO'
    ) THEN
      RAISE EXCEPTION 'required immutable artifact column % is missing or nullable', column_name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.legal_signatures
    WHERE document_snapshot_sha256 !~ '^[0-9a-f]{64}$'
      OR document_snapshot_size < 0
      OR document_snapshot_bucket = ''
      OR document_snapshot_path = ''
  ) THEN
    RAISE EXCEPTION 'legal signature artifact identity is invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.legal_signatures'::regclass
      AND conname = 'legal_signatures_document_id_fkey'
      AND confdeltype = 'r'
  ) THEN
    RAISE EXCEPTION 'legal signature parent-document retention constraint is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.legal_signatures'::regclass
      AND conname = 'legal_signatures_document_snapshot_upload_id_fkey'
      AND confdeltype = 'r'
  ) THEN
    RAISE EXCEPTION 'legal signature snapshot upload retention constraint is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.legal_signatures'::regclass
      AND conname = 'legal_signatures_document_snapshot_identity_check'
      AND contype = 'c'
  ) THEN
    RAISE EXCEPTION 'legal signature snapshot identity check is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.legal_signatures'::regclass
      AND tgname = 'protect_legal_signature_artifact_trigger'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'legal signature artifact immutability trigger is missing';
  END IF;
END
$$;
