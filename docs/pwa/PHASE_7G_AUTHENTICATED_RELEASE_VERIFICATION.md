# Phase 7G — Authenticated release verification

## RELEASE STATUS: **BLOCKED**

**AUTHENTICATED VERIFICATION BLOCKED — NO SAFE TEST CREDENTIAL AVAILABLE.**

This is the phase's own decision rule, not a judgement call: *"BLOCKED if authentication
cannot be safely verified AND authenticated verification is required for release."* This
phase exists because it is required.

**No production code was changed.** No API, database, migration, RBAC, auth or dependency
change.

---

## 1. Why it is blocked

Checked at Step 0, **names only, never values**:

| | |
|---|---|
| `E2E_EMAIL` / `E2E_PASSWORD` in process env | **not defined** |
| `E2E_*` in `.env.development` | **not defined** |
| Playwright `storageState` | **none present** |
| `playwright/.auth/`, `e2e/.auth/`, `.auth/` | **none present** |
| Auth setup project or helper in `playwright.config.ts` | **none configured** |
| Dedicated test/staging dataset | **none identified** |

The only credential in the repository is the System Admin password reported as a **P0 leak**
in Phase 7E. It was **not used, not printed, not retrieved, and git history was not
searched.** The rotation recommended in Phase 7E is still outstanding.

So every authenticated item in this brief — Steps 4 and 6 through 26, 29 through 35 — is
**BLOCKED**, not "not tested by choice".

---

## 2. An error of mine, reported in full

Running `playwright test` **unscoped** executed the two pre-existing specs that authenticate
with the compromised credential (`e2e/auth.spec.ts`, `e2e/leave.spec.ts`). I should have
scoped the run to the specs I control. It attempted logins with that account.

What happened, read from the existing failure artefacts rather than by re-running:
**`should login successfully with valid credentials` failed with a timeout waiting for
`/dashboard`** — so **no authenticated session was established**. Whether that is because
the password has since been rotated or because of a WebKit/dev-server issue cannot be
determined without further attempts, which I did not make.

Every subsequent run in this phase was scoped to the four unauthenticated specs.

**Operational hazard worth raising:** anybody running `pnpm test:e2e` on this repository
today attempts logins with a leaked System Admin credential. Those two spec files were left
untouched — their fix is the credential rotation and env-var handling that belongs to
whoever owns the account, not a unilateral edit from here.

---

## 3. Environment

| | |
|---|---|
| Web (dev) | `:3000` — 200 |
| API (dev) | `:3001` — 401 (up) |
| Web (production standalone) | `:3002` — built and served for the PWA pass, then stopped |
| Playwright | 1.62.1 |
| **Chromium** | **BLOCKED** — binary absent (`chromium-1234` required) |
| **Firefox** | **BLOCKED** — binary absent |
| **WebKit** | **available** — `webkit-2336`, WebKit 26.5 |
| iPhone 13 profile | available |
| iPad Mini profile | available |
| Physical devices | **none** |
| axe-core | 4.13.0 |

Phase 7E installed WebKit only, by agreement. Chromium and Firefox remain uninstalled, so
the browser matrix this brief asks for cannot be completed even for unauthenticated routes.

---

## 4. Baseline (and final — nothing changed)

| | Result |
|---|---|
| Unit / integration | **2,625 passed** (1,958 API + 667 web) |
| type-check | **10/10 clean** |
| lint | **0 errors** (3,152 warnings, pre-existing) |
| Production build | **exit 0** |

---

## 5. What WAS verified — unauthenticated only

**50 E2E assertions on the real iOS engine**, across iPhone 13 and iPad Mini.

### Responsive overflow — PASS
`/sign-in` and `/forgot-password` at 320, 375, 390, 430, 768, 1024, 1280, 1440, 1920.
**38 tests, zero horizontal document overflow** on both profiles.

### Input sizing (Phase 7F fix) — PASS
Every focusable text field ≥16px on a coarse pointer, asserted unconditionally on both
profiles — including **iPad Mini at 768px**, which was 14px before Phase 7F.

### PWA on the production build — PASS
| | Result |
|---|---|
| Service worker | registers, scope `/`, state `activated` |
| Cache | `tbh-shell-v1`, 3 entries |
| **`/api/*`, `/auth/*`, `/ingest/*` cached** | **none — online and after offline navigation** |
| Offline navigation to an unvisited route | serves the cached shell |
| Manifest | `display: standalone`, 4 icons, `start_url: /`, `scope: /` |

Step 23's security property holds on a real engine against a real production build.

### Accessibility on the production build — PASS for contrast
axe-core 4.13.0 against the **shipped bundle**:

| Route | `color-contrast` | Remaining |
|---|---|---|
| `/sign-in` | **0** (was 4 serious) | `landmark-one-main` ×1, `region` ×5 — moderate, P3 |
| `/forgot-password` | **0** | same two |

Token confirmed as `36 9% 41%` in the production CSS, so the Phase 7F fix genuinely ships.

---

## 6. Final test matrix

| Workflow | Desktop | iPhone WebKit | iPad WebKit | Status |
|---|---|---|---|---|
| Login | BLOCKED | BLOCKED | BLOCKED | no safe credential |
| Navigation (authenticated shell) | BLOCKED | BLOCKED | BLOCKED | |
| RBAC | BLOCKED | BLOCKED | BLOCKED | |
| Deep link | BLOCKED | BLOCKED | BLOCKED | |
| Dashboard | BLOCKED | BLOCKED | BLOCKED | |
| Projects | BLOCKED | BLOCKED | BLOCKED | |
| Requests | BLOCKED | BLOCKED | BLOCKED | |
| Approval | BLOCKED | BLOCKED | BLOCKED | |
| Board | BLOCKED | BLOCKED | BLOCKED | |
| Mobile Move | BLOCKED | BLOCKED | BLOCKED | |
| Desktop DnD | BLOCKED | N/A | N/A | |
| Keyboard DnD | BLOCKED | N/A | N/A | |
| Task Detail | BLOCKED | BLOCKED | BLOCKED | |
| Sheets (authenticated consumers) | BLOCKED | BLOCKED | BLOCKED | |
| Forms (authenticated) | BLOCKED | BLOCKED | BLOCKED | |
| Session expiry | BLOCKED | BLOCKED | BLOCKED | |
| Logout | BLOCKED | BLOCKED | BLOCKED | |
| **PWA / service worker** | BLOCKED¹ | **PASS** | NOT TESTED | production build |
| **Offline shell** | BLOCKED¹ | **PASS** | NOT TESTED | |
| **Public-route overflow** | BLOCKED¹ | **PASS** | **PASS** | 38 tests |
| **Input ≥16px on touch** | N/A | **PASS** | **PASS** | Phase 7F fix |
| **Contrast (axe)** | BLOCKED¹ | **PASS** | NOT TESTED | production bundle |
| Push | NOT TESTED | NOT TESTED | NOT TESTED | no VAPID configuration |

¹ Chromium binary absent.

### Responsive matrix — public routes only

| Width | Overflow | Inputs | Sheets | Navigation | Board | Task Detail |
|---|---|---|---|---|---|---|
| 320 | **PASS** | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 375 | **PASS** | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 390 | **PASS** | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 430 | **PASS** | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 768 | **PASS** | **PASS** | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 834 | NOT TESTED | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 900 | NOT TESTED | NOT TESTED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 1024 | **PASS** | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 1280 | **PASS** | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 1440 | **PASS** | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| 1920 | **PASS** | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |

Sheets, navigation, board and task detail have **no unauthenticated surface** — every one of
them lives behind a login.

---

## 7. The honesty distinction this brief asks for

| Level | What exists today |
|---|---|
| **UNIT TESTED** | 2,625 tests. Covers cascade resolution, class contracts, component behaviour in jsdom. |
| **BROWSER TESTED** | Real Chromium via the in-app pane, at emulated widths — used in Phases 7–8 for geometry. |
| **WEBKIT TESTED** | 50 assertions on WebKit 26.5 with real touch events, iPhone 13 and iPad Mini profiles. |
| **AUTHENTICATED E2E TESTED** | **Nothing. In any phase.** |
| **PHYSICAL DEVICE TESTED** | **Nothing. In any phase.** |

Specifically, and to retire three claims that could be misread:

- *"`touch-action` is unit tested and WebKit tested"* does **not** mean touch drag works on
  an iPhone. No finger has touched this application.
- *"Inputs compute 16px in WebKit"* does **not** mean iOS Safari does not zoom. The
  precondition is verified; the behaviour is not.
- *"The sheet cascade is fixed"* is verified by unit test and by harness measurement. It has
  **never been seen in a real authenticated sheet.**

---

## 8. Findings

No new defects. Nothing was fixed, because nothing new was found and the phase's default is
no production change.

Carried forward, all previously reported:

| # | Finding | Severity | State |
|---|---|---|---|
| 1 | Committed System Admin credential | **P0** | **open** — rotation outstanding since 7E |
| 2 | `pnpm test:e2e` attempts logins with it (§2) | **P1 operational** | open — depends on 1 |
| 3 | 13 sheets widened by 7F-1, never visually reviewed | P2 | open — needs a session |
| 4 | `landmark-one-main` / `region` on public routes | P3 | open |
| 5 | `directory/employee-detail-sheet` has no `w-full` | P3 | open |
| 6 | `table-layouts` router test flaked once in 7F-1 | P3 | not reproduced since |
| 7 | Chromium and Firefox Playwright binaries absent | tooling | open |
| 8 | `.auth/` and storageState are **not gitignored** | tooling | **fix before any auth fixture lands** |

---

## 9. Cleanup and security

- Temporary harnesses: **none created this phase**.
- `test-results/` and `playwright-report/`: removed (both gitignored anyway).
- Production server on `:3002`: stopped.
- **Working tree scanned for newly introduced secrets** (Step 38, working tree only — git
  history was not searched). The only matches are `${{ secrets.* }}` GitHub Actions
  *references* in the deploy workflows, which are names rather than values. **No credential,
  token, key or session artefact is present.**
- No auth artefact was generated, so none needed ignoring — but §8.8 stands for next time.

### Files added

Four E2E specs, all unauthenticated and all passing:

```
e2e/webkit-verification.spec.ts    (Phase 7E, kept)
e2e/responsive-overflow.spec.ts    (Phase 1, kept)
e2e/pwa-verification.spec.ts       (new — service worker, offline, cache security, manifest)
e2e/a11y-verification.spec.ts      (new — axe on the production bundle)
```

The two new ones target `:3002` and **skip with a stated reason** when it is not running —
an environment fact, not a hidden failure.

---

## 10. What it would take to unblock

1. **Rotate the leaked System Admin password.** Outstanding since Phase 7E. Everything else
   waits behind it, and until it happens the repository ships a working admin credential.
2. **Provision a dedicated non-admin E2E account** in a test or staging dataset, exposed as
   `E2E_EMAIL` / `E2E_PASSWORD`, or supply a `storageState` generated out-of-band.
3. **Add `playwright/.auth/` and `*.storageState.json` to `.gitignore`** before any fixture
   is generated (§8.8).
4. **Quarantine or rewrite `e2e/auth.spec.ts` and `e2e/leave.spec.ts`** so they use the new
   credential source (§2).
5. Optionally `pnpm exec playwright install chromium firefox` to complete the browser matrix.

With (1)–(4) in place this phase can be re-run as written, and it is the last substantial
gap in the programme.

---

## 11. Recommended next phase

**Re-run Phase 7G once a safe credential exists.** Nothing else in this brief can be
completed without it, and no further responsive or PWA work should be scheduled ahead of it:
the programme has now built and hardened nine surfaces across nineteen phases, and none of
them has been seen by a logged-in user.
