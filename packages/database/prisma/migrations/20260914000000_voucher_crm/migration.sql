-- Voucher CRM: flat per-partner voucher ledger. One table; the UI
-- shows a server-computed grand-total row summing each numeric column.
-- Idempotent so re-runs / partial applies are safe.

CREATE TABLE IF NOT EXISTS voucher_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner     VARCHAR(200) NOT NULL,
  country     VARCHAR(120),
  redeemed    INTEGER NOT NULL DEFAULT 0,
  issued      INTEGER NOT NULL DEFAULT 0,
  refund      INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  added_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voucher_entries_partner_idx ON voucher_entries (partner);

-- Permission grants. The codes themselves are auto-synced from
-- PERMISSION_DEFINITIONS; this grants the workspace set to Manager
-- (Admin gets everything via the resolvePermissions bypass).
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r
CROSS JOIN (
  VALUES
    ('voucher-crm:read'),
    ('voucher-crm:read-all'),
    ('voucher-crm:create'),
    ('voucher-crm:update'),
    ('voucher-crm:delete'),
    ('voucher-crm:manage')
) AS p(code)
WHERE r.name = 'Manager'
ON CONFLICT (role_id, permission_code) DO NOTHING;
