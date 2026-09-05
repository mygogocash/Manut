-- Grant the HR CRM workspace permissions to the HR Manager role so HR
-- can edit / transfer ownership of HR CRM projects they don't personally
-- own. The perm codes already exist in `permissions` (auto-synced via
-- PERMISSION_DEFINITIONS); only the role_permission grants were missing.
--
-- Tanny (HR) reported "Owner picker doesn't save" on /hr-crm projects.
-- Root cause: service-layer `requireOwnerOrManage` 403s when the actor
-- is neither the owner nor holds `projects:manage` / `hr-crm:manage`.
-- HR Manager had neither.
--
-- Idempotent: ON CONFLICT DO NOTHING tolerates re-runs / partial applies.

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r
CROSS JOIN (
  VALUES
    ('hr-crm:read'),
    ('hr-crm:read-all'),
    ('hr-crm:create'),
    ('hr-crm:update'),
    ('hr-crm:delete'),
    ('hr-crm:manage')
) AS p(code)
WHERE r.name = 'HR Manager'
ON CONFLICT (role_id, permission_code) DO NOTHING;
