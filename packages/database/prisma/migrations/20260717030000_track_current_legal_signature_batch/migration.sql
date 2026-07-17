BEGIN;

SET LOCAL lock_timeout = '5s';
LOCK TABLE public.legal_documents IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.legal_signatures IN SHARE MODE;

ALTER TABLE public.legal_documents
  ADD COLUMN IF NOT EXISTS current_signing_batch_id uuid;

WITH latest_batches AS MATERIALIZED (
  SELECT DISTINCT ON (document_id)
    document_id,
    batch_id
  FROM public.legal_signatures
  ORDER BY document_id, created_at DESC, id DESC
)
UPDATE public.legal_documents AS document
SET current_signing_batch_id = latest_batches.batch_id
FROM latest_batches
WHERE document.id = latest_batches.document_id
  AND document.current_signing_batch_id IS NULL;

CREATE INDEX IF NOT EXISTS legal_documents_current_signing_batch_id_idx
  ON public.legal_documents (current_signing_batch_id);

COMMIT;
