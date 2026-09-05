-- Travel Admin role: visibility + approval over every travel request.
-- HR feedback (May 2026): Sid and Manit need to monitor and act on the
-- All Requests tab without inheriting the full HR permission bundle —
-- they're not HR. Mints a narrow role that maps onto the same gating
-- the All Requests tab already uses (`travel:hr-read`).
--
-- Idempotent so a partial rerun (P3009 mid-deploy) doesn't double-seed
-- or re-grant the role.

INSERT INTO "roles" (id, name, description, is_system, default_route, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Travel Admin',
  'View, approve, export, and audit every travel request (founder bench)',
  TRUE,
  '/travel',
  NOW(),
  NOW()
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO "role_permissions" (role_id, permission_code)
SELECT r.id, perm
FROM "roles" r
CROSS JOIN (
  VALUES
    ('travel:read'),
    ('travel:request'),
    ('travel:approve'),
    ('travel:hr-read'),
    ('travel:hr-approve'),
    ('travel:hr-on-behalf'),
    ('travel:export'),
    ('travel:audit-read'),
    ('travel:analytics')
) AS p(perm)
WHERE r.name = 'Travel Admin'
ON CONFLICT (role_id, permission_code) DO NOTHING;

-- Grant the role to Manit and Sid by first-name match on active users.
-- ILIKE so the casing / surname don't matter; the trailing space anchors
-- on the first token so "Sidney" or "Manitha" wouldn't accidentally
-- collide. If either user is missing the migration is still a no-op for
-- that user — the next run picks them up once they're seeded.
INSERT INTO "user_roles" (user_id, role_id, assigned_at)
SELECT u.id, r.id, NOW()
FROM "users" u
CROSS JOIN "roles" r
WHERE r.name = 'Travel Admin'
  AND u.is_active = TRUE
  AND (
       LOWER(u.name) LIKE 'manit %'
    OR LOWER(u.name) LIKE 'sid %'
    OR LOWER(u.name) LIKE 'siddharth %'
    OR LOWER(u.name) LIKE 'sidharth %'
  )
ON CONFLICT (user_id, role_id) DO NOTHING;
