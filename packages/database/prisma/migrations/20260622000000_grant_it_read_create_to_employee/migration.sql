-- Grant `it:read` + `it:create` to the Employee role so every staff
-- member can view their own IT helpdesk tickets and submit new ones.
-- Triage / resolve permissions stay with the IT role.
--
-- Scoped to the system "Employee" role rather than every row in
-- `roles` — custom roles that admins built without IT access should
-- stay as-is, but the canonical Employee role is the global default
-- for new hires and needs these two perms baked in.
--
-- Idempotent: WHERE NOT EXISTS guard so this can re-run after a
-- partial-apply incident.

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, 'it:read'
FROM "roles" r
WHERE r.name = 'Employee'
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id
      AND rp.permission_code = 'it:read'
  );

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, 'it:create'
FROM "roles" r
WHERE r.name = 'Employee'
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id
      AND rp.permission_code = 'it:create'
  );
