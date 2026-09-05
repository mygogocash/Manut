-- Fix: 20261109000000 granted survey:manage only to Admin + 'HR Manager', but
-- the prod HR role is named 'HR' ('HR Manager' exists only in the dev seed), so
-- HR silently lacked the promoted Survey module on prod. Grant to the real role
-- name(s). Admin already has it (and bypasses gates anyway). Idempotent.

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, 'survey:manage'
FROM "roles" r
WHERE r.name IN ('HR', 'HR Manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id AND rp.permission_code = 'survey:manage'
  );
