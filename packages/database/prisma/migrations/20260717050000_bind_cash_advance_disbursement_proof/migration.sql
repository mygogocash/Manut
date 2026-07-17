BEGIN;

SET LOCAL lock_timeout = '5s';

-- Freeze upload-registry writes before taking the request-table lock. Runtime
-- proof commits lock in the same upload-first order, avoiding a lock inversion.
LOCK TABLE public.file_uploads IN SHARE MODE;
LOCK TABLE public.cash_advance_requests IN ACCESS EXCLUSIVE MODE;

ALTER TABLE public.cash_advance_requests
  ADD COLUMN IF NOT EXISTS disbursement_proof_upload_id uuid;

-- Historical rows can be bound only when their canonical storage URL resolves
-- to one unambiguous registry row already carrying the cash-advance purpose and
-- request link. Anything else is retained for operator resolution and rejected
-- below instead of guessing which file is payout evidence.
WITH candidate_uploads AS (
  SELECT
    request.id AS request_id,
    upload.id AS upload_id,
    count(*) OVER (PARTITION BY request.id) AS candidate_count
  FROM public.cash_advance_requests AS request
  INNER JOIN public.file_uploads AS upload
    ON upload.bucket = 'documents'
    AND upload.path <> ''
    AND upload.purpose = 'cash-advance-disbursement-proof'
    AND upload.linked_to = 'cash-advance'
    AND upload.linked_id = request.id::text
    AND (
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
  WHERE request.disbursement_proof_url IS NOT NULL
    AND request.disbursement_proof_upload_id IS NULL
), unambiguous_uploads AS (
  SELECT request_id, upload_id
  FROM candidate_uploads
  WHERE candidate_count = 1
)
UPDATE public.cash_advance_requests AS request
SET disbursement_proof_upload_id = candidate.upload_id
FROM unambiguous_uploads AS candidate
WHERE request.id = candidate.request_id
  AND request.disbursement_proof_upload_id IS NULL;

DO $$
DECLARE
  invalid_count bigint;
BEGIN
  SELECT count(*)
  INTO invalid_count
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
    );

  IF invalid_count > 0 THEN
    RAISE EXCEPTION
      '% cash-advance proof row(s) cannot be safely bound to registered uploads; resolve them before applying this migration',
      invalid_count;
  END IF;
END
$$;

DROP INDEX IF EXISTS public.cash_advance_requests_disbursement_proof_upload_id_idx;
CREATE UNIQUE INDEX IF NOT EXISTS cash_advance_requests_disbursement_proof_upload_id_key
  ON public.cash_advance_requests (disbursement_proof_upload_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index
    WHERE indexrelid =
      'public.cash_advance_requests_disbursement_proof_upload_id_key'::regclass
      AND indrelid = 'public.cash_advance_requests'::regclass
      AND indisunique
  ) THEN
    RAISE EXCEPTION 'cash-advance proof upload index exists but is not the required unique request index';
  END IF;
END
$$;

ALTER TABLE public.cash_advance_requests
  DROP CONSTRAINT IF EXISTS cash_advance_requests_disbursement_proof_upload_id_fkey;
ALTER TABLE public.cash_advance_requests
  ADD CONSTRAINT cash_advance_requests_disbursement_proof_upload_id_fkey
  FOREIGN KEY (disbursement_proof_upload_id)
  REFERENCES public.file_uploads(id)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE public.cash_advance_requests
  DROP CONSTRAINT IF EXISTS cash_advance_requests_disbursement_proof_binding_check;
ALTER TABLE public.cash_advance_requests
  ADD CONSTRAINT cash_advance_requests_disbursement_proof_binding_check
  CHECK (
    (disbursement_proof_url IS NULL AND disbursement_proof_upload_id IS NULL)
    OR (
      disbursement_proof_url IS NOT NULL
      AND disbursement_proof_upload_id IS NOT NULL
    )
  );

COMMIT;
