# Intranet — Database data dictionary

Generated from `packages/database/prisma/schema/*.prisma` (Prisma 6.19.3, PostgreSQL).
Authoritative DDL: [`03-schema.sql`](03-schema.sql). Spreadsheet summary: [`05-tables-index.csv`](05-tables-index.csv).

**274 tables · 3228 columns · 444 foreign keys · 590 secondary indexes.**

> Objects created by raw migration SQL only — the `vector` extension, `aria_knowledge_articles.embedding`, two GIN indexes, `public.is_service_role()` and the 91 RLS policies — are **not** in the Prisma schema and therefore not listed below. See [`04-schema-addendum.sql`](04-schema-addendum.sql).

## Contents

- [`approval-chains` — Approval chains (generic, configurable)](#approval-chains-approval-chains-generic-configurable) (3 tables)
- [`comms` — Communications, ARIA assistant, notifications](#comms-communications-aria-assistant-notifications) (19 tables)
- [`content` — Content — blogs, articles, careers](#content-content--blogs-articles-careers) (7 tables)
- [`core` — Core — entities, users, sessions, audit](#core-core--entities-users-sessions-audit) (6 tables)
- [`finance` — Finance & accounting (incl. fixed assets)](#finance-finance--accounting-incl-fixed-assets) (42 tables)
- [`helpdesk` — IT helpdesk / ticketing](#helpdesk-it-helpdesk--ticketing) (4 tables)
- [`hr` — HR / HRMS / payroll / leave / attendance](#hr-hr--hrms--payroll--leave--attendance) (47 tables)
- [`integrations` — Third-party integrations (Google, DocuSign)](#integrations-third-party-integrations-google-docusign) (2 tables)
- [`investors` — Investor relations & fundraising](#investors-investor-relations--fundraising) (13 tables)
- [`it-operations` — IT operations (assets, subscriptions, access)](#it-operations-it-operations-assets-subscriptions-access) (9 tables)
- [`legal` — Legal CRM & contract register](#legal-legal-crm--contract-register) (9 tables)
- [`marketing-crm` — Marketing CRM & analytics](#marketing-crm-marketing-crm--analytics) (5 tables)
- [`operations` — Operations (projects, office, travel, expenses, …)](#operations-operations-projects-office-travel-expenses-) (62 tables)
- [`performance` — Performance management & appraisals](#performance-performance-management--appraisals) (7 tables)
- [`proposals` — Proposals (two-tier decision flow)](#proposals-proposals-two-tier-decision-flow) (4 tables)
- [`rbac` — RBAC — roles, permissions, module access](#rbac-rbac--roles-permissions-module-access) (7 tables)
- [`sales-crm` — Sales CRM](#sales-crm-sales-crm) (12 tables)
- [`sales-revenue-crm` — Sales Revenue CRM (mirror of Sales CRM)](#sales-revenue-crm-sales-revenue-crm-mirror-of-sales-crm) (11 tables)
- [`system` — System settings, feature config, telemetry](#system-system-settings-feature-config-telemetry) (5 tables)

## `approval-chains` — Approval chains (generic, configurable)

Source: `packages/database/prisma/schema/approval-chains.prisma`

### `approval_chain_decisions`

Prisma model `ApprovalChainDecision` · 12 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `scope` | `VARCHAR(50)` | NOT NULL |  |
| `project_id` → `projects.id` (ON DELETE CASCADE) | `TEXT` | NULL |  |
| `proposal_id` → `proposals.id` (ON DELETE CASCADE) | `TEXT` | NULL |  |
| `order` | `INTEGER` | NOT NULL |  |
| `name` | `VARCHAR(100)` | NOT NULL |  |
| `approver_user_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `status` | `VARCHAR(20)` | NOT NULL | `'pending'` |
| `decided_by_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `decided_at` | `TIMESTAMPTZ(6)` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `approver_user_id, status`, `scope, status`, `UNIQUE project_id, order`, `UNIQUE proposal_id, order`

### `approval_chain_steps`

Prisma model `ApprovalChainStep` · 10 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `chain_id` → `approval_chains.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `order` | `INTEGER` | NOT NULL |  |
| `name` | `VARCHAR(100)` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `approver_user_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `is_system` | `BOOLEAN` | NOT NULL | `false` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `approver_user_id`, `UNIQUE chain_id, order`

### `approval_chains`

Prisma model `ApprovalChain` · 7 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `scope` | `VARCHAR(50)` | NOT NULL |  |
| `name` | `VARCHAR(100)` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE scope`

Referenced by (1): `approval_chain_steps.chain_id`

## `comms` — Communications, ARIA assistant, notifications

Source: `packages/database/prisma/schema/comms.prisma`

### `aria_attachments`

Prisma model `AriaAttachment` · 12 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `message_id` → `aria_messages.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `kind` | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `mime_type` | `TEXT` | NOT NULL |  |
| `size` | `INTEGER` | NOT NULL |  |
| `storage_bucket` | `TEXT` | NOT NULL |  |
| `storage_path` | `TEXT` | NOT NULL |  |
| `extracted_text` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'ready'` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `user_id`, `message_id`

### `aria_brief_deliveries`

Prisma model `AriaBriefDelivery` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `delivered_on` | `TEXT` | NOT NULL |  |
| `generated_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `payload_json` | `JSONB` | NOT NULL |  |
| `channel_status` | `JSONB` | NOT NULL | `'{}'` |

Indexes: `user_id, generated_at`, `UNIQUE user_id, delivered_on`

### `aria_brief_subscriptions`

Prisma model `AriaBriefSubscription` · 10 columns · PK `(user_id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `user_id` 🔑 → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `enabled` | `BOOLEAN` | NOT NULL | `true` |
| `hour_local` | `INTEGER` | NOT NULL | `7` |
| `timezone` | `TEXT` | NOT NULL | `'Asia/Bangkok'` |
| `channels` | `TEXT[]` | NULL | `ARRAY['in_app', 'email']::TEXT[]` |
| `sections` | `TEXT[]` | NULL | `ARRAY[]::TEXT[]` |
| `weekdays_only` | `BOOLEAN` | NOT NULL | `false` |
| `last_delivered_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `enabled, hour_local`

### `aria_conversation_memory`

Prisma model `AriaConversationMemory` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `conversation_id` → `aria_conversations.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `key` | `TEXT` | NOT NULL |  |
| `value` | `TEXT` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `conversation_id`, `UNIQUE conversation_id, key`

### `aria_conversation_summaries`

Prisma model `AriaConversationSummary` · 7 columns · PK `(conversation_id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `conversation_id` 🔑 → `aria_conversations.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `summary` | `TEXT` | NOT NULL |  |
| `covers_through_message_id` | `UUID` | NULL |  |
| `message_count` | `INTEGER` | NOT NULL | `0` |
| `model` | `TEXT` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

### `aria_conversations`

Prisma model `AriaConversation` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `title` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `user_id`

Referenced by (4): `aria_conversation_memory.conversation_id`, `aria_conversation_summaries.conversation_id`, `aria_messages.conversation_id`, `aria_query_logs.conversation_id`

### `aria_feedback`

Prisma model `AriaFeedback` · 12 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `message_id` → `aria_messages.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `rating` | `TEXT` | NOT NULL |  |
| `reason` | `VARCHAR(1000)` | NULL |  |
| `reviewed` | `BOOLEAN` | NOT NULL | `false` |
| `reviewed_by_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `reviewed_at` | `TIMESTAMP(3)` | NULL |  |
| `review_note` | `VARCHAR(500)` | NULL |  |
| `resulting_article_id` → `aria_knowledge_articles.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `rating, reviewed, created_at`, `reviewed_by_id`, `UNIQUE message_id, user_id`

### `aria_knowledge_articles`

Prisma model `AriaKnowledgeArticle` · 12 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `category` | `TEXT` | NOT NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `slug` | `TEXT` | NOT NULL |  |
| `body` | `TEXT` | NOT NULL |  |
| `keywords` | `TEXT[]` | NULL |  |
| `tags` | `TEXT[]` | NULL |  |
| `required_permissions` | `TEXT[]` | NULL | `ARRAY[]::TEXT[]` |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `created_by_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE slug`, `category, is_active`, `slug`

Referenced by (1): `aria_feedback.resulting_article_id`

### `aria_messages`

Prisma model `AriaMessage` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `conversation_id` → `aria_conversations.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `role` | `TEXT` | NOT NULL |  |
| `content` | `TEXT` | NOT NULL |  |
| `metadata` | `JSONB` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `conversation_id`

Referenced by (2): `aria_attachments.message_id`, `aria_feedback.message_id`

### `aria_query_logs`

Prisma model `AriaQueryLog` · 21 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `conversation_id` → `aria_conversations.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `user_message` | `TEXT` | NOT NULL |  |
| `retrieved_article_ids` | `UUID[]` | NULL | `ARRAY[]::UUID[]` |
| `retrieved_distances` | `DOUBLE PRECISION[]` | NULL | `ARRAY[]::DOUBLE PRECISION[]` |
| `top_distance` | `DOUBLE PRECISION` | NULL |  |
| `retrieval_mode` | `TEXT` | NOT NULL | `'vector'` |
| `workspace_bytes` | `INTEGER` | NOT NULL | `0` |
| `knowledge_bytes` | `INTEGER` | NOT NULL | `0` |
| `latency_ms` | `INTEGER` | NOT NULL |  |
| `tokens_in` | `INTEGER` | NULL |  |
| `tokens_out` | `INTEGER` | NULL |  |
| `cache_read_tokens` | `INTEGER` | NULL |  |
| `cache_create_tokens` | `INTEGER` | NULL |  |
| `model` | `TEXT` | NOT NULL |  |
| `error` | `BOOLEAN` | NOT NULL | `false` |
| `error_message` | `TEXT` | NULL |  |
| `tool_use_count` | `INTEGER` | NOT NULL | `0` |
| `tool_names` | `TEXT[]` | NULL | `ARRAY[]::TEXT[]` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `created_at`, `user_id, created_at`, `conversation_id`

### `company_dates`

Prisma model `CompanyDate` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `date` | `DATE` | NOT NULL |  |
| `type` | `TEXT` | NOT NULL |  |
| `location` | `TEXT` | NULL |  |
| `attachments` | `JSONB` | NULL |  |
| `link_url` | `TEXT` | NULL |  |
| `added_by` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `date`

### `company_news`

Prisma model `CompanyNews` · 10 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `content` | `TEXT` | NOT NULL |  |
| `category` | `TEXT` | NULL |  |
| `author_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `is_pinned` | `BOOLEAN` | NOT NULL | `false` |
| `attachments` | `JSONB` | NULL |  |
| `link_url` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `created_at DESC`

### `conversation_members`

Prisma model `ConversationMember` · 6 columns · PK `(conversation_id, user_id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `conversation_id` 🔑 → `conversations.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `user_id` 🔑 → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `role` | `VARCHAR(20)` | NOT NULL | `'member'` |
| `joined_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `left_at` | `TIMESTAMP(3)` | NULL |  |
| `last_read_at` | `TIMESTAMP(3)` | NULL |  |

Indexes: `user_id, left_at`

### `conversations`

Prisma model `Conversation` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `type` | `VARCHAR(20)` | NOT NULL | `'direct'` |
| `direct_key` | `TEXT` | NULL |  |
| `title` | `TEXT` | NULL |  |
| `created_by` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `last_message_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE direct_key`, `created_by`, `type`, `updated_at DESC`

Referenced by (2): `conversation_members.conversation_id`, `messages.conversation_id`

### `message_hidden_for`

Prisma model `MessageHiddenFor` · 3 columns · PK `(message_id, user_id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `message_id` 🔑 → `messages.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `user_id` 🔑 → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `hidden_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `user_id`

### `message_reactions`

Prisma model `MessageReaction` · 4 columns · PK `(message_id, user_id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `message_id` 🔑 → `messages.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `user_id` 🔑 → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `emoji` | `VARCHAR(20)` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `user_id`

### `messages`

Prisma model `Message` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `conversation_id` → `conversations.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `author_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `content` | `TEXT` | NULL |  |
| `kind` | `VARCHAR(20)` | NOT NULL | `'text'` |
| `deleted_for_everyone_at` | `TIMESTAMP(3)` | NULL |  |
| `deleted_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `author_id`, `conversation_id`, `conversation_id, created_at DESC`

Referenced by (2): `message_hidden_for.message_id`, `message_reactions.message_id`

### `wall_comments`

Prisma model `WallComment` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `post_id` → `wall_posts.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `author_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `content` | `TEXT` | NOT NULL |  |
| `type` | `TEXT` | NOT NULL | `'comment'` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `post_id`

### `wall_posts`

Prisma model `WallPost` · 10 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `author_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `content` | `TEXT` | NOT NULL |  |
| `type` | `TEXT` | NOT NULL | `'post'` |
| `likes` | `JSONB` | NULL |  |
| `reactions` | `JSONB` | NULL |  |
| `attachments` | `JSONB` | NULL |  |
| `link_url` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `created_at DESC`

Referenced by (1): `wall_comments.post_id`

## `content` — Content — blogs, articles, careers

Source: `packages/database/prisma/schema/content.prisma`

### `applications`

Prisma model `Application` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `email` | `TEXT` | NOT NULL |  |
| `mobile` | `TEXT` | NOT NULL |  |
| `linkedin` | `TEXT` | NULL |  |
| `website` | `TEXT` | NULL |  |
| `attachment` | `TEXT` | NOT NULL |  |
| `job_id` → `jobs.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `job_id`, `created_at DESC`

### `articles`

Prisma model `Article` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL | `gen_random_uuid()` |
| `title` | `TEXT` | NOT NULL |  |
| `date` | `TEXT` | NOT NULL |  |
| `link` | `TEXT` | NOT NULL |  |
| `img` | `TEXT` | NOT NULL |  |
| `author_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `created_at DESC`

### `blogs`

Prisma model `Blog` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL | `gen_random_uuid()` |
| `title` | `TEXT` | NOT NULL |  |
| `content` | `TEXT` | NOT NULL |  |
| `cover_image` | `TEXT` | NOT NULL |  |
| `slug` | `TEXT` | NULL |  |
| `active` | `BOOLEAN` | NOT NULL | `true` |
| `author_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `created_at DESC`

### `jobs`

Prisma model `Job` · 10 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `slug` | `TEXT` | NULL |  |
| `type` | `TEXT` | NOT NULL |  |
| `location` | `TEXT` | NOT NULL |  |
| `department` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NOT NULL |  |
| `active` | `BOOLEAN` | NOT NULL | `true` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE slug`, `active`, `department`

Referenced by (1): `applications.job_id`

### `wiki_page_permissions`

Prisma model `WikiPagePermission` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `page_id` → `wiki_pages.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `level` | `TEXT` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `user_id`, `UNIQUE page_id, user_id`

### `wiki_page_versions`

Prisma model `WikiPageVersion` · 7 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `page_id` → `wiki_pages.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `version` | `INTEGER` | NOT NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `body` | `TEXT` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `created_by_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |

Indexes: `page_id, created_at DESC`, `UNIQUE page_id, version`

### `wiki_pages`

Prisma model `WikiPage` · 14 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `parent_id` → `wiki_pages.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `position` | `INTEGER` | NOT NULL | `0` |
| `folder` | `TEXT` | NULL |  |
| `body` | `TEXT` | NOT NULL |  |
| `attachments` | `JSONB` | NOT NULL | `'[]'` |
| `slug` | `TEXT` | NULL |  |
| `is_published` | `BOOLEAN` | NOT NULL | `true` |
| `is_restricted` | `BOOLEAN` | NOT NULL | `false` |
| `created_by_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `updated_by_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE slug`, `parent_id, position`, `folder`, `is_published, updated_at DESC`

Referenced by (3): `wiki_page_permissions.page_id`, `wiki_page_versions.page_id`, `wiki_pages.parent_id`

## `core` — Core — entities, users, sessions, audit

Source: `packages/database/prisma/schema/core.prisma`

### `auth_logs`

Prisma model `AuthLog` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `email` | `VARCHAR(254)` | NOT NULL |  |
| `ip` | `VARCHAR(64)` | NULL |  |
| `action` | `VARCHAR(32)` | NOT NULL |  |
| `success` | `BOOLEAN` | NOT NULL |  |
| `error_message` | `VARCHAR(500)` | NULL |  |
| `user_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `email, action, created_at`, `ip, created_at`, `created_at`

### `departments`

Prisma model `Department` · 10 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL | `gen_random_uuid()` |
| `name` | `VARCHAR(100)` | NOT NULL |  |
| `code` | `VARCHAR(20)` | NULL |  |
| `description` | `TEXT` | NULL |  |
| `head_id` | `UUID` | NULL |  |
| `parent_id` → `departments.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE name`, `UNIQUE code`, `parent_id`, `is_active`

Referenced by (1): `departments.parent_id`

### `entities`

Prisma model `Entity` · 24 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `code` | `TEXT` | NOT NULL |  |
| `country` | `TEXT` | NOT NULL |  |
| `currency` | `TEXT` | NOT NULL |  |
| `accounting_std` | `TEXT` | NOT NULL | `'IFRS'` |
| `tax_id` | `TEXT` | NULL |  |
| `address` | `TEXT` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `name_th` | `TEXT` | NULL |  |
| `branch_code` | `TEXT` | NULL |  |
| `logo_url` | `TEXT` | NULL |  |
| `vat_registration_status` | `TEXT` | NULL |  |
| `boi_type` | `TEXT` | NULL |  |
| `boi_period` | `TEXT` | NULL |  |
| `fiscal_year_start_month` | `INTEGER` | NOT NULL | `1` |
| `first_fiscal_year_start` | `TIMESTAMP(3)` | NULL |  |
| `first_fiscal_year_end` | `TIMESTAMP(3)` | NULL |  |
| `default_rate_source` | `TEXT` | NOT NULL | `'bot'` |
| `enabled_currencies` | `TEXT[]` | NULL | `ARRAY[]::TEXT[]` |
| `setup_state` | `TEXT` | NOT NULL | `'active'` |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE code`

Referenced by (35): `account_mappings.entity_id`, `attendance_policies.entity_id`, `attendance_shifts.entity_id`, `bank_accounts.entity_id`, `bank_transactions.entity_id`, `benefits.entity_id`, `cash_advance_requests.entity_id`, `chart_of_accounts.entity_id`, `company_policies.entity_id`, `consultant_invoices.entity_id`, `credit_notes.entity_id`, `document_sequences.entity_id`, `expense_reports.entity_id`, `expenses.entity_id`, `fiscal_periods.entity_id`, `invoices.entity_id`, `journal_entries.entity_id`, `leave_requests.entity_id`, `leave_types.entity_id`, `legal_announcements.entity_id`, `legal_documents.entity_id`, `ninety_day_notifications.entity_id`, `offboarding_runs.entity_id`, `onboarding_runs.entity_id` … (+11 more)

### `sessions`

Prisma model `Session` · 7 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `token_hash` | `TEXT` | NOT NULL |  |
| `expires_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `ip_address` | `TEXT` | NULL |  |
| `user_agent` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `UNIQUE token_hash`, `user_id`, `token_hash`

### `user_entity_memberships`

Prisma model `UserEntityMembership` · 7 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `role_id` → `roles.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `entity_id`, `UNIQUE user_id, entity_id`

### `users`

Prisma model `User` · 36 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `email` | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `avatar_url` | `TEXT` | NULL |  |
| `phone` | `TEXT` | NULL |  |
| `phone_public` | `BOOLEAN` | NOT NULL | `false` |
| `entity_id` → `entities.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `active_entity_id` | `TEXT` | NULL |  |
| `department` | `TEXT` | NULL |  |
| `job_title` | `TEXT` | NULL |  |
| `employee_id` | `TEXT` | NULL |  |
| `reporting_to` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `employment_type` | `TEXT` | NOT NULL | `'full_time'` |
| `start_date` | `TIMESTAMP(3)` | NULL |  |
| `end_date` | `TIMESTAMP(3)` | NULL |  |
| `salary` | `DECIMAL(15,2)` | NULL |  |
| `currency` | `TEXT` | NULL |  |
| `location` | `TEXT` | NULL |  |
| `country` | `TEXT` | NULL |  |
| `timezone` | `TEXT` | NULL |  |
| `date_of_birth` | `DATE` | NULL |  |
| `passport_number` | `TEXT` | NULL |  |
| `nationality` | `TEXT` | NULL |  |
| `thai_id` | `TEXT` | NULL |  |
| `tax_id` | `TEXT` | NULL |  |
| `aadhaar_number` | `TEXT` | NULL |  |
| `pan_card_number` | `TEXT` | NULL |  |
| `work_permit_type` | `TEXT` | NULL |  |
| `visa_type` | `TEXT` | NULL |  |
| `permit_number` | `TEXT` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `must_change_password` | `BOOLEAN` | NOT NULL | `false` |
| `metadata` | `JSONB` | NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE email`, `UNIQUE employee_id`, `entity_id`, `email`, `is_active`, `deleted_at`

Referenced by (202): `accounting_project_members.user_id`, `accounting_project_task_assignees.user_id`, `accounting_project_task_comments.author_id`, `accounting_project_tasks.owner_id`, `accounting_projects.owner_id`, `appraisal_comments.author_id`, `appraisal_cycles.created_by`, `appraisal_ratings.rater_id`, `appraisals.employee_id`, `appraisals.manager_id`, `approval_chain_decisions.approver_user_id`, `approval_chain_decisions.decided_by_id`, `approval_chain_steps.approver_user_id`, `aria_attachments.user_id`, `aria_brief_deliveries.user_id`, `aria_brief_subscriptions.user_id`, `aria_conversations.user_id`, `aria_feedback.reviewed_by_id`, `aria_feedback.user_id`, `aria_knowledge_articles.created_by_id`, `aria_query_logs.user_id`, `articles.author_id`, `assets.assigned_to`, `attendance_audit_logs.actor_id` … (+178 more)

## `finance` — Finance & accounting (incl. fixed assets)

Source: `packages/database/prisma/schema/finance.prisma`

### `account_mappings`

Prisma model `AccountMapping` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `role` | `TEXT` | NOT NULL |  |
| `chart_of_account_id` → `chart_of_accounts.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `UNIQUE entity_id, role`

### `accounting_fx_rates`

Prisma model `AccountingFxRate` · 7 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `currency` | `VARCHAR(10)` | NOT NULL |  |
| `effective_date` | `DATE` | NOT NULL |  |
| `buying_rate` | `DECIMAL(18,8)` | NOT NULL |  |
| `selling_rate` | `DECIMAL(18,8)` | NOT NULL |  |
| `source` | `TEXT` | NOT NULL | `'bot'` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `UNIQUE currency, effective_date`

### `bank_accounts`

Prisma model `BankAccount` · 14 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `kind` | `TEXT` | NOT NULL | `'bank'` |
| `account_number` | `TEXT` | NULL |  |
| `currency` | `VARCHAR(10)` | NOT NULL | `'THB'` |
| `opening_balance` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `current_balance` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `gl_account_id` → `chart_of_accounts.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `entity_id, is_active`, `deleted_at`

Referenced by (2): `bank_transactions.bank_account_id`, `payments.bank_account_id`

### `bank_transactions`

Prisma model `BankTransaction` · 20 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `date` | `DATE` | NOT NULL |  |
| `description` | `TEXT` | NOT NULL |  |
| `amount` | `DECIMAL(15,2)` | NOT NULL |  |
| `balance` | `DECIMAL(15,2)` | NULL |  |
| `reference` | `TEXT` | NULL |  |
| `bank_account` | `TEXT` | NULL |  |
| `bank_account_id` → `bank_accounts.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `direction` | `TEXT` | NULL |  |
| `category` | `TEXT` | NULL |  |
| `reconciled` | `BOOLEAN` | NOT NULL | `false` |
| `reconciled_at` | `TIMESTAMP(3)` | NULL |  |
| `suggested_account` → `chart_of_accounts.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `mapped_account` → `chart_of_accounts.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `je_ref` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'unmatched'` |
| `source` | `TEXT` | NULL |  |
| `payment_id` → `payments.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `imported_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `entity_id, date`, `bank_account_id`, `payment_id`

### `bnry_transactions`

Prisma model `BnryTransaction` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `date` | `DATE` | NOT NULL |  |
| `type` | `TEXT` | NOT NULL |  |
| `amount` | `DECIMAL(18,4)` | NOT NULL |  |
| `reference` | `TEXT` | NULL |  |
| `description` | `TEXT` | NULL |  |
| `je_ref` | `VARCHAR(30)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `date`

### `cash_advance_approval_decisions`

Prisma model `CashAdvanceApprovalDecision` · 11 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `cash_advance_request_id` → `cash_advance_requests.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `order` | `INTEGER` | NOT NULL |  |
| `name` | `VARCHAR(100)` | NOT NULL |  |
| `approver_type` | `TEXT` | NOT NULL |  |
| `approver_user_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'pending'` |
| `decided_by_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `decided_at` | `TIMESTAMP(3)` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `approver_user_id, status`, `cash_advance_request_id`, `UNIQUE cash_advance_request_id, order`

### `cash_advance_approval_steps`

Prisma model `CashAdvanceApprovalStep` · 14 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `order` | `INTEGER` | NOT NULL |  |
| `name` | `VARCHAR(100)` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `approver_type` | `TEXT` | NOT NULL | `'manager'` |
| `approver_user_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `skip_when_submitter_ids` | `JSONB` | NOT NULL | `'[]'` |
| `only_when_submitter_ids` | `JSONB` | NOT NULL | `'[]'` |
| `payout_mode_filter` | `JSONB` | NOT NULL | `'[]'` |
| `amount_min` | `DECIMAL(15,2)` | NULL |  |
| `amount_max` | `DECIMAL(15,2)` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE order`

### `cash_advance_items`

Prisma model `CashAdvanceItem` · 10 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `request_id` → `cash_advance_requests.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `position` | `INTEGER` | NOT NULL | `1` |
| `description` | `TEXT` | NOT NULL |  |
| `category_id` → `expense_categories.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `requested_amount` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `approved_amount` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `receipt_url` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `request_id, position`

### `cash_advance_requests`

Prisma model `CashAdvanceRequest` · 29 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `request_number` | `SERIAL` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `request_date` | `DATE` | NOT NULL | `CURRENT_TIMESTAMP` |
| `position` | `TEXT` | NULL |  |
| `department` | `TEXT` | NULL |  |
| `direct_manager` | `TEXT` | NULL |  |
| `payout_mode` | `TEXT` | NOT NULL | `'bank-transfer'` |
| `bank_name` | `TEXT` | NULL |  |
| `bank_country` | `TEXT` | NULL |  |
| `bank_account_no` | `TEXT` | NULL |  |
| `swift_code` | `TEXT` | NULL |  |
| `currency` | `VARCHAR(10)` | NOT NULL | `'THB'` |
| `status` | `TEXT` | NOT NULL | `'draft'` |
| `current_step_order` | `INTEGER` | NULL |  |
| `requested_total` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `approved_total` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `notes` | `TEXT` | NULL |  |
| `reject_reason` | `TEXT` | NULL |  |
| `submitted_at` | `TIMESTAMP(3)` | NULL |  |
| `approved_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `approved_at` | `TIMESTAMP(3)` | NULL |  |
| `disbursed_at` | `TIMESTAMP(3)` | NULL |  |
| `disbursement_proof_url` | `TEXT` | NULL |  |
| `cleared_at` | `TIMESTAMP(3)` | NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE request_number`, `employee_id, status`, `entity_id`, `status`, `request_date`, `deleted_at`

Referenced by (2): `cash_advance_approval_decisions.cash_advance_request_id`, `cash_advance_items.request_id`

### `chart_of_accounts`

Prisma model `ChartOfAccount` · 14 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `code` | `VARCHAR(20)` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `name_th` | `TEXT` | NULL |  |
| `description` | `TEXT` | NULL |  |
| `description_th` | `TEXT` | NULL |  |
| `name_normalized` | `TEXT` | NULL |  |
| `type` | `TEXT` | NOT NULL |  |
| `sub_type` | `TEXT` | NULL |  |
| `parent_id` → `chart_of_accounts.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `balance` | `DECIMAL(18,2)` | NOT NULL | `0` |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |

Indexes: `entity_id, code`, `entity_id, name_normalized`

Referenced by (7): `account_mappings.chart_of_account_id`, `bank_accounts.gl_account_id`, `bank_transactions.mapped_account`, `bank_transactions.suggested_account`, `chart_of_accounts.parent_id`, `journal_entry_lines.account_id`, `tax_codes.gl_account_id`

### `credit_note_lines`

Prisma model `CreditNoteLine` · 11 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `credit_note_id` → `credit_notes.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NOT NULL |  |
| `quantity` | `DECIMAL(15,4)` | NOT NULL | `1` |
| `unit_price` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `line_total` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `tax_code_id` → `tax_codes.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `tax_rate` | `DECIMAL(7,4)` | NOT NULL | `0` |
| `tax_amount` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `gl_account_id` | `TEXT` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |

Indexes: `credit_note_id`

### `credit_notes`

Prisma model `CreditNote` · 19 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `credit_note_no` | `TEXT` | NOT NULL |  |
| `type` | `TEXT` | NOT NULL |  |
| `note_kind` | `TEXT` | NOT NULL | `'credit'` |
| `vendor_id` → `vendors.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `linked_invoice_id` → `invoices.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `issue_date` | `DATE` | NOT NULL |  |
| `subtotal` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `tax_total` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `grand_total` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `reason` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'draft'` |
| `linked_je_id` | `TEXT` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_by` | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `entity_id, status`, `deleted_at`, `UNIQUE entity_id, credit_note_no`

Referenced by (1): `credit_note_lines.credit_note_id`

### `customer_advances`

Prisma model `CustomerAdvance` · 13 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `entity_id` | `TEXT` | NOT NULL |  |
| `counterparty` | `TEXT` | NOT NULL |  |
| `currency` | `TEXT` | NOT NULL |  |
| `original_amount` | `DECIMAL(15,2)` | NOT NULL |  |
| `balance` | `DECIMAL(15,2)` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'open'` |
| `source_payment_id` | `TEXT` | NULL |  |
| `linked_je_id` | `TEXT` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `created_by` | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `entity_id, status`, `entity_id, counterparty`

### `document_sequences`

Prisma model `DocumentSequence` · 10 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `doc_type` | `TEXT` | NOT NULL |  |
| `prefix` | `TEXT` | NOT NULL | `''` |
| `next_number` | `INTEGER` | NOT NULL | `1` |
| `pad_width` | `INTEGER` | NOT NULL | `5` |
| `reset_period` | `TEXT` | NOT NULL | `'none'` |
| `period_key` | `TEXT` | NOT NULL | `''` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `UNIQUE entity_id, doc_type, period_key`

### `entity_tax_rates`

Prisma model `EntityTaxRate` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `entity_id` | `TEXT` | NOT NULL |  |
| `effective_from` | `DATE` | NOT NULL |  |
| `effective_to` | `DATE` | NULL |  |
| `rate_percent` | `DECIMAL(6,3)` | NOT NULL |  |
| `label` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `entity_id, effective_from`

### `exchange_rates`

Prisma model `ExchangeRate` · 7 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `base_currency` | `VARCHAR(10)` | NOT NULL |  |
| `currency` | `VARCHAR(10)` | NOT NULL |  |
| `rate` | `DECIMAL(18,8)` | NOT NULL |  |
| `effective_date` | `DATE` | NOT NULL |  |
| `source` | `VARCHAR(50)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `base_currency, currency`, `UNIQUE base_currency, currency, effective_date`

### `expense_approval_decisions`

Prisma model `ExpenseApprovalDecision` · 13 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `expense_report_id` → `expense_reports.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `order` | `INTEGER` | NOT NULL |  |
| `name` | `VARCHAR(100)` | NOT NULL |  |
| `approver_type` | `TEXT` | NOT NULL |  |
| `stage_role` | `TEXT` | NOT NULL | `'approve'` |
| `approver_user_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'pending'` |
| `decided_by_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `decided_at` | `TIMESTAMP(3)` | NULL |  |
| `approved_amount` | `DECIMAL(15,2)` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `approver_user_id, status`, `expense_report_id`, `UNIQUE expense_report_id, order`

### `expense_approval_steps`

Prisma model `ExpenseApprovalStep` · 15 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `order` | `INTEGER` | NOT NULL |  |
| `name` | `VARCHAR(100)` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `approver_type` | `TEXT` | NOT NULL | `'manager'` |
| `stage_role` | `TEXT` | NOT NULL | `'approve'` |
| `approver_user_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `skip_when_submitter_ids` | `JSONB` | NOT NULL | `'[]'` |
| `only_when_submitter_ids` | `JSONB` | NOT NULL | `'[]'` |
| `category_filter` | `JSONB` | NOT NULL | `'[]'` |
| `amount_min_baht` | `DECIMAL(15,2)` | NULL |  |
| `amount_max_baht` | `DECIMAL(15,2)` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE order`

### `expense_categories`

Prisma model `ExpenseCategory` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `gl_account_id` | `TEXT` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `spending_limit` | `DECIMAL(15,2)` | NULL |  |
| `limit_period` | `VARCHAR(20)` | NULL |  |
| `receipt_required` | `BOOLEAN` | NOT NULL | `false` |
| `is_allowance` | `BOOLEAN` | NOT NULL | `false` |

Indexes: `UNIQUE name`

Referenced by (2): `cash_advance_items.category_id`, `expenses.category_id`

### `expense_reports`

Prisma model `ExpenseReport` · 18 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `period` | `VARCHAR(7)` | NOT NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `category` | `TEXT` | NOT NULL | `'general'` |
| `status` | `TEXT` | NOT NULL | `'draft'` |
| `current_step_order` | `INTEGER` | NULL |  |
| `submitted_at` | `TIMESTAMP(3)` | NULL |  |
| `approved_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `approved_at` | `TIMESTAMP(3)` | NULL |  |
| `approved_total` | `DECIMAL(15,2)` | NULL |  |
| `reject_reason` | `TEXT` | NULL |  |
| `reimbursed_at` | `TIMESTAMP(3)` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `employee_id, period`, `status`, `deleted_at`

Referenced by (2): `expense_approval_decisions.expense_report_id`, `expenses.report_id`

### `expenses`

Prisma model `Expense` · 21 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `category_id` → `expense_categories.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `travel_request_id` → `travel_requests.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `report_id` → `expense_reports.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `description` | `TEXT` | NOT NULL |  |
| `amount` | `DECIMAL(15,2)` | NOT NULL |  |
| `currency` | `TEXT` | NOT NULL |  |
| `date` | `DATE` | NOT NULL |  |
| `receipt_url` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'pending'` |
| `approved_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `approved_at` | `TIMESTAMP(3)` | NULL |  |
| `reject_reason` | `TEXT` | NULL |  |
| `reimbursed_at` | `TIMESTAMP(3)` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `je_ref` | `TEXT` | NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `employee_id`, `status`, `travel_request_id`, `report_id`, `deleted_at`

### `fiscal_periods`

Prisma model `FiscalPeriod` · 10 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `year` | `INTEGER` | NOT NULL |  |
| `month` | `INTEGER` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'closed'` |
| `note` | `TEXT` | NULL |  |
| `closed_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `closed_by` | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `entity_id`, `UNIQUE entity_id, year, month`

### `fixed_asset_categories`

Prisma model `FixedAssetCategory` · 16 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `entity_id` | `TEXT` | NOT NULL |  |
| `code` | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `name_th` | `TEXT` | NULL |  |
| `asset_class` | `TEXT` | NOT NULL |  |
| `useful_life_months` | `INTEGER` | NOT NULL |  |
| `tax_useful_life_months` | `INTEGER` | NULL |  |
| `asset_gl_account_id` | `TEXT` | NULL |  |
| `depreciation_gl_account_id` | `TEXT` | NULL |  |
| `accumulated_depreciation_gl_account_id` | `TEXT` | NULL |  |
| `disposal_gain_gl_account_id` | `TEXT` | NULL |  |
| `disposal_loss_gl_account_id` | `TEXT` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `entity_id, is_active`, `UNIQUE entity_id, code`

### `fixed_asset_count_lines`

Prisma model `FixedAssetCountLine` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `session_id` → `fixed_asset_count_sessions.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `asset_id` → `fixed_assets.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `scanned_tag` | `TEXT` | NULL |  |
| `expected_quantity` | `INTEGER` | NOT NULL |  |
| `counted_quantity` | `INTEGER` | NOT NULL |  |
| `note` | `TEXT` | NULL |  |
| `counted_by` | `UUID` | NOT NULL |  |
| `counted_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `session_id`, `asset_id`

### `fixed_asset_count_sessions`

Prisma model `FixedAssetCountSession` · 11 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `entity_id` | `TEXT` | NOT NULL |  |
| `session_no` | `TEXT` | NOT NULL |  |
| `as_of_date` | `DATE` | NOT NULL |  |
| `name` | `TEXT` | NULL |  |
| `location_filter` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'open'` |
| `created_by` | `UUID` | NOT NULL |  |
| `closed_by` | `UUID` | NULL |  |
| `closed_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `entity_id, status`, `UNIQUE entity_id, session_no`

Referenced by (1): `fixed_asset_count_lines.session_id`

### `fixed_asset_disposals`

Prisma model `FixedAssetDisposal` · 28 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `asset_id` → `fixed_assets.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `entity_id` | `TEXT` | NOT NULL |  |
| `disposal_type` | `TEXT` | NOT NULL |  |
| `disposal_date` | `DATE` | NOT NULL |  |
| `units_disposed` | `INTEGER` | NOT NULL | `1` |
| `proceeds` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `nbv_disposed` | `DECIMAL(15,2)` | NULL |  |
| `gain_loss` | `DECIMAL(15,2)` | NULL |  |
| `quantity_before` | `INTEGER` | NULL |  |
| `cost_before` | `DECIMAL(15,2)` | NULL |  |
| `opening_book_value_before` | `DECIMAL(15,2)` | NULL |  |
| `cost_removed` | `DECIMAL(15,2)` | NULL |  |
| `accumulated_removed` | `DECIMAL(15,2)` | NULL |  |
| `accumulated_tax_removed` | `DECIMAL(15,2)` | NULL |  |
| `opening_tax_wdv_before` | `DECIMAL(15,2)` | NULL |  |
| `linked_je_id` → `journal_entries.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `reason` | `TEXT` | NULL |  |
| `link_group_id` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'pending'` |
| `created_by` | `UUID` | NOT NULL |  |
| `requested_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `approved_by` | `UUID` | NULL |  |
| `approved_at` | `TIMESTAMP(3)` | NULL |  |
| `rejected_by` | `UUID` | NULL |  |
| `rejected_at` | `TIMESTAMP(3)` | NULL |  |
| `reject_reason` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `entity_id, status`, `asset_id`

### `fixed_asset_remeasurements`

Prisma model `FixedAssetRemeasurement` · 30 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `asset_id` → `fixed_assets.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `entity_id` | `TEXT` | NOT NULL |  |
| `kind` | `TEXT` | NOT NULL |  |
| `effective_date` | `DATE` | NOT NULL |  |
| `carrying_before` | `DECIMAL(15,2)` | NOT NULL |  |
| `carrying_after` | `DECIMAL(15,2)` | NOT NULL |  |
| `movement` | `DECIMAL(15,2)` | NOT NULL |  |
| `profit_or_loss` | `DECIMAL(15,2)` | NOT NULL |  |
| `oci` | `DECIMAL(15,2)` | NOT NULL |  |
| `surplus_after` | `DECIMAL(15,2)` | NOT NULL |  |
| `pl_loss_after` | `DECIMAL(15,2)` | NOT NULL |  |
| `capped_at` | `DECIMAL(15,2)` | NULL |  |
| `remaining_life_months` | `INTEGER` | NULL |  |
| `reason` | `TEXT` | NULL |  |
| `evidence_url` | `TEXT` | NULL |  |
| `quantity_before` | `INTEGER` | NULL |  |
| `cost_before` | `DECIMAL(15,2)` | NULL |  |
| `opening_book_value_before` | `DECIMAL(15,2)` | NULL |  |
| `opening_as_of_date_before` | `DATE` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'pending'` |
| `created_by` | `UUID` | NOT NULL |  |
| `requested_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `approved_by` | `UUID` | NULL |  |
| `approved_at` | `TIMESTAMP(3)` | NULL |  |
| `rejected_by` | `UUID` | NULL |  |
| `rejected_at` | `TIMESTAMP(3)` | NULL |  |
| `reject_reason` | `TEXT` | NULL |  |
| `linked_je_id` → `journal_entries.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `entity_id, status`, `asset_id, effective_date`

### `fixed_asset_transfers`

Prisma model `FixedAssetTransfer` · 26 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `asset_id` → `fixed_assets.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `entity_id` | `TEXT` | NOT NULL |  |
| `kind` | `TEXT` | NOT NULL |  |
| `transfer_date` | `DATE` | NOT NULL |  |
| `from_location` | `TEXT` | NULL |  |
| `to_location` | `TEXT` | NULL |  |
| `from_custodian` | `TEXT` | NULL |  |
| `to_custodian` | `TEXT` | NULL |  |
| `to_entity_id` | `TEXT` | NULL |  |
| `destination_asset_id` → `fixed_assets.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `cost_transferred` | `DECIMAL(15,2)` | NULL |  |
| `accumulated_transferred` | `DECIMAL(15,2)` | NULL |  |
| `remaining_life_months` | `INTEGER` | NULL |  |
| `reason` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'pending'` |
| `created_by` | `UUID` | NOT NULL |  |
| `requested_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `approved_by` | `UUID` | NULL |  |
| `approved_at` | `TIMESTAMP(3)` | NULL |  |
| `rejected_by` | `UUID` | NULL |  |
| `rejected_at` | `TIMESTAMP(3)` | NULL |  |
| `reject_reason` | `TEXT` | NULL |  |
| `linked_je_out_id` | `TEXT` | NULL |  |
| `linked_je_in_id` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `entity_id, status`, `asset_id, transfer_date`

### `fixed_assets`

Prisma model `FixedAsset` · 32 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `entity_id` | `TEXT` | NOT NULL |  |
| `asset_no` | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `name_th` | `TEXT` | NULL |  |
| `category_code` | `TEXT` | NOT NULL |  |
| `asset_class` | `TEXT` | NOT NULL |  |
| `location` | `TEXT` | NULL |  |
| `assigned_user` | `TEXT` | NULL |  |
| `supplier` | `TEXT` | NULL |  |
| `serial_no` | `TEXT` | NULL |  |
| `purchase_date` | `DATE` | NOT NULL |  |
| `start_date` | `DATE` | NOT NULL |  |
| `useful_life_months` | `INTEGER` | NOT NULL |  |
| `quantity` | `INTEGER` | NOT NULL | `1` |
| `purchase_price` | `DECIMAL(15,2)` | NOT NULL |  |
| `opening_book_value` | `DECIMAL(15,2)` | NULL |  |
| `opening_as_of_date` | `DATE` | NULL |  |
| `tax_useful_life_months` | `INTEGER` | NULL |  |
| `opening_tax_wdv` | `DECIMAL(15,2)` | NULL |  |
| `opening_tax_as_of_date` | `DATE` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'active'` |
| `disposal_date` | `DATE` | NULL |  |
| `selling_price` | `DECIMAL(15,2)` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `link_group` | `TEXT` | NULL |  |
| `created_by` | `UUID` | NOT NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `revaluation_surplus` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `impairment_pl_loss` | `DECIMAL(15,2)` | NOT NULL | `0` |

Indexes: `entity_id, status`, `entity_id, category_code`, `deleted_at`, `created_by`, `UNIQUE entity_id, asset_no`

Referenced by (5): `fixed_asset_count_lines.asset_id`, `fixed_asset_disposals.asset_id`, `fixed_asset_remeasurements.asset_id`, `fixed_asset_transfers.asset_id`, `fixed_asset_transfers.destination_asset_id`

### `invoice_line_items`

Prisma model `InvoiceLineItem` · 14 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `invoice_id` → `invoices.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NOT NULL |  |
| `quantity` | `DECIMAL(15,2)` | NOT NULL | `1` |
| `unit_price` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `line_discount` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `line_vat_rate` | `DECIMAL(5,2)` | NULL |  |
| `vat_reason` | `TEXT` | NULL |  |
| `tax_base` | `DECIMAL(15,2)` | NULL |  |
| `vat_amount` | `DECIMAL(15,2)` | NULL |  |
| `capitalised` | `BOOLEAN` | NOT NULL | `false` |
| `gl_account_id` | `TEXT` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `invoice_id`

### `invoices`

Prisma model `Invoice` · 38 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `invoice_no` | `TEXT` | NOT NULL |  |
| `type` | `TEXT` | NOT NULL |  |
| `counterparty` | `TEXT` | NOT NULL |  |
| `vendor_id` → `vendors.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `amount` | `DECIMAL(15,2)` | NOT NULL |  |
| `amount_paid` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `currency` | `TEXT` | NOT NULL |  |
| `exchange_rate` | `DECIMAL(18,8)` | NULL | `1` |
| `base_amount` | `DECIMAL(15,2)` | NULL |  |
| `carrying_rate` | `DECIMAL(18,8)` | NULL |  |
| `bill_to_address` | `TEXT` | NULL |  |
| `reference` | `TEXT` | NULL |  |
| `payment_terms` | `TEXT` | NULL |  |
| `vat_rate` | `DECIMAL(5,2)` | NOT NULL | `0` |
| `tax_label` | `TEXT` | NULL |  |
| `tax_rate` | `DECIMAL(5,2)` | NOT NULL | `0` |
| `wht_rate` | `DECIMAL(5,2)` | NOT NULL | `0` |
| `issue_date` | `DATE` | NOT NULL |  |
| `due_date` | `DATE` | NOT NULL |  |
| `paid_date` | `DATE` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'draft'` |
| `draft_no` | `TEXT` | NULL |  |
| `header_discount` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `rounding_amount` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `vendor_tax_invoice_no` | `TEXT` | NULL |  |
| `tax_invoice_received` | `BOOLEAN` | NOT NULL | `false` |
| `fx_side` | `TEXT` | NULL |  |
| `fx_rate_date` | `DATE` | NULL |  |
| `cancel_reason` | `TEXT` | NULL |  |
| `cancelled_at` | `TIMESTAMP(3)` | NULL |  |
| `linked_je_id` → `journal_entries.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `created_by` | `UUID` | NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `deleted_by` | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `entity_id, vendor_id, vendor_tax_invoice_no`, `entity_id, type, status`, `vendor_id`, `due_date`, `deleted_at`, `created_by`, `UNIQUE entity_id, invoice_no`

Referenced by (4): `credit_notes.linked_invoice_id`, `invoice_line_items.invoice_id`, `payment_allocations.invoice_id`, `payments.invoice_id`

### `journal_entries`

Prisma model `JournalEntry` · 28 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `entry_no` | `TEXT` | NOT NULL |  |
| `date` | `DATE` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `description_th` | `TEXT` | NULL |  |
| `reference` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'draft'` |
| `from_expense` | `UUID` | NULL |  |
| `source_type` | `TEXT` | NULL |  |
| `source_ref` | `TEXT` | NULL |  |
| `created_by` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `approved_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `approved_at` | `TIMESTAMP(3)` | NULL |  |
| `rejected_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `rejected_at` | `TIMESTAMP(3)` | NULL |  |
| `reject_reason` | `TEXT` | NULL |  |
| `posted_at` | `TIMESTAMP(3)` | NULL |  |
| `draft_no` | `TEXT` | NULL |  |
| `cancelled_at` | `TIMESTAMP(3)` | NULL |  |
| `cancelled_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `cancel_reason` | `TEXT` | NULL |  |
| `reversed_by_entry_id` → `journal_entries.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `reverses_entry_id` → `journal_entries.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `deleted_by` | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE reversed_by_entry_id`, `UNIQUE reverses_entry_id`, `entity_id, status`, `source_type, source_ref`, `UNIQUE entity_id, entry_no`

Referenced by (7): `fixed_asset_disposals.linked_je_id`, `fixed_asset_remeasurements.linked_je_id`, `invoices.linked_je_id`, `journal_entries.reversed_by_entry_id`, `journal_entries.reverses_entry_id`, `journal_entry_lines.entry_id`, `payments.linked_je_id`

### `journal_entry_lines`

Prisma model `JournalEntryLine` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `entry_id` → `journal_entries.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `account_id` → `chart_of_accounts.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `debit` | `DECIMAL(18,2)` | NOT NULL | `0` |
| `credit` | `DECIMAL(18,2)` | NOT NULL | `0` |
| `memo` | `TEXT` | NULL |  |

Indexes: `entry_id`

### `payment_allocations`

Prisma model `PaymentAllocation` · 7 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `payment_id` → `payments.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `invoice_id` → `invoices.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `amount` | `DECIMAL(15,2)` | NOT NULL |  |
| `wht_amount` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `base_amount` | `DECIMAL(15,2)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `payment_id`, `invoice_id`

### `payments`

Prisma model `Payment` · 23 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `invoice_id` → `invoices.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `bank_account_id` → `bank_accounts.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `date` | `DATE` | NOT NULL |  |
| `amount` | `DECIMAL(15,2)` | NOT NULL |  |
| `currency` | `VARCHAR(10)` | NULL |  |
| `exchange_rate` | `DECIMAL(18,8)` | NULL | `1` |
| `base_amount` | `DECIMAL(15,2)` | NULL |  |
| `method` | `TEXT` | NOT NULL | `'bank-transfer'` |
| `receipt_no` | `TEXT` | NULL |  |
| `bank_fee` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `vat_recognised` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `wht_amount` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `write_off_amount` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `write_off_reason` | `TEXT` | NULL |  |
| `wht_certificate_received_at` | `TIMESTAMP(3)` | NULL |  |
| `reference` | `TEXT` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `created_by` | `UUID` | NOT NULL |  |
| `linked_je_id` → `journal_entries.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `entity_id`, `invoice_id`, `deleted_at`, `UNIQUE entity_id, receipt_no`

Referenced by (2): `bank_transactions.payment_id`, `payment_allocations.payment_id`

### `po_lines`

Prisma model `PoLine` · 12 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `po_id` → `purchase_orders.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NOT NULL |  |
| `quantity` | `DECIMAL(15,4)` | NOT NULL | `1` |
| `qty_received` | `DECIMAL(15,4)` | NOT NULL | `0` |
| `unit_price` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `line_total` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `tax_code_id` → `tax_codes.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `tax_rate` | `DECIMAL(7,4)` | NOT NULL | `0` |
| `tax_amount` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `gl_account_id` | `TEXT` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |

Indexes: `po_id`

### `purchase_orders`

Prisma model `PurchaseOrder` · 17 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `po_no` | `TEXT` | NOT NULL |  |
| `vendor_id` → `vendors.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `order_date` | `DATE` | NOT NULL |  |
| `expected_date` | `DATE` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'draft'` |
| `currency` | `VARCHAR(10)` | NOT NULL | `'THB'` |
| `subtotal` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `tax_total` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `grand_total` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `notes` | `TEXT` | NULL |  |
| `converted_invoice_id` | `TEXT` | NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_by` | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `entity_id, status`, `deleted_at`, `UNIQUE entity_id, po_no`

Referenced by (1): `po_lines.po_id`

### `quote_lines`

Prisma model `QuoteLine` · 11 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `quote_id` → `quotes.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NOT NULL |  |
| `quantity` | `DECIMAL(15,4)` | NOT NULL | `1` |
| `unit_price` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `line_total` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `tax_code_id` → `tax_codes.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `tax_rate` | `DECIMAL(7,4)` | NOT NULL | `0` |
| `tax_amount` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `gl_account_id` | `TEXT` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |

Indexes: `quote_id`

### `quotes`

Prisma model `Quote` · 17 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `quote_no` | `TEXT` | NOT NULL |  |
| `vendor_id` → `vendors.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `issue_date` | `DATE` | NOT NULL |  |
| `expiry_date` | `DATE` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'draft'` |
| `currency` | `VARCHAR(10)` | NOT NULL | `'THB'` |
| `subtotal` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `tax_total` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `grand_total` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `notes` | `TEXT` | NULL |  |
| `converted_invoice_id` | `TEXT` | NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_by` | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `entity_id, status`, `deleted_at`, `UNIQUE entity_id, quote_no`

Referenced by (1): `quote_lines.quote_id`

### `tax_codes`

Prisma model `TaxCode` · 10 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `code` | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `kind` | `TEXT` | NOT NULL |  |
| `rate` | `DECIMAL(7,4)` | NOT NULL | `0` |
| `gl_account_id` → `chart_of_accounts.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `UNIQUE entity_id, code`

Referenced by (3): `credit_note_lines.tax_code_id`, `po_lines.tax_code_id`, `quote_lines.tax_code_id`

### `tax_filings`

Prisma model `TaxFiling` · 14 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `entity_id` | `TEXT` | NOT NULL |  |
| `filing_type` | `TEXT` | NOT NULL | `'vat'` |
| `year` | `INTEGER` | NOT NULL |  |
| `month` | `INTEGER` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'filed'` |
| `snapshot` | `JSONB` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `filed_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `filed_by` | `UUID` | NOT NULL |  |
| `reopened_at` | `TIMESTAMP(3)` | NULL |  |
| `reopened_by` | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `entity_id, status`, `UNIQUE entity_id, filing_type, year, month`

### `vendors`

Prisma model `Vendor` · 38 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `contact_type` | `TEXT` | NULL |  |
| `contact_id` | `TEXT` | NULL |  |
| `business_type` | `TEXT` | NULL |  |
| `business_location` | `TEXT` | NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `name_th` | `TEXT` | NULL |  |
| `name_en` | `TEXT` | NULL |  |
| `address_th` | `TEXT` | NULL |  |
| `address_en` | `TEXT` | NULL |  |
| `address2` | `TEXT` | NULL |  |
| `address3` | `TEXT` | NULL |  |
| `delivery_address_th` | `TEXT` | NULL |  |
| `delivery_address_en` | `TEXT` | NULL |  |
| `zip_code` | `TEXT` | NULL |  |
| `tax_id` | `TEXT` | NULL |  |
| `branch_code` | `TEXT` | NULL |  |
| `branch` | `TEXT` | NULL |  |
| `contact_name` | `TEXT` | NULL |  |
| `email` | `TEXT` | NULL |  |
| `mobile` | `TEXT` | NULL |  |
| `credit_days` | `INTEGER` | NULL |  |
| `payment_terms` | `TEXT` | NULL |  |
| `default_currency` | `TEXT` | NULL |  |
| `tax_treatment` | `TEXT` | NULL |  |
| `default_revenue_account_id` | `TEXT` | NULL |  |
| `default_expense_account_id` | `TEXT` | NULL |  |
| `default_wht_rate` | `DECIMAL(7,4)` | NULL |  |
| `credit_limit` | `DECIMAL(18,2)` | NULL |  |
| `phone` | `TEXT` | NULL |  |
| `fax_number` | `TEXT` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `merged_into_id` → `vendors.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `entity_id, is_active`, `entity_id, name`, `contact_id`, `tax_id`, `deleted_at`

Referenced by (5): `credit_notes.vendor_id`, `invoices.vendor_id`, `purchase_orders.vendor_id`, `quotes.vendor_id`, `vendors.merged_into_id`

## `helpdesk` — IT helpdesk / ticketing

Source: `packages/database/prisma/schema/helpdesk.prisma`

### `helpdesk_comments`

Prisma model `HelpdeskComment` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `ticket_id` → `helpdesk_tickets.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `author_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `body` | `TEXT` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `ticket_id, created_at`

### `helpdesk_settings`

Prisma model `HelpdeskSettings` · 16 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `singleton` | `BOOLEAN` | NOT NULL | `true` |
| `notify_emails` | `TEXT[]` | NULL | `ARRAY[]::TEXT[]` |
| `notify_on_create` | `BOOLEAN` | NOT NULL | `true` |
| `notify_creator_on_create` | `BOOLEAN` | NOT NULL | `true` |
| `notify_creator_on_status` | `BOOLEAN` | NOT NULL | `true` |
| `github_enabled` | `BOOLEAN` | NOT NULL | `false` |
| `github_repo_owner` | `TEXT` | NULL |  |
| `github_repo_name` | `TEXT` | NULL |  |
| `github_token_encrypted` | `TEXT` | NULL |  |
| `github_webhook_secret` | `TEXT` | NULL |  |
| `github_label_in_progress` | `TEXT` | NOT NULL | `'in progress'` |
| `github_label_review` | `TEXT` | NOT NULL | `'review'` |
| `updated_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE singleton`

### `helpdesk_tickets`

Prisma model `HelpdeskTicket` · 19 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `ticket_number` | `SERIAL` | NOT NULL |  |
| `title` | `VARCHAR(200)` | NOT NULL |  |
| `description` | `TEXT` | NOT NULL |  |
| `category` | `TEXT` | NOT NULL | `'other'` |
| `priority` | `TEXT` | NOT NULL | `'medium'` |
| `status` | `TEXT` | NOT NULL | `'open'` |
| `created_by` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `assignee_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `resolution_note` | `TEXT` | NULL |  |
| `resolved_at` | `TIMESTAMP(3)` | NULL |  |
| `closed_at` | `TIMESTAMP(3)` | NULL |  |
| `first_response_at` | `TIMESTAMP(3)` | NULL |  |
| `reopened_count` | `INTEGER` | NOT NULL | `0` |
| `attachments` | `JSONB` | NULL |  |
| `github_issue_number` | `INTEGER` | NULL |  |
| `github_issue_url` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE ticket_number`, `UNIQUE github_issue_number`, `status`, `created_by`, `assignee_id`, `category`

Referenced by (1): `helpdesk_comments.ticket_id`

### `validator_node_alerts`

Prisma model `ValidatorNodeAlert` · 13 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `name` | `VARCHAR(120)` | NOT NULL |  |
| `node_id` | `TEXT` | NULL |  |
| `field` | `TEXT` | NOT NULL |  |
| `operator` | `TEXT` | NOT NULL |  |
| `threshold` | `DECIMAL(28,8)` | NOT NULL |  |
| `email` | `VARCHAR(255)` | NOT NULL |  |
| `enabled` | `BOOLEAN` | NOT NULL | `true` |
| `cooldown_minutes` | `INTEGER` | NOT NULL | `1440` |
| `last_triggered_at` | `TIMESTAMP(3)` | NULL |  |
| `created_by` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `enabled`, `node_id`

## `hr` — HR / HRMS / payroll / leave / attendance

Source: `packages/database/prisma/schema/hr.prisma`

### `attendance_audit_logs`

Prisma model `AttendanceAuditLog` · 7 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `record_id` → `attendance_records.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `action` | `VARCHAR(40)` | NOT NULL |  |
| `actor_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `details` | `JSONB` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `employee_id`, `record_id`, `created_at`

### `attendance_corrections`

Prisma model `AttendanceCorrection` · 16 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `attendance_record_id` → `attendance_records.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `attendance_date` | `DATE` | NOT NULL |  |
| `correction_type` | `VARCHAR(40)` | NOT NULL |  |
| `reason` | `TEXT` | NOT NULL |  |
| `comments` | `TEXT` | NULL |  |
| `status` | `VARCHAR(20)` | NOT NULL | `'pending'` |
| `proposed_check_in` | `TIMESTAMP(3)` | NULL |  |
| `proposed_check_out` | `TIMESTAMP(3)` | NULL |  |
| `proposed_work_mode` | `VARCHAR(20)` | NULL |  |
| `approved_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `approved_at` | `TIMESTAMP(3)` | NULL |  |
| `reject_remarks` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `employee_id`, `status`, `attendance_date`

### `attendance_employee_shifts`

Prisma model `AttendanceEmployeeShift` · 7 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `shift_id` → `attendance_shifts.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `effective_from` | `DATE` | NOT NULL |  |
| `effective_to` | `DATE` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `employee_id`, `employee_id, effective_from`, `shift_id`

### `attendance_exceptions`

Prisma model `AttendanceException` · 11 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `type` | `VARCHAR(40)` | NOT NULL |  |
| `start_date` | `DATE` | NOT NULL |  |
| `end_date` | `DATE` | NOT NULL |  |
| `reason` | `TEXT` | NOT NULL |  |
| `status` | `VARCHAR(20)` | NOT NULL | `'approved'` |
| `approved_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `approved_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `employee_id`, `start_date, end_date`

### `attendance_policies`

Prisma model `AttendancePolicy` · 17 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `shift_start_time` | `VARCHAR(5)` | NOT NULL | `'09:00'` |
| `shift_end_time` | `VARCHAR(5)` | NOT NULL | `'18:00'` |
| `grace_minutes` | `INTEGER` | NOT NULL | `15` |
| `half_day_threshold_hours` | `DECIMAL(4,2)` | NOT NULL | `4` |
| `minimum_working_hours` | `DECIMAL(4,2)` | NOT NULL | `8` |
| `allowed_work_modes` | `JSONB` | NOT NULL | `'["office","remote","hybrid"]'` |
| `weekend_days` | `JSONB` | NOT NULL | `'[0,6]'` |
| `attendance_threshold_pct` | `INTEGER` | NOT NULL | `80` |
| `default_timezone` | `VARCHAR(64)` | NOT NULL | `'Asia/Bangkok'` |
| `missed_check_in_after_minutes` | `INTEGER` | NOT NULL | `120` |
| `missed_check_out_after_minutes` | `INTEGER` | NOT NULL | `60` |
| `consecutive_absence_alert_days` | `INTEGER` | NOT NULL | `3` |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE entity_id`

### `attendance_records`

Prisma model `AttendanceRecord` · 17 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `attendance_date` | `DATE` | NOT NULL |  |
| `check_in` | `TIMESTAMP(3)` | NULL |  |
| `check_out` | `TIMESTAMP(3)` | NULL |  |
| `employee_timezone` | `VARCHAR(64)` | NULL |  |
| `check_in_utc` | `TIMESTAMPTZ(6)` | NULL |  |
| `check_out_utc` | `TIMESTAMPTZ(6)` | NULL |  |
| `local_check_in_time` | `VARCHAR(40)` | NULL |  |
| `local_check_out_time` | `VARCHAR(40)` | NULL |  |
| `work_mode` | `VARCHAR(20)` | NOT NULL | `'office'` |
| `status` | `VARCHAR(20)` | NOT NULL | `'absent'` |
| `total_hours` | `DECIMAL(5,2)` | NULL |  |
| `late_minutes` | `INTEGER` | NOT NULL | `0` |
| `remarks` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `attendance_date`, `status`, `UNIQUE employee_id, attendance_date`

Referenced by (2): `attendance_audit_logs.record_id`, `attendance_corrections.attendance_record_id`

### `attendance_shifts`

Prisma model `AttendanceShift` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `shift_name` | `VARCHAR(80)` | NOT NULL |  |
| `start_time` | `VARCHAR(5)` | NOT NULL |  |
| `end_time` | `VARCHAR(5)` | NOT NULL |  |
| `grace_minutes` | `INTEGER` | NOT NULL | `15` |
| `active` | `BOOLEAN` | NOT NULL | `true` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `entity_id`

Referenced by (1): `attendance_employee_shifts.shift_id`

### `balance_transactions`

Prisma model `BalanceTransaction` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `leave_type_id` → `leave_types.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `year` | `INTEGER` | NOT NULL |  |
| `type` | `VARCHAR(30)` | NOT NULL |  |
| `amount` | `DECIMAL(6,1)` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `reference_id` | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `employee_id, leave_type_id, year`

### `benefit_enrollments`

Prisma model `BenefitEnrollment` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `benefit_id` → `benefits.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `start_date` | `DATE` | NOT NULL |  |
| `end_date` | `DATE` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'active'` |

Indexes: `UNIQUE benefit_id, employee_id`

### `benefits`

Prisma model `Benefit` · 11 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `category` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `provider` | `TEXT` | NULL |  |
| `cost` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `currency` | `TEXT` | NOT NULL | `'THB'` |
| `entity_id` → `entities.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Referenced by (1): `benefit_enrollments.benefit_id`

### `certificates`

Prisma model `Certificate` · 15 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `recipient_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `recipient_name` | `VARCHAR(200)` | NOT NULL |  |
| `recipient_email` | `VARCHAR(255)` | NOT NULL |  |
| `title` | `VARCHAR(200)` | NOT NULL |  |
| `message` | `TEXT` | NULL |  |
| `type` | `VARCHAR(40)` | NOT NULL | `'achievement'` |
| `signatories` | `JSONB` | NOT NULL | `'[]'` |
| `file_url` | `TEXT` | NULL |  |
| `status` | `VARCHAR(20)` | NOT NULL | `'draft'` |
| `issued_by_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `issued_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |

Indexes: `recipient_id`, `issued_by_id`, `status`, `deleted_at`

### `company_policies`

Prisma model `CompanyPolicy` · 15 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `title` | `VARCHAR(200)` | NOT NULL |  |
| `category` | `VARCHAR(40)` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `file_url` | `TEXT` | NOT NULL |  |
| `file_name` | `TEXT` | NOT NULL |  |
| `mime_type` | `TEXT` | NULL |  |
| `file_size` | `INTEGER` | NULL |  |
| `version` | `VARCHAR(40)` | NULL |  |
| `effective_date` | `DATE` | NULL |  |
| `entity_id` → `entities.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `uploaded_by_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `category`, `entity_id`, `is_active`

### `consultant_invoices`

Prisma model `ConsultantInvoice` · 12 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `consultant_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `invoice_no` | `TEXT` | NOT NULL |  |
| `amount` | `DECIMAL(15,2)` | NOT NULL |  |
| `wht_rate` | `DECIMAL(5,2)` | NOT NULL | `0` |
| `wht_amount` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `net_amount` | `DECIMAL(15,2)` | NOT NULL |  |
| `period` | `TEXT` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'pending'` |
| `cert_issued` | `BOOLEAN` | NOT NULL | `false` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

### `employee_agreements`

Prisma model `EmployeeAgreement` · 14 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `type` | `VARCHAR(40)` | NOT NULL |  |
| `title` | `VARCHAR(200)` | NOT NULL |  |
| `file_url` | `TEXT` | NOT NULL |  |
| `file_name` | `TEXT` | NOT NULL |  |
| `mime_type` | `TEXT` | NULL |  |
| `file_size` | `INTEGER` | NULL |  |
| `effective_date` | `DATE` | NULL |  |
| `expiry_date` | `DATE` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `uploaded_by_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `employee_id`, `type`, `expiry_date`

### `equity_monthly_salary`

Prisma model `EquityMonthlySalary` · 10 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `employee_name` | `TEXT` | NOT NULL |  |
| `position` | `TEXT` | NULL |  |
| `start_date` | `DATE` | NULL |  |
| `currency` | `TEXT` | NULL |  |
| `year` | `INTEGER` | NOT NULL |  |
| `monthly_shares` | `JSONB` | NOT NULL | `'{}'` |
| `notes` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `year`

### `esop_grants`

Prisma model `EsopGrant` · 24 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `grant_date` | `DATE` | NOT NULL |  |
| `grant_type` | `TEXT` | NOT NULL | `'equity'` |
| `value_type` | `TEXT` | NOT NULL | `'shares'` |
| `shares` | `INTEGER` | NOT NULL | `0` |
| `currency_code` | `TEXT` | NULL |  |
| `currency_amount` | `DECIMAL(15,2)` | NULL |  |
| `percent_of_base` | `DECIMAL(5,2)` | NULL |  |
| `vesting_months` | `INTEGER` | NULL |  |
| `cliff_months` | `INTEGER` | NULL |  |
| `lock_months` | `INTEGER` | NULL |  |
| `strike_price` | `DECIMAL(10,4)` | NOT NULL | `0` |
| `allocation_mode` | `TEXT` | NOT NULL | `'one_time'` |
| `monthly_amount` | `DECIMAL(15,2)` | NULL |  |
| `allocation_start_month` | `DATE` | NULL |  |
| `allocation_end_month` | `DATE` | NULL |  |
| `source` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'active'` |
| `exercised_shares` | `INTEGER` | NOT NULL | `0` |
| `vested_to_date_override` | `INTEGER` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

### `leave_approval_decisions`

Prisma model `LeaveApprovalDecision` · 11 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `leave_request_id` → `leave_requests.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `order` | `INTEGER` | NOT NULL |  |
| `name` | `VARCHAR(100)` | NOT NULL |  |
| `approver_type` | `TEXT` | NOT NULL |  |
| `approver_user_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'pending'` |
| `decided_by_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `decided_at` | `TIMESTAMP(3)` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `approver_user_id, status`, `leave_request_id`, `UNIQUE leave_request_id, order`

### `leave_approval_steps`

Prisma model `LeaveApprovalStep` · 11 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `order` | `INTEGER` | NOT NULL |  |
| `name` | `VARCHAR(100)` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `approver_type` | `TEXT` | NOT NULL | `'manager'` |
| `approver_user_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `skip_when_submitter_ids` | `JSONB` | NOT NULL | `'[]'` |
| `only_when_submitter_ids` | `JSONB` | NOT NULL | `'[]'` |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE order`

### `leave_balances`

Prisma model `LeaveBalance` · 10 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `leave_type_id` → `leave_types.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `year` | `INTEGER` | NOT NULL |  |
| `entitled` | `DECIMAL(4,1)` | NOT NULL | `0` |
| `used` | `DECIMAL(4,1)` | NOT NULL | `0` |
| `carried` | `DECIMAL(4,1)` | NOT NULL | `0` |
| `carried_used` | `DECIMAL(4,1)` | NOT NULL | `0` |
| `carried_expiry` | `DATE` | NULL |  |
| `adjustment` | `DECIMAL(4,1)` | NOT NULL | `0` |

Indexes: `UNIQUE employee_id, leave_type_id, year`

### `leave_policy_approvers`

Prisma model `LeavePolicyApprover` · 11 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `leave_type_id` → `leave_types.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `order` | `INTEGER` | NOT NULL |  |
| `approver_type` | `TEXT` | NOT NULL | `'manager'` |
| `approver_user_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `skip_when_submitter_ids` | `JSONB` | NOT NULL | `'[]'` |
| `only_when_submitter_ids` | `JSONB` | NOT NULL | `'[]'` |
| `min_days` | `INTEGER` | NULL |  |
| `max_days` | `INTEGER` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `leave_type_id`, `approver_user_id`, `UNIQUE leave_type_id, order`

### `leave_requests`

Prisma model `LeaveRequest` · 23 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `leave_type_id` → `leave_types.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `start_date` | `DATE` | NOT NULL |  |
| `end_date` | `DATE` | NOT NULL |  |
| `duration_type` | `TEXT` | NOT NULL | `'full_day'` |
| `half_day_period` | `TEXT` | NULL |  |
| `days` | `DECIMAL(4,1)` | NOT NULL |  |
| `source` | `TEXT` | NOT NULL | `'entitled'` |
| `reason` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'pending'` |
| `current_step_order` | `INTEGER` | NULL |  |
| `balance_deducted` | `BOOLEAN` | NOT NULL | `false` |
| `approved_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `approved_at` | `TIMESTAMP(3)` | NULL |  |
| `reject_reason` | `TEXT` | NULL |  |
| `delegated_to` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `reminder_count` | `INTEGER` | NOT NULL | `0` |
| `last_reminder_at` | `TIMESTAMP(3)` | NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `employee_id`, `status`, `delegated_to`, `deleted_at`

Referenced by (1): `leave_approval_decisions.leave_request_id`

### `leave_types`

Prisma model `LeaveType` · 10 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE RESTRICT) | `TEXT` | NULL |  |
| `name` | `VARCHAR(100)` | NOT NULL |  |
| `code` | `VARCHAR(20)` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `category` | `TEXT` | NOT NULL | `'other'` |
| `days_per_year` | `INTEGER` | NOT NULL | `0` |
| `requires_approval` | `BOOLEAN` | NOT NULL | `true` |
| `is_paid` | `BOOLEAN` | NOT NULL | `true` |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |

Indexes: `entity_id, is_active`, `UNIQUE entity_id, code`, `UNIQUE entity_id, name`

Referenced by (4): `balance_transactions.leave_type_id`, `leave_balances.leave_type_id`, `leave_policy_approvers.leave_type_id`, `leave_requests.leave_type_id`

### `ninety_day_notifications`

Prisma model `NinetyDayNotification` · 17 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `holder_type` | `TEXT` | NOT NULL | `'employee'` |
| `holder_name` | `TEXT` | NULL |  |
| `holder_relationship` | `TEXT` | NULL |  |
| `last_arrival_date` | `DATE` | NOT NULL |  |
| `due_date` | `DATE` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'pending'` |
| `notes` | `TEXT` | NULL |  |
| `receipt_url` | `TEXT` | NULL |  |
| `receipt_name` | `TEXT` | NULL |  |
| `receipt_mime_type` | `TEXT` | NULL |  |
| `last_reminder_milestone_days` | `INTEGER` | NULL |  |
| `last_reminder_sent_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `employee_id`, `due_date`, `entity_id`

### `offboarding_runs`

Prisma model `OffboardingRun` · 16 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `employee_name` | `TEXT` | NOT NULL |  |
| `position` | `TEXT` | NULL |  |
| `department` | `TEXT` | NOT NULL |  |
| `last_working_day` | `DATE` | NOT NULL |  |
| `tasks` | `JSONB` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'in_progress'` |
| `employee_sign_name` | `TEXT` | NULL |  |
| `employee_signed_at` | `TIMESTAMP(3)` | NULL |  |
| `hr_sign_name` | `TEXT` | NULL |  |
| `hr_signed_at` | `TIMESTAMP(3)` | NULL |  |
| `entity_id` → `entities.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `employee_id`, `entity_id`, `deleted_at`

### `onboarding_runs`

Prisma model `OnboardingRun` · 11 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `employee_name` | `TEXT` | NOT NULL |  |
| `department` | `TEXT` | NOT NULL |  |
| `start_date` | `DATE` | NOT NULL |  |
| `tasks` | `JSONB` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'in_progress'` |
| `entity_id` → `entities.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `deleted_at`

### `payroll_approval_steps`

Prisma model `PayrollApprovalStep` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `order` | `INTEGER` | NOT NULL |  |
| `name` | `VARCHAR(100)` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `approver_user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE order`

### `payroll_runs`

Prisma model `PayrollRun` · 15 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `period` | `TEXT` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'draft'` |
| `total_gross` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `total_net` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `total_tax` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `currency_totals` | `JSONB` | NULL |  |
| `run_by` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `approved_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `approved_at` | `TIMESTAMP(3)` | NULL |  |
| `paid_at` | `TIMESTAMP(3)` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE entity_id, period`

Referenced by (1): `payslips.payroll_run_id`

### `payslips`

Prisma model `Payslip` · 15 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `payroll_run_id` → `payroll_runs.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `base_salary` | `DECIMAL(15,2)` | NOT NULL |  |
| `allowances` | `JSONB` | NULL |  |
| `deductions` | `JSONB` | NULL |  |
| `gross_pay` | `DECIMAL(15,2)` | NOT NULL |  |
| `net_pay` | `DECIMAL(15,2)` | NOT NULL |  |
| `currency` | `TEXT` | NOT NULL |  |
| `gross_pay_base` | `DECIMAL(15,2)` | NULL |  |
| `net_pay_base` | `DECIMAL(15,2)` | NULL |  |
| `position_snapshot` | `TEXT` | NULL |  |
| `department_snapshot` | `TEXT` | NULL |  |
| `start_date_snapshot` | `TEXT` | NULL |  |
| `document_url` | `TEXT` | NULL |  |

Indexes: `UNIQUE payroll_run_id, employee_id, currency`

### `public_holidays`

Prisma model `PublicHoliday` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `date` | `DATE` | NOT NULL |  |
| `name` | `VARCHAR(120)` | NOT NULL |  |
| `notes` | `TEXT` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `entity_id, date`, `UNIQUE entity_id, date`

### `survey_answers`

Prisma model `SurveyAnswer` · 4 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `response_id` → `survey_responses.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `question_id` → `survey_questions.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `value` | `JSONB` | NOT NULL |  |

Indexes: `question_id`, `UNIQUE response_id, question_id`

### `survey_form_answers`

Prisma model `SurveyFormAnswer` · 4 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `response_id` → `survey_form_responses.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `question_id` → `survey_form_questions.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `value` | `JSONB` | NOT NULL |  |

Indexes: `question_id`, `UNIQUE response_id, question_id`

### `survey_form_questions`

Prisma model `SurveyFormQuestion` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `survey_form_id` → `survey_forms.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `order` | `INTEGER` | NOT NULL |  |
| `type` | `VARCHAR(30)` | NOT NULL |  |
| `prompt` | `TEXT` | NOT NULL |  |
| `helper_text` | `TEXT` | NULL |  |
| `required` | `BOOLEAN` | NOT NULL | `false` |
| `options` | `JSONB` | NOT NULL | `'[]'` |
| `settings` | `JSONB` | NOT NULL | `'{}'` |

Indexes: `survey_form_id, order`

Referenced by (1): `survey_form_answers.question_id`

### `survey_form_responses`

Prisma model `SurveyFormResponse` · 4 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `survey_form_id` → `survey_forms.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `respondent_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `submitted_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `survey_form_id`, `UNIQUE survey_form_id, respondent_id`

Referenced by (1): `survey_form_answers.response_id`

### `survey_forms`

Prisma model `SurveyForm` · 17 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `title` | `VARCHAR(200)` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `status` | `VARCHAR(20)` | NOT NULL | `'draft'` |
| `is_anonymous` | `BOOLEAN` | NOT NULL | `false` |
| `target_all` | `BOOLEAN` | NOT NULL | `true` |
| `target_entity_ids` | `JSONB` | NOT NULL | `'[]'` |
| `target_departments` | `JSONB` | NOT NULL | `'[]'` |
| `target_user_ids` | `JSONB` | NOT NULL | `'[]'` |
| `published_at` | `TIMESTAMP(3)` | NULL |  |
| `closed_at` | `TIMESTAMP(3)` | NULL |  |
| `start_date` | `DATE` | NULL |  |
| `end_date` | `DATE` | NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |
| `created_by_id` → `users.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `status`, `created_by_id`, `archived_at`, `end_date`

Referenced by (2): `survey_form_questions.survey_form_id`, `survey_form_responses.survey_form_id`

### `survey_questions`

Prisma model `SurveyQuestion` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `survey_id` → `surveys.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `order` | `INTEGER` | NOT NULL |  |
| `type` | `VARCHAR(30)` | NOT NULL |  |
| `prompt` | `TEXT` | NOT NULL |  |
| `helper_text` | `TEXT` | NULL |  |
| `required` | `BOOLEAN` | NOT NULL | `false` |
| `options` | `JSONB` | NOT NULL | `'[]'` |
| `settings` | `JSONB` | NOT NULL | `'{}'` |

Indexes: `survey_id, order`

Referenced by (1): `survey_answers.question_id`

### `survey_responses`

Prisma model `SurveyResponse` · 4 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `survey_id` → `surveys.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `respondent_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `submitted_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `survey_id`, `UNIQUE survey_id, respondent_id`

Referenced by (1): `survey_answers.response_id`

### `surveys`

Prisma model `Survey` · 17 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `title` | `VARCHAR(200)` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `status` | `VARCHAR(20)` | NOT NULL | `'draft'` |
| `is_anonymous` | `BOOLEAN` | NOT NULL | `false` |
| `target_all` | `BOOLEAN` | NOT NULL | `true` |
| `target_entity_ids` | `JSONB` | NOT NULL | `'[]'` |
| `target_departments` | `JSONB` | NOT NULL | `'[]'` |
| `target_user_ids` | `JSONB` | NOT NULL | `'[]'` |
| `published_at` | `TIMESTAMP(3)` | NULL |  |
| `closed_at` | `TIMESTAMP(3)` | NULL |  |
| `start_date` | `DATE` | NULL |  |
| `end_date` | `DATE` | NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |
| `created_by_id` → `users.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `status`, `created_by_id`, `archived_at`, `end_date`

Referenced by (2): `survey_questions.survey_id`, `survey_responses.survey_id`

### `training_completions`

Prisma model `TrainingCompletion` · 4 columns · PK `(employee_id, module_id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `employee_id` 🔑 → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `module_id` 🔑 → `training_modules.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `completed_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `score` | `INTEGER` | NULL |  |

### `training_modules`

Prisma model `TrainingModule` · 11 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `category` | `TEXT` | NOT NULL |  |
| `duration` | `INTEGER` | NULL |  |
| `url` | `TEXT` | NULL |  |
| `file_url` | `TEXT` | NULL |  |
| `file_name` | `TEXT` | NULL |  |
| `is_mandatory` | `BOOLEAN` | NOT NULL | `false` |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Referenced by (1): `training_completions.module_id`

### `travel_approval_decisions`

Prisma model `TravelApprovalDecision` · 11 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `travel_request_id` → `travel_requests.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `order` | `INTEGER` | NOT NULL |  |
| `name` | `VARCHAR(100)` | NOT NULL |  |
| `approver_type` | `TEXT` | NOT NULL |  |
| `approver_user_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'pending'` |
| `decided_by_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `decided_at` | `TIMESTAMP(3)` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `approver_user_id, status`, `travel_request_id`, `UNIQUE travel_request_id, order`

### `travel_approval_steps`

Prisma model `TravelApprovalStep` · 14 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `order` | `INTEGER` | NOT NULL |  |
| `name` | `VARCHAR(100)` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `approver_type` | `TEXT` | NOT NULL | `'manager'` |
| `approver_user_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `skip_when_submitter_ids` | `JSONB` | NOT NULL | `'[]'` |
| `only_when_submitter_ids` | `JSONB` | NOT NULL | `'[]'` |
| `category_filter` | `JSONB` | NOT NULL | `'[]'` |
| `amount_min_baht` | `DECIMAL(15,2)` | NULL |  |
| `amount_max_baht` | `DECIMAL(15,2)` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE order`

### `travel_requests`

Prisma model `TravelRequest` · 37 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `request_code` | `VARCHAR(20)` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `entity_id` → `entities.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `origin` | `TEXT` | NULL |  |
| `destination` | `TEXT` | NOT NULL |  |
| `purpose` | `TEXT` | NOT NULL |  |
| `departure_date` | `DATE` | NOT NULL |  |
| `return_date` | `DATE` | NOT NULL |  |
| `estimated_budget` | `DECIMAL(15,2)` | NULL |  |
| `cash_advance` | `DECIMAL(15,2)` | NULL |  |
| `currency` | `TEXT` | NOT NULL | `'USD'` |
| `category` | `TEXT` | NOT NULL | `'general'` |
| `flight_type` | `TEXT` | NULL |  |
| `departure_time_preference` | `TEXT` | NULL |  |
| `return_time_preference` | `TEXT` | NULL |  |
| `meal_preference` | `TEXT` | NULL |  |
| `seating_preference` | `TEXT` | NULL |  |
| `seating_preference_other` | `TEXT` | NULL |  |
| `dummy_ticket_required` | `BOOLEAN` | NOT NULL | `false` |
| `visa_required` | `BOOLEAN` | NOT NULL | `false` |
| `hotel_required` | `BOOLEAN` | NOT NULL | `false` |
| `hotel_location_preference` | `TEXT` | NULL |  |
| `preferred_hotel` | `TEXT` | NULL |  |
| `hotel_details` | `TEXT` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `attachments` | `JSONB` | NOT NULL | `'[]'` |
| `delegated_to` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'draft'` |
| `current_step_order` | `INTEGER` | NULL |  |
| `approved_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `approved_at` | `TIMESTAMP(3)` | NULL |  |
| `reject_reason` | `TEXT` | NULL |  |
| `submitted_at` | `TIMESTAMP(3)` | NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE request_code`, `employee_id`, `status`, `departure_date`, `deleted_at`

Referenced by (2): `expenses.travel_request_id`, `travel_approval_decisions.travel_request_id`

### `visa_checklist_items`

Prisma model `VisaChecklistItem` · 12 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `visa_record_id` → `visa_records.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `template_item_id` | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `category` | `TEXT` | NOT NULL |  |
| `optional` | `BOOLEAN` | NOT NULL | `false` |
| `completed` | `BOOLEAN` | NOT NULL | `false` |
| `completed_at` | `TIMESTAMP(3)` | NULL |  |
| `completed_by_id` | `UUID` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `visa_record_id`

### `visa_checklist_templates`

Prisma model `VisaChecklistTemplate` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `visa_type` | `TEXT` | NOT NULL |  |
| `country` | `TEXT` | NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `items` | `JSONB` | NOT NULL | `'[]'` |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `entity_id` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `visa_type, is_active`

### `visa_event_logs`

Prisma model `VisaEventLog` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `visa_record_id` → `visa_records.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `actor_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `actor_type` | `TEXT` | NOT NULL | `'user'` |
| `kind` | `TEXT` | NOT NULL |  |
| `field` | `TEXT` | NULL |  |
| `old_value` | `TEXT` | NULL |  |
| `new_value` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `visa_record_id, created_at`

### `visa_knowledge_articles`

Prisma model `VisaKnowledgeArticle` · 13 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `slug` | `TEXT` | NOT NULL |  |
| `body` | `TEXT` | NOT NULL |  |
| `country` | `TEXT` | NULL |  |
| `visa_type` | `TEXT` | NULL |  |
| `tags` | `TEXT[]` | NULL |  |
| `required_permissions` | `TEXT[]` | NULL | `ARRAY[]::TEXT[]` |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `created_by_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `entity_id` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE slug`, `country, visa_type, is_active`, `slug`

### `visa_records`

Prisma model `VisaRecord` · 24 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `holder_type` | `TEXT` | NOT NULL | `'employee'` |
| `holder_name` | `TEXT` | NULL |  |
| `holder_relationship` | `TEXT` | NULL |  |
| `visa_type` | `TEXT` | NOT NULL |  |
| `country` | `TEXT` | NOT NULL |  |
| `nationality` | `TEXT` | NULL |  |
| `issue_date` | `DATE` | NULL |  |
| `expiry_date` | `DATE` | NOT NULL |  |
| `work_permit_number` | `TEXT` | NULL |  |
| `work_permit_issue_date` | `DATE` | NULL |  |
| `work_permit_expiry_date` | `DATE` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'active'` |
| `document_url` | `TEXT` | NULL |  |
| `documents` | `JSONB` | NOT NULL | `'[]'` |
| `last_reminder_sent_at` | `TIMESTAMP(3)` | NULL |  |
| `last_reminder_milestone_days` | `INTEGER` | NULL |  |
| `status_changed_at` | `TIMESTAMP(3)` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `entity_id` → `entities.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `employee_id`, `expiry_date`, `work_permit_expiry_date`, `deleted_at`

Referenced by (2): `visa_checklist_items.visa_record_id`, `visa_event_logs.visa_record_id`

## `integrations` — Third-party integrations (Google, DocuSign)

Source: `packages/database/prisma/schema/integrations.prisma`

### `google_oauth_states`

Prisma model `GoogleOauthState` · 5 columns · PK `(state)`

| Column | Type | Null | Default |
|---|---|---|---|
| `state` 🔑 | `TEXT` | NOT NULL |  |
| `user_id` | `UUID` | NOT NULL |  |
| `redirect` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `expires_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `user_id`

### `user_google_connections`

Prisma model `UserGoogleConnection` · 12 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `account_email` | `TEXT` | NOT NULL |  |
| `access_token` | `TEXT` | NOT NULL |  |
| `refresh_token` | `TEXT` | NOT NULL |  |
| `scope` | `TEXT` | NOT NULL |  |
| `expires_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `token_type` | `TEXT` | NOT NULL | `'Bearer'` |
| `encryption_version` | `INTEGER` | NOT NULL | `1` |
| `last_crm_email_sync_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE user_id`, `user_id`

## `investors` — Investor relations & fundraising

Source: `packages/database/prisma/schema/investors.prisma`

### `data_room_documents`

Prisma model `DataRoomDocument` · 10 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `category` | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `file_url` | `TEXT` | NOT NULL |  |
| `file_size` | `INTEGER` | NULL |  |
| `mime_type` | `TEXT` | NULL |  |
| `version` | `INTEGER` | NOT NULL | `1` |
| `uploaded_by` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `uploaded_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

### `fundraising_entities`

Prisma model `FundraisingEntity` · 5 columns · PK `(key)`

| Column | Type | Null | Default |
|---|---|---|---|
| `key` 🔑 | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `sort_order`

### `investments`

Prisma model `Investment` · 13 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `investor_id` → `investors.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `type` | `TEXT` | NOT NULL |  |
| `amount` | `DECIMAL(15,2)` | NOT NULL |  |
| `currency` | `TEXT` | NOT NULL | `'USD'` |
| `valuation` | `DECIMAL(15,2)` | NULL |  |
| `shares` | `INTEGER` | NULL |  |
| `date` | `DATE` | NOT NULL |  |
| `round` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'committed'` |
| `terms` | `JSONB` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

### `investor_accounts`

Prisma model `InvestorAccount` · 12 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `type` | `TEXT` | NULL |  |
| `website` | `TEXT` | NULL |  |
| `location` | `TEXT` | NULL |  |
| `region` | `TEXT` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `owner_id` → `users.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |
| `fundraising_entity` | `TEXT` | NOT NULL | `'tbh'` |

Indexes: `owner_id`, `archived_at`, `fundraising_entity`

Referenced by (1): `investor_contacts.account_id`

### `investor_activities`

Prisma model `InvestorActivity` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `type` | `TEXT` | NOT NULL |  |
| `subject` | `TEXT` | NOT NULL |  |
| `body` | `TEXT` | NULL |  |
| `occurred_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `duration_mins` | `INTEGER` | NULL |  |
| `investor_id` → `investors.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `owner_id` → `users.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `investor_id`, `occurred_at`

### `investor_contacts`

Prisma model `InvestorContact` · 12 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `first_name` | `TEXT` | NOT NULL |  |
| `last_name` | `TEXT` | NULL |  |
| `email` | `TEXT` | NULL |  |
| `phone` | `TEXT` | NULL |  |
| `title` | `TEXT` | NULL |  |
| `account_id` → `investor_accounts.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `owner_id` → `users.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |
| `fundraising_entity` | `TEXT` | NOT NULL | `'tbh'` |

Indexes: `owner_id`, `account_id`, `archived_at`, `fundraising_entity`

### `investor_leads`

Prisma model `InvestorLead` · 13 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `company` | `TEXT` | NULL |  |
| `email` | `TEXT` | NULL |  |
| `phone` | `TEXT` | NULL |  |
| `source` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'new'` |
| `notes` | `TEXT` | NULL |  |
| `owner_id` → `users.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |
| `fundraising_entity` | `TEXT` | NOT NULL | `'tbh'` |

Indexes: `owner_id, status`, `archived_at`, `fundraising_entity`

### `investor_pipeline_stages`

Prisma model `InvestorPipelineStage` · 6 columns · PK `(key)`

| Column | Type | Null | Default |
|---|---|---|---|
| `key` 🔑 | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `color` | `TEXT` | NOT NULL | `'border-t-zinc-500'` |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `sort_order`

### `investor_tags`

Prisma model `InvestorTag` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `code` | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `color` | `TEXT` | NOT NULL | `'grey'` |
| `is_system` | `BOOLEAN` | NOT NULL | `false` |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `sort_order` | `INTEGER` | NOT NULL | `100` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE code`, `sort_order`

### `investor_tasks`

Prisma model `InvestorTask` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `subject` | `TEXT` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'open'` |
| `due_date` | `DATE` | NOT NULL |  |
| `investor_id` → `investors.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `owner_id` → `users.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `completed_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `investor_id`, `owner_id, status, due_date`

### `investor_type_options`

Prisma model `InvestorTypeOption` · 5 columns · PK `(key)`

| Column | Type | Null | Default |
|---|---|---|---|
| `key` 🔑 | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `sort_order`

### `investor_updates`

Prisma model `InvestorUpdate` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `content` | `TEXT` | NOT NULL |  |
| `period` | `TEXT` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'draft'` |
| `sent_at` | `TIMESTAMP(3)` | NULL |  |
| `sent_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

### `investors`

Prisma model `Investor` · 28 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `type` | `TEXT` | NOT NULL |  |
| `contact_name` | `TEXT` | NULL |  |
| `contact_email` | `TEXT` | NULL |  |
| `contact_phone` | `TEXT` | NULL |  |
| `website` | `TEXT` | NULL |  |
| `location` | `TEXT` | NULL |  |
| `notes` | `JSONB` | NULL |  |
| `visibility` | `TEXT` | NOT NULL | `'team'` |
| `status` | `TEXT` | NOT NULL | `'investors'` |
| `title` | `TEXT` | NULL |  |
| `linkedin_url` | `TEXT` | NULL |  |
| `revenue_stream` | `TEXT` | NULL |  |
| `last_contact_date` | `DATE` | NULL |  |
| `next_action` | `TEXT` | NULL |  |
| `act_investment` | `TEXT` | NULL |  |
| `est_investment` | `TEXT` | NULL |  |
| `cross_sell` | `TEXT` | NULL |  |
| `region` | `TEXT` | NULL |  |
| `notes_text` | `TEXT` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `added_by` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `fundraising_entity` | `TEXT` | NOT NULL | `'tbh'` |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |
| `tags` | `TEXT[]` | NULL | `ARRAY[]::TEXT[]` |

Indexes: `archived_at`, `fundraising_entity`

Referenced by (3): `investments.investor_id`, `investor_activities.investor_id`, `investor_tasks.investor_id`

## `it-operations` — IT operations (assets, subscriptions, access)

Source: `packages/database/prisma/schema/it-operations.prisma`

### `it_access_approval_decisions`

Prisma model `ItAccessApprovalDecision` · 11 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `request_id` → `it_access_requests.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `order` | `INTEGER` | NOT NULL |  |
| `name` | `VARCHAR(100)` | NOT NULL |  |
| `approver_type` | `TEXT` | NOT NULL |  |
| `approver_user_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'pending'` |
| `decided_by_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `decided_at` | `TIMESTAMP(3)` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `approver_user_id, status`, `request_id`, `UNIQUE request_id, order`

### `it_access_assignments`

Prisma model `ItAccessAssignment` · 14 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `request_id` → `it_access_requests.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `system_id` → `it_systems.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `access_level` | `VARCHAR(200)` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'active'` |
| `granted_by` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `granted_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `expires_at` | `TIMESTAMP(3)` | NULL |  |
| `revoked_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `revoked_at` | `TIMESTAMP(3)` | NULL |  |
| `revoke_reason` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `employee_id, status`, `system_id`, `status`

### `it_access_audit_logs`

Prisma model `ItAccessAuditLog` · 10 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `action` | `TEXT` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `target_user_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `request_id` | `UUID` | NULL |  |
| `assignment_id` | `UUID` | NULL |  |
| `comments` | `TEXT` | NULL |  |
| `previous_value` | `JSONB` | NULL |  |
| `new_value` | `JSONB` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `request_id`, `assignment_id`, `target_user_id`, `created_at DESC`

### `it_access_requests`

Prisma model `ItAccessRequest` · 19 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `request_number` | `SERIAL` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `system_id` → `it_systems.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `request_type` | `TEXT` | NOT NULL | `'new'` |
| `requested_access_level` | `VARCHAR(200)` | NOT NULL |  |
| `business_justification` | `TEXT` | NOT NULL |  |
| `start_date` | `DATE` | NULL |  |
| `end_date` | `DATE` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'draft'` |
| `current_step_order` | `INTEGER` | NULL |  |
| `manager_comments` | `TEXT` | NULL |  |
| `it_comments` | `TEXT` | NULL |  |
| `reject_reason` | `TEXT` | NULL |  |
| `submitted_at` | `TIMESTAMP(3)` | NULL |  |
| `granted_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `granted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE request_number`, `employee_id, status`, `status`, `system_id`

Referenced by (2): `it_access_approval_decisions.request_id`, `it_access_assignments.request_id`

### `it_billing_alerts`

Prisma model `ItBillingAlert` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `subscription_id` → `it_subscriptions.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `alert_type` | `TEXT` | NOT NULL |  |
| `message` | `TEXT` | NOT NULL |  |
| `acknowledged` | `BOOLEAN` | NOT NULL | `false` |
| `acknowledged_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `acknowledged_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `subscription_id`, `acknowledged`, `alert_type`

### `it_billing_records`

Prisma model `ItBillingRecord` · 13 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `subscription_id` → `it_subscriptions.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `period_start` | `DATE` | NULL |  |
| `period_end` | `DATE` | NULL |  |
| `amount` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `currency` | `VARCHAR(10)` | NOT NULL | `'USD'` |
| `payment_status` | `TEXT` | NOT NULL | `'pending'` |
| `paid_at` | `TIMESTAMP(3)` | NULL |  |
| `invoice_url` | `TEXT` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `created_by` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `subscription_id`, `payment_status`

### `it_subscriptions`

Prisma model `ItSubscription` · 26 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `vendor_id` → `it_vendors.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `category` | `TEXT` | NOT NULL | `'saas'` |
| `product_name` | `VARCHAR(200)` | NOT NULL |  |
| `contract_start_date` | `DATE` | NULL |  |
| `renewal_date` | `DATE` | NULL |  |
| `billing_frequency` | `TEXT` | NOT NULL | `'monthly'` |
| `invoice_amount` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `currency` | `VARCHAR(10)` | NOT NULL | `'USD'` |
| `payment_status` | `TEXT` | NOT NULL | `'pending'` |
| `status` | `TEXT` | NOT NULL | `'active'` |
| `owner_user_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `total_seats` | `INTEGER` | NULL |  |
| `assigned_seats` | `INTEGER` | NOT NULL | `0` |
| `active_seats` | `INTEGER` | NOT NULL | `0` |
| `renewal_decision` | `TEXT` | NULL |  |
| `renewal_decision_at` | `TIMESTAMP(3)` | NULL |  |
| `renewal_decision_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `renewal_decision_notes` | `TEXT` | NULL |  |
| `attachments` | `JSONB` | NULL |  |
| `last_reminder_sent_at` | `TIMESTAMP(3)` | NULL |  |
| `reminders_sent` | `JSONB` | NOT NULL | `'[]'` |
| `created_by` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `vendor_id`, `status`, `renewal_date`, `payment_status`

Referenced by (2): `it_billing_alerts.subscription_id`, `it_billing_records.subscription_id`

### `it_systems`

Prisma model `ItSystem` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `name` | `VARCHAR(150)` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `category` | `TEXT` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE name`, `is_active`

Referenced by (2): `it_access_assignments.system_id`, `it_access_requests.system_id`

### `it_vendors`

Prisma model `ItVendor` · 11 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `name` | `VARCHAR(200)` | NOT NULL |  |
| `contact_person` | `VARCHAR(200)` | NULL |  |
| `email` | `VARCHAR(255)` | NULL |  |
| `phone` | `VARCHAR(50)` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `attachments` | `JSONB` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `created_by` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `is_active`

Referenced by (1): `it_subscriptions.vendor_id`

## `legal` — Legal CRM & contract register

Source: `packages/database/prisma/schema/legal.prisma`

### `legal_announcement_acks`

Prisma model `LegalAnnouncementAck` · 4 columns · PK `(announcement_id, user_id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `announcement_id` 🔑 → `legal_announcements.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `user_id` 🔑 → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `acked_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `acked_ip` | `TEXT` | NULL |  |

Indexes: `user_id`

### `legal_announcement_attachments`

Prisma model `LegalAnnouncementAttachment` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `announcement_id` → `legal_announcements.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `file_url` | `TEXT` | NOT NULL |  |
| `file_name` | `TEXT` | NOT NULL |  |
| `uploaded_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `announcement_id`

### `legal_announcements`

Prisma model `LegalAnnouncement` · 13 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `body` | `TEXT` | NOT NULL |  |
| `kind` | `TEXT` | NOT NULL | `'other'` |
| `entity_id` → `entities.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'draft'` |
| `published_at` | `TIMESTAMP(3)` | NULL |  |
| `expires_at` | `TIMESTAMP(3)` | NULL |  |
| `requires_ack` | `BOOLEAN` | NOT NULL | `false` |
| `pinned` | `BOOLEAN` | NOT NULL | `false` |
| `author_id` → `users.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `status, published_at DESC`, `entity_id`, `kind`

Referenced by (2): `legal_announcement_acks.announcement_id`, `legal_announcement_attachments.announcement_id`

### `legal_document_attachments`

Prisma model `LegalDocumentAttachment` · 11 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `document_id` → `legal_documents.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `kind` | `TEXT` | NOT NULL | `'other'` |
| `label` | `TEXT` | NULL |  |
| `file_url` | `TEXT` | NOT NULL |  |
| `file_name` | `TEXT` | NOT NULL |  |
| `effective_date` | `DATE` | NULL |  |
| `expiry_date` | `DATE` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `uploaded_by_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `document_id`, `expiry_date`

### `legal_document_shares`

Prisma model `LegalDocumentShare` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `document_id` → `legal_documents.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `type` | `TEXT` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NULL |  |
| `department` | `TEXT` | NULL |  |
| `group_id` → `user_groups.id` (ON DELETE CASCADE) | `UUID` | NULL |  |
| `created_by_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `document_id`, `user_id`, `department`, `group_id`

### `legal_documents`

Prisma model `LegalDocument` · 19 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `kind` | `TEXT` | NOT NULL |  |
| `reference` | `TEXT` | NULL |  |
| `parties` | `TEXT[]` | NULL |  |
| `owner_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `entity_id` → `entities.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `effective_date` | `DATE` | NULL |  |
| `expiry_date` | `DATE` | NULL |  |
| `renewal_lead_days` | `INTEGER` | NOT NULL | `30` |
| `status` | `TEXT` | NOT NULL | `'active'` |
| `file_url` | `TEXT` | NULL |  |
| `file_name` | `TEXT` | NULL |  |
| `folder` | `TEXT` | NULL |  |
| `alert_category` | `TEXT` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `visibility` | `TEXT` | NOT NULL | `'private'` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `expiry_date`, `kind, status`, `entity_id`, `folder`, `visibility`

Referenced by (3): `legal_document_attachments.document_id`, `legal_document_shares.document_id`, `legal_signatures.document_id`

### `legal_notification_settings`

Prisma model `LegalNotificationSettings` · 10 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `singleton` | `BOOLEAN` | NOT NULL | `true` |
| `recipients` | `TEXT[]` | NULL | `ARRAY[]::TEXT[]` |
| `notify_contract_expiry` | `BOOLEAN` | NOT NULL | `true` |
| `notify_contract_review` | `BOOLEAN` | NOT NULL | `true` |
| `notify_initial_drafting` | `BOOLEAN` | NOT NULL | `true` |
| `notify_licence_renewal` | `BOOLEAN` | NOT NULL | `true` |
| `notify_compliance_filing` | `BOOLEAN` | NOT NULL | `true` |
| `notify_counterparty_review` | `BOOLEAN` | NOT NULL | `true` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE singleton`

### `legal_signatures`

Prisma model `LegalSignature` · 25 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `document_id` → `legal_documents.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `signer_email` | `TEXT` | NOT NULL |  |
| `signer_name` | `TEXT` | NOT NULL |  |
| `token` | `TEXT` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'pending'` |
| `invite_message` | `TEXT` | NULL |  |
| `sent_at` | `TIMESTAMP(3)` | NULL |  |
| `viewed_at` | `TIMESTAMP(3)` | NULL |  |
| `signed_at` | `TIMESTAMP(3)` | NULL |  |
| `declined_at` | `TIMESTAMP(3)` | NULL |  |
| `decline_reason` | `TEXT` | NULL |  |
| `signature_text` | `TEXT` | NULL |  |
| `signature_method` | `TEXT` | NULL |  |
| `signed_ip` | `TEXT` | NULL |  |
| `signed_user_agent` | `TEXT` | NULL |  |
| `expires_at` | `TIMESTAMP(3)` | NULL |  |
| `provider` | `TEXT` | NOT NULL | `'inhouse'` |
| `docusign_envelope_id` | `TEXT` | NULL |  |
| `signing_order` | `INTEGER` | NOT NULL | `1` |
| `docusign_signer_status` | `TEXT` | NULL |  |
| `signed_pdf_url` | `TEXT` | NULL |  |
| `created_by_id` → `users.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE token`, `document_id`, `status`, `token`, `docusign_envelope_id`

### `user_docusign_connections`

Prisma model `UserDocusignConnection` · 10 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `access_token_enc` | `TEXT` | NOT NULL |  |
| `refresh_token_enc` | `TEXT` | NOT NULL |  |
| `expires_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `account_id` | `TEXT` | NOT NULL |  |
| `base_uri` | `TEXT` | NOT NULL |  |
| `scopes` | `TEXT[]` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE user_id`

## `marketing-crm` — Marketing CRM & analytics

Source: `packages/database/prisma/schema/marketing-crm.prisma`

### `mkt_campaign_levers`

Prisma model `MktCampaignLever` · 4 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `campaign_id` → `mkt_campaigns.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `lever_id` → `mkt_levers.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `campaign_id`, `lever_id`, `UNIQUE campaign_id, lever_id`

### `mkt_campaigns`

Prisma model `MktCampaign` · 24 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `name` | `VARCHAR(300)` | NOT NULL |  |
| `campaign_date` | `DATE` | NOT NULL |  |
| `hours` | `DOUBLE PRECISION` | NULL |  |
| `owner_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `status` | `VARCHAR(20)` | NOT NULL | `'planned'` |
| `country` | `VARCHAR(100)` | NULL |  |
| `partner_id` | `UUID` | NULL |  |
| `product` | `VARCHAR(150)` | NULL |  |
| `channel` | `VARCHAR(100)` | NULL |  |
| `campaign_type` | `VARCHAR(100)` | NULL |  |
| `objective` | `TEXT` | NULL |  |
| `target_audience` | `TEXT` | NULL |  |
| `levers_sequence` | `TEXT` | NULL |  |
| `copy_text` | `TEXT` | NULL |  |
| `expected_reach` | `INTEGER` | NULL |  |
| `actual_reach` | `INTEGER` | NULL |  |
| `budget` | `DECIMAL(15,2)` | NULL |  |
| `currency` | `VARCHAR(10)` | NOT NULL | `'USD'` |
| `notes` | `TEXT` | NULL |  |
| `created_by` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |

Indexes: `campaign_date`, `status`, `owner_id`, `partner_id`, `status, campaign_date`, `archived_at`

Referenced by (3): `mkt_campaign_levers.campaign_id`, `mkt_creatives.campaign_id`, `mkt_predictions.campaign_id`

### `mkt_creatives`

Prisma model `MktCreative` · 11 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `campaign_id` → `mkt_campaigns.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `version` | `INTEGER` | NOT NULL | `1` |
| `kind` | `VARCHAR(20)` | NOT NULL |  |
| `source` | `VARCHAR(20)` | NOT NULL | `'upload'` |
| `name` | `VARCHAR(300)` | NOT NULL |  |
| `url` | `TEXT` | NOT NULL |  |
| `mime_type` | `VARCHAR(150)` | NULL |  |
| `size` | `INTEGER` | NULL |  |
| `uploaded_by` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `campaign_id, version`

### `mkt_levers`

Prisma model `MktLever` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `name` | `VARCHAR(100)` | NOT NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE name`, `is_active`

Referenced by (1): `mkt_campaign_levers.lever_id`

### `mkt_predictions`

Prisma model `MktPrediction` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `campaign_id` → `mkt_campaigns.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `format` | `VARCHAR(10)` | NOT NULL |  |
| `name` | `VARCHAR(300)` | NOT NULL |  |
| `url` | `TEXT` | NOT NULL |  |
| `mime_type` | `VARCHAR(150)` | NULL |  |
| `size` | `INTEGER` | NULL |  |
| `uploaded_by` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `campaign_id, created_at`

## `operations` — Operations (projects, office, travel, expenses, …)

Source: `packages/database/prisma/schema/operations.prisma`

### `accounting_project_columns`

Prisma model `AccountingProjectColumn` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `project_id` → `accounting_projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `key` | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `color` | `TEXT` | NOT NULL | `'bg-zinc-500'` |
| `sort_order` | `INTEGER` | NOT NULL | `0` |

Indexes: `project_id`, `UNIQUE project_id, key`

### `accounting_project_members`

Prisma model `AccountingProjectMember` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `project_id` → `accounting_projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `role` | `TEXT` | NOT NULL | `'member'` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `UNIQUE project_id, user_id`

### `accounting_project_task_assignees`

Prisma model `AccountingProjectTaskAssignee` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `task_id` → `accounting_project_tasks.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `allocation_pct` | `INTEGER` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `user_id`, `UNIQUE task_id, user_id`

### `accounting_project_task_comments`

Prisma model `AccountingProjectTaskComment` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `task_id` → `accounting_project_tasks.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `author_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `body` | `TEXT` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `task_id`, `author_id`

### `accounting_project_tasks`

Prisma model `AccountingProjectTask` · 13 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `project_id` → `accounting_projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `parent_task_id` → `accounting_project_tasks.id` (ON DELETE CASCADE) | `UUID` | NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'todo'` |
| `priority` | `TEXT` | NOT NULL | `'medium'` |
| `owner_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `start_date` | `DATE` | NULL |  |
| `end_date` | `DATE` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `project_id`, `parent_task_id`

Referenced by (3): `accounting_project_task_assignees.task_id`, `accounting_project_task_comments.task_id`, `accounting_project_tasks.parent_task_id`

### `accounting_projects`

Prisma model `AccountingProject` · 25 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `slug` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'not_yet_started'` |
| `owner_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `start_date` | `DATE` | NULL |  |
| `end_date` | `DATE` | NULL |  |
| `production_live_date` | `DATE` | NULL |  |
| `go_live_date` | `DATE` | NULL |  |
| `revised_go_live_date` | `DATE` | NULL |  |
| `dependency` | `TEXT` | NULL |  |
| `comment` | `TEXT` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `department` | `TEXT` | NULL |  |
| `workstream` | `TEXT` | NULL |  |
| `details` | `TEXT` | NULL |  |
| `priority` | `TEXT` | NOT NULL | `'medium'` |
| `default_assignee_mode` | `TEXT` | NOT NULL | `'none'` |
| `default_assignee_id` | `UUID` | NULL |  |
| `reminders_sent` | `JSONB` | NOT NULL | `'[]'` |
| `last_reminder_sent_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |

Indexes: `UNIQUE slug`, `sort_order`, `department`, `archived_at`

Referenced by (3): `accounting_project_columns.project_id`, `accounting_project_members.project_id`, `accounting_project_tasks.project_id`

### `assets`

Prisma model `Asset` · 26 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `office_id` → `offices.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `type` | `TEXT` | NOT NULL |  |
| `serial_no` | `TEXT` | NULL |  |
| `assigned_to` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `purchase_date` | `DATE` | NULL |  |
| `purchase_cost` | `DECIMAL(15,2)` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'available'` |
| `notes` | `TEXT` | NULL |  |
| `manufacturer` | `TEXT` | NULL |  |
| `model` | `TEXT` | NULL |  |
| `colour` | `TEXT` | NULL |  |
| `sub_type` | `TEXT` | NULL |  |
| `operating_system` | `TEXT` | NULL |  |
| `description` | `TEXT` | NULL |  |
| `support_link` | `TEXT` | NULL |  |
| `active_service_date` | `DATE` | NULL |  |
| `department` | `TEXT` | NULL |  |
| `asset_code` | `TEXT` | NULL |  |
| `version` | `TEXT` | NULL |  |
| `quantity` | `INTEGER` | NOT NULL | `1` |
| `useful_life_months` | `INTEGER` | NULL |  |
| `book_value` | `DECIMAL(15,2)` | NULL |  |
| `disposal_date` | `DATE` | NULL |  |
| `selling_price` | `DECIMAL(15,2)` | NULL |  |

Indexes: `type`, `status`, `asset_code`

### `crm_notifications`

Prisma model `CrmNotification` · 12 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `module` | `TEXT` | NOT NULL | `'it'` |
| `user_id` | `UUID` | NOT NULL |  |
| `type` | `TEXT` | NOT NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `body` | `TEXT` | NULL |  |
| `link_url` | `TEXT` | NULL |  |
| `project_id` | `TEXT` | NULL |  |
| `task_id` | `UUID` | NULL |  |
| `actor_id` | `UUID` | NULL |  |
| `read_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `user_id, created_at`, `user_id, read_at`

### `deals`

Prisma model `Deal` · 14 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `company` | `TEXT` | NOT NULL |  |
| `contact` | `TEXT` | NULL |  |
| `value` | `DECIMAL(15,2)` | NOT NULL |  |
| `stage` | `TEXT` | NOT NULL | `'lead'` |
| `probability` | `INTEGER` | NOT NULL | `10` |
| `close_date` | `DATE` | NULL |  |
| `type` | `TEXT` | NULL |  |
| `country` | `TEXT` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `partner_id` → `partners.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `owner_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `stage`

### `desk_bookings`

Prisma model `DeskBooking` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `desk_id` → `office_desks.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `date` | `DATE` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `UNIQUE desk_id, date`

### `it_project_columns`

Prisma model `ItProjectColumn` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `project_id` → `it_projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `key` | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `color` | `TEXT` | NOT NULL | `'bg-zinc-500'` |
| `sort_order` | `INTEGER` | NOT NULL | `0` |

Indexes: `project_id`, `UNIQUE project_id, key`

### `it_project_members`

Prisma model `ItProjectMember` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `project_id` → `it_projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `role` | `TEXT` | NOT NULL | `'member'` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `UNIQUE project_id, user_id`

### `it_project_task_assignees`

Prisma model `ItProjectTaskAssignee` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `task_id` → `it_project_tasks.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `allocation_pct` | `INTEGER` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `user_id`, `UNIQUE task_id, user_id`

### `it_project_task_comments`

Prisma model `ItProjectTaskComment` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `task_id` → `it_project_tasks.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `author_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `body` | `TEXT` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `task_id`, `author_id`

### `it_project_tasks`

Prisma model `ItProjectTask` · 16 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `project_id` → `it_projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `parent_task_id` → `it_project_tasks.id` (ON DELETE CASCADE) | `UUID` | NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'todo'` |
| `priority` | `TEXT` | NOT NULL | `'medium'` |
| `owner_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `start_date` | `DATE` | NULL |  |
| `end_date` | `DATE` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `status_changed_at` | `TIMESTAMP(3)` | NULL |  |
| `completed_at` | `TIMESTAMP(3)` | NULL |  |
| `effort_points` | `INTEGER` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `project_id`, `parent_task_id`

Referenced by (3): `it_project_task_assignees.task_id`, `it_project_task_comments.task_id`, `it_project_tasks.parent_task_id`

### `it_projects`

Prisma model `ItProject` · 25 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `slug` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'not_yet_started'` |
| `owner_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `start_date` | `DATE` | NULL |  |
| `end_date` | `DATE` | NULL |  |
| `production_live_date` | `DATE` | NULL |  |
| `go_live_date` | `DATE` | NULL |  |
| `revised_go_live_date` | `DATE` | NULL |  |
| `dependency` | `TEXT` | NULL |  |
| `comment` | `TEXT` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `department` | `TEXT` | NULL |  |
| `status_changed_at` | `TIMESTAMP(3)` | NULL |  |
| `health_status` | `TEXT` | NULL |  |
| `effort_points` | `INTEGER` | NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |
| `default_assignee_mode` | `TEXT` | NOT NULL | `'none'` |
| `default_assignee_id` | `UUID` | NULL |  |
| `reminders_sent` | `JSONB` | NOT NULL | `'[]'` |
| `last_reminder_sent_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE slug`, `sort_order`, `department`, `archived_at`

Referenced by (3): `it_project_columns.project_id`, `it_project_members.project_id`, `it_project_tasks.project_id`

### `legal_project_columns`

Prisma model `LegalProjectColumn` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `project_id` → `legal_projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `key` | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `color` | `TEXT` | NOT NULL | `'bg-zinc-500'` |
| `sort_order` | `INTEGER` | NOT NULL | `0` |

Indexes: `project_id`, `UNIQUE project_id, key`

### `legal_project_members`

Prisma model `LegalProjectMember` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `project_id` → `legal_projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `role` | `TEXT` | NOT NULL | `'member'` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `UNIQUE project_id, user_id`

### `legal_project_task_assignees`

Prisma model `LegalProjectTaskAssignee` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `task_id` → `legal_project_tasks.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `allocation_pct` | `INTEGER` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `user_id`, `UNIQUE task_id, user_id`

### `legal_project_task_comments`

Prisma model `LegalProjectTaskComment` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `task_id` → `legal_project_tasks.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `author_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `body` | `TEXT` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `task_id`, `author_id`

### `legal_project_tasks`

Prisma model `LegalProjectTask` · 13 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `project_id` → `legal_projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `parent_task_id` → `legal_project_tasks.id` (ON DELETE CASCADE) | `UUID` | NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'todo'` |
| `priority` | `TEXT` | NOT NULL | `'medium'` |
| `owner_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `start_date` | `DATE` | NULL |  |
| `end_date` | `DATE` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `project_id`, `parent_task_id`

Referenced by (3): `legal_project_task_assignees.task_id`, `legal_project_task_comments.task_id`, `legal_project_tasks.parent_task_id`

### `legal_projects`

Prisma model `LegalProject` · 25 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `slug` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'not_yet_started'` |
| `owner_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `start_date` | `DATE` | NULL |  |
| `end_date` | `DATE` | NULL |  |
| `production_live_date` | `DATE` | NULL |  |
| `go_live_date` | `DATE` | NULL |  |
| `revised_go_live_date` | `DATE` | NULL |  |
| `dependency` | `TEXT` | NULL |  |
| `comment` | `TEXT` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `department` | `TEXT` | NULL |  |
| `workstream` | `TEXT` | NULL |  |
| `details` | `TEXT` | NULL |  |
| `priority` | `TEXT` | NOT NULL | `'medium'` |
| `default_assignee_mode` | `TEXT` | NOT NULL | `'none'` |
| `default_assignee_id` | `UUID` | NULL |  |
| `reminders_sent` | `JSONB` | NOT NULL | `'[]'` |
| `last_reminder_sent_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |

Indexes: `UNIQUE slug`, `sort_order`, `department`, `archived_at`

Referenced by (3): `legal_project_columns.project_id`, `legal_project_members.project_id`, `legal_project_tasks.project_id`

### `marketing_campaigns`

Prisma model `MarketingCampaign` · 13 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `title` | `VARCHAR(300)` | NOT NULL |  |
| `campaign_date` | `DATE` | NOT NULL |  |
| `hours` | `DOUBLE PRECISION` | NULL |  |
| `levers_pulled` | `TEXT` | NULL |  |
| `copy_design` | `TEXT` | NULL |  |
| `prediction_file_url` | `TEXT` | NULL |  |
| `prediction_file_name` | `TEXT` | NULL |  |
| `status` | `VARCHAR(20)` | NOT NULL | `'planned'` |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `added_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `campaign_date`

### `meeting_rooms`

Prisma model `MeetingRoom` · 7 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `office_id` → `offices.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `capacity` | `INTEGER` | NOT NULL | `0` |
| `amenities` | `TEXT` | NULL |  |
| `image_url` | `TEXT` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |

Referenced by (1): `room_bookings.room_id`

### `office_desks`

Prisma model `OfficeDesk` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `office_id` → `offices.id` (ON DELETE RESTRICT) | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `floor` | `TEXT` | NULL |  |
| `zone` | `TEXT` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |

Referenced by (1): `desk_bookings.desk_id`

### `offices`

Prisma model `Office` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `address` | `TEXT` | NULL |  |
| `city` | `TEXT` | NOT NULL |  |
| `country` | `TEXT` | NOT NULL |  |
| `timezone` | `TEXT` | NULL |  |
| `capacity` | `INTEGER` | NOT NULL | `0` |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |

Referenced by (3): `assets.office_id`, `meeting_rooms.office_id`, `office_desks.office_id`

### `ow_daily_metrics`

Prisma model `OwDailyMetric` · 33 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `date` | `DATE` | NOT NULL |  |
| `telco` | `VARCHAR(20)` | NOT NULL |  |
| `homepage_views` | `INTEGER` | NULL |  |
| `dau_crm` | `INTEGER` | NULL |  |
| `dau_ga` | `INTEGER` | NULL |  |
| `mau_rolling_30` | `INTEGER` | NULL |  |
| `unique_users` | `INTEGER` | NULL |  |
| `new_users` | `INTEGER` | NULL |  |
| `repeat_users` | `INTEGER` | NULL |  |
| `avg_session_sec` | `INTEGER` | NULL |  |
| `stw_wins` | `INTEGER` | NULL |  |
| `clicks_bnry_games` | `INTEGER` | NULL |  |
| `access_pass_users` | `INTEGER` | NULL |  |
| `bnry_earned` | `BIGINT` | NULL |  |
| `bnry_redeemed` | `BIGINT` | NULL |  |
| `mau_nexus` | `INTEGER` | NULL |  |
| `new_users_ga` | `INTEGER` | NULL |  |
| `repeat_users_ga` | `INTEGER` | NULL |  |
| `sessions_ga` | `INTEGER` | NULL |  |
| `total_credit` | `BIGINT` | NULL |  |
| `total_debit` | `BIGINT` | NULL |  |
| `total_transactions` | `INTEGER` | NULL |  |
| `spin_usage` | `INTEGER` | NULL |  |
| `spin_win_tokens` | `BIGINT` | NULL |  |
| `unique_spin_users` | `INTEGER` | NULL |  |
| `users_fando` | `INTEGER` | NULL |  |
| `users_ngage` | `INTEGER` | NULL |  |
| `tx_metrics` | `JSONB` | NULL |  |
| `is_anomaly` | `BOOLEAN` | NOT NULL | `false` |
| `is_intraday` | `BOOLEAN` | NOT NULL | `false` |
| `source_tab` | `VARCHAR(120)` | NULL |  |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `telco, date`, `UNIQUE date, telco`

### `ow_snapshots`

Prisma model `OwSnapshot` · 4 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `payload` | `JSONB` | NOT NULL |  |
| `narrative` | `JSONB` | NULL |  |
| `generated_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `generated_at DESC`

### `partner_columns`

Prisma model `PartnerColumn` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `partner_id` → `partners.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `key` | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `color` | `TEXT` | NOT NULL | `'bg-zinc-500'` |
| `sort_order` | `INTEGER` | NOT NULL | `0` |

Indexes: `partner_id`, `UNIQUE partner_id, key`

### `partner_contacts`

Prisma model `PartnerContact` · 7 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `partner_id` → `partners.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `title` | `TEXT` | NULL |  |
| `email` | `TEXT` | NULL |  |
| `phone` | `TEXT` | NULL |  |
| `is_primary` | `BOOLEAN` | NOT NULL | `false` |

### `partner_members`

Prisma model `PartnerMember` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `partner_id` → `partners.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `role` | `TEXT` | NOT NULL | `'member'` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `UNIQUE partner_id, user_id`

### `partner_task_assignees`

Prisma model `PartnerTaskAssignee` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `task_id` → `partner_tasks.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `allocation_pct` | `INTEGER` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `user_id`, `UNIQUE task_id, user_id`

### `partner_task_comments`

Prisma model `PartnerTaskComment` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `task_id` → `partner_tasks.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `author_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `body` | `TEXT` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `task_id`, `author_id`

### `partner_task_resources`

Prisma model `PartnerTaskResource` · 7 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `task_id` → `partner_tasks.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `kind` | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `url` | `TEXT` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `created_by` | `UUID` | NOT NULL |  |

Indexes: `task_id`

### `partner_tasks`

Prisma model `PartnerTask` · 13 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `partner_id` → `partners.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `parent_task_id` → `partner_tasks.id` (ON DELETE CASCADE) | `UUID` | NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'todo'` |
| `priority` | `TEXT` | NOT NULL | `'medium'` |
| `owner_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `start_date` | `DATE` | NULL |  |
| `end_date` | `DATE` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `partner_id`, `parent_task_id`

Referenced by (4): `partner_task_assignees.task_id`, `partner_task_comments.task_id`, `partner_task_resources.task_id`, `partner_tasks.parent_task_id`

### `partners`

Prisma model `Partner` · 25 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `slug` | `TEXT` | NOT NULL |  |
| `company` | `TEXT` | NOT NULL |  |
| `type` | `TEXT` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'prospect'` |
| `region` | `TEXT` | NULL |  |
| `country` | `TEXT` | NULL |  |
| `website` | `TEXT` | NULL |  |
| `description` | `TEXT` | NULL |  |
| `contract_value` | `DECIMAL(15,2)` | NULL |  |
| `contract_start` | `DATE` | NULL |  |
| `contract_end` | `DATE` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `production_live_date` | `DATE` | NULL |  |
| `go_live_date` | `DATE` | NULL |  |
| `revised_go_live_date` | `DATE` | NULL |  |
| `past_campaign_date` | `DATE` | NULL |  |
| `next_campaign_date` | `DATE` | NULL |  |
| `dependency` | `TEXT` | NULL |  |
| `comment` | `TEXT` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `owner_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `department` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE slug`, `sort_order`, `owner_id`, `department`

Referenced by (8): `crm_accounts.partner_id`, `deals.partner_id`, `partner_columns.partner_id`, `partner_contacts.partner_id`, `partner_members.partner_id`, `partner_tasks.partner_id`, `projects.partner_id`, `revenue_accounts.partner_id`

### `product_project_columns`

Prisma model `ProductProjectColumn` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `project_id` → `product_projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `key` | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `color` | `TEXT` | NOT NULL | `'bg-zinc-500'` |
| `sort_order` | `INTEGER` | NOT NULL | `0` |

Indexes: `project_id`, `UNIQUE project_id, key`

### `product_project_members`

Prisma model `ProductProjectMember` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `project_id` → `product_projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `role` | `TEXT` | NOT NULL | `'member'` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `UNIQUE project_id, user_id`

### `product_project_task_assignees`

Prisma model `ProductProjectTaskAssignee` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `task_id` → `product_project_tasks.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `allocation_pct` | `INTEGER` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `user_id`, `UNIQUE task_id, user_id`

### `product_project_task_comments`

Prisma model `ProductProjectTaskComment` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `task_id` → `product_project_tasks.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `author_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `body` | `TEXT` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `task_id`, `author_id`

### `product_project_tasks`

Prisma model `ProductProjectTask` · 13 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `project_id` → `product_projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `parent_task_id` → `product_project_tasks.id` (ON DELETE CASCADE) | `UUID` | NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'todo'` |
| `priority` | `TEXT` | NOT NULL | `'medium'` |
| `owner_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `start_date` | `DATE` | NULL |  |
| `end_date` | `DATE` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `project_id`, `parent_task_id`

Referenced by (3): `product_project_task_assignees.task_id`, `product_project_task_comments.task_id`, `product_project_tasks.parent_task_id`

### `product_projects`

Prisma model `ProductProject` · 22 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `slug` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'not_yet_started'` |
| `owner_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `start_date` | `DATE` | NULL |  |
| `end_date` | `DATE` | NULL |  |
| `production_live_date` | `DATE` | NULL |  |
| `go_live_date` | `DATE` | NULL |  |
| `revised_go_live_date` | `DATE` | NULL |  |
| `dependency` | `TEXT` | NULL |  |
| `comment` | `TEXT` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `department` | `TEXT` | NULL |  |
| `default_assignee_mode` | `TEXT` | NOT NULL | `'none'` |
| `default_assignee_id` | `UUID` | NULL |  |
| `reminders_sent` | `JSONB` | NOT NULL | `'[]'` |
| `last_reminder_sent_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |

Indexes: `UNIQUE slug`, `sort_order`, `department`, `archived_at`

Referenced by (3): `product_project_columns.project_id`, `product_project_members.project_id`, `product_project_tasks.project_id`

### `project_columns`

Prisma model `ProjectColumn` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `project_id` → `projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `key` | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `color` | `TEXT` | NOT NULL | `'bg-zinc-500'` |
| `sort_order` | `INTEGER` | NOT NULL | `0` |

Indexes: `project_id`, `UNIQUE project_id, key`

### `project_members`

Prisma model `ProjectMember` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `project_id` → `projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `role` | `TEXT` | NOT NULL | `'member'` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `UNIQUE project_id, user_id`

### `project_milestones`

Prisma model `ProjectMilestone` · 11 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `project_id` → `projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'not_started'` |
| `owner_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `start_date` | `DATE` | NULL |  |
| `end_date` | `DATE` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `project_id`

Referenced by (1): `project_tasks.milestone_id`

### `project_task_activities`

Prisma model `ProjectTaskActivity` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `task_id` → `project_tasks.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `actor_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `kind` | `TEXT` | NOT NULL |  |
| `field` | `TEXT` | NULL |  |
| `old_value` | `TEXT` | NULL |  |
| `new_value` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `task_id, created_at`

### `project_task_assignees`

Prisma model `ProjectTaskAssignee` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `task_id` → `project_tasks.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `allocation_pct` | `INTEGER` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `task_id`, `user_id`, `UNIQUE task_id, user_id`

### `project_task_comments`

Prisma model `ProjectTaskComment` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `task_id` → `project_tasks.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `author_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `body` | `TEXT` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `task_id`

### `project_task_dependencies`

Prisma model `ProjectTaskDependency` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `task_id` → `project_tasks.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `depends_on_task_id` → `project_tasks.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `type` | `TEXT` | NOT NULL | `'finish_to_start'` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `task_id`, `depends_on_task_id`, `UNIQUE task_id, depends_on_task_id`

### `project_task_resources`

Prisma model `ProjectTaskResource` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `task_id` → `project_tasks.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `kind` | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `url` | `TEXT` | NOT NULL |  |
| `doc_id` | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `created_by` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |

Indexes: `task_id`

### `project_tasks`

Prisma model `ProjectTask` · 16 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `project_id` → `projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `milestone_id` → `project_milestones.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `parent_task_id` → `project_tasks.id` (ON DELETE CASCADE) | `UUID` | NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'todo'` |
| `priority` | `TEXT` | NOT NULL | `'P1'` |
| `owner_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `start_date` | `DATE` | NULL |  |
| `end_date` | `DATE` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `reminders_sent` | `JSONB` | NOT NULL | `'[]'` |
| `last_reminder_sent_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `project_id`, `parent_task_id`, `milestone_id`

Referenced by (7): `project_task_activities.task_id`, `project_task_assignees.task_id`, `project_task_comments.task_id`, `project_task_dependencies.depends_on_task_id`, `project_task_dependencies.task_id`, `project_task_resources.task_id`, `project_tasks.parent_task_id`

### `project_workflow_emails`

Prisma model `ProjectWorkflowEmail` · 13 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `project_id` → `projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `transition_id` | `TEXT` | NULL |  |
| `stage` | `TEXT` | NOT NULL |  |
| `kind` | `TEXT` | NOT NULL |  |
| `recipient` | `TEXT` | NOT NULL |  |
| `subject` | `TEXT` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'pending'` |
| `attempts` | `INTEGER` | NOT NULL | `0` |
| `error` | `TEXT` | NULL |  |
| `idempotency_key` | `TEXT` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `sent_at` | `TIMESTAMPTZ(6)` | NULL |  |

Indexes: `UNIQUE idempotency_key`, `project_id, created_at`, `status`

### `project_workflow_transitions`

Prisma model `ProjectWorkflowTransition` · 7 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `project_id` → `projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `from_status` | `TEXT` | NULL |  |
| `to_status` | `TEXT` | NOT NULL |  |
| `actor_id` | `UUID` | NULL |  |
| `comment` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `project_id, created_at`

### `projects`

Prisma model `Project` · 38 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `slug` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'not_yet_started'` |
| `owner_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `partner_id` → `partners.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `start_date` | `DATE` | NULL |  |
| `end_date` | `DATE` | NULL |  |
| `budget` | `DECIMAL(15,2)` | NULL |  |
| `progress` | `INTEGER` | NOT NULL | `0` |
| `custom_fields` | `JSONB` | NOT NULL | `'[]'` |
| `production_live_date` | `DATE` | NULL |  |
| `go_live_date` | `DATE` | NULL |  |
| `revised_go_live_date` | `DATE` | NULL |  |
| `agreement` | `TEXT` | NULL |  |
| `dependency` | `TEXT` | NULL |  |
| `comment` | `TEXT` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `team` | `TEXT` | NOT NULL | `'general'` |
| `department` | `TEXT` | NULL |  |
| `departments` | `TEXT[]` | NULL | `ARRAY[]::TEXT[]` |
| `workstream` | `TEXT` | NULL |  |
| `details` | `TEXT` | NULL |  |
| `task_type` | `TEXT` | NULL |  |
| `assigned_team` | `TEXT` | NULL |  |
| `default_assignee_mode` | `TEXT` | NOT NULL | `'none'` |
| `default_assignee_id` | `UUID` | NULL |  |
| `reminders_sent` | `JSONB` | NOT NULL | `'[]'` |
| `last_reminder_sent_at` | `TIMESTAMP(3)` | NULL |  |
| `workflow_status` | `TEXT` | NULL |  |
| `workflow_updated_at` | `TIMESTAMPTZ(6)` | NULL |  |
| `escalated_to_id` | `UUID` | NULL |  |
| `current_step_order` | `INTEGER` | NULL |  |
| `priority` | `TEXT` | NULL |  |
| `archived_at` | `TIMESTAMPTZ(6)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE slug`, `sort_order`, `team`, `department`, `workflow_status`, `archived_at`

Referenced by (8): `approval_chain_decisions.project_id`, `project_columns.project_id`, `project_members.project_id`, `project_milestones.project_id`, `project_tasks.project_id`, `project_workflow_emails.project_id`, `project_workflow_transitions.project_id`, `proposals.project_id`

### `qa_project_columns`

Prisma model `QaProjectColumn` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `project_id` → `qa_projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `key` | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `color` | `TEXT` | NOT NULL | `'bg-zinc-500'` |
| `sort_order` | `INTEGER` | NOT NULL | `0` |

Indexes: `project_id`, `UNIQUE project_id, key`

### `qa_project_members`

Prisma model `QaProjectMember` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `project_id` → `qa_projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `role` | `TEXT` | NOT NULL | `'member'` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `UNIQUE project_id, user_id`

### `qa_project_task_assignees`

Prisma model `QaProjectTaskAssignee` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `task_id` → `qa_project_tasks.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `allocation_pct` | `INTEGER` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `user_id`, `UNIQUE task_id, user_id`

### `qa_project_task_comments`

Prisma model `QaProjectTaskComment` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `task_id` → `qa_project_tasks.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `author_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `body` | `TEXT` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `task_id`, `author_id`

### `qa_project_tasks`

Prisma model `QaProjectTask` · 23 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `project_id` → `qa_projects.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `parent_task_id` → `qa_project_tasks.id` (ON DELETE CASCADE) | `UUID` | NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'open'` |
| `priority` | `TEXT` | NOT NULL | `'P1'` |
| `owner_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `start_date` | `DATE` | NULL |  |
| `end_date` | `DATE` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `issue_date` | `DATE` | NULL |  |
| `partner` | `TEXT` | NULL |  |
| `product` | `TEXT` | NULL |  |
| `issue_type` | `TEXT` | NULL |  |
| `observation` | `TEXT` | NULL |  |
| `expectation` | `TEXT` | NULL |  |
| `eta` | `TEXT` | NULL |  |
| `qa_comment` | `TEXT` | NULL |  |
| `reminders_sent` | `JSONB` | NOT NULL | `'[]'` |
| `last_reminder_sent_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `project_id`, `parent_task_id`, `product`, `partner`, `priority`, `status`

Referenced by (3): `qa_project_task_assignees.task_id`, `qa_project_task_comments.task_id`, `qa_project_tasks.parent_task_id`

### `qa_projects`

Prisma model `QaProject` · 18 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `slug` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'active'` |
| `owner_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `start_date` | `DATE` | NULL |  |
| `end_date` | `DATE` | NULL |  |
| `comment` | `TEXT` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `department` | `TEXT` | NULL |  |
| `default_assignee_mode` | `TEXT` | NOT NULL | `'none'` |
| `default_assignee_id` | `UUID` | NULL |  |
| `reminders_sent` | `JSONB` | NOT NULL | `'[]'` |
| `last_reminder_sent_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |

Indexes: `UNIQUE slug`, `sort_order`, `department`, `archived_at`

Referenced by (3): `qa_project_columns.project_id`, `qa_project_members.project_id`, `qa_project_tasks.project_id`

### `room_bookings`

Prisma model `RoomBooking` · 11 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `room_id` → `meeting_rooms.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `date` | `DATE` | NOT NULL |  |
| `time_slot` | `TEXT` | NOT NULL |  |
| `end_time` | `TEXT` | NULL |  |
| `title` | `TEXT` | NULL |  |
| `description` | `TEXT` | NULL |  |
| `attendees_count` | `INTEGER` | NULL |  |
| `series_id` | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `room_id, date`, `series_id`

### `voucher_entries`

Prisma model `VoucherEntry` · 11 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL | `gen_random_uuid()` |
| `partner` | `VARCHAR(200)` | NOT NULL |  |
| `country` | `VARCHAR(120)` | NULL |  |
| `redeemed` | `INTEGER` | NOT NULL | `0` |
| `issued` | `INTEGER` | NOT NULL | `0` |
| `refund` | `INTEGER` | NOT NULL | `0` |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `added_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |

Indexes: `partner`, `archived_at`

## `performance` — Performance management & appraisals

Source: `packages/database/prisma/schema/performance.prisma`

### `appraisal_comments`

Prisma model `AppraisalComment` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `appraisal_id` → `appraisals.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `author_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `content` | `TEXT` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `appraisal_id`

### `appraisal_cycles`

Prisma model `AppraisalCycle` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `start_date` | `DATE` | NOT NULL |  |
| `end_date` | `DATE` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'draft'` |
| `created_by` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Referenced by (1): `appraisals.cycle_id`

### `appraisal_kras`

Prisma model `AppraisalKRA` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `appraisal_id` → `appraisals.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `kra_template_id` → `kra_templates.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `weight` | `INTEGER` | NOT NULL | `0` |
| `self_score` | `INTEGER` | NULL |  |
| `manager_score` | `INTEGER` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `appraisal_id`

### `appraisal_ratings`

Prisma model `AppraisalRating` · 7 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `appraisal_id` → `appraisals.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `rater_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `category` | `VARCHAR(50)` | NOT NULL |  |
| `score` | `INTEGER` | NOT NULL |  |
| `comment` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `appraisal_id`, `UNIQUE appraisal_id, rater_id, category`

### `appraisals`

Prisma model `Appraisal` · 13 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `cycle_id` → `appraisal_cycles.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `employee_id` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `manager_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'pending'` |
| `self_rating` | `INTEGER` | NULL |  |
| `self_comment` | `TEXT` | NULL |  |
| `manager_rating` | `INTEGER` | NULL |  |
| `manager_comment` | `TEXT` | NULL |  |
| `final_rating` | `INTEGER` | NULL |  |
| `completed_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `employee_id`, `manager_id`, `UNIQUE cycle_id, employee_id`

Referenced by (4): `appraisal_comments.appraisal_id`, `appraisal_kras.appraisal_id`, `appraisal_ratings.appraisal_id`, `goals.appraisal_id`

### `goals`

Prisma model `Goal` · 10 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `appraisal_id` → `appraisals.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `weight` | `INTEGER` | NOT NULL | `0` |
| `self_score` | `INTEGER` | NULL |  |
| `manager_score` | `INTEGER` | NULL |  |
| `status` | `TEXT` | NOT NULL | `'not_started'` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `appraisal_id`

### `kra_templates`

Prisma model `KRATemplate` · 6 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `department` | `TEXT` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Referenced by (1): `appraisal_kras.kra_template_id`

## `proposals` — Proposals (two-tier decision flow)

Source: `packages/database/prisma/schema/proposals.prisma`

### `proposal_emails`

Prisma model `ProposalEmail` · 12 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `proposal_id` → `proposals.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `kind` | `TEXT` | NOT NULL |  |
| `stage` | `TEXT` | NOT NULL |  |
| `recipient` | `TEXT` | NOT NULL |  |
| `subject` | `TEXT` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'pending'` |
| `attempts` | `INTEGER` | NOT NULL | `0` |
| `error` | `TEXT` | NULL |  |
| `idempotency_key` | `TEXT` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `sent_at` | `TIMESTAMPTZ(6)` | NULL |  |

Indexes: `UNIQUE idempotency_key`, `proposal_id, created_at`, `status`

### `proposal_information_requests`

Prisma model `ProposalInformationRequest` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `proposal_id` → `proposals.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `asked_by_id` | `UUID` | NOT NULL |  |
| `assigned_to_id` | `UUID` | NOT NULL |  |
| `raised_at_status` | `TEXT` | NOT NULL |  |
| `question` | `TEXT` | NOT NULL |  |
| `response` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `responded_at` | `TIMESTAMPTZ(6)` | NULL |  |

Indexes: `proposal_id, created_at`, `assigned_to_id, responded_at`

### `proposal_transitions`

Prisma model `ProposalTransition` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `proposal_id` → `proposals.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `from_status` | `TEXT` | NULL |  |
| `to_status` | `TEXT` | NOT NULL |  |
| `actor_id` | `UUID` | NULL |  |
| `choice` | `TEXT` | NULL |  |
| `comment` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `proposal_id, created_at`

### `proposals`

Prisma model `Proposal` · 12 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `title` | `TEXT` | NOT NULL |  |
| `description` | `TEXT` | NOT NULL |  |
| `type` | `TEXT` | NOT NULL | `'idea'` |
| `project_id` → `projects.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `priority` | `TEXT` | NULL |  |
| `raised_by_id` | `UUID` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'pending_pm_review'` |
| `status_changed_at` | `TIMESTAMPTZ(6)` | NULL |  |
| `current_step_order` | `INTEGER` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `status`, `raised_by_id`, `project_id`, `status, created_at`

Referenced by (4): `approval_chain_decisions.proposal_id`, `proposal_emails.proposal_id`, `proposal_information_requests.proposal_id`, `proposal_transitions.proposal_id`

## `rbac` — RBAC — roles, permissions, module access

Source: `packages/database/prisma/schema/rbac.prisma`

### `module_access`

Prisma model `ModuleAccess` · 5 columns · PK `(user_id, module_id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `user_id` 🔑 → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `module_id` 🔑 | `VARCHAR(50)` | NOT NULL |  |
| `granted` | `BOOLEAN` | NOT NULL | `true` |
| `granted_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `granted_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

### `module_owners`

Prisma model `ModuleOwner` · 2 columns · PK `(module_id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `module_id` 🔑 | `VARCHAR(50)` | NOT NULL |  |
| `owner_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |

### `role_permissions`

Prisma model `RolePermission` · 2 columns · PK `(role_id, permission_code)`

| Column | Type | Null | Default |
|---|---|---|---|
| `role_id` 🔑 → `roles.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `permission_code` 🔑 | `VARCHAR(100)` | NOT NULL |  |

### `roles`

Prisma model `Role` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL | `gen_random_uuid()` |
| `name` | `VARCHAR(50)` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `is_system` | `BOOLEAN` | NOT NULL | `false` |
| `default_route` | `VARCHAR(200)` | NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE name`

Referenced by (3): `role_permissions.role_id`, `user_entity_memberships.role_id`, `user_roles.role_id`

### `user_group_members`

Prisma model `UserGroupMember` · 4 columns · PK `(group_id, user_id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `group_id` 🔑 → `user_groups.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `user_id` 🔑 → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `added_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `added_by` | `UUID` | NULL |  |

### `user_groups`

Prisma model `UserGroup` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL | `gen_random_uuid()` |
| `name` | `VARCHAR(100)` | NOT NULL |  |
| `description` | `TEXT` | NULL |  |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `created_by` → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE name`

Referenced by (2): `legal_document_shares.group_id`, `user_group_members.group_id`

### `user_roles`

Prisma model `UserRole` · 4 columns · PK `(user_id, role_id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `user_id` 🔑 → `users.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `role_id` 🔑 → `roles.id` (ON DELETE CASCADE) | `UUID` | NOT NULL |  |
| `assigned_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `assigned_by` | `UUID` | NULL |  |

## `sales-crm` — Sales CRM

Source: `packages/database/prisma/schema/sales-crm.prisma`

### `crm_accounts`

Prisma model `Account` · 28 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `domain` | `TEXT` | NULL |  |
| `industry` | `TEXT` | NULL |  |
| `size` | `TEXT` | NULL |  |
| `country` | `TEXT` | NULL |  |
| `region` | `TEXT` | NULL |  |
| `website` | `TEXT` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `total_users` | `INTEGER` | NULL |  |
| `app_users` | `INTEGER` | NULL |  |
| `pic_name` | `TEXT` | NULL |  |
| `designation` | `TEXT` | NULL |  |
| `department` | `TEXT` | NULL |  |
| `last_follow_up_date` | `DATE` | NULL |  |
| `agreement_signed_date` | `DATE` | NULL |  |
| `engagement_type` | `TEXT` | NULL |  |
| `uat_start_date` | `DATE` | NULL |  |
| `uat_end_date` | `DATE` | NULL |  |
| `blocker` | `TEXT` | NULL |  |
| `remarks` | `TEXT` | NULL |  |
| `owner_id` → `users.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `partner_id` → `partners.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `business_units` | `TEXT[]` | NULL | `ARRAY[]::TEXT[]` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |

Indexes: `UNIQUE domain`, `owner_id`, `partner_id`, `name`, `sort_order`, `archived_at`

Referenced by (3): `crm_activities.account_id`, `crm_contacts.account_id`, `crm_opportunities.account_id`

### `crm_activities`

Prisma model `CrmActivity` · 13 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `type` | `TEXT` | NOT NULL |  |
| `subject` | `TEXT` | NOT NULL |  |
| `body` | `TEXT` | NULL |  |
| `occurred_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `duration_mins` | `INTEGER` | NULL |  |
| `owner_id` → `users.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `lead_id` → `crm_leads.id` (ON DELETE CASCADE) | `TEXT` | NULL |  |
| `opportunity_id` → `crm_opportunities.id` (ON DELETE CASCADE) | `TEXT` | NULL |  |
| `contact_id` → `crm_contacts.id` (ON DELETE CASCADE) | `TEXT` | NULL |  |
| `account_id` → `crm_accounts.id` (ON DELETE CASCADE) | `TEXT` | NULL |  |
| `external_ref` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `UNIQUE external_ref`, `lead_id`, `opportunity_id`, `contact_id`, `account_id`, `occurred_at`

### `crm_business_units`

Prisma model `CrmBusinessUnit` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `code` | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `color` | `TEXT` | NOT NULL | `'grey'` |
| `is_system` | `BOOLEAN` | NOT NULL | `false` |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `sort_order` | `INTEGER` | NOT NULL | `100` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE code`, `is_active, sort_order`

### `crm_contacts`

Prisma model `Contact` · 12 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `account_id` → `crm_accounts.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `first_name` | `TEXT` | NOT NULL |  |
| `last_name` | `TEXT` | NOT NULL |  |
| `email` | `TEXT` | NULL |  |
| `phone` | `TEXT` | NULL |  |
| `title` | `TEXT` | NULL |  |
| `is_primary` | `BOOLEAN` | NOT NULL | `false` |
| `notes` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |

Indexes: `account_id`, `email`, `archived_at`

Referenced by (2): `crm_activities.contact_id`, `crm_opportunities.contact_id`

### `crm_lead_sources`

Prisma model `LeadSource` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `code` | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `is_system` | `BOOLEAN` | NOT NULL | `false` |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `sort_order` | `INTEGER` | NOT NULL | `100` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE code`, `is_active, sort_order`

### `crm_leads`

Prisma model `Lead` · 19 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `company` | `TEXT` | NOT NULL |  |
| `legacy_deal_id` | `TEXT` | NULL |  |
| `first_name` | `TEXT` | NOT NULL |  |
| `last_name` | `TEXT` | NOT NULL |  |
| `email` | `TEXT` | NULL |  |
| `phone` | `TEXT` | NULL |  |
| `title` | `TEXT` | NULL |  |
| `source` | `TEXT` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'new'` |
| `owner_id` → `users.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `notes` | `TEXT` | NULL |  |
| `converted_opportunity_id` → `crm_opportunities.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `converted_at` | `TIMESTAMP(3)` | NULL |  |
| `disqualify_reason` | `TEXT` | NULL |  |
| `business_units` | `TEXT[]` | NULL | `ARRAY[]::TEXT[]` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |

Indexes: `UNIQUE legacy_deal_id`, `owner_id, status`, `source`, `archived_at`

Referenced by (2): `crm_activities.lead_id`, `crm_tasks.lead_id`

### `crm_lost_reasons`

Prisma model `LostReason` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `code` | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `is_system` | `BOOLEAN` | NOT NULL | `false` |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `sort_order` | `INTEGER` | NOT NULL | `100` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE code`, `is_active, sort_order`

### `crm_opportunities`

Prisma model `Opportunity` · 24 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `legacy_deal_id` | `TEXT` | NULL |  |
| `account_id` → `crm_accounts.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `contact_id` → `crm_contacts.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `stage` | `TEXT` | NOT NULL | `'qualified'` |
| `sort_order_within_stage` | `INTEGER` | NOT NULL | `0` |
| `value` | `DECIMAL(15,2)` | NOT NULL |  |
| `currency` | `TEXT` | NOT NULL | `'USD'` |
| `probability` | `INTEGER` | NOT NULL | `20` |
| `probability_custom` | `BOOLEAN` | NOT NULL | `false` |
| `close_date` | `DATE` | NULL |  |
| `launch_date` | `DATE` | NULL |  |
| `revenue_launch_date` | `DATE` | NULL |  |
| `type` | `TEXT` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `owner_id` → `users.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `lost_reason` | `TEXT` | NULL |  |
| `business_units` | `TEXT[]` | NULL | `ARRAY[]::TEXT[]` |
| `reminders_sent` | `JSONB` | NOT NULL | `'[]'` |
| `last_reminder_sent_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |

Indexes: `UNIQUE legacy_deal_id`, `stage`, `stage, sort_order_within_stage`, `owner_id, stage`, `account_id`, `close_date`, `archived_at`

Referenced by (4): `crm_activities.opportunity_id`, `crm_leads.converted_opportunity_id`, `crm_opportunity_business_units.opportunity_id`, `crm_tasks.opportunity_id`

### `crm_opportunity_business_units`

Prisma model `OpportunityBusinessUnit` · 16 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `opportunity_id` → `crm_opportunities.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `business_unit` | `TEXT` | NOT NULL |  |
| `stage` | `TEXT` | NOT NULL | `'qualified'` |
| `probability` | `INTEGER` | NOT NULL | `20` |
| `probability_custom` | `BOOLEAN` | NOT NULL | `false` |
| `value` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `close_date` | `DATE` | NULL |  |
| `launch_date` | `DATE` | NULL |  |
| `revenue_launch_date` | `DATE` | NULL |  |
| `lost_reason` | `TEXT` | NULL |  |
| `sort_order_within_stage` | `INTEGER` | NOT NULL | `0` |
| `reminders_sent` | `JSONB` | NOT NULL | `'[]'` |
| `last_reminder_sent_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `business_unit, stage`, `stage, sort_order_within_stage`, `UNIQUE opportunity_id, business_unit`

### `crm_settings`

Prisma model `CrmSettings` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `singleton` | `BOOLEAN` | NOT NULL | `true` |
| `notify_emails` | `TEXT[]` | NULL | `ARRAY[]::TEXT[]` |
| `notify_on_create` | `BOOLEAN` | NOT NULL | `true` |
| `notify_owner_on_create` | `BOOLEAN` | NOT NULL | `true` |
| `notify_owner_on_stage_change` | `BOOLEAN` | NOT NULL | `true` |
| `updated_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE singleton`

### `crm_tasks`

Prisma model `CrmTask` · 12 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `subject` | `TEXT` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'open'` |
| `due_date` | `DATE` | NOT NULL |  |
| `owner_id` → `users.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `opportunity_id` → `crm_opportunities.id` (ON DELETE CASCADE) | `TEXT` | NULL |  |
| `lead_id` → `crm_leads.id` (ON DELETE CASCADE) | `TEXT` | NULL |  |
| `completed_at` | `TIMESTAMP(3)` | NULL |  |
| `reminders_sent` | `JSONB` | NOT NULL | `'[]'` |
| `last_reminder_sent_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `owner_id, status, due_date`, `opportunity_id`, `lead_id`

### `opportunity_stage_config`

Prisma model `OpportunityStageConfig` · 6 columns · PK `(key)`

| Column | Type | Null | Default |
|---|---|---|---|
| `key` 🔑 | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `probability` | `INTEGER` | NOT NULL | `0` |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `color` | `TEXT` | NOT NULL | `'border-t-zinc-500'` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `sort_order`

## `sales-revenue-crm` — Sales Revenue CRM (mirror of Sales CRM)

Source: `packages/database/prisma/schema/sales-revenue-crm.prisma`

### `revenue_accounts`

Prisma model `RevenueAccount` · 28 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `domain` | `TEXT` | NULL |  |
| `industry` | `TEXT` | NULL |  |
| `size` | `TEXT` | NULL |  |
| `country` | `TEXT` | NULL |  |
| `region` | `TEXT` | NULL |  |
| `website` | `TEXT` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `total_users` | `INTEGER` | NULL |  |
| `app_users` | `INTEGER` | NULL |  |
| `pic_name` | `TEXT` | NULL |  |
| `designation` | `TEXT` | NULL |  |
| `department` | `TEXT` | NULL |  |
| `last_follow_up_date` | `DATE` | NULL |  |
| `agreement_signed_date` | `DATE` | NULL |  |
| `engagement_type` | `TEXT` | NULL |  |
| `uat_start_date` | `DATE` | NULL |  |
| `uat_end_date` | `DATE` | NULL |  |
| `blocker` | `TEXT` | NULL |  |
| `remarks` | `TEXT` | NULL |  |
| `owner_id` → `users.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `partner_id` → `partners.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `business_units` | `TEXT[]` | NULL | `ARRAY[]::TEXT[]` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |

Indexes: `UNIQUE domain`, `owner_id`, `partner_id`, `name`, `sort_order`, `archived_at`

Referenced by (3): `revenue_activities.account_id`, `revenue_contacts.account_id`, `revenue_opportunities.account_id`

### `revenue_activities`

Prisma model `RevenueActivity` · 13 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `type` | `TEXT` | NOT NULL |  |
| `subject` | `TEXT` | NOT NULL |  |
| `body` | `TEXT` | NULL |  |
| `occurred_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `duration_mins` | `INTEGER` | NULL |  |
| `owner_id` → `users.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `lead_id` → `revenue_leads.id` (ON DELETE CASCADE) | `TEXT` | NULL |  |
| `opportunity_id` → `revenue_opportunities.id` (ON DELETE CASCADE) | `TEXT` | NULL |  |
| `contact_id` → `revenue_contacts.id` (ON DELETE CASCADE) | `TEXT` | NULL |  |
| `account_id` → `revenue_accounts.id` (ON DELETE CASCADE) | `TEXT` | NULL |  |
| `external_ref` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `UNIQUE external_ref`, `lead_id`, `opportunity_id`, `contact_id`, `account_id`, `occurred_at`

### `revenue_contacts`

Prisma model `RevenueContact` · 12 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `account_id` → `revenue_accounts.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `first_name` | `TEXT` | NOT NULL |  |
| `last_name` | `TEXT` | NOT NULL |  |
| `email` | `TEXT` | NULL |  |
| `phone` | `TEXT` | NULL |  |
| `title` | `TEXT` | NULL |  |
| `is_primary` | `BOOLEAN` | NOT NULL | `false` |
| `notes` | `TEXT` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |

Indexes: `account_id`, `email`, `archived_at`

Referenced by (2): `revenue_activities.contact_id`, `revenue_opportunities.contact_id`

### `revenue_lead_sources`

Prisma model `RevenueLeadSource` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `code` | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `is_system` | `BOOLEAN` | NOT NULL | `false` |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `sort_order` | `INTEGER` | NOT NULL | `100` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE code`, `is_active, sort_order`

### `revenue_leads`

Prisma model `RevenueLead` · 19 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `company` | `TEXT` | NOT NULL |  |
| `legacy_deal_id` | `TEXT` | NULL |  |
| `first_name` | `TEXT` | NOT NULL |  |
| `last_name` | `TEXT` | NOT NULL |  |
| `email` | `TEXT` | NULL |  |
| `phone` | `TEXT` | NULL |  |
| `title` | `TEXT` | NULL |  |
| `source` | `TEXT` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'new'` |
| `owner_id` → `users.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `notes` | `TEXT` | NULL |  |
| `converted_opportunity_id` → `revenue_opportunities.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `converted_at` | `TIMESTAMP(3)` | NULL |  |
| `disqualify_reason` | `TEXT` | NULL |  |
| `business_units` | `TEXT[]` | NULL | `ARRAY[]::TEXT[]` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |

Indexes: `UNIQUE legacy_deal_id`, `owner_id, status`, `source`, `archived_at`

Referenced by (2): `revenue_activities.lead_id`, `revenue_tasks.lead_id`

### `revenue_lost_reasons`

Prisma model `RevenueLostReason` · 8 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `code` | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `is_system` | `BOOLEAN` | NOT NULL | `false` |
| `is_active` | `BOOLEAN` | NOT NULL | `true` |
| `sort_order` | `INTEGER` | NOT NULL | `100` |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE code`, `is_active, sort_order`

### `revenue_opportunities`

Prisma model `RevenueOpportunity` · 24 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `name` | `TEXT` | NOT NULL |  |
| `legacy_deal_id` | `TEXT` | NULL |  |
| `account_id` → `revenue_accounts.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `contact_id` → `revenue_contacts.id` (ON DELETE SET NULL) | `TEXT` | NULL |  |
| `stage` | `TEXT` | NOT NULL | `'qualified'` |
| `sort_order_within_stage` | `INTEGER` | NOT NULL | `0` |
| `value` | `DECIMAL(15,2)` | NOT NULL |  |
| `currency` | `TEXT` | NOT NULL | `'USD'` |
| `probability` | `INTEGER` | NOT NULL | `20` |
| `probability_custom` | `BOOLEAN` | NOT NULL | `false` |
| `close_date` | `DATE` | NULL |  |
| `launch_date` | `DATE` | NULL |  |
| `revenue_launch_date` | `DATE` | NULL |  |
| `type` | `TEXT` | NULL |  |
| `notes` | `TEXT` | NULL |  |
| `owner_id` → `users.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `lost_reason` | `TEXT` | NULL |  |
| `business_units` | `TEXT[]` | NULL | `ARRAY[]::TEXT[]` |
| `reminders_sent` | `JSONB` | NOT NULL | `'[]'` |
| `last_reminder_sent_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |
| `archived_at` | `TIMESTAMP(3)` | NULL |  |

Indexes: `UNIQUE legacy_deal_id`, `stage`, `stage, sort_order_within_stage`, `owner_id, stage`, `account_id`, `close_date`, `archived_at`

Referenced by (4): `revenue_activities.opportunity_id`, `revenue_leads.converted_opportunity_id`, `revenue_opportunity_business_units.opportunity_id`, `revenue_tasks.opportunity_id`

### `revenue_opportunity_business_units`

Prisma model `RevenueOpportunityBusinessUnit` · 16 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `opportunity_id` → `revenue_opportunities.id` (ON DELETE CASCADE) | `TEXT` | NOT NULL |  |
| `business_unit` | `TEXT` | NOT NULL |  |
| `stage` | `TEXT` | NOT NULL | `'qualified'` |
| `probability` | `INTEGER` | NOT NULL | `20` |
| `probability_custom` | `BOOLEAN` | NOT NULL | `false` |
| `value` | `DECIMAL(15,2)` | NOT NULL | `0` |
| `close_date` | `DATE` | NULL |  |
| `launch_date` | `DATE` | NULL |  |
| `revenue_launch_date` | `DATE` | NULL |  |
| `lost_reason` | `TEXT` | NULL |  |
| `sort_order_within_stage` | `INTEGER` | NOT NULL | `0` |
| `reminders_sent` | `JSONB` | NOT NULL | `'[]'` |
| `last_reminder_sent_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `business_unit, stage`, `stage, sort_order_within_stage`, `UNIQUE opportunity_id, business_unit`

### `revenue_settings`

Prisma model `RevenueSettings` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `singleton` | `BOOLEAN` | NOT NULL | `true` |
| `notify_emails` | `TEXT[]` | NULL | `ARRAY[]::TEXT[]` |
| `notify_on_create` | `BOOLEAN` | NOT NULL | `true` |
| `notify_owner_on_create` | `BOOLEAN` | NOT NULL | `true` |
| `notify_owner_on_stage_change` | `BOOLEAN` | NOT NULL | `true` |
| `updated_by` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `UNIQUE singleton`

### `revenue_stage_config`

Prisma model `RevenueStageConfig` · 6 columns · PK `(key)`

| Column | Type | Null | Default |
|---|---|---|---|
| `key` 🔑 | `TEXT` | NOT NULL |  |
| `label` | `TEXT` | NOT NULL |  |
| `probability` | `INTEGER` | NOT NULL | `0` |
| `sort_order` | `INTEGER` | NOT NULL | `0` |
| `color` | `TEXT` | NOT NULL | `'border-t-zinc-500'` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `sort_order`

### `revenue_tasks`

Prisma model `RevenueTask` · 12 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `TEXT` | NOT NULL |  |
| `subject` | `TEXT` | NOT NULL |  |
| `status` | `TEXT` | NOT NULL | `'open'` |
| `due_date` | `DATE` | NOT NULL |  |
| `owner_id` → `users.id` (ON DELETE RESTRICT) | `UUID` | NOT NULL |  |
| `opportunity_id` → `revenue_opportunities.id` (ON DELETE CASCADE) | `TEXT` | NULL |  |
| `lead_id` → `revenue_leads.id` (ON DELETE CASCADE) | `TEXT` | NULL |  |
| `completed_at` | `TIMESTAMP(3)` | NULL |  |
| `reminders_sent` | `JSONB` | NOT NULL | `'[]'` |
| `last_reminder_sent_at` | `TIMESTAMP(3)` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

Indexes: `owner_id, status, due_date`, `opportunity_id`, `lead_id`

## `system` — System settings, feature config, telemetry

Source: `packages/database/prisma/schema/system.prisma`

### `audit_log`

Prisma model `AuditLog` · 9 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `user_id` → `users.id` (ON DELETE SET NULL) | `UUID` | NULL |  |
| `action` | `TEXT` | NOT NULL |  |
| `resource` | `TEXT` | NOT NULL |  |
| `resource_id` | `TEXT` | NULL |  |
| `details` | `JSONB` | NULL |  |
| `ip_address` | `TEXT` | NULL |  |
| `user_agent` | `TEXT` | NULL |  |
| `timestamp` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `timestamp DESC`, `user_id`, `resource, resource_id`

### `file_uploads`

Prisma model `FileUpload` · 14 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `filename` | `TEXT` | NOT NULL |  |
| `original_name` | `TEXT` | NOT NULL |  |
| `mime_type` | `TEXT` | NOT NULL |  |
| `size` | `INTEGER` | NOT NULL |  |
| `path` | `TEXT` | NOT NULL |  |
| `bucket` | `TEXT` | NULL |  |
| `uploaded_by` | `UUID` | NOT NULL |  |
| `purpose` | `TEXT` | NULL |  |
| `linked_to` | `TEXT` | NULL |  |
| `linked_id` | `TEXT` | NULL |  |
| `deleted_at` | `TIMESTAMP(3)` | NULL |  |
| `deleted_by` | `UUID` | NULL |  |
| `created_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `uploaded_by`, `linked_to, linked_id`

### `storage_snapshots`

Prisma model `StorageSnapshot` · 5 columns · PK `(id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` 🔑 | `UUID` | NOT NULL |  |
| `bucket` | `VARCHAR(100)` | NOT NULL |  |
| `bytes` | `BIGINT` | NOT NULL |  |
| `object_count` | `INTEGER` | NOT NULL |  |
| `captured_at` | `TIMESTAMP(3)` | NOT NULL | `CURRENT_TIMESTAMP` |

Indexes: `captured_at DESC`, `bucket, captured_at DESC`

### `system_settings`

Prisma model `SystemSetting` · 3 columns · PK `(key)`

| Column | Type | Null | Default |
|---|---|---|---|
| `key` 🔑 | `VARCHAR(100)` | NOT NULL |  |
| `value` | `JSONB` | NOT NULL |  |
| `updated_at` | `TIMESTAMP(3)` | NOT NULL |  |

### `user_settings`

Prisma model `UserSetting` · 3 columns · PK `(user_id, key)`

| Column | Type | Null | Default |
|---|---|---|---|
| `user_id` 🔑 | `UUID` | NOT NULL |  |
| `key` 🔑 | `VARCHAR(50)` | NOT NULL |  |
| `value` | `JSONB` | NOT NULL |  |

