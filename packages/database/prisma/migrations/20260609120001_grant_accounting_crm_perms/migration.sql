-- Grant Accounting CRM workspace permissions to Manager, Accounting
-- Manager, and Finance Manager. Permission codes auto-sync from
-- PERMISSION_DEFINITIONS; this migration only adds role_permission rows.
--
-- Idempotent: ON CONFLICT DO NOTHING.

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r
CROSS JOIN (
  VALUES
    ('accounting-crm:read'),
    ('accounting-crm:read-all'),
    ('accounting-crm:create'),
    ('accounting-crm:update'),
    ('accounting-crm:delete'),
    ('accounting-crm:manage')
) AS p(code)
WHERE r.name IN ('Manager', 'Accounting Manager', 'Finance Manager')
ON CONFLICT (role_id, permission_code) DO NOTHING;
