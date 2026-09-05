-- Grant per-workspace CRM permissions to the Manager role so team
-- leads (the catch-all manager role across IT / Product / Legal / QA
-- / HR) can edit and transfer ownership of projects inside their CRM
-- workspace without holding admin or being the project owner.
--
-- Mirrors 20260912000000_grant_hr_crm_perms but broader: covers the
-- five per-team CRMs we have today, not just HR.
--
-- The permission codes already exist in the `permissions` table
-- (PERMISSION_DEFINITIONS auto-sync). This migration only adds the
-- role_permission rows.
--
-- Idempotent: ON CONFLICT DO NOTHING so re-runs and partial applies
-- don't fail.

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r
CROSS JOIN (
  VALUES
    ('it-crm:read'),
    ('it-crm:read-all'),
    ('it-crm:create'),
    ('it-crm:update'),
    ('it-crm:delete'),
    ('it-crm:manage'),
    ('product-crm:read'),
    ('product-crm:read-all'),
    ('product-crm:create'),
    ('product-crm:update'),
    ('product-crm:delete'),
    ('product-crm:manage'),
    ('legal-crm:read'),
    ('legal-crm:read-all'),
    ('legal-crm:create'),
    ('legal-crm:update'),
    ('legal-crm:delete'),
    ('legal-crm:manage'),
    ('qa-crm:read'),
    ('qa-crm:read-all'),
    ('qa-crm:create'),
    ('qa-crm:update'),
    ('qa-crm:delete'),
    ('qa-crm:manage'),
    ('hr-crm:read'),
    ('hr-crm:read-all'),
    ('hr-crm:create'),
    ('hr-crm:update'),
    ('hr-crm:delete'),
    ('hr-crm:manage')
) AS p(code)
WHERE r.name = 'Manager'
ON CONFLICT (role_id, permission_code) DO NOTHING;
