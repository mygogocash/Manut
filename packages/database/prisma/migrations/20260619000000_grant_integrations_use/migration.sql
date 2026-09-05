-- Grant `integrations:use` to every existing role so Gmail / Drive
-- connect buttons work for HR, Employee, and any custom roles.
-- Originally the permission was only seeded onto the Admin role,
-- which left HR (Tanatsha's role) hitting a 404 from
-- ProtectedRoute when clicking the sidebar entry.
--
-- Idempotent: WHERE NOT EXISTS guard so this can re-run after a
-- partial-apply incident.

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, 'integrations:use'
FROM "roles" r
WHERE NOT EXISTS (
  SELECT 1 FROM "role_permissions" rp
  WHERE rp.role_id = r.id
    AND rp.permission_code = 'integrations:use'
);
