# Analytics Platform — PRD & Architecture

**Status:** Draft v1 — pending stakeholder approval
**Owner:** GoGoCash team
**Last updated:** 2026-05-04
**Target release:** v2.0.0

---

## 1. Goal

Give every workspace member a single Analytics surface that aggregates real-time data from **Facebook, Instagram, Threads, TikTok, LINE Voom, and the GoGoCash internal user base** — and uses AI to produce strategic recommendations the team can act on.

Workspace members should consume Analytics without re-authenticating to any platform. The workspace Owner connects each integration once; everyone in the workspace reads the aggregated data and AI insights.

### Success metrics (post-launch)

- Workspace owner connects all 6 platforms in **< 10 minutes** from one settings page
- Members access Analytics with **zero additional logins**
- Weekly AI strategy ships every Sunday with **3–5 concrete recommendations** per workspace
- Real-time anomaly alerts surface within **15 minutes** of detection
- Monthly AI cost stays under **$100/workspace** (hard cap, alert at 80%)
- Dashboard P95 load time **< 2 s**

---

## 2. Scope

### In scope (v1)

- Workspace-level OAuth connections for: Facebook, Instagram, Threads, TikTok, LINE Voom
- GoGoCash internal user-base ingestion (Postgres-direct)
- Real-time webhook ingestion where supported, polling fallback elsewhere
- Normalized event store + pre-aggregated metrics (hourly / daily / weekly buckets)
- AI Strategist with 4 prompt classes (weekly strategy, hourly trends, content recommendation, anomaly alerts)
- New top-level **Analytics** workspace module: Overview dashboard, per-platform deep-dive views, AI insights timeline, Connections settings
- Workspace AI cost meter with hard cap and 80 % alert
- Single permission tier — every workspace member sees everything

### Out of scope (v1, may revisit)

- Per-user OAuth (e.g. each member connects their own IG)
- Posting / publishing to any platform — read-only ingestion only
- Custom dashboard builder (we ship fixed templates)
- Cross-workspace analytics or benchmarking
- Historical backfill beyond what each platform's API serves by default
- Multi-language insights (English only in v1)
- Native mobile views (web responsive only)
- Vector / semantic search over events

### Explicitly deferred

- TikTok features that require Research API access — fall back to Display API if partner status is delayed

---

## 3. Users & permissions

**Single permission tier.** If you can see the workspace, you can see Analytics — same model as workspace docs.

| Role             | Can connect platforms | Can view dashboards | Can run on-demand AI       | Can see cost meter |
| ---------------- | --------------------- | ------------------- | -------------------------- | ------------------ |
| Workspace Owner  | ✅                    | ✅                  | ✅                         | ✅                 |
| Workspace Admin  | ✅                    | ✅                  | ✅                         | ✅                 |
| Workspace Member | ❌                    | ✅                  | ✅ (counts against budget) | ❌                 |

Disconnecting a platform requires Owner-only confirmation (R1 — affects whole workspace).

---

## 4. Architecture overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                              Frontend                                   │
│   packages/frontend/core/src/modules/analytics/                         │
│                                                                         │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│   │   Overview   │  │  Per-platform│  │  AI Insights │  │ Connections│ │
│   │   dashboard  │  │  deep-dive   │  │   timeline   │  │  settings  │ │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
│          └──────────────────┴───── GraphQL ──┴────────────────┘        │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                          WebSocket  │  GraphQL
                          (insights) │  (queries)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                              Backend                                    │
│   packages/backend/server/src/plugins/analytics/                        │
│                                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────┐ │
│  │ connections/ │ │   ingest/    │ │ aggregator/  │ │      ai/       │ │
│  │  OAuth +     │ │  webhooks +  │ │  Bull cron → │ │  Strategist    │ │
│  │  KMS tokens  │ │   pollers    │ │  rollups     │ │  + budget      │ │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └────────┬───────┘ │
│         │                │                │                  │         │
│         └────────────────┴── normalizer ──┴──────────────────┘         │
│                                  │                                      │
│                                  ▼                                      │
│             social_connections │ social_events │ social_metrics         │
│             social_insights    │ social_ai_budget                       │
└─────────────────────────────────────────────────────────────────────────┘
        ▲                                                ▲
        │ webhooks (signed)                              │ Vertex AI
        │                                                │ (existing
   ┌────┴────────────────────────────────────────┐       │  copilot
   │  Meta │ TikTok │ LINE │ Threads │ GoGoCash  │       │  providers)
   └─────────────────────────────────────────────┘       │
                                                Gemini 2.5 Flash + Claude Sonnet 4.5
```

### Backend module structure

```
packages/backend/server/src/plugins/analytics/
├── analytics.module.ts
├── connections/
│   ├── connection.entity.ts
│   ├── connection.service.ts          # encrypted token CRUD + audit log
│   ├── connection.resolver.ts         # GraphQL
│   ├── token-store.ts                 # KMS wrapper
│   └── oauth/
│       ├── meta.oauth.ts              # FB / IG / Threads (one Meta app)
│       ├── tiktok.oauth.ts
│       └── line.oauth.ts
├── ingest/
│   ├── webhooks/
│   │   ├── meta.controller.ts         # POST /api/integrations/meta/webhook
│   │   ├── tiktok.controller.ts       # POST /api/integrations/tiktok/webhook
│   │   └── line.controller.ts         # POST /api/integrations/line/webhook
│   ├── polling/
│   │   ├── meta.poller.ts
│   │   ├── threads.poller.ts          # webhook support thin → poll-first
│   │   ├── tiktok.poller.ts
│   │   ├── line.poller.ts
│   │   └── gogocash.poller.ts         # internal Postgres
│   └── ingestion.service.ts           # dedup + normalize + write
├── normalizer/
│   ├── event.schema.ts                # SocialEvent type
│   └── platform-mappers/              # one per platform
├── aggregator/
│   ├── metric.entity.ts
│   ├── hourly-rollup.cron.ts
│   ├── daily-rollup.cron.ts
│   └── weekly-rollup.cron.ts
├── ai/
│   ├── strategist.service.ts          # weekly + on-demand
│   ├── trend-detector.service.ts      # hourly cron
│   ├── anomaly-detector.service.ts    # threshold-triggered
│   ├── insight.entity.ts
│   ├── budget.service.ts              # soft + hard caps
│   └── prompts/                       # references to prompts.ts entries
└── graphql/
    ├── analytics.resolver.ts
    └── analytics.dto.ts
```

### Frontend module structure (per [CLAUDE.md §5b](../CLAUDE.md))

```
packages/frontend/core/src/modules/analytics/
├── analytics.module.ts
├── entities/
│   ├── analytics-data.entity.ts
│   ├── platform-connection.entity.ts
│   └── insight.entity.ts
├── services/
│   ├── analytics.service.ts
│   └── connection.service.ts
├── views/
│   ├── analytics-overview/            # default landing
│   ├── platform-page/                 # /workspace/:id/analytics/:platform
│   ├── ai-strategist/                 # insights timeline
│   └── connections-settings/          # OAuth flows + token status
└── components/
    ├── metric-card/
    ├── trend-chart/
    ├── insight-card/
    └── connection-status-badge/
```

### Top-level nav wiring (three-step dance — required, easy to miss)

1. **Route map** — register `analytics` route in `packages/frontend/core/src/desktop/pages/workspace/`
2. **Sidebar entry** — add Analytics item in `WorkspaceSidebar` with icon + active-state highlight
3. **View component** — wire route to `analytics-overview` view as default landing

---

## 5. Data model

### Prisma schema additions

```prisma
enum SocialPlatform {
  FACEBOOK
  INSTAGRAM
  THREADS
  TIKTOK
  LINE_VOOM
  GOGOCASH
}

enum ConnectionStatus { ACTIVE PAUSED EXPIRED ERROR }
enum MetricBucket    { HOUR DAY WEEK }
enum InsightType     { WEEKLY_STRATEGY TREND ANOMALY RECOMMENDATION }
enum InsightSeverity { INFO NOTABLE ACTION_REQUIRED }

model SocialConnection {
  id                  String           @id @default(uuid())
  workspaceId         String
  platform            SocialPlatform
  status              ConnectionStatus @default(ACTIVE)
  accessTokenEnc      String           @db.Text         // KMS-encrypted
  refreshTokenEnc     String?          @db.Text
  scopes              String[]
  externalAccountId   String                            // FB page id, IG biz acct, etc.
  externalAccountName String
  connectedByUserId   String
  expiresAt           DateTime?
  lastSyncAt          DateTime?
  lastErrorAt         DateTime?
  lastError           String?
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  workspace           Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  connectedBy         User             @relation(fields: [connectedByUserId], references: [id])

  @@unique([workspaceId, platform, externalAccountId])
  @@index([workspaceId])
  @@index([status, expiresAt])         // refresh job
}

model SocialEvent {
  id          String         @id @default(uuid())
  workspaceId String
  connectionId String
  platform    SocialPlatform
  eventType   String                                    // post.created, comment.added, …
  externalId  String                                    // platform's id, used for dedup
  occurredAt  DateTime
  receivedAt  DateTime       @default(now())
  payload     Json                                      // normalized fields
  raw         Json                                      // original webhook / API payload

  @@unique([connectionId, externalId, eventType])
  @@index([workspaceId, occurredAt])
  @@index([workspaceId, platform, eventType, occurredAt])
}

model SocialMetric {
  id          String         @id @default(uuid())
  workspaceId String
  platform    SocialPlatform
  metricKey   String                                    // followers, engagement_rate, reach, …
  bucket      MetricBucket
  bucketStart DateTime
  value       Float
  metadata    Json?

  @@unique([workspaceId, platform, metricKey, bucket, bucketStart])
  @@index([workspaceId, platform, bucket, bucketStart])
}

model SocialInsight {
  id              String          @id @default(uuid())
  workspaceId     String
  insightType     InsightType
  platforms       SocialPlatform[]
  title           String
  body            String          @db.Text             // markdown
  severity        InsightSeverity
  modelUsed       String                               // "gemini-2.5-flash" | "claude-sonnet-4.5"
  costUsd         Float
  createdAt       DateTime        @default(now())
  acknowledgedAt  DateTime?
  acknowledgedById String?

  @@index([workspaceId, createdAt])
  @@index([workspaceId, insightType, createdAt])
}

model SocialAiBudget {
  id          String   @id @default(uuid())
  workspaceId String
  monthYear   String                                    // "2026-05"
  spentUsd    Float    @default(0)
  capUsd      Float    @default(100)
  alertSent   Boolean  @default(false)

  @@unique([workspaceId, monthYear])
}
```

### Migration

`packages/backend/server/src/data/migrations/<timestamp>-analytics-platform.ts` — idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) per [CLAUDE.md §4](../CLAUDE.md).

---

## 6. Auth & token security

### OAuth flow (workspace-level)

1. Owner clicks **Connect Facebook** in Analytics → Connections
2. Redirect to Meta with `state = signed({workspaceId, userId, nonce, returnUrl})` and our callback URL
3. Callback exchanges code → short-lived token → long-lived token
4. Token encrypted via GCP KMS, stored in `SocialConnection`
5. Refresh token (where available) stored encrypted; refresh cron runs daily

### Token storage requirements

- **Encryption at rest**: GCP KMS keyring `affine-495114/gogocash-keyring/analytics-tokens`
- **Audit log**: every token decryption writes a row to `social_audit_logs` (`SocialAuditLog` model). The upstream codebase has no general-purpose audit log facility, so we ship a feature-scoped one. Fields: workspace, user, platform, timestamp, request id. Never log the token itself.
- **Scoped IAM**: only the analytics module's service account can `cloudkms.cryptoKeyVersions.useToDecrypt`. Backend dev sessions cannot.
- **Rotation**: daily Bull cron refreshes long-lived tokens before expiry; alert workspace owner on refresh failure
- **No token-in-logs**: server-wide log scrubber regex must include known token prefixes (`EAA…` for Meta, `act…` for TikTok, etc.)

### Webhook signature verification (mandatory, fail-closed)

| Platform             | Header                | Algorithm                       |
| -------------------- | --------------------- | ------------------------------- |
| Meta (FB/IG/Threads) | `X-Hub-Signature-256` | HMAC-SHA256 with app secret     |
| TikTok               | `X-Tt-Signature`      | HMAC-SHA256                     |
| LINE                 | `X-Line-Signature`    | HMAC-SHA256 with channel secret |

Webhook controllers MUST reject unsigned or bad-signed requests with **401**, with no body details. Log the rejection (no request body) and rate-limit the source.

---

## 7. AI strategy & budget

### Models — reuse the existing copilot stack

Per [CLAUDE.md §5d](../CLAUDE.md), Vertex Gemini and Claude are already wired via `getGoogleAuth`. **No new providers needed.**

| Use                    | Model               | Why                                         |
| ---------------------- | ------------------- | ------------------------------------------- |
| Weekly Strategy        | `claude-sonnet-4.5` | Deeper reasoning + cross-platform synthesis |
| Hourly Trends          | `gemini-2.5-flash`  | Cheap, fast                                 |
| Content Recommendation | `gemini-2.5-flash`  | Latency-sensitive, on-demand                |
| Anomaly Alert          | `gemini-2.5-flash`  | Quick classification                        |

### Prompts (added to `prompts.ts` per [§5c four-step dance](../CLAUDE.md))

#### `Analytics: Weekly Strategy`

- Model: `claude-sonnet-4.5`
- Schedule: Sundays 06:00 workspace timezone
- Input: 7 days of metrics + top 20 events per platform (~30 K tokens, summarized)
- Output: 1500-token markdown — exec summary, per-platform observations, 3–5 recommended actions

#### `Analytics: Trend Detection`

- Model: `gemini-2.5-flash`
- Schedule: hourly cron
- Input: last 24 h of metrics + 7-day baseline deltas (~5 K tokens)
- Output: 500-token markdown — emits insight only when meaningful trend detected

#### `Analytics: Content Recommendation`

- Model: `gemini-2.5-flash`
- Trigger: user clicks "Suggest content"
- Input: top-performing posts (last 30 d) + user tone preferences (~3 K tokens)
- Output: 3 content ideas with rationale

#### `Analytics: Anomaly Alert`

- Model: `gemini-2.5-flash`
- Trigger: real-time when metric crosses threshold (z-score > 3 vs 30-day mean)
- Input: spiking metric + recent context (~3 K tokens)
- Output: 200-token explanation + suggested action, severity flag

All four follow the four-step dance: edit `prompts.ts` → rebuild server bundle → wire frontend caller → rebuild image + deploy.

### Cost math (per workspace, monthly)

Pricing (Vertex Model Garden, May 2026 rates):

- `gemini-2.5-flash`: $0.075/M input, $0.30/M output
- `claude-sonnet-4.5`: $3/M input, $15/M output

| Job                    | Calls/mo | Tokens (in / out) | Cost/mo       |
| ---------------------- | -------- | ----------------- | ------------- |
| Weekly Strategy        | 4        | 30 K / 1.5 K      | $0.45         |
| Trend Detection        | 720      | 5 K / 0.3 K       | $0.34         |
| Content Recommendation | ~50      | 2 K / 0.5 K       | $0.02         |
| Anomaly Alerts         | ~50      | 3 K / 0.2 K       | $0.02         |
| **Total**              |          |                   | **~$0.85/mo** |

Even with 10× safety margin for spikes / retries / future prompt growth, **well under $10/workspace/month**. The $100 cap is a runaway-prevention guardrail, not a real constraint.

### Budget enforcement

- Every AI call records `costUsd` on `SocialInsight` and increments `SocialAiBudget.spentUsd`
- **Soft cap (80 % = $80)** — notification to workspace owner via existing notification system
- **Hard cap (100 % = $100)** — analytics returns "AI budget exceeded for this month — contact admin" instead of running prompts. Cron jobs skip until next month.
- Reset on the 1st of each calendar month (UTC) — new `SocialAiBudget` row created lazily on first call

---

## 8. Platform-specific notes

### Facebook (Pages API)

- **Connect**: Meta OAuth scopes `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `read_insights`
- **Real-time**: Page subscription webhooks (`feed`, `mention`, `messages`)
- **Polling**: `/{page-id}/insights` for page_views, impressions
- **Approval**: Meta App Review + Business Verification (1–3 weeks)

### Instagram (Business / Creator only via Meta)

- **Connect**: same Meta OAuth, scopes `instagram_basic`, `instagram_manage_insights`, `pages_show_list`
- **Real-time**: webhooks for `comments`, `mentions`, `story_insights`
- **Polling**: `/{ig-user-id}/insights` for follower count, reach
- **Constraint**: only Business/Creator IG accounts work — block personal accounts in UI with clear message

### Threads

- **Connect**: separate OAuth on the Threads API
- **Real-time**: webhook support thin as of v1 — poll-first, webhook-augment if available
- **Polling**: `/me/threads`, `/me/threads_insights`

### TikTok

- **Connect**: TikTok for Developers OAuth — scopes depend on partner tier
- **Real-time**: only `video.upload.failed` is emitted publicly. `video.upload` / `video.publish` are partner-only. Treat publish as a polling concern, not a webhook concern, in v1.
- **Polling**: `/v2/video/list/` (Display API) for publish detection at ~15 min cadence. `/v2/research/video/query/` for deep analytics (Research API, partner-gated).
- **Constraint**: free Display API has ~10 fields. If partner approval is delayed, we ship "post visibility only" and mark deeper analytics as "pending API access" in UI. UI must label TikTok metric freshness as "near real-time (15 min)".

### LINE Voom

- **Connect**: LINE Messaging API channel OAuth
- **Real-time**: webhooks for `message`, `follow`, `unfollow`, `postback`
- **Polling**: LINE Insight API for impressions, reach (Voom-specific data may be limited by Official Account tier)
- **Constraint**: confirm with LINE Thailand whether GoGoCash's LINE OA tier supports Voom analytics before promising it in v1

### GoGoCash internal

- **Connect**: no-op — uses workspace context
- **Real-time**: Postgres LISTEN/NOTIFY on `users` + `workspaces` tables (or 5-minute Bull cron if LISTEN/NOTIFY not feasible)
- **Polling**: standard Prisma queries
- **Metrics**: signups, DAU/MAU, transactions (if relevant table exists), churn, workspace creation rate

---

## 9. Phased delivery plan

### Phase 0 — Approval prep (parallel with Phase 1, day 1)

- File Meta App Review (FB + IG + Threads, single Meta app)
- Apply for TikTok Developer partner status
- Open / verify LINE Developers channel for Voom
- Confirm GCP KMS keyring exists in `affine-495114`; create if missing
- **Duration**: 1–3 weeks calendar (mostly waiting on approvals)

### Phase 1 — Foundation (week 1, no external blockers)

- Prisma schema + idempotent migration
- KMS-backed token store + audit log
- Backend `analytics.module.ts` scaffolding
- Frontend `analytics` module + nav wiring (top-level Analytics item)
- GoGoCash internal poller + first dashboard cards
- Cost meter (`SocialAiBudget` + budget service, even though no AI yet)
- E2E: connect dummy GoGoCash → see metrics on overview

### Phase 2 — LINE + AI Strategist (week 2)

- LINE OAuth + webhook + poller
- All 4 AI prompts wired (`prompts.ts` + four-step dance)
- AI insight UI (timeline + dashboard cards)
- Cost meter exercised
- E2E: weekly strategy generates from GoGoCash + LINE data

### Phase 3 — Meta family (week 3–4, gated on Meta approval)

- Single Meta OAuth flow, three platforms behind it (FB, IG, Threads)
- Webhook controller with signature verification
- Per-platform deep-dive views
- E2E: post on FB → event surfaces in Analytics within 60 s

### Phase 4 — TikTok (week 5, gated on partner status)

- TikTok OAuth + webhook + poller
- Display-API fallback if partner status delayed
- E2E: TikTok video event flows through

### Phase 5 — Polish (week 6)

- Insight acknowledgment + action tracking
- Budget alerts (80 % notification + 100 % hard stop)
- Performance pass: dashboard P95 < 2 s
- Onboarding tour
- Docs: `docs/analytics-platform.md` user-facing companion

**Total: ~6 weeks of engineering, gated primarily on platform approvals.**

---

## 10. Risks & mitigations

| #   | Risk                                                                                                                                                                                                         | Likelihood | Impact   | Mitigation                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Meta App Review rejected                                                                                                                                                                                     | Medium     | Critical | Submit Phase 0 day 1; have policy URL + privacy doc + 2 test users ready; allow 2 review cycles in plan                                                                                                                                                     |
| 2   | TikTok partner status denied                                                                                                                                                                                 | High       | Major    | Display API fallback in v1; "Coming soon" tile for deep analytics; resubmit quarterly                                                                                                                                                                       |
| 3   | LINE Voom metrics too thin                                                                                                                                                                                   | Medium     | Major    | Confirm with LINE Thailand BEFORE building; fall back to Messaging API surface metrics                                                                                                                                                                      |
| 4   | Token leak                                                                                                                                                                                                   | Low        | Critical | KMS encryption, audit log, scoped IAM, log scrubber, rotation                                                                                                                                                                                               |
| 5   | AI runaway costs                                                                                                                                                                                             | Low        | Major    | Soft + hard budget caps, daily cost monitoring, per-call cost recorded                                                                                                                                                                                      |
| 6   | Webhook flood (DDoS / runaway)                                                                                                                                                                               | Medium     | Major    | Per-connection rate limit at controller, queue drain throttle, Sentry alert on backlog > 1000                                                                                                                                                               |
| 7   | Schema migration breaks prod                                                                                                                                                                                 | Low        | Critical | Idempotent migrations, backup before deploy, feature flag for rollback                                                                                                                                                                                      |
| 8   | Cross-tenant data leak                                                                                                                                                                                       | Low        | Critical | Workspace-scoped queries enforced at resolver layer; integration test with multi-workspace fixture                                                                                                                                                          |
| 9   | Stale tokens silently fail                                                                                                                                                                                   | High       | Minor    | Daily refresh cron, alert on expiry < 7 d, status badge in UI                                                                                                                                                                                               |
| 10  | Vendor API breaking change                                                                                                                                                                                   | Medium     | Minor    | Per-platform contract tests, error.code-bucketed Sentry alerts, kill-switch per platform                                                                                                                                                                    |
| 11  | Sub-agent edits dropped during multi-agent dev                                                                                                                                                               | Medium     | Major    | Per [CLAUDE.md §5 lessons](../CLAUDE.md): each agent owns disjoint files, parent verifies wiring with `git diff` before commit                                                                                                                              |
| 12  | **TikTok publish webhook does not exist** for non-partner apps. Only `video.upload.failed` is emitted publicly. PRD §8 originally implied real-time `video.publish` events; reality is partner-status-gated. | High       | Major    | Phase 4 ships polling-first against `/v2/video/list/`; webhook augmentation only after partner status. UI labels TikTok metrics "near real-time (15 min)" not "real-time".                                                                                  |
| 13  | **Meta data-deletion endpoint is mandatory** before App Review submission. Either a callback URL or instructions URL must be configured. PRD originally missed this.                                         | Certain    | Critical | Phase 0 must register an instructions URL (lower-effort flavor) before the review submission. Callback URL flavor is a Phase 5 polish item. See [analytics-approvals.md](./analytics-approvals.md) §1.                                                      |
| 14  | **Meta `pages_manage_metadata`** may fail least-privilege review since we only use it to subscribe to webhooks, not mutate page metadata.                                                                    | Medium     | Major    | If rejected, fall back to polling-only Meta integration and break the < 60 s real-time target documented in §9 Phase 3. Submit with explicit justification ("required for webhook subscription only — no metadata writes performed; happy to demonstrate"). |

---

## 11. Verification & rollback

### Verification (per [CLAUDE.md §3](../CLAUDE.md))

Backend:

- [ ] `yarn tsc --noEmit` clean across `@affine/server`
- [ ] `yarn ava packages/backend/server/src/plugins/analytics/__tests__` passes
- [ ] `yarn prisma generate` clean
- [ ] Migration applies idempotently to local Postgres
- [ ] Webhook controllers reject unsigned requests (security test)

Frontend:

- [ ] `tsc --noEmit` clean for `@affine/core` and `@affine/web`
- [ ] `yarn affine bundle -p web` succeeds (no compiled-with-errors)
- [ ] `affine bundle -p admin` and `-p mobile` clean if reachable

Integration / smoke:

- [ ] `/browse` smoke: open Analytics → connect dummy GoGoCash → see metrics
- [ ] Webhook signature verification rejects unsigned
- [ ] Budget cap triggers at $80 (notification) and $100 (hard stop)
- [ ] Multi-workspace test: workspace A's data never appears in workspace B's queries

### Rollback

**Feature flag**: `ENABLE_ANALYTICS_MODULE` env var, default `false` initially. Disable to hide nav and pause cron jobs without redeploying.

**Image rollback**: standard 60-second compose swap per [CLAUDE.md §3 Rollback path](../CLAUDE.md).

**DB rollback**: all `social_*` tables are additive — no upstream tables touched. If we need to nuke, ship a follow-up migration with `DROP TABLE IF EXISTS`. No data lost in upstream tables.

---

## 12. Open questions (need answers before / during build)

1. **Meta app status** — does GoGoCash already have a Meta app? If yes, App ID + Business Verification status. If no, who owns creating it?
2. **LINE channel** — do we have a LINE Official Account + Messaging API channel? Voom-eligible tier confirmed?
3. **TikTok credentials** — any existing TikTok for Developers app, or starting from zero?
4. **Workspace timezone** — used for "Sunday 06:00" cron. Stored on `Workspace`? If not, default UTC + admin override.
5. **Cost cap UX** — when budget exceeded: (a) silently stop AI, (b) email admin, (c) banner in UI. **Currently designed as (b) + (c).** Confirm.
6. **Insights retention** — how long do we keep `SocialEvent` rows? Default 90 days? Workspace setting? GDPR considerations.
7. **Notification channel** — do we use AFFiNE's existing in-app notification system, or also email? In-app default; email opt-in.

---

## 14. Future work

These items were intentionally deferred from the integration round (Round D).
They are tracked here so the next round can pick them up without re-discovery.

### Live insight transport for `insightCreated` — Done via SSE

`runContentRecommendation`, trend detection, and anomaly detection now publish
workspace-scoped insight events through the existing authenticated SSE pattern:
`/api/workspace/:workspaceId/analytics/insights-stream`. The frontend
`AnalyticsService.subscribeToInsights` consumes that stream, parses only typed
`insight` frames, and de-dupes in `InsightEntity.addInsightToTop`.

GraphQL `@Subscription` transport is still not configured on Apollo; if the app
later standardizes on `graphql-ws`, this SSE endpoint can be replaced by an
`insightCreated(workspaceId)` subscription with the same payload shape.

### Metrics listing — Done

`listMetrics` now reads from `social_metrics` instead of returning a placeholder 500. It enforces `Workspace.Read`, rejects empty/reversed time windows with a
typed user-facing error, filters by workspace/platform/bucket/time range, sorts
by `bucketStart` then `metricKey`, and caps responses at 5000 rows until a
cursor-based pagination contract is added.

### Metric rollups — Done

`MetricRollupService` now owns the scheduled aggregation path. The hourly cron
backfills HOUR rows from numeric `social_events.payload.metrics` and follower
gain/loss events, the daily cron aggregates HOUR rows into DAY rows, and the
weekly cron aggregates DAY rows into WEEK rows. All writes use the existing
`social_metrics` unique key, so reruns rewrite the same bucket instead of
duplicating metrics.

### Pick-account UX after Meta OAuth — Done

The callback can now post `analytics:oauth:choose-account` to the opener, the
Connections settings view renders an account picker modal, and the frontend
finalizes or cancels the pending OAuth session via GraphQL mutations.

### IngestionService → AnomalyDetectorService wiring — Done

`IngestionService.normalizeAndStore` now persists normalized events, extracts
conservative metric writes, and best-effort calls
`AnomalyDetectorService.checkMetric` after each metric write.

### Token refresh cron — Done

`connections/refresh.cron.ts` runs daily, selects ACTIVE connections expiring
within the refresh window, routes Meta/TikTok/LINE refreshes through the
platform OAuth services, persists rotated tokens, and marks refresh failures as
`EXPIRED` with audit logs.

### LINE channel-mode correction — Done for v1 channel credentials

The v1 LINE path now validates the LINE Login OAuth code, then persists the
configured Messaging API channel token/id as the workspace `SocialConnection`.
Webhook ingestion resolves connections by LINE webhook `destination` first, then
falls back to the legacy source user/group/room id for older rows. Keep
VOOM-specific claims behind the LINE Thailand confirmation.

---

## 13. References

- [CLAUDE.md §1 — Sub-agent spawning](../CLAUDE.md)
- [CLAUDE.md §2 — Plan template](../CLAUDE.md)
- [CLAUDE.md §3 — Testing checklist](../CLAUDE.md)
- [CLAUDE.md §5b — Settings dialog wiring](../CLAUDE.md)
- [CLAUDE.md §5c — AI / Copilot prompts four-step dance](../CLAUDE.md)
- [CLAUDE.md §5d — Vertex Model Garden providers + auto-routing](../CLAUDE.md)
- Meta Graph API: https://developers.facebook.com/docs/graph-api/
- TikTok for Developers: https://developers.tiktok.com/
- LINE Messaging API: https://developers.line.biz/en/docs/messaging-api/
- Threads API: https://developers.facebook.com/docs/threads/
