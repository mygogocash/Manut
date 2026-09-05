# Mobile + PWA Audit — Phase 0

Analysis and planning only. **No production behaviour was changed to produce this document.**

Audited: 2026-08-19 · Branch `fix/proposal-chain-payload-and-fixed-stages` (based on `dev`) · Commit `88eafe4d`

Every count in this document was measured against the repository at that commit, not estimated. Anything that could not be confirmed from the repository is marked **UNKNOWN / REQUIRES VERIFICATION**.

---

## ⚠ Blocking gap: the mobile JSX prototype was not supplied

Sections **25 (Mobile prototype analysis)** and **26 (Prototype → production screen mapping)** cannot be completed.

The brief names a "supplied mobile JSX prototype" as the source of truth for mobile UX. It is **not in this repository and was not attached to the request**. Verified by:

| Search | Result |
| --- | --- |
| Directories named `*prototype*` / `*mockup*` / `*mobile*` | none |
| `**/*.jsx` anywhere outside `node_modules` | **zero files** |
| Files named `*prototype*` / `*mobile*` | only `apps/web/src/hooks/use-mobile.ts` |
| `docs/` tree | no prototype directory or file |

Rather than invent a mobile design and present it as the prototype's intent, sections 25–26 record what is needed. **Everything not dependent on the prototype is complete below** — the prototype governs *visual and interaction* decisions, not the architectural, API, PWA, security or sequencing work, so roughly 90% of Phase 0 is unaffected.

**To unblock:** add the prototype under `docs/pwa/prototype/` (or paste the JSX) and sections 25–26 can be filled in without redoing the rest.

---

## 1. Current repository architecture

Turborepo + pnpm 10.33.0 monorepo, single Git repository, workspaces `apps/*` and `packages/*`.

```
apps/api      Express 5 + TypeScript          (port 3001)
apps/web      Next.js 16.3.1 + React 19       (port 3000)
packages/database   Prisma 6 schema, migrations, seed
packages/types      shared TS types
packages/ui         shared components
packages/utils      shared helpers
packages/eslint-config
docker/       Dockerfile.api, Dockerfile.web, docker-compose.yml
e2e/          Playwright specs
docs/         specifications and handoffs
```

Turbo tasks: `build`, `dev`, `lint`, `lint:fix`, `type-check`, `test`, `clean`, `db:generate`. 68 entries in `globalEnv`.

**This structure already satisfies the brief.** No new app, package or repository is required for mobile or PWA work.

## 2. Current frontend architecture

| Aspect | Finding |
| --- | --- |
| Framework | Next.js 16.3.1, App Router, `output: "standalone"` |
| React | 19 |
| Styling | Tailwind **v4** — no `tailwind.config.*`; theme lives in `@theme inline` inside `src/app/globals.css` |
| Component system | shadcn-style primitives in `src/components/ui` (**57 files**) + `@base-ui/react` + Radix + `vaul` |
| Route count | **112** `page.tsx` files |
| Component dirs | **69** feature directories under `src/components` |
| `.tsx` files in `src` | **628** |
| Layouts | exactly **2** — `src/app/layout.tsx` (root) and `src/app/(dashboard)/layout.tsx` (app shell) |
| Data fetching | client-side through `src/services/*.service.ts` → `src/lib/api-client.ts`; **no Next route handlers** (`src/app/api` does not exist) |
| State | React state + `AuthProvider`; no Redux/Zustand/React Query |

Two layouts for 112 routes is a significant advantage: the mobile shell can be introduced in one place.

## 3. Current backend architecture

Express 5 + TypeScript, **97 modules** under `apps/api/src/modules`. Layering per `CLAUDE.md`: `*.controller.ts` → `*.service.ts` → `*.repository.ts`, Zod validation in `*.validation.ts`. `helmet` is enabled with **`contentSecurityPolicy: false`**. CORS uses an origin allow-list callback. Socket.IO 4.8.3 is present on both sides.

Structure: `app.ts`, `main.ts`, `env.ts`, `common/`, `core/`, `infrastructure/`, `lib/`, `modules/`, `test/`.

## 4. Current authentication architecture

| Aspect | Finding |
| --- | --- |
| Provider | Supabase Auth issues the JWT; Express middleware resolves the Prisma user, roles and permissions per request |
| Transport | **httpOnly cookies** — `credentials: "include"` on every call |
| Cookie flags | `httpOnly: true`, `secure: IS_PROD`, `sameSite: IS_PROD ? "none" : "lax"` |
| CSRF | `X-Requested-With: XMLHttpRequest` set on all non-GET/HEAD requests |
| Refresh | silent refresh on a 401, then one retry (`apiFetch`, `_isRetry` guard) |
| Same-origin | browser talks to `/api/*` on the web origin; `next.config.ts` rewrites to `API_URL` (default `http://localhost:3001`) |
| Exempt paths | `authRedirectExemptPaths` prevents mid-auth flows from bouncing to `/sign-in` |

**Two consequences for this project.** (a) A service worker will see `/api/*` as same-origin `fetch` events — convenient, and dangerous if cached carelessly (§33, §36). (b) Cookies are httpOnly, so a service worker or push handler **cannot read the session**; `credentials: "include"` from the SW is the only route.

**UNKNOWN / REQUIRES VERIFICATION:** behaviour of `sameSite: "none"` cookies inside an installed iOS standalone PWA. iOS Safari storage partitioning and ITP have historically treated standalone containers differently. Must be tested on a real device before relying on it.

## 5. Current RBAC / permission architecture

- Permission codes are `module:action` (e.g. `crm:read`), defined in `apps/api/src/common/constants/permissions.ts`.
- `auth.service.resolvePermissions` grants **every** code when the actor holds a role with `isSystem && name === "Admin"`.
- Route guard: `requirePermission("scope:action")`; identity-based authority (approval chains) deliberately maps to a `null` permission code and is enforced in services.
- Web: `useAuth()` exposes `user`, `roles`, `permissions`, `hasPermission`, `hasRole`, `refreshUser`. Sidebar and route guards read `state.permissions` only.
- `ProtectedRoute` + `getRequiredPermissions(pathname)` in the dashboard layout enforce per-route permissions, with `ROUTE_PATTERN_OVERRIDES` for routes needing a wider union.

**Rule 9 ("do not hardcode permissions") is already satisfied and must stay that way.** Any mobile navigation must derive from `NAV_GROUPS` + `state.permissions`, never from a hand-written mobile menu.

## 6. Current API architecture

REST under `/api/*`. Controllers register routes on a `Router()` with literal paths before `:param` paths. Errors use typed exceptions (`BadRequestException`, `NotFoundException`, `ForbiddenException`, `ConflictException`). Responses are enveloped — success as `{ data: … }` (consumed as `ApiSuccessResponse<T>`), errors as `{ error: { code, message, details? } }`.

Cron endpoints live at `/api/cron/*` behind an `X-Cron-Secret` header.

## 7. Existing shared packages

| Package | Purpose | Reusable for this work |
| --- | --- | --- |
| `@nexora/database` | Prisma schema, migrations, seed | Only if push subscriptions need storage (§32) |
| `@nexora/types` | shared TS types | Yes — add push/PWA types here if shared |
| `@nexora/ui` | shared components | Yes |
| `@nexora/utils` | shared helpers | Yes |
| `@nexora/eslint-config` | lint presets (`base`, `next-js`, `react-internal`, `node`) | Unchanged |

`apps/web` transpiles `@nexora/ui`, `@nexora/types`, `@nexora/utils`.

## 8. Existing reusable UI components

57 primitives in `src/components/ui`. The ones that matter here:

| Primitive | Current usage | Relevance |
| --- | --- | --- |
| `dialog.tsx` | **198 files** | Largest mobile transformation surface |
| `form.tsx` | **104 files** | RHF + zodResolver wrapper |
| `table.tsx` | 39 files direct | Raw table primitives |
| `sheet.tsx` | 18 files | Already the sidebar's mobile container |
| **`drawer.tsx`** | **0 files** | `vaul` is installed and wrapped but **unused** — a ready-made mobile primitive |
| `sidebar.tsx` | app shell | 845 lines, already mobile-aware |
| `tabs.tsx`, `accordion.tsx`, `collapsible.tsx`, `scroll-area.tsx`, `popover.tsx`, `command.tsx` | various | Building blocks for mobile patterns |

`src/components/shared/data-table.tsx` (**539 lines**) is the single generic table, referenced by **~75 files**. Its `Column<T>` contract is `{ key, header, render?, className?, sortable? }`; `DataTableProps<T>` already supports selection, sorting, pagination, sticky header, skeleton loading, empty message, footer and per-row classNames.

**This is the highest-leverage extension point in the codebase.** One optional mobile-card capability on `DataTable` reaches ~75 tables without touching them individually.

## 9. Existing responsive implementation

Partial and inconsistent.

| Measure | Value |
| --- | --- |
| `.tsx` files in `src` | 628 |
| Files containing any `sm:`/`md:`/`lg:`/`xl:` prefix | **320 (51%)** |
| `sm:` occurrences | 497 |
| `md:` | 182 |
| `lg:` | 109 |
| `xl:` | 27 |
| `2xl:` | 5 |
| `max-sm:` / `max-md:` (desktop-first variants) | **0** |
| `overflow-auto` / `overflow-x-auto` (horizontal-scroll escape hatch) | 58 files |
| `dvh` / `svh` (mobile-safe viewport units) | 2 / 3 occurrences total |
| `env(safe-area-inset-*)` | **none** |
| `touch-action`, `overscroll-behavior`, `-webkit-tap-highlight-color` | **none** |
| `useIsMobile` consumers | **1** (`components/ui/sidebar.tsx`) |

`useIsMobile` (`src/hooks/use-mobile.ts`) is a `matchMedia` hook at a 768px breakpoint returning `false` until mount — acceptable, but it causes a desktop-first first paint, which matters if it ever gates layout rather than behaviour.

The dashboard shell applies fixed `px-6 py-5` padding with no responsive variant, and `SidebarProvider defaultOpen={true}`.

**Assessment:** the app is *fluid* in places, not *responsive by design*. Roughly half the component tree has never had a breakpoint applied. Wide tables currently degrade to horizontal scrolling.

## 10. Existing route inventory

**112** `page.tsx` files. **53** top-level segments under `(dashboard)`:

`accounting`, `accounting-crm`, `admin`, `applications`, `aria`, `benefits`, `blog-management`, `careers`, `cash-advance`, `certificates`, `dashboard`, `dataroom`, `deals`, `directory`, `docs`, `drive`, `employees`, `expenses`, `gmail`, `hr-crm`, `hrms`, `investor-crm`, `investor-updates`, `investors`, `it-crm`, `it-helpdesk`, `it-operations`, `learning`, `leave`, `legal`, `legal-crm`, `marketing-analytics`, `messages`, `my-portal`, `office`, `partners`, `payroll`, `performance`, `policies`, `pr-management`, `product-crm`, `projects`, `qa-crm`, `revenue`, `roles`, `sales`, `sales-revenue`, `settings`, `survey`, `survey-forms`, `travel`, `visa`, `voucher-crm`

Unauthenticated routes: `sign-in`, `forgot-password`, `reset-password`, `change-password`, `magic-link`, `sign`, `auth`.

**Rule 15 is satisfiable — no route needs to change.** The mobile experience is delivered inside the existing tree.

## 11. Existing module inventory

97 API modules (see §6 source). Functional grouping:

| Domain | Modules |
| --- | --- |
| CRM / sales | `sales-*`, `deals`, `leads`, `opportunities`, `contacts`, `accounts`, `crm-*`, `revenue-*`, `qa-crm`, `voucher-crm`, `product-crm`, `it-crm`, `legal-crm`, `accounting-crm` |
| Projects | `projects`, `proposals`, `approval-chains` |
| People / HR | `employees`, `directory`, `hrms`, `leave`, `travel`, `expenses`, `cash-advance`, `payroll`, `visa*`, `benefits`, `learning`, `performance`, `holidays`, `certificates`, `career`, `applications` |
| Finance | `accounting`, `exchange-rates`, `vendors`, `it-billing` |
| Fundraising | `investors`, `investor-*`, `partners` |
| Content | `articles`, `blogs`, `news`, `wall`, `policies`, `docs`, `legal-announcements` |
| Ops / platform | `admin`, `auth`, `roles`, `users`, `dashboard`, `messages`, `aria`, `integrations`, `uploads`, `helpdesk`, `office`, `survey*`, `telemetry`, `cron`, `marketing*` |

## 12. Existing API / module mapping

Web services in `src/services/*.service.ts` map 1:1 to API modules and are the only sanctioned call path (`CLAUDE.md`: "Never `fetch` directly in components"). Mobile work **reuses these unchanged** — this is what keeps rules 6–8 and 13 satisfied.

## 13. Existing dashboard implementation

`src/app/(dashboard)/dashboard/page.tsx` — **1,055 lines**, a single client page. Backed by `GET /api/dashboard/stats`, gated `HOME_READ`, computed server-side in one payload.

Per `CLAUDE.md`, the dashboard payload also feeds the notification bell read-model. This is a **strength for mobile**: KPI cards and attention sections can be composed from one existing request with no new endpoint.

**Risk:** at 1,055 lines in one file, a mobile layout added inline will make it materially harder to maintain. Decomposition into presentational blocks is recommended (§41).

## 14. Existing navigation implementation

- `src/components/layout/sidebar.tsx` — **1,080 lines**, exports `NAV_GROUPS`; the dashboard layout derives `ROUTE_PERMISSIONS` from it, so it is both navigation *and* the route-permission source.
- `src/components/ui/sidebar.tsx` — **845 lines**; on `isMobile` it renders the nav inside a `Sheet` (`SIDEBAR_WIDTH_MOBILE = 18rem`), with `openMobile` state and a `toggleSidebar` that branches on `isMobile`.
- `src/components/layout/topbar.tsx` — 142 lines.

**A mobile drawer therefore already exists in skeleton form.** What is missing is mobile *information hierarchy*: 53 segments in one flat sheet is not navigable on a phone. No bottom navigation, no mobile search entry point.

**Do not fork `NAV_GROUPS` for mobile** — it would silently desynchronise route permissions from navigation.

## 15. Existing notification implementation

`src/components/layout/notification-bell.tsx`. Groups: `approval`, `survey`, `urgent`, `it-crm`, `it-crm-update`, `news`. Mostly a **server read-model** recomputed from the dashboard stats payload; `ItCrmNotification` is the one persisted event store. Read/unread state is a **localStorage seen-id set** (`nexora:notifications:seen-ids-v2`, capped), deliberately not a timestamp threshold.

**Implication for push (§32):** the unread model is per-device localStorage. A push notification delivered to a phone will not mark anything read on the desktop, and vice versa. Either accept per-device semantics or introduce server-side read state — a product decision, not a technical one.

## 16. Existing messaging implementation

`src/components/messages/` + API `messages` module, over Socket.IO 4.8.3 (client and server). `global-message-notifier.tsx` is mounted in the dashboard layout and calls `Notification.requestPermission()` (line 53).

**This is the only Notification API usage in the codebase.** It is foreground-only, tab-scoped, and **not** Web Push — no service worker, no `PushSubscription`, no VAPID. It stops working the moment the tab closes.

**UNKNOWN / REQUIRES VERIFICATION:** whether Socket.IO holds up on mobile networks under backgrounding/reconnect. Not measured.

## 17. Existing ARIA implementation

`/aria` route, `src/components/aria/`, API `aria` module, Gemini-backed. Guarded by three eval suites (`aria-tools.eval.test.ts`, retrieval, auto-sync) that run in `pnpm test`. Two cron endpoints (`aria-knowledge-sync`, `aria-purge-pii`).

Conversational UI is usually the *easiest* surface to make mobile-first, and often the most valuable on a phone. Worth prioritising.

## 18. Existing document / file implementation

- `uploads` API module; Supabase Storage buckets — `documents` is **private**, `article`/`avatars`/`blog`/`uploads` are public.
- Private downloads go through `GET /<resource>/:id/download`, which re-checks ownership and returns a 5-minute signed URL. Raw `fileUrl` is never linked.
- **50 files** contain `<input type="file">`, with varied `accept` lists (xlsx/csv imports, pdf/image evidence, etc.).
- **No `capture` attribute anywhere** — no camera-capture affordance on mobile.

**Mobile opportunity:** receipt/evidence capture (expenses, visa, certificates) is a natural phone workflow and needs only `capture="environment"` plus client-side downscaling. **Security note:** signed URLs must never be cached by a service worker (§36).

## 19. Existing testing infrastructure

| Layer | State |
| --- | --- |
| API unit | Vitest, **180** test files |
| Web unit | Vitest, **37** test files |
| E2E | Playwright, **2** specs (`auth.spec.ts`, `leave.spec.ts`) |
| E2E devices | **`Desktop Chrome` only** — no mobile viewport, no WebKit, no Firefox project |
| `browserslist` | **absent** |
| CI gates | `pr-checks.yml` — type-check, lint, test, brand-drift |
| Full-suite baseline | 2,263 passing (1,911 API + 352 web) at this commit |

**The E2E layer cannot currently catch a mobile regression at all.** That is the biggest gap in the testing story.

## 20. Existing PWA capability

**None.** Verified by source search for `manifest`, `serviceWorker`, `next-pwa`, `workbox`, `serwist`, `beforeinstallprompt`, `apple-mobile-web-app-*`, `theme-color`, `PushSubscription`, `pushManager`.

| Requirement | Status |
| --- | --- |
| Web app manifest | absent |
| Service worker | absent |
| Install prompt handling | absent |
| `theme-color` | absent |
| `apple-touch-icon` / iOS meta | absent |
| Maskable icons | absent |
| Offline fallback | absent |
| Web Push | absent (client **and** server) |
| **`viewport` export / meta** | **absent from `src/app/layout.tsx`** |

The missing viewport declaration is the single highest-impact, lowest-risk fix in this audit: without it mobile browsers apply a ~980px virtual viewport, so every media query is evaluated against the wrong width. **Much of the "app looks broken on mobile" symptom may be this one line.**

`public/` contains only `favicon.ico` and `tbh-circle-logo.ico` — **no PWA icon assets of any size**.

## 21. Existing service worker configuration

None. No `sw.js`, no `public/sw.*`, no registration code, no `next.config.ts` PWA plugin, no `Service-Worker-Allowed` header. `next.config.ts` defines **no `headers()` function at all**, so SW cache-control headers must be added when a worker lands.

## 22. Existing manifest configuration

None. `metadata` in the root layout sets only `title`, `description` and a single `.ico` icon. No `manifest` key, no `appleWebApp`, no `viewport` export.

## 23. Existing caching strategy

No client-side caching layer: no service worker, no React Query/SWR, no IndexedDB. Every screen refetches through `apiFetch` on mount. `next.config.ts` sets no `Cache-Control` headers; Next.js defaults apply to static assets.

The only client persistence found:

| Key | Purpose |
| --- | --- |
| `nexora:notifications:seen-ids-v2` | notification read state |
| `nexora:survey-standalone:draft-v1:*` | survey draft autosave |

The survey draft is a **useful precedent** for offline form drafts (§33).

## 24. Existing browser compatibility configuration

- No `browserslist` — Next.js/SWC defaults apply. **UNKNOWN / REQUIRES VERIFICATION:** the effective transpilation target.
- Playwright runs Chromium only, so WebKit and Gecko are untested.
- Tailwind v4 requires modern browsers (`@property`, cascade layers, `color-mix()`); it does not support IE11 and has raised minimums vs v3. **UNKNOWN / REQUIRES VERIFICATION:** minimum Safari/Firefox versions actually in use across the organisation.
- No polyfills or feature-detection utilities found.

## 25. Mobile prototype analysis

**BLOCKED — prototype not supplied.** See the notice at the top of this document.

Once supplied, this section must record: header, drawer navigation and hierarchy, dashboard layout, KPI cards, attention sections, CRM cards, expandable records, horizontal tabs, search, filters, action strips, mobile forms, sticky action bars, notifications, visual design, spacing, typography and interaction patterns — mapped against what already exists so that reuse is maximised.

## 26. Prototype → production screen mapping

**BLOCKED — prototype not supplied.** This mapping is the artefact that determines which of the 112 routes need bespoke mobile treatment versus which are served by generic responsive components, so it should be completed before Phase 1 planning is finalised.

Preliminary observation independent of the prototype: given one `DataTable` (~75 consumers), one `Dialog` primitive (198 consumers) and one `Form` wrapper (104 consumers), the great majority of screens should be reachable through **generic** responsive components. Bespoke work is likely limited to the dashboard, the 53 nav segments' hierarchy, messaging, ARIA and the kanban boards.

## 27. Desktop → tablet → mobile transformation requirements

| Breakpoint | Target | Shell | Navigation | Tables | Dialogs |
| --- | --- | --- | --- | --- | --- |
| `< 640px` | phones | single column, safe-area padding | drawer + (proposed) bottom bar | **card list** | bottom sheet, full-height |
| `640–1023px` | large phone / small tablet | 1–2 columns | drawer | reduced-column table or cards | sheet |
| `1024–1279px` | tablet / small laptop | 2 columns, collapsible sidebar | icon-rail sidebar | table, fewer columns | dialog |
| `≥ 1280px` | desktop | unchanged | expanded sidebar | full table | dialog |

Constraints: desktop rendering must be **byte-identical** where possible (rule 11); every breakpoint shares one data path (rule 19); mobile is a distinct composition, not a scaled desktop (rule 18).

Tailwind's default breakpoints (`sm` 640, `md` 768, `lg` 1024, `xl` 1280) already align. `useIsMobile` uses 768 — reconcile with whichever breakpoint the shell adopts so JS and CSS do not disagree.

## 28. Tables that need mobile transformation

**~75 files** reference `DataTable`; **39** import the raw `table` primitives; **58** rely on `overflow-x-auto`.

Recommended approach — extend, do not fork:

1. Add optional fields to `Column<T>`: a mobile priority/role (`primary` | `secondary` | `meta` | `hidden`) and an optional `mobileRender`.
2. Add an optional `mobileCard` render prop to `DataTableProps<T>` for full control where a card needs bespoke composition.
3. Below the breakpoint `DataTable` renders a card list; above it, today's `<table>` **unchanged**.
4. Default behaviour when a caller specifies nothing: first column becomes the card title, next two become supporting lines, the rest collapse behind an expander. **No caller breaks, no desktop pixel moves.**

This converts ~75 tables with one component change plus incremental per-table refinement. The 39 raw-table files need individual attention and should be triaged by traffic.

## 29. Forms that need mobile transformation

**102 files** call `useForm`; **104** import the `form` wrapper; **198** import `dialog`.

Requirements:

- Dialog → bottom sheet below the breakpoint (`drawer.tsx`/`vaul` is present and unused — use it), preserving the existing `Dialog` API so callers do not change.
- **Inputs must be ≥16px** or iOS Safari zooms the viewport on focus.
- Sticky action bar with safe-area inset so Save is never under the home indicator or keyboard.
- Correct `type`/`inputMode`/`autocomplete` per field so mobile keyboards match (`email`, `tel`, `numeric`, `decimal`).
- Keep the documented `useEffect(() => form.reset(…), [open, payload, form])` pattern and the `*ListItem` ≠ `*Detail` rule — a mobile refactor must not reintroduce that data-loss bug.
- Native date inputs or a touch-sized `react-day-picker` (`calendar.tsx` exists).

## 30. Navigation changes required

1. **Mobile information hierarchy** — 53 segments cannot be one flat list. Group by domain, collapse by default, remember the last open group.
2. **Search-first entry** — `command.tsx` (cmdk) is already a dependency; a command palette is the cheapest way to make 112 routes reachable on a phone.
3. **Bottom navigation** (proposed, 4–5 destinations) driven by permissions, for thumb reach.
4. **Header** — condense the topbar; move overflow into a menu.
5. **Close-on-navigate** — the mobile `Sheet` must close on route change (verify current behaviour).
6. `NAV_GROUPS` stays the **single** source so route permissions cannot drift (§14).

## 31. PWA requirements

| Requirement | Notes |
| --- | --- |
| `viewport` export | `width=device-width, initial-scale=1`, `viewportFit: "cover"` for safe-area support |
| Web app manifest | `name`, `short_name`, `start_url`, `scope`, `display: "standalone"`, `theme_color`, `background_color`, `orientation`, `icons` |
| Icons | 192, 256, 384, 512 px + a **maskable** variant + `apple-touch-icon` |
| iOS meta | `appleWebApp` (`capable`, `statusBarStyle`, `title`) — iOS ignores parts of the manifest |
| Service worker | app-shell + static asset caching, offline fallback page, versioned cache with cleanup |
| Install prompt | capture `beforeinstallprompt`, offer a considered moment, never a nag; iOS has no such event, so provide Share→Add-to-Home-Screen instructions |
| Update flow | detect a waiting worker and prompt to reload — a stale shell against a moved API is a real failure mode |
| Progressive enhancement | **every capability behind a feature check** (rule 21); no PWA feature may be load-bearing |

`output: "standalone"` (Docker) is unrelated to `display: "standalone"` (manifest) — do not conflate them.

## 32. Web Push requirements

Nothing exists today, client or server. A complete implementation needs:

1. **VAPID keys** — private key server-side via GitHub Secrets → Cloud Run `--set-env-vars`; public key may be `NEXT_PUBLIC_*` (it is designed to be public). **Never in source** (rule 22).
2. **Subscription storage** — a new Prisma model (user, endpoint, keys, user-agent, timestamps) plus an idempotent migration. This is the only database change the whole project needs, and it is additive.
3. **API endpoints** — subscribe / unsubscribe / send, gated by existing permissions; a 410/404 from the push service must prune the dead subscription.
4. **Server library** — `web-push` (not currently a dependency).
5. **Service-worker handlers** — `push` and `notificationclick` (deep-link into the app).
6. **Preference model** — `OrchestratorNotificationPreference` is the existing precedent for per-user, self-scoped notification prefs; follow it rather than inventing a second pattern.
7. **Read-state decision** — see §15. Push is per-device; the unread set is per-device localStorage.
8. **iOS constraint** — Web Push on iOS requires **iOS 16.4+ and an installed (home-screen) PWA**. It does not work in a normal Safari tab. Plan for this being unavailable to a meaningful share of users.

**Payloads must not carry sensitive content** — notifications render on lock screens. Send an identifier and a neutral title; fetch details after the user opens the app.

## 33. Offline / caching requirements

Given `httpOnly` cookies and 97 authenticated modules, the safe posture is **cache the shell, not the data**:

| Class | Strategy |
| --- | --- |
| App shell, JS/CSS, fonts, icons | precache, cache-first, versioned |
| Navigation requests | network-first with an offline fallback page |
| `/api/*` | **never cached by default** (rule 23) |
| Signed download URLs | **never cached** (5-minute expiry, private bucket) |
| Auth endpoints | never cached |
| Form drafts | client-side, following the existing `nexora:survey-standalone:draft-v1:*` precedent |

If any read-only, non-sensitive `/api` response is later cached, it must be opt-in per endpoint, short-TTL, and **cleared on logout** — a shared device must not surface the previous user's data.

Offline **mutation queues** are explicitly *not* recommended for the first phase: with server-side validation, approval chains and conditional-update concurrency control (`updateMany where { id, status: from }` → 409), replaying a queued mutation later can act on state that has already moved. Marking a request "queued" and having it silently fail or apply to a changed record is worse than an honest network error.

## 34. Accessibility requirements

- Touch targets ≥ 44×44 px (WCAG 2.5.5 / Apple HIG).
- Visible focus states on all interactive elements (Tailwind v4 removes some default rings).
- Respect `prefers-reduced-motion` for drawers and sheets.
- Sheets/drawers need focus trap, restore-on-close, `Escape` to dismiss, correct `aria-modal` — Radix/vaul handle most, but each usage must be verified.
- Contrast ≥ 4.5:1 in both themes (`next-themes` is in use, so both must be checked).
- Screen-reader labels on icon-only controls — likely to increase on mobile where labels are dropped for space.
- Live regions for toasts (`sonner`) so async results are announced.
- **UNKNOWN / REQUIRES VERIFICATION:** no accessibility test tooling (axe, jest-axe, Lighthouse CI) is configured; current conformance is unmeasured.

## 35. Performance requirements

Budgets to set (no baseline exists — **UNKNOWN / REQUIRES VERIFICATION**, nothing is measured today):

| Metric | Target on mid-range mobile, 4G |
| --- | --- |
| LCP | < 2.5 s |
| INP | < 200 ms |
| CLS | < 0.1 |
| Initial JS per route | < 200 KB gzipped |

Specific concerns found:

- `dashboard/page.tsx` is **1,055 lines** and client-side; `sidebar.tsx` 1,080; `ui/sidebar.tsx` 845 — all in the shell, so they load on every route.
- Heavy dependencies that must not reach a mobile first load: `recharts`, `xlsx`, `d3-geo`, `topojson-client`, `world-atlas`, `embla-carousel-react`, `react-quill-new`. Dynamic import for these.
- Everything is client-fetched on mount, so mobile latency compounds; skeletons already exist in `DataTable`, which helps perceived performance.
- Three Google fonts (`DM_Sans` preloaded, `DM_Serif_Display` and `DM_Mono` not) — already tuned, leave alone.

## 36. Security requirements

1. **No secrets in frontend source** (rule 22) — only the VAPID *public* key may be `NEXT_PUBLIC_*`.
2. **No indiscriminate caching of authenticated data** (rule 23) — §33.
3. **Clear all caches and unregister/refresh the SW on logout**, or the next user on a shared device may see cached UI state.
4. **Signed URLs never cached** (5-minute expiry, private `documents` bucket).
5. **Push payloads carry no sensitive content** — lock-screen visible.
6. **CSP is currently disabled** (`helmet({ contentSecurityPolicy: false })`). Adding a service worker widens the attack surface; enabling a CSP is recommended, but it is a **separate, carefully-tested change** — a CSP added carelessly will break PostHog, Supabase, Google Fonts and the `/ingest` proxy.
7. **Service worker scope** must be constrained; it must never proxy or log `/api` responses.
8. Preserve the `X-Requested-With` CSRF header on every mutation that a service worker replays or wraps.
9. Permission checks stay server-side; mobile UI hiding is cosmetic, never a boundary (mirrors the existing `role.isSystem` convention).

## 37. Browser compatibility risks

| Risk | Detail | Severity |
| --- | --- | --- |
| iOS Web Push | Requires iOS 16.4+ **and** an installed PWA; unavailable in a Safari tab | High |
| iOS `sameSite: "none"` in standalone | Storage partitioning may affect the session cookie — untested | High |
| iOS input zoom | Inputs under 16px zoom the viewport on focus | Medium |
| iOS 100vh | Classic viewport bug; only 5 `dvh`/`svh` usages exist today | Medium |
| Safari service-worker eviction | Workers/caches evicted after ~7 days unused | Medium |
| Firefox `beforeinstallprompt` | Not supported — install UX must degrade | Low |
| Tailwind v4 baseline | Requires modern engines; org's minimum versions unknown | Medium |
| No `browserslist` | Effective transpile target unverified | Medium |
| WebKit/Gecko untested | Playwright is Chromium-only | Medium |

## 38. Technical risks

| # | Risk | Mitigation |
| --- | --- | --- |
| 1 | **Prototype absent**, so mobile UX is undefined | Obtain it before Phase 1 design is fixed |
| 2 | Touching `DataTable` (~75 consumers) or `Dialog` (198) regresses desktop | Additive optional props only; defaults preserve current rendering; snapshot the desktop table first |
| 3 | Adding the `viewport` meta **changes how every existing page renders on mobile** — pages that "looked fine" at 980px virtual width will reflow | Land it early, deliberately, with a device sweep; do not bundle with other changes |
| 4 | Forking `NAV_GROUPS` for mobile silently desyncs route permissions | Single source; add a test asserting mobile nav derives from `NAV_GROUPS` |
| 5 | Stale service worker serving an old shell against a moved API | Versioned caches, skip-waiting prompt, no `/api` caching |
| 6 | Shared-device data leakage via SW caches | Clear caches on logout; never cache `/api` by default |
| 7 | 51% of components have never seen a breakpoint | Triage by traffic; do not attempt all 628 files at once |
| 8 | E2E cannot detect mobile regressions | Add mobile Playwright projects **before** the refactor, not after |
| 9 | Web dev instability + Turbopack cache corruption observed during this session | Note only; unrelated to this work |
| 10 | Concurrent `db:push` from staging drops columns on the shared DB | Affects any new push-subscription table until merged to `dev` |

## 39. API gaps

The audit found **no gaps that block responsive/mobile work** — every screen's data already exists and is reachable through the current services (rules 6–8, 13 hold).

Genuinely new API surface, all additive and backward compatible:

| Gap | Need | Backward compatible? |
| --- | --- | --- |
| Push subscription storage | New Prisma model + additive migration | Yes — new table only |
| `POST /api/push/subscribe`, `DELETE /api/push/unsubscribe` | Register/remove a device | Yes — new routes |
| Push send integration | Server-side dispatch at existing notification points | Yes — additive, best-effort like existing email fan-out |
| Push preferences | Follow `OrchestratorNotificationPreference` | Yes |
| VAPID public key delivery | `NEXT_PUBLIC_*` at build time | Yes |

**Possible, not yet confirmed as needed:** lighter list payloads for mobile. **UNKNOWN / REQUIRES VERIFICATION** — no payload sizes were measured. If pursued, use an opt-in query parameter, never a changed default shape.

## 40. Recommended reusable components

Build few, generic, and shared — not mobile twins (rules 16–17).

| Component | Purpose |
| --- | --- |
| `ResponsiveDataTable` (extend existing `DataTable`) | Table above breakpoint, card list below — **one change reaches ~75 tables** |
| `ResponsiveDialog` | `Dialog` on desktop, `Drawer`/sheet on mobile, same API — **reaches 198 files** |
| `MobileNav` / `MobileNavDrawer` | Grouped, permission-derived hierarchy from `NAV_GROUPS` |
| `BottomNav` | 4–5 permission-aware primary destinations |
| `CommandPalette` | Search-first routing over 112 routes (cmdk already present) |
| `StickyActionBar` | Safe-area-aware form actions |
| `RecordCard` / `ExpandableRecordCard` | Standard mobile row representation |
| `KpiCard` | Shared dashboard metric tile (desktop + mobile) |
| `MobileTabs` | Horizontally scrollable tabs |
| `FilterSheet` | Filters in a sheet on mobile, inline on desktop |
| `InstallPrompt` | Feature-detected, dismissible, iOS instructions |
| `OfflineBanner` | Connectivity indicator |
| `PushOptIn` | Permission + subscription lifecycle |
| `useMediaQuery` / `useBreakpoint` | Generalise `useIsMobile`, one breakpoint source of truth |
| `useOnlineStatus`, `useInstallPrompt`, `usePushSubscription` | Feature-detected capability hooks |

## 41. Recommended files to modify

| File | Change | Risk |
| --- | --- | --- |
| `apps/web/src/app/layout.tsx` | Add `viewport` export, `manifest`, `appleWebApp`, `theme-color`; register SW | **Low code risk, high rendering impact** (§38 #3) |
| `apps/web/src/app/(dashboard)/layout.tsx` | Responsive padding; mount mobile nav / bottom bar | Medium — shell for all 112 routes |
| `apps/web/src/components/shared/data-table.tsx` | Optional mobile card rendering | Medium — ~75 consumers |
| `apps/web/src/components/ui/dialog.tsx` *or* a new `responsive-dialog.tsx` | Sheet on mobile | Medium — 198 consumers; a **new** wrapper is safer |
| `apps/web/src/components/ui/drawer.tsx` | Bring the unused vaul wrapper into service | Low |
| `apps/web/src/components/layout/sidebar.tsx` | Mobile grouping/hierarchy — **keep `NAV_GROUPS` single-source** | Medium |
| `apps/web/src/components/layout/topbar.tsx` | Condense for mobile | Low |
| `apps/web/src/app/(dashboard)/dashboard/page.tsx` | Decompose into blocks; mobile composition | Medium — 1,055 lines |
| `apps/web/src/hooks/use-mobile.ts` | Generalise to `useMediaQuery`/`useBreakpoint`, keep `useIsMobile` as a wrapper | Low |
| `apps/web/src/app/globals.css` | Safe-area vars, `touch-action`, tap-highlight, dynamic viewport units | Low |
| `apps/web/next.config.ts` | `headers()` for SW cache-control / `Service-Worker-Allowed` | Low |
| `apps/web/src/components/messages/global-message-notifier.tsx` | Coexist with Web Push; avoid duplicate notifications | Medium |
| `apps/web/src/lib/api-client.ts` | Offline-aware error messaging (already has a `NETWORK_ERROR` path) | Low |
| `playwright.config.ts` | Add mobile + WebKit projects | Low |
| `docker/Dockerfile.web` | `ARG`/`ENV` for the VAPID public key | Low — but see the three-file flag checklist in `CLAUDE.md` |
| `.github/workflows/deploy.yml`, `deploy-staging.yml` | `--build-arg` (web) and `--set-env-vars` (API) | Low |
| `turbo.json` | New env vars in `globalEnv` | Low |
| `apps/web/package.json` | `browserslist` | Low |

## 42. Recommended new files

**Web — PWA infrastructure**
- `apps/web/public/manifest.webmanifest`
- `apps/web/public/icons/` — 192/256/384/512 + maskable + `apple-touch-icon`
- `apps/web/public/sw.js` (or generated)
- `apps/web/src/app/offline/page.tsx`
- `apps/web/src/lib/pwa/register-sw.ts`, `install-prompt.ts`, `push.ts`
- `apps/web/src/hooks/use-media-query.ts`, `use-online-status.ts`, `use-install-prompt.ts`, `use-push-subscription.ts`

**Web — responsive components**
- `apps/web/src/components/shared/responsive-dialog.tsx`
- `apps/web/src/components/shared/record-card.tsx`
- `apps/web/src/components/shared/sticky-action-bar.tsx`
- `apps/web/src/components/shared/kpi-card.tsx`
- `apps/web/src/components/shared/mobile-tabs.tsx`
- `apps/web/src/components/shared/filter-sheet.tsx`
- `apps/web/src/components/layout/mobile-nav.tsx`, `bottom-nav.tsx`, `command-palette.tsx`
- `apps/web/src/components/pwa/install-prompt.tsx`, `offline-banner.tsx`, `push-opt-in.tsx`

**API — Web Push**
- `apps/api/src/modules/push/push.controller.ts`, `.service.ts`, `.repository.ts`, `.validation.ts`
- `apps/api/src/modules/push/__tests__/push.service.test.ts`
- `packages/database/prisma/schema/push.prisma`
- `packages/database/prisma/migrations/<ts>_push_subscriptions/migration.sql`

**Tests**
- `e2e/mobile-navigation.spec.ts`, `e2e/pwa-install.spec.ts`, `e2e/responsive-table.spec.ts`
- `apps/web/src/components/shared/__tests__/responsive-dialog.test.tsx`, `data-table-mobile.test.tsx`

**Docs**
- `docs/pwa/MOBILE_PWA_AUDIT.md` (this file)
- `docs/pwa/IMPLEMENTATION_PLAN.md`, `docs/pwa/PWA_ARCHITECTURE.md`, `docs/pwa/RESPONSIVE_PATTERNS.md`, `docs/pwa/TESTING_MATRIX.md`

## 43. Recommended implementation sequence

Ordered so each phase is independently shippable and reversible.

| Phase | Scope | Why here |
| --- | --- | --- |
| **0** | This audit | Done |
| **0.5** | **Obtain the prototype**; add mobile/WebKit Playwright projects; set a `browserslist`; capture a performance baseline | Tests before refactor, so regressions are detectable |
| **1** | **Viewport + foundations** — `viewport` export, safe-area CSS, `useMediaQuery`, responsive shell padding | Highest impact per line; must land alone and be device-swept (§38 #3) |
| **2** | **Navigation** — mobile drawer hierarchy, bottom nav, command palette | Unblocks reaching 112 routes on a phone |
| **3** | **Generic responsive components** — `ResponsiveDataTable`, `ResponsiveDialog`, cards, sticky bars | One change, widest reach |
| **4** | **High-traffic screens** — dashboard, then the modules the prototype prioritises | Prototype-dependent |
| **5** | **PWA installability** — manifest, icons, iOS meta, SW with shell caching, offline page, install prompt | Needs a stable shell first |
| **6** | **Web Push** — VAPID, subscription model + endpoints, SW handlers, preferences | Largest new surface; depends on Phase 5's SW |
| **7** | **Long-tail responsive sweep** — remaining raw tables and untouched components, by traffic | Incremental, low risk |
| **8** | **Hardening** — a11y audit, performance budgets, CSP (separately tested), cross-browser matrix | Final gate |

Phases 1–3 deliver most of the mobile benefit; 5–6 deliver the PWA benefit. They are independent enough to reorder if priorities change.

## 44. Testing strategy

| Layer | Approach |
| --- | --- |
| Type | `pnpm type-check` — 10 workspaces, currently clean |
| Lint | `pnpm lint` — 0 errors today; warnings tolerated |
| Unit | Vitest. New responsive components get tests for breakpoint branching, and `DataTable` gets a **desktop-unchanged** regression test |
| E2E | Playwright projects for `Desktop Chrome`, `Pixel 5`, `iPhone 13` (WebKit), plus a Firefox project. Existing `auth.spec.ts` / `leave.spec.ts` must pass on all |
| Visual | Optional snapshots at 375 / 768 / 1280 px on the highest-traffic routes |
| PWA | Lighthouse installability; manual install on Android Chrome and iOS Safari; offline navigation; SW update flow |
| Push | Real-device delivery on Android Chrome and an **installed** iOS 16.4+ PWA; dead-subscription pruning; permission-denied path |
| Manual matrix | Desktop Chrome/Edge/Firefox/Safari; iPad Safari; Android Chrome; iOS Safari — tab **and** installed |
| Regression | Full suite (baseline 2,263) plus brand-drift gate; desktop screenshots before/after the `DataTable` and `Dialog` changes |
| Accessibility | Add axe/Lighthouse a11y checks — none exist today |

The four CI gates (`type-check`, `lint`, `test`, `brand-drift`) must stay green at every phase boundary (rules 26–27).

## 45. Definition of Done

A phase is done when **all** hold:

**Functional** — the same functionality on desktop, tablet and mobile from the same routes and data; no desktop regression; loading / empty / error / permission-denied / success states on every feature (rule 24); validation / success / failure / network-failure handled on every mutation (rule 25).

**Responsive** — no horizontal page scroll at 320px; touch targets ≥ 44px; mobile is a distinct composition, not a scaled desktop; safe-area insets respected.

**PWA** — installable on Android Chrome and iOS Safari; manifest and icons valid; offline fallback works; SW updates without a stuck shell; **every capability feature-detected** so an unsupporting browser still works fully (rules 20–21).

**Quality** — `type-check`, `lint`, `test` and brand-drift all green; new components unit-tested; E2E green on every configured device project; performance budgets met (§35); no new a11y violations.

**Security** — no secrets in frontend source; no authenticated data cached by default; caches cleared on logout; signed URLs never cached; push payloads free of sensitive content; permissions enforced server-side.

**Architecture** — single repo, single frontend, single backend, single database; no React Native/Expo/native project; no second mobile URL; API contracts unchanged or additively extended; no duplicated business logic; no hardcoded permissions or prototype data.

**Documentation** — this audit updated where reality diverged; implementation notes recorded; `CLAUDE.md` updated with any new convention (its own rule).

---

## Verification performed for this audit

- No production source, schema, API behaviour or configuration was modified.
- No files deleted; no database changes; no migrations added.
- Only addition: this document.
- Pre-existing working-tree noise, **not** from this audit: `apps/web/next-env.d.ts` (rewritten by Next.js on dev start) and untracked `apps/web/AGENTS.md` / `apps/web/CLAUDE.md` (auto-generated by Next.js 16 `agentRules`). Consider gitignoring the latter two.
