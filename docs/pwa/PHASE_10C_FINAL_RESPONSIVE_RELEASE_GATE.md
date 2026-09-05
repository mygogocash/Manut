# Phase 10C — Final responsive regression and pre-merge release gate

**Zero production source changes.** Three files touched: two CI workflows (one real defect) and
one e2e spec (coverage strengthened). No API, database, Prisma, RBAC, auth or dependency change.

**Gate result: PASS WITH KNOWN LIMITATIONS.**

---

## 1. Baseline

Carried from Phase 10B and re-verified from scratch at the start of this phase:

| | Claimed | Measured |
|---|---|---|
| Tests | 2,752 | **2,752** (1,958 API + 794 web) |
| type-check | PASS | **PASS** — 10/10 workspaces |
| lint | PASS | **PASS** — 0 errors (3,117 warnings, all pre-existing formatting) |
| build | PASS | **PASS** — exit 0, 96 static pages |

The baseline is exact. Nothing had drifted.

---

## 2. Working-tree inventory

**114 tracked files modified, 52 untracked**, categorised against the programme:

| Area | Files |
|---|---|
| Accounting | 18 |
| HRMS / Payroll | 15 |
| Shared primitives | 10 |
| Sales / Revenue | 10 |
| Projects / Board / Task | 8 |
| Config / CI | 6 |
| App shell + a11y | 3 |
| Dashboard | 3 |
| Investor | 2 |
| Project Requests | 2 |
| Tests | 2 |
| Other (judged individually) | 35 |

**Every one of the 35 "other" files is an expected programme change** — the push module mount
(`apps/api/src/modules/index.ts`, +6), PWA config (`next.config.ts`, +40), the responsive shell
(`topbar.tsx` +131/−35, `sidebar.tsx` +17/−17, `layout.tsx` +15/−2), `mobileRole` annotations
across module pages (+1 to +15 each), the Phase 8D `ResizeObserver` test-setup fix, Playwright
projects, `turbo.json` globalEnv, and Dockerfile build args.

**Unexpected changes: none.** No unrelated user work was found, and nothing was reset.

---

## 3. The one real regression this gate caught

### P1 — the programme broke both deploy pipelines

`.github/workflows/deploy.yml:549` and `deploy-staging.yml:478` contained a **literal `\n`**
(backslash-n) where a newline belonged, joining two `--build-arg` lines into one:

```
--build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY="…" \n            --build-arg NEXT_PUBLIC_ACCOUNTING_FIXED_ASSETS="…" \
```

The continuation backslash is there, but it escapes an `n` rather than a line break. `sh`
collapses `\n` to a bare `n`, so `docker build` receives a stray positional argument alongside
the context `.` and fails with *"docker build requires exactly 1 argument"*.

**Attribution: introduced by this programme.** The line is a `+` line in both diffs — added when
the VAPID build-arg was inserted during the push work. Both the **production and staging** web
image builds would have failed on the first push to `main` or `dev`, and had one somehow
proceeded, `NEXT_PUBLIC_ACCOUNTING_FIXED_ASSETS` would have been silently dropped.

**Fixed.** Both files re-verified as valid YAML, and the build-arg block now reads as six
separate continuation lines.

This is the entire justification for the phase: nothing in the test suite, type-check, lint or
build could have caught it, because none of them execute the workflow.

---

## 4. Responsive matrix

`e2e/responsive-overflow.spec.ts` covered **9 widths** and no short viewports. Part C requires 12
plus two landscape sizes, so the spec was extended — a test-only strengthening, not a
production change.

| Width | Result |
|---|---|
| 320 · 375 · 390 · 430 | **PASS** |
| 768 · 834 · 900 · 1023 · 1024 | **PASS** (834, 900, 1023 newly covered) |
| 1280 · 1440 · 1920 | **PASS** |
| **667×375** (phone landscape) | **PASS** (newly covered) |
| **844×390** | **PASS** (newly covered) |

**58 e2e cases pass, up from 46.**

### The short-viewport guard, and proof it works

Phase 10B found a column sized `calc(100vh - 360px)` that resolved to **15px** on a phone in
landscape — invisible to every width-only test. The new guard flags any element whose computed
`max-height` collapses below 48px while still holding content.

A guard that cannot fail is not a guard, so it was verified by injecting that exact pattern into
a live page at 375px height:

```
COLLAPSE DETECTOR before=0 after=1
```

The throwaway spec was deleted immediately after.

---

## 5. PWA — the most valuable finding after the deploy fix

`e2e/pwa-verification.spec.ts` and `e2e/a11y-verification.spec.ts` guard against a production
server on **:3002**, and **nothing in `playwright.config.ts` starts one**. Both suites therefore
skipped **100% of the time**, in every run including CI, and reported green.

What that silently retired:

- the Phase 7F colour-contrast regression assertion, and
- **the PWA security property that no authenticated endpoint is ever cached.**

So this gate built the standalone output, served it on :3002, and ran them. **All 10 previously-
skipped cases now pass with evidence:**

```
PWA:      {"scope":"http://localhost:3002/","active":"activated",
           "cacheNames":["tbh-shell-v1"],"cached":3,"forbidden":[]}
OFFLINE:  {"body":"Intranet … Sign in …","forbidden":[]}
MANIFEST: {"name":"Intranet — The Binary Holdings","display":"standalone",
           "icons":4,"start_url":"/","scope":"/"}
AXE:      {"token":"36 9% 41%","violations":[landmark-one-main, region],"passes":33}
```

`forbidden: []` is the security assertion — **no `/api/*`, `/auth/*` or `/ingest/*` response was
cached**, verified against a real service worker rather than read from source. The contrast token
`36 9% 41%` confirms Phase 7F's remediation is live in a production build.

The service worker's exclusion is a bare `return` with no `respondWith`, so those requests are
not merely uncached — the worker never sees them.

**This does not fix the CI gap.** The suites will resume skipping on the next unattended run.
Recommended: add a `webServer` entry for :3002, or make the guard fail rather than skip when
`process.env.CI` is set. Left as a recommendation because it is a pipeline decision.

---

## 6. Web Push — infrastructure only

Verified from source, without creating a subscription or sending anything:

| Check | Result |
|---|---|
| `push` + `notificationclick` handlers | present |
| Routes | 5, all behind `authenticate, requireActive` at router level |
| **Recipient resolution** | **never client-chosen** — every route uses `req.user!.id`; the only business producer derives targets from `transitionRecipientIds()`, the same server-side rule the approval emails use |
| Subscription validation | zod, `https:`-only, length-bounded (SSRF containment) |
| Unsubscribe | scoped by `userId` **and** `endpoint` in the repository, so replaying another user's endpoint is a no-op |
| Deep-link validation | validated twice — server refuses to send, worker re-checks at click |
| VAPID private key | server-side only; **zero occurrences** in `apps/web/src`; only the public key is `NEXT_PUBLIC_*` |
| `/test` route | registered only when `NODE_ENV !== "production"`, and takes no recipient |

A regression test already pins the recipient property: *"exposes no route that names a
recipient"*.

**No real delivery has ever occurred** — no VAPID keys have been configured in any tested
environment. Marked INFRASTRUCTURE ONLY.

---

## 7. Security

| Category | Result |
|---|---|
| E2E credentials | **clean** — env-only, hard-throw, **no fallback**; the removed System Admin literal has not returned |
| VAPID secrets | **clean** (§6) |
| Test/debug routes in production | **none** |
| Sensitive logging | **none** — push logs only `userId`/`subscriptionId`, never the endpoint, `p256dh` or `auth` |
| Permission bypass | **none** — `requirePermission` intact; 102 of 103 controllers use `authenticate`, and the one that does not (`cron`) guards all 19 routes with a shared secret |
| Client-addressable push recipients | **none** (§6) |

**Two findings, neither introduced by this programme, neither blocking:**

- **P2 — `packages/database/prisma/seed.ts:52-53`** assigns a hardcoded fallback to
  `SEED_EMPLOYEE_PASSWORD` (`process.env.X || "<literal>"`), applied to every seeded employee.
  Pre-existing, in a **dev** seed this programme never touched; seeded rows carry
  `mustChangePassword: true`, the admin password is prompted, and `seed-prod.ts` is clean and
  prompts. Classified P2 rather than P1 because it is dev-only and not a live credential — but
  it is the tenant owner's call, and it should be removed.
- **P2 — `cron.controller.ts:29`** compares the cron secret with `===` rather than
  `crypto.timingSafeEqual`.

No P0/P1 security issue. No stop condition triggered.

---

## 8. Temporary artefacts

**All nine measurement harnesses are gone** — `acct-check`, `dt-check`, `mm-check`, `ta-check`,
`hr-check`, `a11y-check`, `sr-check`, `pk-check`, `iv-check` — confirmed absent from source
**and** from all five build manifests (230 route entries, zero probe routes). Their only
remaining trace is prose in the phase documents.

- Probe specs: none remain. `e2e/` holds 7 legitimate specs + 2 support files.
- `console.log` / `console.debug` in production source: **zero**. The four `console.warn/error`
  calls are legitimate failure paths.
- Test-only imports in production code: **none**.
- `*.bak` / `*.orig` / `*.tmp`: **none**.
- One `iv-measure` screenshot lingered in `test-results/`, since overwritten. Both
  `test-results/` and `.next/` are gitignored with **zero tracked files**, so neither can reach
  a merge.

---

## 9. Test integrity

No evidence of tests weakened to force CI green: **no `.only`, no `xit`, no
`expect(true).toBe(true)`, no empty bodies, no commented-out assertions, and zero
`waitForTimeout` anywhere in the repository.** `forbidOnly` is enforced in CI.

Coverage: **251 unit/integration files, 2,638 cases** (web 67/727, api 184/1,911), plus 7 e2e
specs.

Three items reported rather than changed:

1. **The :3002 skip** (§5) — the most consequential, because it retires a security assertion.
2. **`e2e/authenticated/leave.spec.ts:26-29` and `:33-37`** wrap their assertions in
   `if (await x.isVisible())`, so a missing element — precisely the regression they exist to
   catch — passes having asserted nothing. Predates the credential migration.
3. Five component tests mock `hasPermission: () => true`. Normal for component tests, and RBAC is
   covered on its own terms by `nav-rbac-parity.test.tsx`, `accounting-rbac-matrix.test.ts` and
   `manager-implicit-perms.test.ts`.

---

## 10. Regression by area

Every guard the programme built was re-run as part of the full suite (2,752 passing):

| Area | Guards | Result |
|---|---|---|
| Shared primitives | title derivation (12), table accessibility (15), sheet width cascade, input sizing + contrast | **PASS** |
| DataTable | action-column coverage, money visibility, mobile hierarchy, `mobileMode` + footer invariant | **PASS** |
| Projects | requests page, board responsive, task card drag, move-to sheet, timeline, task detail | **PASS** |
| Accounting | money-visibility invariant across 16 arrays / 31 money columns | **PASS** |
| HRMS | 18 — equity matrix, toolbars, payslip table, filter names, field expectations | **PASS** |
| Sales / Revenue | 8 — card faces on both surfaces, accounts numeric cells | **PASS** |
| Investor | 8 — column height, header wrap, tab variant, board decision, move rollback | **PASS** |
| Accessibility | combobox naming (12), dashboard heading invariant | **PASS** |

Desktop regression is guarded structurally by those suites (each asserts desktop parity) and was
re-measured directly in Phases 10A/10B at 1280/1440/1920.

---

## 11. Changes made during 10C

1. `.github/workflows/deploy.yml` — literal `\n` → newline (**P1**, §3)
2. `.github/workflows/deploy-staging.yml` — same
3. `e2e/responsive-overflow.spec.ts` — 9 → 12 widths, plus two short viewports and a collapse
   detector (test-only)

**Zero production source files changed.**

---

## 12. Known limitations

1. **Authenticated E2E remains unrun.** The responsive matrix covers `/sign-in` and
   `/forgot-password` — the only routes reachable without a session. Every module surface was
   measured earlier via temporary harnesses mounting real components, never on its own page with
   real data.
2. **The :3002 suites will skip again** on the next unattended run (§5). This gate ran them by
   hand; CI will not.
3. **Web Push has never delivered a real notification** (§6).
4. **WebKit only** — Chromium and Firefox Playwright binaries are absent. No physical device.
5. **The investors list tab was never measured** (Phase 10B §12.1) — `min-w-[140px]` selects in
   ~128px grid tracks at 320px remain unproven, not proven safe.
6. **`safeTargetPath()` / `isSafeNotificationUrl()` can be bypassed by an embedded tab or
   newline** — `/` + `\n` + `/evil.com` passes all three checks but the URL parser strips the
   newline, yielding `//evil.com`. **Not exploitable as shipped**: the payload is VAPID-signed, so
   only the server can set `url`, the server validates before sending, and the only business
   caller passes a template over a DB-sourced UUID. Reported as **P2** rather than fixed, because
   this gate's rule is to change only demonstrated regressions — but the worker's own comment says
   it "must not depend on" the server, so it is worth hardening.
7. **`NEXT_PUBLIC_VAPID_PUBLIC_KEY` is plumbed through four files and never read** — the client
   fetches the key from `/api/push/config`. Harmless dead wiring, but the Phase 6 doc still
   documents it as the delivery path.
8. **`isHashedStatic()` cache-firsts four paths that are not content-hashed** (`/icons/`,
   `/manifest.webmanifest`, two favicons), so a replaced icon serves stale until `SW_VERSION` is
   bumped — an undocumented release step.

---

## 13. Release recommendation

### READY WITH KNOWN LIMITATIONS

**Why ready:** the baseline is exact and reproducible (2,752 tests, clean type-check, zero lint
errors, successful production build). Every guard the programme built passes. The temporary
harnesses are genuinely gone from source and from the build. The security sweep found no
permission bypass, no client-addressable push recipient, no leaked credential and no test route
in production. The PWA's central security property — that no authenticated endpoint is cached —
was verified against a real service worker for the first time, not assumed. The one regression
this programme introduced was found and fixed.

**Why "with known limitations":** the twelve-width matrix runs against two public routes. Every
module conversion — 45 action columns, 31 hierarchy conversions, 4 matrix decisions, 5 shared
primitive changes, 172 newly-named controls — is verified by unit tests and by harnesses that
mounted the real components, but **not one has been seen on its own page, by a real user, with
real data**. That is not a defect; it is an untested surface, and it is the whole content of the
authenticated-E2E blocker.

**The deploy fix is the reason to re-run CI before merging.** Both pipelines would have failed at
the docker build step; that is now corrected but has never been executed.

---

## 14. Recommended next phase

**Stop responsive development. Merge to Dev/Staging and verify there.**

There is no Phase 10D worth running. The measurable-from-source surface is exhausted: this gate
changed zero production files and found its one real defect in a CI workflow, which is precisely
the signal that further static work has run out of road.

On merge, in order:

1. **Watch the first `deploy-staging` run** — the docker build step specifically. It has never
   succeeded with the current build-arg block.
2. **Provision the account and dataset** from Phase 7G-1 §9 — a dedicated non-admin user and a
   safe test project. That single prerequisite has blocked verification across eleven phases.
3. **Run the authenticated matrix** on staging: the 12 widths plus 667×375 and 844×390 against
   the real module routes.
4. **Add a :3002 `webServer`** so the PWA and contrast suites stop skipping in CI.
5. **Resume the paused `marketing-drift-check` Cloud Scheduler job** after the release lands
   (CLAUDE.md records it as created-and-paused).

The queue behind step 2 is large but uniformly test-guarded, so the risk is not silent
regression — it is that a **product judgement** is wrong in a way no test can catch. Only a
person using the thing on a phone will settle that.
