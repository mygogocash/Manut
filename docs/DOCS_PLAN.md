# Documentation plan — keeping an AI agent able to continue development

Audited and written 2026-08-26 against `dev` @ `9efc11fe`. Companion to the
staleness fixes landed in the same PR.

---

## 1. The finding

Every documentation claim that carries a **number** has drifted, and drifted in
the same direction: the docs describe a smaller, earlier system.

| Doc | Claims | Reality | Coverage |
|---|---:|---:|---:|
| `docs/DATABASE_SCHEMA.md` | 84 models | 274 tables | **31%** |
| `docs/API_SPECIFICATION.md` | ~285 paths | 1,350 routes | **21%** |
| `docs/MODULES_SPECIFICATION.md` | ~55 modules | 99 modules | **56%** |
| `docs/AUTH_RBAC.md` | 104 permissions ("all 83") | 271 codes | **38%** |
| `docs/ENVIRONMENT_MANAGEMENT.md` | 34 of `turbo.json` `globalEnv` | 73 vars | **47%** |
| `docs/ops/cloud-scheduler-cron-jobs.md` | 17 endpoints | 20 endpoints | **85%** |
| `README.md` | "40+ modules" | 99 | — |
| `docs/PROJECT_OVERVIEW.md` | "70+ modules" | 99 | — |

Six live docs also claimed **Next.js 15** (actual: 16.3.1), two claimed
`packages/ui` holds the shadcn components (it holds `index.ts` + `utils.ts`; the
56 components live in `apps/web/src/components/ui/`), and twelve file paths
pointed at files that had moved or never existed.

### The part that actually hurts an agent

Three of those files opened with the word **"Complete"**:

> "Complete Prisma schema design…" · "Complete specification of all modules…" ·
> "Complete REST API specification…"

At 21–56% coverage that framing is worse than having no document at all. A
missing doc makes an agent go read the code. A doc that says *complete* makes an
agent conclude an endpoint doesn't exist, a permission isn't defined, a table
isn't there — and then build the wrong thing, confidently. **Overstated coverage
is an active defect, not a cosmetic one.**

### Why it drifted, and why editing won't fix it

Nobody was careless. These are **hand-maintained inventories of a system that
adds a module every few days**. 259 migrations, 99 modules, 1,350 routes. A
human-written census of that is stale the week it is written, and re-writing it
by hand buys a few weeks before the same audit finds the same thing.

Two facts settle the approach:

- **Generation works.** `docs/migration/02-data-dictionary.md` — 274 tables,
  every column, type, default, FK and index — was produced by a command and can
  be reproduced by that command. It cannot drift while it is regenerated.
- **Gating works, and already exists here.** `packages/okf/` runs conformance,
  frontmatter, link and **coverage-ratchet** tests in CI via `okf-checks.yml`,
  which exists precisely because `pr-checks.yml` path-ignores `docs/**`. Its
  35-entry manifest holds `CLAUDE.md`'s bullets to marker-level fidelity.

So the rule going forward:

> **An inventory is generated or it is gated. Prose is hand-written and declares
> its own coverage. Nothing calls itself "complete" unless a test proves it.**

And a second rule, learned by getting it wrong inside this very PR:

> **Record the observation, not the inferred cause.** The release-policy note
> above originally asserted that `required_linear_history` was blocking merge
> commits. The evidence was a generic GitHub message —
> *"the base branch policy prohibits the merge"* — plus a plausible-looking rule
> in the ruleset. The actual cause was a different rule entirely, and the wrong
> diagnosis had already been committed and merged before a second refusal
> (`--squash`, which linear history cannot explain) exposed it. A doc that states
> a confident wrong cause sends the next reader to renegotiate the wrong policy.
> Write what was observed, name the candidates, and say which is untested.

---

## 2. The hook nobody has used yet

`packages/okf/src/vocabulary.ts` declares nine document types. **Two are in
use.**

| Type | Documents |
|---|---:|
| `Playbook` | 22 |
| `Pitfall` | 12 |
| `Reference` · `Runbook` · `Decision` | 0 |
| **`Module`** · **`Prisma Model`** · **`API Endpoint`** · **`Permission`** | **0** |

The four unused types in bold are *exactly* the four inventories that drifted.
The schema for fixing this was designed and then never populated. That is the
cheapest possible starting point: no new format, no new CI workflow, no new
review conventions — extend a bundle that already has gates.

---

## 3. What landed already (this PR)

Fixes where the correct value was unambiguous and measurable:

- `Next.js 15` → `16` across 6 live docs + `docker/Dockerfile.web`. Dated
  snapshots (`TASK_PLANNING.md`, `HANDOFF_*`, `superpowers/plans/*`) left alone —
  rewriting a dated record falsifies it.
- 12 dead file paths corrected to verified locations; `packages/ui` described
  accurately in `CLAUDE.md` and `CONTEXT.md`.
- `AUTH_RBAC.md`: two sections documenting a **browser** Supabase client and an
  Express **server-with-cookies** client were replaced. Neither file exists and
  the design never shipped — `apps/web` has zero `@supabase/*` imports. Also
  `83` → `271` permissions, plus a coverage banner naming the five retired
  `survey:*` codes still listed there.
- The three `"Complete …"` banners replaced with measured coverage and an
  explicit "check the controller before concluding an endpoint is absent".
- `cloud-scheduler-cron-jobs.md`: the 3 missing endpoints added (now 20 of 20),
  plus "this file records intent; `gcloud scheduler jobs list` is live state".
- `RELEASE_PROCESS.md`: documented what actually gates a release into `main`.
  **Corrected 2026-08-27** — the first version of this blamed
  `required_linear_history`; the real blocker was
  `require_extra_approval_for_unattributed_changes` with zero reviews, proven by
  `--squash` drawing the identical refusal (a squash is single-parent, so linear
  history cannot explain it) and by #1165 merging the moment one approval
  existed. `allowed_merge_methods` includes `merge`, so whether a merge-commit
  release is achievable is **untested and worth an experiment** — the doc now
  says how to run it. Includes the right diagnostic command, since
  `/branches/main/protection` returns 404 and reads as "unprotected".

Deliberately **not** done: hand-expanding the four big inventories from ~30% to
100%. That is roughly 8,000 lines of transcription with a short shelf life, and
Phase 1 below replaces it with something that cannot rot.

---

## 4. Phases

Each phase is independently shippable and independently useful. Effort is
relative, not calendar.

### Phase 1 — Generate the four inventories · effort M · highest value

Add `packages/okf/src/generate/` emitting OKF concept files from source, plus a
`pnpm docs:generate` script and a CI check that regeneration produces no diff
(the same shape as `prisma generate` drift checks).

| Generator | Source of truth | Emits | Replaces the census in |
|---|---|---|---|
| `modules.ts` | `apps/api/src/modules/*/` | 99 × `type: Module` | `MODULES_SPECIFICATION.md` |
| `endpoints.ts` | `router.<verb>(…)` + `requirePermission(…)` | `type: API Endpoint` per module | `API_SPECIFICATION.md` |
| `permissions.ts` | `common/constants/permissions.ts` + role seed | 271 × `type: Permission` | `AUTH_RBAC.md` |
| `models.ts` | `prisma/schema/*.prisma` | 274 × `type: Prisma Model` | `DATABASE_SCHEMA.md` |

The schema generator is mostly done — `docs/migration/02-data-dictionary.md` is
already generated from the DDL; Phase 1 moves that script into the repo as a
supported entry point instead of a one-off.

**Acceptance:** `pnpm docs:generate` is idempotent; CI fails if the tree differs
after regeneration; the four hand-written specs keep only rationale and prose and
link to the generated inventory; no file claims completeness it cannot prove.

**Watch out for** the failure `okf-checks.yml` already documents: `pnpm --filter`
exits **0** on no match. Use `pnpm -C`, or a green gate can assert nothing.

### Phase 2 — Per-module contracts · effort L · the real continuity win

Today an agent asked to touch Expenses must reverse-engineer the module. The
generic patterns in `.agents/skills/` (REST, Prisma, shadcn) don't carry
repo-specific rules, and `docs/okf/` covers cross-cutting patterns rather than
modules.

One `type: Module` concept per module, generated skeleton + hand-written body:

- routes and the permission each requires
- the Prisma models it owns, and which it only reads
- side effects: email templates, cron endpoints, `SystemSetting` keys, storage buckets
- its non-obvious rules — the things currently living in `CLAUDE.md` bullets, memory files, or nobody's head
- how to verify a change to it (which tests, which fixtures)

**Order by risk, not alphabetically.** Start with the modules where a wrong
change is expensive and the rules are already known to be subtle: `leave`
(a stored `used` counter with three writers and no reconciliation), `accounting`
+ fixed assets (depreciation derived on read, never stored; account routing
fail-whole), `payroll` (payslip encryption shells out to `qpdf`), `auth`/`roles`
(the `isSystem && name === "Admin"` bypass), `projects` (native-table mirror
with a lazy heal), `messages` (in-process Socket.IO bus).

**Acceptance:** every module has a concept file; the risk-ranked first ten have
hand-written bodies with verification steps; the coverage ratchet extends to them.

### Phase 3 — Current-state doc · effort S · do this early despite the ordering

Nothing in the repo tells an agent **what is in flight**. There are six
`HANDOFF_*.md` snapshots, an `IMPLEMENTATION_PLAN.md` and a `TASK_PLANNING.md`,
none of which say what is true today. That knowledge currently lives in
per-user agent memory — which the next agent, or a teammate, does not have.

Add `docs/STATE.md`, updated per PR, holding only: what shipped to prod, what is
on `dev` but not `main`, what is flag-gated and where the flag lives, what is
blocked and on whom, what is deliberately deferred. Move the six `HANDOFF_*`
files to `docs/archive/`.

Concrete examples this would already carry: PR #1159 parked on the ruleset
question; `marketing-drift-check` existing-but-paused in Cloud Scheduler;
`ACCOUNTING_FIXED_ASSETS` on for staging and off for prod; DocuSign wired in code
but unconfigured in prod.

**Acceptance:** `STATE.md` exists, `CLAUDE.md` points to it as the first read,
and a PR template line prompts updating it.

### Phase 4 — Freshness gates · effort M

Cheap greps that would have caught every finding in §1:

1. **Version claims** — fail if a live doc names a major version that disagrees
   with `package.json`.
2. **Path references** — fail on a repo-path reference to a nonexistent file.
   Match longest extension first: a naive `\.ts` pattern reports `badge.tsx` and
   `tsconfig.tsbuildinfo` as missing (it did, on the first pass of this audit).
3. **Count claims** — a `<!-- generated:count-of X -->` marker regenerated by
   `docs:generate`, so no prose number is hand-typed.
4. **Coverage declaration** — fail if a doc says "complete"/"all" over an
   inventory without a passing coverage assertion.

Wire into `okf-checks.yml`, and widen its `paths` — it currently watches
`docs/okf/**`, `CLAUDE.md`, `AGENTS.md`, `CONTEXT.md`, `packages/okf/**`, so
`docs/**` changes outside `okf/` are gated by nothing at all. That is why this
PR's own files run zero checks.

### Phase 5 — Retire and consolidate · effort S

Only after 1–4, so nothing is deleted before its replacement exists.

- `DATABASE_SCHEMA.md` → design rationale only; inventory role retired.
- `API_SPECIFICATION.md` → conventions and DTO shapes only.
- Six `HANDOFF_*.md` → `docs/archive/`.
- `TASK_PLANNING.md`, `IMPLEMENTATION_PLAN.md` → archive if complete, else fold
  into `STATE.md`.
- Reconcile `CLAUDE.md` / `AGENTS.md` / `CONTEXT.md`, which overlap heavily —
  the OKF manifest's own comments anticipate trimming `CLAUDE.md` and deleting
  the other two. **That decision is not made here.**

---

## 5. Decisions needed before Phase 1

1. **Generated docs in-repo or build-time?** In-repo (committed, diff-gated) is
   recommended: an agent reading the repo needs them present, and the diff check
   is the freshness proof. Cost is churn in PRs that touch modules.
2. **Does `docs/**` get a real CI gate?** Phases 1 and 4 are unenforceable
   without it, and today a docs PR runs nothing.
3. **`CLAUDE.md` vs `AGENTS.md` vs `CONTEXT.md`** — consolidate to one, or keep
   three with defined scopes? Affects the OKF ratchet either way.
4. **Who owns `STATE.md`?** It only works if updating it is part of merging.

---

## 6. Explicitly out of scope

`.agents/skills/` — **248 of the repo's 344 markdown files**, across 22 skills
(Playwright, shadcn, Supabase best practices, Vercel React, security-review, …).
These document *third-party* tools, not this codebase. They do not drift when we
add a module, and rewriting them against our repo would corrupt vendored
reference material. They need **version review** on upgrade, which is a
different task from the staleness work above.

If they are ever brought in scope, the question to answer first is whether they
are still vendored copies or have been locally modified — that determines whether
they can simply be re-pulled.
