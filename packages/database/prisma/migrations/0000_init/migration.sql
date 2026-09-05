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
    "deleted_by" UUID,
    "deleted_for_everyone_at" TIMESTAMP(3),
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
    "added_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aria_conversations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aria_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aria_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aria_messages_pkey" PRIMARY KEY ("id")
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
    "passport_number" TEXT,
    "thai_id" TEXT,
    "tax_id" TEXT,
    "work_permit_type" TEXT,
    "visa_type" TEXT,
    "permit_number" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
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
CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20),
    "description" TEXT,
    "head_id" UUID,
    "parent_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
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
    "type" TEXT NOT NULL,
    "parent_id" TEXT,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entry_no" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "from_expense" UUID,
    "created_by" UUID NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "posted_at" TIMESTAMP(3),
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
CREATE TABLE "bnry_transactions" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "je_ref" VARCHAR(30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bnry_transactions_pkey" PRIMARY KEY ("id")
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

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "entity_id" TEXT NOT NULL,
    "category_id" TEXT,
    "travel_request_id" UUID,
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_definitions" (
    "id" UUID NOT NULL,
    "version_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "sections_schema" JSONB NOT NULL,
    "demographics_schema" JSONB NOT NULL DEFAULT '{}',
    "feedback_columns" JSONB NOT NULL DEFAULT '[]',
    "total_questions" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_waves" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "definition_id" UUID NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "response_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_waves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" UUID NOT NULL,
    "wave_id" UUID NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "tenure" VARCHAR(30) NOT NULL,
    "role_level" VARCHAR(30) NOT NULL,
    "work_setup" VARCHAR(20) NOT NULL,
    "sections" JSONB NOT NULL,
    "feedback_start_doing" TEXT,
    "feedback_stop_doing" TEXT,
    "feedback_continue_doing" TEXT,
    "feedback_general" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_jobs" (
    "id" UUID NOT NULL,
    "wave_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "error_report" JSONB NOT NULL DEFAULT '[]',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_requests" (
    "id" UUID NOT NULL,
    "request_code" VARCHAR(20) NOT NULL,
    "employee_id" UUID NOT NULL,
    "entity_id" TEXT,
    "destination" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "departure_date" DATE NOT NULL,
    "return_date" DATE NOT NULL,
    "estimated_budget" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "flight_type" TEXT,
    "hotel_required" BOOLEAN NOT NULL DEFAULT false,
    "hotel_details" TEXT,
    "notes" TEXT,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "delegated_to" UUID,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "days_per_year" INTEGER NOT NULL DEFAULT 0,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "is_paid" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "entitled" INTEGER NOT NULL DEFAULT 0,
    "used" INTEGER NOT NULL DEFAULT 0,
    "carried" INTEGER NOT NULL DEFAULT 0,
    "adjustment" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_transactions" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "amount" INTEGER NOT NULL,
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
    "days" DECIMAL(4,1) NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "delegated_to" UUID,
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "last_reminder_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
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
    "shares" INTEGER NOT NULL,
    "vesting_months" INTEGER NOT NULL DEFAULT 48,
    "cliff_months" INTEGER NOT NULL DEFAULT 12,
    "strike_price" DECIMAL(10,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "exercised_shares" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "esop_grants_pkey" PRIMARY KEY ("id")
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_runs_pkey" PRIMARY KEY ("id")
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
    "visa_type" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "issue_date" DATE,
    "expiry_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "document_url" TEXT,
    "notes" TEXT,
    "entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visa_records_pkey" PRIMARY KEY ("id")
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
    "status" TEXT NOT NULL DEFAULT 'prospect',
    "added_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investors_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
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
    "status" TEXT NOT NULL DEFAULT 'planning',
    "owner_id" UUID NOT NULL,
    "partner_id" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "budget" DECIMAL(15,2),
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
    "parent_task_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "owner_id" UUID,
    "due_date" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
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
    "title" TEXT,
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

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
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
    "website" TEXT,
    "notes" TEXT,
    "owner_id" UUID NOT NULL,
    "partner_id" TEXT,
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
    "value" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "probability" INTEGER NOT NULL DEFAULT 20,
    "probability_custom" BOOLEAN NOT NULL DEFAULT false,
    "close_date" DATE,
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "aria_conversations_user_id_idx" ON "aria_conversations"("user_id");

-- CreateIndex
CREATE INDEX "aria_messages_conversation_id_idx" ON "aria_messages"("conversation_id");

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
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_token_hash_idx" ON "sessions"("token_hash");

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
CREATE INDEX "bnry_transactions_date_idx" ON "bnry_transactions"("date");

-- CreateIndex
CREATE INDEX "exchange_rates_base_currency_currency_idx" ON "exchange_rates"("base_currency", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_base_currency_currency_effective_date_key" ON "exchange_rates"("base_currency", "currency", "effective_date");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");

-- CreateIndex
CREATE INDEX "expenses_employee_id_idx" ON "expenses"("employee_id");

-- CreateIndex
CREATE INDEX "expenses_status_idx" ON "expenses"("status");

-- CreateIndex
CREATE INDEX "expenses_travel_request_id_idx" ON "expenses"("travel_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_definitions_version_name_key" ON "survey_definitions"("version_name");

-- CreateIndex
CREATE INDEX "survey_waves_status_idx" ON "survey_waves"("status");

-- CreateIndex
CREATE INDEX "survey_waves_created_by_idx" ON "survey_waves"("created_by");

-- CreateIndex
CREATE INDEX "survey_waves_definition_id_idx" ON "survey_waves"("definition_id");

-- CreateIndex
CREATE INDEX "survey_responses_wave_id_idx" ON "survey_responses"("wave_id");

-- CreateIndex
CREATE INDEX "survey_responses_department_idx" ON "survey_responses"("department");

-- CreateIndex
CREATE INDEX "survey_responses_tenure_idx" ON "survey_responses"("tenure");

-- CreateIndex
CREATE INDEX "survey_responses_role_level_idx" ON "survey_responses"("role_level");

-- CreateIndex
CREATE INDEX "survey_responses_work_setup_idx" ON "survey_responses"("work_setup");

-- CreateIndex
CREATE INDEX "upload_jobs_wave_id_idx" ON "upload_jobs"("wave_id");

-- CreateIndex
CREATE INDEX "upload_jobs_created_by_idx" ON "upload_jobs"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "travel_requests_request_code_key" ON "travel_requests"("request_code");

-- CreateIndex
CREATE INDEX "travel_requests_employee_id_idx" ON "travel_requests"("employee_id");

-- CreateIndex
CREATE INDEX "travel_requests_status_idx" ON "travel_requests"("status");

-- CreateIndex
CREATE INDEX "travel_requests_departure_date_idx" ON "travel_requests"("departure_date");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_name_key" ON "leave_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_code_key" ON "leave_types"("code");

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
CREATE UNIQUE INDEX "payroll_runs_entity_id_period_key" ON "payroll_runs"("entity_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_payroll_run_id_employee_id_key" ON "payslips"("payroll_run_id", "employee_id");

-- CreateIndex
CREATE INDEX "visa_records_employee_id_idx" ON "visa_records"("employee_id");

-- CreateIndex
CREATE INDEX "visa_records_expiry_date_idx" ON "visa_records"("expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "benefit_enrollments_benefit_id_employee_id_key" ON "benefit_enrollments"("benefit_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_google_connections_user_id_key" ON "user_google_connections"("user_id");

-- CreateIndex
CREATE INDEX "user_google_connections_user_id_idx" ON "user_google_connections"("user_id");

-- CreateIndex
CREATE INDEX "google_oauth_states_user_id_idx" ON "google_oauth_states"("user_id");

-- CreateIndex
CREATE INDEX "deals_stage_idx" ON "deals"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

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
CREATE INDEX "project_task_comments_task_id_idx" ON "project_task_comments"("task_id");

-- CreateIndex
CREATE INDEX "project_task_activities_task_id_created_at_idx" ON "project_task_activities"("task_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "desk_bookings_desk_id_date_key" ON "desk_bookings"("desk_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "room_bookings_room_id_date_time_slot_key" ON "room_bookings"("room_id", "date", "time_slot");

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
CREATE INDEX "crm_opportunities_owner_id_stage_idx" ON "crm_opportunities"("owner_id", "stage");

-- CreateIndex
CREATE INDEX "crm_opportunities_account_id_idx" ON "crm_opportunities"("account_id");

-- CreateIndex
CREATE INDEX "crm_opportunities_close_date_idx" ON "crm_opportunities"("close_date");

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
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_resource_resource_id_idx" ON "audit_log"("resource", "resource_id");

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
ALTER TABLE "aria_conversations" ADD CONSTRAINT "aria_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aria_messages" ADD CONSTRAINT "aria_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "aria_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_reporting_to_fkey" FOREIGN KEY ("reporting_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "survey_waves" ADD CONSTRAINT "survey_waves_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "survey_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_waves" ADD CONSTRAINT "survey_waves_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_wave_id_fkey" FOREIGN KEY ("wave_id") REFERENCES "survey_waves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_jobs" ADD CONSTRAINT "upload_jobs_wave_id_fkey" FOREIGN KEY ("wave_id") REFERENCES "survey_waves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_requests" ADD CONSTRAINT "travel_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_requests" ADD CONSTRAINT "travel_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_requests" ADD CONSTRAINT "travel_requests_delegated_to_fkey" FOREIGN KEY ("delegated_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_requests" ADD CONSTRAINT "travel_requests_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "onboarding_runs" ADD CONSTRAINT "onboarding_runs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_runs" ADD CONSTRAINT "onboarding_runs_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "training_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visa_records" ADD CONSTRAINT "visa_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visa_records" ADD CONSTRAINT "visa_records_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_enrollments" ADD CONSTRAINT "benefit_enrollments_benefit_id_fkey" FOREIGN KEY ("benefit_id") REFERENCES "benefits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_enrollments" ADD CONSTRAINT "benefit_enrollments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_google_connections" ADD CONSTRAINT "user_google_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investors" ADD CONSTRAINT "investors_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "investors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_room_documents" ADD CONSTRAINT "data_room_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_updates" ADD CONSTRAINT "investor_updates_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_contacts" ADD CONSTRAINT "partner_contacts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "crm_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Enable RLS on all tables
-- ============================================================

ALTER TABLE public.entities              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_access         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_owners         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_groups           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_group_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultant_invoices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esop_grants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_runs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_modules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_completions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visa_records          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benefits              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benefit_enrollments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bnry_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_contacts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_columns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_activities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offices               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_desks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desk_bookings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_rooms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_bookings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_hidden_for    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wall_posts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wall_comments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_news          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_dates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aria_conversations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aria_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_room_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_updates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_definitions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_waves          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_jobs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_uploads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_google_connections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_oauth_states      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_accounts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_opportunities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_sources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lost_reasons      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appraisal_cycles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kra_templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appraisals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appraisal_kras        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appraisal_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appraisal_ratings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blogs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles              ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Revoke direct table access from anon and authenticated
-- ============================================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM authenticated;

-- ============================================================
-- Service-role helper function + policies
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT current_setting('role', true) IN ('service_role', 'supabase_admin')
      OR current_user = 'postgres';
$$;

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'entities','users','sessions','departments',
    'roles','user_roles','role_permissions','module_access','module_owners',
    'user_groups','user_group_members',
    'leave_types','leave_balances','leave_requests','balance_transactions',
    'payroll_runs','payslips','consultant_invoices',
    'esop_grants','onboarding_runs','training_modules','training_completions',
    'visa_records','benefits','benefit_enrollments',
    'chart_of_accounts','journal_entries','journal_entry_lines',
    'invoices','bank_transactions','bnry_transactions',
    'exchange_rates','expense_categories','expenses','travel_requests',
    'partners','partner_contacts','deals',
    'projects','project_members','project_columns','project_tasks',
    'project_task_comments','project_task_activities',
    'offices','office_desks','desk_bookings','meeting_rooms','room_bookings','assets',
    'conversations','conversation_members','messages','message_hidden_for','message_reactions',
    'wall_posts','wall_comments',
    'company_news','company_dates','aria_conversations','aria_messages',
    'investors','investments','data_room_documents','investor_updates',
    'survey_definitions','survey_waves','survey_responses','upload_jobs',
    'audit_log','user_settings','system_settings','file_uploads',
    'user_google_connections','google_oauth_states',
    'crm_accounts','crm_contacts','crm_leads','crm_opportunities',
    'crm_activities','crm_tasks','crm_lead_sources','crm_lost_reasons',
    'appraisal_cycles','kra_templates','appraisals','appraisal_kras',
    'appraisal_comments','appraisal_ratings','goals',
    'jobs','applications','blogs','articles'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE POLICY "service_role_full_access" ON public.%I
       FOR ALL
       USING (public.is_service_role())
       WITH CHECK (public.is_service_role())',
      tbl
    );
  END LOOP;
END;
$$;

-- ============================================================
-- Storage: allow service_role uploads (Supabase-specific, safe no-op otherwise)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "nexora_service_role_storage_objects_all" ON storage.objects';
    EXECUTE $policy$
      CREATE POLICY "nexora_service_role_storage_objects_all"
      ON storage.objects
      FOR ALL
      TO public
      USING (coalesce((auth.jwt() ->> 'role'), '') = 'service_role')
      WITH CHECK (coalesce((auth.jwt() ->> 'role'), '') = 'service_role')
    $policy$;
  END IF;
END
$$;

