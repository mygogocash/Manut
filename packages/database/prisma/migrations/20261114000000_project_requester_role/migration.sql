-- Create the "Project Requester" role and grant it what raising a request needs.
--
-- A request IS a project: you create the project, then submit it into the
-- approval chain. So a requester needs three codes, not one:
--
--   projects:read    — see the Projects module at all
--   projects:create  — create the project that becomes the request
--   workflow:submit  — submit it, and edit it while it is still a draft
--
-- Without `projects:create` the Submit button is unreachable, because there is
-- nothing to submit. That is the state every non-Admin was in: the Employee
-- role holds only `projects:read`.
--
-- This migration deliberately does NOT assign the role to anyone. Who may raise
-- a request is an access decision, and the department values in this database
-- are not a reliable basis for it (job titles and departments disagree, and
-- there is no "Project" department). Assign it per person in Admin → Users, or
-- with the statement at the bottom of this file.
--
-- Idempotent: safe to re-run.

-- `updated_at` is Prisma-managed (@updatedAt) and therefore has NO database
-- default, so raw SQL must set it explicitly or the NOT NULL constraint fails.
INSERT INTO "roles" ("name", "description", "is_system", "updated_at")
SELECT
  'Project Requester',
  'Can raise project requests and submit them into the approval workflow.',
  false,
  now()
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "name" = 'Project Requester');

-- Undelete if it was previously soft-deleted, so re-running restores it.
UPDATE "roles" SET "deleted_at" = NULL, "updated_at" = now()
WHERE "name" = 'Project Requester' AND "deleted_at" IS NOT NULL;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, c.code
FROM "roles" r
CROSS JOIN (VALUES
  ('projects:read'),
  ('projects:create'),
  ('workflow:submit')
) AS c(code)
WHERE r."name" = 'Project Requester'
ON CONFLICT ("role_id", "permission_code") DO NOTHING;

-- ── Assigning people ────────────────────────────────────────────────────
--
-- Preferred: Admin → Users in the app, so the change is captured in the audit
-- log with an acting user.
--
-- Otherwise, edit and run this by hand. It is commented out on purpose —
-- granting write access should be a deliberate act, not a side effect of a
-- deploy.
--
-- INSERT INTO "user_roles" ("user_id", "role_id")
-- SELECT u.id, r.id
-- FROM "users" u
-- CROSS JOIN "roles" r
-- WHERE r."name" = 'Project Requester'
--   AND u."is_active"
--   AND u."email" IN (
--     'someone@thebinaryholdings.com',
--     'someone.else@thebinaryholdings.com'
--   )
-- ON CONFLICT DO NOTHING;
