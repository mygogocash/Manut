# Phase 4 — Authentication, Session & Responsive Navigation

Making the existing auth and navigation experience work at every width. **The authentication architecture was not changed.**

References: [MOBILE_PWA_AUDIT.md](MOBILE_PWA_AUDIT.md) · [PHASE_1](PHASE_1_RESPONSIVE_FOUNDATION.md) · [PHASE_2](PHASE_2_DESIGN_SYSTEM.md) · [PHASE_3](PHASE_3_PWA_FOUNDATION.md) · Completed 2026-08-24

---

## Headline: most of this phase was already done

The audit for this phase found the existing implementation in better shape than the brief assumed. Four things the brief asked for were **already correct** and were verified rather than built:

| Brief asks for | Actual state |
| --- | --- |
| Responsive login with correct mobile keyboard behaviour (Step 3, 17) | **Already correct.** `ui/input.tsx` is `text-base md:text-sm` — 16px on mobile, so iOS never zooms on focus. Fields and submit are 40px tall. `autocomplete="email"` / `"current-password"` already set |
| Deep-link return after sign-in (Step 13) | **Already implemented, and hardened.** `ProtectedRoute` parks the route in `?redirect=`; `auth-provider`'s `safeRedirectTarget()` rejects protocol-relative and absolute URLs and `/sign-in` bounces, because an open redirect on a login page is a phishing primitive |
| Single navigation source (Step 8) | **Already true.** `NAV_GROUPS` drives the sidebar, the mobile drawer, route permissions *and* page titles |
| Session expiry handling (Step 15) | **Already implemented.** `apiFetch` attempts one silent refresh on a 401, then the guard bounces to sign-in |

So the work was: three real defects found in the audit, one shared-source refactor, and verification. **No authentication logic was touched.**

## 1. Authentication architecture

Mapped as the brief asked, from the code:

```
Supabase Auth  ──issues JWT──▶  httpOnly cookies  (secure in prod, sameSite none/lax)
                                      │
                                      │  every request: credentials:"include"
                                      │  every mutation: X-Requested-With (CSRF)
                                      ▼
              Next rewrite  /api/*  ──▶  Express middleware
                                      │      authenticate → requireActive
                                      ▼
                        Prisma user + roles + permissions, per request
                                      │
                    GET /api/auth/me  ▼
                              AuthProvider state
                    { user, roles, permissions, memberships }
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
             ProtectedRoute      NAV_GROUPS         hasPermission()
             (route guard)    (permission filter)   (in-page gating)
                    │                 │
                    ▼                 ▼
              allowed routes    sidebar + drawer + page title
```

Key files, unchanged this phase: `apps/api/src/modules/auth/auth.controller.ts` (login / refresh / logout / me), `auth.service.resolvePermissions` (the system-Admin bypass), `src/providers/auth-provider.tsx`, `src/lib/api-client.ts`.

| Concern | Implementation |
| --- | --- |
| Login | `POST /api/auth/login`; sets both cookies |
| Session restore | `AuthProvider` calls `/me` on mount, login, visibility-return and a timer |
| Expiry | 401 → one silent `POST /api/auth/refresh` → retry once → else guard redirects |
| Logout | `POST /api/auth/logout`, then state cleared client-side |
| Forced change | `user.mustChangePassword` → `/change-password` |
| Unauthorized | `ProtectedRoute` → `notFound()` (the app's existing convention; **not** changed to a 403 page) |
| Redirect exemptions | `authRedirectExemptPaths` keeps mid-auth flows from bouncing |

## 2. Session behaviour

Unchanged. Verified by reading the paths and by unit tests over the guard: a resolving session renders neither the children nor a redirect (flashing protected content is a leak; bouncing early logs people out on every refresh), an authenticated session renders, an unauthenticated one redirects with the target parked.

## 3. RBAC behaviour

**Authoritative on the server, unchanged.** Permission codes are `module:action` or `module:sub:action` — the API defines 28 of the three-segment form (`it:access:approve`, `marketing:dashboard:view`). The system-Admin role is granted every code by `resolvePermissions`.

The front end filters navigation from the same codes. There is **no width-dependent branching anywhere in the permitted set** — both surfaces filter one array with one predicate, so parity is structural rather than something to keep in sync. A test simulates that filter and asserts the desktop and mobile results are identical, *and* that gated entries the test user lacks are genuinely absent.

Front-end gating remains defence in depth. A test records that intent explicitly, so nobody later removes the guard on the grounds that the API checks anyway.

## 4. Navigation architecture

`NAV_GROUPS` (in `src/components/layout/sidebar.tsx`) remains the single source. It feeds:

- the docked sidebar,
- the mobile drawer (the *same* component inside a Radix `Sheet`),
- `ROUTE_PERMISSIONS` in the dashboard layout,
- page titles in the topbar (Phase 1).

No `mobileNav` exists and tests guard against one appearing. Tests also assert: every entry has a label and an absolute route, no duplicate ids, and **no entry points at a `/mobile`-style route** — one canonical URL for browser, tablet and installed PWA.

## 5. Mobile drawer

Phase 1 added close-on-navigate. This phase fixed two defects found by reading `ui/sidebar.tsx`:

| Defect | Fix |
| --- | --- |
| `[&>button]:hidden` suppressed Radix's close button, so the drawer could only be dismissed by tapping the overlay, pressing Escape, or navigating. All work; none is *visible*, and a drawer with no X reads as stuck | Close button restored, nudged to `top-3 right-3` and given `z-10` so it sits above the header row |
| Accessible name was **"Sidebar"** with description "Displays the mobile sidebar" — accurate and useless to a screen-reader user | Now **"Main navigation"** / "Modules and sections you have access to." |
| Footer account menu could sit under the iOS home indicator | `pb-safe` on the sheet content |

Unchanged and already working: overlay, focus trap, focus return, body-scroll lock, Escape, expandable sections, active route, 18rem width, close-on-navigate.

## 6. Tablet navigation

Phase 1's decision stands: the sidebar starts collapsed to its icon rail below `xl` (1280px), expanded above. Re-checked at 834px — no overflow, no overlap. **No change made**, per the brief's instruction to make only the smallest safe change if needed.

Open question for device QA: at 768–834px the icon rail plus content is comfortable, but whether an iPad user prefers the rail or the full sidebar is a preference call best made on hardware. It is a one-line change (`useIsAtLeast("xl")` → `"lg"`).

## 7. Active-route handling

Unchanged — the existing logic in `AppSidebar` matches exact routes and recognises nested ones (`pathname === href || pathname.startsWith(href + "/")`), with `/dashboard` special-cased so it does not light up everywhere. A collapsible parent expands when a child is active, so `Project CRM → Projects → record` keeps the hierarchy identifiable.

A test asserts nested nav children actually sit under their parent's route, which is what makes parent-active detection work rather than being coincidental.

## 8. Page-title source

Unchanged from Phase 1: `resolveTitle()` does a longest-prefix match over `NAV_GROUPS`, with the pre-existing `PAGE_TITLES` map winning where it deliberately differs (friendlier names like "Home" for `/dashboard`).

**No second map was created.** `PAGE_TITLES` predates this work; it is an override layer over the navigation source, not a parallel list. Trimming it was considered and rejected as churn with regression risk for no user-visible gain.

## 9. Deep-link behaviour

Already implemented; **one gap found and fixed.**

`ProtectedRoute` parked only `pathname`, dropping the query string. Approval emails link to things like `/projects?view=pending` — so the user was returned to the right page in the wrong state, which reads as the link having been wrong.

Now the full `pathname + search` is parked. Verified end to end in a browser: `/sign-in?redirect=%2Fprojects%3Fview%3Dpending` round-trips as `/projects?view=pending`. `safeRedirectTarget()` already accepted query strings and still rejects cross-origin values, so no security property changed.

Implementation note: the search string is read from `window.location` inside the effect rather than via `useSearchParams()`, because most dashboard routes prerender as static shells and the hook would force them dynamic. `auth-provider` reads it the same way.

## 10. Unauthorized handling

Unchanged. 401 → silent refresh → retry → redirect to sign-in. 403 / missing permission → `notFound()`.

**Entering a URL directly does not grant access**: the layout resolves per-route permissions for every path (including the employee allowlist — Phase 0 recorded that this was once a bypass and is now always evaluated), and the API enforces the same codes independently. Front-end visibility is not the boundary.

## 11. PWA authentication compatibility

The same architecture, by construction: the installed app is the same origin, the same routes, the same cookies. **No separate PWA authentication exists.**

The Phase 3 service worker excludes `/api/*`, `/auth/*` and `/ingest/*` before any caching logic runs, and caches no authenticated document. Consequences:

- The worker cannot read the session — `httpOnly` is invisible to script — and never needs to.
- **Nothing authenticated is cached, so logout leaves nothing behind.** No cache-purge-on-logout hook is required. If a later phase ever caches an authenticated response, that hook becomes mandatory.

Phase 3's tests assert this boundary against eight real API paths and five authenticated routes; they still pass.

**Not verified:** sign-in inside an actually-installed standalone PWA (§15).

## 12. Accessibility

- Drawer: accessible name and description improved; visible close button restored; focus trap, focus return and Escape from Radix.
- Account menu: the trigger has `aria-label="Account menu"`; the avatar image is `alt=""` (decorative — the name is in the menu label beside it, so announcing it twice is noise).
- Nav: `aria-expanded` on collapsible parents, active state conveyed by `data-active`, all from the existing sidebar primitives.
- Login: labels wired to inputs, error in an `Alert`, submit disabled with a spinner while pending.
- Touch targets: header menu trigger and avatar 36px on mobile; login fields and submit 40px.

No new accessibility framework introduced.

## 13. Tests

**19 new tests**, 2 files:

`components/auth/__tests__/auth-shell.test.tsx` (9) — redirect with target parked; **query string preserved**; nothing rendered and no redirect while the session resolves; renders when authenticated; forced password change diverts; single permission refused; permission *union* accepted (the case where an approver holds `leave:approve` but not `leave:read`); union refused when none held; client gating recorded as defence in depth.

`components/layout/__tests__/nav-rbac-parity.test.tsx` (10) — one navigation export; every entry labelled with an absolute route; no duplicate ids; no `/mobile` routes; permission codes well-formed (two **or** three segments); the same filter yields identical desktop and mobile sets *and* genuinely excludes; collapsible children independently gated; nested children sit under their parent route; account menu defined once with real routes.

One test failed on its first run by asserting two-segment permission codes. The code was right and the test was wrong — the API genuinely defines 28 three-segment codes — so the regex was widened, with the reason recorded in the test.

### Results

| Gate | Result |
| --- | --- |
| type-check | 10/10 workspaces clean |
| lint | **0 errors** |
| Full suite | **2,367 passing** (1,911 API + 456 web), up from 2,348 |

## 14. Browser verification

Against the running app:

| Width | Result |
| --- | --- |
| 390 × 844 | 0 page overflow; inputs **16px** (no iOS zoom); fields and submit 40px; `autocomplete` correct; labels wired |
| 834 × 1112 | 0 page overflow; inputs 14px (`md:text-sm`, correct for tablet); safe-area utilities compiled |

Also verified: `?redirect=/projects?view=pending` survives the sign-in URL intact — the fix in §9, end to end.

**What could not be verified here, and why:** everything behind the login. Signing in requires entering a password, which I do not do. So the drawer, the account menu, active-route behaviour, tablet sidebar behaviour and logout were **not observed running**. They are covered by unit tests at the logic level and by reading the code, which is not the same thing.

### Remaining manual/CI verification

At 390 / 414 / 768 / 834 / 1024 / 1280, signed in:

1. **Drawer** — opens; the restored **X** is visible and does not collide with the logo row; closes via X, overlay, Escape; closes after tapping a nav item; footer clears the home indicator on a notched device.
2. **Account menu** — tap the header avatar: name/email, My Portal, Settings, Sign out. Sign out returns to sign-in and a protected URL no longer opens.
3. **Nested nav** — expand a CRM group, open a child, confirm the parent stays expanded and both are marked active; check the header title matches the sidebar label.
4. **Deep link** — sign out, open `/projects?view=pending`, sign in, confirm the query survives.
5. **Tablet** — at 768 and 834 confirm the icon rail is usable and nothing overlaps.
6. **Installed PWA** — sign in inside the installed app; confirm session restore on relaunch and that logout leaves no cached data.

Playwright browsers remain uninstalled locally, so the E2E specs (`auth.spec.ts`, `leave.spec.ts`, `responsive-overflow.spec.ts`) and the four device projects still run only in CI.

## 15. Known limitations

1. **Nothing behind the login was observed** (§14). The largest gap, unchanged in character from Phases 1–3.
2. **iOS standalone + `sameSite: "none"` cookie** — still unverified, still the highest-risk unknown. Flagged since Phase 0.
3. **Tablet input font is 14px from 768px up.** iPad Safari is not believed to zoom on focus, but this was not confirmed on hardware.
4. **The topbar avatar's behaviour changed on desktop too.** It was a direct link to Settings; it is now a menu containing Settings. Deliberate — one behaviour at every width beats two, and the drawer-only account menu made signing out on a phone a four-interaction job. Settings is now one extra tap on desktop. Easy to revert if you dislike it.
5. **Restoring the drawer close button changes shared `ui/sidebar.tsx`.** Only the mobile nav drawer uses that class, and the other 18 `Sheet` consumers are unaffected — but the X's position against the logo row has not been seen on a device.
6. **No 403 page.** Permission failures render the 404. That is the app's existing convention and was deliberately not changed.
7. **Session-expiry UX is a redirect**, not a "your session expired" notice. Existing behaviour, deliberately untouched.

---

## Definition of Done

| Item | Status |
| --- | --- |
| Existing authentication architecture preserved | Yes — no auth file modified |
| Login works responsively | Yes — verified 390 / 834 |
| Logout works | Logic unchanged; **not observed** (§14) |
| Session restoration works | Logic unchanged; unit-tested |
| Protected routes work | Unit-tested |
| Unauthorized routes remain protected | Unit-tested; server-side unchanged |
| RBAC remains authoritative | Yes — server unchanged, parity tested |
| Desktop navigation preserved | Yes (one deliberate change: §15.4) |
| Tablet navigation works | Verified no overflow at 834 |
| Mobile drawer works | Improved; **visual check outstanding** |
| Drawer closes after navigation | Phase 1; unchanged |
| Nested navigation works | Structure tested |
| Active route works | Unchanged; structure tested |
| Page titles synchronized with nav metadata | Yes — one source, override layer only |
| Deep links work | **Fixed** — query preserved, verified in browser |
| PWA auth compatibility | By construction; standalone sign-in unverified |
| No sensitive authenticated data cached | Yes — Phase 3 tests still pass |
| Keyboard behaviour tested | 16px inputs verified; iOS device items documented |
| Accessibility checked | Drawer name, close, labels, targets |
| Type-check / lint / tests | Clean / 0 errors / 2,367 passing |
| Documentation | This file |
| No business modules modified | Yes — none touched |
