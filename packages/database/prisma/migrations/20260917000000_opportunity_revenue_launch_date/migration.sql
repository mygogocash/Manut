-- Sales CRM — add `revenue_launch_date` on opportunities. Reps set
-- it when the deal starts earning revenue, separate from `launch_date`
-- (which marks the soft / product launch). Surfaced as a rollup
-- column on the Accounts grid via opportunities[0].revenueLaunchDate
-- the same way `launchDate` already is.

ALTER TABLE "crm_opportunities"
ADD COLUMN IF NOT EXISTS "revenue_launch_date" DATE;
