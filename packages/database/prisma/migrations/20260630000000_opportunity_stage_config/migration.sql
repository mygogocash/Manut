-- Admin-configurable per-stage label + auto-fill probability for
-- Opportunity. Seeds the 5 canonical stages with PRD §11.4 defaults
-- so the table is non-empty before any admin opens the manager dialog.
-- Idempotent CREATE TABLE / INSERT so partial-apply re-runs are safe.
CREATE TABLE IF NOT EXISTS "opportunity_stage_config" (
  "key"         TEXT         NOT NULL,
  "label"       TEXT         NOT NULL,
  "probability" INTEGER      NOT NULL DEFAULT 0,
  "sort_order"  INTEGER      NOT NULL DEFAULT 0,
  "color"       TEXT         NOT NULL DEFAULT 'border-t-zinc-500',
  "updated_at"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "opportunity_stage_config_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "opportunity_stage_config_sort_order_idx"
  ON "opportunity_stage_config" ("sort_order");

INSERT INTO "opportunity_stage_config"
  ("key", "label", "probability", "sort_order", "color", "updated_at")
VALUES
  ('qualified',   'Qualified',   20,  10, 'border-t-blue-500',   CURRENT_TIMESTAMP),
  ('proposal',    'Proposal',    40,  20, 'border-t-amber-500',  CURRENT_TIMESTAMP),
  ('negotiation', 'Negotiation', 60,  30, 'border-t-orange-500', CURRENT_TIMESTAMP),
  ('closed_won',  'Closed Won',  100, 40, 'border-t-green-600',  CURRENT_TIMESTAMP),
  ('closed_lost', 'Closed Lost', 0,   50, 'border-t-red-500',    CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
