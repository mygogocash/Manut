BEGIN;

SET LOCAL lock_timeout = '5s';
LOCK TABLE public.legal_signatures IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  has_provider_column boolean;
  has_envelope_column boolean;
  has_signer_status_column boolean;
  has_external_evidence boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'legal_signatures'
      AND column_name = 'provider'
  ) INTO has_provider_column;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'legal_signatures'
      AND column_name = 'docusign_envelope_id'
  ) INTO has_envelope_column;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'legal_signatures'
      AND column_name = 'docusign_signer_status'
  ) INTO has_signer_status_column;

  IF has_provider_column OR has_envelope_column OR has_signer_status_column THEN
    EXECUTE
      'SELECT EXISTS (
         SELECT 1
         FROM public.legal_signatures AS signature
         WHERE ($1 AND (to_jsonb(signature) ->> ''provider'') IS DISTINCT FROM ''inhouse'')
            OR ($2 AND (to_jsonb(signature) ->> ''docusign_envelope_id'') IS NOT NULL)
            OR ($3 AND (to_jsonb(signature) ->> ''docusign_signer_status'') IS NOT NULL)
       )'
      INTO has_external_evidence
      USING has_provider_column, has_envelope_column, has_signer_status_column;

    IF has_external_evidence THEN
      RAISE EXCEPTION
        'external-provider legal-signature evidence exists; export and resolve it before removing provider metadata';
    END IF;
  END IF;
END
$$;

DELETE FROM public.role_permissions
WHERE permission_code = 'legal:sign-docusign-admin';

DROP TABLE IF EXISTS public.user_docusign_connections;
DROP INDEX IF EXISTS public.legal_signatures_docusign_envelope_id_idx;

ALTER TABLE public.legal_signatures
  DROP COLUMN IF EXISTS provider,
  DROP COLUMN IF EXISTS docusign_envelope_id,
  DROP COLUMN IF EXISTS docusign_signer_status;

COMMIT;
