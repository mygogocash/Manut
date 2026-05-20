-- Manut Wave 2 / M3 E3.3 — Pro tier scaffold.
--
-- Adds a `plan` column to `workspaces`. NULL or 'free' = FREE_TIER
-- (2 GB storage / $5 monthly AI), 'pro' = PRO_TIER (100 GB / $50, see
-- `core/quota/tiers.ts`). Defaults to NULL so every existing workspace
-- grandfathers into Free without a data migration — matches the
-- behaviour `QuotaService.getWorkspacePlan` was already simulating
-- with the `undefined` stub since 3a615e858.
--
-- The Stripe webhook handler (plugins/payment/manut-pro-webhook.ts)
-- flips this to 'pro' on `checkout.session.completed` carrying
-- `metadata.manutProUpgrade === 'true'` and back to 'free' on
-- `customer.subscription.deleted` so a cancelled subscription downgrades
-- the workspace cleanly.
--
-- Idempotent per CLAUDE.md §1 Honesty Rule R0: untested critical-path
-- migrations are R0. `ADD COLUMN IF NOT EXISTS` guards a replay.

ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "plan" varchar;
