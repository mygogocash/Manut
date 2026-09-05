-- IT Operations module: IT Billing Monitoring + Access Management.
-- Idempotent: CREATE TABLE IF NOT EXISTS + guarded constraint adds +
-- NOT EXISTS permission seeding, so the migration survives partial-apply.

-- ── IT Billing Monitoring ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "it_vendors" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "contact_person" VARCHAR(200),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "it_vendors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "it_vendors_is_active_idx" ON "it_vendors"("is_active");

CREATE TABLE IF NOT EXISTS "it_subscriptions" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'saas',
    "product_name" VARCHAR(200) NOT NULL,
    "contract_start_date" DATE,
    "renewal_date" DATE,
    "billing_frequency" TEXT NOT NULL DEFAULT 'monthly',
    "invoice_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "payment_status" TEXT NOT NULL DEFAULT 'pending',
    "status" TEXT NOT NULL DEFAULT 'active',
    "owner_user_id" UUID,
    "notes" TEXT,
    "last_reminder_sent_at" TIMESTAMP(3),
    "reminders_sent" JSONB NOT NULL DEFAULT '[]',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "it_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "it_subscriptions_vendor_id_idx" ON "it_subscriptions"("vendor_id");
CREATE INDEX IF NOT EXISTS "it_subscriptions_status_idx" ON "it_subscriptions"("status");
CREATE INDEX IF NOT EXISTS "it_subscriptions_renewal_date_idx" ON "it_subscriptions"("renewal_date");
CREATE INDEX IF NOT EXISTS "it_subscriptions_payment_status_idx" ON "it_subscriptions"("payment_status");

CREATE TABLE IF NOT EXISTS "it_billing_records" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "period_start" DATE,
    "period_end" DATE,
    "amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "payment_status" TEXT NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "invoice_url" TEXT,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "it_billing_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "it_billing_records_subscription_id_idx" ON "it_billing_records"("subscription_id");
CREATE INDEX IF NOT EXISTS "it_billing_records_payment_status_idx" ON "it_billing_records"("payment_status");

CREATE TABLE IF NOT EXISTS "it_billing_alerts" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "alert_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_by" UUID,
    "acknowledged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "it_billing_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "it_billing_alerts_subscription_id_idx" ON "it_billing_alerts"("subscription_id");
CREATE INDEX IF NOT EXISTS "it_billing_alerts_acknowledged_idx" ON "it_billing_alerts"("acknowledged");
CREATE INDEX IF NOT EXISTS "it_billing_alerts_alert_type_idx" ON "it_billing_alerts"("alert_type");

-- ── Access Management ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "it_systems" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "it_systems_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "it_systems_name_key" ON "it_systems"("name");
CREATE INDEX IF NOT EXISTS "it_systems_is_active_idx" ON "it_systems"("is_active");

CREATE TABLE IF NOT EXISTS "it_access_requests" (
    "id" UUID NOT NULL,
    "request_number" SERIAL NOT NULL,
    "employee_id" UUID NOT NULL,
    "system_id" TEXT NOT NULL,
    "request_type" TEXT NOT NULL DEFAULT 'new',
    "requested_access_level" VARCHAR(200) NOT NULL,
    "business_justification" TEXT NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "current_step_order" INTEGER,
    "manager_comments" TEXT,
    "it_comments" TEXT,
    "reject_reason" TEXT,
    "submitted_at" TIMESTAMP(3),
    "granted_by" UUID,
    "granted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "it_access_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "it_access_requests_request_number_key" ON "it_access_requests"("request_number");
CREATE INDEX IF NOT EXISTS "it_access_requests_employee_id_status_idx" ON "it_access_requests"("employee_id", "status");
CREATE INDEX IF NOT EXISTS "it_access_requests_status_idx" ON "it_access_requests"("status");
CREATE INDEX IF NOT EXISTS "it_access_requests_system_id_idx" ON "it_access_requests"("system_id");

CREATE TABLE IF NOT EXISTS "it_access_approval_decisions" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "approver_type" TEXT NOT NULL,
    "approver_user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "it_access_approval_decisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "it_access_approval_decisions_request_id_order_key" ON "it_access_approval_decisions"("request_id", "order");
CREATE INDEX IF NOT EXISTS "it_access_approval_decisions_approver_user_id_status_idx" ON "it_access_approval_decisions"("approver_user_id", "status");
CREATE INDEX IF NOT EXISTS "it_access_approval_decisions_request_id_idx" ON "it_access_approval_decisions"("request_id");

CREATE TABLE IF NOT EXISTS "it_access_assignments" (
    "id" UUID NOT NULL,
    "request_id" UUID,
    "employee_id" UUID NOT NULL,
    "system_id" TEXT NOT NULL,
    "access_level" VARCHAR(200) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "granted_by" UUID NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "revoked_by" UUID,
    "revoked_at" TIMESTAMP(3),
    "revoke_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "it_access_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "it_access_assignments_employee_id_status_idx" ON "it_access_assignments"("employee_id", "status");
CREATE INDEX IF NOT EXISTS "it_access_assignments_system_id_idx" ON "it_access_assignments"("system_id");
CREATE INDEX IF NOT EXISTS "it_access_assignments_status_idx" ON "it_access_assignments"("status");

CREATE TABLE IF NOT EXISTS "it_access_audit_logs" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "user_id" UUID,
    "target_user_id" UUID,
    "request_id" UUID,
    "assignment_id" UUID,
    "comments" TEXT,
    "previous_value" JSONB,
    "new_value" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "it_access_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "it_access_audit_logs_request_id_idx" ON "it_access_audit_logs"("request_id");
CREATE INDEX IF NOT EXISTS "it_access_audit_logs_assignment_id_idx" ON "it_access_audit_logs"("assignment_id");
CREATE INDEX IF NOT EXISTS "it_access_audit_logs_target_user_id_idx" ON "it_access_audit_logs"("target_user_id");
CREATE INDEX IF NOT EXISTS "it_access_audit_logs_created_at_idx" ON "it_access_audit_logs"("created_at" DESC);

-- ── Foreign keys (guarded so re-runs are safe) ────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_vendors_created_by_fkey') THEN
    ALTER TABLE "it_vendors" ADD CONSTRAINT "it_vendors_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_subscriptions_vendor_id_fkey') THEN
    ALTER TABLE "it_subscriptions" ADD CONSTRAINT "it_subscriptions_vendor_id_fkey"
      FOREIGN KEY ("vendor_id") REFERENCES "it_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_subscriptions_owner_user_id_fkey') THEN
    ALTER TABLE "it_subscriptions" ADD CONSTRAINT "it_subscriptions_owner_user_id_fkey"
      FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_subscriptions_created_by_fkey') THEN
    ALTER TABLE "it_subscriptions" ADD CONSTRAINT "it_subscriptions_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_billing_records_subscription_id_fkey') THEN
    ALTER TABLE "it_billing_records" ADD CONSTRAINT "it_billing_records_subscription_id_fkey"
      FOREIGN KEY ("subscription_id") REFERENCES "it_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_billing_records_created_by_fkey') THEN
    ALTER TABLE "it_billing_records" ADD CONSTRAINT "it_billing_records_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_billing_alerts_subscription_id_fkey') THEN
    ALTER TABLE "it_billing_alerts" ADD CONSTRAINT "it_billing_alerts_subscription_id_fkey"
      FOREIGN KEY ("subscription_id") REFERENCES "it_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_billing_alerts_acknowledged_by_fkey') THEN
    ALTER TABLE "it_billing_alerts" ADD CONSTRAINT "it_billing_alerts_acknowledged_by_fkey"
      FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_access_requests_employee_id_fkey') THEN
    ALTER TABLE "it_access_requests" ADD CONSTRAINT "it_access_requests_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_access_requests_system_id_fkey') THEN
    ALTER TABLE "it_access_requests" ADD CONSTRAINT "it_access_requests_system_id_fkey"
      FOREIGN KEY ("system_id") REFERENCES "it_systems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_access_requests_granted_by_fkey') THEN
    ALTER TABLE "it_access_requests" ADD CONSTRAINT "it_access_requests_granted_by_fkey"
      FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_access_approval_decisions_request_id_fkey') THEN
    ALTER TABLE "it_access_approval_decisions" ADD CONSTRAINT "it_access_approval_decisions_request_id_fkey"
      FOREIGN KEY ("request_id") REFERENCES "it_access_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_access_approval_decisions_approver_user_id_fkey') THEN
    ALTER TABLE "it_access_approval_decisions" ADD CONSTRAINT "it_access_approval_decisions_approver_user_id_fkey"
      FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_access_approval_decisions_decided_by_id_fkey') THEN
    ALTER TABLE "it_access_approval_decisions" ADD CONSTRAINT "it_access_approval_decisions_decided_by_id_fkey"
      FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_access_assignments_request_id_fkey') THEN
    ALTER TABLE "it_access_assignments" ADD CONSTRAINT "it_access_assignments_request_id_fkey"
      FOREIGN KEY ("request_id") REFERENCES "it_access_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_access_assignments_employee_id_fkey') THEN
    ALTER TABLE "it_access_assignments" ADD CONSTRAINT "it_access_assignments_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_access_assignments_system_id_fkey') THEN
    ALTER TABLE "it_access_assignments" ADD CONSTRAINT "it_access_assignments_system_id_fkey"
      FOREIGN KEY ("system_id") REFERENCES "it_systems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_access_assignments_granted_by_fkey') THEN
    ALTER TABLE "it_access_assignments" ADD CONSTRAINT "it_access_assignments_granted_by_fkey"
      FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_access_assignments_revoked_by_fkey') THEN
    ALTER TABLE "it_access_assignments" ADD CONSTRAINT "it_access_assignments_revoked_by_fkey"
      FOREIGN KEY ("revoked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_access_audit_logs_user_id_fkey') THEN
    ALTER TABLE "it_access_audit_logs" ADD CONSTRAINT "it_access_audit_logs_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'it_access_audit_logs_target_user_id_fkey') THEN
    ALTER TABLE "it_access_audit_logs" ADD CONSTRAINT "it_access_audit_logs_target_user_id_fkey"
      FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Seed permissions ──────────────────────────────────────────────────────
-- Admin bypasses gates via the resolver, but seed explicit grants anyway so
-- the permission catalog UI reflects reality. Manager (catchall team-lead /
-- IT-lead role) gets the full IT Ops set; every Employee can request access.

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, code
FROM "roles" r
CROSS JOIN (VALUES
  ('it:dashboard:view'),
  ('it:billing:view'),
  ('it:billing:manage'),
  ('it:access:view'),
  ('it:access:request'),
  ('it:access:approve'),
  ('it:access:manage')
) AS p(code)
WHERE ((r.is_system = TRUE AND r.name = 'Admin') OR r.name = 'Manager')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id AND rp.permission_code = p.code
  );

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT r.id, 'it:access:request'
FROM "roles" r
WHERE r.name = 'Employee'
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp.role_id = r.id AND rp.permission_code = 'it:access:request'
  );

-- Seed a starter set of systems (admin-editable afterwards).
INSERT INTO "it_systems" ("id", "name", "description", "category", "is_active", "sort_order", "created_at", "updated_at")
SELECT * FROM (VALUES
  (gen_random_uuid()::text, 'Google Workspace', 'Email, Drive, Calendar', 'identity', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GitHub', 'Source control + CI', 'engineering', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Claude', 'Anthropic Claude / API access', 'ai', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CRM', 'Sales CRM workspace', 'internal', true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Internal Intranet', 'TBH Intranet platform', 'internal', true, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
) AS seed(id, name, description, category, is_active, sort_order, created_at, updated_at)
WHERE NOT EXISTS (SELECT 1 FROM "it_systems");
