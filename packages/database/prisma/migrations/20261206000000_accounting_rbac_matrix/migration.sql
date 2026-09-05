-- Chunk 5 — Accounting RBAC: 6-role matrix + own-document scoping.
--
-- Two things happen here, both ADDITIVE and IDEMPOTENT (safe to re-run after a
-- P3009 partial-apply):
--
--  1. invoices.created_by — the author column that own-document scoping filters
--     on. Nullable, so every pre-existing invoice/bill stays null and remains
--     visible ONLY to `accounting:read-all` / `accounting:admin` holders.
--
--  2. The 6-role accounting matrix (PRD M0) + the NON-BREAKING read-all grant.
--     The safety rule: NO current reader may be downgraded to own-documents-
--     only. So `accounting:read-all` is granted to EVERY role that already
--     holds `accounting:read` (Admin, Accounting Manager, Finance Manager,
--     Accountant, Accounting Viewer, and any custom role) — everyone who can
--     see all documents today keeps seeing all documents. Only the NEW
--     Sales / Purchasing roles are left scoped to their own documents.
--
-- Supersedes the "Sales / Purchasing intentionally NOT seeded" note in
-- 20261201000000_accounting_roles: own-document scoping (this chunk) is the
-- API boundary that finally makes AR-owner / AP-owner separation enforceable.

-- ── 1. invoices.created_by (own-document scoping author) ────────────────────
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "created_by" UUID;
CREATE INDEX IF NOT EXISTS "invoices_created_by_idx" ON "invoices" ("created_by");

-- ── 2. NON-BREAKING read-all grant (regression guard) ───────────────────────
-- Grant `accounting:read-all` to every role that currently holds
-- `accounting:read`, EXCEPT the two intentionally-scoped new roles. The name
-- exclusion keeps this safe on re-run: even after Sales / Purchasing hold
-- `accounting:read` (granted below), a second apply never widens them to
-- read-all.
INSERT INTO "role_permissions" (role_id, permission_code)
SELECT DISTINCT rp.role_id, 'accounting:read-all'
FROM "role_permissions" rp
JOIN "roles" r ON r.id = rp.role_id
WHERE rp.permission_code = 'accounting:read'
  AND r.name NOT IN ('Accounting Sales', 'Accounting Purchasing')
ON CONFLICT (role_id, permission_code) DO NOTHING;

-- ── 3. The 6-role accounting matrix ─────────────────────────────────────────
-- Existing roles (created by 20261201000000_accounting_roles) that map onto the
-- matrix are EXTENDED, never duplicated:
--   • "Accountant"        = the operational "Accounting" role (full access).
--   • "Accounting Viewer" = the read-all view-only "Viewer" role.
-- Both already received `accounting:read-all` via the generic grant in step 2
-- (they hold `accounting:read`); the explicit grants below document the intent
-- and stay correct even if step 2 is edited.
--
-- New roles created here: Accounting Owner, Accounting Chief, Accounting Sales,
-- Accounting Purchasing.

-- Accounting Owner — full access (read-all, create, approve, post, admin).
INSERT INTO "roles" (id, name, description, is_system, default_route, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Accounting Owner',
  'Full Accounting authority: all documents, create, approve, post, and admin/config',
  TRUE,
  '/accounting',
  NOW(),
  NOW()
)
ON CONFLICT (name) DO NOTHING;

-- Accounting Chief — full read of all financials + approve/void, but NO
-- config/users/CoA admin (Decision #12): read-all, approve, post; NOT admin.
INSERT INTO "roles" (id, name, description, is_system, default_route, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Accounting Chief',
  'Reviews and approves all Accounting: read-all + approve + post, but no admin/config',
  TRUE,
  '/accounting',
  NOW(),
  NOW()
)
ON CONFLICT (name) DO NOTHING;

-- Accounting Sales — creates + edits their OWN AR documents (Decision #13):
-- read + create, scoped to own documents (deliberately NO read-all).
INSERT INTO "roles" (id, name, description, is_system, default_route, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Accounting Sales',
  'Creates and edits own AR documents (own-document scoped; no read-all)',
  TRUE,
  '/accounting',
  NOW(),
  NOW()
)
ON CONFLICT (name) DO NOTHING;

-- Accounting Purchasing — creates + edits their OWN AP documents: read +
-- create, scoped to own documents (deliberately NO read-all).
INSERT INTO "roles" (id, name, description, is_system, default_route, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Accounting Purchasing',
  'Creates and edits own AP documents (own-document scoped; no read-all)',
  TRUE,
  '/accounting',
  NOW(),
  NOW()
)
ON CONFLICT (name) DO NOTHING;

-- Grant the per-role permission sets. Every INSERT is ON CONFLICT DO NOTHING so
-- re-runs and the overlap with step 2 are both no-ops.

-- Owner → read-all, create, approve, post, admin (+ read for completeness).
INSERT INTO "role_permissions" (role_id, permission_code)
SELECT r.id, perm
FROM "roles" r
CROSS JOIN (
  VALUES
    ('accounting:read'),
    ('accounting:read-all'),
    ('accounting:create'),
    ('accounting:approve'),
    ('accounting:post'),
    ('accounting:admin')
) AS p(perm)
WHERE r.name = 'Accounting Owner'
ON CONFLICT (role_id, permission_code) DO NOTHING;

-- Chief → read-all, approve, post (NO create, NO admin) + read for completeness.
INSERT INTO "role_permissions" (role_id, permission_code)
SELECT r.id, perm
FROM "roles" r
CROSS JOIN (
  VALUES
    ('accounting:read'),
    ('accounting:read-all'),
    ('accounting:approve'),
    ('accounting:post')
) AS p(perm)
WHERE r.name = 'Accounting Chief'
ON CONFLICT (role_id, permission_code) DO NOTHING;

-- Sales → read + create ONLY (own-document scoped; NO read-all).
INSERT INTO "role_permissions" (role_id, permission_code)
SELECT r.id, perm
FROM "roles" r
CROSS JOIN (
  VALUES
    ('accounting:read'),
    ('accounting:create')
) AS p(perm)
WHERE r.name = 'Accounting Sales'
ON CONFLICT (role_id, permission_code) DO NOTHING;

-- Purchasing → read + create ONLY (own-document scoped; NO read-all).
INSERT INTO "role_permissions" (role_id, permission_code)
SELECT r.id, perm
FROM "roles" r
CROSS JOIN (
  VALUES
    ('accounting:read'),
    ('accounting:create')
) AS p(perm)
WHERE r.name = 'Accounting Purchasing'
ON CONFLICT (role_id, permission_code) DO NOTHING;

-- Accountant (operational "Accounting") → ensure read-all on top of its
-- existing read/create/approve/post/admin.
INSERT INTO "role_permissions" (role_id, permission_code)
SELECT r.id, 'accounting:read-all'
FROM "roles" r
WHERE r.name = 'Accountant'
ON CONFLICT (role_id, permission_code) DO NOTHING;

-- Accounting Viewer ("Viewer") → read-all view-only (read + read-all).
INSERT INTO "role_permissions" (role_id, permission_code)
SELECT r.id, 'accounting:read-all'
FROM "roles" r
WHERE r.name = 'Accounting Viewer'
ON CONFLICT (role_id, permission_code) DO NOTHING;
