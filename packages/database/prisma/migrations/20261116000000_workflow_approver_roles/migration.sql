-- Create the four workflow approver roles and grant their permissions.
--
-- Completes the set alongside `Project Requester` (20261114000000). Until this
-- runs, no role holds any workflow:* code and the approval chain is Admin-only.
--
-- Every approver gets `projects:read-all`, NOT `projects:read`. Plain
-- `projects:read` scopes the list to projects you own or are a member of, so an
-- approver who was not added as a member could receive the approval email,
-- follow the link, and find nothing there. Approving is inherently a
-- see-everything job; membership is the wrong gate for it.
--
-- The Project Manager is the workflow owner and keeps operational authority for
-- the whole lifecycle — including after the Business Head and Product Admin
-- have approved. It deliberately does NOT receive their approval codes:
-- separation of duties is what makes a three-tier chain worth having.
--
-- Nobody is assigned to these roles here. Membership is an access decision and
-- belongs in Admin → Users, where it is captured in the audit log.
--
-- Idempotent: safe to re-run.

-- ── Roles ───────────────────────────────────────────────────────────────
-- `updated_at` is Prisma-managed (@updatedAt) so it has NO database default;
-- raw SQL must set it or the NOT NULL constraint fails.
INSERT INTO "roles" ("name", "description", "is_system", "updated_at")
SELECT r.name, r.description, false, now()
FROM (VALUES
  ('Project Manager',
   'Workflow owner. Approves at the PM stage, returns and reopens requests, and manages timelines, progress and assignment for the whole lifecycle.'),
  ('Business Head',
   'Approves or rejects project requests at the Business Head stage.'),
  ('Product Admin',
   'Gives the final approval on project requests before development.'),
  ('Development Team',
   'Sets delivery timelines and updates implementation progress on approved projects.')
) AS r(name, description)
WHERE NOT EXISTS (SELECT 1 FROM "roles" x WHERE x."name" = r.name);

UPDATE "roles" SET "deleted_at" = NULL, "updated_at" = now()
WHERE "name" IN ('Project Manager', 'Business Head', 'Product Admin', 'Development Team')
  AND "deleted_at" IS NOT NULL;

-- ── Grants ──────────────────────────────────────────────────────────────
INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, g.code
FROM "roles" r
JOIN (VALUES
  -- Project Manager — workflow owner.
  ('Project Manager', 'projects:read-all'),
  ('Project Manager', 'projects:create'),
  ('Project Manager', 'projects:update'),
  ('Project Manager', 'workflow:pm-approve'),
  ('Project Manager', 'workflow:return'),
  ('Project Manager', 'workflow:reopen'),
  ('Project Manager', 'workflow:complete'),
  ('Project Manager', 'workflow:archive'),
  ('Project Manager', 'workflow:escalate'),
  ('Project Manager', 'workflow:reassign'),
  ('Project Manager', 'workflow:timeline-manage'),
  ('Project Manager', 'workflow:progress-update'),

  -- Business Head — decides at its own stage, nothing more.
  ('Business Head', 'projects:read-all'),
  ('Business Head', 'workflow:business-head-approve'),

  -- Product Admin — final approval only.
  ('Product Admin', 'projects:read-all'),
  ('Product Admin', 'workflow:product-admin-approve'),

  -- Development Team — delivery, no approval authority.
  ('Development Team', 'projects:read-all'),
  ('Development Team', 'projects:update'),
  ('Development Team', 'workflow:timeline-manage'),
  ('Development Team', 'workflow:progress-update')
) AS g(role_name, code) ON g.role_name = r."name"
ON CONFLICT ("role_id", "permission_code") DO NOTHING;
