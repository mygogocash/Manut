# Phase 7G-2 — Authenticated release verification

## RELEASE STATUS: **BLOCKED**

**No E2E account exists, so no authenticated workflow was verified.**

The brief lists Phase 7G-1 as `COMPLETED/READY`. The infrastructure is ready; **the account
is not**. 7G-1 finished BLOCKED on exactly this, and its four prerequisites (§9 of that
document) have not been completed.

**Zero production code changed.** No API, database, Prisma, RBAC or dependency change.

---

## 1. The prerequisite check

Verified by **name only** — no value was read, printed or logged:

| | State |
|---|---|
| `E2E_EMAIL` | **not set** |
| `E2E_PASSWORD` | **not set** |
| `E2E_*` in any `.env` file | **absent** |
| `playwright/.auth/user.json` | **absent — a login has never succeeded** |
| `.env.example` | still `E2E_EMAIL=` / `E2E_PASSWORD=`, blank |

The rotated System Admin credential was **not used**, git history was **not searched**, and
no employee's account was used.

Consequently **Steps 1–3, 5–28 and 31–36 are BLOCKED** — not "not tested by choice". That is
every authenticated workflow in this brief: login, session, navigation, RBAC, deep links,
dashboard, projects, requests, approval, stale approval, board, task move, drag and drop,
task detail, sheets in real consumers, forms, session expiry, logout, PWA session, push,
error states, parity and regression.

---

## 2. What this phase did verify

Only one thing was genuinely new since Phase 7G: **7G-1 rewrote `playwright.config.ts` and
migrated two specs off a hardcoded credential.** That change needed a regression check, and
it passes.

### Baseline (Step 0)

| | Result |
|---|---|
| Unit / integration | **2,625 passed** (1,958 API + 667 web) |
| type-check | **10/10 clean** |
| lint | **0 errors** (3,152 warnings, pre-existing) |
| Production build | **exit 0** |
| Unauthenticated E2E | **46 passed**, 10 skipped |
| Auth setup | **fails safely** — `E2E_EMAIL is not set` |

### The 7G-1 topology behaves as designed

Running the whole matrix with no credentials:

```
1 failed        setup — names the missing variable, reveals nothing
14 did not run  authenticated specs, correctly gated behind the failed setup
46 passed       every unauthenticated spec
10 skipped      PWA/a11y specs — production server not running
```

Three properties confirmed by that run:

1. **Unauthenticated coverage is unaffected** by the migration — 46 passing, same as before.
2. **Authenticated specs cannot run without a credential.** They do not silently pass, and
   they do not fall back to another account.
3. **No login is attempted.** In Phase 7G the same command authenticated as the System
   Admin; that hazard is closed and stays closed.

---

## 3. Environment

| | |
|---|---|
| Web (dev) | `:3000` — 200 |
| API (dev) | `:3001` — up |
| Environment safety for mutations | **NOT ESTABLISHED** — no isolated test dataset identified |
| E2E account | **none** |
| Second restricted account (RBAC negative test) | **none** |
| Test project / tasks / requests | **none** |
| Chromium (Playwright) | **BLOCKED** — binary absent |
| Firefox (Playwright) | **BLOCKED** — binary absent |
| WebKit | available — `webkit-2336` |
| iPhone 13 / iPad Mini profiles | available |
| Physical devices | **none** |
| VAPID / push configuration | **none** |

Because environment safety could not be established, **no mutation test would have been
permissible even with a credential.** Approval, rejection and task-move all mutate records,
and there is no confirmed-safe dataset to mutate.

---

## 4. Workflow matrix

| Workflow | Chromium | iPhone WebKit | iPad WebKit | Status |
|---|---|---|---|---|
| Login | BLOCKED | BLOCKED | BLOCKED | no account |
| Auth session | BLOCKED | BLOCKED | BLOCKED | |
| Navigation | BLOCKED | BLOCKED | BLOCKED | |
| RBAC | BLOCKED | BLOCKED | BLOCKED | |
| Deep link | BLOCKED | BLOCKED | BLOCKED | |
| Dashboard | BLOCKED | BLOCKED | BLOCKED | |
| Projects | BLOCKED | BLOCKED | BLOCKED | |
| Requests | BLOCKED | BLOCKED | BLOCKED | |
| Approval | BLOCKED | BLOCKED | BLOCKED | also no safe data |
| Stale approval | BLOCKED | BLOCKED | BLOCKED | also needs 2 accounts |
| Board | BLOCKED | BLOCKED | BLOCKED | |
| Mobile Move | BLOCKED | BLOCKED | BLOCKED | also no safe data |
| Desktop DnD | BLOCKED | N/A | N/A | |
| Keyboard DnD | BLOCKED | N/A | N/A | |
| Touch interaction | N/A | BLOCKED¹ | BLOCKED¹ | board needs a session |
| Task Detail | BLOCKED | BLOCKED | BLOCKED | |
| Sheets (real consumers) | BLOCKED | BLOCKED | BLOCKED | |
| Forms | BLOCKED | BLOCKED | BLOCKED | |
| Session expiry | BLOCKED | BLOCKED | BLOCKED | |
| Logout | BLOCKED | BLOCKED | BLOCKED | |
| PWA (worker, cache, offline) | BLOCKED² | **PASS**³ | NOT TESTED | Phase 7G evidence stands |
| PWA session | BLOCKED | BLOCKED | BLOCKED | |
| Push | BLOCKED | BLOCKED | BLOCKED | no VAPID |
| **Auth setup safe failure** | **PASS** | N/A | N/A | this phase |
| **Authenticated specs gated** | **PASS** | **PASS** | **PASS** | this phase |
| **Unauthenticated regression** | BLOCKED² | **PASS** | **PASS** | 46 passed |

¹ The `touch-action` contract was verified against a harness in Phase 7D/7E; the **board
itself** needs a session. ² Chromium binary absent. ³ Verified in Phase 7G against a
production build; nothing production-side has changed since, and it was not re-run here.

### Responsive matrix

| Width | Overflow | Input | Sheets | Navigation | Board | Task Detail |
|---|---|---|---|---|---|---|
| 320 | PASS¹ | PASS¹ | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 375 | PASS¹ | PASS¹ | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 390 | PASS¹ | PASS¹ | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 430 | PASS¹ | PASS¹ | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 768 | PASS¹ | PASS¹ | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 834 | NOT TESTED | PASS¹ | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 900 | NOT TESTED | NOT TESTED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 1023 | NOT TESTED | NOT TESTED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 1024 | PASS¹ | PASS¹ | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 1280 | PASS¹ | PASS¹ | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 1440 | PASS¹ | PASS¹ | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 1920 | PASS¹ | PASS¹ | BLOCKED | BLOCKED | BLOCKED | BLOCKED |

¹ **Public routes only** (`/sign-in`, `/forgot-password`). Sheets, navigation, board and
task detail have **no unauthenticated surface** — every one lives behind a login.

---

## 5. Test counts

| | Passed | Failed | Skipped | Blocked | Not tested |
|---|---|---|---|---|---|
| Unit / integration | **2,625** | 0 | 0 | — | — |
| E2E — WebKit (iPhone + iPad) | **46** | 0 | 10 | 14 | — |
| E2E — Chromium | 0 | 0 | 0 | all | binary absent |
| E2E — Firefox | 0 | 0 | 0 | all | binary absent |
| **Authenticated E2E** | **0** | 0 | 0 | **all** | — |

The one "failed" — the auth setup — is the **intended** behaviour of a suite with no
credential, and is reported as PASS for that property in §4.

---

## 6. Evidence levels

| Level | State |
|---|---|
| **UNIT TESTED** | 2,625 tests |
| **BROWSER TESTED** | real Chromium via the in-app pane, emulated widths (Phases 7–8) |
| **WEBKIT TESTED** | 46 assertions, real touch events, public routes and harnesses |
| **AUTHENTICATED E2E** | **nothing. In any phase.** |
| **PHYSICAL DEVICE** | **nothing. In any phase.** |

Claims that must not be conflated, restated because this phase is where they would be:

- *"Auth setup fails safely"* is **not** *"login works"*. A successful login has never
  happened.
- *"`touch-action` is correct on the grip"* is **not** *"a task can be dragged on an iPhone"*.
- *"The sheet cascade is fixed"* is unit-tested and harness-measured; it has **never been
  seen in a real authenticated sheet**.
- *"PWA caches no authenticated endpoint"* was verified against a production build **with no
  session**. Cache behaviour *while authenticated* is unverified — and it is the case that
  matters most.

---

## 7. Findings

No new defects; nothing was executed that could reveal one. All previously reported items
stand:

| # | Finding | Severity | State |
|---|---|---|---|
| 1 | No E2E account / test dataset | **blocker** | open — the subject of this phase |
| 2 | 13 sheets widened by 7F-1, never visually reviewed | P2 | open — needs a session |
| 3 | RBAC negative test needs a second account | P2 | open |
| 4 | `landmark-one-main` / `region` on public routes | P3 | open |
| 5 | `directory/employee-detail-sheet` has no `w-full` | P3 | open |
| 6 | `table-layouts` router test flaked once in 7F-1 | P3 | not reproduced |
| 7 | Chromium and Firefox binaries absent | tooling | open |
| 8 | No VAPID configuration | tooling | open |

---

## 8. Security and cleanup

| Check | Result |
|---|---|
| Leaked credential literal in `e2e/` | **0 occurrences** |
| storageState tracked by git | **0** — and `playwright/.auth/` is ignored |
| `.env.example` values | **both blank** |
| Credentials printed / logged / in artefacts | **none** — no login ran |
| Records mutated | **none** — no session was ever established |
| Temporary routes / harnesses | **none created** |
| `test-results/`, screenshots, traces | removed |
| Git history searched for credentials | **no** |

---

## 9. What unblocks this phase

Unchanged from 7G-1 §9, plus two items that this phase surfaced as equally blocking:

1. **Provision a dedicated non-admin E2E account** in dev/staging.
2. **Grant it the minimum** for dashboard, projects, requests, board and task detail.
3. **Clear `mustChangePassword`** by signing in once by hand.
4. **Export `E2E_EMAIL` / `E2E_PASSWORD`.**
5. **Confirm the environment is safe for mutations**, and identify or create an **isolated
   test project with tasks and at least one pending request**. Approval and task-move cannot
   be tested without it, and must not be tested against production records.
6. **Provision a second, more restricted account** if the RBAC negative test is required for
   release. Do not widen account (1) to compensate.

Optionally `pnpm exec playwright install chromium firefox` to complete the browser matrix.

With (1)–(5) this phase runs as written. Without them, no amount of further work moves it.

---

## 10. Release decision

**BLOCKED.**

Per the brief's own rule, BLOCKED applies when authentication cannot be verified and
authenticated verification is required for release. Nothing in the application is known to
be broken — the blocker is that **the majority of the product has never been observed by a
logged-in user**, across twenty-one phases.

What *is* solid: 2,625 unit tests, a clean type-check and lint, a production build that
succeeds, 46 real-engine assertions on public routes, a service worker that caches no
authenticated endpoint, verified contrast and input sizing on the shipped bundle, and an E2E
harness that can no longer authenticate as an administrator by accident.

This is **not** "fully production verified", and should not be described as such.

---

## 11. Recommended next phase

**Do not schedule another verification or hardening phase.** Three consecutive phases have
now ended blocked on the same missing prerequisite, and a fourth would produce the same
document.

The next action is operational, not engineering: **provision the E2E account and an isolated
test project** (§9). That is a short task for whoever administers the dev/staging Supabase
tenant. Once done, re-run this brief unchanged — the infrastructure from 7G-1 is in place
and verified, so the phase should execute end to end.
