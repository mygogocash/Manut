-- Link a Campaign CRM row to a specific BNII telco partner for DAU/MAU
-- attribution. Nullable + additive; legacy rows keep NULL and fall back to
-- country-level attribution. Idempotent so a partial-apply is safe to re-run.
ALTER TABLE "mkt_campaigns" ADD COLUMN IF NOT EXISTS "partner_id" UUID;

CREATE INDEX IF NOT EXISTS "mkt_campaigns_partner_id_idx" ON "mkt_campaigns" ("partner_id");
