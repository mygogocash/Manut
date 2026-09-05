-- Grant the new `admin:usage-report` permission to the Admin role.
-- Idempotent: ON CONFLICT DO NOTHING handles re-runs.

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r."id", 'admin:usage-report'
FROM "roles" r
WHERE r."name" = 'Admin'
ON CONFLICT ("role_id", "permission_code") DO NOTHING;
