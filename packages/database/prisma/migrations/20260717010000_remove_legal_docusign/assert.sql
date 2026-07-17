DO $$
BEGIN
  IF to_regclass('public.legal_signatures') IS NULL THEN
    RAISE EXCEPTION 'legal_signatures was removed';
  END IF;

  IF to_regclass('public.user_docusign_connections') IS NOT NULL THEN
    RAISE EXCEPTION 'user_docusign_connections still exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'legal_signatures'
      AND column_name IN (
        'provider',
        'docusign_envelope_id',
        'docusign_signer_status'
      )
  ) THEN
    RAISE EXCEPTION 'retired legal-provider columns still exist';
  END IF;

  IF to_regclass('public.legal_signatures_docusign_envelope_id_idx') IS NOT NULL THEN
    RAISE EXCEPTION 'retired legal-provider index still exists';
  END IF;

  IF (
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'legal_signatures'
      AND column_name IN (
        'document_id',
        'token',
        'signing_order',
        'signed_at',
        'signature_text',
        'signature_method',
        'signed_ip',
        'signed_user_agent',
        'signed_pdf_url'
      )
  ) <> 9 THEN
    RAISE EXCEPTION 'retained legal-signature evidence columns are missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.role_permissions
    WHERE permission_code = 'legal:sign-docusign-admin'
  ) THEN
    RAISE EXCEPTION 'retired legal-provider permission assignment still exists';
  END IF;
END
$$;
