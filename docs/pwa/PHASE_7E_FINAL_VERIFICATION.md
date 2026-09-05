# Phase 7E — Final verification

**Status:** verification complete for everything reachable without a session.
**No production code was changed.** No API, database, migration, RBAC or dependency change.

**RELEASE STATUS: READY WITH KNOWN P2 LIMITATIONS — authenticated paths NOT VERIFIED.**

---

## 1. Environment

| | |
|---|---|
| Web dev server | `:3000` — 200 |
| API dev server | `:3001` — 401 (up) |
| **Production build** | **`next build` exit 0**, compiled in 65s; standalone server ran on `:3002` |
| Playwright | **1.62.1** |
| axe-core | **4.13.0**, injected into a real browser |
| Physical devices | **none** |
| Authenticated session | **none** (see §3) |
| Staging | not used |

### A correction to my own earlier inventory

The deferred 7E pass reported "WebKit is installed and usable". **That was wrong.** The
installed binaries were leftovers from older Playwright versions — `chromium-1228`,
`firefox-1532`, `webkit-2311` — while 1.62.1 requires `chromium-1234` and `webkit-2336`.
**No engine could launch**; the first run produced 38 failures, all
`Executable doesn't exist`.

With approval, `playwright install webkit` was run — **59.6 MiB**, WebKit 26.5
(`webkit-2336`). Chromium and Firefox were deliberately **not** installed, so Playwright
cannot drive them. Chromium was instead tested through the in-app browser, which is a real
Chromium; **Firefox was not tested at all**.

---

## 2. Baseline and final

| | Before | After |
|---|---|---|
| Unit tests | 2,598 (1,958 API + 640 web) | **2,598** — unchanged |
| type-check | 10/10 | **10/10** |
| lint | 0 errors | **0 errors** |
| Production build | not previously run | **exit 0** |
| E2E (WebKit) | none could run | **38 overflow + 1 kept spec passing** |

No test was weakened. No production code changed, so unit counts are identical by design.

---

## 3. Authentication — NOT TESTED, and why

The repository's only credential is the one the earlier pass reported as a **P0 leak**. It
was not used, not read, not retrieved from history, and does not appear anywhere in this
phase's output. No `storageState`, no `E2E_*` environment variable and no test account was
supplied.

Everything downstream of a session is therefore **NOT TESTED**: login, deep links after
login, query-string preservation, session expiry, logout, PWA session persistence, the
project list, project requests, approvals, stale approvals, the real board, real task moves
and push. That is the single largest gap in this release gate and it has not moved since
Phase 1.

---

## 4. WebKit — the iOS engine, first run ever

Labelled precisely: **WebKit device emulation**, using the `iPhone 13` and `iPad Mini`
profiles. Same engine Safari runs, real touch events. **Not a physical Apple device**, and
no claim here depends on one.

### Horizontal overflow — 38 tests, both profiles, PASS

`/sign-in` and `/forgot-password` at 320, 375, 390, 430, 768, 1024, 1280, 1440, 1920.
Zero horizontal document scroll on every combination. This is the first time the project
has been exercised on WebKit at all.

### Phase 8 and Phase 7D fixes, verified on the real engine

Run against a temporary harness rendering the real components (harness deleted, §10):

| Verified on WebKit iPhone 13 | Result |
|---|---|
| Task detail: every visible field ≥16px | **PASS** — the Phase 8 fix, on the engine it was written for |
| Task detail: fills the viewport width | **PASS** — 390px sheet in a 390px viewport |
| Task detail: exactly one vertical scroller | **PASS** |
| Task detail: close control on-screen and ≥44px | **PASS** |
| Move sheet: fits the viewport, destinations ≥44px | **PASS** |
| **Drag grip: `touch-action: none` on the grip and nowhere else** | **PASS** — exactly 2 elements on a 2-card board, both grips |
| Drag grip: 44px hit area via `::after` | **PASS** |
| Card body tap reaches the opener, not a drag | **PASS** |
| Pointer drag on the grip reaches the sensor | **PASS** |

**10/10 on iPhone 13; 18/20 across both profiles with 2 skipped** (the skips are the 16px
assertions at iPad width — see §5).

**Still not verified:** that a *human finger* lifts a card on a physical iPhone. Playwright
dispatches real touch events on the real engine, which is a materially stronger signal than
anything the programme had before, and it is not the same thing.

---

## 5. New finding — the 16px floor stops at 768px, but iPads do not

The base `Input` is `text-base md:text-sm`, and Phase 8 followed the same convention
(`text-base md:text-[13px]`). That boundary encodes an assumption: **≥768px means a mouse**.

An **iPad Mini is 768px and is a touch device running Safari**, which zooms on any focused
input under 16px. Measured on the WebKit iPad profile: sign-in fields **14px**, task-detail
fields **13px**.

So iPads still zoom on focus, across the whole application.

**Severity P2.** Not fixed here: raising the boundary to `lg` would change input sizing for
every form on every screen between 768 and 1023px — an app-wide density change requiring a
design decision, and the fix policy for this phase is confined to contained, reproduced
defects. Two tests were `skip`ped rather than deleted, so the gap stays visible.

---

## 6. Accessibility — first real scanner run

axe-core 4.13.0 against `/sign-in` in a real Chromium. **33 passes, 3 violations:**

| Rule | Impact | Nodes |
|---|---|---|
| `color-contrast` | **serious** | 4 |
| `landmark-one-main` | moderate | 1 |
| `region` | moderate | 5 |

All four contrast failures share one root cause: **`--muted-foreground: 36 9% 65%`**
resolves to `#aea79e`, which is **2.38:1 on white** against a 4.5:1 requirement. Two of the
four are the **EMAIL and PASSWORD form labels**.

This is a **global design token**, so every muted label, hint, timestamp and secondary value
in the application fails contrast — including surfaces built in Phases 7–8 (`RecordCard`
field labels, status tab labels, card subtitles).

**Severity P2, systemic.** Not fixed: changing a brand colour token alters every screen and
is a design decision, not a contained defect fix.

Only `/sign-in` was scanned. **Authenticated pages were not scanned**, so this is a floor,
not a complete picture.

---

## 7. Service worker, cache security and offline — PASS on the production build

The dev server deliberately unregisters any worker (Phase 3 design, confirmed in source), so
this needed the production build. Verified in Playwright WebKit against `:3002`:

| | Result |
|---|---|
| Registration | **PASS** — scope `/`, state `activated` |
| Cache created | `tbh-shell-v1`, 3 entries |
| **`/api/*`, `/auth/*`, `/ingest/*` cached** | **NONE — empty list** |
| Offline navigation to an unvisited route | **PASS** — served the cached shell rather than a browser error |
| Forbidden endpoints cached after going offline | **still none** |

**Step 30 (cache security) passes on a real engine against a real production build.** No
private response body was read or printed.

### A P1 I nearly reported that was not real

The in-app browser refused registration with *"An unknown error occurred when fetching the
script"* while `fetch('/sw.js')` succeeded and the response carried the correct
`application/javascript` Content-Type and `Service-Worker-Allowed: /`. Had I stopped there I
would have reported the entire PWA foundation as inert in production. An independent engine
showed it registering and activating normally — **the embedded pane was blocking
registration, not the application.**

---

## 8. Sheet consumer audit (Part L) — read-only

The Phase 8 root cause generalises. `SheetContent` sets `data-[side=right]:w-3/4`, and an
attribute-prefixed utility outranks a consumer's plain `w-full` however `cn()` orders them.

**18 usages; 16 declare `w-full` and are out-specified.**

| Status | Files |
|---|---|
| Fixed (Phase 8) | `projects/task-detail-sheet` |
| **Affected, not fixed** | accounting/journal-review · accounts/account-detail · contacts/contact-detail · helpdesk/ticket-detail · investors/investor-detail · leads/lead-detail · opportunities/opportunity-detail · partners/partner-task-detail · payroll/payroll-run-detail · sales-revenue ×4 · travel/travel-detail · visa/ninety-day-detail |
| No width declared | directory/employee-detail · ui/sidebar |

Three of them (`partner-task`, `payroll-run`, `task-detail`) already carry `!` on their
**max-width** — three separate authors hit the symptom and patched it; none noticed the
width itself.

**Not fixed, per Part L.** The defect was reproduced by measurement on **one** consumer
(task detail: 292.5px in a 390px viewport). The other 15 share an identical class conflict
but were **not individually measured**, and most need a session to reach. The right fix is
probably in the primitive — out of scope here.

---

## 9. Verification matrix

| Area | Chromium | Firefox | WebKit | iPhone profile | iPad profile | Authenticated |
|---|---|---|---|---|---|---|
| Navigation | PASS | NOT TESTED | PASS | PASS | PASS | NOT TESTED |
| Overflow (public routes) | PASS | NOT TESTED | PASS | PASS | PASS | NOT TESTED |
| Project List | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Project Requests | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Project Board | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Task Move | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Kanban DnD (grip contract) | PASS | NOT TESTED | PASS | PASS | PASS | NOT TESTED |
| Keyboard DnD | NOT TESTED | NOT TESTED | NOT TESTED | n/a | n/a | NOT TESTED |
| Timeline | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Task Detail (geometry, inputs) | PASS | NOT TESTED | PASS | PASS | PASS¹ | NOT TESTED |
| Forms / inputs ≥16px | PASS | NOT TESTED | PASS | PASS | **FAIL²** | NOT TESTED |
| Sheets | PASS | NOT TESTED | PASS | PASS | PASS | NOT TESTED |
| PWA / service worker | BLOCKED³ | NOT TESTED | PASS | PASS | NOT TESTED | NOT TESTED |
| Offline | BLOCKED³ | NOT TESTED | PASS | PASS | NOT TESTED | NOT TESTED |
| PWA installation | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Push | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Accessibility (axe) | PASS w/ violations | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |

¹ geometry passes; ² inputs are 13–14px at iPad width (§5); ³ the embedded Chromium pane
blocks SW registration, so Chromium PWA behaviour could not be exercised — this is a tooling
limit, not an app result.

**Keyboard DnD is NOT TESTED**, not PASS. It was unit-tested in Phase 7D (sensor registered,
coordinate getter present) but a real lift/move/drop needs a board, which needs a session.

---

## 10. Defects

| # | Finding | Severity | Action |
|---|---|---|---|
| 1 | Inputs are 13–14px at ≥768px, so iPads zoom on focus | **P2** | Documented (§5); needs an app-wide design decision |
| 2 | `--muted-foreground` is 2.38:1 on white, app-wide | **P2** | Documented (§6); brand token, not a contained fix |
| 3 | 15 further `SheetContent` consumers share Phase 8's width conflict | **P2** | Documented (§8); reproduced on one, not fifteen |
| 4 | `landmark-one-main` / `region` on `/sign-in` | P3 | Documented |
| 5 | Playwright browsers were unusable; my earlier inventory said otherwise | — | Corrected; WebKit installed |

**No P0 and no P1 was found in the application.** The one P0 in this codebase remains the
committed credential reported earlier, which is untouched and unresolved.

**No fixes were applied.** Every finding is either systemic (1, 2), out of the fix policy's
"reproduced and contained" bar (3), or cosmetic (4).

---

## 11. Remaining limitations

1. **Nothing authenticated has been verified, in any phase.** §3.
2. **No physical device.** WebKit emulation is not an iPhone; the touch-drag claim stops at
   "real touch events on the real engine".
3. **Firefox not tested** — its Playwright build was not installed.
4. **Chromium PWA/offline not tested** — the embedded pane blocks SW registration.
5. **PWA installation and push not tested** — no install surface, no VAPID configuration.
6. **axe ran on one public page only.**
7. **The WebKit component tests were not kept.** They needed a harness route that must not
   ship, so the harness and the harness-dependent tests were deleted; only the `/sign-in`
   16px test remains in `e2e/webkit-verification.spec.ts`. The method is recorded here so it
   can be reproduced.

---

## 12. Technical debt

Unchanged and still recorded: `listAssignableUsers` fetching 200 users per board open; no
pagination on tasks, comments or activity; a failed move refetching the whole project; the
`SheetContent` width conflict (§8); `.touch-target` being unusable through an arbitrary
variant. Added by this phase: **Playwright browser binaries drift out of sync with the
Playwright version**, and nothing in CI catches it because CI never runs E2E.

---

## 13. Release status

**READY WITH KNOWN P2 LIMITATIONS — authenticated paths NOT VERIFIED.**

What supports "ready": the production build succeeds; 2,598 unit tests, type-check and lint
are clean; the service worker registers, activates and caches **no** authenticated endpoint;
offline serves a shell; zero horizontal overflow on every tested width on two engines; and
the two fixes this programme was least sure of — Phase 8's 16px rule and Phase 7D's
`touch-action` placement — both hold on the real iOS engine.

What qualifies it: **no login, approval, board, task-move or push path has ever been
exercised**, on any engine, in any phase. Three P2s are open, two of them app-wide. Whether
that is shippable is a business call about how much of the product is reachable only behind
a session — which is most of it.

---

## 14. Recommended next phase

**Unblock authentication. It is the only thing standing between this programme and a real
release gate**, and every phase since Phase 1 has ended with the same sentence.

1. Rotate the leaked admin password (still outstanding from the earlier pass).
2. Provision a **non-admin** test account and expose it as `E2E_EMAIL` / `E2E_PASSWORD`, or
   commit a Playwright `storageState` produced out-of-band.
3. Re-run this phase's matrix against authenticated routes, and re-create the harness-free
   versions of the WebKit component tests (§11.7).
4. Then decide on the three P2s: the iPad input threshold, the contrast token, and the
   `SheetContent` width conflict — each is a small change gated on a design decision rather
   than on engineering.
