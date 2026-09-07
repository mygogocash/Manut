# Phase 11 — Dev/Staging integration and real-world responsive verification

**Status: BLOCKED — on the same prerequisite that has blocked verification since Phase 7G.**

**Zero code changes.** Nothing committed, nothing pushed, nothing deployed, no production data
touched.

---

## 1. What this phase could and could not do

Phase 11's objective is to verify Phases 1–10C **in the real application after merging to
Dev/Staging**. Two preconditions gate that, and both are unmet:

| Precondition | State |
|---|---|
| The programme's changes are deployed to staging | **No** — 114 modified + 52 untracked files are uncommitted; staging runs pre-programme code |
| A dedicated non-admin E2E account exists | **No** — `E2E_EMAIL` and `E2E_PASSWORD` are unset; `playwright/.auth/` is empty |

Neither can be resolved from here. The first requires committing and pushing an unreviewed
166-file change set to a shared branch; the second requires provisioning an account in the
tenant. Both are decisions for whoever owns the repository and the environment.

Everything not gated by those two facts was completed and is reported below at its true evidence
level.

---

## 2. Part A — Working-tree safety: **PASS**

| | |
|---|---|
| Modified (tracked) | 114 |
| Untracked | 52 |
| **Staged** | **0** |
| `HEAD` | `88eafe4d` — unchanged, nothing committed |
| Deletions | 1 — `e2e/leave.spec.ts`, the Phase 7G-1 move to `e2e/authenticated/` |

No unrelated user work was found, nothing was reset, and no destructive git command was run.

---

## 3. Part B — Local quality gate: **PASS**

| | Baseline (10C) | Measured |
|---|---|---|
| Tests | 2,752 | **2,752** (1,958 API + 794 web) |
| type-check | PASS | **PASS** — 10/10 |
| lint | PASS | **PASS** — 0 errors, 3,117 warnings (all pre-existing formatting) |
| build | PASS | **PASS** — exit 0, 96 static pages |

No test was added, skipped, weakened or removed.

---

## 4. Part C — Deployment: **NOT PERFORMED**, and a correction to Phase 10C

### The Phase 10C P1 fix is intact and now proven correct

Phase 10C found a literal `\n` joining two `--build-arg` lines. That fix was verified here
without deploying, by extracting the real web `docker build` block from the workflow, replacing
GitHub expressions with placeholders, and letting `sh` parse it:

```
FIXED (current tree)      ARGC=21   [NEXT_PUBLIC_VAPID_PUBLIC_KEY=X]
                                    [NEXT_PUBLIC_ACCOUNTING_FIXED_ASSETS=X]
                                    [.]

BROKEN (pre-10C)          ARGC=22   [NEXT_PUBLIC_VAPID_PUBLIC_KEY=X]
                                    [n]                    <-- stray argument
                                    [NEXT_PUBLIC_ACCOUNTING_FIXED_ASSETS=X]
                                    [.]
```

Two positional arguments (`n` and `.`) is precisely the *"docker build requires exactly 1
argument"* failure. The defect and the fix are both now demonstrated, not inferred.

### Correction to Phase 10C's wording

Phase 10C said *"Both pipelines would have failed at the docker build step."* The run history
shows both workflows have in fact been **succeeding**:

```
Deploy to Staging   dev    success   2026-08-28T04:51   14m13s
Deploy to GCP Cloud Run  main  success   2026-08-27T07:16    9m23s
```

The reason is that the defective lines exist **only in the uncommitted working tree** — `HEAD`
contains no VAPID build-arg at all. So the pipelines were never broken; they **would have broken
on the first merge**. The fix prevents a future failure rather than repairing a current one.
Phase 10C's severity was right; its tense was wrong.

### Why deployment was not performed

Deploying would require committing 114 modified + 52 untracked files and pushing them to `dev`.
Three reasons not to do that unilaterally:

1. **It is outward-facing and shared.** `dev` deploys straight to staging, and the branch is in
   active use — a PR merged there earlier the same day. Pushing an unreviewed 166-file change set
   would disrupt an environment other people are working in.
2. **The repository's own process forbids it.** `CLAUDE.md` requires PR-gated merges
   (`pr-checks.yml`) and dev → main via merge commit.
3. **It would not achieve this phase's objective anyway.** Without an E2E account, none of Parts
   F–Y could be verified even after a successful deploy.

`gh` is authenticated, so the deployment can be triggered the moment those points are settled.

---

## 5. Parts D–Y — Authenticated verification: **BLOCKED**

`E2E_EMAIL` and `E2E_PASSWORD` are unset and no stored session exists. Per Phase 7G-1 §5 the
setup fails closed with a named error and **no fallback**, which is the correct behaviour — it is
why no test silently authenticated as somebody it should not.

Blocked in full, with nothing partially claimed:

| Part | Surface | Status |
|---|---|---|
| D | login, session, refresh, deep link, logout, expiry | **BLOCKED** |
| E | safe test dataset | **BLOCKED** — none provisioned |
| F | dashboard at 10 widths | **BLOCKED** |
| G | projects list | **BLOCKED** |
| H | project requests, approve/reject, approval lock | **BLOCKED** |
| I | project board, status tabs, Move To, desktop drag | **BLOCKED** |
| J | touch verification | **BLOCKED** |
| K | task detail geometry | **BLOCKED** |
| L | DataTables across seven modules | **BLOCKED** |
| M | accounting financial values | **BLOCKED** |
| N | HRMS | **BLOCKED** |
| O | sales / revenue | **BLOCKED** |
| P | investors, incl. the deferred stale-stage question | **BLOCKED** |
| Q | forms, inputs, selects | **BLOCKED** |
| R | sheets / dialogs | **BLOCKED** |
| S | axe on real authenticated pages | **BLOCKED** |
| T | PWA after login, cross-session cache safety | **BLOCKED** |
| U | web push delivery | **BLOCKED** — no VAPID keys configured in any environment |
| V | RBAC negative testing | **BLOCKED** — needs two accounts |
| W | real mobile workflows | **BLOCKED** |
| X | desktop workflows | **BLOCKED** |
| Y | short viewports on authenticated surfaces | **BLOCKED** |
| Z–AB | network, error states, console on authenticated routes | **BLOCKED** |

Staging **is** reachable (`https://staging.manut.xyz` → 307 to sign-in), so
the environment is healthy. It was deliberately **not** measured: it runs pre-programme code, so
any result would describe the old application and would be misleading in a report about this
programme.

---

## 6. Evidence levels

Stated per Part AE, with no promotion between levels:

- **REAL APPLICATION:** the deployment run history, staging reachability, and the shell parse of
  the real workflow build block. Nothing else.
- **UNIT VERIFIED:** all 2,752 tests, including every guard built in Phases 8–10B.
- **STRUCTURALLY VERIFIED:** the working-tree inventory, the workflow fix, and the source-level
  findings carried from 10C.
- **WEBKIT EMULATION:** everything measured in Phases 7–10C — 12 widths, short viewports, axe,
  PWA — against real components in temporary harnesses and against a local production build.
  **Never a physical device.**
- **BLOCKED:** every authenticated surface (§5).

---

## 7. What must happen to unblock this phase

1. **Provision a dedicated non-admin account** in the Dev/Staging Supabase tenant. Not the
   rotated System Admin, not an employee's own login. Grant read on dashboard, projects,
   requests, board, task detail, plus whatever the approval path needs — and nothing more.
2. **Clear `mustChangePassword`** by signing in once by hand. Automation must not rotate it.
3. **Provision a second, more restricted account** so RBAC negative tests are real rather than
   assumed.
4. **Create a safe test dataset** on staging: one project with tasks across several statuses, a
   pending request, an approved one, and a rejected one.
5. **Export `E2E_EMAIL` / `E2E_PASSWORD`** into the environment or CI secrets.
6. **Merge the programme via a PR** so `pr-checks.yml` gates it, then watch the first
   `deploy-staging` docker build — the step this phase proved would have failed.
7. **Add a `webServer` entry for :3002** so the PWA and contrast suites stop skipping in CI
   (Phase 10C §5).

Steps 1–5 are environment work, not engineering. Nothing in the codebase blocks them.

---

## 8. Release recommendation

### NOT READY — for the reason this phase exists, not for a code defect

No P0/P1 defect was found. The code gate is clean and reproducible: 2,752 tests, clean
type-check, zero lint errors, a successful production build, and a P1 CI defect that is now both
fixed and demonstrated.

But Phase 11's specific question — *"does the application work for real users on mobile after all
accumulated changes?"* — **has not been answered**, because the changes are not deployed and no
account exists to answer it with. Reporting READY would convert WebKit-emulation evidence into
real-application evidence, which Part AE explicitly forbids.

The honest position: **the code is ready to merge; the verification is not done.** Those are
different statements and this phase should not blur them.

---

## 9. Recommended next step

**Not another engineering phase.** Responsive development is complete and this phase found
nothing to build.

The next action is operational: provision the account and dataset (§7.1–7.5), merge via PR, and
re-run this phase against the deployed staging application. Phase 11 can then be executed as
written, and its result will mean what it says.

If the account genuinely cannot be provisioned, the remaining option is human UAT on staging by
someone who already has a login — in which case this document's §5 table is the test plan.
