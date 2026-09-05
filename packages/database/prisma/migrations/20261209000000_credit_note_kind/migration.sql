-- M4 — Statutory Debit Notes: add a credit/debit discriminator to credit_notes.
--
-- Thai VAT recognises two adjustment documents: a credit note (ใบลดหนี้) that
-- REDUCES a previously invoiced amount, and a debit note (ใบเพิ่มหนี้) that
-- INCREASES it. The table only modelled credit notes; this column lets the same
-- infra carry both. The credit/debit axis is orthogonal to the existing `type`
-- (receivable vs payable side), giving all four combinations. The posting sign
-- is chosen from (type, note_kind) in the service; the numbering series switches
-- to the "debit-note" (DN-) sequence when note_kind = 'debit'.
--
-- ADDITIVE + IDEMPOTENT (safe to re-run after a P3009 partial apply):
--   * ADD COLUMN IF NOT EXISTS with a DEFAULT, so every existing row is a
--     'credit' note and no back-fill statement is required.

ALTER TABLE "credit_notes"
  ADD COLUMN IF NOT EXISTS "note_kind" TEXT NOT NULL DEFAULT 'credit';
