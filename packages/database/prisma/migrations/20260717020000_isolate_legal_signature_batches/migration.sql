BEGIN;

SET LOCAL lock_timeout = '5s';
LOCK TABLE public.legal_signatures IN ACCESS EXCLUSIVE MODE;

ALTER TABLE public.legal_signatures
  ADD COLUMN IF NOT EXISTS batch_id uuid;

WITH document_batches AS MATERIALIZED (
  SELECT document_id, gen_random_uuid() AS batch_id
  FROM public.legal_signatures
  WHERE batch_id IS NULL
  GROUP BY document_id
)
UPDATE public.legal_signatures AS signature
SET batch_id = document_batches.batch_id
FROM document_batches
WHERE signature.document_id = document_batches.document_id
  AND signature.batch_id IS NULL;

ALTER TABLE public.legal_signatures
  ALTER COLUMN batch_id DROP DEFAULT,
  ALTER COLUMN batch_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS legal_signatures_document_id_batch_id_idx
  ON public.legal_signatures (document_id, batch_id);

COMMIT;
