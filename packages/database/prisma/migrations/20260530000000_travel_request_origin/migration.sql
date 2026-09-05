-- Add `origin` (city/region the traveler departs from) to travel requests.
-- Nullable so existing rows survive the deploy; new submissions enforce
-- non-empty at the API layer.

ALTER TABLE "travel_requests" ADD COLUMN IF NOT EXISTS "origin" TEXT;
