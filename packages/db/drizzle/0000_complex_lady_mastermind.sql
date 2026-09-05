-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "approval_chain_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" varchar(50) NOT NULL,
	"project_id" text,
	"proposal_id" text,
	"order" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"approver_user_id" uuid,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"decided_by_id" uuid,
	"decided_at" timestamp(6) with time zone,
	"notes" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" varchar(20) DEFAULT 'direct' NOT NULL,
	"direct_key" text,
	"title" text,
	"created_by" uuid NOT NULL,
	"last_message_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text,
	"kind" varchar(20) DEFAULT 'text' NOT NULL,
	"deleted_for_everyone_at" timestamp(3),
	"deleted_by" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wall_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'comment' NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_news" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" text,
	"author_id" uuid NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"attachments" jsonb,
	"link_url" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_dates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"type" text NOT NULL,
	"location" text,
	"attachments" jsonb,
	"link_url" text,
	"added_by" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_chains" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wall_posts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'post' NOT NULL,
	"likes" jsonb,
	"reactions" jsonb,
	"attachments" jsonb,
	"link_url" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aria_conversation_summaries" (
	"conversation_id" uuid PRIMARY KEY NOT NULL,
	"summary" text NOT NULL,
	"covers_through_message_id" uuid,
	"message_count" integer DEFAULT 0 NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aria_conversation_memory" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aria_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aria_conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aria_attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"message_id" uuid,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_bucket" text NOT NULL,
	"storage_path" text NOT NULL,
	"extracted_text" text,
	"status" text DEFAULT 'ready' NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aria_knowledge_articles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"body" text NOT NULL,
	"keywords" text[],
	"tags" text[],
	"required_permissions" text[] DEFAULT '{"RAY"}',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aria_query_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid,
	"user_id" uuid NOT NULL,
	"user_message" text NOT NULL,
	"retrieved_article_ids" uuid[] DEFAULT '{"RAY"}',
	"retrieved_distances" double precision[] DEFAULT '{RAY}',
	"top_distance" double precision,
	"retrieval_mode" text DEFAULT 'vector' NOT NULL,
	"workspace_bytes" integer DEFAULT 0 NOT NULL,
	"knowledge_bytes" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"cache_read_tokens" integer,
	"cache_create_tokens" integer,
	"model" text NOT NULL,
	"error" boolean DEFAULT false NOT NULL,
	"error_message" text,
	"tool_use_count" integer DEFAULT 0 NOT NULL,
	"tool_names" text[] DEFAULT '{"RAY"}',
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aria_brief_subscriptions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"hour_local" integer DEFAULT 7 NOT NULL,
	"timezone" text DEFAULT 'Asia/Bangkok' NOT NULL,
	"channels" text[] DEFAULT '{"RAY['in_app'::text","'email'::tex"}',
	"sections" text[] DEFAULT '{"RAY"}',
	"weekdays_only" boolean DEFAULT false NOT NULL,
	"last_delivered_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aria_brief_deliveries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"delivered_on" text NOT NULL,
	"generated_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"payload_json" jsonb NOT NULL,
	"channel_status" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text,
	"type" text NOT NULL,
	"location" text NOT NULL,
	"department" text NOT NULL,
	"description" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"cover_image" text NOT NULL,
	"slug" text,
	"active" boolean DEFAULT true NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aria_feedback" (
	"id" uuid PRIMARY KEY NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" text NOT NULL,
	"reason" varchar(1000),
	"reviewed" boolean DEFAULT false NOT NULL,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp(3),
	"review_note" varchar(500),
	"resulting_article_id" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_pages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"parent_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"folder" text,
	"body" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"slug" text,
	"is_published" boolean DEFAULT true NOT NULL,
	"is_restricted" boolean DEFAULT false NOT NULL,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_page_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"page_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_by_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_page_permissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"page_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"level" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"country" text NOT NULL,
	"currency" text NOT NULL,
	"accounting_std" text DEFAULT 'IFRS' NOT NULL,
	"tax_id" text,
	"address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"name_th" text,
	"branch_code" text,
	"logo_url" text,
	"vat_registration_status" text,
	"boi_type" text,
	"boi_period" text,
	"fiscal_year_start_month" integer DEFAULT 1 NOT NULL,
	"first_fiscal_year_start" timestamp(3),
	"first_fiscal_year_end" timestamp(3),
	"default_rate_source" text DEFAULT 'bot' NOT NULL,
	"enabled_currencies" text[] DEFAULT '{"RAY"}',
	"setup_state" text DEFAULT 'active' NOT NULL,
	"deleted_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_entity_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_id" text NOT NULL,
	"role_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"link" text NOT NULL,
	"img" text NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"phone" text,
	"phone_public" boolean DEFAULT false NOT NULL,
	"entity_id" text,
	"active_entity_id" text,
	"department" text,
	"job_title" text,
	"employee_id" text,
	"reporting_to" uuid,
	"employment_type" text DEFAULT 'full_time' NOT NULL,
	"start_date" timestamp(3),
	"end_date" timestamp(3),
	"salary" numeric(15, 2),
	"currency" text,
	"location" text,
	"country" text,
	"timezone" text,
	"date_of_birth" date,
	"passport_number" text,
	"nationality" text,
	"thai_id" text,
	"tax_id" text,
	"aadhaar_number" text,
	"pan_card_number" text,
	"work_permit_type" text,
	"visa_type" text,
	"permit_number" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"deleted_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20),
	"description" text,
	"head_id" uuid,
	"parent_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chart_of_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" text NOT NULL,
	"name_th" text,
	"description" text,
	"description_th" text,
	"name_normalized" text,
	"type" text NOT NULL,
	"sub_type" text,
	"parent_id" text,
	"balance" numeric(18, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deactivated_at" timestamp(3),
	"reused_from_account_id" text,
	"reuse_acknowledged_by" uuid,
	"reuse_acknowledged_at" timestamp(3),
	"deleted_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"entry_no" text NOT NULL,
	"date" date NOT NULL,
	"description" text,
	"description_th" text,
	"reference" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"from_expense" uuid,
	"source_type" text,
	"source_ref" text,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp(3),
	"rejected_by" uuid,
	"rejected_at" timestamp(3),
	"reject_reason" text,
	"posted_at" timestamp(3),
	"draft_no" text,
	"cancelled_at" timestamp(3),
	"cancelled_by" uuid,
	"cancel_reason" text,
	"reversed_by_entry_id" text,
	"reverses_entry_id" text,
	"deleted_at" timestamp(3),
	"deleted_by" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(254) NOT NULL,
	"ip" varchar(64),
	"action" varchar(32) NOT NULL,
	"success" boolean NOT NULL,
	"error_message" varchar(500),
	"user_id" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"contact_type" text,
	"contact_id" text,
	"business_type" text,
	"business_location" text,
	"name" text NOT NULL,
	"name_th" text,
	"name_en" text,
	"address_th" text,
	"address_en" text,
	"address2" text,
	"address3" text,
	"delivery_address_th" text,
	"delivery_address_en" text,
	"zip_code" text,
	"tax_id" text,
	"branch_code" text,
	"branch" text,
	"contact_name" text,
	"email" text,
	"mobile" text,
	"credit_days" integer,
	"payment_terms" text,
	"default_currency" text,
	"tax_treatment" text,
	"default_revenue_account_id" text,
	"default_expense_account_id" text,
	"default_wht_rate" numeric(7, 4),
	"credit_limit" numeric(18, 2),
	"phone" text,
	"fax_number" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"merged_into_id" uuid,
	"deleted_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"balance" numeric(15, 2),
	"reference" text,
	"bank_account" text,
	"bank_account_id" text,
	"direction" text,
	"category" text,
	"reconciled" boolean DEFAULT false NOT NULL,
	"reconciled_at" timestamp(3),
	"suggested_account" text,
	"mapped_account" text,
	"je_ref" text,
	"status" text DEFAULT 'unmatched' NOT NULL,
	"source" text,
	"payment_id" text,
	"imported_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_advance_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_number" serial NOT NULL,
	"employee_id" uuid NOT NULL,
	"entity_id" text,
	"request_date" date DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"position" text,
	"department" text,
	"direct_manager" text,
	"payout_mode" text DEFAULT 'bank-transfer' NOT NULL,
	"bank_name" text,
	"bank_country" text,
	"bank_account_no" text,
	"swift_code" text,
	"currency" varchar(10) DEFAULT 'THB' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_step_order" integer,
	"requested_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"approved_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"reject_reason" text,
	"submitted_at" timestamp(3),
	"approved_by" uuid,
	"approved_at" timestamp(3),
	"disbursed_at" timestamp(3),
	"disbursement_proof_url" text,
	"cleared_at" timestamp(3),
	"deleted_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bnry_transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(18, 4) NOT NULL,
	"reference" text,
	"description" text,
	"je_ref" varchar(30),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"base_currency" varchar(10) NOT NULL,
	"currency" varchar(10) NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"effective_date" date NOT NULL,
	"source" varchar(50),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounting_fx_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"currency" varchar(10) NOT NULL,
	"effective_date" date NOT NULL,
	"buying_rate" numeric(18, 8) NOT NULL,
	"selling_rate" numeric(18, 8) NOT NULL,
	"source" text DEFAULT 'bot' NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(15, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(15, 2) DEFAULT '0' NOT NULL,
	"line_discount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"line_vat_rate" numeric(5, 2),
	"vat_reason" text,
	"tax_base" numeric(15, 2),
	"vat_amount" numeric(15, 2),
	"capitalised" boolean DEFAULT false NOT NULL,
	"gl_account_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_advance_approval_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"approver_type" text DEFAULT 'manager' NOT NULL,
	"approver_user_id" uuid,
	"skip_when_submitter_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"only_when_submitter_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payout_mode_filter" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"amount_min" numeric(15, 2),
	"amount_max" numeric(15, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"gl_account_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"spending_limit" numeric(15, 2),
	"limit_period" varchar(20),
	"receipt_required" boolean DEFAULT false NOT NULL,
	"is_allowance" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entry_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entry_id" text NOT NULL,
	"account_id" text NOT NULL,
	"debit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"memo" text
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"invoice_no" text NOT NULL,
	"type" text NOT NULL,
	"counterparty" text NOT NULL,
	"vendor_id" uuid,
	"amount" numeric(15, 2) NOT NULL,
	"amount_paid" numeric(15, 2) DEFAULT '0' NOT NULL,
	"currency" text NOT NULL,
	"exchange_rate" numeric(18, 8) DEFAULT '1',
	"base_amount" numeric(15, 2),
	"carrying_rate" numeric(18, 8),
	"bill_to_address" text,
	"reference" text,
	"payment_terms" text,
	"vat_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax_label" text,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"wht_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"paid_date" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"draft_no" text,
	"header_discount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"rounding_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"vendor_tax_invoice_no" text,
	"tax_invoice_received" boolean DEFAULT false NOT NULL,
	"fx_side" text,
	"fx_rate_date" date,
	"cancel_reason" text,
	"cancelled_at" timestamp(3),
	"approved_by_1" uuid,
	"approved_at_1" timestamp(3),
	"approved_by_2" uuid,
	"approved_at_2" timestamp(3),
	"threshold_applied" numeric(18, 2),
	"split_flagged" boolean DEFAULT false NOT NULL,
	"linked_je_id" text,
	"notes" text,
	"created_by" uuid,
	"deleted_at" timestamp(3),
	"deleted_by" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"entity_id" text NOT NULL,
	"category_id" text,
	"travel_request_id" uuid,
	"report_id" uuid,
	"description" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" text NOT NULL,
	"date" date NOT NULL,
	"receipt_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp(3),
	"reject_reason" text,
	"reimbursed_at" timestamp(3),
	"notes" text,
	"je_ref" text,
	"deleted_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"entity_id" text NOT NULL,
	"period" varchar(7) NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_step_order" integer,
	"submitted_at" timestamp(3),
	"approved_by" uuid,
	"approved_at" timestamp(3),
	"approved_total" numeric(15, 2),
	"reject_reason" text,
	"reimbursed_at" timestamp(3),
	"notes" text,
	"deleted_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_approval_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"approver_type" text DEFAULT 'manager' NOT NULL,
	"stage_role" text DEFAULT 'approve' NOT NULL,
	"approver_user_id" uuid,
	"skip_when_submitter_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"only_when_submitter_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category_filter" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"amount_min_baht" numeric(15, 2),
	"amount_max_baht" numeric(15, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_approval_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"expense_report_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"approver_type" text NOT NULL,
	"stage_role" text DEFAULT 'approve' NOT NULL,
	"approver_user_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by_id" uuid,
	"decided_at" timestamp(3),
	"approved_amount" numeric(15, 2),
	"notes" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"wht_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"base_amount" numeric(15, 2),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"bank_account_id" text,
	"date" date NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" varchar(10),
	"exchange_rate" numeric(18, 8) DEFAULT '1',
	"base_amount" numeric(15, 2),
	"method" text DEFAULT 'bank-transfer' NOT NULL,
	"receipt_no" text,
	"bank_fee" numeric(15, 2) DEFAULT '0' NOT NULL,
	"vat_recognised" numeric(15, 2) DEFAULT '0' NOT NULL,
	"wht_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"write_off_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"write_off_reason" text,
	"wht_certificate_received_at" timestamp(3),
	"reference" text,
	"notes" text,
	"created_by" uuid NOT NULL,
	"linked_je_id" text,
	"deleted_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_advance_approval_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cash_advance_request_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"approver_type" text NOT NULL,
	"approver_user_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by_id" uuid,
	"decided_at" timestamp(3),
	"notes" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"quote_no" text NOT NULL,
	"vendor_id" uuid,
	"issue_date" date NOT NULL,
	"expiry_date" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"currency" varchar(10) DEFAULT 'THB' NOT NULL,
	"subtotal" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"converted_invoice_id" text,
	"deleted_at" timestamp(3),
	"created_by" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"quote_id" text NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(15, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(15, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_code_id" text,
	"tax_rate" numeric(7, 4) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"gl_account_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'bank' NOT NULL,
	"account_number" text,
	"currency" varchar(10) DEFAULT 'THB' NOT NULL,
	"opening_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"current_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"gl_account_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_advance_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"description" text NOT NULL,
	"category_id" text,
	"requested_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"approved_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"receipt_url" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"credit_note_no" text NOT NULL,
	"type" text NOT NULL,
	"note_kind" text DEFAULT 'credit' NOT NULL,
	"vendor_id" uuid,
	"linked_invoice_id" text,
	"issue_date" date NOT NULL,
	"subtotal" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"reason" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"linked_je_id" text,
	"notes" text,
	"deleted_at" timestamp(3),
	"created_by" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_note_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"credit_note_id" text NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(15, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(15, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_code_id" text,
	"tax_rate" numeric(7, 4) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"gl_account_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiscal_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"status" text DEFAULT 'closed' NOT NULL,
	"note" text,
	"closed_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"closed_by" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"po_no" text NOT NULL,
	"vendor_id" uuid,
	"order_date" date NOT NULL,
	"expected_date" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"currency" varchar(10) DEFAULT 'THB' NOT NULL,
	"subtotal" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"converted_invoice_id" text,
	"deleted_at" timestamp(3),
	"created_by" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"role" text NOT NULL,
	"chart_of_account_id" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_filings" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"filing_type" text DEFAULT 'vat' NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"status" text DEFAULT 'filed' NOT NULL,
	"snapshot" jsonb,
	"notes" text,
	"filed_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"filed_by" uuid NOT NULL,
	"reopened_at" timestamp(3),
	"reopened_by" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_advances" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"counterparty" text NOT NULL,
	"vendor_id" uuid,
	"side" text DEFAULT 'ar' NOT NULL,
	"kind" text DEFAULT 'refundable' NOT NULL,
	"currency" text NOT NULL,
	"original_amount" numeric(15, 2) NOT NULL,
	"balance" numeric(15, 2) NOT NULL,
	"vat_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_invoice_no" text,
	"status" text DEFAULT 'open' NOT NULL,
	"source_payment_id" text,
	"linked_je_id" text,
	"refunded_at" timestamp(3),
	"refund_je_id" text,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_sequences" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"doc_type" text NOT NULL,
	"prefix" text DEFAULT '' NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"pad_width" integer DEFAULT 5 NOT NULL,
	"reset_period" text DEFAULT 'none' NOT NULL,
	"period_key" text DEFAULT '' NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixed_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"asset_no" text NOT NULL,
	"name" text NOT NULL,
	"name_th" text,
	"category_code" text NOT NULL,
	"asset_class" text NOT NULL,
	"location" text,
	"assigned_user" text,
	"supplier" text,
	"serial_no" text,
	"purchase_date" date NOT NULL,
	"start_date" date NOT NULL,
	"useful_life_months" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"purchase_price" numeric(15, 2) NOT NULL,
	"opening_book_value" numeric(15, 2),
	"opening_as_of_date" date,
	"tax_useful_life_months" integer,
	"opening_tax_wdv" numeric(15, 2),
	"opening_tax_as_of_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"disposal_date" date,
	"selling_price" numeric(15, 2),
	"notes" text,
	"link_group" text,
	"created_by" uuid NOT NULL,
	"deleted_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"revaluation_surplus" numeric(15, 2) DEFAULT '0' NOT NULL,
	"impairment_pl_loss" numeric(15, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"rate" numeric(7, 4) DEFAULT '0' NOT NULL,
	"gl_account_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "po_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"po_id" text NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(15, 4) DEFAULT '1' NOT NULL,
	"qty_received" numeric(15, 4) DEFAULT '0' NOT NULL,
	"unit_price" numeric(15, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_code_id" text,
	"tax_rate" numeric(7, 4) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"gl_account_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixed_asset_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"name_th" text,
	"asset_class" text NOT NULL,
	"useful_life_months" integer NOT NULL,
	"tax_useful_life_months" integer,
	"asset_gl_account_id" text,
	"depreciation_gl_account_id" text,
	"accumulated_depreciation_gl_account_id" text,
	"disposal_gain_gl_account_id" text,
	"disposal_loss_gl_account_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixed_asset_transfers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"asset_id" uuid NOT NULL,
	"entity_id" text NOT NULL,
	"kind" text NOT NULL,
	"transfer_date" date NOT NULL,
	"from_location" text,
	"to_location" text,
	"from_custodian" text,
	"to_custodian" text,
	"to_entity_id" text,
	"destination_asset_id" uuid,
	"cost_transferred" numeric(15, 2),
	"accumulated_transferred" numeric(15, 2),
	"remaining_life_months" integer,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by" uuid NOT NULL,
	"requested_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp(3),
	"rejected_by" uuid,
	"rejected_at" timestamp(3),
	"reject_reason" text,
	"linked_je_out_id" text,
	"linked_je_in_id" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixed_asset_count_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"session_no" text NOT NULL,
	"as_of_date" date NOT NULL,
	"name" text,
	"location_filter" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_by" uuid NOT NULL,
	"closed_by" uuid,
	"closed_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpdesk_tickets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ticket_number" serial NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_by" uuid NOT NULL,
	"assignee_id" uuid,
	"resolution_note" text,
	"resolved_at" timestamp(3),
	"closed_at" timestamp(3),
	"first_response_at" timestamp(3),
	"reopened_count" integer DEFAULT 0 NOT NULL,
	"attachments" jsonb,
	"github_issue_number" integer,
	"github_issue_url" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validator_node_alerts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"node_id" text,
	"field" text NOT NULL,
	"operator" text NOT NULL,
	"threshold" numeric(28, 8) NOT NULL,
	"email" varchar(255) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"cooldown_minutes" integer DEFAULT 1440 NOT NULL,
	"last_triggered_at" timestamp(3),
	"created_by" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_tax_rates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"rate_percent" numeric(6, 3) NOT NULL,
	"label" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpdesk_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"singleton" boolean DEFAULT true NOT NULL,
	"notify_emails" text[] DEFAULT '{"RAY"}',
	"notify_on_create" boolean DEFAULT true NOT NULL,
	"notify_creator_on_create" boolean DEFAULT true NOT NULL,
	"notify_creator_on_status" boolean DEFAULT true NOT NULL,
	"github_enabled" boolean DEFAULT false NOT NULL,
	"github_repo_owner" text,
	"github_repo_name" text,
	"github_token_encrypted" text,
	"github_webhook_secret" text,
	"github_label_in_progress" text DEFAULT 'in progress' NOT NULL,
	"github_label_review" text DEFAULT 'review' NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpdesk_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixed_asset_disposals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"asset_id" uuid NOT NULL,
	"entity_id" text NOT NULL,
	"disposal_type" text NOT NULL,
	"disposal_date" date NOT NULL,
	"units_disposed" integer DEFAULT 1 NOT NULL,
	"proceeds" numeric(15, 2) DEFAULT '0' NOT NULL,
	"nbv_disposed" numeric(15, 2),
	"gain_loss" numeric(15, 2),
	"quantity_before" integer,
	"cost_before" numeric(15, 2),
	"opening_book_value_before" numeric(15, 2),
	"cost_removed" numeric(15, 2),
	"accumulated_removed" numeric(15, 2),
	"accumulated_tax_removed" numeric(15, 2),
	"opening_tax_wdv_before" numeric(15, 2),
	"linked_je_id" text,
	"reason" text,
	"link_group_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by" uuid NOT NULL,
	"requested_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp(3),
	"rejected_by" uuid,
	"rejected_at" timestamp(3),
	"reject_reason" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixed_asset_remeasurements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"asset_id" uuid NOT NULL,
	"entity_id" text NOT NULL,
	"kind" text NOT NULL,
	"effective_date" date NOT NULL,
	"carrying_before" numeric(15, 2) NOT NULL,
	"carrying_after" numeric(15, 2) NOT NULL,
	"movement" numeric(15, 2) NOT NULL,
	"profit_or_loss" numeric(15, 2) NOT NULL,
	"oci" numeric(15, 2) NOT NULL,
	"surplus_after" numeric(15, 2) NOT NULL,
	"pl_loss_after" numeric(15, 2) NOT NULL,
	"capped_at" numeric(15, 2),
	"remaining_life_months" integer,
	"reason" text,
	"evidence_url" text,
	"quantity_before" integer,
	"cost_before" numeric(15, 2),
	"opening_book_value_before" numeric(15, 2),
	"opening_as_of_date_before" date,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by" uuid NOT NULL,
	"requested_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp(3),
	"rejected_by" uuid,
	"rejected_at" timestamp(3),
	"reject_reason" text,
	"linked_je_id" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_form_responses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"survey_form_id" uuid NOT NULL,
	"respondent_id" uuid,
	"submitted_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surveys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"target_all" boolean DEFAULT true NOT NULL,
	"target_entity_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_departments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp(3),
	"closed_at" timestamp(3),
	"start_date" date,
	"end_date" date,
	"archived_at" timestamp(3),
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"survey_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"type" varchar(30) NOT NULL,
	"prompt" text NOT NULL,
	"helper_text" text,
	"required" boolean DEFAULT false NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"survey_id" uuid NOT NULL,
	"respondent_id" uuid,
	"submitted_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "travel_approval_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"approver_type" text DEFAULT 'manager' NOT NULL,
	"approver_user_id" uuid,
	"skip_when_submitter_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"only_when_submitter_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category_filter" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"amount_min_baht" numeric(15, 2),
	"amount_max_baht" numeric(15, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_forms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"target_all" boolean DEFAULT true NOT NULL,
	"target_entity_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_departments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp(3),
	"closed_at" timestamp(3),
	"start_date" date,
	"end_date" date,
	"archived_at" timestamp(3),
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "travel_approval_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"travel_request_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"approver_type" text NOT NULL,
	"approver_user_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by_id" uuid,
	"decided_at" timestamp(3),
	"notes" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text,
	"name" varchar(100) NOT NULL,
	"code" varchar(20) NOT NULL,
	"description" text,
	"category" text DEFAULT 'other' NOT NULL,
	"days_per_year" integer DEFAULT 0 NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"is_paid" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "travel_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_code" varchar(20) NOT NULL,
	"employee_id" uuid NOT NULL,
	"entity_id" text,
	"origin" text,
	"destination" text NOT NULL,
	"purpose" text NOT NULL,
	"departure_date" date NOT NULL,
	"return_date" date NOT NULL,
	"estimated_budget" numeric(15, 2),
	"cash_advance" numeric(15, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"flight_type" text,
	"departure_time_preference" text,
	"return_time_preference" text,
	"meal_preference" text,
	"seating_preference" text,
	"seating_preference_other" text,
	"dummy_ticket_required" boolean DEFAULT false NOT NULL,
	"visa_required" boolean DEFAULT false NOT NULL,
	"hotel_required" boolean DEFAULT false NOT NULL,
	"hotel_location_preference" text,
	"preferred_hotel" text,
	"hotel_details" text,
	"notes" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"delegated_to" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_step_order" integer,
	"approved_by" uuid,
	"approved_at" timestamp(3),
	"reject_reason" text,
	"submitted_at" timestamp(3),
	"deleted_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_form_questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"survey_form_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"type" varchar(30) NOT NULL,
	"prompt" text NOT NULL,
	"helper_text" text,
	"required" boolean DEFAULT false NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_form_answers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"response_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_answers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"response_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "balance_transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" text NOT NULL,
	"year" integer NOT NULL,
	"type" varchar(30) NOT NULL,
	"amount" numeric(6, 1) NOT NULL,
	"description" text,
	"reference_id" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" text NOT NULL,
	"entity_id" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"duration_type" text DEFAULT 'full_day' NOT NULL,
	"half_day_period" text,
	"days" numeric(4, 1) NOT NULL,
	"source" text DEFAULT 'entitled' NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"current_step_order" integer,
	"balance_deducted" boolean DEFAULT false NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp(3),
	"reject_reason" text,
	"delegated_to" uuid,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"last_reminder_at" timestamp(3),
	"deleted_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_approval_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"approver_type" text DEFAULT 'manager' NOT NULL,
	"approver_user_id" uuid,
	"skip_when_submitter_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"only_when_submitter_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_approval_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"leave_request_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"approver_type" text NOT NULL,
	"approver_user_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by_id" uuid,
	"decided_at" timestamp(3),
	"notes" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_holidays" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"date" date NOT NULL,
	"name" varchar(120) NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"period" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_gross" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_net" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_tax" numeric(15, 2) DEFAULT '0' NOT NULL,
	"currency_totals" jsonb,
	"run_by" uuid NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp(3),
	"paid_at" timestamp(3),
	"notes" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payslips" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payroll_run_id" text NOT NULL,
	"employee_id" uuid NOT NULL,
	"base_salary" numeric(15, 2) NOT NULL,
	"allowances" jsonb,
	"deductions" jsonb,
	"gross_pay" numeric(15, 2) NOT NULL,
	"net_pay" numeric(15, 2) NOT NULL,
	"currency" text NOT NULL,
	"gross_pay_base" numeric(15, 2),
	"net_pay_base" numeric(15, 2),
	"position_snapshot" text,
	"department_snapshot" text,
	"start_date_snapshot" text,
	"document_url" text
);
--> statement-breakpoint
CREATE TABLE "consultant_invoices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"consultant_id" uuid NOT NULL,
	"invoice_no" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"wht_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"wht_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(15, 2) NOT NULL,
	"period" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"cert_issued" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "esop_grants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"grant_date" date NOT NULL,
	"grant_type" text DEFAULT 'equity' NOT NULL,
	"value_type" text DEFAULT 'shares' NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"currency_code" text,
	"currency_amount" numeric(15, 2),
	"percent_of_base" numeric(5, 2),
	"vesting_months" integer,
	"cliff_months" integer,
	"lock_months" integer,
	"strike_price" numeric(10, 4) DEFAULT '0' NOT NULL,
	"allocation_mode" text DEFAULT 'one_time' NOT NULL,
	"monthly_amount" numeric(15, 2),
	"allocation_start_month" date,
	"allocation_end_month" date,
	"source" text,
	"status" text DEFAULT 'active' NOT NULL,
	"exercised_shares" integer DEFAULT 0 NOT NULL,
	"vested_to_date_override" integer,
	"notes" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_policy_approvers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"leave_type_id" text NOT NULL,
	"order" integer NOT NULL,
	"approver_type" text DEFAULT 'manager' NOT NULL,
	"approver_user_id" uuid,
	"skip_when_submitter_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"only_when_submitter_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"min_days" integer,
	"max_days" integer,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_balances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" text NOT NULL,
	"year" integer NOT NULL,
	"entitled" numeric(4, 1) DEFAULT '0' NOT NULL,
	"used" numeric(4, 1) DEFAULT '0' NOT NULL,
	"carried" numeric(4, 1) DEFAULT '0' NOT NULL,
	"carried_used" numeric(4, 1) DEFAULT '0' NOT NULL,
	"carried_expiry" date,
	"adjustment" numeric(4, 1) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equity_monthly_salary" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_name" text NOT NULL,
	"position" text,
	"start_date" date,
	"currency" text,
	"year" integer NOT NULL,
	"monthly_shares" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid,
	"employee_name" text NOT NULL,
	"department" text NOT NULL,
	"start_date" date NOT NULL,
	"tasks" jsonb NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"entity_id" text,
	"deleted_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offboarding_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid,
	"employee_name" text NOT NULL,
	"position" text,
	"department" text NOT NULL,
	"last_working_day" date NOT NULL,
	"tasks" jsonb NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"employee_sign_name" text,
	"employee_signed_at" timestamp(3),
	"hr_sign_name" text,
	"hr_signed_at" timestamp(3),
	"entity_id" text,
	"deleted_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visa_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"holder_type" text DEFAULT 'employee' NOT NULL,
	"holder_name" text,
	"holder_relationship" text,
	"visa_type" text NOT NULL,
	"country" text NOT NULL,
	"nationality" text,
	"issue_date" date,
	"expiry_date" date NOT NULL,
	"work_permit_number" text,
	"work_permit_issue_date" date,
	"work_permit_expiry_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"document_url" text,
	"documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_reminder_sent_at" timestamp(3),
	"last_reminder_milestone_days" integer,
	"status_changed_at" timestamp(3),
	"notes" text,
	"entity_id" text,
	"deleted_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_modules" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"duration" integer,
	"url" text,
	"file_url" text,
	"file_name" text,
	"is_mandatory" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visa_event_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"visa_record_id" uuid NOT NULL,
	"actor_id" uuid,
	"actor_type" text DEFAULT 'user' NOT NULL,
	"kind" text NOT NULL,
	"field" text,
	"old_value" text,
	"new_value" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visa_knowledge_articles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"body" text NOT NULL,
	"country" text,
	"visa_type" text,
	"tags" text[],
	"required_permissions" text[] DEFAULT '{"RAY"}',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid,
	"entity_id" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visa_checklist_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"visa_record_id" uuid NOT NULL,
	"template_item_id" text NOT NULL,
	"label" text NOT NULL,
	"category" text NOT NULL,
	"optional" boolean DEFAULT false NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp(3),
	"completed_by_id" uuid,
	"sort_order" integer NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visa_checklist_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"visa_type" text NOT NULL,
	"country" text,
	"name" text NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"entity_id" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_agreements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"type" varchar(40) NOT NULL,
	"title" varchar(200) NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text,
	"file_size" integer,
	"effective_date" date,
	"expiry_date" date,
	"notes" text,
	"uploaded_by_id" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "benefit_enrollments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"benefit_id" text NOT NULL,
	"employee_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_policies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"category" varchar(40) NOT NULL,
	"description" text,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text,
	"file_size" integer,
	"version" varchar(40),
	"effective_date" date,
	"entity_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"uploaded_by_id" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_approval_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"approver_user_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_policies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_id" text,
	"shift_start_time" varchar(5) DEFAULT '09:00' NOT NULL,
	"shift_end_time" varchar(5) DEFAULT '18:00' NOT NULL,
	"grace_minutes" integer DEFAULT 15 NOT NULL,
	"half_day_threshold_hours" numeric(4, 2) DEFAULT '4' NOT NULL,
	"minimum_working_hours" numeric(4, 2) DEFAULT '8' NOT NULL,
	"allowed_work_modes" jsonb DEFAULT '["office","remote","hybrid"]'::jsonb NOT NULL,
	"weekend_days" jsonb DEFAULT '[0,6]'::jsonb NOT NULL,
	"attendance_threshold_pct" integer DEFAULT 80 NOT NULL,
	"default_timezone" varchar(64) DEFAULT 'Asia/Bangkok' NOT NULL,
	"missed_check_in_after_minutes" integer DEFAULT 120 NOT NULL,
	"missed_check_out_after_minutes" integer DEFAULT 60 NOT NULL,
	"consecutive_absence_alert_days" integer DEFAULT 3 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_corrections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"attendance_record_id" uuid,
	"attendance_date" date NOT NULL,
	"correction_type" varchar(40) NOT NULL,
	"reason" text NOT NULL,
	"comments" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"proposed_check_in" timestamp(3),
	"proposed_check_out" timestamp(3),
	"proposed_work_mode" varchar(20),
	"approved_by" uuid,
	"approved_at" timestamp(3),
	"reject_remarks" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"attendance_date" date NOT NULL,
	"check_in" timestamp(3),
	"check_out" timestamp(3),
	"employee_timezone" varchar(64),
	"check_in_utc" timestamp(6) with time zone,
	"check_out_utc" timestamp(6) with time zone,
	"local_check_in_time" varchar(40),
	"local_check_out_time" varchar(40),
	"work_mode" varchar(20) DEFAULT 'office' NOT NULL,
	"status" varchar(20) DEFAULT 'absent' NOT NULL,
	"total_hours" numeric(5, 2),
	"late_minutes" integer DEFAULT 0 NOT NULL,
	"remarks" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_employee_shifts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"record_id" uuid,
	"employee_id" uuid NOT NULL,
	"action" varchar(40) NOT NULL,
	"actor_id" uuid,
	"details" jsonb,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_shifts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_id" text,
	"shift_name" varchar(80) NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"grace_minutes" integer DEFAULT 15 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ninety_day_notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"entity_id" text,
	"holder_type" text DEFAULT 'employee' NOT NULL,
	"holder_name" text,
	"holder_relationship" text,
	"last_arrival_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"receipt_url" text,
	"receipt_name" text,
	"receipt_mime_type" text,
	"last_reminder_milestone_days" integer,
	"last_reminder_sent_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "benefits" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"provider" text,
	"cost" numeric(15, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'THB' NOT NULL,
	"entity_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_exceptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"type" varchar(40) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" text NOT NULL,
	"status" varchar(20) DEFAULT 'approved' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_google_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"account_email" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"scope" text NOT NULL,
	"expires_at" timestamp(3) NOT NULL,
	"token_type" text DEFAULT 'Bearer' NOT NULL,
	"encryption_version" integer DEFAULT 1 NOT NULL,
	"last_crm_email_sync_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"website" text,
	"location" text,
	"notes" jsonb,
	"visibility" text DEFAULT 'team' NOT NULL,
	"status" text DEFAULT 'investors' NOT NULL,
	"title" text,
	"linkedin_url" text,
	"revenue_stream" text,
	"last_contact_date" date,
	"next_action" text,
	"act_investment" text,
	"est_investment" text,
	"cross_sell" text,
	"region" text,
	"notes_text" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"added_by" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"fundraising_entity" text DEFAULT 'tbh' NOT NULL,
	"archived_at" timestamp(3),
	"tags" text[] DEFAULT '{"RAY"}'
);
--> statement-breakpoint
CREATE TABLE "google_oauth_states" (
	"state" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"redirect" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expires_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investor_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"due_date" date NOT NULL,
	"investor_id" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"completed_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investor_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT 'grey' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investor_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"subject" text NOT NULL,
	"body" text,
	"occurred_at" timestamp(3) NOT NULL,
	"duration_mins" integer,
	"investor_id" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investor_leads" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"company" text,
	"email" text,
	"phone" text,
	"source" text,
	"status" text DEFAULT 'new' NOT NULL,
	"notes" text,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"archived_at" timestamp(3),
	"fundraising_entity" text DEFAULT 'tbh' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investor_type_options" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fundraising_entities" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investor_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"website" text,
	"location" text,
	"region" text,
	"notes" text,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"archived_at" timestamp(3),
	"fundraising_entity" text DEFAULT 'tbh' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recipient_id" uuid NOT NULL,
	"recipient_name" varchar(200) NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text,
	"type" varchar(40) DEFAULT 'achievement' NOT NULL,
	"signatories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"file_url" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"issued_by_id" uuid,
	"issued_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"deleted_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "investments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"investor_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"valuation" numeric(15, 2),
	"shares" integer,
	"date" date NOT NULL,
	"round" text,
	"status" text DEFAULT 'committed' NOT NULL,
	"terms" jsonb,
	"notes" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investor_pipeline_stages" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT 'border-t-zinc-500' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_room_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"file_url" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"version" integer DEFAULT 1 NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"uploaded_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investor_updates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"period" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp(3),
	"sent_by" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "it_vendors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"contact_person" varchar(200),
	"email" varchar(255),
	"phone" varchar(50),
	"notes" text,
	"attachments" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "it_subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vendor_id" uuid NOT NULL,
	"category" text DEFAULT 'saas' NOT NULL,
	"product_name" varchar(200) NOT NULL,
	"contract_start_date" date,
	"renewal_date" date,
	"billing_frequency" text DEFAULT 'monthly' NOT NULL,
	"invoice_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"owner_user_id" uuid,
	"notes" text,
	"total_seats" integer,
	"assigned_seats" integer DEFAULT 0 NOT NULL,
	"active_seats" integer DEFAULT 0 NOT NULL,
	"renewal_decision" text,
	"renewal_decision_at" timestamp(3),
	"renewal_decision_by" uuid,
	"renewal_decision_notes" text,
	"cancelled_at" date,
	"attachments" jsonb,
	"last_reminder_sent_at" timestamp(3),
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "it_billing_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subscription_id" uuid NOT NULL,
	"period_start" date,
	"period_end" date,
	"amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp(3),
	"invoice_url" text,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "it_billing_alerts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subscription_id" uuid NOT NULL,
	"alert_type" text NOT NULL,
	"message" text NOT NULL,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_by" uuid,
	"acknowledged_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "it_systems" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"category" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investor_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"email" text,
	"phone" text,
	"title" text,
	"account_id" text,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"archived_at" timestamp(3),
	"fundraising_entity" text DEFAULT 'tbh' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "it_access_assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_id" uuid,
	"employee_id" uuid NOT NULL,
	"system_id" text NOT NULL,
	"access_level" varchar(200) NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"granted_by" uuid NOT NULL,
	"granted_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expires_at" timestamp(3),
	"revoked_by" uuid,
	"revoked_at" timestamp(3),
	"revoke_reason" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "it_access_audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"user_id" uuid,
	"target_user_id" uuid,
	"request_id" uuid,
	"assignment_id" uuid,
	"comments" text,
	"previous_value" jsonb,
	"new_value" jsonb,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"reference" text,
	"parties" text[],
	"owner_id" uuid,
	"entity_id" text,
	"effective_date" date,
	"expiry_date" date,
	"renewal_lead_days" integer DEFAULT 30 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"file_url" text,
	"file_name" text,
	"folder" text,
	"alert_category" text,
	"notes" text,
	"visibility" text DEFAULT 'private' NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_document_shares" (
	"id" uuid PRIMARY KEY NOT NULL,
	"document_id" uuid NOT NULL,
	"type" text NOT NULL,
	"user_id" uuid,
	"department" text,
	"group_id" uuid,
	"created_by_id" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_document_attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"document_id" uuid NOT NULL,
	"kind" text DEFAULT 'other' NOT NULL,
	"label" text,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"effective_date" date,
	"expiry_date" date,
	"notes" text,
	"uploaded_by_id" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_signatures" (
	"id" uuid PRIMARY KEY NOT NULL,
	"document_id" uuid NOT NULL,
	"signer_email" text NOT NULL,
	"signer_name" text NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invite_message" text,
	"sent_at" timestamp(3),
	"viewed_at" timestamp(3),
	"signed_at" timestamp(3),
	"declined_at" timestamp(3),
	"decline_reason" text,
	"signature_text" text,
	"signature_method" text,
	"signed_ip" text,
	"signed_user_agent" text,
	"expires_at" timestamp(3),
	"provider" text DEFAULT 'inhouse' NOT NULL,
	"docusign_envelope_id" text,
	"signing_order" integer DEFAULT 1 NOT NULL,
	"docusign_signer_status" text,
	"signed_pdf_url" text,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_docusign_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"expires_at" timestamp(3) NOT NULL,
	"account_id" text NOT NULL,
	"base_uri" text NOT NULL,
	"scopes" text[],
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_announcements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"kind" text DEFAULT 'other' NOT NULL,
	"entity_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp(3),
	"expires_at" timestamp(3),
	"requires_ack" boolean DEFAULT false NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_announcement_attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"announcement_id" uuid NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"uploaded_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "it_access_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_number" serial NOT NULL,
	"employee_id" uuid NOT NULL,
	"system_id" text NOT NULL,
	"request_type" text DEFAULT 'new' NOT NULL,
	"requested_access_level" varchar(200) NOT NULL,
	"business_justification" text NOT NULL,
	"start_date" date,
	"end_date" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_step_order" integer,
	"manager_comments" text,
	"it_comments" text,
	"reject_reason" text,
	"submitted_at" timestamp(3),
	"granted_by" uuid,
	"granted_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "it_access_approval_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"approver_type" text NOT NULL,
	"approver_user_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by_id" uuid,
	"decided_at" timestamp(3),
	"notes" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_notification_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"singleton" boolean DEFAULT true NOT NULL,
	"recipients" text[] DEFAULT '{"RAY"}',
	"notify_contract_expiry" boolean DEFAULT true NOT NULL,
	"notify_contract_review" boolean DEFAULT true NOT NULL,
	"notify_initial_drafting" boolean DEFAULT true NOT NULL,
	"notify_licence_renewal" boolean DEFAULT true NOT NULL,
	"notify_compliance_filing" boolean DEFAULT true NOT NULL,
	"notify_counterparty_review" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkt_campaign_levers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"lever_id" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkt_creatives" (
	"id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"kind" varchar(20) NOT NULL,
	"source" varchar(20) DEFAULT 'upload' NOT NULL,
	"name" varchar(300) NOT NULL,
	"url" text NOT NULL,
	"mime_type" varchar(150),
	"size" integer,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkt_levers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkt_predictions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"format" varchar(10) NOT NULL,
	"name" varchar(300) NOT NULL,
	"url" text NOT NULL,
	"mime_type" varchar(150),
	"size" integer,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"company" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'prospect' NOT NULL,
	"region" text,
	"country" text,
	"website" text,
	"description" text,
	"contract_value" numeric(15, 2),
	"contract_start" date,
	"contract_end" date,
	"notes" text,
	"production_live_date" date,
	"go_live_date" date,
	"revised_go_live_date" date,
	"past_campaign_date" date,
	"next_campaign_date" date,
	"dependency" text,
	"comment" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"owner_id" uuid,
	"department" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_contacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"partner_id" text NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"email" text,
	"phone" text,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"partner_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_columns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"partner_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT 'bg-zinc-500' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mkt_campaigns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(300) NOT NULL,
	"campaign_date" date NOT NULL,
	"hours" double precision,
	"owner_id" uuid,
	"status" varchar(20) DEFAULT 'planned' NOT NULL,
	"country" varchar(100),
	"partner_id" uuid,
	"product" varchar(150),
	"channel" varchar(100),
	"campaign_type" varchar(100),
	"objective" text,
	"target_audience" text,
	"levers_sequence" text,
	"copy_text" text,
	"expected_reach" integer,
	"actual_reach" integer,
	"budget" numeric(15, 2),
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"archived_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "partner_task_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_task_assignees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"allocation_pct" integer,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_workflow_transitions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_id" uuid,
	"comment" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"partner_id" text NOT NULL,
	"parent_task_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"owner_id" uuid,
	"start_date" date,
	"end_date" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_workflow_emails" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"transition_id" text,
	"stage" text NOT NULL,
	"kind" text NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"sent_at" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_columns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT 'bg-zinc-500' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"milestone_id" uuid,
	"parent_task_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'P1' NOT NULL,
	"owner_id" uuid,
	"start_date" date,
	"end_date" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_reminder_sent_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_task_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'not_yet_started' NOT NULL,
	"owner_id" uuid NOT NULL,
	"partner_id" text,
	"start_date" date,
	"end_date" date,
	"budget" numeric(15, 2),
	"progress" integer DEFAULT 0 NOT NULL,
	"custom_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"production_live_date" date,
	"go_live_date" date,
	"revised_go_live_date" date,
	"agreement" text,
	"dependency" text,
	"comment" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"team" text DEFAULT 'general' NOT NULL,
	"department" text,
	"departments" text[] DEFAULT '{"RAY"}',
	"workstream" text,
	"details" text,
	"task_type" text,
	"assigned_team" text,
	"default_assignee_mode" text DEFAULT 'none' NOT NULL,
	"default_assignee_id" uuid,
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_reminder_sent_at" timestamp(3),
	"workflow_status" text,
	"workflow_updated_at" timestamp(6) with time zone,
	"escalated_to_id" uuid,
	"current_step_order" integer,
	"priority" text,
	"archived_at" timestamp(6) with time zone,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_task_resources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" text PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"contact" text,
	"value" numeric(15, 2) NOT NULL,
	"stage" text DEFAULT 'lead' NOT NULL,
	"probability" integer DEFAULT 10 NOT NULL,
	"close_date" date,
	"type" text,
	"country" text,
	"notes" text,
	"partner_id" text,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_task_assignees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"allocation_pct" integer,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_task_activities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"field" text,
	"old_value" text,
	"new_value" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_task_resources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"doc_id" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "it_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'not_yet_started' NOT NULL,
	"owner_id" uuid NOT NULL,
	"start_date" date,
	"end_date" date,
	"production_live_date" date,
	"go_live_date" date,
	"revised_go_live_date" date,
	"dependency" text,
	"comment" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"department" text,
	"status_changed_at" timestamp(3),
	"health_status" text,
	"effort_points" integer,
	"archived_at" timestamp(3),
	"default_assignee_mode" text DEFAULT 'none' NOT NULL,
	"default_assignee_id" uuid,
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_reminder_sent_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "it_project_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "it_project_columns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT 'bg-zinc-500' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "it_project_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"parent_task_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"owner_id" uuid,
	"start_date" date,
	"end_date" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status_changed_at" timestamp(3),
	"completed_at" timestamp(3),
	"effort_points" integer,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "it_project_task_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "it_project_task_assignees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"allocation_pct" integer,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"module" text DEFAULT 'it' NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link_url" text,
	"project_id" text,
	"task_id" uuid,
	"actor_id" uuid,
	"read_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_milestones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'not_started' NOT NULL,
	"owner_id" uuid,
	"start_date" date,
	"end_date" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_task_dependencies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"depends_on_task_id" uuid NOT NULL,
	"type" text DEFAULT 'finish_to_start' NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_project_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_project_columns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT 'bg-zinc-500' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_project_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"parent_task_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'P1' NOT NULL,
	"owner_id" uuid,
	"start_date" date,
	"end_date" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"issue_date" date,
	"partner" text,
	"product" text,
	"issue_type" text,
	"observation" text,
	"expectation" text,
	"eta" text,
	"qa_comment" text,
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_reminder_sent_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_project_task_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_project_task_assignees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"allocation_pct" integer,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_project_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_project_columns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT 'bg-zinc-500' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_project_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"parent_task_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"owner_id" uuid,
	"start_date" date,
	"end_date" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_project_task_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_project_task_assignees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"allocation_pct" integer,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"owner_id" uuid NOT NULL,
	"start_date" date,
	"end_date" date,
	"comment" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"department" text,
	"default_assignee_mode" text DEFAULT 'none' NOT NULL,
	"default_assignee_id" uuid,
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_reminder_sent_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"archived_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "legal_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'not_yet_started' NOT NULL,
	"owner_id" uuid NOT NULL,
	"start_date" date,
	"end_date" date,
	"production_live_date" date,
	"go_live_date" date,
	"revised_go_live_date" date,
	"dependency" text,
	"comment" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"department" text,
	"workstream" text,
	"details" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"default_assignee_mode" text DEFAULT 'none' NOT NULL,
	"default_assignee_id" uuid,
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_reminder_sent_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"archived_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "accounting_project_columns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT 'bg-zinc-500' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounting_project_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"parent_task_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"owner_id" uuid,
	"start_date" date,
	"end_date" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounting_project_task_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounting_project_task_assignees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"allocation_pct" integer,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_project_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_project_columns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT 'bg-zinc-500' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_project_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"parent_task_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"owner_id" uuid,
	"start_date" date,
	"end_date" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_project_task_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_project_task_assignees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"allocation_pct" integer,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounting_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'not_yet_started' NOT NULL,
	"owner_id" uuid NOT NULL,
	"start_date" date,
	"end_date" date,
	"production_live_date" date,
	"go_live_date" date,
	"revised_go_live_date" date,
	"dependency" text,
	"comment" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"department" text,
	"workstream" text,
	"details" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"default_assignee_mode" text DEFAULT 'none' NOT NULL,
	"default_assignee_id" uuid,
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_reminder_sent_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"archived_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "accounting_project_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'not_yet_started' NOT NULL,
	"owner_id" uuid NOT NULL,
	"start_date" date,
	"end_date" date,
	"production_live_date" date,
	"go_live_date" date,
	"revised_go_live_date" date,
	"dependency" text,
	"comment" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"department" text,
	"default_assignee_mode" text DEFAULT 'none' NOT NULL,
	"default_assignee_id" uuid,
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_reminder_sent_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"archived_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "desk_bookings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"desk_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_bookings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"date" date NOT NULL,
	"time_slot" text NOT NULL,
	"end_time" text,
	"title" text,
	"description" text,
	"attendees_count" integer,
	"series_id" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"office_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"serial_no" text,
	"assigned_to" uuid,
	"purchase_date" date,
	"purchase_cost" numeric(15, 2),
	"status" text DEFAULT 'available' NOT NULL,
	"notes" text,
	"supplier" text,
	"manufacturer" text,
	"model" text,
	"colour" text,
	"sub_type" text,
	"operating_system" text,
	"description" text,
	"support_link" text,
	"active_service_date" date,
	"department" text,
	"asset_code" text,
	"version" text,
	"image_url" text,
	"material" text,
	"dimensions" text,
	"condition" text,
	"location_detail" text,
	"warranty_until" date,
	"quantity" integer DEFAULT 1 NOT NULL,
	"useful_life_months" integer,
	"book_value" numeric(15, 2),
	"disposal_date" date,
	"selling_price" numeric(15, 2)
);
--> statement-breakpoint
CREATE TABLE "voucher_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner" varchar(200) NOT NULL,
	"country" varchar(120),
	"redeemed" integer DEFAULT 0 NOT NULL,
	"issued" integer DEFAULT 0 NOT NULL,
	"refund" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"added_by" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"archived_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "appraisal_cycles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ow_daily_metrics" (
	"id" uuid PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"telco" varchar(20) NOT NULL,
	"homepage_views" integer,
	"dau_crm" integer,
	"dau_ga" integer,
	"mau_rolling_30" integer,
	"unique_users" integer,
	"new_users" integer,
	"repeat_users" integer,
	"avg_session_sec" integer,
	"stw_wins" integer,
	"clicks_bnry_games" integer,
	"access_pass_users" integer,
	"bnry_earned" bigint,
	"bnry_redeemed" bigint,
	"mau_nexus" integer,
	"new_users_ga" integer,
	"repeat_users_ga" integer,
	"sessions_ga" integer,
	"total_credit" bigint,
	"total_debit" bigint,
	"total_transactions" integer,
	"spin_usage" integer,
	"spin_win_tokens" bigint,
	"unique_spin_users" integer,
	"users_fando" integer,
	"users_ngage" integer,
	"tx_metrics" jsonb,
	"is_anomaly" boolean DEFAULT false NOT NULL,
	"is_intraday" boolean DEFAULT false NOT NULL,
	"source_tab" varchar(120),
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ow_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"narrative" jsonb,
	"generated_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kra_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"department" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offices" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"timezone" text,
	"capacity" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_rooms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"office_id" text NOT NULL,
	"name" text NOT NULL,
	"capacity" integer DEFAULT 0 NOT NULL,
	"amenities" text,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" varchar(300) NOT NULL,
	"campaign_date" date NOT NULL,
	"hours" double precision,
	"levers_pulled" text,
	"copy_design" text,
	"prediction_file_url" text,
	"prediction_file_name" text,
	"status" varchar(20) DEFAULT 'planned' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"added_by" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appraisal_kras" (
	"id" uuid PRIMARY KEY NOT NULL,
	"appraisal_id" uuid NOT NULL,
	"kra_template_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"weight" integer DEFAULT 0 NOT NULL,
	"self_score" integer,
	"manager_score" integer,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appraisal_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"appraisal_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appraisal_ratings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"appraisal_id" uuid NOT NULL,
	"rater_id" uuid NOT NULL,
	"category" varchar(50) NOT NULL,
	"score" integer NOT NULL,
	"comment" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"appraisal_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"weight" integer DEFAULT 0 NOT NULL,
	"self_score" integer,
	"manager_score" integer,
	"status" text DEFAULT 'not_started' NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_information_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"asked_by_id" uuid NOT NULL,
	"assigned_to_id" uuid NOT NULL,
	"raised_at_status" text NOT NULL,
	"question" text NOT NULL,
	"response" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"responded_at" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"default_route" varchar(200),
	"deleted_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_transitions" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_id" uuid,
	"choice" text,
	"comment" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_emails" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"kind" text NOT NULL,
	"stage" text NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"sent_at" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_success_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appraisals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cycle_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"manager_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"self_rating" integer,
	"self_comment" text,
	"manager_rating" integer,
	"manager_comment" text,
	"final_rating" integer,
	"completed_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"type" text DEFAULT 'idea' NOT NULL,
	"project_id" text,
	"priority" text,
	"raised_by_id" uuid NOT NULL,
	"status" text DEFAULT 'pending_pm_review' NOT NULL,
	"status_changed_at" timestamp(6) with time zone,
	"current_step_order" integer,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"title" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"archived_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "crm_leads" (
	"id" text PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"legacy_deal_id" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"title" text,
	"source" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"owner_id" uuid NOT NULL,
	"notes" text,
	"converted_opportunity_id" text,
	"converted_at" timestamp(3),
	"disqualify_reason" text,
	"business_units" text[] DEFAULT '{"RAY"}',
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"archived_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "crm_opportunities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"legacy_deal_id" text,
	"account_id" text NOT NULL,
	"contact_id" text,
	"stage" text DEFAULT 'qualified' NOT NULL,
	"sort_order_within_stage" integer DEFAULT 0 NOT NULL,
	"value" numeric(15, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"probability" integer DEFAULT 20 NOT NULL,
	"probability_custom" boolean DEFAULT false NOT NULL,
	"close_date" date,
	"launch_date" date,
	"revenue_launch_date" date,
	"type" text,
	"notes" text,
	"owner_id" uuid NOT NULL,
	"lost_reason" text,
	"business_units" text[] DEFAULT '{"RAY"}',
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_reminder_sent_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"archived_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "crm_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"subject" text NOT NULL,
	"body" text,
	"occurred_at" timestamp(3) NOT NULL,
	"duration_mins" integer,
	"owner_id" uuid NOT NULL,
	"lead_id" text,
	"opportunity_id" text,
	"contact_id" text,
	"account_id" text,
	"external_ref" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_stage_config" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"probability" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"color" text DEFAULT 'border-t-zinc-500' NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_lost_reasons" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp(3),
	"created_by" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_owners" (
	"module_id" varchar(50) PRIMARY KEY NOT NULL,
	"owner_id" uuid
);
--> statement-breakpoint
CREATE TABLE "crm_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"industry" text,
	"size" text,
	"country" text,
	"region" text,
	"website" text,
	"notes" text,
	"total_users" integer,
	"app_users" integer,
	"pic_name" text,
	"designation" text,
	"department" text,
	"last_follow_up_date" date,
	"agreement_signed_date" date,
	"engagement_type" text,
	"uat_start_date" date,
	"uat_end_date" date,
	"blocker" text,
	"remarks" text,
	"owner_id" uuid NOT NULL,
	"partner_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"business_units" text[] DEFAULT '{"RAY"}',
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"archived_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "crm_business_units" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT 'grey' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_lead_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"singleton" boolean DEFAULT true NOT NULL,
	"notify_emails" text[] DEFAULT '{"RAY"}',
	"notify_on_create" boolean DEFAULT true NOT NULL,
	"notify_owner_on_create" boolean DEFAULT true NOT NULL,
	"notify_owner_on_stage_change" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_opportunity_business_units" (
	"id" text PRIMARY KEY NOT NULL,
	"opportunity_id" text NOT NULL,
	"business_unit" text NOT NULL,
	"stage" text DEFAULT 'qualified' NOT NULL,
	"probability" integer DEFAULT 20 NOT NULL,
	"probability_custom" boolean DEFAULT false NOT NULL,
	"value" numeric(15, 2) DEFAULT '0' NOT NULL,
	"close_date" date,
	"launch_date" date,
	"revenue_launch_date" date,
	"lost_reason" text,
	"sort_order_within_stage" integer DEFAULT 0 NOT NULL,
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_reminder_sent_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"industry" text,
	"size" text,
	"country" text,
	"region" text,
	"website" text,
	"notes" text,
	"total_users" integer,
	"app_users" integer,
	"pic_name" text,
	"designation" text,
	"department" text,
	"last_follow_up_date" date,
	"agreement_signed_date" date,
	"engagement_type" text,
	"uat_start_date" date,
	"uat_end_date" date,
	"blocker" text,
	"remarks" text,
	"owner_id" uuid NOT NULL,
	"partner_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"business_units" text[] DEFAULT '{"RAY"}',
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"archived_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "revenue_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"title" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"archived_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "revenue_leads" (
	"id" text PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"legacy_deal_id" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"title" text,
	"source" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"owner_id" uuid NOT NULL,
	"notes" text,
	"converted_opportunity_id" text,
	"converted_at" timestamp(3),
	"disqualify_reason" text,
	"business_units" text[] DEFAULT '{"RAY"}',
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"archived_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "revenue_opportunities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"legacy_deal_id" text,
	"account_id" text NOT NULL,
	"contact_id" text,
	"stage" text DEFAULT 'qualified' NOT NULL,
	"sort_order_within_stage" integer DEFAULT 0 NOT NULL,
	"value" numeric(15, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"probability" integer DEFAULT 20 NOT NULL,
	"probability_custom" boolean DEFAULT false NOT NULL,
	"close_date" date,
	"launch_date" date,
	"revenue_launch_date" date,
	"type" text,
	"notes" text,
	"owner_id" uuid NOT NULL,
	"lost_reason" text,
	"business_units" text[] DEFAULT '{"RAY"}',
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_reminder_sent_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	"archived_at" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "revenue_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"subject" text NOT NULL,
	"body" text,
	"occurred_at" timestamp(3) NOT NULL,
	"duration_mins" integer,
	"owner_id" uuid NOT NULL,
	"lead_id" text,
	"opportunity_id" text,
	"contact_id" text,
	"account_id" text,
	"external_ref" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_stage_config" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"probability" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"color" text DEFAULT 'border-t-zinc-500' NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"due_date" date NOT NULL,
	"owner_id" uuid NOT NULL,
	"opportunity_id" text,
	"lead_id" text,
	"completed_at" timestamp(3),
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_reminder_sent_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_lost_reasons" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_lead_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"singleton" boolean DEFAULT true NOT NULL,
	"notify_emails" text[] DEFAULT '{"RAY"}',
	"notify_on_create" boolean DEFAULT true NOT NULL,
	"notify_owner_on_create" boolean DEFAULT true NOT NULL,
	"notify_owner_on_stage_change" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_opportunity_business_units" (
	"id" text PRIMARY KEY NOT NULL,
	"opportunity_id" text NOT NULL,
	"business_unit" text NOT NULL,
	"stage" text DEFAULT 'qualified' NOT NULL,
	"probability" integer DEFAULT 20 NOT NULL,
	"probability_custom" boolean DEFAULT false NOT NULL,
	"value" numeric(15, 2) DEFAULT '0' NOT NULL,
	"close_date" date,
	"launch_date" date,
	"revenue_launch_date" date,
	"lost_reason" text,
	"sort_order_within_stage" integer DEFAULT 0 NOT NULL,
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_reminder_sent_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" text,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"timestamp" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"bucket" varchar(100) NOT NULL,
	"bytes" bigint NOT NULL,
	"object_count" integer NOT NULL,
	"captured_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_uploads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"path" text NOT NULL,
	"bucket" text,
	"uploaded_by" uuid NOT NULL,
	"purpose" text,
	"linked_to" text,
	"linked_id" text,
	"deleted_at" timestamp(3),
	"deleted_by" uuid,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_chain_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"chain_id" text NOT NULL,
	"order" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"approver_user_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"mobile" text NOT NULL,
	"linkedin" text,
	"website" text,
	"attachment" text NOT NULL,
	"job_id" uuid NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp(3) NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixed_asset_count_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"asset_id" uuid,
	"scanned_tag" text,
	"expected_quantity" integer NOT NULL,
	"counted_quantity" integer NOT NULL,
	"note" text,
	"counted_by" uuid NOT NULL,
	"counted_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "office_desks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"office_id" text NOT NULL,
	"name" text NOT NULL,
	"floor" text,
	"zone" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"due_date" date NOT NULL,
	"owner_id" uuid NOT NULL,
	"opportunity_id" text,
	"lead_id" text,
	"completed_at" timestamp(3),
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_reminder_sent_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_code" varchar(100) NOT NULL,
	CONSTRAINT "role_permissions_pkey" PRIMARY KEY("role_id","permission_code")
);
--> statement-breakpoint
CREATE TABLE "message_hidden_for" (
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"hidden_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "message_hidden_for_pkey" PRIMARY KEY("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid NOT NULL,
	"key" varchar(50) NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "user_settings_pkey" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "message_reactions" (
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"emoji" varchar(20) NOT NULL,
	"created_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "message_reactions_pkey" PRIMARY KEY("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "training_completions" (
	"employee_id" uuid NOT NULL,
	"module_id" text NOT NULL,
	"completed_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"score" integer,
	CONSTRAINT "training_completions_pkey" PRIMARY KEY("employee_id","module_id")
);
--> statement-breakpoint
CREATE TABLE "legal_announcement_acks" (
	"announcement_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"acked_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"acked_ip" text,
	CONSTRAINT "legal_announcement_acks_pkey" PRIMARY KEY("announcement_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"assigned_by" uuid,
	CONSTRAINT "user_roles_pkey" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "user_group_members" (
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"added_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"added_by" uuid,
	CONSTRAINT "user_group_members_pkey" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "module_access" (
	"user_id" uuid NOT NULL,
	"module_id" varchar(50) NOT NULL,
	"granted" boolean DEFAULT true NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "module_access_pkey" PRIMARY KEY("user_id","module_id")
);
--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"left_at" timestamp(3),
	"last_read_at" timestamp(3),
	CONSTRAINT "conversation_members_pkey" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "approval_chain_decisions" ADD CONSTRAINT "approval_chain_decisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "approval_chain_decisions" ADD CONSTRAINT "approval_chain_decisions_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "approval_chain_decisions" ADD CONSTRAINT "approval_chain_decisions_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "approval_chain_decisions" ADD CONSTRAINT "approval_chain_decisions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "wall_comments" ADD CONSTRAINT "wall_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."wall_posts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "wall_comments" ADD CONSTRAINT "wall_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "company_news" ADD CONSTRAINT "company_news_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "company_dates" ADD CONSTRAINT "company_dates_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "wall_posts" ADD CONSTRAINT "wall_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "aria_conversation_summaries" ADD CONSTRAINT "aria_conversation_summaries_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."aria_conversations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "aria_conversation_memory" ADD CONSTRAINT "aria_conversation_memory_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."aria_conversations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "aria_messages" ADD CONSTRAINT "aria_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."aria_conversations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "aria_conversations" ADD CONSTRAINT "aria_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "aria_attachments" ADD CONSTRAINT "aria_attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "aria_attachments" ADD CONSTRAINT "aria_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."aria_messages"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "aria_knowledge_articles" ADD CONSTRAINT "aria_knowledge_articles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "aria_query_logs" ADD CONSTRAINT "aria_query_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "aria_query_logs" ADD CONSTRAINT "aria_query_logs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."aria_conversations"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "aria_brief_subscriptions" ADD CONSTRAINT "aria_brief_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "aria_brief_deliveries" ADD CONSTRAINT "aria_brief_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "aria_feedback" ADD CONSTRAINT "aria_feedback_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."aria_messages"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "aria_feedback" ADD CONSTRAINT "aria_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "aria_feedback" ADD CONSTRAINT "aria_feedback_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "aria_feedback" ADD CONSTRAINT "aria_feedback_resulting_article_id_fkey" FOREIGN KEY ("resulting_article_id") REFERENCES "public"."aria_knowledge_articles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."wiki_pages"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "wiki_page_versions" ADD CONSTRAINT "wiki_page_versions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."wiki_pages"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "wiki_page_versions" ADD CONSTRAINT "wiki_page_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "wiki_page_permissions" ADD CONSTRAINT "wiki_page_permissions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."wiki_pages"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "wiki_page_permissions" ADD CONSTRAINT "wiki_page_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_entity_memberships" ADD CONSTRAINT "user_entity_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_entity_memberships" ADD CONSTRAINT "user_entity_memberships_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_entity_memberships" ADD CONSTRAINT "user_entity_memberships_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_reporting_to_fkey" FOREIGN KEY ("reporting_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_reused_from_account_id_fkey" FOREIGN KEY ("reused_from_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversed_by_entry_id_fkey" FOREIGN KEY ("reversed_by_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reverses_entry_id_fkey" FOREIGN KEY ("reverses_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "auth_logs" ADD CONSTRAINT "auth_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_suggested_account_fkey" FOREIGN KEY ("suggested_account") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_mapped_account_fkey" FOREIGN KEY ("mapped_account") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "cash_advance_requests" ADD CONSTRAINT "cash_advance_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "cash_advance_requests" ADD CONSTRAINT "cash_advance_requests_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "cash_advance_requests" ADD CONSTRAINT "cash_advance_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "cash_advance_approval_steps" ADD CONSTRAINT "cash_advance_approval_steps_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_linked_je_id_fkey" FOREIGN KEY ("linked_je_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_travel_request_id_fkey" FOREIGN KEY ("travel_request_id") REFERENCES "public"."travel_requests"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."expense_reports"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expense_reports" ADD CONSTRAINT "expense_reports_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expense_approval_steps" ADD CONSTRAINT "expense_approval_steps_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expense_approval_decisions" ADD CONSTRAINT "expense_approval_decisions_expense_report_id_fkey" FOREIGN KEY ("expense_report_id") REFERENCES "public"."expense_reports"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expense_approval_decisions" ADD CONSTRAINT "expense_approval_decisions_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expense_approval_decisions" ADD CONSTRAINT "expense_approval_decisions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_linked_je_id_fkey" FOREIGN KEY ("linked_je_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "cash_advance_approval_decisions" ADD CONSTRAINT "cash_advance_approval_decisions_cash_advance_request_id_fkey" FOREIGN KEY ("cash_advance_request_id") REFERENCES "public"."cash_advance_requests"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "cash_advance_approval_decisions" ADD CONSTRAINT "cash_advance_approval_decisions_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "cash_advance_approval_decisions" ADD CONSTRAINT "cash_advance_approval_decisions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "public"."tax_codes"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "cash_advance_items" ADD CONSTRAINT "cash_advance_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."cash_advance_requests"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "cash_advance_items" ADD CONSTRAINT "cash_advance_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_linked_invoice_id_fkey" FOREIGN KEY ("linked_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "public"."tax_codes"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_chart_of_account_id_fkey" FOREIGN KEY ("chart_of_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tax_codes" ADD CONSTRAINT "tax_codes_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tax_codes" ADD CONSTRAINT "tax_codes_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "public"."tax_codes"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "fixed_asset_transfers" ADD CONSTRAINT "fixed_asset_transfers_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."fixed_assets"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "fixed_asset_transfers" ADD CONSTRAINT "fixed_asset_transfers_destination_asset_id_fkey" FOREIGN KEY ("destination_asset_id") REFERENCES "public"."fixed_assets"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "helpdesk_tickets" ADD CONSTRAINT "helpdesk_tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "helpdesk_tickets" ADD CONSTRAINT "helpdesk_tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "validator_node_alerts" ADD CONSTRAINT "validator_node_alerts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "helpdesk_settings" ADD CONSTRAINT "helpdesk_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "helpdesk_comments" ADD CONSTRAINT "helpdesk_comments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."helpdesk_tickets"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "helpdesk_comments" ADD CONSTRAINT "helpdesk_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "fixed_asset_disposals" ADD CONSTRAINT "fixed_asset_disposals_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."fixed_assets"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "fixed_asset_disposals" ADD CONSTRAINT "fixed_asset_disposals_linked_je_id_fkey" FOREIGN KEY ("linked_je_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "fixed_asset_remeasurements" ADD CONSTRAINT "fixed_asset_remeasurements_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."fixed_assets"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "fixed_asset_remeasurements" ADD CONSTRAINT "fixed_asset_remeasurements_linked_je_id_fkey" FOREIGN KEY ("linked_je_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "survey_form_responses" ADD CONSTRAINT "survey_form_responses_survey_form_id_fkey" FOREIGN KEY ("survey_form_id") REFERENCES "public"."survey_forms"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "survey_form_responses" ADD CONSTRAINT "survey_form_responses_respondent_id_fkey" FOREIGN KEY ("respondent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_respondent_id_fkey" FOREIGN KEY ("respondent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "travel_approval_steps" ADD CONSTRAINT "travel_approval_steps_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "survey_forms" ADD CONSTRAINT "survey_forms_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "travel_approval_decisions" ADD CONSTRAINT "travel_approval_decisions_travel_request_id_fkey" FOREIGN KEY ("travel_request_id") REFERENCES "public"."travel_requests"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "travel_approval_decisions" ADD CONSTRAINT "travel_approval_decisions_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "travel_approval_decisions" ADD CONSTRAINT "travel_approval_decisions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "travel_requests" ADD CONSTRAINT "travel_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "travel_requests" ADD CONSTRAINT "travel_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "travel_requests" ADD CONSTRAINT "travel_requests_delegated_to_fkey" FOREIGN KEY ("delegated_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "travel_requests" ADD CONSTRAINT "travel_requests_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "survey_form_questions" ADD CONSTRAINT "survey_form_questions_survey_form_id_fkey" FOREIGN KEY ("survey_form_id") REFERENCES "public"."survey_forms"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "survey_form_answers" ADD CONSTRAINT "survey_form_answers_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "public"."survey_form_responses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "survey_form_answers" ADD CONSTRAINT "survey_form_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."survey_form_questions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "public"."survey_responses"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."survey_questions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "balance_transactions" ADD CONSTRAINT "balance_transactions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "balance_transactions" ADD CONSTRAINT "balance_transactions_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_delegated_to_fkey" FOREIGN KEY ("delegated_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leave_approval_steps" ADD CONSTRAINT "leave_approval_steps_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leave_approval_decisions" ADD CONSTRAINT "leave_approval_decisions_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leave_approval_decisions" ADD CONSTRAINT "leave_approval_decisions_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leave_approval_decisions" ADD CONSTRAINT "leave_approval_decisions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "public_holidays" ADD CONSTRAINT "public_holidays_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_run_by_fkey" FOREIGN KEY ("run_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "consultant_invoices" ADD CONSTRAINT "consultant_invoices_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "consultant_invoices" ADD CONSTRAINT "consultant_invoices_consultant_id_fkey" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "esop_grants" ADD CONSTRAINT "esop_grants_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leave_policy_approvers" ADD CONSTRAINT "leave_policy_approvers_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leave_policy_approvers" ADD CONSTRAINT "leave_policy_approvers_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "onboarding_runs" ADD CONSTRAINT "onboarding_runs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "onboarding_runs" ADD CONSTRAINT "onboarding_runs_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "offboarding_runs" ADD CONSTRAINT "offboarding_runs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "offboarding_runs" ADD CONSTRAINT "offboarding_runs_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "visa_records" ADD CONSTRAINT "visa_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "visa_records" ADD CONSTRAINT "visa_records_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "visa_event_logs" ADD CONSTRAINT "visa_event_logs_visa_record_id_fkey" FOREIGN KEY ("visa_record_id") REFERENCES "public"."visa_records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "visa_event_logs" ADD CONSTRAINT "visa_event_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "visa_knowledge_articles" ADD CONSTRAINT "visa_knowledge_articles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "visa_checklist_items" ADD CONSTRAINT "visa_checklist_items_visa_record_id_fkey" FOREIGN KEY ("visa_record_id") REFERENCES "public"."visa_records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "employee_agreements" ADD CONSTRAINT "employee_agreements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "employee_agreements" ADD CONSTRAINT "employee_agreements_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "benefit_enrollments" ADD CONSTRAINT "benefit_enrollments_benefit_id_fkey" FOREIGN KEY ("benefit_id") REFERENCES "public"."benefits"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "benefit_enrollments" ADD CONSTRAINT "benefit_enrollments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "company_policies" ADD CONSTRAINT "company_policies_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "company_policies" ADD CONSTRAINT "company_policies_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payroll_approval_steps" ADD CONSTRAINT "payroll_approval_steps_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "public"."attendance_records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "attendance_employee_shifts" ADD CONSTRAINT "attendance_employee_shifts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "attendance_employee_shifts" ADD CONSTRAINT "attendance_employee_shifts_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."attendance_shifts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "attendance_audit_logs" ADD CONSTRAINT "attendance_audit_logs_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "public"."attendance_records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "attendance_audit_logs" ADD CONSTRAINT "attendance_audit_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "attendance_audit_logs" ADD CONSTRAINT "attendance_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "attendance_shifts" ADD CONSTRAINT "attendance_shifts_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ninety_day_notifications" ADD CONSTRAINT "ninety_day_notifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ninety_day_notifications" ADD CONSTRAINT "ninety_day_notifications_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "attendance_exceptions" ADD CONSTRAINT "attendance_exceptions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_google_connections" ADD CONSTRAINT "user_google_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "investors" ADD CONSTRAINT "investors_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "investor_tasks" ADD CONSTRAINT "investor_tasks_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "investor_tasks" ADD CONSTRAINT "investor_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "investor_activities" ADD CONSTRAINT "investor_activities_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "investor_activities" ADD CONSTRAINT "investor_activities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "investor_leads" ADD CONSTRAINT "investor_leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "investor_accounts" ADD CONSTRAINT "investor_accounts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "data_room_documents" ADD CONSTRAINT "data_room_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "investor_updates" ADD CONSTRAINT "investor_updates_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_vendors" ADD CONSTRAINT "it_vendors_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_subscriptions" ADD CONSTRAINT "it_subscriptions_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."it_vendors"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_subscriptions" ADD CONSTRAINT "it_subscriptions_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_subscriptions" ADD CONSTRAINT "it_subscriptions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_subscriptions" ADD CONSTRAINT "it_subscriptions_renewal_decision_by_fkey" FOREIGN KEY ("renewal_decision_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_billing_records" ADD CONSTRAINT "it_billing_records_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."it_subscriptions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_billing_records" ADD CONSTRAINT "it_billing_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_billing_alerts" ADD CONSTRAINT "it_billing_alerts_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."it_subscriptions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_billing_alerts" ADD CONSTRAINT "it_billing_alerts_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "investor_contacts" ADD CONSTRAINT "investor_contacts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "investor_contacts" ADD CONSTRAINT "investor_contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."investor_accounts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_access_assignments" ADD CONSTRAINT "it_access_assignments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."it_access_requests"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_access_assignments" ADD CONSTRAINT "it_access_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_access_assignments" ADD CONSTRAINT "it_access_assignments_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "public"."it_systems"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_access_assignments" ADD CONSTRAINT "it_access_assignments_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_access_assignments" ADD CONSTRAINT "it_access_assignments_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_access_audit_logs" ADD CONSTRAINT "it_access_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_access_audit_logs" ADD CONSTRAINT "it_access_audit_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_document_shares" ADD CONSTRAINT "legal_document_shares_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_document_shares" ADD CONSTRAINT "legal_document_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_document_shares" ADD CONSTRAINT "legal_document_shares_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."user_groups"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_document_shares" ADD CONSTRAINT "legal_document_shares_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_document_attachments" ADD CONSTRAINT "legal_document_attachments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_document_attachments" ADD CONSTRAINT "legal_document_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_signatures" ADD CONSTRAINT "legal_signatures_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_signatures" ADD CONSTRAINT "legal_signatures_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_docusign_connections" ADD CONSTRAINT "user_docusign_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_announcements" ADD CONSTRAINT "legal_announcements_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_announcements" ADD CONSTRAINT "legal_announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_announcement_attachments" ADD CONSTRAINT "legal_announcement_attachments_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "public"."legal_announcements"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_access_requests" ADD CONSTRAINT "it_access_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_access_requests" ADD CONSTRAINT "it_access_requests_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "public"."it_systems"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_access_requests" ADD CONSTRAINT "it_access_requests_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_access_approval_decisions" ADD CONSTRAINT "it_access_approval_decisions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."it_access_requests"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_access_approval_decisions" ADD CONSTRAINT "it_access_approval_decisions_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_access_approval_decisions" ADD CONSTRAINT "it_access_approval_decisions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "mkt_campaign_levers" ADD CONSTRAINT "mkt_campaign_levers_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."mkt_campaigns"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "mkt_campaign_levers" ADD CONSTRAINT "mkt_campaign_levers_lever_id_fkey" FOREIGN KEY ("lever_id") REFERENCES "public"."mkt_levers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "mkt_creatives" ADD CONSTRAINT "mkt_creatives_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."mkt_campaigns"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "mkt_creatives" ADD CONSTRAINT "mkt_creatives_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "mkt_predictions" ADD CONSTRAINT "mkt_predictions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."mkt_campaigns"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "mkt_predictions" ADD CONSTRAINT "mkt_predictions_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partner_contacts" ADD CONSTRAINT "partner_contacts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partner_members" ADD CONSTRAINT "partner_members_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partner_members" ADD CONSTRAINT "partner_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partner_columns" ADD CONSTRAINT "partner_columns_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "mkt_campaigns" ADD CONSTRAINT "mkt_campaigns_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "mkt_campaigns" ADD CONSTRAINT "mkt_campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partner_task_comments" ADD CONSTRAINT "partner_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."partner_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partner_task_comments" ADD CONSTRAINT "partner_task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partner_task_assignees" ADD CONSTRAINT "partner_task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."partner_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partner_task_assignees" ADD CONSTRAINT "partner_task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_workflow_transitions" ADD CONSTRAINT "project_workflow_transitions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partner_tasks" ADD CONSTRAINT "partner_tasks_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partner_tasks" ADD CONSTRAINT "partner_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partner_tasks" ADD CONSTRAINT "partner_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "public"."partner_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_workflow_emails" ADD CONSTRAINT "project_workflow_emails_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_columns" ADD CONSTRAINT "project_columns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "public"."project_milestones"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "public"."project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_task_comments" ADD CONSTRAINT "project_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_task_comments" ADD CONSTRAINT "project_task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partner_task_resources" ADD CONSTRAINT "partner_task_resources_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."partner_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_task_assignees" ADD CONSTRAINT "project_task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_task_assignees" ADD CONSTRAINT "project_task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_task_activities" ADD CONSTRAINT "project_task_activities_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_task_activities" ADD CONSTRAINT "project_task_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_task_resources" ADD CONSTRAINT "project_task_resources_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_task_resources" ADD CONSTRAINT "project_task_resources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_projects" ADD CONSTRAINT "it_projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_project_members" ADD CONSTRAINT "it_project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."it_projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_project_members" ADD CONSTRAINT "it_project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_project_columns" ADD CONSTRAINT "it_project_columns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."it_projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_project_tasks" ADD CONSTRAINT "it_project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."it_projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_project_tasks" ADD CONSTRAINT "it_project_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_project_tasks" ADD CONSTRAINT "it_project_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "public"."it_project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_project_task_comments" ADD CONSTRAINT "it_project_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."it_project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_project_task_comments" ADD CONSTRAINT "it_project_task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_project_task_assignees" ADD CONSTRAINT "it_project_task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."it_project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "it_project_task_assignees" ADD CONSTRAINT "it_project_task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_task_dependencies" ADD CONSTRAINT "project_task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_task_dependencies" ADD CONSTRAINT "project_task_dependencies_depends_on_task_id_fkey" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "qa_project_members" ADD CONSTRAINT "qa_project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."qa_projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "qa_project_members" ADD CONSTRAINT "qa_project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "qa_project_columns" ADD CONSTRAINT "qa_project_columns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."qa_projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "qa_project_tasks" ADD CONSTRAINT "qa_project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."qa_projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "qa_project_tasks" ADD CONSTRAINT "qa_project_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "qa_project_tasks" ADD CONSTRAINT "qa_project_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "public"."qa_project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "qa_project_task_comments" ADD CONSTRAINT "qa_project_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."qa_project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "qa_project_task_comments" ADD CONSTRAINT "qa_project_task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "qa_project_task_assignees" ADD CONSTRAINT "qa_project_task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."qa_project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "qa_project_task_assignees" ADD CONSTRAINT "qa_project_task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_project_members" ADD CONSTRAINT "legal_project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."legal_projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_project_members" ADD CONSTRAINT "legal_project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_project_columns" ADD CONSTRAINT "legal_project_columns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."legal_projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_project_tasks" ADD CONSTRAINT "legal_project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."legal_projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_project_tasks" ADD CONSTRAINT "legal_project_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_project_tasks" ADD CONSTRAINT "legal_project_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "public"."legal_project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_project_task_comments" ADD CONSTRAINT "legal_project_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."legal_project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_project_task_comments" ADD CONSTRAINT "legal_project_task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_project_task_assignees" ADD CONSTRAINT "legal_project_task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."legal_project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_project_task_assignees" ADD CONSTRAINT "legal_project_task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "qa_projects" ADD CONSTRAINT "qa_projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_projects" ADD CONSTRAINT "legal_projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounting_project_columns" ADD CONSTRAINT "accounting_project_columns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."accounting_projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounting_project_tasks" ADD CONSTRAINT "accounting_project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."accounting_projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounting_project_tasks" ADD CONSTRAINT "accounting_project_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounting_project_tasks" ADD CONSTRAINT "accounting_project_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "public"."accounting_project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounting_project_task_comments" ADD CONSTRAINT "accounting_project_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."accounting_project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounting_project_task_comments" ADD CONSTRAINT "accounting_project_task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounting_project_task_assignees" ADD CONSTRAINT "accounting_project_task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."accounting_project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounting_project_task_assignees" ADD CONSTRAINT "accounting_project_task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_project_members" ADD CONSTRAINT "product_project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."product_projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_project_members" ADD CONSTRAINT "product_project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_project_columns" ADD CONSTRAINT "product_project_columns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."product_projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_project_tasks" ADD CONSTRAINT "product_project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."product_projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_project_tasks" ADD CONSTRAINT "product_project_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_project_tasks" ADD CONSTRAINT "product_project_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "public"."product_project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_project_task_comments" ADD CONSTRAINT "product_project_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."product_project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_project_task_comments" ADD CONSTRAINT "product_project_task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_project_task_assignees" ADD CONSTRAINT "product_project_task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."product_project_tasks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_project_task_assignees" ADD CONSTRAINT "product_project_task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounting_projects" ADD CONSTRAINT "accounting_projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounting_project_members" ADD CONSTRAINT "accounting_project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."accounting_projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "accounting_project_members" ADD CONSTRAINT "accounting_project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_projects" ADD CONSTRAINT "product_projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "desk_bookings" ADD CONSTRAINT "desk_bookings_desk_id_fkey" FOREIGN KEY ("desk_id") REFERENCES "public"."office_desks"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "desk_bookings" ADD CONSTRAINT "desk_bookings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "room_bookings" ADD CONSTRAINT "room_bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."meeting_rooms"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "room_bookings" ADD CONSTRAINT "room_bookings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "voucher_entries" ADD CONSTRAINT "voucher_entries_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "appraisal_cycles" ADD CONSTRAINT "appraisal_cycles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "meeting_rooms" ADD CONSTRAINT "meeting_rooms_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "appraisal_kras" ADD CONSTRAINT "appraisal_kras_appraisal_id_fkey" FOREIGN KEY ("appraisal_id") REFERENCES "public"."appraisals"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "appraisal_kras" ADD CONSTRAINT "appraisal_kras_kra_template_id_fkey" FOREIGN KEY ("kra_template_id") REFERENCES "public"."kra_templates"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "appraisal_comments" ADD CONSTRAINT "appraisal_comments_appraisal_id_fkey" FOREIGN KEY ("appraisal_id") REFERENCES "public"."appraisals"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "appraisal_comments" ADD CONSTRAINT "appraisal_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "appraisal_ratings" ADD CONSTRAINT "appraisal_ratings_appraisal_id_fkey" FOREIGN KEY ("appraisal_id") REFERENCES "public"."appraisals"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "appraisal_ratings" ADD CONSTRAINT "appraisal_ratings_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_appraisal_id_fkey" FOREIGN KEY ("appraisal_id") REFERENCES "public"."appraisals"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "proposal_information_requests" ADD CONSTRAINT "proposal_information_requests_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "proposal_transitions" ADD CONSTRAINT "proposal_transitions_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "proposal_emails" ADD CONSTRAINT "proposal_emails_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."appraisal_cycles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."crm_accounts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_converted_opportunity_id_fkey" FOREIGN KEY ("converted_opportunity_id") REFERENCES "public"."crm_opportunities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."crm_accounts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."crm_opportunities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."crm_accounts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "module_owners" ADD CONSTRAINT "module_owners_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm_settings" ADD CONSTRAINT "crm_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm_opportunity_business_units" ADD CONSTRAINT "crm_opportunity_business_units_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."crm_opportunities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revenue_accounts" ADD CONSTRAINT "revenue_accounts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revenue_accounts" ADD CONSTRAINT "revenue_accounts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revenue_contacts" ADD CONSTRAINT "revenue_contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."revenue_accounts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revenue_leads" ADD CONSTRAINT "revenue_leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revenue_leads" ADD CONSTRAINT "revenue_leads_converted_opportunity_id_fkey" FOREIGN KEY ("converted_opportunity_id") REFERENCES "public"."revenue_opportunities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revenue_opportunities" ADD CONSTRAINT "revenue_opportunities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."revenue_accounts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revenue_opportunities" ADD CONSTRAINT "revenue_opportunities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."revenue_contacts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revenue_opportunities" ADD CONSTRAINT "revenue_opportunities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revenue_activities" ADD CONSTRAINT "revenue_activities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revenue_activities" ADD CONSTRAINT "revenue_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."revenue_leads"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revenue_activities" ADD CONSTRAINT "revenue_activities_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."revenue_opportunities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revenue_activities" ADD CONSTRAINT "revenue_activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."revenue_contacts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revenue_activities" ADD CONSTRAINT "revenue_activities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."revenue_accounts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."crm_opportunities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revenue_settings" ADD CONSTRAINT "revenue_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revenue_opportunity_business_units" ADD CONSTRAINT "revenue_opportunity_business_units_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."revenue_opportunities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "approval_chain_steps" ADD CONSTRAINT "approval_chain_steps_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "public"."approval_chains"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "approval_chain_steps" ADD CONSTRAINT "approval_chain_steps_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "fixed_asset_count_lines" ADD CONSTRAINT "fixed_asset_count_lines_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."fixed_asset_count_sessions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "fixed_asset_count_lines" ADD CONSTRAINT "fixed_asset_count_lines_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."fixed_assets"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "office_desks" ADD CONSTRAINT "office_desks_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revenue_tasks" ADD CONSTRAINT "revenue_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revenue_tasks" ADD CONSTRAINT "revenue_tasks_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."revenue_opportunities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "revenue_tasks" ADD CONSTRAINT "revenue_tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."revenue_leads"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "message_hidden_for" ADD CONSTRAINT "message_hidden_for_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "message_hidden_for" ADD CONSTRAINT "message_hidden_for_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."training_modules"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_announcement_acks" ADD CONSTRAINT "legal_announcement_acks_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "public"."legal_announcements"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "legal_announcement_acks" ADD CONSTRAINT "legal_announcement_acks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."user_groups"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "module_access" ADD CONSTRAINT "module_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "module_access" ADD CONSTRAINT "module_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "approval_chain_decisions_approver_user_id_status_idx" ON "approval_chain_decisions" USING btree ("approver_user_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "approval_chain_decisions_project_id_order_key" ON "approval_chain_decisions" USING btree ("project_id" int4_ops,"order" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "approval_chain_decisions_proposal_id_order_key" ON "approval_chain_decisions" USING btree ("proposal_id" int4_ops,"order" int4_ops);--> statement-breakpoint
CREATE INDEX "approval_chain_decisions_scope_status_idx" ON "approval_chain_decisions" USING btree ("scope" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "conversations_created_by_idx" ON "conversations" USING btree ("created_by" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_direct_key_key" ON "conversations" USING btree ("direct_key" text_ops);--> statement-breakpoint
CREATE INDEX "conversations_type_idx" ON "conversations" USING btree ("type" text_ops);--> statement-breakpoint
CREATE INDEX "conversations_updated_at_idx" ON "conversations" USING btree ("updated_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "messages_author_id_idx" ON "messages" USING btree ("author_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages" USING btree ("conversation_id" timestamp_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "wall_comments_post_id_idx" ON "wall_comments" USING btree ("post_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "company_news_created_at_idx" ON "company_news" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "company_dates_date_idx" ON "company_dates" USING btree ("date" date_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "approval_chains_scope_key" ON "approval_chains" USING btree ("scope" text_ops);--> statement-breakpoint
CREATE INDEX "wall_posts_created_at_idx" ON "wall_posts" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "aria_conversation_memory_conversation_id_idx" ON "aria_conversation_memory" USING btree ("conversation_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "aria_conversation_memory_conversation_id_key_key" ON "aria_conversation_memory" USING btree ("conversation_id" text_ops,"key" text_ops);--> statement-breakpoint
CREATE INDEX "aria_messages_conversation_id_idx" ON "aria_messages" USING btree ("conversation_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "aria_conversations_user_id_idx" ON "aria_conversations" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "aria_attachments_message_id_idx" ON "aria_attachments" USING btree ("message_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "aria_attachments_user_id_idx" ON "aria_attachments" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "aria_knowledge_articles_category_is_active_idx" ON "aria_knowledge_articles" USING btree ("category" bool_ops,"is_active" text_ops);--> statement-breakpoint
CREATE INDEX "aria_knowledge_articles_slug_idx" ON "aria_knowledge_articles" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "aria_knowledge_articles_slug_key" ON "aria_knowledge_articles" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "aria_query_logs_conversation_id_idx" ON "aria_query_logs" USING btree ("conversation_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "aria_query_logs_created_at_idx" ON "aria_query_logs" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "aria_query_logs_user_id_created_at_idx" ON "aria_query_logs" USING btree ("user_id" uuid_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "aria_brief_subscriptions_enabled_hour_local_idx" ON "aria_brief_subscriptions" USING btree ("enabled" int4_ops,"hour_local" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "aria_brief_deliveries_user_id_delivered_on_key" ON "aria_brief_deliveries" USING btree ("user_id" text_ops,"delivered_on" uuid_ops);--> statement-breakpoint
CREATE INDEX "aria_brief_deliveries_user_id_generated_at_idx" ON "aria_brief_deliveries" USING btree ("user_id" uuid_ops,"generated_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "jobs_active_idx" ON "jobs" USING btree ("active" bool_ops);--> statement-breakpoint
CREATE INDEX "jobs_department_idx" ON "jobs" USING btree ("department" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_slug_key" ON "jobs" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "blogs_created_at_idx" ON "blogs" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "aria_feedback_message_id_user_id_key" ON "aria_feedback" USING btree ("message_id" uuid_ops,"user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "aria_feedback_rating_reviewed_created_at_idx" ON "aria_feedback" USING btree ("rating" bool_ops,"reviewed" bool_ops,"created_at" bool_ops);--> statement-breakpoint
CREATE INDEX "aria_feedback_reviewed_by_id_idx" ON "aria_feedback" USING btree ("reviewed_by_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "wiki_pages_folder_idx" ON "wiki_pages" USING btree ("folder" text_ops);--> statement-breakpoint
CREATE INDEX "wiki_pages_is_published_updated_at_idx" ON "wiki_pages" USING btree ("is_published" bool_ops,"updated_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "wiki_pages_parent_id_position_idx" ON "wiki_pages" USING btree ("parent_id" uuid_ops,"position" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_pages_slug_key" ON "wiki_pages" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "wiki_page_versions_page_id_created_at_idx" ON "wiki_page_versions" USING btree ("page_id" timestamp_ops,"created_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_page_versions_page_id_version_key" ON "wiki_page_versions" USING btree ("page_id" uuid_ops,"version" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_page_permissions_page_id_user_id_key" ON "wiki_page_permissions" USING btree ("page_id" uuid_ops,"user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "wiki_page_permissions_user_id_idx" ON "wiki_page_permissions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "entities_code_key" ON "entities" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "user_entity_memberships_entity_id_idx" ON "user_entity_memberships" USING btree ("entity_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "user_entity_memberships_user_id_entity_id_key" ON "user_entity_memberships" USING btree ("user_id" text_ops,"entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "articles_created_at_idx" ON "articles" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "users_deleted_at_idx" ON "users" USING btree ("deleted_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_employee_id_key" ON "users" USING btree ("employee_id" text_ops);--> statement-breakpoint
CREATE INDEX "users_entity_id_idx" ON "users" USING btree ("entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "users_is_active_idx" ON "users" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "departments_code_key" ON "departments" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "departments_is_active_idx" ON "departments" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "departments_name_key" ON "departments" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "departments_parent_id_idx" ON "departments" USING btree ("parent_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "chart_of_accounts_entity_id_code_idx" ON "chart_of_accounts" USING btree ("entity_id" text_ops,"code" text_ops);--> statement-breakpoint
CREATE INDEX "chart_of_accounts_entity_id_name_normalized_idx" ON "chart_of_accounts" USING btree ("entity_id" text_ops,"name_normalized" text_ops);--> statement-breakpoint
CREATE INDEX "chart_of_accounts_reused_from_account_id_idx" ON "chart_of_accounts" USING btree ("reused_from_account_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_entity_id_entry_no_key" ON "journal_entries" USING btree ("entity_id" text_ops,"entry_no" text_ops);--> statement-breakpoint
CREATE INDEX "journal_entries_entity_id_status_idx" ON "journal_entries" USING btree ("entity_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_reversed_by_entry_id_key" ON "journal_entries" USING btree ("reversed_by_entry_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_reverses_entry_id_key" ON "journal_entries" USING btree ("reverses_entry_id" text_ops);--> statement-breakpoint
CREATE INDEX "journal_entries_source_type_source_ref_idx" ON "journal_entries" USING btree ("source_type" text_ops,"source_ref" text_ops);--> statement-breakpoint
CREATE INDEX "auth_logs_created_at_idx" ON "auth_logs" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "auth_logs_email_action_created_at_idx" ON "auth_logs" USING btree ("email" text_ops,"action" text_ops,"created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "auth_logs_ip_created_at_idx" ON "auth_logs" USING btree ("ip" text_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "vendors_contact_id_idx" ON "vendors" USING btree ("contact_id" text_ops);--> statement-breakpoint
CREATE INDEX "vendors_deleted_at_idx" ON "vendors" USING btree ("deleted_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "vendors_entity_id_is_active_idx" ON "vendors" USING btree ("entity_id" text_ops,"is_active" text_ops);--> statement-breakpoint
CREATE INDEX "vendors_entity_id_name_idx" ON "vendors" USING btree ("entity_id" text_ops,"name" text_ops);--> statement-breakpoint
CREATE INDEX "vendors_tax_id_idx" ON "vendors" USING btree ("tax_id" text_ops);--> statement-breakpoint
CREATE INDEX "bank_transactions_bank_account_id_idx" ON "bank_transactions" USING btree ("bank_account_id" text_ops);--> statement-breakpoint
CREATE INDEX "bank_transactions_entity_id_date_idx" ON "bank_transactions" USING btree ("entity_id" date_ops,"date" date_ops);--> statement-breakpoint
CREATE INDEX "bank_transactions_payment_id_idx" ON "bank_transactions" USING btree ("payment_id" text_ops);--> statement-breakpoint
CREATE INDEX "cash_advance_requests_deleted_at_idx" ON "cash_advance_requests" USING btree ("deleted_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "cash_advance_requests_employee_id_status_idx" ON "cash_advance_requests" USING btree ("employee_id" uuid_ops,"status" uuid_ops);--> statement-breakpoint
CREATE INDEX "cash_advance_requests_entity_id_idx" ON "cash_advance_requests" USING btree ("entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "cash_advance_requests_request_date_idx" ON "cash_advance_requests" USING btree ("request_date" date_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "cash_advance_requests_request_number_key" ON "cash_advance_requests" USING btree ("request_number" int4_ops);--> statement-breakpoint
CREATE INDEX "cash_advance_requests_status_idx" ON "cash_advance_requests" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "bnry_transactions_date_idx" ON "bnry_transactions" USING btree ("date" date_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rates_base_currency_currency_effective_date_key" ON "exchange_rates" USING btree ("base_currency" text_ops,"currency" text_ops,"effective_date" text_ops);--> statement-breakpoint
CREATE INDEX "exchange_rates_base_currency_currency_idx" ON "exchange_rates" USING btree ("base_currency" text_ops,"currency" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_fx_rates_currency_effective_date_key" ON "accounting_fx_rates" USING btree ("currency" date_ops,"effective_date" date_ops);--> statement-breakpoint
CREATE INDEX "invoice_line_items_invoice_id_idx" ON "invoice_line_items" USING btree ("invoice_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "cash_advance_approval_steps_order_key" ON "cash_advance_approval_steps" USING btree ("order" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "journal_entry_lines_entry_id_idx" ON "journal_entry_lines" USING btree ("entry_id" text_ops);--> statement-breakpoint
CREATE INDEX "invoices_created_by_idx" ON "invoices" USING btree ("created_by" uuid_ops);--> statement-breakpoint
CREATE INDEX "invoices_deleted_at_idx" ON "invoices" USING btree ("deleted_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "invoices_due_date_idx" ON "invoices" USING btree ("due_date" date_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_entity_id_invoice_no_key" ON "invoices" USING btree ("entity_id" text_ops,"invoice_no" text_ops);--> statement-breakpoint
CREATE INDEX "invoices_entity_id_type_status_idx" ON "invoices" USING btree ("entity_id" text_ops,"type" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "invoices_entity_id_vendor_id_vendor_tax_invoice_no_idx" ON "invoices" USING btree ("entity_id" uuid_ops,"vendor_id" uuid_ops,"vendor_tax_invoice_no" text_ops);--> statement-breakpoint
CREATE INDEX "invoices_vendor_id_idx" ON "invoices" USING btree ("vendor_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "expenses_deleted_at_idx" ON "expenses" USING btree ("deleted_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "expenses_employee_id_idx" ON "expenses" USING btree ("employee_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "expenses_report_id_idx" ON "expenses" USING btree ("report_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "expenses_status_idx" ON "expenses" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "expenses_travel_request_id_idx" ON "expenses" USING btree ("travel_request_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "expense_reports_deleted_at_idx" ON "expense_reports" USING btree ("deleted_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "expense_reports_employee_id_period_idx" ON "expense_reports" USING btree ("employee_id" text_ops,"period" text_ops);--> statement-breakpoint
CREATE INDEX "expense_reports_status_idx" ON "expense_reports" USING btree ("status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "expense_approval_steps_order_key" ON "expense_approval_steps" USING btree ("order" int4_ops);--> statement-breakpoint
CREATE INDEX "expense_approval_decisions_approver_user_id_status_idx" ON "expense_approval_decisions" USING btree ("approver_user_id" uuid_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "expense_approval_decisions_expense_report_id_idx" ON "expense_approval_decisions" USING btree ("expense_report_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "expense_approval_decisions_expense_report_id_order_key" ON "expense_approval_decisions" USING btree ("expense_report_id" int4_ops,"order" uuid_ops);--> statement-breakpoint
CREATE INDEX "payment_allocations_invoice_id_idx" ON "payment_allocations" USING btree ("invoice_id" text_ops);--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations" USING btree ("payment_id" text_ops);--> statement-breakpoint
CREATE INDEX "payments_deleted_at_idx" ON "payments" USING btree ("deleted_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "payments_entity_id_idx" ON "payments" USING btree ("entity_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "payments_entity_id_receipt_no_key" ON "payments" USING btree ("entity_id" text_ops,"receipt_no" text_ops);--> statement-breakpoint
CREATE INDEX "payments_invoice_id_idx" ON "payments" USING btree ("invoice_id" text_ops);--> statement-breakpoint
CREATE INDEX "cash_advance_approval_decisions_approver_user_id_status_idx" ON "cash_advance_approval_decisions" USING btree ("approver_user_id" uuid_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "cash_advance_approval_decisions_cash_advance_request_id_idx" ON "cash_advance_approval_decisions" USING btree ("cash_advance_request_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "cash_advance_approval_decisions_cash_advance_request_id_ord_key" ON "cash_advance_approval_decisions" USING btree ("cash_advance_request_id" int4_ops,"order" uuid_ops);--> statement-breakpoint
CREATE INDEX "quotes_deleted_at_idx" ON "quotes" USING btree ("deleted_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_entity_id_quote_no_key" ON "quotes" USING btree ("entity_id" text_ops,"quote_no" text_ops);--> statement-breakpoint
CREATE INDEX "quotes_entity_id_status_idx" ON "quotes" USING btree ("entity_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "quote_lines_quote_id_idx" ON "quote_lines" USING btree ("quote_id" text_ops);--> statement-breakpoint
CREATE INDEX "bank_accounts_deleted_at_idx" ON "bank_accounts" USING btree ("deleted_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "bank_accounts_entity_id_is_active_idx" ON "bank_accounts" USING btree ("entity_id" text_ops,"is_active" text_ops);--> statement-breakpoint
CREATE INDEX "cash_advance_items_request_id_position_idx" ON "cash_advance_items" USING btree ("request_id" int4_ops,"position" int4_ops);--> statement-breakpoint
CREATE INDEX "credit_notes_deleted_at_idx" ON "credit_notes" USING btree ("deleted_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "credit_notes_entity_id_credit_note_no_key" ON "credit_notes" USING btree ("entity_id" text_ops,"credit_note_no" text_ops);--> statement-breakpoint
CREATE INDEX "credit_notes_entity_id_status_idx" ON "credit_notes" USING btree ("entity_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "credit_note_lines_credit_note_id_idx" ON "credit_note_lines" USING btree ("credit_note_id" text_ops);--> statement-breakpoint
CREATE INDEX "fiscal_periods_entity_id_idx" ON "fiscal_periods" USING btree ("entity_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_periods_entity_id_year_month_key" ON "fiscal_periods" USING btree ("entity_id" int4_ops,"year" text_ops,"month" text_ops);--> statement-breakpoint
CREATE INDEX "purchase_orders_deleted_at_idx" ON "purchase_orders" USING btree ("deleted_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_entity_id_po_no_key" ON "purchase_orders" USING btree ("entity_id" text_ops,"po_no" text_ops);--> statement-breakpoint
CREATE INDEX "purchase_orders_entity_id_status_idx" ON "purchase_orders" USING btree ("entity_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "account_mappings_entity_id_role_key" ON "account_mappings" USING btree ("entity_id" text_ops,"role" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "tax_filings_entity_id_filing_type_year_month_key" ON "tax_filings" USING btree ("entity_id" int4_ops,"filing_type" text_ops,"year" text_ops,"month" text_ops);--> statement-breakpoint
CREATE INDEX "tax_filings_entity_id_status_idx" ON "tax_filings" USING btree ("entity_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "customer_advances_entity_id_counterparty_idx" ON "customer_advances" USING btree ("entity_id" text_ops,"counterparty" text_ops);--> statement-breakpoint
CREATE INDEX "customer_advances_entity_id_side_status_idx" ON "customer_advances" USING btree ("entity_id" text_ops,"side" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "customer_advances_entity_id_status_idx" ON "customer_advances" USING btree ("entity_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "customer_advances_vendor_id_idx" ON "customer_advances" USING btree ("vendor_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "document_sequences_entity_id_doc_type_period_key_key" ON "document_sequences" USING btree ("entity_id" text_ops,"doc_type" text_ops,"period_key" text_ops);--> statement-breakpoint
CREATE INDEX "fixed_assets_created_by_idx" ON "fixed_assets" USING btree ("created_by" uuid_ops);--> statement-breakpoint
CREATE INDEX "fixed_assets_deleted_at_idx" ON "fixed_assets" USING btree ("deleted_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "fixed_assets_entity_id_asset_no_key" ON "fixed_assets" USING btree ("entity_id" text_ops,"asset_no" text_ops);--> statement-breakpoint
CREATE INDEX "fixed_assets_entity_id_category_code_idx" ON "fixed_assets" USING btree ("entity_id" text_ops,"category_code" text_ops);--> statement-breakpoint
CREATE INDEX "fixed_assets_entity_id_status_idx" ON "fixed_assets" USING btree ("entity_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "tax_codes_entity_id_code_key" ON "tax_codes" USING btree ("entity_id" text_ops,"code" text_ops);--> statement-breakpoint
CREATE INDEX "po_lines_po_id_idx" ON "po_lines" USING btree ("po_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "fixed_asset_categories_entity_id_code_key" ON "fixed_asset_categories" USING btree ("entity_id" text_ops,"code" text_ops);--> statement-breakpoint
CREATE INDEX "fixed_asset_categories_entity_id_is_active_idx" ON "fixed_asset_categories" USING btree ("entity_id" text_ops,"is_active" text_ops);--> statement-breakpoint
CREATE INDEX "fixed_asset_transfers_asset_id_transfer_date_idx" ON "fixed_asset_transfers" USING btree ("asset_id" date_ops,"transfer_date" uuid_ops);--> statement-breakpoint
CREATE INDEX "fixed_asset_transfers_entity_id_status_idx" ON "fixed_asset_transfers" USING btree ("entity_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "fixed_asset_count_sessions_entity_id_session_no_key" ON "fixed_asset_count_sessions" USING btree ("entity_id" text_ops,"session_no" text_ops);--> statement-breakpoint
CREATE INDEX "fixed_asset_count_sessions_entity_id_status_idx" ON "fixed_asset_count_sessions" USING btree ("entity_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "helpdesk_tickets_assignee_id_idx" ON "helpdesk_tickets" USING btree ("assignee_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "helpdesk_tickets_category_idx" ON "helpdesk_tickets" USING btree ("category" text_ops);--> statement-breakpoint
CREATE INDEX "helpdesk_tickets_created_by_idx" ON "helpdesk_tickets" USING btree ("created_by" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "helpdesk_tickets_github_issue_number_key" ON "helpdesk_tickets" USING btree ("github_issue_number" int4_ops);--> statement-breakpoint
CREATE INDEX "helpdesk_tickets_status_idx" ON "helpdesk_tickets" USING btree ("status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "helpdesk_tickets_ticket_number_key" ON "helpdesk_tickets" USING btree ("ticket_number" int4_ops);--> statement-breakpoint
CREATE INDEX "validator_node_alerts_enabled_idx" ON "validator_node_alerts" USING btree ("enabled" bool_ops);--> statement-breakpoint
CREATE INDEX "validator_node_alerts_node_id_idx" ON "validator_node_alerts" USING btree ("node_id" text_ops);--> statement-breakpoint
CREATE INDEX "entity_tax_rates_entity_id_effective_from_idx" ON "entity_tax_rates" USING btree ("entity_id" date_ops,"effective_from" date_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "helpdesk_settings_singleton_key" ON "helpdesk_settings" USING btree ("singleton" bool_ops);--> statement-breakpoint
CREATE INDEX "helpdesk_comments_ticket_id_created_at_idx" ON "helpdesk_comments" USING btree ("ticket_id" timestamp_ops,"created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "fixed_asset_disposals_asset_id_idx" ON "fixed_asset_disposals" USING btree ("asset_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "fixed_asset_disposals_entity_id_status_idx" ON "fixed_asset_disposals" USING btree ("entity_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "fixed_asset_remeasurements_asset_id_effective_date_idx" ON "fixed_asset_remeasurements" USING btree ("asset_id" date_ops,"effective_date" uuid_ops);--> statement-breakpoint
CREATE INDEX "fixed_asset_remeasurements_entity_id_status_idx" ON "fixed_asset_remeasurements" USING btree ("entity_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "survey_form_responses_survey_form_id_idx" ON "survey_form_responses" USING btree ("survey_form_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "survey_form_responses_survey_form_id_respondent_id_key" ON "survey_form_responses" USING btree ("survey_form_id" uuid_ops,"respondent_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "surveys_archived_at_idx" ON "surveys" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "surveys_created_by_id_idx" ON "surveys" USING btree ("created_by_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "surveys_end_date_idx" ON "surveys" USING btree ("end_date" date_ops);--> statement-breakpoint
CREATE INDEX "surveys_status_idx" ON "surveys" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "survey_questions_survey_id_order_idx" ON "survey_questions" USING btree ("survey_id" int4_ops,"order" int4_ops);--> statement-breakpoint
CREATE INDEX "survey_responses_survey_id_idx" ON "survey_responses" USING btree ("survey_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "survey_responses_survey_id_respondent_id_key" ON "survey_responses" USING btree ("survey_id" uuid_ops,"respondent_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "travel_approval_steps_order_key" ON "travel_approval_steps" USING btree ("order" int4_ops);--> statement-breakpoint
CREATE INDEX "survey_forms_archived_at_idx" ON "survey_forms" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "survey_forms_created_by_id_idx" ON "survey_forms" USING btree ("created_by_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "survey_forms_end_date_idx" ON "survey_forms" USING btree ("end_date" date_ops);--> statement-breakpoint
CREATE INDEX "survey_forms_status_idx" ON "survey_forms" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "travel_approval_decisions_approver_user_id_status_idx" ON "travel_approval_decisions" USING btree ("approver_user_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "travel_approval_decisions_travel_request_id_idx" ON "travel_approval_decisions" USING btree ("travel_request_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "travel_approval_decisions_travel_request_id_order_key" ON "travel_approval_decisions" USING btree ("travel_request_id" int4_ops,"order" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "leave_types_entity_id_code_key" ON "leave_types" USING btree ("entity_id" text_ops,"code" text_ops);--> statement-breakpoint
CREATE INDEX "leave_types_entity_id_is_active_idx" ON "leave_types" USING btree ("entity_id" text_ops,"is_active" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "leave_types_entity_id_name_key" ON "leave_types" USING btree ("entity_id" text_ops,"name" text_ops);--> statement-breakpoint
CREATE INDEX "travel_requests_deleted_at_idx" ON "travel_requests" USING btree ("deleted_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "travel_requests_departure_date_idx" ON "travel_requests" USING btree ("departure_date" date_ops);--> statement-breakpoint
CREATE INDEX "travel_requests_employee_id_idx" ON "travel_requests" USING btree ("employee_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "travel_requests_request_code_key" ON "travel_requests" USING btree ("request_code" text_ops);--> statement-breakpoint
CREATE INDEX "travel_requests_status_idx" ON "travel_requests" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "survey_form_questions_survey_form_id_order_idx" ON "survey_form_questions" USING btree ("survey_form_id" int4_ops,"order" int4_ops);--> statement-breakpoint
CREATE INDEX "survey_form_answers_question_id_idx" ON "survey_form_answers" USING btree ("question_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "survey_form_answers_response_id_question_id_key" ON "survey_form_answers" USING btree ("response_id" uuid_ops,"question_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "survey_answers_question_id_idx" ON "survey_answers" USING btree ("question_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "survey_answers_response_id_question_id_key" ON "survey_answers" USING btree ("response_id" uuid_ops,"question_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "balance_transactions_employee_id_leave_type_id_year_idx" ON "balance_transactions" USING btree ("employee_id" int4_ops,"leave_type_id" uuid_ops,"year" uuid_ops);--> statement-breakpoint
CREATE INDEX "leave_requests_delegated_to_idx" ON "leave_requests" USING btree ("delegated_to" uuid_ops);--> statement-breakpoint
CREATE INDEX "leave_requests_deleted_at_idx" ON "leave_requests" USING btree ("deleted_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "leave_requests_employee_id_idx" ON "leave_requests" USING btree ("employee_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "leave_requests_status_idx" ON "leave_requests" USING btree ("status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "leave_approval_steps_order_key" ON "leave_approval_steps" USING btree ("order" int4_ops);--> statement-breakpoint
CREATE INDEX "leave_approval_decisions_approver_user_id_status_idx" ON "leave_approval_decisions" USING btree ("approver_user_id" uuid_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "leave_approval_decisions_leave_request_id_idx" ON "leave_approval_decisions" USING btree ("leave_request_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "leave_approval_decisions_leave_request_id_order_key" ON "leave_approval_decisions" USING btree ("leave_request_id" int4_ops,"order" uuid_ops);--> statement-breakpoint
CREATE INDEX "public_holidays_entity_id_date_idx" ON "public_holidays" USING btree ("entity_id" date_ops,"date" date_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "public_holidays_entity_id_date_key" ON "public_holidays" USING btree ("entity_id" text_ops,"date" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_runs_entity_id_period_key" ON "payroll_runs" USING btree ("entity_id" text_ops,"period" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "payslips_payroll_run_id_employee_id_currency_key" ON "payslips" USING btree ("payroll_run_id" uuid_ops,"employee_id" text_ops,"currency" uuid_ops);--> statement-breakpoint
CREATE INDEX "leave_policy_approvers_approver_user_id_idx" ON "leave_policy_approvers" USING btree ("approver_user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "leave_policy_approvers_leave_type_id_idx" ON "leave_policy_approvers" USING btree ("leave_type_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "leave_policy_approvers_leave_type_id_order_key" ON "leave_policy_approvers" USING btree ("leave_type_id" int4_ops,"order" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "leave_balances_employee_id_leave_type_id_year_key" ON "leave_balances" USING btree ("employee_id" int4_ops,"leave_type_id" uuid_ops,"year" uuid_ops);--> statement-breakpoint
CREATE INDEX "equity_monthly_salary_year_idx" ON "equity_monthly_salary" USING btree ("year" int4_ops);--> statement-breakpoint
CREATE INDEX "onboarding_runs_deleted_at_idx" ON "onboarding_runs" USING btree ("deleted_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "offboarding_runs_deleted_at_idx" ON "offboarding_runs" USING btree ("deleted_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "offboarding_runs_employee_id_idx" ON "offboarding_runs" USING btree ("employee_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "offboarding_runs_entity_id_idx" ON "offboarding_runs" USING btree ("entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "visa_records_deleted_at_idx" ON "visa_records" USING btree ("deleted_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "visa_records_employee_id_idx" ON "visa_records" USING btree ("employee_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "visa_records_expiry_date_idx" ON "visa_records" USING btree ("expiry_date" date_ops);--> statement-breakpoint
CREATE INDEX "visa_records_work_permit_expiry_date_idx" ON "visa_records" USING btree ("work_permit_expiry_date" date_ops);--> statement-breakpoint
CREATE INDEX "visa_event_logs_visa_record_id_created_at_idx" ON "visa_event_logs" USING btree ("visa_record_id" timestamp_ops,"created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "visa_knowledge_articles_country_visa_type_is_active_idx" ON "visa_knowledge_articles" USING btree ("country" text_ops,"visa_type" text_ops,"is_active" text_ops);--> statement-breakpoint
CREATE INDEX "visa_knowledge_articles_slug_idx" ON "visa_knowledge_articles" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "visa_knowledge_articles_slug_key" ON "visa_knowledge_articles" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "visa_checklist_items_visa_record_id_idx" ON "visa_checklist_items" USING btree ("visa_record_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "visa_checklist_templates_visa_type_is_active_idx" ON "visa_checklist_templates" USING btree ("visa_type" text_ops,"is_active" text_ops);--> statement-breakpoint
CREATE INDEX "employee_agreements_employee_id_idx" ON "employee_agreements" USING btree ("employee_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "employee_agreements_expiry_date_idx" ON "employee_agreements" USING btree ("expiry_date" date_ops);--> statement-breakpoint
CREATE INDEX "employee_agreements_type_idx" ON "employee_agreements" USING btree ("type" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "benefit_enrollments_benefit_id_employee_id_key" ON "benefit_enrollments" USING btree ("benefit_id" text_ops,"employee_id" text_ops);--> statement-breakpoint
CREATE INDEX "company_policies_category_idx" ON "company_policies" USING btree ("category" text_ops);--> statement-breakpoint
CREATE INDEX "company_policies_entity_id_idx" ON "company_policies" USING btree ("entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "company_policies_is_active_idx" ON "company_policies" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_approval_steps_order_key" ON "payroll_approval_steps" USING btree ("order" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_policies_entity_id_key" ON "attendance_policies" USING btree ("entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "attendance_corrections_attendance_date_idx" ON "attendance_corrections" USING btree ("attendance_date" date_ops);--> statement-breakpoint
CREATE INDEX "attendance_corrections_employee_id_idx" ON "attendance_corrections" USING btree ("employee_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "attendance_corrections_status_idx" ON "attendance_corrections" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "attendance_records_attendance_date_idx" ON "attendance_records" USING btree ("attendance_date" date_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_records_employee_id_attendance_date_key" ON "attendance_records" USING btree ("employee_id" date_ops,"attendance_date" uuid_ops);--> statement-breakpoint
CREATE INDEX "attendance_records_status_idx" ON "attendance_records" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "attendance_employee_shifts_employee_id_effective_from_idx" ON "attendance_employee_shifts" USING btree ("employee_id" uuid_ops,"effective_from" date_ops);--> statement-breakpoint
CREATE INDEX "attendance_employee_shifts_employee_id_idx" ON "attendance_employee_shifts" USING btree ("employee_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "attendance_employee_shifts_shift_id_idx" ON "attendance_employee_shifts" USING btree ("shift_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "attendance_audit_logs_created_at_idx" ON "attendance_audit_logs" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "attendance_audit_logs_employee_id_idx" ON "attendance_audit_logs" USING btree ("employee_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "attendance_audit_logs_record_id_idx" ON "attendance_audit_logs" USING btree ("record_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "attendance_shifts_entity_id_idx" ON "attendance_shifts" USING btree ("entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "ninety_day_notifications_due_date_idx" ON "ninety_day_notifications" USING btree ("due_date" date_ops);--> statement-breakpoint
CREATE INDEX "ninety_day_notifications_employee_id_idx" ON "ninety_day_notifications" USING btree ("employee_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ninety_day_notifications_entity_id_idx" ON "ninety_day_notifications" USING btree ("entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "attendance_exceptions_employee_id_idx" ON "attendance_exceptions" USING btree ("employee_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "attendance_exceptions_start_date_end_date_idx" ON "attendance_exceptions" USING btree ("start_date" date_ops,"end_date" date_ops);--> statement-breakpoint
CREATE INDEX "user_google_connections_user_id_idx" ON "user_google_connections" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "user_google_connections_user_id_key" ON "user_google_connections" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "investors_archived_at_idx" ON "investors" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "investors_fundraising_entity_idx" ON "investors" USING btree ("fundraising_entity" text_ops);--> statement-breakpoint
CREATE INDEX "google_oauth_states_user_id_idx" ON "google_oauth_states" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "investor_tasks_investor_id_idx" ON "investor_tasks" USING btree ("investor_id" text_ops);--> statement-breakpoint
CREATE INDEX "investor_tasks_owner_id_status_due_date_idx" ON "investor_tasks" USING btree ("owner_id" date_ops,"status" text_ops,"due_date" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "investor_tags_code_key" ON "investor_tags" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "investor_tags_sort_order_idx" ON "investor_tags" USING btree ("sort_order" int4_ops);--> statement-breakpoint
CREATE INDEX "investor_activities_investor_id_idx" ON "investor_activities" USING btree ("investor_id" text_ops);--> statement-breakpoint
CREATE INDEX "investor_activities_occurred_at_idx" ON "investor_activities" USING btree ("occurred_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "investor_leads_archived_at_idx" ON "investor_leads" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "investor_leads_fundraising_entity_idx" ON "investor_leads" USING btree ("fundraising_entity" text_ops);--> statement-breakpoint
CREATE INDEX "investor_leads_owner_id_status_idx" ON "investor_leads" USING btree ("owner_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "investor_type_options_sort_order_idx" ON "investor_type_options" USING btree ("sort_order" int4_ops);--> statement-breakpoint
CREATE INDEX "fundraising_entities_sort_order_idx" ON "fundraising_entities" USING btree ("sort_order" int4_ops);--> statement-breakpoint
CREATE INDEX "investor_accounts_archived_at_idx" ON "investor_accounts" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "investor_accounts_fundraising_entity_idx" ON "investor_accounts" USING btree ("fundraising_entity" text_ops);--> statement-breakpoint
CREATE INDEX "investor_accounts_owner_id_idx" ON "investor_accounts" USING btree ("owner_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "certificates_deleted_at_idx" ON "certificates" USING btree ("deleted_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "certificates_issued_by_id_idx" ON "certificates" USING btree ("issued_by_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "certificates_recipient_id_idx" ON "certificates" USING btree ("recipient_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "certificates_status_idx" ON "certificates" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "investor_pipeline_stages_sort_order_idx" ON "investor_pipeline_stages" USING btree ("sort_order" int4_ops);--> statement-breakpoint
CREATE INDEX "it_vendors_is_active_idx" ON "it_vendors" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "it_subscriptions_payment_status_idx" ON "it_subscriptions" USING btree ("payment_status" text_ops);--> statement-breakpoint
CREATE INDEX "it_subscriptions_renewal_date_idx" ON "it_subscriptions" USING btree ("renewal_date" date_ops);--> statement-breakpoint
CREATE INDEX "it_subscriptions_status_idx" ON "it_subscriptions" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "it_subscriptions_vendor_id_idx" ON "it_subscriptions" USING btree ("vendor_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "it_billing_records_payment_status_idx" ON "it_billing_records" USING btree ("payment_status" text_ops);--> statement-breakpoint
CREATE INDEX "it_billing_records_subscription_id_idx" ON "it_billing_records" USING btree ("subscription_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "it_billing_alerts_acknowledged_idx" ON "it_billing_alerts" USING btree ("acknowledged" bool_ops);--> statement-breakpoint
CREATE INDEX "it_billing_alerts_alert_type_idx" ON "it_billing_alerts" USING btree ("alert_type" text_ops);--> statement-breakpoint
CREATE INDEX "it_billing_alerts_subscription_id_idx" ON "it_billing_alerts" USING btree ("subscription_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "it_systems_is_active_idx" ON "it_systems" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "it_systems_name_key" ON "it_systems" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "investor_contacts_account_id_idx" ON "investor_contacts" USING btree ("account_id" text_ops);--> statement-breakpoint
CREATE INDEX "investor_contacts_archived_at_idx" ON "investor_contacts" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "investor_contacts_fundraising_entity_idx" ON "investor_contacts" USING btree ("fundraising_entity" text_ops);--> statement-breakpoint
CREATE INDEX "investor_contacts_owner_id_idx" ON "investor_contacts" USING btree ("owner_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "it_access_assignments_employee_id_status_idx" ON "it_access_assignments" USING btree ("employee_id" uuid_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "it_access_assignments_status_idx" ON "it_access_assignments" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "it_access_assignments_system_id_idx" ON "it_access_assignments" USING btree ("system_id" text_ops);--> statement-breakpoint
CREATE INDEX "it_access_audit_logs_assignment_id_idx" ON "it_access_audit_logs" USING btree ("assignment_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "it_access_audit_logs_created_at_idx" ON "it_access_audit_logs" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "it_access_audit_logs_request_id_idx" ON "it_access_audit_logs" USING btree ("request_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "it_access_audit_logs_target_user_id_idx" ON "it_access_audit_logs" USING btree ("target_user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "legal_documents_entity_id_idx" ON "legal_documents" USING btree ("entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "legal_documents_expiry_date_idx" ON "legal_documents" USING btree ("expiry_date" date_ops);--> statement-breakpoint
CREATE INDEX "legal_documents_folder_idx" ON "legal_documents" USING btree ("folder" text_ops);--> statement-breakpoint
CREATE INDEX "legal_documents_kind_status_idx" ON "legal_documents" USING btree ("kind" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "legal_documents_visibility_idx" ON "legal_documents" USING btree ("visibility" text_ops);--> statement-breakpoint
CREATE INDEX "legal_document_shares_department_idx" ON "legal_document_shares" USING btree ("department" text_ops);--> statement-breakpoint
CREATE INDEX "legal_document_shares_document_id_idx" ON "legal_document_shares" USING btree ("document_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "legal_document_shares_group_id_idx" ON "legal_document_shares" USING btree ("group_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "legal_document_shares_user_id_idx" ON "legal_document_shares" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "legal_document_attachments_document_id_idx" ON "legal_document_attachments" USING btree ("document_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "legal_document_attachments_expiry_date_idx" ON "legal_document_attachments" USING btree ("expiry_date" date_ops);--> statement-breakpoint
CREATE INDEX "legal_signatures_document_id_idx" ON "legal_signatures" USING btree ("document_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "legal_signatures_docusign_envelope_id_idx" ON "legal_signatures" USING btree ("docusign_envelope_id" text_ops);--> statement-breakpoint
CREATE INDEX "legal_signatures_status_idx" ON "legal_signatures" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "legal_signatures_token_idx" ON "legal_signatures" USING btree ("token" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "legal_signatures_token_key" ON "legal_signatures" USING btree ("token" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "user_docusign_connections_user_id_key" ON "user_docusign_connections" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "legal_announcements_entity_id_idx" ON "legal_announcements" USING btree ("entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "legal_announcements_kind_idx" ON "legal_announcements" USING btree ("kind" text_ops);--> statement-breakpoint
CREATE INDEX "legal_announcements_status_published_at_idx" ON "legal_announcements" USING btree ("status" timestamp_ops,"published_at" text_ops);--> statement-breakpoint
CREATE INDEX "legal_announcement_attachments_announcement_id_idx" ON "legal_announcement_attachments" USING btree ("announcement_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "it_access_requests_employee_id_status_idx" ON "it_access_requests" USING btree ("employee_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "it_access_requests_request_number_key" ON "it_access_requests" USING btree ("request_number" int4_ops);--> statement-breakpoint
CREATE INDEX "it_access_requests_status_idx" ON "it_access_requests" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "it_access_requests_system_id_idx" ON "it_access_requests" USING btree ("system_id" text_ops);--> statement-breakpoint
CREATE INDEX "it_access_approval_decisions_approver_user_id_status_idx" ON "it_access_approval_decisions" USING btree ("approver_user_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "it_access_approval_decisions_request_id_idx" ON "it_access_approval_decisions" USING btree ("request_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "it_access_approval_decisions_request_id_order_key" ON "it_access_approval_decisions" USING btree ("request_id" int4_ops,"order" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "legal_notification_settings_singleton_key" ON "legal_notification_settings" USING btree ("singleton" bool_ops);--> statement-breakpoint
CREATE INDEX "mkt_campaign_levers_campaign_id_idx" ON "mkt_campaign_levers" USING btree ("campaign_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "mkt_campaign_levers_campaign_id_lever_id_key" ON "mkt_campaign_levers" USING btree ("campaign_id" text_ops,"lever_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "mkt_campaign_levers_lever_id_idx" ON "mkt_campaign_levers" USING btree ("lever_id" text_ops);--> statement-breakpoint
CREATE INDEX "mkt_creatives_campaign_id_version_idx" ON "mkt_creatives" USING btree ("campaign_id" int4_ops,"version" int4_ops);--> statement-breakpoint
CREATE INDEX "mkt_levers_is_active_idx" ON "mkt_levers" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "mkt_levers_name_key" ON "mkt_levers" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "mkt_predictions_campaign_id_created_at_idx" ON "mkt_predictions" USING btree ("campaign_id" timestamp_ops,"created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "partners_department_idx" ON "partners" USING btree ("department" text_ops);--> statement-breakpoint
CREATE INDEX "partners_owner_id_idx" ON "partners" USING btree ("owner_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "partners_slug_key" ON "partners" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "partners_sort_order_idx" ON "partners" USING btree ("sort_order" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "partner_members_partner_id_user_id_key" ON "partner_members" USING btree ("partner_id" text_ops,"user_id" text_ops);--> statement-breakpoint
CREATE INDEX "partner_columns_partner_id_idx" ON "partner_columns" USING btree ("partner_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "partner_columns_partner_id_key_key" ON "partner_columns" USING btree ("partner_id" text_ops,"key" text_ops);--> statement-breakpoint
CREATE INDEX "mkt_campaigns_archived_at_idx" ON "mkt_campaigns" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "mkt_campaigns_campaign_date_idx" ON "mkt_campaigns" USING btree ("campaign_date" date_ops);--> statement-breakpoint
CREATE INDEX "mkt_campaigns_owner_id_idx" ON "mkt_campaigns" USING btree ("owner_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "mkt_campaigns_partner_id_idx" ON "mkt_campaigns" USING btree ("partner_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "mkt_campaigns_status_campaign_date_idx" ON "mkt_campaigns" USING btree ("status" date_ops,"campaign_date" date_ops);--> statement-breakpoint
CREATE INDEX "mkt_campaigns_status_idx" ON "mkt_campaigns" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "partner_task_comments_author_id_idx" ON "partner_task_comments" USING btree ("author_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "partner_task_comments_task_id_idx" ON "partner_task_comments" USING btree ("task_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "partner_task_assignees_task_id_user_id_key" ON "partner_task_assignees" USING btree ("task_id" uuid_ops,"user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "partner_task_assignees_user_id_idx" ON "partner_task_assignees" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "project_workflow_transitions_project_id_created_at_idx" ON "project_workflow_transitions" USING btree ("project_id" text_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "partner_tasks_parent_task_id_idx" ON "partner_tasks" USING btree ("parent_task_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "partner_tasks_partner_id_idx" ON "partner_tasks" USING btree ("partner_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "project_workflow_emails_idempotency_key_key" ON "project_workflow_emails" USING btree ("idempotency_key" text_ops);--> statement-breakpoint
CREATE INDEX "project_workflow_emails_project_id_created_at_idx" ON "project_workflow_emails" USING btree ("project_id" timestamp_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "project_workflow_emails_status_idx" ON "project_workflow_emails" USING btree ("status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members" USING btree ("project_id" text_ops,"user_id" text_ops);--> statement-breakpoint
CREATE INDEX "project_columns_project_id_idx" ON "project_columns" USING btree ("project_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "project_columns_project_id_key_key" ON "project_columns" USING btree ("project_id" text_ops,"key" text_ops);--> statement-breakpoint
CREATE INDEX "project_tasks_milestone_id_idx" ON "project_tasks" USING btree ("milestone_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "project_tasks_parent_task_id_idx" ON "project_tasks" USING btree ("parent_task_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "project_tasks_project_id_idx" ON "project_tasks" USING btree ("project_id" text_ops);--> statement-breakpoint
CREATE INDEX "project_task_comments_task_id_idx" ON "project_task_comments" USING btree ("task_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "projects_archived_at_idx" ON "projects" USING btree ("archived_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "projects_department_idx" ON "projects" USING btree ("department" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_key" ON "projects" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "projects_sort_order_idx" ON "projects" USING btree ("sort_order" int4_ops);--> statement-breakpoint
CREATE INDEX "projects_team_idx" ON "projects" USING btree ("team" text_ops);--> statement-breakpoint
CREATE INDEX "projects_workflow_status_idx" ON "projects" USING btree ("workflow_status" text_ops);--> statement-breakpoint
CREATE INDEX "partner_task_resources_task_id_idx" ON "partner_task_resources" USING btree ("task_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "deals_stage_idx" ON "deals" USING btree ("stage" text_ops);--> statement-breakpoint
CREATE INDEX "project_task_assignees_task_id_idx" ON "project_task_assignees" USING btree ("task_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "project_task_assignees_task_id_user_id_key" ON "project_task_assignees" USING btree ("task_id" uuid_ops,"user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "project_task_assignees_user_id_idx" ON "project_task_assignees" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "project_task_activities_task_id_created_at_idx" ON "project_task_activities" USING btree ("task_id" timestamp_ops,"created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "project_task_resources_task_id_idx" ON "project_task_resources" USING btree ("task_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "it_projects_archived_at_idx" ON "it_projects" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "it_projects_department_idx" ON "it_projects" USING btree ("department" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "it_projects_slug_key" ON "it_projects" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "it_projects_sort_order_idx" ON "it_projects" USING btree ("sort_order" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "it_project_members_project_id_user_id_key" ON "it_project_members" USING btree ("project_id" text_ops,"user_id" text_ops);--> statement-breakpoint
CREATE INDEX "it_project_columns_project_id_idx" ON "it_project_columns" USING btree ("project_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "it_project_columns_project_id_key_key" ON "it_project_columns" USING btree ("project_id" text_ops,"key" text_ops);--> statement-breakpoint
CREATE INDEX "it_project_tasks_parent_task_id_idx" ON "it_project_tasks" USING btree ("parent_task_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "it_project_tasks_project_id_idx" ON "it_project_tasks" USING btree ("project_id" text_ops);--> statement-breakpoint
CREATE INDEX "it_project_task_comments_author_id_idx" ON "it_project_task_comments" USING btree ("author_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "it_project_task_comments_task_id_idx" ON "it_project_task_comments" USING btree ("task_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "it_project_task_assignees_task_id_user_id_key" ON "it_project_task_assignees" USING btree ("task_id" uuid_ops,"user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "it_project_task_assignees_user_id_idx" ON "it_project_task_assignees" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "crm_notifications_user_id_created_at_idx" ON "crm_notifications" USING btree ("user_id" timestamp_ops,"created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "crm_notifications_user_id_read_at_idx" ON "crm_notifications" USING btree ("user_id" timestamp_ops,"read_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "project_milestones_project_id_idx" ON "project_milestones" USING btree ("project_id" text_ops);--> statement-breakpoint
CREATE INDEX "project_task_dependencies_depends_on_task_id_idx" ON "project_task_dependencies" USING btree ("depends_on_task_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "project_task_dependencies_task_id_depends_on_task_id_key" ON "project_task_dependencies" USING btree ("task_id" uuid_ops,"depends_on_task_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "project_task_dependencies_task_id_idx" ON "project_task_dependencies" USING btree ("task_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "qa_project_members_project_id_user_id_key" ON "qa_project_members" USING btree ("project_id" text_ops,"user_id" text_ops);--> statement-breakpoint
CREATE INDEX "qa_project_columns_project_id_idx" ON "qa_project_columns" USING btree ("project_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "qa_project_columns_project_id_key_key" ON "qa_project_columns" USING btree ("project_id" text_ops,"key" text_ops);--> statement-breakpoint
CREATE INDEX "qa_project_tasks_parent_task_id_idx" ON "qa_project_tasks" USING btree ("parent_task_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "qa_project_tasks_partner_idx" ON "qa_project_tasks" USING btree ("partner" text_ops);--> statement-breakpoint
CREATE INDEX "qa_project_tasks_priority_idx" ON "qa_project_tasks" USING btree ("priority" text_ops);--> statement-breakpoint
CREATE INDEX "qa_project_tasks_product_idx" ON "qa_project_tasks" USING btree ("product" text_ops);--> statement-breakpoint
CREATE INDEX "qa_project_tasks_project_id_idx" ON "qa_project_tasks" USING btree ("project_id" text_ops);--> statement-breakpoint
CREATE INDEX "qa_project_tasks_status_idx" ON "qa_project_tasks" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "qa_project_task_comments_author_id_idx" ON "qa_project_task_comments" USING btree ("author_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "qa_project_task_comments_task_id_idx" ON "qa_project_task_comments" USING btree ("task_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "qa_project_task_assignees_task_id_user_id_key" ON "qa_project_task_assignees" USING btree ("task_id" uuid_ops,"user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "qa_project_task_assignees_user_id_idx" ON "qa_project_task_assignees" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "legal_project_members_project_id_user_id_key" ON "legal_project_members" USING btree ("project_id" text_ops,"user_id" text_ops);--> statement-breakpoint
CREATE INDEX "legal_project_columns_project_id_idx" ON "legal_project_columns" USING btree ("project_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "legal_project_columns_project_id_key_key" ON "legal_project_columns" USING btree ("project_id" text_ops,"key" text_ops);--> statement-breakpoint
CREATE INDEX "legal_project_tasks_parent_task_id_idx" ON "legal_project_tasks" USING btree ("parent_task_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "legal_project_tasks_project_id_idx" ON "legal_project_tasks" USING btree ("project_id" text_ops);--> statement-breakpoint
CREATE INDEX "legal_project_task_comments_author_id_idx" ON "legal_project_task_comments" USING btree ("author_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "legal_project_task_comments_task_id_idx" ON "legal_project_task_comments" USING btree ("task_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "legal_project_task_assignees_task_id_user_id_key" ON "legal_project_task_assignees" USING btree ("task_id" uuid_ops,"user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "legal_project_task_assignees_user_id_idx" ON "legal_project_task_assignees" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "qa_projects_archived_at_idx" ON "qa_projects" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "qa_projects_department_idx" ON "qa_projects" USING btree ("department" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "qa_projects_slug_key" ON "qa_projects" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "qa_projects_sort_order_idx" ON "qa_projects" USING btree ("sort_order" int4_ops);--> statement-breakpoint
CREATE INDEX "legal_projects_archived_at_idx" ON "legal_projects" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "legal_projects_department_idx" ON "legal_projects" USING btree ("department" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "legal_projects_slug_key" ON "legal_projects" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "legal_projects_sort_order_idx" ON "legal_projects" USING btree ("sort_order" int4_ops);--> statement-breakpoint
CREATE INDEX "accounting_project_columns_project_id_idx" ON "accounting_project_columns" USING btree ("project_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_project_columns_project_id_key_key" ON "accounting_project_columns" USING btree ("project_id" text_ops,"key" text_ops);--> statement-breakpoint
CREATE INDEX "accounting_project_tasks_parent_task_id_idx" ON "accounting_project_tasks" USING btree ("parent_task_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "accounting_project_tasks_project_id_idx" ON "accounting_project_tasks" USING btree ("project_id" text_ops);--> statement-breakpoint
CREATE INDEX "accounting_project_task_comments_author_id_idx" ON "accounting_project_task_comments" USING btree ("author_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "accounting_project_task_comments_task_id_idx" ON "accounting_project_task_comments" USING btree ("task_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_project_task_assignees_task_id_user_id_key" ON "accounting_project_task_assignees" USING btree ("task_id" uuid_ops,"user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "accounting_project_task_assignees_user_id_idx" ON "accounting_project_task_assignees" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "product_project_members_project_id_user_id_key" ON "product_project_members" USING btree ("project_id" text_ops,"user_id" text_ops);--> statement-breakpoint
CREATE INDEX "product_project_columns_project_id_idx" ON "product_project_columns" USING btree ("project_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "product_project_columns_project_id_key_key" ON "product_project_columns" USING btree ("project_id" text_ops,"key" text_ops);--> statement-breakpoint
CREATE INDEX "product_project_tasks_parent_task_id_idx" ON "product_project_tasks" USING btree ("parent_task_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "product_project_tasks_project_id_idx" ON "product_project_tasks" USING btree ("project_id" text_ops);--> statement-breakpoint
CREATE INDEX "product_project_task_comments_author_id_idx" ON "product_project_task_comments" USING btree ("author_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "product_project_task_comments_task_id_idx" ON "product_project_task_comments" USING btree ("task_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "product_project_task_assignees_task_id_user_id_key" ON "product_project_task_assignees" USING btree ("task_id" uuid_ops,"user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "product_project_task_assignees_user_id_idx" ON "product_project_task_assignees" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "accounting_projects_archived_at_idx" ON "accounting_projects" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "accounting_projects_department_idx" ON "accounting_projects" USING btree ("department" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_projects_slug_key" ON "accounting_projects" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "accounting_projects_sort_order_idx" ON "accounting_projects" USING btree ("sort_order" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_project_members_project_id_user_id_key" ON "accounting_project_members" USING btree ("project_id" text_ops,"user_id" text_ops);--> statement-breakpoint
CREATE INDEX "product_projects_archived_at_idx" ON "product_projects" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "product_projects_department_idx" ON "product_projects" USING btree ("department" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "product_projects_slug_key" ON "product_projects" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "product_projects_sort_order_idx" ON "product_projects" USING btree ("sort_order" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "desk_bookings_desk_id_date_key" ON "desk_bookings" USING btree ("desk_id" date_ops,"date" date_ops);--> statement-breakpoint
CREATE INDEX "room_bookings_room_id_date_idx" ON "room_bookings" USING btree ("room_id" date_ops,"date" date_ops);--> statement-breakpoint
CREATE INDEX "room_bookings_series_id_idx" ON "room_bookings" USING btree ("series_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "assets_asset_code_idx" ON "assets" USING btree ("asset_code" text_ops);--> statement-breakpoint
CREATE INDEX "assets_status_idx" ON "assets" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "assets_type_idx" ON "assets" USING btree ("type" text_ops);--> statement-breakpoint
CREATE INDEX "voucher_entries_archived_at_idx" ON "voucher_entries" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "voucher_entries_partner_idx" ON "voucher_entries" USING btree ("partner" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ow_daily_metrics_date_telco_key" ON "ow_daily_metrics" USING btree ("date" date_ops,"telco" text_ops);--> statement-breakpoint
CREATE INDEX "ow_daily_metrics_telco_date_idx" ON "ow_daily_metrics" USING btree ("telco" text_ops,"date" text_ops);--> statement-breakpoint
CREATE INDEX "ow_snapshots_generated_at_idx" ON "ow_snapshots" USING btree ("generated_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "marketing_campaigns_campaign_date_idx" ON "marketing_campaigns" USING btree ("campaign_date" date_ops);--> statement-breakpoint
CREATE INDEX "appraisal_kras_appraisal_id_idx" ON "appraisal_kras" USING btree ("appraisal_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "appraisal_comments_appraisal_id_idx" ON "appraisal_comments" USING btree ("appraisal_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "appraisal_ratings_appraisal_id_idx" ON "appraisal_ratings" USING btree ("appraisal_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "appraisal_ratings_appraisal_id_rater_id_category_key" ON "appraisal_ratings" USING btree ("appraisal_id" text_ops,"rater_id" uuid_ops,"category" uuid_ops);--> statement-breakpoint
CREATE INDEX "goals_appraisal_id_idx" ON "goals" USING btree ("appraisal_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "proposal_information_requests_assigned_to_id_responded_at_idx" ON "proposal_information_requests" USING btree ("assigned_to_id" timestamptz_ops,"responded_at" uuid_ops);--> statement-breakpoint
CREATE INDEX "proposal_information_requests_proposal_id_created_at_idx" ON "proposal_information_requests" USING btree ("proposal_id" timestamp_ops,"created_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_key" ON "roles" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "proposal_transitions_proposal_id_created_at_idx" ON "proposal_transitions" USING btree ("proposal_id" text_ops,"created_at" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_emails_idempotency_key_key" ON "proposal_emails" USING btree ("idempotency_key" text_ops);--> statement-breakpoint
CREATE INDEX "proposal_emails_proposal_id_created_at_idx" ON "proposal_emails" USING btree ("proposal_id" timestamp_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "proposal_emails_status_idx" ON "proposal_emails" USING btree ("status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions" USING btree ("endpoint" text_ops);--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "appraisals_cycle_id_employee_id_key" ON "appraisals" USING btree ("cycle_id" uuid_ops,"employee_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "appraisals_employee_id_idx" ON "appraisals" USING btree ("employee_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "appraisals_manager_id_idx" ON "appraisals" USING btree ("manager_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "proposals_project_id_idx" ON "proposals" USING btree ("project_id" text_ops);--> statement-breakpoint
CREATE INDEX "proposals_raised_by_id_idx" ON "proposals" USING btree ("raised_by_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "proposals_status_created_at_idx" ON "proposals" USING btree ("status" text_ops,"created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "proposals_status_idx" ON "proposals" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "crm_contacts_account_id_idx" ON "crm_contacts" USING btree ("account_id" text_ops);--> statement-breakpoint
CREATE INDEX "crm_contacts_archived_at_idx" ON "crm_contacts" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "crm_contacts_email_idx" ON "crm_contacts" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "crm_leads_archived_at_idx" ON "crm_leads" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "crm_leads_legacy_deal_id_key" ON "crm_leads" USING btree ("legacy_deal_id" text_ops);--> statement-breakpoint
CREATE INDEX "crm_leads_owner_id_status_idx" ON "crm_leads" USING btree ("owner_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "crm_leads_source_idx" ON "crm_leads" USING btree ("source" text_ops);--> statement-breakpoint
CREATE INDEX "crm_opportunities_account_id_idx" ON "crm_opportunities" USING btree ("account_id" text_ops);--> statement-breakpoint
CREATE INDEX "crm_opportunities_archived_at_idx" ON "crm_opportunities" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "crm_opportunities_close_date_idx" ON "crm_opportunities" USING btree ("close_date" date_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "crm_opportunities_legacy_deal_id_key" ON "crm_opportunities" USING btree ("legacy_deal_id" text_ops);--> statement-breakpoint
CREATE INDEX "crm_opportunities_owner_id_stage_idx" ON "crm_opportunities" USING btree ("owner_id" text_ops,"stage" text_ops);--> statement-breakpoint
CREATE INDEX "crm_opportunities_stage_idx" ON "crm_opportunities" USING btree ("stage" text_ops);--> statement-breakpoint
CREATE INDEX "crm_opportunities_stage_sort_order_within_stage_idx" ON "crm_opportunities" USING btree ("stage" int4_ops,"sort_order_within_stage" int4_ops);--> statement-breakpoint
CREATE INDEX "crm_activities_account_id_idx" ON "crm_activities" USING btree ("account_id" text_ops);--> statement-breakpoint
CREATE INDEX "crm_activities_contact_id_idx" ON "crm_activities" USING btree ("contact_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "crm_activities_external_ref_key" ON "crm_activities" USING btree ("external_ref" text_ops);--> statement-breakpoint
CREATE INDEX "crm_activities_lead_id_idx" ON "crm_activities" USING btree ("lead_id" text_ops);--> statement-breakpoint
CREATE INDEX "crm_activities_occurred_at_idx" ON "crm_activities" USING btree ("occurred_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "crm_activities_opportunity_id_idx" ON "crm_activities" USING btree ("opportunity_id" text_ops);--> statement-breakpoint
CREATE INDEX "opportunity_stage_config_sort_order_idx" ON "opportunity_stage_config" USING btree ("sort_order" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "crm_lost_reasons_code_key" ON "crm_lost_reasons" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "crm_lost_reasons_is_active_sort_order_idx" ON "crm_lost_reasons" USING btree ("is_active" int4_ops,"sort_order" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "user_groups_name_key" ON "user_groups" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "crm_accounts_archived_at_idx" ON "crm_accounts" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "crm_accounts_domain_key" ON "crm_accounts" USING btree ("domain" text_ops);--> statement-breakpoint
CREATE INDEX "crm_accounts_name_idx" ON "crm_accounts" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "crm_accounts_owner_id_idx" ON "crm_accounts" USING btree ("owner_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "crm_accounts_partner_id_idx" ON "crm_accounts" USING btree ("partner_id" text_ops);--> statement-breakpoint
CREATE INDEX "crm_accounts_sort_order_idx" ON "crm_accounts" USING btree ("sort_order" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "crm_business_units_code_key" ON "crm_business_units" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "crm_business_units_is_active_sort_order_idx" ON "crm_business_units" USING btree ("is_active" int4_ops,"sort_order" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "crm_lead_sources_code_key" ON "crm_lead_sources" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "crm_lead_sources_is_active_sort_order_idx" ON "crm_lead_sources" USING btree ("is_active" int4_ops,"sort_order" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "crm_settings_singleton_key" ON "crm_settings" USING btree ("singleton" bool_ops);--> statement-breakpoint
CREATE INDEX "crm_opportunity_business_units_business_unit_stage_idx" ON "crm_opportunity_business_units" USING btree ("business_unit" text_ops,"stage" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "crm_opportunity_business_units_opportunity_id_business_unit_key" ON "crm_opportunity_business_units" USING btree ("opportunity_id" text_ops,"business_unit" text_ops);--> statement-breakpoint
CREATE INDEX "crm_opportunity_business_units_stage_sort_idx" ON "crm_opportunity_business_units" USING btree ("stage" text_ops,"sort_order_within_stage" int4_ops);--> statement-breakpoint
CREATE INDEX "revenue_accounts_archived_at_idx" ON "revenue_accounts" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "revenue_accounts_domain_key" ON "revenue_accounts" USING btree ("domain" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_accounts_name_idx" ON "revenue_accounts" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_accounts_owner_id_idx" ON "revenue_accounts" USING btree ("owner_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "revenue_accounts_partner_id_idx" ON "revenue_accounts" USING btree ("partner_id" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_accounts_sort_order_idx" ON "revenue_accounts" USING btree ("sort_order" int4_ops);--> statement-breakpoint
CREATE INDEX "revenue_contacts_account_id_idx" ON "revenue_contacts" USING btree ("account_id" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_contacts_archived_at_idx" ON "revenue_contacts" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "revenue_contacts_email_idx" ON "revenue_contacts" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_leads_archived_at_idx" ON "revenue_leads" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "revenue_leads_legacy_deal_id_key" ON "revenue_leads" USING btree ("legacy_deal_id" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_leads_owner_id_status_idx" ON "revenue_leads" USING btree ("owner_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_leads_source_idx" ON "revenue_leads" USING btree ("source" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_opportunities_account_id_idx" ON "revenue_opportunities" USING btree ("account_id" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_opportunities_archived_at_idx" ON "revenue_opportunities" USING btree ("archived_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "revenue_opportunities_close_date_idx" ON "revenue_opportunities" USING btree ("close_date" date_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "revenue_opportunities_legacy_deal_id_key" ON "revenue_opportunities" USING btree ("legacy_deal_id" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_opportunities_owner_id_stage_idx" ON "revenue_opportunities" USING btree ("owner_id" text_ops,"stage" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_opportunities_stage_idx" ON "revenue_opportunities" USING btree ("stage" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_opportunities_stage_sort_order_within_stage_idx" ON "revenue_opportunities" USING btree ("stage" int4_ops,"sort_order_within_stage" int4_ops);--> statement-breakpoint
CREATE INDEX "revenue_activities_account_id_idx" ON "revenue_activities" USING btree ("account_id" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_activities_contact_id_idx" ON "revenue_activities" USING btree ("contact_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "revenue_activities_external_ref_key" ON "revenue_activities" USING btree ("external_ref" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_activities_lead_id_idx" ON "revenue_activities" USING btree ("lead_id" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_activities_occurred_at_idx" ON "revenue_activities" USING btree ("occurred_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "revenue_activities_opportunity_id_idx" ON "revenue_activities" USING btree ("opportunity_id" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_stage_config_sort_order_idx" ON "revenue_stage_config" USING btree ("sort_order" int4_ops);--> statement-breakpoint
CREATE INDEX "crm_tasks_lead_id_idx" ON "crm_tasks" USING btree ("lead_id" text_ops);--> statement-breakpoint
CREATE INDEX "crm_tasks_opportunity_id_idx" ON "crm_tasks" USING btree ("opportunity_id" text_ops);--> statement-breakpoint
CREATE INDEX "crm_tasks_owner_id_status_due_date_idx" ON "crm_tasks" USING btree ("owner_id" text_ops,"status" uuid_ops,"due_date" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "revenue_lost_reasons_code_key" ON "revenue_lost_reasons" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_lost_reasons_is_active_sort_order_idx" ON "revenue_lost_reasons" USING btree ("is_active" int4_ops,"sort_order" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "revenue_lead_sources_code_key" ON "revenue_lead_sources" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_lead_sources_is_active_sort_order_idx" ON "revenue_lead_sources" USING btree ("is_active" int4_ops,"sort_order" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "revenue_settings_singleton_key" ON "revenue_settings" USING btree ("singleton" bool_ops);--> statement-breakpoint
CREATE INDEX "revenue_opp_business_units_business_unit_stage_idx" ON "revenue_opportunity_business_units" USING btree ("business_unit" text_ops,"stage" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "revenue_opp_business_units_opportunity_id_business_unit_key" ON "revenue_opportunity_business_units" USING btree ("opportunity_id" text_ops,"business_unit" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_opp_business_units_stage_sort_idx" ON "revenue_opportunity_business_units" USING btree ("stage" text_ops,"sort_order_within_stage" text_ops);--> statement-breakpoint
CREATE INDEX "audit_log_resource_resource_id_idx" ON "audit_log" USING btree ("resource" text_ops,"resource_id" text_ops);--> statement-breakpoint
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log" USING btree ("timestamp" timestamp_ops);--> statement-breakpoint
CREATE INDEX "audit_log_user_id_idx" ON "audit_log" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "storage_snapshots_bucket_captured_at_idx" ON "storage_snapshots" USING btree ("bucket" text_ops,"captured_at" text_ops);--> statement-breakpoint
CREATE INDEX "storage_snapshots_captured_at_idx" ON "storage_snapshots" USING btree ("captured_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "file_uploads_linked_to_linked_id_idx" ON "file_uploads" USING btree ("linked_to" text_ops,"linked_id" text_ops);--> statement-breakpoint
CREATE INDEX "file_uploads_uploaded_by_idx" ON "file_uploads" USING btree ("uploaded_by" uuid_ops);--> statement-breakpoint
CREATE INDEX "approval_chain_steps_approver_user_id_idx" ON "approval_chain_steps" USING btree ("approver_user_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "approval_chain_steps_chain_id_order_key" ON "approval_chain_steps" USING btree ("chain_id" int4_ops,"order" int4_ops);--> statement-breakpoint
CREATE INDEX "applications_created_at_idx" ON "applications" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "applications_job_id_idx" ON "applications" USING btree ("job_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "sessions_token_hash_idx" ON "sessions" USING btree ("token_hash" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions" USING btree ("token_hash" text_ops);--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "fixed_asset_count_lines_asset_id_idx" ON "fixed_asset_count_lines" USING btree ("asset_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "fixed_asset_count_lines_session_id_idx" ON "fixed_asset_count_lines" USING btree ("session_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "revenue_tasks_lead_id_idx" ON "revenue_tasks" USING btree ("lead_id" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_tasks_opportunity_id_idx" ON "revenue_tasks" USING btree ("opportunity_id" text_ops);--> statement-breakpoint
CREATE INDEX "revenue_tasks_owner_id_status_due_date_idx" ON "revenue_tasks" USING btree ("owner_id" text_ops,"status" uuid_ops,"due_date" text_ops);--> statement-breakpoint
CREATE INDEX "message_hidden_for_user_id_idx" ON "message_hidden_for" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "message_reactions_user_id_idx" ON "message_reactions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "legal_announcement_acks_user_id_idx" ON "legal_announcement_acks" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "conversation_members_user_id_left_at_idx" ON "conversation_members" USING btree ("user_id" timestamp_ops,"left_at" timestamp_ops);
*/