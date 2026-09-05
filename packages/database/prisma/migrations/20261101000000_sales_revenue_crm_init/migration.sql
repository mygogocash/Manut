-- CreateTable
CREATE TABLE "revenue_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "industry" TEXT,
    "size" TEXT,
    "country" TEXT,
    "region" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "total_users" INTEGER,
    "app_users" INTEGER,
    "pic_name" TEXT,
    "designation" TEXT,
    "department" TEXT,
    "last_follow_up_date" DATE,
    "agreement_signed_date" DATE,
    "engagement_type" TEXT,
    "uat_start_date" DATE,
    "uat_end_date" DATE,
    "blocker" TEXT,
    "remarks" TEXT,
    "owner_id" UUID NOT NULL,
    "partner_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_contacts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_leads" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "legacy_deal_id" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "owner_id" UUID NOT NULL,
    "notes" TEXT,
    "converted_opportunity_id" TEXT,
    "converted_at" TIMESTAMP(3),
    "disqualify_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_opportunities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legacy_deal_id" TEXT,
    "account_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'qualified',
    "sort_order_within_stage" INTEGER NOT NULL DEFAULT 0,
    "value" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "probability" INTEGER NOT NULL DEFAULT 20,
    "probability_custom" BOOLEAN NOT NULL DEFAULT false,
    "close_date" DATE,
    "launch_date" DATE,
    "revenue_launch_date" DATE,
    "type" TEXT,
    "notes" TEXT,
    "owner_id" UUID NOT NULL,
    "lost_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_activities" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "duration_mins" INTEGER,
    "owner_id" UUID NOT NULL,
    "lead_id" TEXT,
    "opportunity_id" TEXT,
    "contact_id" TEXT,
    "account_id" TEXT,
    "external_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revenue_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_stage_config" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "probability" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT 'border-t-zinc-500',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_stage_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "revenue_lost_reasons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_lost_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_lead_sources" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_tasks" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "due_date" DATE NOT NULL,
    "owner_id" UUID NOT NULL,
    "opportunity_id" TEXT,
    "lead_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_settings" (
    "id" UUID NOT NULL,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "notify_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notify_on_create" BOOLEAN NOT NULL DEFAULT true,
    "notify_owner_on_create" BOOLEAN NOT NULL DEFAULT true,
    "notify_owner_on_stage_change" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "revenue_accounts_domain_key" ON "revenue_accounts"("domain");

-- CreateIndex
CREATE INDEX "revenue_accounts_owner_id_idx" ON "revenue_accounts"("owner_id");

-- CreateIndex
CREATE INDEX "revenue_accounts_partner_id_idx" ON "revenue_accounts"("partner_id");

-- CreateIndex
CREATE INDEX "revenue_accounts_name_idx" ON "revenue_accounts"("name");

-- CreateIndex
CREATE INDEX "revenue_accounts_sort_order_idx" ON "revenue_accounts"("sort_order");

-- CreateIndex
CREATE INDEX "revenue_contacts_account_id_idx" ON "revenue_contacts"("account_id");

-- CreateIndex
CREATE INDEX "revenue_contacts_email_idx" ON "revenue_contacts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_leads_legacy_deal_id_key" ON "revenue_leads"("legacy_deal_id");

-- CreateIndex
CREATE INDEX "revenue_leads_owner_id_status_idx" ON "revenue_leads"("owner_id", "status");

-- CreateIndex
CREATE INDEX "revenue_leads_source_idx" ON "revenue_leads"("source");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_opportunities_legacy_deal_id_key" ON "revenue_opportunities"("legacy_deal_id");

-- CreateIndex
CREATE INDEX "revenue_opportunities_stage_idx" ON "revenue_opportunities"("stage");

-- CreateIndex
CREATE INDEX "revenue_opportunities_stage_sort_order_within_stage_idx" ON "revenue_opportunities"("stage", "sort_order_within_stage");

-- CreateIndex
CREATE INDEX "revenue_opportunities_owner_id_stage_idx" ON "revenue_opportunities"("owner_id", "stage");

-- CreateIndex
CREATE INDEX "revenue_opportunities_account_id_idx" ON "revenue_opportunities"("account_id");

-- CreateIndex
CREATE INDEX "revenue_opportunities_close_date_idx" ON "revenue_opportunities"("close_date");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_activities_external_ref_key" ON "revenue_activities"("external_ref");

-- CreateIndex
CREATE INDEX "revenue_activities_lead_id_idx" ON "revenue_activities"("lead_id");

-- CreateIndex
CREATE INDEX "revenue_activities_opportunity_id_idx" ON "revenue_activities"("opportunity_id");

-- CreateIndex
CREATE INDEX "revenue_activities_contact_id_idx" ON "revenue_activities"("contact_id");

-- CreateIndex
CREATE INDEX "revenue_activities_account_id_idx" ON "revenue_activities"("account_id");

-- CreateIndex
CREATE INDEX "revenue_activities_occurred_at_idx" ON "revenue_activities"("occurred_at");

-- CreateIndex
CREATE INDEX "revenue_stage_config_sort_order_idx" ON "revenue_stage_config"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_lost_reasons_code_key" ON "revenue_lost_reasons"("code");

-- CreateIndex
CREATE INDEX "revenue_lost_reasons_is_active_sort_order_idx" ON "revenue_lost_reasons"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_lead_sources_code_key" ON "revenue_lead_sources"("code");

-- CreateIndex
CREATE INDEX "revenue_lead_sources_is_active_sort_order_idx" ON "revenue_lead_sources"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "revenue_tasks_owner_id_status_due_date_idx" ON "revenue_tasks"("owner_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "revenue_tasks_opportunity_id_idx" ON "revenue_tasks"("opportunity_id");

-- CreateIndex
CREATE INDEX "revenue_tasks_lead_id_idx" ON "revenue_tasks"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_settings_singleton_key" ON "revenue_settings"("singleton");

-- AddForeignKey
ALTER TABLE "revenue_accounts" ADD CONSTRAINT "revenue_accounts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_accounts" ADD CONSTRAINT "revenue_accounts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_contacts" ADD CONSTRAINT "revenue_contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "revenue_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_leads" ADD CONSTRAINT "revenue_leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_leads" ADD CONSTRAINT "revenue_leads_converted_opportunity_id_fkey" FOREIGN KEY ("converted_opportunity_id") REFERENCES "revenue_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_opportunities" ADD CONSTRAINT "revenue_opportunities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "revenue_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_opportunities" ADD CONSTRAINT "revenue_opportunities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "revenue_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_opportunities" ADD CONSTRAINT "revenue_opportunities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_activities" ADD CONSTRAINT "revenue_activities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_activities" ADD CONSTRAINT "revenue_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "revenue_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_activities" ADD CONSTRAINT "revenue_activities_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "revenue_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_activities" ADD CONSTRAINT "revenue_activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "revenue_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_activities" ADD CONSTRAINT "revenue_activities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "revenue_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_tasks" ADD CONSTRAINT "revenue_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_tasks" ADD CONSTRAINT "revenue_tasks_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "revenue_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_tasks" ADD CONSTRAINT "revenue_tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "revenue_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_settings" ADD CONSTRAINT "revenue_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Seed Sales Revenue CRM lookups (idempotent). Mirrors Sales CRM defaults.
-- NOTE: staging uses `db:push`, so this block runs on prod (migrate deploy)
-- only; staging gets these rows via seed.ts.
INSERT INTO "revenue_stage_config" ("key","label","probability","sort_order","color","updated_at") VALUES
  ('qualified','Qualified',20,10,'border-t-blue-500',now()),
  ('proposal','Proposal',40,20,'border-t-violet-500',now()),
  ('negotiation','Negotiation',60,30,'border-t-amber-500',now()),
  ('closed_won','Closed Won',100,40,'border-t-emerald-500',now()),
  ('live','Live',100,50,'border-t-green-600',now()),
  ('closed_lost','Closed Lost',0,60,'border-t-red-500',now())
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "revenue_lead_sources" ("id","code","label","is_system","is_active","sort_order","created_at","updated_at") VALUES
  ('rev_ls_web','web','Web inbound',true,true,10,now(),now()),
  ('rev_ls_referral','referral','Referral',true,true,20,now(),now()),
  ('rev_ls_conference','conference','Conference',true,true,30,now(),now()),
  ('rev_ls_partner','partner','Partner',true,true,40,now(),now()),
  ('rev_ls_cold','cold','Cold outreach',true,true,50,now(),now()),
  ('rev_ls_other','other','Other',true,true,60,now(),now())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "revenue_lost_reasons" ("id","code","label","is_system","is_active","sort_order","created_at","updated_at") VALUES
  ('rev_lr_no_budget','no-budget','No budget',true,true,10,now(),now()),
  ('rev_lr_no_dm','no-decision-maker','No decision-maker',true,true,20,now(),now()),
  ('rev_lr_competitor','lost-to-competitor','Lost to competitor',true,true,30,now(),now()),
  ('rev_lr_no_response','no-response','No response / ghosted',true,true,40,now(),now()),
  ('rev_lr_bad_fit','bad-fit','Bad fit',true,true,50,now(),now()),
  ('rev_lr_timing','timing','Timing — revisit later',true,true,60,now(),now()),
  ('rev_lr_other','other','Other',true,true,70,now(),now())
ON CONFLICT ("code") DO NOTHING;
