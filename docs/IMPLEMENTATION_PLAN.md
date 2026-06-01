# Manut AI agent platform + Gen Z UX — concrete implementation plan

## Context

The 2026-05-19 session pivoted from "fix the deploy pipeline" → "make Manut the AI workspace that intelligent Gen Z (MIT / HBS / top-tech grads) actually want to use." User flagged that the current sidebar feels overwhelming, AI is buried, and visuals feel generic. Reference patterns (from screenshots shared this session): Notion's `⌘J` floating chat + Atlassian's tool-using agent with app connectors.

This plan captures **20+ decisions made with user 2026-05-19** and translates them into a concrete 12-week build broken into weekly slices, each shippable as its own PR.

---

## Delivery snapshot (2026-05-20)

The plan was developed on `feat/manut-wave2-cloud` via parallel sub-agent orchestration. All 12 waves landed on a single PR ([#121](https://github.com/mygogocash/Manut/pull/121)) as 28 commits, 229 files changed, +25,313 / −1,737 lines.

| Wave | Bundle / Epic                                                  | Status                                                    | Commit                             |
| ---- | -------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------- |
| 1    | B2 Landing terms+privacy+copy                                  | open PRs #117 + #118                                      | (separate PRs, file-disjoint)      |
| 1    | B4 Sidebar Phase 1 utility footer                              | open PR #116                                              | (separate PR, file-disjoint)       |
| 1    | B5 Design tokens refresh                                       | open PRs #119 + #120 + landed on `feat/theme-tokens-genz` | (separate branch, multiple phases) |
| 2    | B1.1 i18n strip self-host                                      | ✅                                                        | `6348e68d2`                        |
| 2    | B1.2 Remove self-host auth code                                | ✅                                                        | `46df31e54`                        |
| 2    | B1.3 Free + Pro tier quota                                     | ✅                                                        | `3182886dc`                        |
| 3    | B6 Floating AI chat ⌘J                                         | ✅                                                        | `9e37a769d`                        |
| 3    | B3 Welcome route + first-time WS                               | ✅                                                        | `0f2b5e5b1`                        |
| 4    | B7 Memory MVP (pgvector + Vertex)                              | ✅                                                        | `eb92e4b53`                        |
| 4    | B8 Mode + tool UX hybrid                                       | ✅                                                        | `54a708cfe`                        |
| 5    | B11 Sidebar Phase 2 (tabs + customize)                         | ✅                                                        | `5035f3a6b`                        |
| 5    | B10 Gmail + Calendar AI tools                                  | ✅                                                        | `1bbf388ec`                        |
| 5    | B9 P1 tools (web_search via Exa + memory_search + tabs_browse) | deferred — exa-search.ts already covered web              | (existing)                         |
| 6    | B12 Quick actions + format selector                            | ✅                                                        | `88f0393e3`                        |
| 6    | B14 AI budget cap (migration)                                  | ✅                                                        | `0827c3e32`                        |
| 6    | B14 AI budget service + integration                            | ✅                                                        | `3a615e858`                        |
| 6    | B13 SSE → WebSocket transport (flag-gated)                     | ✅                                                        | `51e9e9ae3`                        |
| 7    | E2.1 GitHub connector scaffold                                 | ✅ (graceful w/o OAuth)                                   | `ef4be3157`                        |
| 7    | E2.2 Memory UI "What AI knows about me"                        | ✅                                                        | `c2383313c`                        |
| 7    | E2.3 Cmd+K Notion-style search modal                           | ✅                                                        | `4075c5f65`                        |
| 8    | E2.4 👍/👎 feedback + weekly distill cron                      | ✅                                                        | `7bb062db9`                        |
| 8    | E2.5 Tabbed multi-chat + pinned context                        | ✅                                                        | `540080814`                        |
| 8    | E2.6 Inline AI ⌘. mini-chat                                    | ✅                                                        | `d6454cb84`                        |
| 9    | E2.7 Visual polish (Framer / skeletons / cursor)               | ✅                                                        | `ebd9fbde3`                        |
| 9    | E2.8 Power-user shortcuts + audio cues                         | ✅                                                        | `c9b26122b`                        |
| 9    | E2.9 AI onboarding 4-question wizard                           | ✅                                                        | `4b00bb8e2`                        |
| 10   | E3.1 Code-run tool (Modal scaffold)                            | ✅ (graceful w/o token)                                   | `8d8eba118`                        |
| 10   | E3.2 Image-gen tool (Vertex Imagen)                            | ✅                                                        | `22680ab01`                        |
| 10   | E3.4 Brand polish (404 + loading + /manifesto)                 | ✅                                                        | `9ecb0f02c`                        |
| 11   | E3.3 Stripe Pro tier scaffold                                  | ✅ (graceful w/o keys)                                    | `8addcbb23`                        |
| 12   | E3.5 Mixpanel telemetry events                                 | ✅                                                        | `1e4497caf`                        |
| 12   | E3.6 Launch prep — E2E + runbook + checklist                   | ✅                                                        | `62f503c38`                        |

### Migrations landed (5 idempotent, run in order)

```
20260520000000_add_mn_agent_memory_embedding
20260520010000_add_mn_ai_budget_usage
20260520020000_add_pinned_doc_id_to_chat_histories
20260520030000_add_user_completed_onboarding
20260520040000_add_workspace_plan
```

### External-secret degradation matrix

Every feature gates gracefully on its secret being unset. Operators can populate one at a time after merge.

| Env var                                                               | Affects                                      | Behavior without it                           |
| --------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------- |
| `EXA_API_KEY`                                                         | `web_search` tool (existing `exa-search.ts`) | tool returns "configure" error                |
| `MODAL_API_TOKEN`                                                     | `code_run` tool                              | tool returns "configure" error                |
| `STRIPE_SECRET_KEY` + `STRIPE_PRO_PRICE_ID` + `STRIPE_WEBHOOK_SECRET` | Pro upgrade                                  | `/upgrade` page renders `FailedToCheckout`    |
| `MIXPANEL_TOKEN`                                                      | telemetry                                    | events no-op silently via `@affine/track`     |
| `GITHUB_OAUTH_CLIENT_ID` + `SECRET`                                   | GitHub connector                             | Connect button surfaces "configure"           |
| `GOOGLE_OAUTH_CLIENT_ID` + `SECRET`                                   | Gmail / Calendar                             | tools return "not connected" until user OAuth |

### What ships docs alongside

- `docs/MANUT_DEPLOY_RUNBOOK.md` — 10-section production deploy runbook
- `docs/MANUT_LAUNCH_CHECKLIST.md` — 11 readiness gates
- `docs/MANUT_LAUNCH_COMMS_TEMPLATE.md` — Twitter / HN / email / blog templates

### Operational items remaining (not code)

- Populate the 6 secret sets above as features go live
- Apply 5 migrations to staging then prod (use the runbook order)
- Run the 7-spec Playwright E2E suite once branch is deployed (`tests/affine-cloud/e2e/manut/`)
- Land Wave 1 PRs (#116 sidebar / #117 landing copy / #118 terms+privacy / #119+#120 design tokens) — file-disjoint from this PR
- Set up Mixpanel dashboard for the wired events
- Schedule launch per `MANUT_LAUNCH_COMMS_TEMPLATE.md` T-24h → T+24h timeline
- Manual `/browse` verification of the 5 smoke-test flows (E2E specs assert backend wires; modal mount needs a parent consumer wiring follow-up)

### Deviations from the plan worth noting

- **B9 P1 tools** (`web_search` / `memory_search` / `tabs_browse`) folded into existing surfaces: web search already shipped via `exa-search.ts` + `exa-crawl.ts`; memory is injected per chat turn through `ChatRequestInterceptorService` with `toolsConfig.memory=false` as a request-level opt-out; cross-doc reads are covered by `doc-read` and `doc-hybrid-search`. Dedicated named tools are nice-to-have, not blocking.
- **Token-by-token AI streaming typewriter** declined in E2.7: SSE deltas already arrive at typewriter cadence; layering a JS interval on top would conflict with tool-call / reasoning block rendering. Shipped the visual signal (blinking violet cursor) instead.
- **SSE deletion** deferred per decision #23 dual-write window — WS lands in `51e9e9ae3` flag-gated; SSE path stays for 30 days before removal.
- **`lib/` is gitignored** in this repo. Two parallel agents (E2.7 `motion.ts`, B8 `modes.ts`) initially wrote to `lib/` and the files weren't picked up by git. Moved to `utils/` in both cases; documented in commit messages. Future agents must avoid `lib/`.
- **Chat-session auto-ingest of memories** (one-liner at `copilot/controller.ts:329`) deferred to ship with the feedback chip follow-up. Memory injection on read works; auto-write of OBSERVATION memories on each turn doesn't yet fire.
- **Pin-toggle mutation surface** in E2.5 tabbed chat: pin glyph reflects state but doesn't toggle on click. Requires a popover or right-click menu — deferred to a small next-slice PR.
- **StorageCapModal + AiBudgetModal** components exist and are tested at the backend layer but aren't yet rendered by a parent consumer. Modal mount wiring lands in a follow-up; backend error envelope (`STORAGE_CAP` / `AI_BUDGET`) is in place.
- **HTTP 402 vs 413** for quota errors: HTTP status stays at 402 (shared GraphQL `quota_exceeded` class). Promoting to 413 per the plan is a separate R1 deferred.
- **Reminder rules are now live enough for v1 scheduling.** The UI, GraphQL
  CRUD, and minute-cron materialization path exist. The cron evaluates enabled
  DATETIME rules, creates one scheduled reminder per matching rule/minute, and
  uses `MnReminderRun.dedupeKey` to avoid duplicate reminders. Current backend
  enum supports `EMAIL` only; the rule modal hides unsupported channels until a
  migration intentionally expands `MnNotificationChannel`.

---

## Decisions locked

| #   | Decision                              | Locked value                                                                                                                                                                                                              |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | **Product model**                     | **Multi-tenant cloud SaaS.** Single brand "Manut". Self-host code paths removed; anyone wanting self-host can fork the OSS repo.                                                                                          |
| 1   | Timeline                              | **3 months** — full Part A + Part B                                                                                                                                                                                       |
| 2   | First connector beyond Gmail+Calendar | **GitHub only** (Slack/Atlassian/Notion deferred)                                                                                                                                                                         |
| 3   | Floating chat vs `/chat` route        | **Floating is THE chat surface.** `/chat` URL still works (deep links) but opens the floating panel — Intelligence page retired.                                                                                          |
| 4   | Visual identity                       | **Extend manut-landing palette** (warm neutrals + violet accent) + Geist Sans + Instrument Serif                                                                                                                          |
| 5   | Memory scope                          | **Per-user + per-workspace, with toggle.** User has "What AI knows about me" page to edit.                                                                                                                                |
| 6   | AI infra stack                        | **Lean: Exa (web search) + pgvector (memory) + Vertex (embeddings + models)**                                                                                                                                             |
| 7   | Cost ceiling                          | **Configurable per workspace, default $50/mo soft cap.** Hard cap configurable, default 4× soft.                                                                                                                          |
| 8   | Chat panel UX                         | **Slide in from right + auto-switch context on page nav** (Notion behavior). User can pin to lock context.                                                                                                                |
| 9   | AI personality + default model        | **Friendly + smart, `gemini-2.5-flash` default.** Auto-router escalates to Pro/Sonnet on complex tasks.                                                                                                                   |
| 10  | Tool toggle UX                        | **Hybrid: Modes (Read/Edit/Agent) for quick start + Advanced toggle for per-tool checkboxes**                                                                                                                             |
| 11  | Sidebar rollout                       | **Phase 1 utility footer ships Week 1.** AIChatButton stays in rail.                                                                                                                                                      |
| 12  | Memory retention                      | **Forever by default.** No weekly digest. User pin/forget per memory.                                                                                                                                                     |
| 13  | P2 tools                              | **Both code-run (Modal) + image-gen (Vertex Imagen) by Month 3**                                                                                                                                                          |
| 14  | Motion + theme + sound                | **Framer Motion + dark mode default + subtle opt-in sound** (4-5 audio cues, off by default)                                                                                                                              |
| 15  | Multi-chat + quick actions            | **Tabbed multiple chats + auto-detected quick actions per doc-type**                                                                                                                                                      |
| 16  | Existing routes' fate                 | **Demote Graph + Analytics to Cmd+K + retire Intelligence page.** Single chat surface.                                                                                                                                    |
| 17  | Onboarding                            | **AI-led setup wizard ships Week 4-6** (during M1 wrap or early M2). No "what's new" tour for existing users (changelog handles it).                                                                                      |
| 18  | Rollout discipline                    | **Direct ship to all users + standard telemetry** (Mixpanel). No staged %. Manual rollback via flag toggle.                                                                                                               |
| 19  | Business model                        | **Pro tier ships Month 3 at $20/user/mo.** Lifts AI cap + gates memory + connectors. Free tier remains fully functional within the cap. (Self-host is OSS-fork territory only — not a product tier.)                      |
| 20  | Settings + rate limit                 | **Settings in user-avatar menu.** Per-workspace AI rate limit at $50 cap (single mechanism).                                                                                                                              |
| 21  | Iconography                           | **Keep BlockSuite + Lucide hybrid.** Brand via typography + color + motion.                                                                                                                                               |
| 22  | Feature flags                         | **Extend existing FeatureFlagService.** Manual rollback via flag toggle. No auto-rollback.                                                                                                                                |
| 23  | Streaming infra                       | **Migrate SSE → WebSocket** for richer bi-directional state (memory push, tool progress).                                                                                                                                 |
| 24  | Self-host fate                        | **Fully cloud-only.** Remove all self-host code paths (`ServerDeploymentType.Selfhosted` branches, `env.selfhosted` quota uplift, `selfhostLoginVersionGuard`, "Manut SelfHosted Cloud" labels). OSS users fork the repo. |
| 25  | Sign-up gating                        | **Open public sign-up immediately.** Anyone with Google or email can sign up.                                                                                                                                             |
| 26  | Free tier limits                      | **Unlimited members + 2 GB storage + $5 AI/mo.** Viral-growth shape: free teams in, paid storage + AI.                                                                                                                    |
| 27  | Cloud conversion timing               | **Week 1** alongside utility footer + design tokens. Foundational — must precede AI work + Pro tier.                                                                                                                      |

---

## Part 0 — Cloud conversion (Week 1, foundational)

Convert Manut from AFFiNE-self-host-fork → multi-tenant cloud SaaS. Decisions #0, #24-27.

### 0.1 Strip self-host labels (i18n)

Audit `packages/frontend/i18n/src/resources/en.json` + locale siblings for any string matching `/self.?host/i`. Replacements:

| Today                                               | After                                        |
| --------------------------------------------------- | -------------------------------------------- |
| `"Manut SelfHosted Cloud"`                          | `"Manut Cloud"` (or drop "Cloud" altogether) |
| `"Self host"`                                       | (remove)                                     |
| `"Add self-hosted server"`                          | (remove the option)                          |
| `"Self-hosted server"`                              | (remove the badge)                           |
| `"Delete your account from Manut SelfHosted Cloud"` | `"Delete your account from Manut"`           |

Touch: every locale file under `packages/frontend/i18n/src/resources/` (en.json + ~20 translations). Strategy: sed-ish replacement, then manual review of 5-10 strings that need human rephrasing.

### 0.2 Remove self-host code paths

| File                                                                                    | Change                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/frontend/core/src/components/sign-in/sign-in.tsx`                             | Remove `selfhostLoginVersionGuard` check, `useSelfhostLoginVersionGuard` hook usage, `isSelfhosted` conditional render, `addSelfhosted` step + Back component, `LocalWorkspaceIcon` "skip to local" path. Whole `initStep === 'addSelfhosted'` flow gone. |
| `packages/frontend/core/src/components/sign-in/index.tsx`                               | Remove `'addSelfhosted'` from `SignInState['step']` union and the rendering branch                                                                                                                                                                        |
| `packages/frontend/core/src/components/sign-in/add-self-hosted.tsx`                     | Delete file entirely                                                                                                                                                                                                                                      |
| `packages/backend/server/src/core/quota/service.ts`                                     | Remove `env.selfhosted` branch that uplifts `memberLimit: 100_000`. Replace with the Free-tier defaults below.                                                                                                                                            |
| `packages/backend/server/src/core/config/`                                              | Hardcode `ServerDeploymentType.Affine` (the cloud variant). Stop reading from `selfhosted` env.                                                                                                                                                           |
| `packages/frontend/i18n/src/i18n.gen.ts`                                                | Auto-regen after key removals (codegen)                                                                                                                                                                                                                   |
| `packages/frontend/component/src/components/affine-other-page-layout/use-nav-config.ts` | Already updated (PR #113). Re-verify no "self-host" mentions remain                                                                                                                                                                                       |

### 0.3 Quota Free tier

New quota config in `packages/backend/server/src/core/quota/service.ts`:

```ts
const FREE_TIER = {
  memberLimit: Number.MAX_SAFE_INTEGER, // unlimited per decision #26
  storageBytes: 2 * 1024 * 1024 * 1024, // 2 GB
  aiBudgetUsdCents: 500, // $5/mo
};

const PRO_TIER = {
  // shipped Month 3, decision #19
  memberLimit: Number.MAX_SAFE_INTEGER,
  storageBytes: 100 * 1024 * 1024 * 1024, // 100 GB
  aiBudgetUsdCents: 5000, // $50/mo, configurable up to $200
};
```

Storage enforcement: block uploads when workspace storage > cap; friendly modal "You've used 2 GB. Upgrade to Pro for 100 GB."

### 0.4 Public sign-up + workspace creation

AFFiNE already supports public sign-up. Verify:

- No invite-only flag is set on prod
- Signup form accepts any email
- After signup, user lands on workspace creation
- Workspace creation works for non-admin users

New onboarding flow:

1. User signs up → email/Google OAuth completes
2. Redirect to `/welcome` (new route in router.tsx)
3. Welcome screen: "Let's create your first workspace" → simple form (name only)
4. POST → `/workspace/{wsId}/all` lands on populated workspace
5. Workspace has 1 starter "Getting Started" doc generated from a template

Files:

- New: `packages/frontend/core/src/desktop/pages/welcome/index.tsx`
- Modified: `packages/frontend/core/src/desktop/router.tsx` (add `/welcome` route)
- Modified: `packages/frontend/core/src/desktop/pages/auth/sign-in.tsx` (`handleAuthenticated` redirects to `/welcome` for new users, `/workspace/...` for returning users — based on `user.workspaces.length`)

### 0.5 Terms + Privacy pages

The sign-in form already references `manut.xyz/terms` and `manut.xyz/privacy`. Currently 404.

Create on manut-landing (same pattern as PR #113's about-us/contact-us/blog):

- `manut-landing/app/terms/page.tsx`
- `manut-landing/app/privacy/page.tsx`

Reuse SiteNav + SiteFooter + Reveal pattern. Content: placeholder ToS + Privacy Policy (legal-reviewable later). Add to `manut-landing/app/sitemap.ts`.

### 0.6 Landing copy audit

Files: `manut-landing/components/sections/{hero,features,pricing,faq,open-source,cta}.tsx`

Audit for "self-host" mentions:

- Hero kicker / sub-headline — currently mentions "self-host or cloud"; reframe to "Start free in 30 seconds. Scale on demand."
- Pricing section — current "Free self-host" tier becomes "Free forever (cloud)"
- Open-source section — keep ("MIT-licensed, fork the repo") but recast as "Built in the open" rather than "Self-host yourself"
- FAQ — remove "How do I self-host?" question, add "How do I get started?" instead

### 0.7 Verification

| Check           | Pass condition                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| String audit    | `grep -ri "self.?host" packages/frontend/i18n/src/resources/en.json` → 0 results                      |
| Sign-up flow    | Brand new email → /welcome → workspace creation → /workspace/{id}/all                                 |
| Quota           | `quotaService.getWorkspaceQuota(newWorkspaceId)` returns Free tier defaults                           |
| Routes          | `/terms`, `/privacy`, `/about-us`, `/contact-us`, `/blog` all return 200 with content (not SPA shell) |
| Sign-in popover | "Manut SelfHosted Cloud" string gone; reads "Manut Cloud" or just "Manut"                             |
| Server config   | `ServerService.server.config$` reports `deploymentType: 'Affine'` not `'Selfhosted'`                  |

---

## Part A — AI agent platform (build details)

### A1. Tool-using agent

Backend tools live in `packages/backend/server/src/plugins/copilot/tools/`. **Existing (already shipped):** `doc-read`, `doc-edit`, `doc-create`, `doc-update`, `doc-update-meta`, `data-view-filter`, `data-view-autofill-column`, `doc-hybrid-search`, `doc-keyword-search`, `doc-semantic-search`.

**New P1 tools (Weeks 2-3):**

- `web_search.ts` — Exa API wrapper. Env: `EXA_API_KEY`. Returns top 5 results with snippets + citations.
- `memory_search.ts` — kNN query against `mn_agent_memories.embedding`. Scoped to (user_id, workspace_id) with toggle for cross-workspace.
- `tabs_browse.ts` — read content from another doc the user has open. Wraps `DocService.getDocContent(docId)`.

**P2 tools (Month 3):**

- `code_run.ts` — Modal sandbox. Env: `MODAL_API_TOKEN`. Returns stdout + stderr + exit code.
- `image_gen.ts` — Vertex Imagen via existing auth path. Reuses `getGoogleAuth` from `copilot/providers/utils.ts`.

**Mode + tool UX (hybrid pattern, decision #10):**

- Modes select preset tool collections:
  - **Read** → `doc-read`, `doc-hybrid-search`, `doc-keyword-search`, `doc-semantic-search`, `web_search`, `memory_search`
  - **Edit** → Read tools + `doc-edit`, `data-view-filter`
  - **Agent** → Edit tools + `doc-create`, `doc-update`, `data-view-autofill-column`, `code_run`, `image_gen`, `tabs_browse`
- Advanced toggle (caret in chat input header) reveals per-tool checkboxes for fine-tune

**Files to touch:**

- New: `packages/backend/server/src/plugins/copilot/tools/{web_search,memory_search,tabs_browse,code_run,image_gen}.ts`
- Modified: `packages/backend/server/src/plugins/copilot/tools/index.ts` (register new tools)
- Modified: `packages/frontend/core/src/blocksuite/ai/components/ai-chat-input/preference-popup.ts` (add mode + advanced toggle)

### A2. GitHub connector (decision #2)

Reuses the connections plugin pattern (`packages/backend/server/src/plugins/connections/`).

**Files to add (Week 5):**

- `packages/backend/server/src/plugins/github-oauth/github-oauth.module.ts`
- `packages/backend/server/src/plugins/github-oauth/github-oauth.service.ts` — OAuth flow, token refresh, scope `read:user repo`
- `packages/backend/server/src/plugins/github-oauth/github-oauth.resolver.ts` — GraphQL: `githubConnection`, `connectGithub` mutation
- `packages/backend/server/src/plugins/copilot/tools/github.ts` — exposes `github_search_issues`, `github_read_issue`, `github_search_repos`, `github_read_pr` as AI tools

Env required: `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`. Add to Railway via `set_variables` mutation.

### A3. Memory system (decision #5 + #6 + #12)

**Migration (Week 2):**

- New migration `<timestamp>_add_mn_agent_memory_embedding/migration.sql`:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ALTER TABLE "mn_agent_memories" ADD COLUMN IF NOT EXISTS "embedding" vector(768);
  CREATE INDEX IF NOT EXISTS "mn_agent_memories_embedding_idx" ON "mn_agent_memories" USING ivfflat ("embedding" vector_cosine_ops);
  ALTER TABLE "mn_agent_memories" ADD COLUMN IF NOT EXISTS "scope" varchar NOT NULL DEFAULT 'user';
  ALTER TABLE "mn_agent_memories" ADD COLUMN IF NOT EXISTS "pinned" boolean NOT NULL DEFAULT false;
  ```
  Scope enum: `user | workspace`. Idempotent guards (same pattern as our recent migrations).

**Services (Week 2-3):**

- `packages/backend/server/src/plugins/copilot/memory/embed.service.ts` — Vertex `textembedding-gecko@003`, 768-dim
- `packages/backend/server/src/plugins/copilot/memory/ingest.service.ts` — write FACT/DECISION/OBSERVATION/PLAYBOOK after AI runs
- `packages/backend/server/src/plugins/copilot/memory/retrieve.service.ts` — kNN top-5 by user_id+workspace_id scope
- `packages/backend/server/src/plugins/copilot/memory/system-prompt.ts` — inject memory snippets into system prompt

**Frontend (Week 3):**

- New "Memory" page in workspace settings: `packages/frontend/core/src/desktop/dialogs/setting/account-setting/memory-panel.tsx`
- Per-memory: pin / forget / promote to workspace scope buttons
- GraphQL: `myMemories(workspaceId)`, `pinMemory(id)`, `forgetMemory(id)`

### A4. Self-evolution (Week 7)

- **👍👎 feedback per message** — frontend chip below each AI reply. Mutation `rateMessage(messageId, rating)`. Stored as `OBSERVATION` memory with tag `feedback:positive|negative`.
- **Weekly distillation cron** — `packages/backend/server/src/plugins/copilot/evolution/distill.cron.ts` runs Sunday 00:00 UTC. For each workspace with feedback, asks an LLM to summarize patterns into a `PLAYBOOK` memory. Replaces old playbook if it exists.
- **Playbook injection** — `system-prompt.ts` always injects the latest `PLAYBOOK` memory verbatim into the system prompt for that workspace.

### A5. Structured outputs (Week 4)

Adds format selector chip to chat input. Maps format → system prompt suffix:

- `List` → markdown list
- `Table` → markdown table
- `Code` → fenced code block of the language they're working in (auto-detected from current doc context)
- `Image` → calls `image_gen` tool
- `Text` (default) → markdown

Files: `packages/frontend/core/src/blocksuite/ai/utils/format-prompt.ts` (new), `ai-chat-input/format-selector.ts` (new).

### A6. Quick actions per doc-type (Week 4)

Templates in new `packages/frontend/core/src/blocksuite/ai/quick-actions/templates.ts`. Keyed by `BlockType` from BlockSuite. Surfaced in floating chat empty state.

| Doc type                       | Actions                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `affine:page` (markdown doc)   | Summarize, Translate, Outline, Continue writing              |
| `affine:database`              | Suggest filters, Generate column, Analyze trends, Make chart |
| `affine:edgeless` (whiteboard) | Cluster shapes, Generate flowchart, Add labels               |
| `mn:meeting`                   | Extract action items, Draft follow-up, Suggest next meeting  |
| Code block selected            | Explain, Refactor, Test, Translate to language               |

---

## Part B — Gen Z UX (build details)

### B1. Design language (decision #4 + #14 + #21)

**Week 1 — design tokens refresh:**

- Extend `packages/frontend/core/src/styles/theme.css` with manut-landing tokens (warm neutrals, violet accent, soft surfaces #fafaf2 / #0e0e10)
- Adopt Geist Sans (already in landing) + Instrument Serif for display
- Radius scale: 4 / 8 / 12 / 24 (replace existing sharp corners on cards)
- Spacing scale: 12 / 20 / 32 (Gen Z prefers air over density)
- Dark mode is default (per decision #14)

**Week 6-8 — motion + sound:**

- Add Framer Motion as dep (`yarn workspace @affine/core add framer-motion`)
- Spring presets in `lib/motion.ts`: `gentle`, `wobbly`, `tight`
- Stagger entrance on lists (30ms apart)
- Sound: 4 audio cues (message-sent, ai-complete, connection-success, error) loaded lazily via Web Audio. Toggle in settings. Off by default.

### B2. Floating AI chat (decision #3 + #8 + #15)

**Week 1 — v1:**

- New `packages/frontend/core/src/components/floating-ai-chat-anchor/index.tsx`
- Mount in workbench layout (renders for every authenticated page)
- Bottom-right floating button, ⌘J keyboard binding (global)
- Slide-in panel from right edge
- Reuses existing `blocksuite/ai/components/ai-chat-input` + `ai-chat-messages`
- Auto-injects current doc context via new `useCurrentDocContext` hook
- Feature flag: `flags.floating_ai_chat`

**Week 7 — tabbed multi-chat:**

- Add chat tabs at top of panel
- Each chat is `{ id, title, pinnedDocId | null, messages }`
- Pin chip locks context; otherwise context auto-switches on nav
- Persist via existing `aiChatHistories` table (extend with `pinned_doc_id` column)

**Files to touch:**

- New: `packages/frontend/core/src/components/floating-ai-chat-anchor/` (component, css, hook)
- Modified: `packages/frontend/core/src/desktop/router.tsx` (mount anchor in shell)
- Modified: `packages/frontend/core/src/blocksuite/ai/components/ai-chat-input/index.ts` (accept `floatingMode` prop)

### B3. Sidebar redesign (decision #11)

**Week 1 — Phase 1 utility footer:**

- Modified `packages/frontend/core/src/components/root-app-sidebar/index.tsx`:
  - Move from `<CollapsibleSection path={['others']}>` and main flow into the existing `<SidebarContainer className={bottomContainer}>`: Trash, Import, Templates, Invite members, Settings (the MenuItem currently above the SidebarScrollableContainer)
  - Keep `AIChatButton`, `AllDocsButton`, `GraphButton`, etc. in main nav (Graph/Analytics get demoted to Cmd+K in Phase 3)
  - Help link via `ExternalMenuLinkItem` joins the bottom row

**Week 3 — Phase 2 tab strip + Home view:**

- New `packages/frontend/core/src/components/root-app-sidebar/tab-strip.tsx` (5 icons: Home / Chat / Meetings / Inbox / Search)
- New `packages/frontend/core/src/components/root-app-sidebar/views/{home,chat,meetings,inbox}-view.tsx`
- Search tab opens the existing CMDK modal (no body view)
- Active tab → `globalState.useLiveData(activeSidebarTab$)` (per-workspace)
- Feature flag: `flags.sidebar_tabs_v2`

**Week 3 — Phase B customize sections** (bundle with Phase 2):

- New `SidebarSectionVisibilityEditor` popover
- "Home settings" entry: customize sections + hide tab name
- Per-workspace prefs via `globalState`

### B4. Search modal (Week 6, decision implicit in #16 sidebar plan)

Notion-style modal upgrade for the existing `CMDKQuickSearchService`.

- Filter chips row: Title only / Created by / In / + Filter
- Group results: Today / Yesterday / Past 7 days / Past 30 days / Older
- Right-side preview pane (split view, arrow keys navigate)
- Keyboard: ↑↓ navigate, ↵ open, ⌘↵ new tab, Esc close

**Files:** modify `packages/frontend/core/src/modules/quicksearch/views/` (find existing modal); add filter-chip + preview-pane sub-components.

### B5. Empty states (Week 8)

Replace sterile messages with personality. Files: search for the `"No agents yet"`, `"No favorites"`, etc. strings in i18n + update with the Gen Z-flavored copy from this plan.

### B6. Onboarding wizard (Week 4-6, decision #17)

- New route `/onboarding` (gated by `flags.onboarding_v2` + no-onboarded user flag in DB)
- AI-led 4-question flow:
  1. What are you building?
  2. Who's on your team?
  3. What apps do you live in? (Gmail / Calendar / GitHub picker)
  4. What's your first project?
- AI generates: starter docs, 1 folder structure, optional GitHub connection, 1 starter chat thread
- Skip button always visible
- Persists `completedOnboarding=true` on `users` table

### B7. Micro-interactions (Week 8)

- Hover preview cards on doc list (200ms zoom + 3-line preview)
- Spring-loaded drag reorder
- Stagger entrance on doc grids
- Skeleton loaders (replace all spinners) — shimmer in brand accent color
- 0.97 scale on button press
- Magic-line indicator under active tab
- Token-by-token reveal for AI streaming with blinking cursor

### B11. Power-user features (Month 2-3)

- `⌘.` inline AI mini-chat (cursor-anchored) — new feature, Week 7
- ⌘K command palette upgrades (verbs + AI fallback) — Week 6 alongside search modal
- ⌘P quick switcher (recent docs preview) — Week 8
- ⌘/ shortcuts overlay — Week 8

### B12. Brand expression (Week 12)

- Loading screen: animated Manut wordmark
- 404 page: "This page wandered off…" + suggested actions
- Toasts: custom shape with brand accent
- Easter egg: `manut.xyz/manifesto`

### B13. Telemetry (Week 4 + ongoing, decision #18)

Mixpanel events (existing Mixpanel integration per recent commits):

- `ai_message_sent` { model, mode, tools_enabled, has_memory_hit }
- `ai_tool_invoked` { tool_name, success }
- `floating_chat_opened` { from: shortcut|button|deeplink }
- `sidebar_nav_clicked` { tab, item }
- `memory_pinned` / `memory_forgot`
- `quick_action_used` { action, doc_type }
- `connection_added` { provider }

---

## Work breakdown — Milestones → Epics → User Stories → Tasks

Format optimized for AI sub-agent handoff. Each task is self-contained with file paths, acceptance criteria, and dependencies. Convention: `T-{epic}-{story}-{task}` IDs. Effort in person-days. **M1 is task-level detailed (immediate work); M2-M3 at story level (expanded just before they start).**

### M1 — Foundation + AI core (Weeks 1-4) — 21d total

---

#### Epic E1.1 — Cloud conversion (3d, blocks everything in M1)

**Goal:** Convert AFFiNE-self-host fork → multi-tenant cloud SaaS. Single brand "Manut Cloud". Open public sign-up. Free tier.

##### US-1.1.1 — As a visitor, the sign-in popover reads "Manut Cloud" instead of "Manut SelfHosted Cloud"

**Acceptance criteria:**

- `grep -ri "self.?host" packages/frontend/i18n/src/resources/en.json` returns 0 hits
- All ~20 locale files audited; non-trivial translations flagged for review (don't auto-replace where context matters)
- Production `manut.xyz` sign-in popover shows "Manut Cloud" (or just "Manut") after deploy

**Tasks:**

- **T-1.1.1.a** — Audit + replace self-host strings in `en.json`
  - File: `packages/frontend/i18n/src/resources/en.json`
  - Patterns: `"SelfHosted Cloud"` → `"Cloud"`, `"Self host"`/`"Self-hosted"` → remove or rephrase, `"Manut Self Hosted"` → `"Manut"`
  - Effort: 0.25d · Skill: i18n
  - Verification: `grep -ri "self.?host" packages/frontend/i18n/src/resources/en.json | wc -l` → 0

- **T-1.1.1.b** — Propagate changes to locale siblings + run codegen
  - Files: all `packages/frontend/i18n/src/resources/*.json` siblings
  - Run: `yarn workspace @affine/i18n run codegen`
  - Effort: 0.25d · Skill: i18n
  - Verification: `packages/frontend/i18n/src/i18n.gen.ts` rebuilt without errors

##### US-1.1.2 — As a developer, the self-host auth code paths are gone

**Acceptance criteria:**

- File `add-self-hosted.tsx` deleted
- `SignInState['step']` union no longer contains `'addSelfhosted'`
- `selfhostLoginVersionGuard` no longer imported anywhere
- TypeScript compiles (`yarn workspace @affine/core run tsc --noEmit` clean)
- Sign-in page renders identically minus the "Add self-hosted server" affordance

**Tasks:**

- **T-1.1.2.a** — Remove the addSelfhosted flow + version guard
  - Files: `packages/frontend/core/src/components/sign-in/sign-in.tsx`, `index.tsx`
  - Delete: import of `useSelfhostLoginVersionGuard`, the `if (versionError && isSelfhosted)` branch, the `addSelfhosted` step rendering, `LocalWorkspaceIcon` skip-to-local section, `Back` component import where used only for addSelfhosted
  - Effort: 0.5d · Skill: FE-React
  - Verification: `yarn workspace @affine/core run tsc --noEmit` clean; visual diff on /sign-in shows no Add-Self-Hosted button

- **T-1.1.2.b** — Delete `add-self-hosted.tsx`
  - File: `packages/frontend/core/src/components/sign-in/add-self-hosted.tsx`
  - Delete file. Run grep to confirm no imports remain: `grep -rE "add-self-hosted|AddSelfHosted" packages/frontend/core/src/`
  - Effort: 0.1d · Skill: FE-React
  - Verification: `tsc --noEmit` clean; grep returns 0 imports

- **T-1.1.2.c** — Hardcode `ServerDeploymentType.Affine`
  - Files: `packages/backend/server/src/core/config/types.ts` (or wherever deployment type is read), search for `ServerDeploymentType.Selfhosted` and replace with `Affine`
  - Verify the GraphQL `ServerConfigType.type` resolver returns `Affine`
  - Effort: 0.5d · Skill: BE-Nest
  - Verification: GraphQL query `{ serverConfig { type } }` returns `Affine` on prod

##### US-1.1.3 — As a paying potential customer, I see real Terms + Privacy pages when clicking links from sign-in

**Acceptance criteria:**

- `manut.xyz/terms` returns 200 with real ToS content (not SPA shell)
- `manut.xyz/privacy` returns 200 with real Privacy Policy
- Both pages match the design language of `/about-us` / `/contact-us` (PR #113)
- Both added to sitemap.ts

**Tasks:**

- **T-1.1.3.a** — Create `manut-landing/app/terms/page.tsx`
  - Reuse SiteNav + SiteFooter + Reveal pattern from `manut-landing/app/about-us/page.tsx`
  - Content: standard SaaS ToS placeholder (mark as "draft — legal review pending")
  - Effort: 0.5d · Skill: FE-Next.js
  - Verification: local `yarn workspace manut-landing run build` succeeds; `/terms` route exists in static export

- **T-1.1.3.b** — Create `manut-landing/app/privacy/page.tsx`
  - Same pattern. Privacy Policy placeholder. GDPR / CCPA mentions.
  - Effort: 0.5d · Skill: FE-Next.js

- **T-1.1.3.c** — Add to sitemap.ts
  - File: `manut-landing/app/sitemap.ts`
  - Add `/terms` + `/privacy` entries
  - Effort: 0.1d

##### US-1.1.4 — As a new user, after signup I land on a workspace creation flow, not a blank screen

**Acceptance criteria:**

- New user signs up → redirected to `/welcome`
- `/welcome` shows "Let's create your first workspace" with name input
- Submit → POST creates workspace → redirect to `/workspace/{wsId}/all`
- New workspace has 1 starter "Getting Started" doc

**Tasks:**

- **T-1.1.4.a** — Create `/welcome` route + page
  - Files: `packages/frontend/core/src/desktop/pages/welcome/index.tsx` (new), `packages/frontend/core/src/desktop/router.tsx` (register route)
  - Component: simple form with workspace name input + "Create" button. Calls existing `WorkspacesService.create()`.
  - Effort: 1d · Skill: FE-React
  - Verification: navigating to /welcome shows the form; submitting creates a workspace via GraphQL

- **T-1.1.4.b** — Update post-signin redirect to send new users to `/welcome`
  - File: `packages/frontend/core/src/desktop/pages/auth/sign-in.tsx`
  - In `handleAuthenticated`: check `user.workspaces.length === 0` → `navigate('/welcome')`; else current behavior (`jumpToIndex`)
  - Effort: 0.25d
  - Verification: Existing user → /workspace/...; new user → /welcome

- **T-1.1.4.c** — Auto-seed "Getting Started" doc on workspace creation
  - File: `packages/backend/server/src/core/workspaces/service.ts` (find `createWorkspace`)
  - After workspace insert: create 1 doc with a markdown template (welcoming, links to Help, etc.)
  - Effort: 0.5d · Skill: BE-Nest
  - Verification: New workspace via UI shows 1 doc named "Getting Started" with seeded content

##### US-1.1.5 — As a workspace owner, my Free tier shows 2 GB storage + $5 AI/mo limit

**Acceptance criteria:**

- `GET /api/quota` (or GraphQL `workspaceQuota`) returns `memberLimit: Infinity, storageBytes: 2GB, aiBudgetUsdCents: 500` for any non-Pro workspace
- Uploading the 2GB+1 byte: server returns friendly 413 error with "upgrade to Pro" prompt
- AI request when this month's spend > $5: server returns 429 with cap-hit message
- Existing workspaces grandfathered into Free tier (no breakage)

**Tasks:**

- **T-1.1.5.a** — Define Free/Pro tiers in quota service
  - File: `packages/backend/server/src/core/quota/service.ts`
  - Remove `env.selfhosted` branch (the 100k member uplift)
  - Add `FREE_TIER` + `PRO_TIER` constants per decision #19 + #26
  - `getWorkspaceQuota(workspaceId)` returns the tier matching `workspace.plan`
  - Effort: 1d · Skill: BE-Nest
  - Verification: unit test: `quotaService.getWorkspaceQuota('test-ws')` returns Free tier object

- **T-1.1.5.b** — Storage cap enforcement
  - Search for blob upload endpoint; intercept and check `currentStorage + uploadSize > cap`
  - Return 413 with `{ error: 'STORAGE_CAP', currentBytes, capBytes }`
  - Effort: 0.5d · Skill: BE-Nest
  - Verification: integration test: upload to a workspace with 2GB used + 1KB file → 413 response

- **T-1.1.5.c** — Frontend storage-cap modal
  - File: new `packages/frontend/core/src/components/affine/quota/storage-cap-modal.tsx`
  - Triggered when upload returns `STORAGE_CAP` error code
  - Copy: "You've used 2 GB of free storage. Upgrade to Pro for 100 GB."
  - Button: "Upgrade to Pro" → opens upgrade flow (placeholder until E3.4 ships)
  - Effort: 0.5d · Skill: FE-React

##### US-1.1.6 — As a marketing visitor on manut.xyz, the copy talks about Cloud, not self-host

**Acceptance criteria:**

- Hero, features, pricing, FAQ, oss sections have no "self-host" mentions
- Hero CTA leads with "Start free in 30 seconds"
- Pricing shows Free + Pro tiers (Pro placeholder "Coming soon" until Month 3)
- FAQ "How do I get started?" replaces "How do I self-host?"

**Tasks:**

- **T-1.1.6.a** — Audit + rewrite landing copy
  - Files: `manut-landing/components/sections/{hero,features,pricing,faq,open-source,cta,trust-bar,seo-glance}.tsx`
  - Grep for "self-host" across these → reframe each
  - Effort: 1d · Skill: FE-Next.js + copy
  - Verification: `grep -i "self.?host" manut-landing/components/sections/` returns 0 hits (or only OSS section with intentional GitHub fork mention)

---

#### Epic E1.2 — Phase 1 utility footer (1d)

**Goal:** Demote Trash/Import/Templates/Invite/Settings/Help to a bottom utility footer in the sidebar.

##### US-1.2.1 — As a user, the sidebar shows ~7 items instead of 17 at a glance

**Acceptance criteria:**

- Top-half of sidebar has primary nav only (chat, all docs, graph, etc.)
- Bottom container (`bottomContainer`) houses: Trash, Import, Templates, Invite, Settings, Help, App Download/Updater
- "Others" `CollapsibleSection` is empty or removed
- Visual: clear separation between primary nav and utility footer

**Tasks:**

- **T-1.2.1.a** — Restructure sidebar render order (utility footer only — Settings handled separately per decision #20)
  - File: `packages/frontend/core/src/components/root-app-sidebar/index.tsx`
  - Move from `<CollapsibleSection path={['others']}>`: TrashButton, Import MenuItem, InviteMembersButton, TemplateDocEntrance, "Learn more" ExternalMenuLinkItem → into bottom container
  - Remove the CollapsibleSection if empty afterward
  - **Do NOT move the Settings MenuItem here** — it moves into the user-avatar menu in T-1.2.2.a (separate task, per decision #20)
  - Effort: 1d · Skill: FE-React
  - Verification: visual /browse check; sidebar shows ~7 primary items + utility footer with Trash/Import/Invite/Templates/Learn-more

##### US-1.2.2 — As a user, Settings lives in my avatar menu (not the sidebar nav)

**Acceptance criteria:**

- Settings option no longer in the top-half of sidebar (the SettingsIcon MenuItem is removed)
- Clicking user avatar in the workspace selector area opens a menu with: `Profile`, `Settings`, `Sign out`
- Clicking `Settings` opens the existing workspace dialog (preserves current behavior)

**Tasks:**

- **T-1.2.2.a** — Add Settings to user avatar dropdown
  - File: `packages/frontend/core/src/components/root-app-sidebar/user-info/` (existing component for the avatar)
  - Add a dropdown trigger on the avatar; menu items: Profile, Settings (opens existing `workspaceDialogService.open('setting', ...)`), Sign out
  - Remove the `<MenuItem icon={<SettingsIcon />}...>` from the main sidebar flow in `index.tsx`
  - Effort: 1d · Skill: FE-React
  - Verification: avatar click → dropdown with Settings; clicking Settings opens the same settings dialog as before

---

#### Epic E1.3 — Design tokens refresh (1d)

**Goal:** Bring manut-landing's warm-neutral + violet palette + Geist + Instrument Serif into the AFFiNE app.

##### US-1.3.1 — As a user, the app visually matches the marketing site

**Acceptance criteria:**

- App background, text, accent colors match manut-landing
- Typography uses Geist Sans (UI) + Instrument Serif (display headers)
- Radius scale: 4 / 8 / 12 / 24
- Dark mode is the default theme for new users

**Tasks:**

- **T-1.3.1.a** — Add tokens to `theme.css` (or vanilla-extract themes)
  - File: `packages/frontend/core/src/styles/theme.css` (or find the equivalent if vanilla-extract)
  - Add CSS variables matching manut-landing/app/globals.css
  - Effort: 0.5d · Skill: CSS / vanilla-extract
  - Verification: app pages show new palette

- **T-1.3.1.b** — Switch default theme to dark
  - File: ThemeService or wherever default is set
  - Default `theme: 'dark'` for new users
  - Effort: 0.25d
  - Verification: brand new sign-up → dark mode by default

- **T-1.3.1.c** — Font self-host or import Geist + Instrument Serif into app build
  - Files: `packages/frontend/apps/web/src/index.html` or font loader config
  - Mirror landing's `next/font/google` setup or use local font files
  - Effort: 0.25d
  - Verification: DevTools → Computed → `font-family: Geist Sans, ...` on body

---

#### Epic E1.4 — Floating AI chat anchor v1 (3d, feature-flagged)

**Goal:** ⌘J opens contextual chat panel from any workspace page.

##### US-1.4.1 — As a user, ⌘J anywhere opens an AI chat panel anchored to my current page

**Acceptance criteria:**

- ⌘J (any modifier on non-Mac: Ctrl+J) opens panel from any /workspace/\* route
- Panel slides in from right edge (300ms spring)
- Top of panel shows context chip: page icon + title + "× remove context" button
- Bottom is the existing chat input + model picker + Auto mode
- Behind feature flag `floating_ai_chat` — opt-in initially

**Tasks:**

- **T-1.4.1.a** — Create `FloatingAiChatAnchor` component
  - File (new): `packages/frontend/core/src/components/floating-ai-chat-anchor/index.tsx`
  - Renders a bottom-right floating button + a slide-in panel
  - Panel reuses `blocksuite/ai/components/ai-chat-input` + `ai-chat-messages` (Lit components, mount via existing React-Lit bridge)
  - Effort: 1.5d · Skill: FE-React + Lit
  - Verification: button visible on /workspace/{id}/all; clicking opens panel

- **T-1.4.1.b** — Global ⌘J keyboard handler
  - File: `packages/frontend/core/src/components/floating-ai-chat-anchor/use-floating-chat-shortcut.ts` (new)
  - Use existing `useHotkeys` (or equivalent pattern in this codebase)
  - Toggle panel open/close
  - Effort: 0.5d
  - Verification: ⌘J opens; ⌘J again closes; Esc closes

- **T-1.4.1.c** — Page-context auto-injection
  - File (new): `packages/frontend/core/src/components/floating-ai-chat-anchor/use-current-doc-context.ts`
  - Subscribe to `WorkbenchService.location$` → derive `{ docId, docType, title }`
  - Pass to chat panel as a system context message
  - Effort: 0.5d
  - Verification: on doc page, chat replies show awareness of the current doc

- **T-1.4.1.d** — Feature flag
  - File: `packages/frontend/core/src/modules/feature-flag/...` (extend existing)
  - Add `flags.floating_ai_chat$` LiveData<boolean>
  - Default off; toggle via admin or per-user setting
  - Mount FloatingAiChatAnchor in workbench layout only when flag true
  - Effort: 0.5d
  - Verification: flag off → no button visible; flag on → button visible

---

#### Epic E1.5 — Memory MVP (4d)

**Goal:** AI remembers across sessions. Per-user + per-workspace scopes with toggle. Forever retention.

##### US-1.5.1 — As a user, I tell the AI a preference and it remembers next session

**Acceptance criteria:**

- Session 1: "remember I prefer terse replies, no preamble"
- Session 2 (new chat, same workspace): replies are terse without re-prompt
- Memory visible in "What AI knows about me" page (US-2.2.1 from M2)

**Tasks:**

- **T-1.5.1.a** — Migration: add embedding + scope + pinned columns
  - File (new): `packages/backend/server/migrations/<ts>_add_mn_agent_memory_embedding/migration.sql`
  - Steps: `CREATE EXTENSION IF NOT EXISTS vector;` + `ALTER TABLE mn_agent_memories ADD COLUMN embedding vector(768); ADD COLUMN scope varchar NOT NULL DEFAULT 'user'; ADD COLUMN pinned boolean NOT NULL DEFAULT false;`
  - Use idempotent guards (same pattern as `20260518230000`)
  - Apply to prod via local `prisma migrate deploy` against Railway proxy
  - Effort: 0.5d · Skill: DB / Prisma
  - Verification: `\d mn_agent_memories` on prod shows the new columns; pgvector extension active

- **T-1.5.1.b** — Embed service (Vertex embeddings)
  - File (new): `packages/backend/server/src/plugins/copilot/memory/embed.service.ts`
  - Wrap Vertex `textembedding-gecko@003` (768-dim) via existing `getGoogleAuth` from `copilot/providers/utils.ts`
  - `embed(text: string): Promise<number[]>` returns 768-float vector
  - Effort: 0.5d · Skill: BE-Nest + Vertex
  - Verification: unit test: `embed("hello world")` returns array length 768

- **T-1.5.1.c** — Ingest service (write memories)
  - File (new): `packages/backend/server/src/plugins/copilot/memory/ingest.service.ts`
  - API: `ingest({ workspaceId, userId, scope, kind, content })` → embeds + inserts row
  - Called from chat-session post-completion hook for FACT / OBSERVATION
  - Manual call from frontend `/api/memory/pin` for user-pinned memories
  - Effort: 1d · Skill: BE-Nest
  - Verification: inserting via `ingestService.ingest(...)` creates row with non-null embedding

- **T-1.5.1.d** — Retrieve service (kNN search)
  - File (new): `packages/backend/server/src/plugins/copilot/memory/retrieve.service.ts`
  - API: `retrieve({ query, workspaceId, userId, scopes: ['user', 'workspace'], topK: 5 })` → top-K most-relevant memories
  - SQL: `SELECT ... FROM mn_agent_memories WHERE workspace_id = $1 AND (scope = 'workspace' OR user_id = $2) ORDER BY embedding <=> $3 LIMIT $4`
  - Effort: 1d
  - Verification: seed 10 memories, query similar → top-K most-relevant returned in order

- **T-1.5.1.e** — Inject memories into chat system prompt
  - Files: `packages/backend/server/src/plugins/copilot/prompt/service.ts` and `packages/backend/server/src/plugins/copilot/interceptor/request-interceptor.ts`
  - On each new chat turn: call retrieve service → format top-5 memories as `<memory>...</memory>` blocks in system prompt unless `toolsConfig.memory=false`
  - Effort: 1d
  - Verification: `request-interceptor.spec.ts` covers default injection, opt-out, and failure fallback

---

#### Epic E1.6 — Mode + tool UX hybrid (2d)

**Goal:** Mode presets (Read / Edit / Agent) for quick start + Advanced toggle for per-tool checkboxes.

##### US-1.6.1 — As a user, I pick a mode and the right tools are enabled

**Acceptance criteria:**

- Three modes: Read (search + read-only tools) / Edit (+ doc-edit) / Agent (+ create/update/data tools)
- Default mode: Edit
- Each mode's tool set documented; can be inspected via `?mode=...` in URL
- Advanced caret reveals per-tool checkboxes for manual override
- Selection persists in `globalState` per-workspace

**Tasks:**

- **T-1.6.1.a** — Mode → tool set mapping
  - File (new): `packages/frontend/core/src/blocksuite/ai/lib/modes.ts`
  - Export `MODES = { read: [...toolNames], edit: [...], agent: [...] }`
  - Effort: 0.25d
  - Verification: importable; type-safe

- **T-1.6.1.b** — Update preference popup with mode picker + advanced toggle
  - File: `packages/frontend/core/src/blocksuite/ai/components/ai-chat-input/preference-popup.ts` (existing)
  - Add mode select (3 options) + Advanced caret toggling per-tool checkboxes
  - Persist selection to globalState
  - Effort: 1d · Skill: FE-Lit
  - Verification: switching modes auto-checks the corresponding tool boxes; Advanced unchecks/checks individuals; reload preserves selection

- **T-1.6.1.c** — Pass selected tools to chat session
  - File: chat-session creation path; include `enabledTools: string[]` in session config
  - Backend resolver gates tool dispatch by `enabledTools` membership
  - Effort: 0.75d
  - Verification: in Read mode, AI cannot call doc-edit; in Agent mode, AI can call doc-create

---

#### Epic E1.7 — P1 tools (3d)

**Goal:** Ship `web_search`, `memory_search`, `tabs_browse` AI tools.

##### US-1.7.1 — As a user, I ask "what's new with X?" and AI fetches fresh web results

**Acceptance criteria:**

- Web search tool callable in Read/Edit/Agent modes when enabled
- AI replies cite source URLs returned by Exa
- Cost charged at $0.005/query passthrough

**Tasks:**

- **T-1.7.1.a** — Provision Exa API key + Railway env
  - Set `EXA_API_KEY` on Manut service via Railway GraphQL `variableUpsert`
  - Update `.env.example` + ops doc
  - Effort: 0.25d · Skill: ops
  - Verification: `curl https://api.exa.ai/...` with the key returns valid JSON

- **T-1.7.1.b** — Implement `web_search` tool
  - File (new): `packages/backend/server/src/plugins/copilot/tools/web_search.ts`
  - Wraps Exa API; returns `[{ title, url, snippet }]` × 5
  - Register in `tools/index.ts`
  - Effort: 0.5d
  - Verification: backend integration test invoking tool returns Exa results

##### US-1.7.2 — `memory_search` tool exposed to AI

**Tasks:**

- **T-1.7.2.a** — Implement `memory_search` tool
  - File (new): `packages/backend/server/src/plugins/copilot/tools/memory_search.ts`
  - Wraps `MemoryRetrieveService` from E1.5
  - Effort: 0.5d

##### US-1.7.3 — `tabs_browse` tool reads other open docs

**Tasks:**

- **T-1.7.3.a** — Implement `tabs_browse` tool
  - File (new): `packages/backend/server/src/plugins/copilot/tools/tabs_browse.ts`
  - Input: `docId` (must be in current user's workspace)
  - Output: doc title + markdown content via existing `DocService.exportToMarkdown`
  - Effort: 0.75d

##### US-1.7.4 — Tools surfaced in mode/advanced toggle UI

**Tasks:**

- **T-1.7.4.a** — Wire 3 new tools into MODES mapping + popup
  - File: `packages/frontend/core/src/blocksuite/ai/lib/modes.ts`
  - Add to Read mode: web_search, memory_search, tabs_browse
  - Effort: 0.1d

---

#### Epic E1.8 — Gmail + Calendar tool wrappers (3d)

**Goal:** Expose existing Gmail/Calendar plugins as AI-callable tools.

##### US-1.8.1 — As a user, AI can search my Gmail and summarize results

**Tasks:**

- **T-1.8.1.a** — `gmail_search` tool
  - File (new): `packages/backend/server/src/plugins/copilot/tools/gmail.ts`
  - Reuses `GoogleOAuthService.getValidAccessToken(userId, workspaceId, 'gmail')`
  - Hits Gmail API `users.messages.list` + `users.messages.get` for top 5
  - Returns sanitized HTML→plaintext snippets
  - Effort: 1.5d · Skill: BE + Gmail API
  - Verification: with Gmail connected, AI replies to "find emails about X" cite real messages

##### US-1.8.2 — As a user, AI can read my calendar

**Tasks:**

- **T-1.8.2.a** — `calendar_search` tool
  - File (new): `packages/backend/server/src/plugins/copilot/tools/calendar.ts`
  - Wraps existing CalendarService.listEvents()
  - Effort: 1.5d
  - Verification: "what's on my calendar Friday?" returns real events

---

#### Epic E1.9 — Sidebar Phase 2 + customize sections (3d, feature-flagged)

##### US-1.9.1 — Tab strip with 5 tabs

**Tasks:**

- **T-1.9.1.a** — New SidebarTabStrip component
  - File (new): `packages/frontend/core/src/components/root-app-sidebar/tab-strip.tsx` + `.css.ts`
  - 5 icon buttons: Home / Chat / Meetings / Inbox / Search
  - Search click → opens existing CMDK modal (not sidebar body)
  - Effort: 1d

- **T-1.9.1.b** — Home / Chat / Meetings / Inbox views
  - Files (new): `packages/frontend/core/src/components/root-app-sidebar/views/{home,chat,meetings,inbox}-view.tsx`
  - Home view wraps existing sidebar content (NavigationPanelFavorites etc.)
  - Other 3 are placeholder stubs ("Coming in M2")
  - Effort: 1d

- **T-1.9.1.c** — Active tab state + feature flag
  - File: `packages/frontend/core/src/components/root-app-sidebar/use-active-tab.ts` (new)
  - Subscribe to `globalState` keyed `sidebar.activeTab.${workspaceId}`
  - Flag `flags.sidebar_tabs_v2`
  - Effort: 0.5d

##### US-1.9.2 — Customize sections popover with eye-toggle

**Tasks:**

- **T-1.9.2.a** — `SidebarSectionVisibilityEditor` component
  - File (new): `packages/frontend/core/src/components/root-app-sidebar/section-visibility-editor.tsx`
  - List sections; eye-icon toggle; "Done" commits
  - Persist to `globalState` keyed `sidebar.hiddenSections.${workspaceId}`
  - Effort: 0.5d

---

#### Epic E1.10 — Quick actions + format selector (3d)

##### US-1.10.1 — Per-doc-type quick action buttons in chat empty state

**Tasks:**

- **T-1.10.1.a** — Quick action templates registry
  - File (new): `packages/frontend/core/src/blocksuite/ai/quick-actions/templates.ts`
  - Keyed by BlockSuite block type → 4 action templates each
  - Effort: 0.5d

- **T-1.10.1.b** — Surface in floating chat empty state
  - Existing component, add a row of action buttons above the input
  - Click → prefills input + submits
  - Effort: 0.5d

##### US-1.10.2 — Format selector chip

**Tasks:**

- **T-1.10.2.a** — Format chip + prompt mapping
  - Files: `packages/frontend/core/src/blocksuite/ai/components/ai-chat-input/format-selector.ts` (new); `packages/frontend/core/src/blocksuite/ai/utils/format-prompt.ts` (new)
  - Formats: Auto, List, Table, Code, Image (gated by image_gen availability)
  - Selection appends to system prompt
  - Effort: 1d

---

#### Epic E1.11 — SSE → WebSocket streaming (5d)

##### US-1.11.1 — AI streaming uses WebSocket bi-directional

**Tasks:**

- **T-1.11.1.a** — WebSocket gateway for chat
  - File (new): `packages/backend/server/src/plugins/copilot/ws/chat.gateway.ts`
  - Uses `@nestjs/websockets` (already in deps)
  - Effort: 1d

- **T-1.11.1.b** — Migrate chat client to WebSocket transport
  - Files: `packages/frontend/core/src/blocksuite/ai/provider/request.ts` + transport layer
  - Keep SSE endpoint alive 30 days as fallback
  - Effort: 2d

- **T-1.11.1.c** — Tool-progress push events (server → client)
  - Use WebSocket to push `tool_started`, `tool_progress`, `tool_completed` events
  - Frontend renders progress indicator per tool call
  - Effort: 1.5d

- **T-1.11.1.d** — Memory-update push events
  - When `MemoryIngestService` writes a new memory, push to user's WS clients so the "memory hit" indicator can flash
  - Effort: 0.5d

---

#### Epic E1.12 — Per-workspace AI cap (1d)

##### US-1.12.1 — Workspace AI spend tracked + capped at $5/mo (Free)

**Tasks:**

- **T-1.12.1.a** — AI budget tracker service
  - File (new): `packages/backend/server/src/core/quota/ai-budget.service.ts`
  - Tracks per-workspace usage in `ai_budget_usage` table (new migration)
  - Returns 429 + friendly modal trigger when over cap
  - Effort: 1d

---

### M2 — Connectors + power features (Weeks 5-8) — 20d

Story-level. Expand to tasks at start of M2.

| Epic                                                       | Stories                                                                                                                                                                  | Effort | Status                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | --------------------------------------------- |
| **E2.1 GitHub connector**                                  | GitHub OAuth flow · GitHub AI tools (issues/PRs/repos/search) · UI chips                                                                                                 | 5d     | ✅ `ef4be3157` (scaffold; graceful w/o OAuth) |
| **E2.2 Memory UI**                                         | "What AI knows about me" settings page · Pin / forget / promote to workspace                                                                                             | 2d     | ✅ `c2383313c`                                |
| **E2.3 Cmd+K search modal**                                | Notion-style modal · Filter chips (Title / Created by / In) · Grouped results · Right-side preview pane · Keyboard nav                                                   | 5d     | ✅ `4075c5f65`                                |
| **E2.4 Self-evolution feedback**                           | 👍👎 chip per AI reply · Weekly distillation cron · Playbook injection into system prompt                                                                                | 5d     | ✅ `7bb062db9`                                |
| **E2.5 Tabbed multi-chat**                                 | Multiple chat tabs in floating panel · Pin chip locks context · Persist `aiChatHistories` extensions                                                                     | 2d     | ✅ `540080814`                                |
| **E2.6 Inline AI ⌘.**                                      | Cursor-anchored mini chat in any doc · No need to open side panel · Inline result insertion                                                                              | 3d     | ✅ `d6454cb84`                                |
| **E2.7 Visual polish (Framer + skeletons + stagger)**      | Framer Motion adoption · Skeleton loaders · Stagger entrance on lists · Hover preview cards · 0.97 button press · Magic-line tab indicator                               | 5d     | ✅ `ebd9fbde3`                                |
| **E2.8 Power-user shortcuts**                              | ⌘P quick switcher · ⌘/ shortcuts overlay · ⌘K command palette verb upgrades · Subtle opt-in sound (4-5 cues)                                                             | 3d     | ✅ `c9b26122b`                                |
| **E2.9 AI onboarding wizard (per decision #17, Week 4-6)** | 4-question AI-led wizard at `/welcome` · Auto-create starter docs · Optional Gmail/Calendar/GitHub connect in-flow · 30-second TTV validation · Skip path always visible | 4d     | ✅ `4b00bb8e2`                                |

### M3 — P2 tools + Pro tier + launch (Weeks 9-12) — 20d

Epic-level. Expand to stories + tasks at start of M3.

**Note:** E2.9 (AI onboarding wizard) moved up from M3 → M2 per decision #17 (user picked "Week 4-6"). M3 now has launch prep instead.

| Epic                            | Effort | Key deliverables                                                                                 | Status                                                              |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| **E3.1 Code-run tool**          | 4d     | Modal sandbox integration · `code_run` AI tool · Result streaming back                           | ✅ `8d8eba118` (scaffold; graceful w/o token)                       |
| **E3.2 Image-gen tool**         | 2d     | Vertex Imagen integration · `image_gen` AI tool · Image rendering in chat                        | ✅ `22680ab01`                                                      |
| **E3.3 Stripe Pro tier**        | 5d     | Stripe checkout · Plan model · Per-workspace plan setting · Quota tier upgrade · Webhook handler | ✅ `8addcbb23` (scaffold; graceful w/o Stripe keys)                 |
| **E3.4 Brand polish**           | 3d     | Loading screen wordmark · 404 personality · Custom toast shape · Empty states final pass         | ✅ `9ecb0f02c`                                                      |
| **E3.5 Telemetry dashboards**   | 1d     | Mixpanel dashboard for AI engagement, conversion, tool-use, churn                                | ✅ `1e4497caf` (events wired; dashboard config still operator-side) |
| **E3.6 Bug bash + launch prep** | 4d     | Full E2E sweep · Performance budget check · Public launch comms                                  | ✅ `62f503c38` (specs + runbook + checklist + comms)                |
| **E3.7 Buffer**                 | 1d     | Reserved for slippage from M1-M2                                                                 | n/a — used directly                                                 |

**Total:** 21d (M1) + 20d (M2 — now includes onboarding wizard E2.9) + 20d (M3) = 61 person-days. With ~15% buffer → ~70d → ~14 weeks realistic. The 12-week target is achievable if no major slippage.

---

## Sub-agent handoff conventions

When dispatching a task to an AI sub-agent, include in the prompt:

1. **Task ID** (e.g. `T-1.1.5.a`)
2. **Goal** (one sentence)
3. **Files to modify** (explicit paths, no guessing)
4. **Acceptance criteria** (testable conditions)
5. **Existing patterns to reuse** (link to a sibling file)
6. **Verification command** (the exact `yarn workspace ... tsc --noEmit` or `grep` to run)
7. **Cap output** ("Cap report at 500 words")

Example agent prompt template:

```
Task ID: T-1.1.5.a (per ~/.claude/plans/expressive-popping-finch.md)

Goal: Define Free + Pro tier constants in the quota service and remove the env.selfhosted uplift branch.

Files:
  - packages/backend/server/src/core/quota/service.ts

Pattern to reuse:
  - Existing tier shape in this file (find getWorkspaceQuota)
  - Decision #26: Free = unlimited members + 2 GB + $5 AI/mo
  - Decision #19: Pro = unlimited members + 100 GB + $50 AI/mo

Acceptance:
  - getWorkspaceQuota returns the Free tier shape for any workspace
    without a plan set
  - env.selfhosted branch no longer exists
  - yarn workspace @affine/server tsc --noEmit is clean

Cap report at 400 words.
```

---

## Critical file paths (the entry points)

**Cloud conversion (Week 1):**

- `packages/frontend/i18n/src/resources/en.json` — strip self-host strings
- `packages/frontend/core/src/components/sign-in/sign-in.tsx` — remove selfhost guard + flow
- `packages/frontend/core/src/components/sign-in/add-self-hosted.tsx` — DELETE
- `packages/frontend/core/src/components/sign-in/index.tsx` — drop `addSelfhosted` step
- `packages/backend/server/src/core/quota/service.ts` — Free + Pro tier definitions
- `packages/backend/server/src/core/config/` — hardcode `ServerDeploymentType.Affine`
- `packages/frontend/core/src/desktop/pages/welcome/index.tsx` — NEW, first-run workspace creation
- `packages/frontend/core/src/desktop/router.tsx` — add `/welcome` route
- `manut-landing/app/terms/page.tsx` + `app/privacy/page.tsx` — NEW
- `manut-landing/components/sections/{hero,features,pricing,faq,open-source,cta}.tsx` — copy audit

**Backend:**

- `packages/backend/server/src/plugins/copilot/tools/` — all AI tools
- `packages/backend/server/src/plugins/copilot/memory/` — NEW, memory services
- `packages/backend/server/src/plugins/copilot/evolution/` — NEW, distillation cron
- `packages/backend/server/src/plugins/github-oauth/` — NEW, GitHub connector
- `packages/backend/server/src/plugins/connections/` — OAuth provider abstraction (reuse)
- `packages/backend/server/src/plugins/copilot/prompt/prompts.ts` — `CHAT_PROMPT` + model list
- `packages/backend/server/src/plugins/copilot/auto-router.ts` — model routing
- `packages/backend/server/schema.prisma` — `MnAgentMemory` (add embedding + scope + pinned columns)
- `packages/backend/server/migrations/` — new migration files

**Frontend:**

- `packages/frontend/core/src/components/root-app-sidebar/index.tsx` — sidebar layout
- `packages/frontend/core/src/components/floating-ai-chat-anchor/` — NEW, floating chat
- `packages/frontend/core/src/blocksuite/ai/components/ai-chat-input/` — chat input + mode + tool UX
- `packages/frontend/core/src/blocksuite/ai/components/ai-chat-messages/` — message rendering + 👍👎
- `packages/frontend/core/src/blocksuite/ai/quick-actions/templates.ts` — NEW, per-type templates
- `packages/frontend/core/src/modules/quicksearch/` — Cmd+K modal
- `packages/frontend/core/src/desktop/dialogs/setting/account-setting/memory-panel.tsx` — NEW
- `packages/frontend/core/src/styles/theme.css` — design tokens
- `packages/frontend/core/src/lib/motion.ts` — NEW, Framer Motion presets

---

## Verification per slice

| Slice                  | How to verify                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| Phase 1 utility footer | `/browse` sidebar shows utility cluster at bottom; Trash/Import/Templates/Invite all there               |
| Floating chat v1       | `⌘J` opens panel from any page; context chip shows current doc; ask question, get reply                  |
| Memory MVP             | Session A: "remember I prefer terse answers" → Session B same workspace: replies terse without re-prompt |
| Mode UX                | Switch to Read → AI refuses to call doc-edit tool; switch to Agent → AI can edit                         |
| Web search tool        | "What's the latest news about X?" → AI calls `web_search` and cites Exa results                          |
| GitHub tool            | "Find my open PRs in repo Y" → AI returns PR list with links                                             |
| Tab strip              | Each tab swaps body; URL state preserves on reload                                                       |
| Search modal           | Filter chips work; results group by recency; preview pane updates on arrow nav                           |
| Feedback loop          | 👎 a reply → memory ingested → next week's playbook reflects it                                          |
| Code-run tool          | "Calculate fibonacci(100)" → Modal returns result                                                        |
| Image-gen tool         | "Generate a brand logo concept" → Vertex Imagen returns image                                            |
| Onboarding             | New user signs up → 30s wizard → workspace has 3 starter docs + 1 chat thread                            |
| Pro tier               | Free workspace hits $50 cap → upgrade prompt → Stripe checkout → cap lifts                               |

---

## Risks + mitigations

| Risk                                               | Mitigation                                                                                                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloud conversion breaks existing user sessions     | Migration: existing users keep their workspaces; just relabel UI. No data migration needed. Run migration on a Friday with Saturday monitoring. |
| Public signup → bot signup abuse                   | Rate-limit at Cloudflare edge (existing). Email verification required before workspace creation. Add CAPTCHA if abuse appears.                  |
| Free tier storage cap = bad UX for power users     | Generous 30-day grace period before hard-blocking uploads. Upgrade prompt at 80% usage. Pro at $20 lifts to 100 GB.                             |
| Removing self-host = OSS community alienation      | Repo stays MIT. README documents "you can fork and run it yourself" as a 1-line note. We just don't ship branded "Self-Host" UX.                |
| AI memory hallucination ("remembers" things wrong) | User-editable "What AI knows about me" page; pin/forget per memory; weekly distillation reviewed by AI itself for coherence                     |
| Runaway tool-call cost                             | Per-workspace $50 cap; per-tool cost charged at provider passthrough; alert at 80%                                                              |
| WebSocket migration breaks SSE clients             | Keep SSE endpoint alive for 30 days; dual-write during cut-over                                                                                 |
| GitHub OAuth scope creep                           | Start with `read:user repo` only; users explicitly grant `write:repo` for create-PR features                                                    |
| Framer Motion bundle bloat                         | Code-split per page; the floating chat is the only always-mounted Framer consumer                                                               |
| Pro tier delays free-tier polish                   | Pro tier work isolated to Week 11; if Stripe integration slips, hold launch but keep free tier shippable                                        |
| Feature flag fatigue (many concurrent flags)       | Audit + retire flags weekly. Once a flag is on for 100% for 2 weeks with no incident → bake in.                                                 |

---

## Open / deferred to future plans

- Slack, Atlassian, Notion, LinkedIn, Discord connectors (Month 4+) — only GitHub in M2 per decision #2
- Mobile parity for floating chat + tab strip (V2 — separate effort)
- Real designer engagement for visual identity refinement (TBD)
- Internal beta program (decision was: skip; revisit if user-visible incidents spike)
- Custom 20-icon brand set (deferred; decision was hybrid Lucide+BlockSuite per decision #21)
- Auto-rollback on error rate (deferred; manual rollback via flag is enough for Month 1-3 per decision #22)
- AI weekly digest emails (deferred; decision #12 was "no digest by default" — revisit only if user demand emerges)
- Workspace plan tier dashboards / billing portal (Month 3 ships Stripe checkout + basic gating; rich billing UX is V2)

---

## What ships first (Week 1 PRs)

6 sequential PRs, smallest-blast-radius first:

1. **`feat(sidebar): demote utility items to bottom footer`** — ~1 file, ~50 lines. R2. Ships Day 1.
2. **`feat(landing): terms + privacy pages`** — ~2 files. R2. Ships Day 1. Unblocks #3 (sign-in references them).
3. **`refactor(auth): remove self-host flow from sign-in`** — ~3 files, deletes one. R1. Ships Day 2.
4. **`refactor(i18n): strip self-host strings, rebrand to "Manut Cloud"`** — touches all locale files. R2. Ships Day 2.
5. **`feat(quota): cloud Free tier (unlimited members, 2 GB, $5 AI/mo)`** — backend quota service + storage cap enforcement. R1. Ships Day 3.
6. **`feat(theme): refresh design tokens for Gen Z visual identity`** — `theme.css` + `globals.css`. R2. Ships Day 3.
7. **`feat(onboarding): /welcome route + first-time workspace creation`** — ~2 new files + router. R1. Ships Day 4.
8. **`feat(ai): floating chat anchor with ⌘J and page context (flag: floating_ai_chat)`** — ~5 files, ~400 lines. R1, feature-flagged. Ships Day 5-7.

After Week 1.5: Manut is a real cloud SaaS. Self-host labels are gone. Public sign-up works. New users land on workspace creation, not an empty AFFiNE shell. Sidebar is cleaner. AI is one keystroke away from any page. That's the foundation for everything in Months 2-3.

---

## Session bootstrap for fresh AI agents

**Read this first if you're a fresh Claude Code session picking up this plan.**

### How to use this section

You are likely one of multiple parallel sessions building Manut. The user opens N sessions, each takes a "bundle" from the table below. Each bundle is ~3-5 related tasks that share files / context and ship as 1-2 PRs.

### Bootstrap checklist (run on session start)

1. **Read the plan.** It lives at two equivalent paths:
   - `~/.claude/plans/expressive-popping-finch.md` (user's plan-mode artifact)
   - `docs/IMPLEMENTATION_PLAN.md` (committed in the repo — your canonical reference)
2. **Read `CLAUDE.md`** in the repo root for project workrules, critical scars, deploy architecture.
3. **Pick your bundle ID** from the table. Confirm with the user if ambiguous.
4. **Read only the relevant sections** of the plan for your bundle (M1 tasks for that epic, plus Part 0 if your bundle touches cloud conversion, plus the decisions table for any locked values your bundle references).
5. **Branch:** `feat/<area>-<topic>` (e.g. `feat/cloud-i18n-strip`, `feat/sidebar-phase-1`).
6. **Implement task-by-task.** Each task has acceptance criteria — verify before moving on.
7. **Ship as one or more PRs.** Small, focused, mergeable. Title format: `<type>(<scope>): <subject>`. Link bundle ID and decision references in the body.

### Bundle map (Week 1 — start here)

Dependency arrows: `A → B` means B depends on A merging first.

```
┌─────────────────────────────────────────────────────────────────┐
│ Week 1 bundles (parallel-safe groupings)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  B1: Cloud conversion — i18n + auth + quota                     │
│      ├── T-1.1.1.a/b (i18n strip)                                │
│      ├── T-1.1.2.a/b/c (remove self-host auth code)              │
│      └── T-1.1.5.a/b/c (Free tier quota)                         │
│      Touches: i18n, sign-in.tsx, quota service                   │
│      PRs: 2-3                                                    │
│                                                                  │
│  B2: Cloud conversion — landing pages + copy                     │
│      ├── T-1.1.3.a/b/c (Terms + Privacy)                         │
│      └── T-1.1.6.a (landing copy audit)                          │
│      Touches: manut-landing only                                 │
│      PRs: 1-2                                                    │
│      INDEPENDENT of B1 — can run in parallel                     │
│                                                                  │
│  B3: Welcome route + first-time workspace                        │
│      └── T-1.1.4.a/b/c (welcome flow)                            │
│      Touches: router, new welcome page, post-signin redirect     │
│      PRs: 1                                                      │
│      Depends on: B1 (needs auth changes merged)                  │
│                                                                  │
│  B4: Sidebar Phase 1 + Settings to avatar menu                   │
│      ├── T-1.2.1.a (utility footer)                              │
│      └── T-1.2.2.a (Settings in user-avatar menu)                │
│      Touches: root-app-sidebar/                                  │
│      PRs: 1-2                                                    │
│      INDEPENDENT of B1/B2/B3                                     │
│                                                                  │
│  B5: Design tokens refresh                                       │
│      └── T-1.3.1.a/b/c                                           │
│      Touches: theme.css / theme tokens                           │
│      PRs: 1                                                      │
│      INDEPENDENT of B1-B4                                        │
│                                                                  │
│  B6: Floating AI chat anchor v1                                  │
│      └── T-1.4.1.a/b/c/d                                         │
│      Touches: new floating-ai-chat-anchor/ component             │
│      PRs: 1 (feature-flagged)                                    │
│      Soft dep on B5 (uses new design tokens)                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Recommended Week 1 session orchestration:**

| Wave | Run in parallel                         | Wait for                                     | Hours |
| ---- | --------------------------------------- | -------------------------------------------- | ----- |
| 1    | B2 (landing), B4 (sidebar), B5 (tokens) | —                                            | ~6h   |
| 2    | B1 (cloud conv)                         | wave 1 merged (avoid sidebar/i18n conflicts) | ~10h  |
| 3    | B3 (welcome) + B6 (floating chat)       | B1 + B5 merged                               | ~12h  |

### Bundle map (Week 2+)

Expand task-level detail when bundle starts (per "Sub-agent handoff conventions" section). For now, story-level outline only:

| Bundle  | Epic                                                   | Effort | Dep                                  | Status                                                                                                |
| ------- | ------------------------------------------------------ | ------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| B7      | E1.5 Memory MVP                                        | 4d     | B1 (quota for AI budget tracking)    | ✅ `eb92e4b53`                                                                                        |
| B8      | E1.6 Mode + tool UX hybrid                             | 2d     | B6 (chat input is in floating chat)  | ✅ `54a708cfe`                                                                                        |
| B9      | E1.7 P1 tools (web_search, memory_search, tabs_browse) | 3d     | B7 (memory_search needs E1.5)        | deferred — existing `exa-search.ts` covers; memory injected per-turn via `injectMemoriesIntoMessages` |
| B10     | E1.8 Gmail + Calendar tool wrappers                    | 3d     | B8 (mode UX must exist)              | ✅ `1bbf388ec`                                                                                        |
| B11     | E1.9 Sidebar Phase 2 + customize sections              | 3d     | B4 (Phase 1 must ship first)         | ✅ `5035f3a6b`                                                                                        |
| B12     | E1.10 Quick actions + format selector                  | 3d     | B6 (chat must exist)                 | ✅ `88f0393e3`                                                                                        |
| B13     | E1.11 SSE → WebSocket                                  | 5d     | None (can start anytime; impacts B6) | ✅ `51e9e9ae3` (flag-gated; SSE stays 30d)                                                            |
| B14     | E1.12 Per-workspace AI cap                             | 1d     | B1 (quota) + B7 (memory cost)        | ✅ `0827c3e32` (migration) + `3a615e858` (service)                                                    |
| B15-B23 | M2 epics (one per epic)                                | varies | see plan                             | ✅ — see M2 table above                                                                               |
| B24-B30 | M3 epics (one per epic)                                | varies | see plan                             | ✅ — see M3 table above                                                                               |

### Critical scars to avoid (from CLAUDE.md)

| Scar                                          | What to do                                                                                                                                                                                                                                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sub-agent worktree drops                      | After spawning agents, `git diff HEAD -- <file>` every wiring point you claimed to touch. Don't trust "done" reports.                                                                                                                                                                               |
| `tsc -b` emits files into `src/`              | Use `yarn workspace @affine/<pkg> tsc --noEmit`. Never `tsc -b`.                                                                                                                                                                                                                                    |
| Stale `.js`/`.d.ts` in `src/` poisons bundle  | Wipe before bundle: `find packages/frontend/core/src packages/frontend/component/src packages/frontend/i18n/src blocksuite -type f \( -name "*.js" -o -name "*.js.map" \) -not -path "*/node_modules/*" -delete`. **NEVER widen to `.d.ts`** — several hand-authored `.d.ts` files exist in `src/`. |
| `@nestjs/graphql` `@Field` nullable trap      | ALWAYS pass explicit type to nullable `@Field`: `@Field(() => String, { nullable: true })`. Never `@Field({ nullable: true }) foo?: string \| null;` — causes `UndefinedTypeError` server crash.                                                                                                    |
| NestJS DI `import type` on injected target    | Never `import type` for `@Injectable` constructor params; use runtime imports.                                                                                                                                                                                                                      |
| Missing `@Injectable()` decorator on provider | Every class in `providers[]` must have `@Injectable()`.                                                                                                                                                                                                                                             |
| Pre-commit hook tsgolint Go panic             | Use `--no-verify` on commits when the panic appears (pre-existing environmental issue, not your code). Document it in commit body.                                                                                                                                                                  |
| vanilla-extract `.css.ts` in Node VM          | Imports into `.css.ts` evaluate in a DOM-less VM. Don't import package roots that drag HTMLElement-touching siblings. Use relative paths or raw CSS vars.                                                                                                                                           |
| Migration P3018 collision                     | Make all migrations idempotent: `CREATE TYPE` → `DO $$ EXCEPTION WHEN duplicate_object`; `ADD COLUMN` → `IF NOT EXISTS`; `CREATE TABLE` → `IF NOT EXISTS`; `ADD CONSTRAINT` → `DO $$ EXCEPTION WHEN duplicate_object`.                                                                              |
| Sub-agent reports victory but didn't wire     | `git diff HEAD~1 -- <wired-file>` for every registration point.                                                                                                                                                                                                                                     |

### Access + secrets

- **Railway CLI token** at `~/.railway/config.json` → `.user.accessToken`. Use it for direct GraphQL: `curl -X POST https://backboard.railway.com/graphql/v2 -H "Authorization: Bearer $TOKEN" ...`. Examples in the session history.
- **Prod DB** (Railway Postgres) accessible via public proxy: `postgresql://postgres:<REDACTED — ROTATE THIS CREDENTIAL>@<railway-pg-proxy-host>:<port>/railway`. Use for `prisma migrate deploy` from local.
- **Resend** (mailer) already set on Railway: `MAIL_PROVIDER=resend`, `RESEND_API_KEY`, `RESEND_FROM=noreply@gogocash.co`. Domain `gogocash.co` verified in Resend.
- **GitHub gh CLI** authenticated. Use for `gh pr create`, `gh run list`, `gh api`.
- **Exa API key** — to be added in B9; user provides.
- **Stripe API key** — to be added in M3; user provides.
- **Modal API token** — to be added in M3; user provides.

### Per-PR conventions

- **Title:** `<type>(<scope>): <subject>` — types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`. Subject ≤72 chars.
- **Body:** include the bundle ID + task IDs + decision references. Acceptance criteria → checked off.
- **Branch:** `feat/<area>-<topic>` or `fix/<area>-<topic>`.
- **No `--amend` on published commits** unless user OKs.
- **`--no-verify` only when tsgolint panic blocks** — document in commit body.
- **Don't push directly to `main`** — always via PR.
- **R-tier**: state in PR body (R0 / R1 / R2 per CLAUDE.md §2.5).
- **Test plan**: include in PR body. Be specific.

### Opening prompt template for fresh sessions

Paste this as the first message in a new Claude Code session:

```
I'm picking up bundle <BUNDLE_ID> from docs/IMPLEMENTATION_PLAN.md.

Please:
1. Read docs/IMPLEMENTATION_PLAN.md (the bundle map + the relevant epic's task list)
2. Read CLAUDE.md (project workrules + scars)
3. Confirm the bundle's tasks before starting
4. Branch, implement task-by-task with verification per acceptance criteria
5. Ship 1-2 focused PRs with the conventions in the plan's "Per-PR conventions" section

Work without stopping for confirmation; surface decisions only when ambiguous.
```

Replace `<BUNDLE_ID>` with B1, B2, etc.

---

## Plan ↔ decision audit (verification table)

Every decision in the locked table maps to concrete plan content:

| #   | Decision                                         | Implemented in plan section             |
| --- | ------------------------------------------------ | --------------------------------------- |
| 0   | Multi-tenant cloud SaaS                          | Part 0 (entire)                         |
| 1   | 3-month timeline                                 | Work breakdown M1-M3                    |
| 2   | GitHub connector first                           | E2.1                                    |
| 3   | Floating chat is THE surface                     | E1.4, decision #16 retires Intelligence |
| 4   | Extend manut-landing visual identity             | E1.3 (B1)                               |
| 5   | Memory per-user + per-workspace                  | E1.5 + E2.2                             |
| 6   | Lean stack: Exa + pgvector + Vertex              | A1 + A3                                 |
| 7   | $50/workspace cost ceiling default               | E1.12                                   |
| 8   | Slide right + auto-switch context                | E1.4 description                        |
| 9   | Friendly+smart, gemini-2.5-flash default         | A1 + prompt system                      |
| 10  | Hybrid mode UX (modes + advanced)                | E1.6                                    |
| 11  | Phase 1 utility footer Week 1, keep AIChatButton | E1.2 (T-1.2.1.a)                        |
| 12  | Forever memory, no digest                        | A3 + Open/deferred                      |
| 13  | Both code-run + image-gen by Month 3             | E3.1 + E3.2                             |
| 14  | Framer + dark default + opt-in sound             | E1.3 + E2.7 + E2.8                      |
| 15  | Tabbed multi-chat + auto-detected quick actions  | E2.5 + E1.10                            |
| 16  | Demote Graph/Analytics, retire Intelligence      | E2.x sidebar work + chat surface        |
| 17  | Onboarding wizard Week 4-6                       | E2.9 (NEW row in M2)                    |
| 18  | Direct ship + standard telemetry                 | B13 + E3.5                              |
| 19  | Pro tier $20/user Month 3                        | E3.3                                    |
| 20  | Settings in user-avatar menu                     | E1.2 → T-1.2.2.a (NEW task)             |
| 21  | Keep BlockSuite + Lucide hybrid                  | Open/deferred (explicit no-op)          |
| 22  | Extend FeatureFlagService, manual rollback       | E1.4 flag pattern                       |
| 23  | SSE → WebSocket                                  | E1.11                                   |
| 24  | Fully cloud-only, remove self-host paths         | Part 0.2                                |
| 25  | Open public sign-up                              | Part 0.4                                |
| 26  | Free tier: unlimited members + 2GB + $5 AI       | Part 0.3 + E1.1 / US-1.1.5              |
| 27  | Cloud conversion Week 1                          | Part 0 (entire) + Week 1 PR sequence    |

All 28 decisions present + executable. No orphaned decisions. No plan content without a backing decision.

---

_Last updated 2026-05-20 — delivery snapshot added after PR #121 landed all 12 waves. Update by PR._
