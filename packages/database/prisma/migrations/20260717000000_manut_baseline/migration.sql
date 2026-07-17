-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'direct',
    "direct_key" TEXT,
    "title" TEXT,
    "created_by" UUID NOT NULL,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_members" (
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "last_read_at" TIMESTAMP(3),

    CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("conversation_id","user_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" TEXT,
    "kind" VARCHAR(20) NOT NULL DEFAULT 'text',
    "deleted_for_everyone_at" TIMESTAMP(3),
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_hidden_for" (
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "hidden_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_hidden_for_pkey" PRIMARY KEY ("message_id","user_id")
);

-- CreateTable
CREATE TABLE "message_reactions" (
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "emoji" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("message_id","user_id")
);

-- CreateTable
CREATE TABLE "wall_posts" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'post',
    "likes" JSONB,
    "reactions" JSONB,
    "attachments" JSONB,
    "link_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wall_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wall_comments" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'comment',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wall_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_news" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "author_id" UUID NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "attachments" JSONB,
    "link_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_dates" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "location" TEXT,
    "attachments" JSONB,
    "link_url" TEXT,
    "added_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "type" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "linkedin" TEXT,
    "website" TEXT,
    "attachment" TEXT NOT NULL,
    "job_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blogs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "cover_image" TEXT NOT NULL,
    "slug" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "img" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_pages" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "parent_id" UUID,
    "position" INTEGER NOT NULL DEFAULT 0,
    "folder" TEXT,
    "body" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "slug" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "is_restricted" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_page_versions" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "wiki_page_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_page_permissions" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "level" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wiki_page_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "accounting_std" TEXT NOT NULL DEFAULT 'IFRS',
    "tax_id" TEXT,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "phone" TEXT,
    "phone_public" BOOLEAN NOT NULL DEFAULT false,
    "entity_id" TEXT,
    "department" TEXT,
    "job_title" TEXT,
    "employee_id" TEXT,
    "reporting_to" UUID,
    "employment_type" TEXT NOT NULL DEFAULT 'full_time',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "salary" DECIMAL(15,2),
    "currency" TEXT,
    "location" TEXT,
    "country" TEXT,
    "timezone" TEXT,
    "date_of_birth" DATE,
    "passport_number" TEXT,
    "nationality" TEXT,
    "thai_id" TEXT,
    "tax_id" TEXT,
    "aadhaar_number" TEXT,
    "pan_card_number" TEXT,
    "work_permit_type" TEXT,
    "visa_type" TEXT,
    "permit_number" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_logs" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "ip" VARCHAR(64),
    "action" VARCHAR(32) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error_message" VARCHAR(500),
    "user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20),
    "description" TEXT,
    "head_id" UUID,
    "parent_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_of_accounts" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" TEXT NOT NULL,
    "name_th" TEXT,
    "type" TEXT NOT NULL,
    "parent_id" TEXT,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entry_no" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "description_th" TEXT,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "from_expense" UUID,
    "created_by" UUID NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "posted_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_lines" (
    "id" UUID NOT NULL,
    "entry_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "memo" TEXT,

    CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "counterparty" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "paid_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "linked_je_id" TEXT,
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" UUID NOT NULL,
    "entity_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "balance" DECIMAL(15,2),
    "reference" TEXT,
    "bank_account" TEXT,
    "suggested_account" TEXT,
    "mapped_account" TEXT,
    "je_ref" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unmatched',
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL,
    "base_currency" VARCHAR(10) NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "effective_date" DATE NOT NULL,
    "source" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "gl_account_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "spending_limit" DECIMAL(15,2),
    "limit_period" VARCHAR(20),
    "receipt_required" BOOLEAN NOT NULL DEFAULT false,
    "is_allowance" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "entity_id" TEXT NOT NULL,
    "contact_type" TEXT,
    "contact_id" TEXT,
    "business_type" TEXT,
    "business_location" TEXT,
    "name" TEXT NOT NULL,
    "address_th" TEXT,
    "address_en" TEXT,
    "address2" TEXT,
    "address3" TEXT,
    "zip_code" TEXT,
    "tax_id" TEXT,
    "branch_code" TEXT,
    "branch" TEXT,
    "contact_name" TEXT,
    "email" TEXT,
    "mobile" TEXT,
    "credit_days" INTEGER,
    "phone" TEXT,
    "fax_number" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_advance_requests" (
    "id" UUID NOT NULL,
    "request_number" SERIAL NOT NULL,
    "employee_id" UUID NOT NULL,
    "entity_id" TEXT,
    "request_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "position" TEXT,
    "department" TEXT,
    "direct_manager" TEXT,
    "payout_mode" TEXT NOT NULL DEFAULT 'bank-transfer',
    "bank_name" TEXT,
    "bank_country" TEXT,
    "bank_account_no" TEXT,
    "swift_code" TEXT,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'THB',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "current_step_order" INTEGER,
    "requested_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "approved_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "reject_reason" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "disbursed_at" TIMESTAMP(3),
    "disbursement_proof_url" TEXT,
    "cleared_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_advance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_advance_approval_steps" (
    "id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "approver_type" TEXT NOT NULL DEFAULT 'manager',
    "approver_user_id" UUID,
    "skip_when_submitter_ids" JSONB NOT NULL DEFAULT '[]',
    "only_when_submitter_ids" JSONB NOT NULL DEFAULT '[]',
    "payout_mode_filter" JSONB NOT NULL DEFAULT '[]',
    "amount_min" DECIMAL(15,2),
    "amount_max" DECIMAL(15,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_advance_approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_advance_approval_decisions" (
    "id" UUID NOT NULL,
    "cash_advance_request_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "approver_type" TEXT NOT NULL,
    "approver_user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_advance_approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_advance_items" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "category_id" TEXT,
    "requested_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "approved_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "receipt_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_advance_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "entity_id" TEXT NOT NULL,
    "category_id" TEXT,
    "travel_request_id" UUID,
    "report_id" UUID,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "receipt_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "reimbursed_at" TIMESTAMP(3),
    "notes" TEXT,
    "je_ref" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_reports" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "entity_id" TEXT NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "current_step_order" INTEGER,
    "submitted_at" TIMESTAMP(3),
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "approved_total" DECIMAL(15,2),
    "reject_reason" TEXT,
    "reimbursed_at" TIMESTAMP(3),
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_approval_steps" (
    "id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "approver_type" TEXT NOT NULL DEFAULT 'manager',
    "approver_user_id" UUID,
    "skip_when_submitter_ids" JSONB NOT NULL DEFAULT '[]',
    "only_when_submitter_ids" JSONB NOT NULL DEFAULT '[]',
    "category_filter" JSONB NOT NULL DEFAULT '[]',
    "amount_min_baht" DECIMAL(15,2),
    "amount_max_baht" DECIMAL(15,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_approval_decisions" (
    "id" UUID NOT NULL,
    "expense_report_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "approver_type" TEXT NOT NULL,
    "approver_user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "approved_amount" DECIMAL(15,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "helpdesk_tickets" (
    "id" UUID NOT NULL,
    "ticket_number" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_by" UUID NOT NULL,
    "assignee_id" UUID,
    "resolution_note" TEXT,
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "first_response_at" TIMESTAMP(3),
    "reopened_count" INTEGER NOT NULL DEFAULT 0,
    "attachments" JSONB,
    "github_issue_number" INTEGER,
    "github_issue_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "helpdesk_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validator_node_alerts" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "node_id" TEXT,
    "field" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "threshold" DECIMAL(28,8) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldown_minutes" INTEGER NOT NULL DEFAULT 1440,
    "last_triggered_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "validator_node_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "helpdesk_settings" (
    "id" UUID NOT NULL,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "notify_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notify_on_create" BOOLEAN NOT NULL DEFAULT true,
    "notify_creator_on_create" BOOLEAN NOT NULL DEFAULT true,
    "notify_creator_on_status" BOOLEAN NOT NULL DEFAULT true,
    "github_enabled" BOOLEAN NOT NULL DEFAULT false,
    "github_repo_owner" TEXT,
    "github_repo_name" TEXT,
    "github_token_encrypted" TEXT,
    "github_webhook_secret" TEXT,
    "github_label_in_progress" TEXT NOT NULL DEFAULT 'in progress',
    "github_label_review" TEXT NOT NULL DEFAULT 'review',
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "helpdesk_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "helpdesk_comments" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "helpdesk_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_forms" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "target_all" BOOLEAN NOT NULL DEFAULT true,
    "target_entity_ids" JSONB NOT NULL DEFAULT '[]',
    "target_departments" JSONB NOT NULL DEFAULT '[]',
    "target_user_ids" JSONB NOT NULL DEFAULT '[]',
    "published_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "start_date" DATE,
    "end_date" DATE,
    "archived_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_form_questions" (
    "id" UUID NOT NULL,
    "survey_form_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "prompt" TEXT NOT NULL,
    "helper_text" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB NOT NULL DEFAULT '[]',
    "settings" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "survey_form_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_form_responses" (
    "id" UUID NOT NULL,
    "survey_form_id" UUID NOT NULL,
    "respondent_id" UUID,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_form_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_form_answers" (
    "id" UUID NOT NULL,
    "response_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "survey_form_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "target_all" BOOLEAN NOT NULL DEFAULT true,
    "target_entity_ids" JSONB NOT NULL DEFAULT '[]',
    "target_departments" JSONB NOT NULL DEFAULT '[]',
    "target_user_ids" JSONB NOT NULL DEFAULT '[]',
    "published_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "start_date" DATE,
    "end_date" DATE,
    "archived_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_questions" (
    "id" UUID NOT NULL,
    "survey_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "prompt" TEXT NOT NULL,
    "helper_text" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB NOT NULL DEFAULT '[]',
    "settings" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "survey_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" UUID NOT NULL,
    "survey_id" UUID NOT NULL,
    "respondent_id" UUID,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_answers" (
    "id" UUID NOT NULL,
    "response_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "survey_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_requests" (
    "id" UUID NOT NULL,
    "request_code" VARCHAR(20) NOT NULL,
    "employee_id" UUID NOT NULL,
    "entity_id" TEXT,
    "origin" TEXT,
    "destination" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "departure_date" DATE NOT NULL,
    "return_date" DATE NOT NULL,
    "estimated_budget" DECIMAL(15,2),
    "cash_advance" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "category" TEXT NOT NULL DEFAULT 'general',
    "flight_type" TEXT,
    "departure_time_preference" TEXT,
    "return_time_preference" TEXT,
    "meal_preference" TEXT,
    "seating_preference" TEXT,
    "seating_preference_other" TEXT,
    "dummy_ticket_required" BOOLEAN NOT NULL DEFAULT false,
    "visa_required" BOOLEAN NOT NULL DEFAULT false,
    "hotel_required" BOOLEAN NOT NULL DEFAULT false,
    "hotel_location_preference" TEXT,
    "preferred_hotel" TEXT,
    "hotel_details" TEXT,
    "notes" TEXT,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "delegated_to" UUID,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "current_step_order" INTEGER,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "submitted_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_approval_steps" (
    "id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "approver_type" TEXT NOT NULL DEFAULT 'manager',
    "approver_user_id" UUID,
    "skip_when_submitter_ids" JSONB NOT NULL DEFAULT '[]',
    "only_when_submitter_ids" JSONB NOT NULL DEFAULT '[]',
    "category_filter" JSONB NOT NULL DEFAULT '[]',
    "amount_min_baht" DECIMAL(15,2),
    "amount_max_baht" DECIMAL(15,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_approval_decisions" (
    "id" UUID NOT NULL,
    "travel_request_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "approver_type" TEXT NOT NULL,
    "approver_user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "travel_approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "days_per_year" INTEGER NOT NULL DEFAULT 0,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "is_paid" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_policy_approvers" (
    "id" UUID NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "approver_type" TEXT NOT NULL DEFAULT 'manager',
    "approver_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_policy_approvers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "entitled" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "used" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "carried" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "carried_used" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "carried_expiry" DATE,
    "adjustment" DECIMAL(4,1) NOT NULL DEFAULT 0,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_transactions" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "amount" DECIMAL(4,1) NOT NULL,
    "description" TEXT,
    "reference_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balance_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "entity_id" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "duration_type" TEXT NOT NULL DEFAULT 'full_day',
    "half_day_period" TEXT,
    "days" DECIMAL(4,1) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'entitled',
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "current_step_order" INTEGER,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "delegated_to" UUID,
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "last_reminder_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_approval_steps" (
    "id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "approver_type" TEXT NOT NULL DEFAULT 'manager',
    "approver_user_id" UUID,
    "skip_when_submitter_ids" JSONB NOT NULL DEFAULT '[]',
    "only_when_submitter_ids" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_approval_decisions" (
    "id" UUID NOT NULL,
    "leave_request_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "approver_type" TEXT NOT NULL,
    "approver_user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_holidays" (
    "id" UUID NOT NULL,
    "entity_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "total_gross" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_net" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency_totals" JSONB,
    "run_by" UUID NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" UUID NOT NULL,
    "payroll_run_id" TEXT NOT NULL,
    "employee_id" UUID NOT NULL,
    "base_salary" DECIMAL(15,2) NOT NULL,
    "allowances" JSONB,
    "deductions" JSONB,
    "gross_pay" DECIMAL(15,2) NOT NULL,
    "net_pay" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "gross_pay_base" DECIMAL(15,2),
    "net_pay_base" DECIMAL(15,2),
    "position_snapshot" TEXT,
    "department_snapshot" TEXT,
    "start_date_snapshot" TEXT,
    "document_url" TEXT,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultant_invoices" (
    "id" UUID NOT NULL,
    "entity_id" TEXT NOT NULL,
    "consultant_id" UUID NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "wht_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "wht_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(15,2) NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "cert_issued" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultant_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esop_grants" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "grant_date" DATE NOT NULL,
    "grant_type" TEXT NOT NULL DEFAULT 'equity',
    "value_type" TEXT NOT NULL DEFAULT 'shares',
    "shares" INTEGER NOT NULL DEFAULT 0,
    "currency_code" TEXT,
    "currency_amount" DECIMAL(15,2),
    "percent_of_base" DECIMAL(5,2),
    "vesting_months" INTEGER,
    "cliff_months" INTEGER,
    "lock_months" INTEGER,
    "strike_price" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "allocation_mode" TEXT NOT NULL DEFAULT 'one_time',
    "monthly_amount" DECIMAL(15,2),
    "allocation_start_month" DATE,
    "allocation_end_month" DATE,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "exercised_shares" INTEGER NOT NULL DEFAULT 0,
    "vested_to_date_override" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "esop_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity_monthly_salary" (
    "id" UUID NOT NULL,
    "employee_name" TEXT NOT NULL,
    "position" TEXT,
    "start_date" DATE,
    "currency" TEXT,
    "year" INTEGER NOT NULL,
    "monthly_shares" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_monthly_salary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_agreements" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "effective_date" DATE,
    "expiry_date" DATE,
    "notes" TEXT,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_runs" (
    "id" UUID NOT NULL,
    "employee_id" UUID,
    "employee_name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "tasks" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "entity_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offboarding_runs" (
    "id" UUID NOT NULL,
    "employee_id" UUID,
    "employee_name" TEXT NOT NULL,
    "position" TEXT,
    "department" TEXT NOT NULL,
    "last_working_day" DATE NOT NULL,
    "tasks" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "employee_sign_name" TEXT,
    "employee_signed_at" TIMESTAMP(3),
    "hr_sign_name" TEXT,
    "hr_signed_at" TIMESTAMP(3),
    "entity_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offboarding_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_modules" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "duration" INTEGER,
    "url" TEXT,
    "file_url" TEXT,
    "file_name" TEXT,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_completions" (
    "employee_id" UUID NOT NULL,
    "module_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER,

    CONSTRAINT "training_completions_pkey" PRIMARY KEY ("employee_id","module_id")
);

-- CreateTable
CREATE TABLE "visa_records" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "holder_type" TEXT NOT NULL DEFAULT 'employee',
    "holder_name" TEXT,
    "holder_relationship" TEXT,
    "visa_type" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "nationality" TEXT,
    "issue_date" DATE,
    "expiry_date" DATE NOT NULL,
    "work_permit_number" TEXT,
    "work_permit_issue_date" DATE,
    "work_permit_expiry_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'active',
    "document_url" TEXT,
    "documents" JSONB NOT NULL DEFAULT '[]',
    "last_reminder_sent_at" TIMESTAMP(3),
    "last_reminder_milestone_days" INTEGER,
    "status_changed_at" TIMESTAMP(3),
    "notes" TEXT,
    "entity_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visa_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visa_event_logs" (
    "id" UUID NOT NULL,
    "visa_record_id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_type" TEXT NOT NULL DEFAULT 'user',
    "kind" TEXT NOT NULL,
    "field" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visa_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visa_knowledge_articles" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "country" TEXT,
    "visa_type" TEXT,
    "tags" TEXT[],
    "required_permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visa_knowledge_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visa_checklist_templates" (
    "id" UUID NOT NULL,
    "visa_type" TEXT NOT NULL,
    "country" TEXT,
    "name" TEXT NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visa_checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visa_checklist_items" (
    "id" UUID NOT NULL,
    "visa_record_id" UUID NOT NULL,
    "template_item_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "completed_by_id" UUID,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visa_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ninety_day_notifications" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "entity_id" TEXT,
    "holder_type" TEXT NOT NULL DEFAULT 'employee',
    "holder_name" TEXT,
    "holder_relationship" TEXT,
    "last_arrival_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "receipt_url" TEXT,
    "receipt_name" TEXT,
    "receipt_mime_type" TEXT,
    "last_reminder_milestone_days" INTEGER,
    "last_reminder_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ninety_day_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefits" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "provider" TEXT,
    "cost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "entity_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_enrollments" (
    "id" UUID NOT NULL,
    "benefit_id" TEXT NOT NULL,
    "employee_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "benefit_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_policies" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "description" TEXT,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "version" VARCHAR(40),
    "effective_date" DATE,
    "entity_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_approval_steps" (
    "id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "approver_user_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_policies" (
    "id" UUID NOT NULL,
    "entity_id" TEXT,
    "shift_start_time" VARCHAR(5) NOT NULL DEFAULT '09:00',
    "shift_end_time" VARCHAR(5) NOT NULL DEFAULT '18:00',
    "grace_minutes" INTEGER NOT NULL DEFAULT 15,
    "half_day_threshold_hours" DECIMAL(4,2) NOT NULL DEFAULT 4,
    "minimum_working_hours" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "allowed_work_modes" JSONB NOT NULL DEFAULT '["office","remote","hybrid"]',
    "weekend_days" JSONB NOT NULL DEFAULT '[0,6]',
    "attendance_threshold_pct" INTEGER NOT NULL DEFAULT 80,
    "default_timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Bangkok',
    "missed_check_in_after_minutes" INTEGER NOT NULL DEFAULT 120,
    "missed_check_out_after_minutes" INTEGER NOT NULL DEFAULT 60,
    "consecutive_absence_alert_days" INTEGER NOT NULL DEFAULT 3,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_corrections" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "attendance_record_id" UUID,
    "attendance_date" DATE NOT NULL,
    "correction_type" VARCHAR(40) NOT NULL,
    "reason" TEXT NOT NULL,
    "comments" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "proposed_check_in" TIMESTAMP(3),
    "proposed_check_out" TIMESTAMP(3),
    "proposed_work_mode" VARCHAR(20),
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "reject_remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_shifts" (
    "id" UUID NOT NULL,
    "entity_id" TEXT,
    "shift_name" VARCHAR(80) NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "grace_minutes" INTEGER NOT NULL DEFAULT 15,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_employee_shifts" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_employee_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_exceptions" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'approved',
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "attendance_date" DATE NOT NULL,
    "check_in" TIMESTAMP(3),
    "check_out" TIMESTAMP(3),
    "employee_timezone" VARCHAR(64),
    "check_in_utc" TIMESTAMPTZ(6),
    "check_out_utc" TIMESTAMPTZ(6),
    "local_check_in_time" VARCHAR(40),
    "local_check_out_time" VARCHAR(40),
    "work_mode" VARCHAR(20) NOT NULL DEFAULT 'office',
    "status" VARCHAR(20) NOT NULL DEFAULT 'absent',
    "total_hours" DECIMAL(5,2),
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_audit_logs" (
    "id" UUID NOT NULL,
    "record_id" UUID,
    "employee_id" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "actor_id" UUID,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "recipient_name" VARCHAR(200) NOT NULL,
    "recipient_email" VARCHAR(255) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT,
    "type" VARCHAR(40) NOT NULL DEFAULT 'achievement',
    "signatories" JSONB NOT NULL DEFAULT '[]',
    "file_url" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "issued_by_id" UUID,
    "issued_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_google_connections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_email" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "token_type" TEXT NOT NULL DEFAULT 'Bearer',
    "encryption_version" INTEGER NOT NULL DEFAULT 1,
    "last_crm_email_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_google_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_oauth_states" (
    "state" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "redirect" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_oauth_states_pkey" PRIMARY KEY ("state")
);

-- CreateTable
CREATE TABLE "investors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "website" TEXT,
    "location" TEXT,
    "notes" JSONB,
    "visibility" TEXT NOT NULL DEFAULT 'team',
    "status" TEXT NOT NULL DEFAULT 'investors',
    "title" TEXT,
    "linkedin_url" TEXT,
    "revenue_stream" TEXT,
    "last_contact_date" DATE,
    "next_action" TEXT,
    "act_investment" TEXT,
    "est_investment" TEXT,
    "cross_sell" TEXT,
    "region" TEXT,
    "notes_text" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "added_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_tasks" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "due_date" DATE NOT NULL,
    "investor_id" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_activities" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "duration_mins" INTEGER,
    "investor_id" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investor_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_type_options" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_type_options_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "investor_leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "website" TEXT,
    "location" TEXT,
    "region" TEXT,
    "notes" TEXT,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_contacts" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "account_id" TEXT,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_pipeline_stages" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'border-t-zinc-500',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_pipeline_stages_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "investments" (
    "id" UUID NOT NULL,
    "investor_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "valuation" DECIMAL(15,2),
    "shares" INTEGER,
    "date" DATE NOT NULL,
    "round" TEXT,
    "status" TEXT NOT NULL DEFAULT 'committed',
    "terms" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_room_documents" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_room_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_updates" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sent_at" TIMESTAMP(3),
    "sent_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_vendors" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "contact_person" VARCHAR(200),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "notes" TEXT,
    "attachments" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "it_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_subscriptions" (
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
    "total_seats" INTEGER,
    "assigned_seats" INTEGER NOT NULL DEFAULT 0,
    "active_seats" INTEGER NOT NULL DEFAULT 0,
    "renewal_decision" TEXT,
    "renewal_decision_at" TIMESTAMP(3),
    "renewal_decision_by" UUID,
    "renewal_decision_notes" TEXT,
    "attachments" JSONB,
    "last_reminder_sent_at" TIMESTAMP(3),
    "reminders_sent" JSONB NOT NULL DEFAULT '[]',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "it_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_billing_records" (
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

-- CreateTable
CREATE TABLE "it_billing_alerts" (
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

-- CreateTable
CREATE TABLE "it_systems" (
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

-- CreateTable
CREATE TABLE "it_access_requests" (
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

-- CreateTable
CREATE TABLE "it_access_approval_decisions" (
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

-- CreateTable
CREATE TABLE "it_access_assignments" (
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

-- CreateTable
CREATE TABLE "it_access_audit_logs" (
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

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reference" TEXT,
    "parties" TEXT[],
    "owner_id" UUID,
    "entity_id" TEXT,
    "effective_date" DATE,
    "expiry_date" DATE,
    "renewal_lead_days" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'active',
    "file_url" TEXT,
    "file_name" TEXT,
    "folder" TEXT,
    "alert_category" TEXT,
    "notes" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_document_shares" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "user_id" UUID,
    "department" TEXT,
    "group_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_document_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_document_attachments" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "label" TEXT,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "effective_date" DATE,
    "expiry_date" DATE,
    "notes" TEXT,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_document_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_signatures" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "signer_email" TEXT NOT NULL,
    "signer_name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invite_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "viewed_at" TIMESTAMP(3),
    "signed_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "decline_reason" TEXT,
    "signature_text" TEXT,
    "signature_method" TEXT,
    "signed_ip" TEXT,
    "signed_user_agent" TEXT,
    "expires_at" TIMESTAMP(3),
    "provider" TEXT NOT NULL DEFAULT 'inhouse',
    "docusign_envelope_id" TEXT,
    "signing_order" INTEGER NOT NULL DEFAULT 1,
    "docusign_signer_status" TEXT,
    "signed_pdf_url" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_docusign_connections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "access_token_enc" TEXT NOT NULL,
    "refresh_token_enc" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "account_id" TEXT NOT NULL,
    "base_uri" TEXT NOT NULL,
    "scopes" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_docusign_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_announcements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "entity_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "requires_ack" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_announcement_attachments" (
    "id" UUID NOT NULL,
    "announcement_id" UUID NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_announcement_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_announcement_acks" (
    "announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "acked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acked_ip" TEXT,

    CONSTRAINT "legal_announcement_acks_pkey" PRIMARY KEY ("announcement_id","user_id")
);

-- CreateTable
CREATE TABLE "legal_notification_settings" (
    "id" UUID NOT NULL,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notify_contract_expiry" BOOLEAN NOT NULL DEFAULT true,
    "notify_contract_review" BOOLEAN NOT NULL DEFAULT true,
    "notify_initial_drafting" BOOLEAN NOT NULL DEFAULT true,
    "notify_licence_renewal" BOOLEAN NOT NULL DEFAULT true,
    "notify_compliance_filing" BOOLEAN NOT NULL DEFAULT true,
    "notify_counterparty_review" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'prospect',
    "region" TEXT,
    "country" TEXT,
    "website" TEXT,
    "description" TEXT,
    "contract_value" DECIMAL(15,2),
    "contract_start" DATE,
    "contract_end" DATE,
    "notes" TEXT,
    "production_live_date" DATE,
    "go_live_date" DATE,
    "revised_go_live_date" DATE,
    "past_campaign_date" DATE,
    "next_campaign_date" DATE,
    "dependency" TEXT,
    "comment" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "owner_id" UUID,
    "department" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_contacts" (
    "id" UUID NOT NULL,
    "partner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "partner_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_members" (
    "id" UUID NOT NULL,
    "partner_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_columns" (
    "id" UUID NOT NULL,
    "partner_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'bg-zinc-500',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "partner_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_tasks" (
    "id" UUID NOT NULL,
    "partner_id" TEXT NOT NULL,
    "parent_task_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "owner_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_task_resources" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,

    CONSTRAINT "partner_task_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_task_comments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_task_assignees" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "allocation_pct" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "contact" TEXT,
    "value" DECIMAL(15,2) NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'lead',
    "probability" INTEGER NOT NULL DEFAULT 10,
    "close_date" DATE,
    "type" TEXT,
    "country" TEXT,
    "notes" TEXT,
    "partner_id" TEXT,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not_yet_started',
    "owner_id" UUID NOT NULL,
    "partner_id" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "budget" DECIMAL(15,2),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "custom_fields" JSONB NOT NULL DEFAULT '[]',
    "production_live_date" DATE,
    "go_live_date" DATE,
    "revised_go_live_date" DATE,
    "agreement" TEXT,
    "dependency" TEXT,
    "comment" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "team" TEXT NOT NULL DEFAULT 'general',
    "department" TEXT,
    "workstream" TEXT,
    "details" TEXT,
    "task_type" TEXT,
    "assigned_team" TEXT,
    "default_assignee_mode" TEXT NOT NULL DEFAULT 'none',
    "default_assignee_id" UUID,
    "reminders_sent" JSONB NOT NULL DEFAULT '[]',
    "last_reminder_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_columns" (
    "id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'bg-zinc-500',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "project_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_tasks" (
    "id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "milestone_id" UUID,
    "parent_task_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'P1',
    "owner_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "reminders_sent" JSONB NOT NULL DEFAULT '[]',
    "last_reminder_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_task_comments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_task_activities" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "field" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_task_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_milestones" (
    "id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "owner_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_task_assignees" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "allocation_pct" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_task_dependencies" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "depends_on_task_id" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'finish_to_start',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_task_resources" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "doc_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,

    CONSTRAINT "project_task_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not_yet_started',
    "owner_id" UUID NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "production_live_date" DATE,
    "go_live_date" DATE,
    "revised_go_live_date" DATE,
    "dependency" TEXT,
    "comment" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "department" TEXT,
    "status_changed_at" TIMESTAMP(3),
    "health_status" TEXT,
    "effort_points" INTEGER,
    "archived_at" TIMESTAMP(3),
    "default_assignee_mode" TEXT NOT NULL DEFAULT 'none',
    "default_assignee_id" UUID,
    "reminders_sent" JSONB NOT NULL DEFAULT '[]',
    "last_reminder_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "it_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_project_members" (
    "id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "it_project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_project_columns" (
    "id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'bg-zinc-500',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "it_project_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_project_tasks" (
    "id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "parent_task_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "owner_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status_changed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "effort_points" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "it_project_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_project_task_comments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "it_project_task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_project_task_assignees" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "allocation_pct" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "it_project_task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_notifications" (
    "id" UUID NOT NULL,
    "module" TEXT NOT NULL DEFAULT 'it',
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link_url" TEXT,
    "project_id" TEXT,
    "task_id" UUID,
    "actor_id" UUID,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qa_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "owner_id" UUID NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "comment" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "department" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qa_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qa_project_members" (
    "id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qa_project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qa_project_columns" (
    "id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'bg-zinc-500',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "qa_project_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qa_project_tasks" (
    "id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "parent_task_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'P1',
    "owner_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "issue_date" DATE,
    "partner" TEXT,
    "product" TEXT,
    "issue_type" TEXT,
    "observation" TEXT,
    "expectation" TEXT,
    "eta" TEXT,
    "qa_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qa_project_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qa_project_task_comments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qa_project_task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qa_project_task_assignees" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "allocation_pct" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qa_project_task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not_yet_started',
    "owner_id" UUID NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "production_live_date" DATE,
    "go_live_date" DATE,
    "revised_go_live_date" DATE,
    "dependency" TEXT,
    "comment" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "department" TEXT,
    "workstream" TEXT,
    "details" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "default_assignee_mode" TEXT NOT NULL DEFAULT 'none',
    "default_assignee_id" UUID,
    "reminders_sent" JSONB NOT NULL DEFAULT '[]',
    "last_reminder_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_project_members" (
    "id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_project_columns" (
    "id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'bg-zinc-500',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "legal_project_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_project_tasks" (
    "id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "parent_task_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "owner_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_project_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_project_task_comments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_project_task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_project_task_assignees" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "allocation_pct" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_project_task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not_yet_started',
    "owner_id" UUID NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "production_live_date" DATE,
    "go_live_date" DATE,
    "revised_go_live_date" DATE,
    "dependency" TEXT,
    "comment" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "department" TEXT,
    "workstream" TEXT,
    "details" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "default_assignee_mode" TEXT NOT NULL DEFAULT 'none',
    "default_assignee_id" UUID,
    "reminders_sent" JSONB NOT NULL DEFAULT '[]',
    "last_reminder_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_project_members" (
    "id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_project_columns" (
    "id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'bg-zinc-500',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "accounting_project_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_project_tasks" (
    "id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "parent_task_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "owner_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_project_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_project_task_comments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_project_task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_project_task_assignees" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "allocation_pct" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_project_task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not_yet_started',
    "owner_id" UUID NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "production_live_date" DATE,
    "go_live_date" DATE,
    "revised_go_live_date" DATE,
    "dependency" TEXT,
    "comment" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "department" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_project_members" (
    "id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_project_columns" (
    "id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'bg-zinc-500',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_project_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_project_tasks" (
    "id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "parent_task_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "owner_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_project_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_project_task_comments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_project_task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_project_task_assignees" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "allocation_pct" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_project_task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "timezone" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "offices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "office_desks" (
    "id" UUID NOT NULL,
    "office_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floor" TEXT,
    "zone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "office_desks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "desk_bookings" (
    "id" UUID NOT NULL,
    "desk_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "desk_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_rooms" (
    "id" UUID NOT NULL,
    "office_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "amenities" TEXT,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "meeting_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_bookings" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "time_slot" TEXT NOT NULL,
    "end_time" TEXT,
    "title" TEXT,
    "description" TEXT,
    "attendees_count" INTEGER,
    "series_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "office_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "serial_no" TEXT,
    "assigned_to" UUID,
    "purchase_date" DATE,
    "purchase_cost" DECIMAL(15,2),
    "status" TEXT NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "colour" TEXT,
    "sub_type" TEXT,
    "operating_system" TEXT,
    "description" TEXT,
    "support_link" TEXT,
    "active_service_date" DATE,
    "department" TEXT,
    "asset_code" TEXT,
    "version" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "useful_life_months" INTEGER,
    "book_value" DECIMAL(15,2),
    "disposal_date" DATE,
    "selling_price" DECIMAL(15,2),

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner" VARCHAR(200) NOT NULL,
    "country" VARCHAR(120),
    "redeemed" INTEGER NOT NULL DEFAULT 0,
    "issued" INTEGER NOT NULL DEFAULT 0,
    "refund" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "added_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voucher_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appraisal_cycles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appraisal_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kra_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "department" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kra_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appraisals" (
    "id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "manager_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "self_rating" INTEGER,
    "self_comment" TEXT,
    "manager_rating" INTEGER,
    "manager_comment" TEXT,
    "final_rating" INTEGER,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appraisals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appraisal_kras" (
    "id" UUID NOT NULL,
    "appraisal_id" UUID NOT NULL,
    "kra_template_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "self_score" INTEGER,
    "manager_score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appraisal_kras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appraisal_comments" (
    "id" UUID NOT NULL,
    "appraisal_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appraisal_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appraisal_ratings" (
    "id" UUID NOT NULL,
    "appraisal_id" UUID NOT NULL,
    "rater_id" UUID NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appraisal_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "appraisal_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "self_score" INTEGER,
    "manager_score" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "default_route" VARCHAR(200),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_code" VARCHAR(100) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_code")
);

-- CreateTable
CREATE TABLE "module_access" (
    "user_id" UUID NOT NULL,
    "module_id" VARCHAR(50) NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "granted_by" UUID,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_access_pkey" PRIMARY KEY ("user_id","module_id")
);

-- CreateTable
CREATE TABLE "module_owners" (
    "module_id" VARCHAR(50) NOT NULL,
    "owner_id" UUID,

    CONSTRAINT "module_owners_pkey" PRIMARY KEY ("module_id")
);

-- CreateTable
CREATE TABLE "user_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_group_members" (
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added_by" UUID,

    CONSTRAINT "user_group_members_pkey" PRIMARY KEY ("group_id","user_id")
);

-- CreateTable
CREATE TABLE "crm_accounts" (
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

    CONSTRAINT "crm_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_contacts" (
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

    CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_leads" (
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

    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_opportunities" (
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

    CONSTRAINT "crm_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_activities" (
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

    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_stage_config" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "probability" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT 'border-t-zinc-500',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_stage_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "crm_lost_reasons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_lost_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lead_sources" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_tasks" (
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

    CONSTRAINT "crm_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_settings" (
    "id" UUID NOT NULL,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "notify_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notify_on_create" BOOLEAN NOT NULL DEFAULT true,
    "notify_owner_on_create" BOOLEAN NOT NULL DEFAULT true,
    "notify_owner_on_stage_change" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_settings_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" UUID NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id","key")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "storage_snapshots" (
    "id" UUID NOT NULL,
    "bucket" VARCHAR(100) NOT NULL,
    "bytes" BIGINT NOT NULL,
    "object_count" INTEGER NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_uploads" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "bucket" TEXT,
    "uploaded_by" UUID NOT NULL,
    "purpose" TEXT,
    "linked_to" TEXT,
    "linked_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_direct_key_key" ON "conversations"("direct_key");

-- CreateIndex
CREATE INDEX "conversations_created_by_idx" ON "conversations"("created_by");

-- CreateIndex
CREATE INDEX "conversations_type_idx" ON "conversations"("type");

-- CreateIndex
CREATE INDEX "conversations_updated_at_idx" ON "conversations"("updated_at" DESC);

-- CreateIndex
CREATE INDEX "conversation_members_user_id_left_at_idx" ON "conversation_members"("user_id", "left_at");

-- CreateIndex
CREATE INDEX "messages_author_id_idx" ON "messages"("author_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "message_hidden_for_user_id_idx" ON "message_hidden_for"("user_id");

-- CreateIndex
CREATE INDEX "message_reactions_user_id_idx" ON "message_reactions"("user_id");

-- CreateIndex
CREATE INDEX "wall_posts_created_at_idx" ON "wall_posts"("created_at" DESC);

-- CreateIndex
CREATE INDEX "wall_comments_post_id_idx" ON "wall_comments"("post_id");

-- CreateIndex
CREATE INDEX "company_news_created_at_idx" ON "company_news"("created_at" DESC);

-- CreateIndex
CREATE INDEX "company_dates_date_idx" ON "company_dates"("date");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_slug_key" ON "jobs"("slug");

-- CreateIndex
CREATE INDEX "jobs_active_idx" ON "jobs"("active");

-- CreateIndex
CREATE INDEX "jobs_department_idx" ON "jobs"("department");

-- CreateIndex
CREATE INDEX "applications_job_id_idx" ON "applications"("job_id");

-- CreateIndex
CREATE INDEX "applications_created_at_idx" ON "applications"("created_at" DESC);

-- CreateIndex
CREATE INDEX "blogs_created_at_idx" ON "blogs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "articles_created_at_idx" ON "articles"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "wiki_pages_slug_key" ON "wiki_pages"("slug");

-- CreateIndex
CREATE INDEX "wiki_pages_parent_id_position_idx" ON "wiki_pages"("parent_id", "position");

-- CreateIndex
CREATE INDEX "wiki_pages_folder_idx" ON "wiki_pages"("folder");

-- CreateIndex
CREATE INDEX "wiki_pages_is_published_updated_at_idx" ON "wiki_pages"("is_published", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "wiki_page_versions_page_id_created_at_idx" ON "wiki_page_versions"("page_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "wiki_page_versions_page_id_version_key" ON "wiki_page_versions"("page_id", "version");

-- CreateIndex
CREATE INDEX "wiki_page_permissions_user_id_idx" ON "wiki_page_permissions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_page_permissions_page_id_user_id_key" ON "wiki_page_permissions"("page_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "entities_code_key" ON "entities"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE INDEX "users_entity_id_idx" ON "users"("entity_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_token_hash_idx" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "auth_logs_email_action_created_at_idx" ON "auth_logs"("email", "action", "created_at");

-- CreateIndex
CREATE INDEX "auth_logs_ip_created_at_idx" ON "auth_logs"("ip", "created_at");

-- CreateIndex
CREATE INDEX "auth_logs_created_at_idx" ON "auth_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_parent_id_idx" ON "departments"("parent_id");

-- CreateIndex
CREATE INDEX "departments_is_active_idx" ON "departments"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "chart_of_accounts_entity_id_code_key" ON "chart_of_accounts"("entity_id", "code");

-- CreateIndex
CREATE INDEX "journal_entries_entity_id_status_idx" ON "journal_entries"("entity_id", "status");

-- CreateIndex
CREATE INDEX "journal_entry_lines_entry_id_idx" ON "journal_entry_lines"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_entity_id_invoice_no_key" ON "invoices"("entity_id", "invoice_no");

-- CreateIndex
CREATE INDEX "bank_transactions_entity_id_date_idx" ON "bank_transactions"("entity_id", "date");

-- CreateIndex
CREATE INDEX "exchange_rates_base_currency_currency_idx" ON "exchange_rates"("base_currency", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_base_currency_currency_effective_date_key" ON "exchange_rates"("base_currency", "currency", "effective_date");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");

-- CreateIndex
CREATE INDEX "vendors_entity_id_is_active_idx" ON "vendors"("entity_id", "is_active");

-- CreateIndex
CREATE INDEX "vendors_entity_id_name_idx" ON "vendors"("entity_id", "name");

-- CreateIndex
CREATE INDEX "vendors_contact_id_idx" ON "vendors"("contact_id");

-- CreateIndex
CREATE INDEX "vendors_tax_id_idx" ON "vendors"("tax_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_advance_requests_request_number_key" ON "cash_advance_requests"("request_number");

-- CreateIndex
CREATE INDEX "cash_advance_requests_employee_id_status_idx" ON "cash_advance_requests"("employee_id", "status");

-- CreateIndex
CREATE INDEX "cash_advance_requests_entity_id_idx" ON "cash_advance_requests"("entity_id");

-- CreateIndex
CREATE INDEX "cash_advance_requests_status_idx" ON "cash_advance_requests"("status");

-- CreateIndex
CREATE INDEX "cash_advance_requests_request_date_idx" ON "cash_advance_requests"("request_date");

-- CreateIndex
CREATE INDEX "cash_advance_requests_deleted_at_idx" ON "cash_advance_requests"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "cash_advance_approval_steps_order_key" ON "cash_advance_approval_steps"("order");

-- CreateIndex
CREATE INDEX "cash_advance_approval_decisions_approver_user_id_status_idx" ON "cash_advance_approval_decisions"("approver_user_id", "status");

-- CreateIndex
CREATE INDEX "cash_advance_approval_decisions_cash_advance_request_id_idx" ON "cash_advance_approval_decisions"("cash_advance_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_advance_approval_decisions_cash_advance_request_id_ord_key" ON "cash_advance_approval_decisions"("cash_advance_request_id", "order");

-- CreateIndex
CREATE INDEX "cash_advance_items_request_id_position_idx" ON "cash_advance_items"("request_id", "position");

-- CreateIndex
CREATE INDEX "expenses_employee_id_idx" ON "expenses"("employee_id");

-- CreateIndex
CREATE INDEX "expenses_status_idx" ON "expenses"("status");

-- CreateIndex
CREATE INDEX "expenses_travel_request_id_idx" ON "expenses"("travel_request_id");

-- CreateIndex
CREATE INDEX "expenses_report_id_idx" ON "expenses"("report_id");

-- CreateIndex
CREATE INDEX "expenses_deleted_at_idx" ON "expenses"("deleted_at");

-- CreateIndex
CREATE INDEX "expense_reports_employee_id_period_idx" ON "expense_reports"("employee_id", "period");

-- CreateIndex
CREATE INDEX "expense_reports_status_idx" ON "expense_reports"("status");

-- CreateIndex
CREATE INDEX "expense_reports_deleted_at_idx" ON "expense_reports"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "expense_approval_steps_order_key" ON "expense_approval_steps"("order");

-- CreateIndex
CREATE INDEX "expense_approval_decisions_approver_user_id_status_idx" ON "expense_approval_decisions"("approver_user_id", "status");

-- CreateIndex
CREATE INDEX "expense_approval_decisions_expense_report_id_idx" ON "expense_approval_decisions"("expense_report_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_approval_decisions_expense_report_id_order_key" ON "expense_approval_decisions"("expense_report_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "helpdesk_tickets_ticket_number_key" ON "helpdesk_tickets"("ticket_number");

-- CreateIndex
CREATE UNIQUE INDEX "helpdesk_tickets_github_issue_number_key" ON "helpdesk_tickets"("github_issue_number");

-- CreateIndex
CREATE INDEX "helpdesk_tickets_status_idx" ON "helpdesk_tickets"("status");

-- CreateIndex
CREATE INDEX "helpdesk_tickets_created_by_idx" ON "helpdesk_tickets"("created_by");

-- CreateIndex
CREATE INDEX "helpdesk_tickets_assignee_id_idx" ON "helpdesk_tickets"("assignee_id");

-- CreateIndex
CREATE INDEX "helpdesk_tickets_category_idx" ON "helpdesk_tickets"("category");

-- CreateIndex
CREATE INDEX "validator_node_alerts_enabled_idx" ON "validator_node_alerts"("enabled");

-- CreateIndex
CREATE INDEX "validator_node_alerts_node_id_idx" ON "validator_node_alerts"("node_id");

-- CreateIndex
CREATE UNIQUE INDEX "helpdesk_settings_singleton_key" ON "helpdesk_settings"("singleton");

-- CreateIndex
CREATE INDEX "helpdesk_comments_ticket_id_created_at_idx" ON "helpdesk_comments"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "survey_forms_status_idx" ON "survey_forms"("status");

-- CreateIndex
CREATE INDEX "survey_forms_created_by_id_idx" ON "survey_forms"("created_by_id");

-- CreateIndex
CREATE INDEX "survey_forms_archived_at_idx" ON "survey_forms"("archived_at");

-- CreateIndex
CREATE INDEX "survey_forms_end_date_idx" ON "survey_forms"("end_date");

-- CreateIndex
CREATE INDEX "survey_form_questions_survey_form_id_order_idx" ON "survey_form_questions"("survey_form_id", "order");

-- CreateIndex
CREATE INDEX "survey_form_responses_survey_form_id_idx" ON "survey_form_responses"("survey_form_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_form_responses_survey_form_id_respondent_id_key" ON "survey_form_responses"("survey_form_id", "respondent_id");

-- CreateIndex
CREATE INDEX "survey_form_answers_question_id_idx" ON "survey_form_answers"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_form_answers_response_id_question_id_key" ON "survey_form_answers"("response_id", "question_id");

-- CreateIndex
CREATE INDEX "surveys_status_idx" ON "surveys"("status");

-- CreateIndex
CREATE INDEX "surveys_created_by_id_idx" ON "surveys"("created_by_id");

-- CreateIndex
CREATE INDEX "surveys_archived_at_idx" ON "surveys"("archived_at");

-- CreateIndex
CREATE INDEX "surveys_end_date_idx" ON "surveys"("end_date");

-- CreateIndex
CREATE INDEX "survey_questions_survey_id_order_idx" ON "survey_questions"("survey_id", "order");

-- CreateIndex
CREATE INDEX "survey_responses_survey_id_idx" ON "survey_responses"("survey_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_responses_survey_id_respondent_id_key" ON "survey_responses"("survey_id", "respondent_id");

-- CreateIndex
CREATE INDEX "survey_answers_question_id_idx" ON "survey_answers"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_answers_response_id_question_id_key" ON "survey_answers"("response_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "travel_requests_request_code_key" ON "travel_requests"("request_code");

-- CreateIndex
CREATE INDEX "travel_requests_employee_id_idx" ON "travel_requests"("employee_id");

-- CreateIndex
CREATE INDEX "travel_requests_status_idx" ON "travel_requests"("status");

-- CreateIndex
CREATE INDEX "travel_requests_departure_date_idx" ON "travel_requests"("departure_date");

-- CreateIndex
CREATE INDEX "travel_requests_deleted_at_idx" ON "travel_requests"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "travel_approval_steps_order_key" ON "travel_approval_steps"("order");

-- CreateIndex
CREATE INDEX "travel_approval_decisions_approver_user_id_status_idx" ON "travel_approval_decisions"("approver_user_id", "status");

-- CreateIndex
CREATE INDEX "travel_approval_decisions_travel_request_id_idx" ON "travel_approval_decisions"("travel_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "travel_approval_decisions_travel_request_id_order_key" ON "travel_approval_decisions"("travel_request_id", "order");

-- CreateIndex
CREATE INDEX "leave_types_entity_id_is_active_idx" ON "leave_types"("entity_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_entity_id_code_key" ON "leave_types"("entity_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_entity_id_name_key" ON "leave_types"("entity_id", "name");

-- CreateIndex
CREATE INDEX "leave_policy_approvers_leave_type_id_idx" ON "leave_policy_approvers"("leave_type_id");

-- CreateIndex
CREATE INDEX "leave_policy_approvers_approver_user_id_idx" ON "leave_policy_approvers"("approver_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_policy_approvers_leave_type_id_order_key" ON "leave_policy_approvers"("leave_type_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employee_id_leave_type_id_year_key" ON "leave_balances"("employee_id", "leave_type_id", "year");

-- CreateIndex
CREATE INDEX "balance_transactions_employee_id_leave_type_id_year_idx" ON "balance_transactions"("employee_id", "leave_type_id", "year");

-- CreateIndex
CREATE INDEX "leave_requests_employee_id_idx" ON "leave_requests"("employee_id");

-- CreateIndex
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

-- CreateIndex
CREATE INDEX "leave_requests_delegated_to_idx" ON "leave_requests"("delegated_to");

-- CreateIndex
CREATE INDEX "leave_requests_deleted_at_idx" ON "leave_requests"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "leave_approval_steps_order_key" ON "leave_approval_steps"("order");

-- CreateIndex
CREATE INDEX "leave_approval_decisions_approver_user_id_status_idx" ON "leave_approval_decisions"("approver_user_id", "status");

-- CreateIndex
CREATE INDEX "leave_approval_decisions_leave_request_id_idx" ON "leave_approval_decisions"("leave_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_approval_decisions_leave_request_id_order_key" ON "leave_approval_decisions"("leave_request_id", "order");

-- CreateIndex
CREATE INDEX "public_holidays_entity_id_date_idx" ON "public_holidays"("entity_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "public_holidays_entity_id_date_key" ON "public_holidays"("entity_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_entity_id_period_key" ON "payroll_runs"("entity_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_payroll_run_id_employee_id_currency_key" ON "payslips"("payroll_run_id", "employee_id", "currency");

-- CreateIndex
CREATE INDEX "equity_monthly_salary_year_idx" ON "equity_monthly_salary"("year");

-- CreateIndex
CREATE INDEX "employee_agreements_employee_id_idx" ON "employee_agreements"("employee_id");

-- CreateIndex
CREATE INDEX "employee_agreements_type_idx" ON "employee_agreements"("type");

-- CreateIndex
CREATE INDEX "employee_agreements_expiry_date_idx" ON "employee_agreements"("expiry_date");

-- CreateIndex
CREATE INDEX "onboarding_runs_deleted_at_idx" ON "onboarding_runs"("deleted_at");

-- CreateIndex
CREATE INDEX "offboarding_runs_employee_id_idx" ON "offboarding_runs"("employee_id");

-- CreateIndex
CREATE INDEX "offboarding_runs_entity_id_idx" ON "offboarding_runs"("entity_id");

-- CreateIndex
CREATE INDEX "offboarding_runs_deleted_at_idx" ON "offboarding_runs"("deleted_at");

-- CreateIndex
CREATE INDEX "visa_records_employee_id_idx" ON "visa_records"("employee_id");

-- CreateIndex
CREATE INDEX "visa_records_expiry_date_idx" ON "visa_records"("expiry_date");

-- CreateIndex
CREATE INDEX "visa_records_work_permit_expiry_date_idx" ON "visa_records"("work_permit_expiry_date");

-- CreateIndex
CREATE INDEX "visa_records_deleted_at_idx" ON "visa_records"("deleted_at");

-- CreateIndex
CREATE INDEX "visa_event_logs_visa_record_id_created_at_idx" ON "visa_event_logs"("visa_record_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "visa_knowledge_articles_slug_key" ON "visa_knowledge_articles"("slug");

-- CreateIndex
CREATE INDEX "visa_knowledge_articles_country_visa_type_is_active_idx" ON "visa_knowledge_articles"("country", "visa_type", "is_active");

-- CreateIndex
CREATE INDEX "visa_knowledge_articles_slug_idx" ON "visa_knowledge_articles"("slug");

-- CreateIndex
CREATE INDEX "visa_checklist_templates_visa_type_is_active_idx" ON "visa_checklist_templates"("visa_type", "is_active");

-- CreateIndex
CREATE INDEX "visa_checklist_items_visa_record_id_idx" ON "visa_checklist_items"("visa_record_id");

-- CreateIndex
CREATE INDEX "ninety_day_notifications_employee_id_idx" ON "ninety_day_notifications"("employee_id");

-- CreateIndex
CREATE INDEX "ninety_day_notifications_due_date_idx" ON "ninety_day_notifications"("due_date");

-- CreateIndex
CREATE INDEX "ninety_day_notifications_entity_id_idx" ON "ninety_day_notifications"("entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "benefit_enrollments_benefit_id_employee_id_key" ON "benefit_enrollments"("benefit_id", "employee_id");

-- CreateIndex
CREATE INDEX "company_policies_category_idx" ON "company_policies"("category");

-- CreateIndex
CREATE INDEX "company_policies_entity_id_idx" ON "company_policies"("entity_id");

-- CreateIndex
CREATE INDEX "company_policies_is_active_idx" ON "company_policies"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_approval_steps_order_key" ON "payroll_approval_steps"("order");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_policies_entity_id_key" ON "attendance_policies"("entity_id");

-- CreateIndex
CREATE INDEX "attendance_corrections_employee_id_idx" ON "attendance_corrections"("employee_id");

-- CreateIndex
CREATE INDEX "attendance_corrections_status_idx" ON "attendance_corrections"("status");

-- CreateIndex
CREATE INDEX "attendance_corrections_attendance_date_idx" ON "attendance_corrections"("attendance_date");

-- CreateIndex
CREATE INDEX "attendance_shifts_entity_id_idx" ON "attendance_shifts"("entity_id");

-- CreateIndex
CREATE INDEX "attendance_employee_shifts_employee_id_idx" ON "attendance_employee_shifts"("employee_id");

-- CreateIndex
CREATE INDEX "attendance_employee_shifts_employee_id_effective_from_idx" ON "attendance_employee_shifts"("employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "attendance_employee_shifts_shift_id_idx" ON "attendance_employee_shifts"("shift_id");

-- CreateIndex
CREATE INDEX "attendance_exceptions_employee_id_idx" ON "attendance_exceptions"("employee_id");

-- CreateIndex
CREATE INDEX "attendance_exceptions_start_date_end_date_idx" ON "attendance_exceptions"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "attendance_records_attendance_date_idx" ON "attendance_records"("attendance_date");

-- CreateIndex
CREATE INDEX "attendance_records_status_idx" ON "attendance_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_employee_id_attendance_date_key" ON "attendance_records"("employee_id", "attendance_date");

-- CreateIndex
CREATE INDEX "attendance_audit_logs_employee_id_idx" ON "attendance_audit_logs"("employee_id");

-- CreateIndex
CREATE INDEX "attendance_audit_logs_record_id_idx" ON "attendance_audit_logs"("record_id");

-- CreateIndex
CREATE INDEX "attendance_audit_logs_created_at_idx" ON "attendance_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "certificates_recipient_id_idx" ON "certificates"("recipient_id");

-- CreateIndex
CREATE INDEX "certificates_issued_by_id_idx" ON "certificates"("issued_by_id");

-- CreateIndex
CREATE INDEX "certificates_status_idx" ON "certificates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_google_connections_user_id_key" ON "user_google_connections"("user_id");

-- CreateIndex
CREATE INDEX "user_google_connections_user_id_idx" ON "user_google_connections"("user_id");

-- CreateIndex
CREATE INDEX "google_oauth_states_user_id_idx" ON "google_oauth_states"("user_id");

-- CreateIndex
CREATE INDEX "investor_tasks_investor_id_idx" ON "investor_tasks"("investor_id");

-- CreateIndex
CREATE INDEX "investor_tasks_owner_id_status_due_date_idx" ON "investor_tasks"("owner_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "investor_activities_investor_id_idx" ON "investor_activities"("investor_id");

-- CreateIndex
CREATE INDEX "investor_activities_occurred_at_idx" ON "investor_activities"("occurred_at");

-- CreateIndex
CREATE INDEX "investor_type_options_sort_order_idx" ON "investor_type_options"("sort_order");

-- CreateIndex
CREATE INDEX "investor_leads_owner_id_status_idx" ON "investor_leads"("owner_id", "status");

-- CreateIndex
CREATE INDEX "investor_accounts_owner_id_idx" ON "investor_accounts"("owner_id");

-- CreateIndex
CREATE INDEX "investor_contacts_owner_id_idx" ON "investor_contacts"("owner_id");

-- CreateIndex
CREATE INDEX "investor_contacts_account_id_idx" ON "investor_contacts"("account_id");

-- CreateIndex
CREATE INDEX "investor_pipeline_stages_sort_order_idx" ON "investor_pipeline_stages"("sort_order");

-- CreateIndex
CREATE INDEX "it_vendors_is_active_idx" ON "it_vendors"("is_active");

-- CreateIndex
CREATE INDEX "it_subscriptions_vendor_id_idx" ON "it_subscriptions"("vendor_id");

-- CreateIndex
CREATE INDEX "it_subscriptions_status_idx" ON "it_subscriptions"("status");

-- CreateIndex
CREATE INDEX "it_subscriptions_renewal_date_idx" ON "it_subscriptions"("renewal_date");

-- CreateIndex
CREATE INDEX "it_subscriptions_payment_status_idx" ON "it_subscriptions"("payment_status");

-- CreateIndex
CREATE INDEX "it_billing_records_subscription_id_idx" ON "it_billing_records"("subscription_id");

-- CreateIndex
CREATE INDEX "it_billing_records_payment_status_idx" ON "it_billing_records"("payment_status");

-- CreateIndex
CREATE INDEX "it_billing_alerts_subscription_id_idx" ON "it_billing_alerts"("subscription_id");

-- CreateIndex
CREATE INDEX "it_billing_alerts_acknowledged_idx" ON "it_billing_alerts"("acknowledged");

-- CreateIndex
CREATE INDEX "it_billing_alerts_alert_type_idx" ON "it_billing_alerts"("alert_type");

-- CreateIndex
CREATE UNIQUE INDEX "it_systems_name_key" ON "it_systems"("name");

-- CreateIndex
CREATE INDEX "it_systems_is_active_idx" ON "it_systems"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "it_access_requests_request_number_key" ON "it_access_requests"("request_number");

-- CreateIndex
CREATE INDEX "it_access_requests_employee_id_status_idx" ON "it_access_requests"("employee_id", "status");

-- CreateIndex
CREATE INDEX "it_access_requests_status_idx" ON "it_access_requests"("status");

-- CreateIndex
CREATE INDEX "it_access_requests_system_id_idx" ON "it_access_requests"("system_id");

-- CreateIndex
CREATE INDEX "it_access_approval_decisions_approver_user_id_status_idx" ON "it_access_approval_decisions"("approver_user_id", "status");

-- CreateIndex
CREATE INDEX "it_access_approval_decisions_request_id_idx" ON "it_access_approval_decisions"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "it_access_approval_decisions_request_id_order_key" ON "it_access_approval_decisions"("request_id", "order");

-- CreateIndex
CREATE INDEX "it_access_assignments_employee_id_status_idx" ON "it_access_assignments"("employee_id", "status");

-- CreateIndex
CREATE INDEX "it_access_assignments_system_id_idx" ON "it_access_assignments"("system_id");

-- CreateIndex
CREATE INDEX "it_access_assignments_status_idx" ON "it_access_assignments"("status");

-- CreateIndex
CREATE INDEX "it_access_audit_logs_request_id_idx" ON "it_access_audit_logs"("request_id");

-- CreateIndex
CREATE INDEX "it_access_audit_logs_assignment_id_idx" ON "it_access_audit_logs"("assignment_id");

-- CreateIndex
CREATE INDEX "it_access_audit_logs_target_user_id_idx" ON "it_access_audit_logs"("target_user_id");

-- CreateIndex
CREATE INDEX "it_access_audit_logs_created_at_idx" ON "it_access_audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "legal_documents_expiry_date_idx" ON "legal_documents"("expiry_date");

-- CreateIndex
CREATE INDEX "legal_documents_kind_status_idx" ON "legal_documents"("kind", "status");

-- CreateIndex
CREATE INDEX "legal_documents_entity_id_idx" ON "legal_documents"("entity_id");

-- CreateIndex
CREATE INDEX "legal_documents_folder_idx" ON "legal_documents"("folder");

-- CreateIndex
CREATE INDEX "legal_documents_visibility_idx" ON "legal_documents"("visibility");

-- CreateIndex
CREATE INDEX "legal_document_shares_document_id_idx" ON "legal_document_shares"("document_id");

-- CreateIndex
CREATE INDEX "legal_document_shares_user_id_idx" ON "legal_document_shares"("user_id");

-- CreateIndex
CREATE INDEX "legal_document_shares_department_idx" ON "legal_document_shares"("department");

-- CreateIndex
CREATE INDEX "legal_document_shares_group_id_idx" ON "legal_document_shares"("group_id");

-- CreateIndex
CREATE INDEX "legal_document_attachments_document_id_idx" ON "legal_document_attachments"("document_id");

-- CreateIndex
CREATE INDEX "legal_document_attachments_expiry_date_idx" ON "legal_document_attachments"("expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "legal_signatures_token_key" ON "legal_signatures"("token");

-- CreateIndex
CREATE INDEX "legal_signatures_document_id_idx" ON "legal_signatures"("document_id");

-- CreateIndex
CREATE INDEX "legal_signatures_status_idx" ON "legal_signatures"("status");

-- CreateIndex
CREATE INDEX "legal_signatures_token_idx" ON "legal_signatures"("token");

-- CreateIndex
CREATE INDEX "legal_signatures_docusign_envelope_id_idx" ON "legal_signatures"("docusign_envelope_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_docusign_connections_user_id_key" ON "user_docusign_connections"("user_id");

-- CreateIndex
CREATE INDEX "legal_announcements_status_published_at_idx" ON "legal_announcements"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "legal_announcements_entity_id_idx" ON "legal_announcements"("entity_id");

-- CreateIndex
CREATE INDEX "legal_announcements_kind_idx" ON "legal_announcements"("kind");

-- CreateIndex
CREATE INDEX "legal_announcement_attachments_announcement_id_idx" ON "legal_announcement_attachments"("announcement_id");

-- CreateIndex
CREATE INDEX "legal_announcement_acks_user_id_idx" ON "legal_announcement_acks"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "legal_notification_settings_singleton_key" ON "legal_notification_settings"("singleton");

-- CreateIndex
CREATE UNIQUE INDEX "partners_slug_key" ON "partners"("slug");

-- CreateIndex
CREATE INDEX "partners_sort_order_idx" ON "partners"("sort_order");

-- CreateIndex
CREATE INDEX "partners_owner_id_idx" ON "partners"("owner_id");

-- CreateIndex
CREATE INDEX "partners_department_idx" ON "partners"("department");

-- CreateIndex
CREATE UNIQUE INDEX "partner_members_partner_id_user_id_key" ON "partner_members"("partner_id", "user_id");

-- CreateIndex
CREATE INDEX "partner_columns_partner_id_idx" ON "partner_columns"("partner_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_columns_partner_id_key_key" ON "partner_columns"("partner_id", "key");

-- CreateIndex
CREATE INDEX "partner_tasks_partner_id_idx" ON "partner_tasks"("partner_id");

-- CreateIndex
CREATE INDEX "partner_tasks_parent_task_id_idx" ON "partner_tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "partner_task_resources_task_id_idx" ON "partner_task_resources"("task_id");

-- CreateIndex
CREATE INDEX "partner_task_comments_task_id_idx" ON "partner_task_comments"("task_id");

-- CreateIndex
CREATE INDEX "partner_task_comments_author_id_idx" ON "partner_task_comments"("author_id");

-- CreateIndex
CREATE INDEX "partner_task_assignees_user_id_idx" ON "partner_task_assignees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_task_assignees_task_id_user_id_key" ON "partner_task_assignees"("task_id", "user_id");

-- CreateIndex
CREATE INDEX "deals_stage_idx" ON "deals"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "projects_sort_order_idx" ON "projects"("sort_order");

-- CreateIndex
CREATE INDEX "projects_team_idx" ON "projects"("team");

-- CreateIndex
CREATE INDEX "projects_department_idx" ON "projects"("department");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "project_columns_project_id_idx" ON "project_columns"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_columns_project_id_key_key" ON "project_columns"("project_id", "key");

-- CreateIndex
CREATE INDEX "project_tasks_project_id_idx" ON "project_tasks"("project_id");

-- CreateIndex
CREATE INDEX "project_tasks_parent_task_id_idx" ON "project_tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "project_tasks_milestone_id_idx" ON "project_tasks"("milestone_id");

-- CreateIndex
CREATE INDEX "project_task_comments_task_id_idx" ON "project_task_comments"("task_id");

-- CreateIndex
CREATE INDEX "project_task_activities_task_id_created_at_idx" ON "project_task_activities"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "project_milestones_project_id_idx" ON "project_milestones"("project_id");

-- CreateIndex
CREATE INDEX "project_task_assignees_task_id_idx" ON "project_task_assignees"("task_id");

-- CreateIndex
CREATE INDEX "project_task_assignees_user_id_idx" ON "project_task_assignees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_task_assignees_task_id_user_id_key" ON "project_task_assignees"("task_id", "user_id");

-- CreateIndex
CREATE INDEX "project_task_dependencies_task_id_idx" ON "project_task_dependencies"("task_id");

-- CreateIndex
CREATE INDEX "project_task_dependencies_depends_on_task_id_idx" ON "project_task_dependencies"("depends_on_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_task_dependencies_task_id_depends_on_task_id_key" ON "project_task_dependencies"("task_id", "depends_on_task_id");

-- CreateIndex
CREATE INDEX "project_task_resources_task_id_idx" ON "project_task_resources"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "it_projects_slug_key" ON "it_projects"("slug");

-- CreateIndex
CREATE INDEX "it_projects_sort_order_idx" ON "it_projects"("sort_order");

-- CreateIndex
CREATE INDEX "it_projects_department_idx" ON "it_projects"("department");

-- CreateIndex
CREATE INDEX "it_projects_archived_at_idx" ON "it_projects"("archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "it_project_members_project_id_user_id_key" ON "it_project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "it_project_columns_project_id_idx" ON "it_project_columns"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "it_project_columns_project_id_key_key" ON "it_project_columns"("project_id", "key");

-- CreateIndex
CREATE INDEX "it_project_tasks_project_id_idx" ON "it_project_tasks"("project_id");

-- CreateIndex
CREATE INDEX "it_project_tasks_parent_task_id_idx" ON "it_project_tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "it_project_task_comments_task_id_idx" ON "it_project_task_comments"("task_id");

-- CreateIndex
CREATE INDEX "it_project_task_comments_author_id_idx" ON "it_project_task_comments"("author_id");

-- CreateIndex
CREATE INDEX "it_project_task_assignees_user_id_idx" ON "it_project_task_assignees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "it_project_task_assignees_task_id_user_id_key" ON "it_project_task_assignees"("task_id", "user_id");

-- CreateIndex
CREATE INDEX "crm_notifications_user_id_created_at_idx" ON "crm_notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "crm_notifications_user_id_read_at_idx" ON "crm_notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "qa_projects_slug_key" ON "qa_projects"("slug");

-- CreateIndex
CREATE INDEX "qa_projects_sort_order_idx" ON "qa_projects"("sort_order");

-- CreateIndex
CREATE INDEX "qa_projects_department_idx" ON "qa_projects"("department");

-- CreateIndex
CREATE UNIQUE INDEX "qa_project_members_project_id_user_id_key" ON "qa_project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "qa_project_columns_project_id_idx" ON "qa_project_columns"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "qa_project_columns_project_id_key_key" ON "qa_project_columns"("project_id", "key");

-- CreateIndex
CREATE INDEX "qa_project_tasks_project_id_idx" ON "qa_project_tasks"("project_id");

-- CreateIndex
CREATE INDEX "qa_project_tasks_parent_task_id_idx" ON "qa_project_tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "qa_project_tasks_product_idx" ON "qa_project_tasks"("product");

-- CreateIndex
CREATE INDEX "qa_project_tasks_partner_idx" ON "qa_project_tasks"("partner");

-- CreateIndex
CREATE INDEX "qa_project_tasks_priority_idx" ON "qa_project_tasks"("priority");

-- CreateIndex
CREATE INDEX "qa_project_tasks_status_idx" ON "qa_project_tasks"("status");

-- CreateIndex
CREATE INDEX "qa_project_task_comments_task_id_idx" ON "qa_project_task_comments"("task_id");

-- CreateIndex
CREATE INDEX "qa_project_task_comments_author_id_idx" ON "qa_project_task_comments"("author_id");

-- CreateIndex
CREATE INDEX "qa_project_task_assignees_user_id_idx" ON "qa_project_task_assignees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "qa_project_task_assignees_task_id_user_id_key" ON "qa_project_task_assignees"("task_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "legal_projects_slug_key" ON "legal_projects"("slug");

-- CreateIndex
CREATE INDEX "legal_projects_sort_order_idx" ON "legal_projects"("sort_order");

-- CreateIndex
CREATE INDEX "legal_projects_department_idx" ON "legal_projects"("department");

-- CreateIndex
CREATE UNIQUE INDEX "legal_project_members_project_id_user_id_key" ON "legal_project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "legal_project_columns_project_id_idx" ON "legal_project_columns"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "legal_project_columns_project_id_key_key" ON "legal_project_columns"("project_id", "key");

-- CreateIndex
CREATE INDEX "legal_project_tasks_project_id_idx" ON "legal_project_tasks"("project_id");

-- CreateIndex
CREATE INDEX "legal_project_tasks_parent_task_id_idx" ON "legal_project_tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "legal_project_task_comments_task_id_idx" ON "legal_project_task_comments"("task_id");

-- CreateIndex
CREATE INDEX "legal_project_task_comments_author_id_idx" ON "legal_project_task_comments"("author_id");

-- CreateIndex
CREATE INDEX "legal_project_task_assignees_user_id_idx" ON "legal_project_task_assignees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "legal_project_task_assignees_task_id_user_id_key" ON "legal_project_task_assignees"("task_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_projects_slug_key" ON "accounting_projects"("slug");

-- CreateIndex
CREATE INDEX "accounting_projects_sort_order_idx" ON "accounting_projects"("sort_order");

-- CreateIndex
CREATE INDEX "accounting_projects_department_idx" ON "accounting_projects"("department");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_project_members_project_id_user_id_key" ON "accounting_project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "accounting_project_columns_project_id_idx" ON "accounting_project_columns"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_project_columns_project_id_key_key" ON "accounting_project_columns"("project_id", "key");

-- CreateIndex
CREATE INDEX "accounting_project_tasks_project_id_idx" ON "accounting_project_tasks"("project_id");

-- CreateIndex
CREATE INDEX "accounting_project_tasks_parent_task_id_idx" ON "accounting_project_tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "accounting_project_task_comments_task_id_idx" ON "accounting_project_task_comments"("task_id");

-- CreateIndex
CREATE INDEX "accounting_project_task_comments_author_id_idx" ON "accounting_project_task_comments"("author_id");

-- CreateIndex
CREATE INDEX "accounting_project_task_assignees_user_id_idx" ON "accounting_project_task_assignees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_project_task_assignees_task_id_user_id_key" ON "accounting_project_task_assignees"("task_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_projects_slug_key" ON "product_projects"("slug");

-- CreateIndex
CREATE INDEX "product_projects_sort_order_idx" ON "product_projects"("sort_order");

-- CreateIndex
CREATE INDEX "product_projects_department_idx" ON "product_projects"("department");

-- CreateIndex
CREATE UNIQUE INDEX "product_project_members_project_id_user_id_key" ON "product_project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "product_project_columns_project_id_idx" ON "product_project_columns"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_project_columns_project_id_key_key" ON "product_project_columns"("project_id", "key");

-- CreateIndex
CREATE INDEX "product_project_tasks_project_id_idx" ON "product_project_tasks"("project_id");

-- CreateIndex
CREATE INDEX "product_project_tasks_parent_task_id_idx" ON "product_project_tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "product_project_task_comments_task_id_idx" ON "product_project_task_comments"("task_id");

-- CreateIndex
CREATE INDEX "product_project_task_comments_author_id_idx" ON "product_project_task_comments"("author_id");

-- CreateIndex
CREATE INDEX "product_project_task_assignees_user_id_idx" ON "product_project_task_assignees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_project_task_assignees_task_id_user_id_key" ON "product_project_task_assignees"("task_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "desk_bookings_desk_id_date_key" ON "desk_bookings"("desk_id", "date");

-- CreateIndex
CREATE INDEX "room_bookings_room_id_date_idx" ON "room_bookings"("room_id", "date");

-- CreateIndex
CREATE INDEX "room_bookings_series_id_idx" ON "room_bookings"("series_id");

-- CreateIndex
CREATE INDEX "assets_type_idx" ON "assets"("type");

-- CreateIndex
CREATE INDEX "assets_status_idx" ON "assets"("status");

-- CreateIndex
CREATE INDEX "assets_asset_code_idx" ON "assets"("asset_code");

-- CreateIndex
CREATE INDEX "voucher_entries_partner_idx" ON "voucher_entries"("partner");

-- CreateIndex
CREATE INDEX "appraisals_employee_id_idx" ON "appraisals"("employee_id");

-- CreateIndex
CREATE INDEX "appraisals_manager_id_idx" ON "appraisals"("manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "appraisals_cycle_id_employee_id_key" ON "appraisals"("cycle_id", "employee_id");

-- CreateIndex
CREATE INDEX "appraisal_kras_appraisal_id_idx" ON "appraisal_kras"("appraisal_id");

-- CreateIndex
CREATE INDEX "appraisal_comments_appraisal_id_idx" ON "appraisal_comments"("appraisal_id");

-- CreateIndex
CREATE INDEX "appraisal_ratings_appraisal_id_idx" ON "appraisal_ratings"("appraisal_id");

-- CreateIndex
CREATE UNIQUE INDEX "appraisal_ratings_appraisal_id_rater_id_category_key" ON "appraisal_ratings"("appraisal_id", "rater_id", "category");

-- CreateIndex
CREATE INDEX "goals_appraisal_id_idx" ON "goals"("appraisal_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_groups_name_key" ON "user_groups"("name");

-- CreateIndex
CREATE UNIQUE INDEX "crm_accounts_domain_key" ON "crm_accounts"("domain");

-- CreateIndex
CREATE INDEX "crm_accounts_owner_id_idx" ON "crm_accounts"("owner_id");

-- CreateIndex
CREATE INDEX "crm_accounts_partner_id_idx" ON "crm_accounts"("partner_id");

-- CreateIndex
CREATE INDEX "crm_accounts_name_idx" ON "crm_accounts"("name");

-- CreateIndex
CREATE INDEX "crm_accounts_sort_order_idx" ON "crm_accounts"("sort_order");

-- CreateIndex
CREATE INDEX "crm_contacts_account_id_idx" ON "crm_contacts"("account_id");

-- CreateIndex
CREATE INDEX "crm_contacts_email_idx" ON "crm_contacts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "crm_leads_legacy_deal_id_key" ON "crm_leads"("legacy_deal_id");

-- CreateIndex
CREATE INDEX "crm_leads_owner_id_status_idx" ON "crm_leads"("owner_id", "status");

-- CreateIndex
CREATE INDEX "crm_leads_source_idx" ON "crm_leads"("source");

-- CreateIndex
CREATE UNIQUE INDEX "crm_opportunities_legacy_deal_id_key" ON "crm_opportunities"("legacy_deal_id");

-- CreateIndex
CREATE INDEX "crm_opportunities_stage_idx" ON "crm_opportunities"("stage");

-- CreateIndex
CREATE INDEX "crm_opportunities_stage_sort_order_within_stage_idx" ON "crm_opportunities"("stage", "sort_order_within_stage");

-- CreateIndex
CREATE INDEX "crm_opportunities_owner_id_stage_idx" ON "crm_opportunities"("owner_id", "stage");

-- CreateIndex
CREATE INDEX "crm_opportunities_account_id_idx" ON "crm_opportunities"("account_id");

-- CreateIndex
CREATE INDEX "crm_opportunities_close_date_idx" ON "crm_opportunities"("close_date");

-- CreateIndex
CREATE UNIQUE INDEX "crm_activities_external_ref_key" ON "crm_activities"("external_ref");

-- CreateIndex
CREATE INDEX "crm_activities_lead_id_idx" ON "crm_activities"("lead_id");

-- CreateIndex
CREATE INDEX "crm_activities_opportunity_id_idx" ON "crm_activities"("opportunity_id");

-- CreateIndex
CREATE INDEX "crm_activities_contact_id_idx" ON "crm_activities"("contact_id");

-- CreateIndex
CREATE INDEX "crm_activities_account_id_idx" ON "crm_activities"("account_id");

-- CreateIndex
CREATE INDEX "crm_activities_occurred_at_idx" ON "crm_activities"("occurred_at");

-- CreateIndex
CREATE INDEX "opportunity_stage_config_sort_order_idx" ON "opportunity_stage_config"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "crm_lost_reasons_code_key" ON "crm_lost_reasons"("code");

-- CreateIndex
CREATE INDEX "crm_lost_reasons_is_active_sort_order_idx" ON "crm_lost_reasons"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "crm_lead_sources_code_key" ON "crm_lead_sources"("code");

-- CreateIndex
CREATE INDEX "crm_lead_sources_is_active_sort_order_idx" ON "crm_lead_sources"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "crm_tasks_owner_id_status_due_date_idx" ON "crm_tasks"("owner_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "crm_tasks_opportunity_id_idx" ON "crm_tasks"("opportunity_id");

-- CreateIndex
CREATE INDEX "crm_tasks_lead_id_idx" ON "crm_tasks"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_settings_singleton_key" ON "crm_settings"("singleton");

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

-- CreateIndex
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_resource_resource_id_idx" ON "audit_log"("resource", "resource_id");

-- CreateIndex
CREATE INDEX "storage_snapshots_captured_at_idx" ON "storage_snapshots"("captured_at" DESC);

-- CreateIndex
CREATE INDEX "storage_snapshots_bucket_captured_at_idx" ON "storage_snapshots"("bucket", "captured_at" DESC);

-- CreateIndex
CREATE INDEX "file_uploads_uploaded_by_idx" ON "file_uploads"("uploaded_by");

-- CreateIndex
CREATE INDEX "file_uploads_linked_to_linked_id_idx" ON "file_uploads"("linked_to", "linked_id");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_hidden_for" ADD CONSTRAINT "message_hidden_for_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_hidden_for" ADD CONSTRAINT "message_hidden_for_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wall_posts" ADD CONSTRAINT "wall_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wall_comments" ADD CONSTRAINT "wall_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "wall_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wall_comments" ADD CONSTRAINT "wall_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_news" ADD CONSTRAINT "company_news_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_dates" ADD CONSTRAINT "company_dates_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "wiki_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_versions" ADD CONSTRAINT "wiki_page_versions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_versions" ADD CONSTRAINT "wiki_page_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_permissions" ADD CONSTRAINT "wiki_page_permissions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "wiki_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_page_permissions" ADD CONSTRAINT "wiki_page_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_reporting_to_fkey" FOREIGN KEY ("reporting_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_logs" ADD CONSTRAINT "auth_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_linked_je_id_fkey" FOREIGN KEY ("linked_je_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_suggested_account_fkey" FOREIGN KEY ("suggested_account") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_mapped_account_fkey" FOREIGN KEY ("mapped_account") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_advance_requests" ADD CONSTRAINT "cash_advance_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_advance_requests" ADD CONSTRAINT "cash_advance_requests_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_advance_requests" ADD CONSTRAINT "cash_advance_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_advance_approval_steps" ADD CONSTRAINT "cash_advance_approval_steps_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_advance_approval_decisions" ADD CONSTRAINT "cash_advance_approval_decisions_cash_advance_request_id_fkey" FOREIGN KEY ("cash_advance_request_id") REFERENCES "cash_advance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_advance_approval_decisions" ADD CONSTRAINT "cash_advance_approval_decisions_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_advance_approval_decisions" ADD CONSTRAINT "cash_advance_approval_decisions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_advance_items" ADD CONSTRAINT "cash_advance_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "cash_advance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_advance_items" ADD CONSTRAINT "cash_advance_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_travel_request_id_fkey" FOREIGN KEY ("travel_request_id") REFERENCES "travel_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "expense_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_approval_steps" ADD CONSTRAINT "expense_approval_steps_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_approval_decisions" ADD CONSTRAINT "expense_approval_decisions_expense_report_id_fkey" FOREIGN KEY ("expense_report_id") REFERENCES "expense_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_approval_decisions" ADD CONSTRAINT "expense_approval_decisions_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_approval_decisions" ADD CONSTRAINT "expense_approval_decisions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helpdesk_tickets" ADD CONSTRAINT "helpdesk_tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helpdesk_tickets" ADD CONSTRAINT "helpdesk_tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validator_node_alerts" ADD CONSTRAINT "validator_node_alerts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helpdesk_settings" ADD CONSTRAINT "helpdesk_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helpdesk_comments" ADD CONSTRAINT "helpdesk_comments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "helpdesk_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helpdesk_comments" ADD CONSTRAINT "helpdesk_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_forms" ADD CONSTRAINT "survey_forms_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_form_questions" ADD CONSTRAINT "survey_form_questions_survey_form_id_fkey" FOREIGN KEY ("survey_form_id") REFERENCES "survey_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_form_responses" ADD CONSTRAINT "survey_form_responses_survey_form_id_fkey" FOREIGN KEY ("survey_form_id") REFERENCES "survey_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_form_responses" ADD CONSTRAINT "survey_form_responses_respondent_id_fkey" FOREIGN KEY ("respondent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_form_answers" ADD CONSTRAINT "survey_form_answers_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "survey_form_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_form_answers" ADD CONSTRAINT "survey_form_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "survey_form_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_respondent_id_fkey" FOREIGN KEY ("respondent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "survey_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "survey_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_requests" ADD CONSTRAINT "travel_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_requests" ADD CONSTRAINT "travel_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_requests" ADD CONSTRAINT "travel_requests_delegated_to_fkey" FOREIGN KEY ("delegated_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_requests" ADD CONSTRAINT "travel_requests_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_approval_steps" ADD CONSTRAINT "travel_approval_steps_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_approval_decisions" ADD CONSTRAINT "travel_approval_decisions_travel_request_id_fkey" FOREIGN KEY ("travel_request_id") REFERENCES "travel_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_approval_decisions" ADD CONSTRAINT "travel_approval_decisions_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_approval_decisions" ADD CONSTRAINT "travel_approval_decisions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_policy_approvers" ADD CONSTRAINT "leave_policy_approvers_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_policy_approvers" ADD CONSTRAINT "leave_policy_approvers_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_transactions" ADD CONSTRAINT "balance_transactions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_transactions" ADD CONSTRAINT "balance_transactions_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_delegated_to_fkey" FOREIGN KEY ("delegated_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approval_steps" ADD CONSTRAINT "leave_approval_steps_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approval_decisions" ADD CONSTRAINT "leave_approval_decisions_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approval_decisions" ADD CONSTRAINT "leave_approval_decisions_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approval_decisions" ADD CONSTRAINT "leave_approval_decisions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_holidays" ADD CONSTRAINT "public_holidays_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_run_by_fkey" FOREIGN KEY ("run_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultant_invoices" ADD CONSTRAINT "consultant_invoices_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultant_invoices" ADD CONSTRAINT "consultant_invoices_consultant_id_fkey" FOREIGN KEY ("consultant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esop_grants" ADD CONSTRAINT "esop_grants_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_agreements" ADD CONSTRAINT "employee_agreements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_agreements" ADD CONSTRAINT "employee_agreements_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_runs" ADD CONSTRAINT "onboarding_runs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_runs" ADD CONSTRAINT "onboarding_runs_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offboarding_runs" ADD CONSTRAINT "offboarding_runs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offboarding_runs" ADD CONSTRAINT "offboarding_runs_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "training_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visa_records" ADD CONSTRAINT "visa_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visa_records" ADD CONSTRAINT "visa_records_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visa_event_logs" ADD CONSTRAINT "visa_event_logs_visa_record_id_fkey" FOREIGN KEY ("visa_record_id") REFERENCES "visa_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visa_event_logs" ADD CONSTRAINT "visa_event_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visa_knowledge_articles" ADD CONSTRAINT "visa_knowledge_articles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visa_checklist_items" ADD CONSTRAINT "visa_checklist_items_visa_record_id_fkey" FOREIGN KEY ("visa_record_id") REFERENCES "visa_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ninety_day_notifications" ADD CONSTRAINT "ninety_day_notifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ninety_day_notifications" ADD CONSTRAINT "ninety_day_notifications_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_enrollments" ADD CONSTRAINT "benefit_enrollments_benefit_id_fkey" FOREIGN KEY ("benefit_id") REFERENCES "benefits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_enrollments" ADD CONSTRAINT "benefit_enrollments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_policies" ADD CONSTRAINT "company_policies_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_policies" ADD CONSTRAINT "company_policies_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_approval_steps" ADD CONSTRAINT "payroll_approval_steps_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_shifts" ADD CONSTRAINT "attendance_shifts_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_employee_shifts" ADD CONSTRAINT "attendance_employee_shifts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_employee_shifts" ADD CONSTRAINT "attendance_employee_shifts_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "attendance_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_audit_logs" ADD CONSTRAINT "attendance_audit_logs_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_audit_logs" ADD CONSTRAINT "attendance_audit_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_audit_logs" ADD CONSTRAINT "attendance_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_google_connections" ADD CONSTRAINT "user_google_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investors" ADD CONSTRAINT "investors_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_tasks" ADD CONSTRAINT "investor_tasks_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_tasks" ADD CONSTRAINT "investor_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_activities" ADD CONSTRAINT "investor_activities_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_activities" ADD CONSTRAINT "investor_activities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_leads" ADD CONSTRAINT "investor_leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_accounts" ADD CONSTRAINT "investor_accounts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_contacts" ADD CONSTRAINT "investor_contacts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_contacts" ADD CONSTRAINT "investor_contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "investor_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_room_documents" ADD CONSTRAINT "data_room_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_updates" ADD CONSTRAINT "investor_updates_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_vendors" ADD CONSTRAINT "it_vendors_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_subscriptions" ADD CONSTRAINT "it_subscriptions_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "it_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_subscriptions" ADD CONSTRAINT "it_subscriptions_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_subscriptions" ADD CONSTRAINT "it_subscriptions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_subscriptions" ADD CONSTRAINT "it_subscriptions_renewal_decision_by_fkey" FOREIGN KEY ("renewal_decision_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_billing_records" ADD CONSTRAINT "it_billing_records_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "it_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_billing_records" ADD CONSTRAINT "it_billing_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_billing_alerts" ADD CONSTRAINT "it_billing_alerts_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "it_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_billing_alerts" ADD CONSTRAINT "it_billing_alerts_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_access_requests" ADD CONSTRAINT "it_access_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_access_requests" ADD CONSTRAINT "it_access_requests_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "it_systems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_access_requests" ADD CONSTRAINT "it_access_requests_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_access_approval_decisions" ADD CONSTRAINT "it_access_approval_decisions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "it_access_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_access_approval_decisions" ADD CONSTRAINT "it_access_approval_decisions_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_access_approval_decisions" ADD CONSTRAINT "it_access_approval_decisions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_access_assignments" ADD CONSTRAINT "it_access_assignments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "it_access_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_access_assignments" ADD CONSTRAINT "it_access_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_access_assignments" ADD CONSTRAINT "it_access_assignments_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "it_systems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_access_assignments" ADD CONSTRAINT "it_access_assignments_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_access_assignments" ADD CONSTRAINT "it_access_assignments_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_access_audit_logs" ADD CONSTRAINT "it_access_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_access_audit_logs" ADD CONSTRAINT "it_access_audit_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_document_shares" ADD CONSTRAINT "legal_document_shares_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_document_shares" ADD CONSTRAINT "legal_document_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_document_shares" ADD CONSTRAINT "legal_document_shares_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "user_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_document_shares" ADD CONSTRAINT "legal_document_shares_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_document_attachments" ADD CONSTRAINT "legal_document_attachments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_document_attachments" ADD CONSTRAINT "legal_document_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_signatures" ADD CONSTRAINT "legal_signatures_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_signatures" ADD CONSTRAINT "legal_signatures_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_docusign_connections" ADD CONSTRAINT "user_docusign_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_announcements" ADD CONSTRAINT "legal_announcements_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_announcements" ADD CONSTRAINT "legal_announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_announcement_attachments" ADD CONSTRAINT "legal_announcement_attachments_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "legal_announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_announcement_acks" ADD CONSTRAINT "legal_announcement_acks_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "legal_announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_announcement_acks" ADD CONSTRAINT "legal_announcement_acks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_contacts" ADD CONSTRAINT "partner_contacts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_members" ADD CONSTRAINT "partner_members_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_members" ADD CONSTRAINT "partner_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_columns" ADD CONSTRAINT "partner_columns_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_tasks" ADD CONSTRAINT "partner_tasks_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_tasks" ADD CONSTRAINT "partner_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_tasks" ADD CONSTRAINT "partner_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "partner_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_task_resources" ADD CONSTRAINT "partner_task_resources_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "partner_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_task_comments" ADD CONSTRAINT "partner_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "partner_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_task_comments" ADD CONSTRAINT "partner_task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_task_assignees" ADD CONSTRAINT "partner_task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "partner_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_task_assignees" ADD CONSTRAINT "partner_task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_columns" ADD CONSTRAINT "project_columns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_task_comments" ADD CONSTRAINT "project_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_task_comments" ADD CONSTRAINT "project_task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_task_activities" ADD CONSTRAINT "project_task_activities_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_task_activities" ADD CONSTRAINT "project_task_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_task_assignees" ADD CONSTRAINT "project_task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_task_assignees" ADD CONSTRAINT "project_task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_task_dependencies" ADD CONSTRAINT "project_task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_task_dependencies" ADD CONSTRAINT "project_task_dependencies_depends_on_task_id_fkey" FOREIGN KEY ("depends_on_task_id") REFERENCES "project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_task_resources" ADD CONSTRAINT "project_task_resources_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_task_resources" ADD CONSTRAINT "project_task_resources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_projects" ADD CONSTRAINT "it_projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_project_members" ADD CONSTRAINT "it_project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "it_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_project_members" ADD CONSTRAINT "it_project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_project_columns" ADD CONSTRAINT "it_project_columns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "it_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_project_tasks" ADD CONSTRAINT "it_project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "it_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_project_tasks" ADD CONSTRAINT "it_project_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_project_tasks" ADD CONSTRAINT "it_project_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "it_project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_project_task_comments" ADD CONSTRAINT "it_project_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "it_project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_project_task_comments" ADD CONSTRAINT "it_project_task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_project_task_assignees" ADD CONSTRAINT "it_project_task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "it_project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_project_task_assignees" ADD CONSTRAINT "it_project_task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_projects" ADD CONSTRAINT "qa_projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_project_members" ADD CONSTRAINT "qa_project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "qa_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_project_members" ADD CONSTRAINT "qa_project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_project_columns" ADD CONSTRAINT "qa_project_columns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "qa_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_project_tasks" ADD CONSTRAINT "qa_project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "qa_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_project_tasks" ADD CONSTRAINT "qa_project_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_project_tasks" ADD CONSTRAINT "qa_project_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "qa_project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_project_task_comments" ADD CONSTRAINT "qa_project_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "qa_project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_project_task_comments" ADD CONSTRAINT "qa_project_task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_project_task_assignees" ADD CONSTRAINT "qa_project_task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "qa_project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_project_task_assignees" ADD CONSTRAINT "qa_project_task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_projects" ADD CONSTRAINT "legal_projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_project_members" ADD CONSTRAINT "legal_project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "legal_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_project_members" ADD CONSTRAINT "legal_project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_project_columns" ADD CONSTRAINT "legal_project_columns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "legal_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_project_tasks" ADD CONSTRAINT "legal_project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "legal_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_project_tasks" ADD CONSTRAINT "legal_project_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_project_tasks" ADD CONSTRAINT "legal_project_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "legal_project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_project_task_comments" ADD CONSTRAINT "legal_project_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "legal_project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_project_task_comments" ADD CONSTRAINT "legal_project_task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_project_task_assignees" ADD CONSTRAINT "legal_project_task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "legal_project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_project_task_assignees" ADD CONSTRAINT "legal_project_task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_projects" ADD CONSTRAINT "accounting_projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_project_members" ADD CONSTRAINT "accounting_project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "accounting_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_project_members" ADD CONSTRAINT "accounting_project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_project_columns" ADD CONSTRAINT "accounting_project_columns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "accounting_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_project_tasks" ADD CONSTRAINT "accounting_project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "accounting_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_project_tasks" ADD CONSTRAINT "accounting_project_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_project_tasks" ADD CONSTRAINT "accounting_project_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "accounting_project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_project_task_comments" ADD CONSTRAINT "accounting_project_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "accounting_project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_project_task_comments" ADD CONSTRAINT "accounting_project_task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_project_task_assignees" ADD CONSTRAINT "accounting_project_task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "accounting_project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_project_task_assignees" ADD CONSTRAINT "accounting_project_task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_projects" ADD CONSTRAINT "product_projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_project_members" ADD CONSTRAINT "product_project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "product_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_project_members" ADD CONSTRAINT "product_project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_project_columns" ADD CONSTRAINT "product_project_columns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "product_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_project_tasks" ADD CONSTRAINT "product_project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "product_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_project_tasks" ADD CONSTRAINT "product_project_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_project_tasks" ADD CONSTRAINT "product_project_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "product_project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_project_task_comments" ADD CONSTRAINT "product_project_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "product_project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_project_task_comments" ADD CONSTRAINT "product_project_task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_project_task_assignees" ADD CONSTRAINT "product_project_task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "product_project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_project_task_assignees" ADD CONSTRAINT "product_project_task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_desks" ADD CONSTRAINT "office_desks_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desk_bookings" ADD CONSTRAINT "desk_bookings_desk_id_fkey" FOREIGN KEY ("desk_id") REFERENCES "office_desks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desk_bookings" ADD CONSTRAINT "desk_bookings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_rooms" ADD CONSTRAINT "meeting_rooms_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_bookings" ADD CONSTRAINT "room_bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "meeting_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_bookings" ADD CONSTRAINT "room_bookings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_entries" ADD CONSTRAINT "voucher_entries_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_cycles" ADD CONSTRAINT "appraisal_cycles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "appraisal_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_kras" ADD CONSTRAINT "appraisal_kras_appraisal_id_fkey" FOREIGN KEY ("appraisal_id") REFERENCES "appraisals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_kras" ADD CONSTRAINT "appraisal_kras_kra_template_id_fkey" FOREIGN KEY ("kra_template_id") REFERENCES "kra_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_comments" ADD CONSTRAINT "appraisal_comments_appraisal_id_fkey" FOREIGN KEY ("appraisal_id") REFERENCES "appraisals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_comments" ADD CONSTRAINT "appraisal_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_ratings" ADD CONSTRAINT "appraisal_ratings_appraisal_id_fkey" FOREIGN KEY ("appraisal_id") REFERENCES "appraisals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_ratings" ADD CONSTRAINT "appraisal_ratings_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_appraisal_id_fkey" FOREIGN KEY ("appraisal_id") REFERENCES "appraisals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_access" ADD CONSTRAINT "module_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_access" ADD CONSTRAINT "module_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_owners" ADD CONSTRAINT "module_owners_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "user_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_converted_opportunity_id_fkey" FOREIGN KEY ("converted_opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_settings" ADD CONSTRAINT "crm_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
