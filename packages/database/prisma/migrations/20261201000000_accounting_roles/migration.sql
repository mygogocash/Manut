-- M3 — accounting roles.
--
-- Seeds the two roles the coarse accounting:* permission set can actually
-- enforce: a full-access Accountant and a read-only Accounting Viewer. Sales /
-- Purchasing are intentionally NOT seeded — module-wide accounting:* perms can't
-- express AR-vs-AP separation at the API, so seeding them would fake a boundary
-- that isn't enforced (tracked for a future sub-resource permission split).
--
-- Idempotent (ON CONFLICT DO NOTHING) so a partial rerun after a P3009 deploy
-- doesn't double-seed or re-grant. Permission codes already exist (seeded), so
-- the role_permissions FK is satisfied.

-- Accountant — full access to the Accounting module.
INSERT INTO "roles" (id, name, description, is_system, default_route, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Accountant',
  'Full access to Accounting: ledger, AR/AP, bank, reports, and GL posting',
  TRUE,
  '/accounting',
  NOW(),
  NOW()
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO "role_permissions" (role_id, permission_code)
SELECT r.id, perm
FROM "roles" r
CROSS JOIN (
  VALUES
    ('accounting:read'),
    ('accounting:create'),
    ('accounting:approve'),
    ('accounting:post'),
    ('accounting:admin')
) AS p(perm)
WHERE r.name = 'Accountant'
ON CONFLICT (role_id, permission_code) DO NOTHING;

-- Accounting Viewer — read-only.
INSERT INTO "roles" (id, name, description, is_system, default_route, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Accounting Viewer',
  'Read-only access to the Accounting module (no create/edit/post)',
  TRUE,
  '/accounting',
  NOW(),
  NOW()
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO "role_permissions" (role_id, permission_code)
SELECT r.id, 'accounting:read'
FROM "roles" r
WHERE r.name = 'Accounting Viewer'
ON CONFLICT (role_id, permission_code) DO NOTHING;
