-- BD-feedback round 7 (May 2026) — seed a 2-layer default approval
-- chain for Expense and Travel so HR doesn't have to configure it
-- manually post-deploy. Layer 1 is the submitter's direct manager
-- (existing fallback behaviour). Layer 2 is the skip-level manager
-- via the new `manager_l2` approverType — resolved per-submission and
-- silently skipped for users at the top of the org chart.
--
-- Insert is gated on each table being empty so this migration is
-- idempotent AND a no-op for environments where HR has already
-- configured a custom chain. Safe to re-run.

INSERT INTO "expense_approval_steps"
  ("order", "name", "description", "approver_type", "approver_user_id", "is_active")
SELECT 1, 'Direct Manager', 'Submitter''s line manager (reportingTo).', 'manager', NULL, TRUE
WHERE NOT EXISTS (SELECT 1 FROM "expense_approval_steps");

INSERT INTO "expense_approval_steps"
  ("order", "name", "description", "approver_type", "approver_user_id", "is_active")
SELECT 2, 'Skip-Level Manager', 'Submitter''s manager''s manager. Auto-skipped if the org chart has no second layer.', 'manager_l2', NULL, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM "expense_approval_steps" WHERE "order" = 2
)
AND EXISTS (
  -- Only seed L2 when L1 was just seeded — protects custom chains
  -- where HR has a single Step 1 they want to keep.
  SELECT 1 FROM "expense_approval_steps"
  WHERE "order" = 1 AND "approver_type" = 'manager' AND "name" = 'Direct Manager'
);

INSERT INTO "travel_approval_steps"
  ("order", "name", "description", "approver_type", "approver_user_id", "is_active")
SELECT 1, 'Direct Manager', 'Submitter''s line manager (reportingTo).', 'manager', NULL, TRUE
WHERE NOT EXISTS (SELECT 1 FROM "travel_approval_steps");

INSERT INTO "travel_approval_steps"
  ("order", "name", "description", "approver_type", "approver_user_id", "is_active")
SELECT 2, 'Skip-Level Manager', 'Submitter''s manager''s manager. Auto-skipped if the org chart has no second layer.', 'manager_l2', NULL, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM "travel_approval_steps" WHERE "order" = 2
)
AND EXISTS (
  SELECT 1 FROM "travel_approval_steps"
  WHERE "order" = 1 AND "approver_type" = 'manager' AND "name" = 'Direct Manager'
);
