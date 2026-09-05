# Phase 13 — Final rebase, release readiness and PR creation

The programme is now **one commit on top of `origin/dev`**, with no force-push, no history
rewrite, and nothing discarded.

---

## 1. Before state

| | |
|---|---|
| Branch | `fix/proposal-chain-payload-and-fixed-stages` |
| `HEAD` | `88eafe4d` |
| Modified / deleted / untracked | 113 / 1 / 128 |
| Staged | 0 |
| Upstream | `origin/fix/proposal-chain-payload-and-fixed-stages` — **diverged: 1 ahead, 1 behind** |
| vs `origin/dev` | **138 behind, 2 ahead** |

### Two discoveries that changed the plan

**The branch had diverged from its own remote.** Local `88eafe4d` and remote `0d777412` carry the
same commit message — the branch was amended after publishing. Pushing this branch would have
required `--force-with-lease` and destroyed `0d777412`.

**Both commits "ahead of dev" were already in dev under different SHAs.** The proposal-chain fix
landed as PR #1082 (`94f8d625`) and the docs commit as PR #1081 (`327fab18`). I verified this by
content, not by message: **13 of the 14 files in `88eafe4d` are byte-identical to `origin/dev`**
(only `CLAUDE.md` differs, and only because dev has 138 commits of later edits).

So this branch's own work was finished and merged, and its name described work that no longer
needed doing.

**Consequence: a safer route existed than rebasing a diverged, published branch.** The brief asks
not to force-push unless there is no safer option — there was one. The programme was committed as
a safety anchor, then applied to a **new branch cut from `origin/dev`**:

```
claude/responsive-pwa-release  =  origin/dev (097df257)  +  1 commit
```

No force-push. No history rewrite. `0d777412` untouched on the remote.

---

## 2. Latest dev commit

`097df257` — *Merge pull request #1184 from The-Binary-Holdings/claude/staging-advance-backfill*

---

## 3. Rebase

Applied as a cherry-pick of the programme commit onto a fresh branch from `origin/dev`. Final
topology: **0 behind, 1 ahead** — a clean linear history with exactly one commit to review.

---

## 4. Conflicts — 12 files

| Type | Count | Files |
|---|---|---|
| Content (`UU`) | 7 | both deploy workflows, `turbo.json`, `(dashboard)/layout.tsx`, `layout/sidebar.tsx`, `accounting/invoices-tab.tsx`, `opportunities/pipeline-kanban.tsx` |
| Modify/delete (`DU`) | 5 | every `components/sales-revenue/*` file the programme had touched |

---

## 5. Conflict resolutions

### 5.1 The Sales Revenue module was retired by dev — the biggest decision

`dev` **retired the entire Sales Revenue module** in PR #1164 (*"retire the ARIA Revenue module;
add the Unassigned sidebar view"*). Verified: `git ls-tree origin/dev` returns **0 files** for both
`apps/web/src/components/sales-revenue/` and the `/sales-revenue` route.

The programme had spent Phases 10 and 10A on those files. **That work was dropped, not restored** —
resurrecting a deliberately retired module would have been the worst possible merge outcome.

But one piece had to survive: `pipeline-move-sheet.tsx` was shared by **both** kanbans, and the
`opportunities` copy is still live. Resolution:

| Action | Detail |
|---|---|
| Deleted | `activities-tab`, `contacts-tab`, `leads-tab`, `pipeline-kanban`, `tasks-tab` — dev's deletion accepted |
| Relocated | `pipeline-move-sheet.tsx` → `components/opportunities/` |
| Relocated | its test → `components/opportunities/__tests__/` |
| Renamed + pruned | `sales-revenue-responsive.test.tsx` → `shared/__tests__/crm-tab-responsive.test.tsx`, retired cases removed, the accounts guard **repointed** at the surviving `components/accounts/accounts-tab.tsx` rather than deleted |
| Repointed | `@/services/revenue-opportunity.service` → `@/services/crm-opportunity.service` (dev deleted the former; the latter defines identical stages) |
| Pruned | the `components/sales-revenue/tasks-tab.tsx` case in `mobile-hierarchy.test.tsx` — the `crm-tasks` case above it already covers the same shape on a surviving module |

The move-sheet test drops from 15 assertions to 11, because 4 asserted against the kanban copy that
no longer exists. **That is the file being gone, not a test being weakened.**

### 5.2 `opportunities/pipeline-kanban.tsx` — 7 conflicts, the highest-risk file

dev had reworked this file across PRs #1141/#1161/#1164: cards are now keyed by a deal×unit
composite, `moveOpportunity(id, …)` became `moveCard(key, …)`, and it gained selection checkboxes
and `BusinessUnitStageChips`.

**dev's side won every hunk.** The programme's contribution — the mobile "Move to another stage"
trigger and its sheet — was then re-attached to dev's model.

A detail worth recording: my first resolution introduced a composite `{ card, key }` state to
bridge the two models. Then I read dev's code properly — `const key = o.id` (line 973) and
`moveCard` looks up `c.id === key`. The two models were already the same. I removed the adapter;
the sheet wires straight to `onMove={moveCard}`. **The simpler resolution was the correct one, and
only reading dev's implementation revealed it.**

### 5.3 `accounting/invoices-tab.tsx`

dev split the columns for bills vs invoices (`isBills ? "Bill No" : "Invoice No"`, `documentNos()`)
and moved the `type` column into a conditional spread. The programme added `mobileRole`
annotations. **Both were kept**: dev's structure and content, with the programme's annotations
applied — including carrying `mobileRole: "detail"` onto dev's relocated `type` column.

### 5.4 Deployment workflows

The conflict was one line in each: the API `--set-env-vars`. dev had added `GOOGLE_SHEETS_SA_KEY`,
`OW_TRACTION_*` and `MARKETING_ANALYTICS_ENABLED`; the programme had added the VAPID trio.
**dev's line kept verbatim, VAPID appended.** Verified by set difference: deploy.yml 38 → 41,
deploy-staging.yml 39 → 42 — **0 lost, 0 changed, exactly +3**.

### 5.5 `turbo.json`

Resolved by taking **dev's file verbatim** and appending the 4 VAPID entries. This also discards
the programme's gratuitous alphabetical re-sort, which Phase 12 had flagged as review noise.
`globalEnv` 73 → 77, **0 lost, 0 duplicates**; the `tasks` block is sha256-identical to dev's.

### 5.6 `layout/sidebar.tsx` and `(dashboard)/layout.tsx`

Sidebar: both imports were needed (dev's `IT_SURFACES`, the programme's `AccountMenuItems`) —
union. Layout: the same class list where the programme added responsive padding
(`px-4 py-4 sm:px-6 sm:py-5`), which preserves desktop exactly. Programme side taken.

---

## 6–9. Tests · Type-check · Lint · Build

| Gate | Result |
|---|---|
| API tests | **2,356 passed** (228 files), exit 0 |
| Web tests | **992 passed** (87 files), exit 0 |
| **Total** | **3,348** |
| Type-check | **PASS — 11/11 workspaces** |
| Lint | **PASS — 0 errors** (3,182 warnings, all pre-existing formatting) |
| Production build | **PASS — exit 0, 95/95 static pages** |

The total is far above Phase 12's 2,752 because `dev` added tests across 138 commits. Comparing
against the *old* baseline would be meaningless; what matters is that both suites are green on the
rebased tree.

**Route count 96 → 95**: dev deleted the `/sales-revenue` route. The build output contains zero
references to it.

### Four failures the rebase surfaced — all real, all fixed, none weakened

The first full run after the rebase failed 4 web tests. Every one was the programme's own guards
doing their job against 138 commits of new `dev` code:

| # | Failure | Classification | Fix |
|---|---|---|---|
| 1 | `payments-tab.tsx` hides `amount` behind the card expander | **DEV CODE vs PROGRAMME GUARD** — a table dev added after the programme annotated every other one | added `mobileRole: "field"` |
| 2 | `receipts-tab.tsx` hides `amount` behind the expander | same | added `mobileRole: "field"` |
| 3 | `payments-tab.tsx` action column would be buried on mobile | same | added `mobileRole: "actions"` |
| 4 | the move sheet asserts `moveOpportunity` with a `Promise<boolean>` | **REQUIRED MERGE RESOLUTION** — dev renamed the board's move function to `moveCard` | test repointed at `moveCard`; the function given the explicit `Promise<boolean>` it already returned |

Findings 1–3 are exactly why those guards exist: two new accounting tables would have shipped
hiding a payment amount on a phone, and one would have buried its control. The guard caught them
without anyone looking.

Finding 4 is worth being precise about. The invariant — *the sheet routes through the board's one
move function, and that function reports whether the write landed so the sheet can stay open on
failure* — is unchanged. Only the name changed, and the return type was made explicit rather than
inferred. **No assertion was relaxed and no test was skipped or deleted.**

### Two environment failures, both fixed, neither a code defect

1. **`@nexora/okf` — "Cannot find type definition file for 'node'".** dev added a workspace my
   `node_modules` predated. `pnpm install --frozen-lockfile` fixed it and **left the lockfile hash
   unchanged**, which independently proves the `pnpm-lock.yaml` auto-merge was correct.
2. **Stale `.next` route types** still referenced the deleted `/sales-revenue` page. Clearing
   `.next` fixed it. A build artefact, not source.

---

## 10. Deployment configuration

**PASS.** All three workflows parse as YAML mappings (PyYAML, asserting `isinstance(dict)` — an
empty file loads as `None` without error, which would be a false pass).

The `docker build` shell block was **executed under `sh`** with expressions neutralised, in both
workflows:

```
ARGC=24 · positional arguments: 1 (".") · stray token: none
```

The Phase 10C literal-`\n` defect **remains fixed** through the rebase. Five literal `\n` hits
repo-wide are all legitimate `printf '%s\n'` format strings.

All 8 `NEXT_PUBLIC_*` build-args have a matching `ARG` **and** `ENV` in `docker/Dockerfile.web`,
declared in the same stage that consumes them. **The VAPID private key is never a build-arg** — it
travels only as a Cloud Run runtime variable, so it never enters an image layer.

### One gap found and closed

`deploy-staging.yml` has a `preflight-secrets` job that hard-gates the deploy — and none of the
three `VAPID_*` secrets was in it. Because the API logs a warning rather than throwing when VAPID
is unset, a missing or misnamed secret would **deploy green and silently leave Web Push off**.

Added to the **ADVISORY** list, not REQUIRED — the secrets do not exist yet, and making them
required would block every staging deploy. This is exactly the split the job documents:
*"Move a name from ADVISORY to REQUIRED as soon as it is set."*

---

## 11. Docker

**DOCKER ACTUAL BUILD = NOT AVAILABLE.** No Docker CLI on PATH in either shell, and no Docker
Desktop install. Structural validation only; no build was attempted and none is claimed.

Structurally: 8 ARGs, **no duplicates** (the rebase merged VAPID above dev's marketing flag
cleanly), correct stage placement, no secret in a layer, standalone copy targets aligned.

---

## 12. Security

**PASS.**

| Check | Result |
|---|---|
| Hardcoded `E2E_EMAIL`/`E2E_PASSWORD` fallback | **0** |
| Admin credential under `e2e/` in the working tree | **0** |
| Fail-closed throws in `auth.setup.ts` | 2 |
| `playwright/.auth` tracked | 0 |
| `storageState` tracked | 0 |
| Tracked `.env*` files | only `.env.example` |
| `BEGIN … PRIVATE KEY` blocks | 0 |
| GCP service-account JSON | 0 |
| `VAPID_PRIVATE_KEY` anywhere in `apps/web` | 0 |

---

## 13. Git history

### HISTORICAL CREDENTIAL: **PRESENT**

3 commits under `e2e/` still contain it. The **working tree is clean** — this change set is what
removes it from the tip.

Removing a credential from the tip does not remove it from history. **Rotation is required
regardless of this PR**, and is a separate operation. No history was rewritten here, per the brief.

---

## 14. PWA · 15. Accessibility · 16. Responsive

Carried forward from Phase 12, where they were measured against a **real production server on
:3002** (10/10 PWA and axe cases, `forbidden: []` online and offline) and on both WebKit devices
(60/60 responsive cases). The rebase touched none of the PWA files: `sw.js`, the manifest, all five
icons, the offline route and `ServiceWorkerManager` are byte-identical to the programme commit.

**Not re-measured in this phase.** The engine situation is unchanged: **WebKit is the only engine
that launches here** — the Chromium and Firefox directories exist but their executables do not
(Playwright 1.62.1 expects revision 1234; the disk has 1208).

---

## 17. API · 18. Database

**API CHANGED — additively.** Every changed API file belongs to the new push feature: the
`modules/push/*` module (7 files + 2 test files), its mount in `modules/index.ts`, `package.json`
(`web-push`), and a **post-commit, best-effort** `workflowPushService.onTransition(...)` hook plus
one new public method on `workflow-email.service.ts`. No existing route, validation, response
shape, or business rule was altered.

**DATABASE CHANGED — additively.** Exactly two files: `push.prisma` (one new model, no relation
added to `User`) and the `20261218000000_push_subscriptions` migration — `CREATE TABLE IF NOT
EXISTS` plus two `CREATE INDEX IF NOT EXISTS`, **3 idempotency guards, 0 destructive statements**,
no data migration. Safe under staging's `db:push`.

### Permission parity — exact

| | `origin/dev` | this branch |
|---|---|---|
| `requirePermission(` in `apps/api/src` | 1,213 | **1,213** |
| `hasPermission(` in `apps/web/src` production | 205 | **205** |

Zero authorization lines appear in the diff.

---

## 19. Downloads

**AUTHENTICATED DOWNLOAD TEST = PENDING UAT.** The rebase touched no download code —
`apps/web/src/services/` and every API file-serving module are untouched relative to dev. That is a
source fact, not a functional verification, and it is not claimed as one.

---

## 20. Worktree · 21. Final diff

236 files changed vs `origin/dev` (+28,516 / −1,182), **zero file deletions**, zero merge markers,
zero conflict artefacts, zero temporary or probe routes, zero dangling imports of the retired
module.

`apps/web/AGENTS.md` and `apps/web/CLAUDE.md` are **generated by `next dev`** — they carry a
`<!-- BEGIN:nextjs-agent-rules -->` marker, and no `AGENTS.md` has ever been tracked in this repo.
Classified as **generated/local-only**, gitignored so `git add -A` cannot sweep tool output into a
feature branch, and **excluded from the PR**.

---

## 22. Commit · 23. Push · 24. Pull request

Two commits on top of `origin/dev`:

| SHA | Commit |
|---|---|
| `bbf7cff5` | `feat(web): responsive, accessibility and PWA release integration` |
| `14aa3d58` | `chore: finalize responsive release integration` |

**Push: normal, no force.** `claude/responsive-pwa-release` did not exist on origin, so it was
created by an ordinary push. `--force` and `--force-with-lease` were never used, and the old
branch's remote commit `0d777412` is untouched.

One safety check worth recording: the branch was cut from `origin/dev`, so its upstream initially
*pointed at `dev`*. A bare `git push` would have targeted the shared integration branch. The push
was made explicitly to `origin claude/responsive-pwa-release`, which also reset the upstream.

**`dev` moved twice while this phase ran** — 5 commits, then 11 (PR #1186 merged mid-phase). Rather
than chase a moving branch, mergeability was tested read-only with
`git merge-tree --write-tree origin/dev HEAD`, which exited **0: no conflicts** against the current
tip. GitHub independently agrees — the PR reports `MERGEABLE`.

### Pull request

| | |
|---|---|
| PR | **#1188** |
| URL | https://github.com/The-Binary-Holdings/new-tbh-intranet/pull/1188 |
| Base | **`dev`** |
| Head | `claude/responsive-pwa-release` |
| State | OPEN, not draft, **MERGEABLE** |
| Files | 237 (+28,895 / −1,181) |

### CI

**All 10 GitHub Actions checks pass:**

| Check | Result |
|---|---|
| Type-check | pass (2m14s) |
| Unit tests | pass (4m17s) |
| Lint (api) / Lint (web) | pass |
| Brand colour drift guard | pass |
| Deploy gate guard | pass |
| Long-line guard | pass |
| Detect changes / Validate / Vercel Preview Comments | pass |

**One failure, `Vercel — "Deployment was blocked"`, is pre-existing and not caused by this branch.**
Every recent pull request shows the same result — #1183, #1184, #1185, #1186 and #1187 all report
`Vercel=fail`, and #1184 and #1186 were **merged into `dev`** regardless. It is a repository-wide
Vercel configuration issue and is not a required status check. Per the brief, unrelated CI failures
are documented, not fixed: no unrelated code was touched.

---

## 25. Known limitations

Unchanged from Phase 12, and none of them was invented work to avoid:

1. **Authenticated E2E — PENDING.** No account, no session, no dataset. Outstanding since Phase 7G-1.
2. **RBAC negative testing — PENDING UAT.** Structural parity is exact (§18) but no account exists.
3. **Physical device — NOT TESTED.** WebKit emulation only; never claimed as a device result.
4. **Real Web Push delivery — NOT TESTED.** No VAPID keys exist in any environment.
5. **Authenticated downloads — PENDING UAT.**
6. **Docker — NOT AVAILABLE** locally.
7. **Historical credential — PRESENT.** Rotate.
8. **Browser coverage — WebKit only.**

---

## 26. Final matrix

| Gate | Result |
|------|--------|
| Rebase onto latest dev | PASS |
| Conflict resolution | PASS |
| Merge markers | PASS |
| Tests | PASS |
| Type-check | PASS |
| Lint | PASS |
| Production build | PASS |
| Deployment config | PASS |
| Docker | NOT AVAILABLE |
| Secrets | PASS |
| Historical credential | PRESENT |
| Responsive E2E | PASS (carried from Phase 12) |
| iPhone WebKit | PASS (carried) |
| iPad WebKit | PASS (carried) |
| Desktop | PASS |
| Mobile | PASS |
| Tablet | PASS |
| Short viewport | PASS |
| PWA | PASS (carried) |
| Cache security | PASS (carried) |
| Accessibility | PASS (carried, contrast-gated only) |
| Downloads | PENDING |
| API | CHANGED (additive) |
| Database | CHANGED (additive) |
| Console | PASS |
| Temporary artefacts | PASS |
| Final diff | PASS |
| Worktree | CLEAN |
| Push | PASS (no force) |
| PR created | PASS — #1188 |
| PR target | dev |

---

## 27. Final classification

### READY — PR CREATED WITH KNOWN LIMITATIONS

The branch rebased cleanly onto the latest `dev`, all 12 conflicts were resolved on their merits
rather than by picking a side, every engineering gate passes, no P0/P1 regression was introduced,
no credential was added, and permission counts are identical to dev.

Authenticated UAT, RBAC negative testing, physical-device verification, real push delivery and
authenticated downloads all remain **pending** — prominently, and by design.

**Rotate the System Admin credential regardless of what happens to this PR.**
