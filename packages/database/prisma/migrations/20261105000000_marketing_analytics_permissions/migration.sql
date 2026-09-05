-- Marketing Analytics module: seed the two view permissions to Admin +
-- Manager on existing databases. No tables — the module is a wrapper over
-- the external BNII Analytics API. Idempotent via NOT EXISTS.

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, code
FROM "roles" r
CROSS JOIN (VALUES
  ('marketing:dashboard:view'),
  ('marketing:raw:view')
) AS p(code)
WHERE ((r.is_system = TRUE AND r.name = 'Admin') OR r.name = 'Manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id AND rp.permission_code = p.code
  );
