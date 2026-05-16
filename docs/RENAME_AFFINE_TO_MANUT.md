# AFFiNE → Manut Rename — Staged Plan

**Status:** Decision document. No code yet. Each tier below requires its own
explicit sign-off before execution.

**Author of this doc:** session 2026-05-16, after user requested R0-scope
rename. Per CLAUDE.md §2.5 the full R0 cannot be executed in one session —
this triages by feasibility and produces an order of operations.

**Prior art:** The brand rename to Manut shipped in v1.11.0 (user-visible
strings, frontend `modules/manut-*`, backend `plugins/manut/`, i18n keys
`com.manut.*`, Prisma `Mn*` models). v1.12.1 closed out the GraphQL
`Superflow*` decorators and most internal symbols. This doc enumerates what
still says "AFFiNE" or "superflow" and proposes how to resolve each.

---

## Triage at a glance

| #   | Surface                                                                                                                    | Tier   | Effort                                                                                               | Owner                                              | Reversible?                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------- |
| G1  | Browser tab title + page titles                                                                                            | 🟢 R1  | < 1 day                                                                                              | one engineer                                       | yes — code revert                                                           |
| G2  | In-product copy: "AFFiNE AI", "Open in AFFiNE app", "AFFiNE Cloud", "AFFiNE Premium"                                       | 🟢 R1  | 1–2 days                                                                                             | one engineer                                       | yes — code revert                                                           |
| G3  | `Chat With AFFiNE AI` prompt name + AFFiNE references in prompt bodies                                                     | 🟢 R1  | < 1 day + deploy dance                                                                               | one engineer                                       | yes — re-seed prior prompt                                                  |
| G4  | i18n `en.json` "AFFiNE" leaks in user-visible labels                                                                       | 🟢 R1  | 1–2 days                                                                                             | one engineer + translator review for other locales | yes — code revert                                                           |
| G5  | Code comments + inline docs containing "AFFiNE"                                                                            | 🟢 R2  | half day                                                                                             | one engineer                                       | yes — code revert                                                           |
| G6  | `README.md`, `docs/**`, handover artefacts                                                                                 | 🟢 R2  | half day                                                                                             | one engineer                                       | yes — code revert                                                           |
| Y1  | Docker image name `affine-gogocash` → `manut` (and `affine-gogocash-cache`)                                                | 🟡 R1+ | 1 day code + coordinated push + VM swap                                                              | one engineer + ops                                 | yes — keep old tag, leave compose pointing at it during cutover             |
| Y2  | Compose container names (`affine_server`, `affine_migration_job`)                                                          | 🟡 R1+ | 1 day + ~30s downtime                                                                                | one engineer + ops                                 | yes — restore old compose backup                                            |
| Y3  | GCP Artifact Registry repo path (`affine/affine-gogocash`)                                                                 | 🟡 R1+ | 1 day + workflow edits in lockstep with Y1                                                           | one engineer + ops                                 | yes — keep old repo populated through cutover                               |
| Y4  | VM hostname `affine-vm` + Caddy site name                                                                                  | 🟡 R1+ | days — new VM, static IP detach/reattach                                                             | ops                                                | partial — DNS and IP can swap back                                          |
| Y5  | BullMQ Redis queue prefix `superflow` → `manut` (`superflow.deliverReminder` job name)                                     | 🟡 R1+ | 1 day code + quiet-window deploy                                                                     | one engineer + ops                                 | hard — in-flight jobs orphan at cutover                                     |
| Y6  | Env var `ENABLE_SUPERFLOW_MODULE` (current BC alias) → drop alias                                                          | 🟡 R1  | < 1 day + comms to operators                                                                         | one engineer                                       | yes — restore alias                                                         |
| Y7  | Remaining `// SUPERFLOW` comments + dormant decorators / job names                                                         | 🟡 R2  | half day                                                                                             | one engineer                                       | yes                                                                         |
| R1  | GCP project id `affine-495114`                                                                                             | 🔴 R0  | **weeks** — new project + full migration + multi-hour outage                                         | ops + IT + finance                                 | extremely hard — separate project must be kept active for rollback period   |
| R2  | BlockSuite block-type strings (`affine:paragraph`, `affine:database`, ~40 more — persisted in every YDoc in production DB) | 🔴 R0  | **multi-quarter** — requires custom YDoc-rewriting migration over every doc; one mistake = data loss | engineer + DBA + careful staged rollout            | extremely hard — would need bi-directional YDoc rewrites                    |
| R3  | `@affine/*` npm workspace package names (~30 workspaces, ~10k+ import lines)                                               | 🔴 R0  | **multi-quarter** — every future upstream sync becomes hand-resolved conflict                        | engineer(s)                                        | impossible — once you fork the package names you cannot cheaply re-converge |

🟢 = safe to do this quarter, single PR each
🟡 = doable but coordinated, each its own ticket with operations sign-off
🔴 = either impossible (GCP project id) or so costly the cost-benefit is overwhelmingly negative

---

## Section 1 — 🟢 GREEN: safe-to-do (R1, single PRs)

### G1. Browser tab title + page titles

**Where:** the user's screenshot showed "All docs · AFFiNE" and "Reminders ·
AFFiNE" in the Chrome tab. These come from the per-page title formatter in
the frontend.

**What to grep:**

```
rg -t ts -t tsx -t html '"AFFiNE"|· AFFiNE|document\.title' packages/frontend
```

**Files to expect:**

- `packages/frontend/apps/web/index.html` (`<title>` tag)
- The per-page title hook (search for `useDocumentTitle` or similar)
- Per-page `<title>` overrides in router pages

**Risk:** trivial. CSS doesn't depend on these strings; no GraphQL contract;
no DB.

**Rollback:** `git revert <sha>`.

**Verification:** `/browse` the site after deploy, confirm tab text is
"Manut".

---

### G2. In-product copy: "AFFiNE AI", "Open in AFFiNE app", etc.

**Where:** discovered via grep — 20+ frontend files contain hardcoded
`AFFiNE AI`, `Open in AFFiNE app`, `AFFiNE Cloud`, `AFFiNE Premium`:

```
packages/frontend/templates/stickers-templates.gen.ts
packages/frontend/i18n/src/i18n.gen.ts
packages/frontend/core/src/modules/open-in-app/utils.ts
packages/frontend/core/src/blocksuite/ai/messages/error.ts
packages/frontend/core/src/blocksuite/ai/provider/prompt.ts
packages/frontend/core/src/blocksuite/ai/provider/setup-provider.tsx
packages/frontend/core/src/blocksuite/ai/extensions/ai-slash-menu.ts
packages/frontend/core/src/desktop/pages/index/index.tsx
packages/frontend/core/src/modules/ai-button/services/models.ts
packages/frontend/core/src/components/workspace-selector/workspace-card/index.tsx
packages/frontend/core/src/components/hooks/affine/use-enable-cloud.tsx
packages/frontend/component/src/ui/avatar/avatar.stories.tsx
packages/frontend/admin/src/modules/settings/use-app-config.spec.ts
packages/frontend/core/src/mobile/dialogs/setting/user-profile/index.tsx
packages/frontend/component/src/components/affine-banner/local-demo-tips.tsx
packages/frontend/apps/electron-renderer/src/popup/recording/index.tsx
packages/frontend/core/src/blocksuite/ai/components/ai-chat-messages/ai-chat-messages.ts
packages/frontend/core/src/blocksuite/ai/components/playground/content.ts
packages/frontend/core/src/blocksuite/ai/components/playground/chat.ts
packages/frontend/core/src/blocksuite/ai/components/ai-message-content/assistant-avatar.ts
```

**Approach:** read each file individually — do NOT blind-replace. Many of
these will reference CSS class names like `affine-banner` (G5 territory),
not user-visible copy. Spot the actual JSX/template strings.

**Two examples worth treating carefully:**

- `setup-provider.tsx` — sets the AI provider's name, which appears in the
  intro card. Renaming the provider key (not just the display name) could
  break stored chat sessions. Display name only.
- `open-in-app/utils.ts` — the "Open in AFFiNE app" banner (visible at the
  bottom of the screenshot). The banner text is safe to rename. The
  underlying deeplink scheme (`affine://`) is NOT — that's registered with
  the OS and renaming it requires a Tauri/Electron app rebuild + OS
  re-registration (R0).

**Risk:** medium. Easy to accidentally rename a CSS class or deeplink scheme.

**Rollback:** `git revert <sha>`.

**Verification:** `/browse` post-deploy. Open the AI sidebar, the workspace
selector, the open-in-app banner. Confirm copy says "Manut" but the
underlying functionality still works (especially the open-in-app deeplink).

---

### G3. `Chat With AFFiNE AI` prompt name + prompt body AFFiNE refs

**Where:** [packages/backend/server/src/plugins/copilot/prompt/prompts.ts](packages/backend/server/src/plugins/copilot/prompt/prompts.ts)

The seeded `Chat With AFFiNE AI` prompt is the most visible — it's the
name shown in the AI chat dropdown. There are also AFFiNE references in
prompt **bodies** (e.g. the "Elite Editorial Specialist for AFFiNE" role
prompt, the `{{affine::language}}` template variables, model fetch URLs
pointing at `https://models.affine.pro/`).

**Approach (per CLAUDE.md §6c four-step dance):**

1. Edit `prompts.ts` — rename prompt entries (`chat: ['Chat With Manut AI']`,
   etc.) and rewrite AFFiNE references in prompt bodies.
2. **Rebuild server bundle**: `yarn affine bundle -p @affine/server`. The
   prompts list is bundled into `dist/main.js`; without a rebuild the
   server-startup upsert can't see your change.
3. Update the deploy gate (`scripts/...`) to check for the NEW prompt
   name. The current gate checks `Chat With AFFiNE AI` and will fail-fast
   if it's missing — that's actually a feature, but you need to update it
   in the same PR or the deploy auto-rollback fires.
4. Rebuild + push image (`Dockerfile.fullstack` snapshots `dist/main.js`).

**Frontend co-changes needed in same PR:**

- The chat dropdown reads the prompt name. Search for
  `'Chat With AFFiNE AI'` in `packages/frontend/core/src/blocksuite/ai/`.
- The "auto" route's `optionalModels` references the prompt by name.

**Risk: HIGH. This is the single highest-risk 🟢 item.**

- `{{affine::language}}` is a **template variable** read by the prompt
  engine at request time. Renaming requires also renaming the consumer.
  If you rename the template var without the consumer, every chat fails
  silently. Grep for `affine::` carefully.
- Some prompts reference `https://models.affine.pro/` as a model file URL
  for image-generation. These are real CDN URLs — DO NOT rename them.
  They serve actual model weights.
- The four-step dance trap (CLAUDE.md §6c) — skipping any step ships a
  half-applied prompt change.

**Rollback:** revert the commit AND re-seed the prior prompts. The DB has
the latest seeded copy; a restart with the reverted code re-upserts the
prior text (because `modified=false` in the DB row).

**Verification:** after deploy, open the AI sidebar, send a test message,
confirm the dropdown shows "Manut" prompt names and the response is sane
(template variables resolved).

---

### G4. i18n `en.json` user-visible AFFiNE leaks

**Where:** [packages/frontend/i18n/src/resources/en.json](packages/frontend/i18n/src/resources/en.json) —
2093 case-insensitive matches for "affine". Most are CSS class names (in
strings) or non-visible keys, but a meaningful slice are visible labels.

**Approach:**

1. `rg -t json '"[^"]*\bAFFiNE\b[^"]*"' packages/frontend/i18n/src/resources/en.json`
   to find visible strings (case-sensitive "AFFiNE" is more likely user-
   visible than lowercase "affine" which tends to be class/identifier).
2. For each match, find the consumer via `rg 'i18n\.t.*<key>'` to confirm
   it's actually rendered.
3. Rename keys ONLY if `com.affine.*` is exposed to users — and only if
   you don't break the `com.affine.*` → `com.manut.*` migration already
   in flight per v1.11.0.
4. Other locales (`zh.json`, `ja.json`, `fr.json`, etc.) need a translator
   pass for the renamed strings — flag for the translation team rather
   than DIY in this PR.

**Risk:** medium-high. i18n key changes can break translations.

**Rollback:** `git revert <sha>`. The DB doesn't reference i18n keys; this
is pure frontend.

**Verification:** `/browse` the surfaces touched. Switch locales if you
have non-EN coverage, confirm no key-missing fallbacks render.

---

### G5. Code comments + inline docs containing "AFFiNE"

**Where:** everywhere. `rg -t ts -t tsx '// .*AFFiNE|/\* .*AFFiNE'` will
find them.

**Approach:** mechanical search-and-replace in comments only. Be careful
NOT to touch:

- JSDoc `@see` links to upstream AFFiNE source (those are legitimate
  attribution to the upstream project).
- Code identifiers — only the comment text.

**Risk:** trivial. Comments don't affect runtime.

**Rollback:** `git revert <sha>`.

**Verification:** `git diff --shortstat` should show comment-only changes.
Run the test suite (it shouldn't change behaviour at all).

---

### G6. README, docs, handover artefacts

**Where:** root `README.md`, `docs/**`, `CLAUDE.md` itself, the handover
artefact templates in `scripts/manut-release-handover.mjs`.

**Approach:** sweep + read carefully. Distinguish:

- "Manut is a fork of AFFiNE" — keep AFFiNE here (attribution).
- "AFFiNE provides..." — rename to "Manut provides..." (product copy).

**Risk:** trivial.

**Rollback:** `git revert <sha>`.

---

## Section 2 — 🟡 YELLOW: coordinated R1+ (each its own ticket)

### Y1. Docker image name `affine-gogocash` → `manut`

**Where:** referenced in 8 GitHub workflow files + the VM's
`/srv/affine/compose/compose.yml` + the Caddy config + the
`affine-gogocash-cache:buildx` cache image:

```
.github/workflows/manut-autodeploy.yml      GAR_REPO=...affine-gogocash
.github/workflows/manut-build.yml           GAR_REPO=...affine-gogocash
.github/workflows/manut-deploy.yml          GAR_REPO=...affine-gogocash
.github/workflows/manut-railway-deploy.yml  GAR_REPO=...affine-gogocash
.github/workflows/manut-release.yml         GAR_REPO=...affine-gogocash
.github/workflows/manut-rollback.yml        GAR_REPO=...affine-gogocash
                                            + grep pattern for old tag
.github/workflows/manut-vm-init.yml         grep pattern for old tag
+ GAR_CACHE_REPO=...affine-gogocash-cache:buildx (release.yml)
```

Plus VM-side at `/srv/affine/compose/compose.yml` — the `image:` line for
the `affine` service.

**Approach (safe cutover):**

1. PR step 1: Push the FIRST `manut:<tag>` image alongside `affine-gogocash:
<tag>` from the next release. Workflow change keeps pushing BOTH for
   one release cycle. No VM change yet.
2. PR step 2: Update VM `compose.yml` to point at `manut:<tag>`. Backup
   prior compose. Deploy. Smoke-test. If green, leave the old image in
   GAR but no longer push it.
3. PR step 3: Drop the dual-push from workflows. The old image remains
   in GAR untouched as a rollback target.

**Risk:**

- The CLAUDE.md §6 trap "`docker compose pull <service>` needs SERVICE
  name, not container name" applies — if you accidentally type the new
  image name as a service name, pull silently no-ops.
- Cache image swap means first build after rename is uncached → 15–20 min
  slower CI for one build.

**Rollback:** restore old `compose.yml` (the backup convention at
`/srv/affine/compose/compose.yml.pre-<feature>.bak` per CLAUDE.md §5).

**Verification:** post-deploy smoke (§4 of CLAUDE.md). Image-name check:
`ssh ... 'grep image: /srv/affine/compose/compose.yml'` should show the
new name. `docker images` on the VM should show both old and new tags
present for at least one release cycle.

---

### Y2. Compose container names

**Where:** VM-side `compose.yml`:

```yaml
services:
  affine:
    container_name: affine_server # ← rename to manut_server
  affine_migration:
    container_name: affine_migration_job # ← rename to manut_migration_job
```

**Risk:** any monitoring or scripts that grep for `affine_server` (e.g. on-
call dashboards, log alerts) break at cutover.

**Approach:** bundle with Y1. New names go in same VM swap.

**Rollback:** same as Y1.

---

### Y3. GCP Artifact Registry repo path

**Where:** `asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash`
— the `/affine/` segment is the _repository name_ within the GCP project
(not the project id, which is R1 territory).

**Approach:**

1. `gcloud artifacts repositories create manut --location=asia-southeast1 --repository-format=docker`
2. Update workflows to push to the new repo path.
3. Run side-by-side with old repo for one release cycle.
4. Delete the old repo only after rollback window passes.

**Risk:** any service-account permission that's scoped to the old repo
needs the new repo added. Verify before cutover.

**Cost:** GCP Artifact Registry charges for storage and egress per repo.
Two copies for a release cycle ≈ 2× cost for that window.

---

### Y4. VM hostname `affine-vm` + Caddy site name

**Where:** GCP Compute instance name `affine-vm` in project `affine-495114`.

**Approach:** GCP instance names are mutable IF you recreate the VM
(detach disk, delete instance, create new with same disk + same static
IP). ~30 min outage minimum. Alternatively, leave the hostname as
`affine-vm` and only rename the Caddy site label (zero-downtime).

**Recommendation:** rename Caddy site only. The VM hostname is internal —
no user ever sees it.

---

### Y5. BullMQ Redis queue prefix `superflow` → `manut`

**Where:**

```
packages/backend/server/src/core/config/types.ts:    QueueName.MANUT = 'superflow'
packages/backend/server/src/plugins/manut/manut-reminder.job.ts:   'superflow.deliverReminder' (job name string, persisted in Redis)
```

**Risk:** in-flight queued jobs reference `'superflow.deliverReminder'`.
If you rename the consumer to listen on `'manut.deliverReminder'`,
queued-but-unprocessed jobs are orphaned. The reminder cron schedules
hourly, so the orphan window is bounded by an hour.

**Approach (safe):**

1. Add a NEW listener on `'manut.deliverReminder'` while keeping the OLD
   listener. Both deliver via the same handler.
2. Schedule NEW jobs only with the new name.
3. Wait ≥ 1 hour for the queue to drain old jobs.
4. Remove the old listener.

**Risk:** if you skip the drain step and an op fires `BullMQ` retries of
old failed jobs after the cutover, they orphan permanently.

**Recommendation:** **defer indefinitely.** The string `'superflow'` in
Redis is invisible to users and operators. Renaming it carries real risk
for zero user benefit. Track as a known-but-unblockified item.

---

### Y6. Env var `ENABLE_SUPERFLOW_MODULE` → drop the BC alias

**Where:** [packages/backend/server/src/plugins/manut/manut-routine.cron.ts:50](packages/backend/server/src/plugins/manut/manut-routine.cron.ts:50)
and [packages/backend/server/src/plugins/manut/manut.module.ts:56](packages/backend/server/src/plugins/manut/manut.module.ts:56)
honor both `ENABLE_MANUT_MODULE` and the legacy `ENABLE_SUPERFLOW_MODULE`.

**Approach:**

1. Log a deprecation warning when the legacy var is set (next release).
2. After 1–2 release cycles, drop the alias.
3. Comms: surface in release notes for self-hosted operators.

**Risk:** any operator who still has the legacy var set loses the gating
behaviour at cutover. Mitigation = the deprecation warning window.

**Cost:** essentially free. Just needs scheduling.

---

### Y7. Remaining `// SUPERFLOW` comments + dormant decorators

**Approach:** mechanical comment sweep. Per CLAUDE.md §9 most were
renamed in v1.12.1 — this is the cleanup pass for whatever drifted in.

**Risk:** trivial.

---

## Section 3 — 🔴 RED: not-here, not-now, costs documented

### R1. GCP project id `affine-495114` rename

**Status: impossible. Document the cost so the discussion can be had
above the engineering pay grade.**

GCP project ids are **immutable** by design. The only path to a different
project id is:

1. Create a new project (e.g. `manut-prod`).
2. Set up billing, IAM, service accounts, OAuth clients in the new
   project. (Google OAuth clients are project-scoped — you need to
   re-create them, then update self-hosted operators with new client
   IDs. Existing OAuth tokens in `IntegrationConnection` rows are tied
   to the old client ID and DO NOT MIGRATE.)
3. Set up new Artifact Registry, push images.
4. Create new GCE instance, detach the static IP from the old VM, attach
   to the new VM, restore disk snapshot. Or live-migrate the data.
5. Set up new Cloud DNS / update Cloudflare to point at new VM.
6. Cutover the production traffic. **Hours of outage minimum**, unless
   you orchestrate a side-by-side read replica which is its own multi-
   week project.
7. Keep the old project alive for a rollback window of 30–90 days.
8. Delete the old project.

**Cost estimate:** 4–8 engineer-weeks. Multi-hour outage. Significant
risk of data loss if any of the steps are wrong. **Most importantly:
every Google OAuth credential that any user has connected (via the Gmail
/ Drive integrations) breaks at cutover** because OAuth tokens are tied
to the old client ID. Users would need to re-link.

**Recommendation: do not attempt unless there is a regulatory or legal
requirement that the GCP project name must not contain "affine".** Then
revisit with a written migration plan reviewed by ops + security.

---

### R2. BlockSuite block-type strings (`affine:*`)

**Status: not feasible without a custom YDoc migration. Bricks every
existing doc otherwise.**

BlockSuite — the editor library upstream from AFFiNE — uses block-type
strings of the form `affine:paragraph`, `affine:database`, `affine:code`,
~40 more. These strings are NOT just code identifiers. They are
**persisted as binary YDoc state in every doc snapshot** in the
production Postgres database (`workspace_pages` table, `blob` column).

**Renaming the source code alone:**

- Old docs still contain `"affine:paragraph"` in their YDoc binary.
- New code looks for `"manut:paragraph"`.
- Result: every existing doc loads as empty / errors / blank.

**The actual fix:**

1. Write a YDoc-rewriting migration job that reads every blob from
   `workspace_pages`, parses the YDoc, walks every block, rewrites
   `affine:*` → `manut:*`, writes back.
2. Test this on a staging copy of the production database first.
3. Run the migration during a maintenance window. Estimate: hours of
   downtime for a large workspace count.
4. Cut over the code at the same time.
5. Build a rollback path that can re-rewrite `manut:*` → `affine:*` in
   case the migration corrupts state.

**Cost estimate:** 4–8 engineer-weeks for the migration + testing.
High risk of data loss. **Multi-quarter project.**

**Recommendation: do not attempt.** Block type names are an internal
implementation detail invisible to users. The cost-benefit is
overwhelmingly negative. Document as "namespaces stay `affine:` for
data-compatibility reasons" in `CLAUDE.md` §9.

---

### R3. `@affine/*` npm workspace package names

**Status: doable mechanically. Costly forever.**

This fork has ~30 npm workspaces, all named `@affine/*` (`@affine/core`,
`@affine/server`, `@affine/web`, `@affine/component`, etc.). They are
referenced in ~10,000+ `import` lines across the codebase.

**Renaming is mechanical:**

```bash
# in each workspace's package.json
"name": "@affine/X" → "@manut/X"

# every import in the codebase
import { x } from '@affine/y'  →  import { x } from '@manut/y'
```

A coordinated multi-agent sweep COULD do this in one PR.

**The cost is permanent:**

- Every future upstream sync from `toeverything/AFFiNE` is now a hand-
  resolved conflict on every file with an import. **Every file. Forever.**
- The fork loses the ability to cheaply consume upstream's bug fixes,
  features, and security patches.
- Per CLAUDE.md §9 this was _intentionally deferred_ for exactly this
  reason.

**Recommendation: do not rename.** The `@affine/*` prefix is invisible
to end users (it's a source-code artefact). Renaming it makes the fork
strictly worse at consuming upstream work for zero user-visible benefit.

If branding cleanliness in source code is a hard requirement, the
correct path is to add `@manut/*` package aliases that re-export
`@affine/*`, write new code against `@manut/*`, and gradually migrate.
That preserves upstream merge surface. But that's ALSO a multi-quarter
project, and the benefit is essentially aesthetic.

---

## Section 4 — Recommended order of operations

If you want to make visible progress on the rename without taking on
unbounded risk:

### This quarter (low risk, single PRs)

1. **G1** — browser tab title sweep (~1 day)
2. **G5** — code comments sweep (~half day)
3. **G6** — README + docs sweep (~half day)
4. **G2** — frontend in-product copy sweep (~1–2 days)
5. **G4** — i18n key sweep, EN locale only (~1–2 days)
6. **G3** — prompt rename with full 4-step dance (~1 day + careful deploy)

Order matters: G5/G6/G1 first because they're trivial and visibly closeout
the easy work. G2/G4 next because they need browser verification. G3 last
because it's the highest-risk 🟢 item and benefits from the deploy muscle
warmed up by the prior shipments.

**Total estimate:** 5–8 engineer-days plus 5–6 deploy windows.

### Next quarter (coordinated R1+, ops involvement)

7. **Y1 + Y2 + Y3** — Docker image + container names + GAR repo (bundle
   into one ops coordination window) (~3–5 days code + 1 day cutover)
8. **Y6** — drop legacy env var alias (~half day)
9. **Y7** — comment sweep for any drift (~half day)
10. **Y4** — Caddy site label only (skip the VM hostname rename)

### Backlog (defer indefinitely)

- **Y5** — BullMQ Redis prefix (high risk, zero user benefit)
- **R1, R2, R3** — see above. Document in CLAUDE.md §9 as "intentionally
  not done."

### Not on this list (still on intentional-BC list)

- `superflow` queue prefix (Y5, deferred)
- `affine://` deeplink scheme (would need Tauri/Electron rebuild + OS re-
  registration — R0 territory)
- `affine` BlockSuite namespace (R2, deferred)

---

## Section 5 — Acceptance contract

Before any item in this doc is executed, the engineer takes on this
contract:

- [ ] Item ID (e.g. G1) named in commit subject and PR title
- [ ] Plan posted in chat per CLAUDE.md §2.6 template before any code
- [ ] Rollback command documented in PR description
- [ ] Smoke-test items from CLAUDE.md §4 applicable to the change run
      pre-deploy
- [ ] Verification evidence (browse screenshot or curl output) posted
      after deploy
- [ ] No bundling of items across tiers in one PR (one Green item per
      PR, one Yellow item per PR with explicit ops sign-off)
- [ ] Items in 🔴 are NEVER attempted without a separate written
      migration plan reviewed by ops + security

---

## Appendix A — Things this doc deliberately does NOT cover

- **Translation work for non-EN locales.** Once G2/G4 land in English,
  the translation team needs a separate pass. That's a process question,
  not an engineering question.
- **Marketing site / public docs.** This fork is self-hosted FOSS; if you
  have a public marketing site at manut.gogocash.co or elsewhere, that's
  a separate codebase.
- **OAuth client display name in Google Cloud Console.** This is a one-
  click GCP console change, not a code change. Schedule it alongside Y1
  for visibility consistency.
- **Customer comms.** Self-hosted operators will see the visible quota
  change from G1–G4 land. If you have a comms channel, queue a release
  note.

---

## Appendix B — What this doc replaces / supersedes

- The "Deferred rename items" section of `CLAUDE.md` §9 — that section
  lists items at a single bullet level; this doc gives them feasibility
  tiers and execution sequencing. Future CLAUDE.md updates should point
  at this doc rather than re-listing the surfaces.
- Any informal "we should rename X" notes scattered in commit messages.
  Triage them into this doc rather than tracking them ad-hoc.

---

_Last updated: 2026-05-16. Edits via PR only. Do not silently re-tier an
item without surfacing the change in a PR description._
