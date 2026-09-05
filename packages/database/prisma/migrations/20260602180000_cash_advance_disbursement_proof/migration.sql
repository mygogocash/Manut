-- Finance must attach a payout proof (PDF, spreadsheet, or image)
-- before marking a cash-advance request as disbursed.

ALTER TABLE "cash_advance_requests"
  ADD COLUMN IF NOT EXISTS "disbursement_proof_url" TEXT;
