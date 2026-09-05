-- Seed the new `expense:hr-settings` permission onto the system Admin
-- role so finance / HR admins can configure the expense notification
-- recipient list out of the box. Other roles need explicit assignment
-- via the Roles UI.
--
-- Idempotent: WHERE NOT EXISTS guard so this can re-run after a
-- partial-apply incident.

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, 'expense:hr-settings'
FROM "roles" r
WHERE r.is_system = TRUE
  AND r.name = 'Admin'
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id
      AND rp.permission_code = 'expense:hr-settings'
  );
