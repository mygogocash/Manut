-- TBH India onboarding needs Aadhaar + PAN card numbers per employee.
-- Pure additive nullable columns; legacy rows stay NULL until HR fills
-- them. Idempotent so re-runs are safe.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "aadhaar_number" TEXT,
  ADD COLUMN IF NOT EXISTS "pan_card_number" TEXT;
