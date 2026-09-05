-- Marketing CRM - Analytics & Reports (Phase 3). No new tables; adds the
-- reports permission and a composite index for report filter+sort speed.
-- Idempotent.

CREATE INDEX IF NOT EXISTS "mkt_campaigns_status_campaign_date_idx"
  ON "mkt_campaigns"("status", "campaign_date");

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, 'marketing:reports:view'
FROM "roles" r
WHERE ((r.is_system = TRUE AND r.name = 'Admin') OR r.name = 'Manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id AND rp.permission_code = 'marketing:reports:view'
  );
