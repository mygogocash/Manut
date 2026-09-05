-- Grant the new `projects:read-all` permission to the system roles
-- whose seed already covers it (Admin, Manager). `permission_code` is
-- a free-text VARCHAR — no separate `permissions` lookup table to
-- insert into. Idempotent: `ON CONFLICT DO NOTHING` on the
-- `(role_id, permission_code)` PK leaves existing grants untouched.
INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, 'projects:read-all'
FROM "roles" r
WHERE r."is_system" = true
  AND r."name" IN ('Admin', 'Manager')
ON CONFLICT DO NOTHING;
