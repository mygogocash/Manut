# Phase 3 — PWA Foundation

Manifest, icons, service worker, offline fallback and update lifecycle. **No Web Push, no business-module changes.**

References: [MOBILE_PWA_AUDIT.md](MOBILE_PWA_AUDIT.md) · [PHASE_1_RESPONSIVE_FOUNDATION.md](PHASE_1_RESPONSIVE_FOUNDATION.md) · [PHASE_2_DESIGN_SYSTEM.md](PHASE_2_DESIGN_SYSTEM.md) · Completed 2026-08-24

---

## 1. PWA architecture

The existing Next.js app becomes installable. Nothing else changes: one repository, one frontend, one API, one database, one canonical URL for browser and installed app alike.

```
Installed PWA / browser tab   ← same origin, same routes, same code
        │
        │  /api/*  (Next rewrite, same-origin, never touched by the worker)
        ▼
   Express API  ──▶  Postgres / Supabase
```

The service worker sits beside the app, not in front of it: it serves cached static assets and one offline page, and gets out of the way of everything else.

### Step 2 decision — no new dependency

| Option | Verdict |
| --- | --- |
| `next-pwa` | **Rejected.** Webpack-coupled; this app builds with Next 16.3.1 and Turbopack. Effectively unmaintained. |
| `@serwist/next` | **Rejected.** Maintained, but its value is precache-manifest generation plus runtime-caching recipes. We deliberately precache almost nothing, and its default recipes cache API GETs — which is exactly the risk this phase must avoid. Adds a dependency and a build step for benefits we do not use. |
| **Hand-written worker** | **Chosen.** ~190 lines, zero dependencies, no build integration, and total control over what is *not* cached. Next's static output is content-hashed, so it can be runtime-cached with no build manifest at all. |

Facts the decision rests on: **Next 16.3.1**, **App Router**, Turbopack in dev, `output: "standalone"` into Docker, and — confirmed by re-audit — no pre-existing manifest, worker, PWA library or registration code to reuse.

## 2. Manifest configuration

`apps/web/public/manifest.webmanifest`, referenced once from the root layout via Next's `metadata.manifest`.

| Field | Value | Why |
| --- | --- | --- |
| `name` | `Manut` | The product name already in `metadata.title`. `@nexora/*` is a workspace detail and never user-visible (`CLAUDE.md` #210) — a test asserts the string never appears |
| `short_name` | `Intranet` | Fits under a launcher icon without truncation |
| `id` | `/` | Stable app identity across renames |
| `start_url` / `scope` | `/` | The canonical root. **Not** a `/mobile` route — none exists and none was created. `/` already routes correctly per role (`/dashboard`, or `/my-portal` for employee-only), so hardcoding a destination would be wrong for some users |
| `display` | `standalone` | |
| `display_override` | `["standalone","minimal-ui","browser"]` | A platform that cannot do standalone walks the list instead of failing |
| `theme_color` | `#ffffff` | Resolved `--surface` (light) — the topbar's surface, so browser chrome continues it |
| `background_color` | `#f4f2ec` | Resolved `--background`, so the splash matches the app |
| `lang` / `dir` | `en` / `ltr` | |
| `orientation` | **omitted deliberately** | This is a data application with wide tables; landscape is genuinely useful. Locking to portrait would be a downgrade |

## 3. Icon configuration

The audit recorded `public/` as holding only two `.ico` files. On inspection both are the **same** image: a single 252×256 32-bit uncompressed DIB — real brand artwork, in an unusable format and not square.

No new artwork was created. `apps/web/scripts/generate-pwa-icons.mjs` decodes that ICO and derives the set. It uses Node built-ins only (`zlib`); there is no `sharp` and no ImageMagick on these machines, and adding an image toolchain to produce five files that change only when the brand does would be a poor trade. The script is committed so the PNGs have provenance and can be regenerated.

| File | Size | Purpose |
| --- | --- | --- |
| `icons/icon-192.png` | 192² | `any` |
| `icons/icon-512.png` | 512² | `any` |
| `icons/icon-maskable-192.png` | 192² | `maskable`, artwork inside the 80% safe zone |
| `icons/icon-maskable-512.png` | 512² | `maskable` |
| `icons/apple-touch-icon.png` | 180² | iOS home screen |

**All five are opaque, on the brand `--background` (#f4f2ec).** The first generated pass made the plain icons transparent, which was wrong: the mark is near-black, so on Android's dark launcher or the Windows dark taskbar the icon rendered as an invisible smudge. Chrome and iOS composite icons anyway, so transparency bought nothing.

Retained: existing `favicon.ico` and `tbh-circle-logo.ico`, untouched.

**Gap:** the source is a 252×256 raster, so the 512px icons are upscaled from ~256px and are slightly soft. A vector or ≥512px source would fix it. No new logo was invented — documenting rather than replacing.

## 4. Service-worker architecture

`apps/web/public/sw.js`. Registered by `src/components/pwa/service-worker-manager.tsx`, mounted once in the root layout.

Governing rule: **cache the shell, never the data.**

| Lifecycle | Behaviour |
| --- | --- |
| `install` | Precaches only `/offline`, `/manifest.webmanifest`, `icon-192.png`. Individually via `allSettled`, so one 404 during a partial deploy cannot fail the install and leave the app with no worker. **No `skipWaiting()`** |
| `activate` | Deletes caches matching `tbh-*` that are not current, then `clients.claim()`. Cleanup happens only once this worker is actually in charge |
| `message` | `SKIP_WAITING` (from the user accepting the prompt) and `GET_VERSION` (diagnostics) |
| `fetch` | Four ordered rules, below |

## 5. Cache strategy

| # | Traffic | Strategy | Cache |
| --- | --- | --- | --- |
| 1 | Non-GET, or cross-origin | **Not intercepted** | — |
| 2 | `/api/*`, `/ingest/*`, `/auth/*` | **Not intercepted, never stored** | — |
| 3 | `/_next/static/*`, `/icons/*`, manifest, favicons | Cache-first | `tbh-static-v1` |
| 4 | Navigations | Network-first → offline page on failure. **The document is never cached** | `tbh-shell-v1` (fallback only) |
| 5 | Everything else same-origin GET | Straight to network, uncached | — |

Rule 3 is safe because Next's static URLs are content-hashed: a changed file has a changed URL, so a cache hit can never be stale. Only `response.ok && response.type === "basic"` responses are stored — an opaque or partial response in a cache is a silent breakage later.

**Category C (authenticated API data) and Category D (mutations) from the brief are both "never".** No API response is cached at any TTL, and no mutation is queued or replayed.

### Cache versioning

`SW_VERSION = "v1"` yields `tbh-static-v1` / `tbh-shell-v1`. Bump on release; the new worker deletes non-current `tbh-*` caches on activate, and only its own prefix — another tool's cache on this origin is not ours to delete. Because static URLs are content-hashed, the version is a garbage-collector and a kill switch rather than a correctness mechanism.

## 6. Offline strategy

`/offline` — a server component with **no client JavaScript and no data fetching**. It renders exactly when the network is unavailable, so anything needing a script or a request would show an empty screen. That is also why "Try again" is a plain `<a href="/">` and not a button with an `onClick`; a full document navigation *is* the retry. The `@next/next/no-html-link-for-pages` lint rule is disabled on that one line with the reason recorded inline.

It states what is unavailable — "Some information may be unavailable until you reconnect. Nothing you had already submitted has been lost." — and shows **no cached business data**, so stale figures can never be mistaken for current ones.

Recovery is a plain reload. Nothing is replayed, no form is silently resubmitted.

### Why no offline mutation queue

Deliberate, and carried forward from the audit. The API uses conditional updates for concurrency (`updateMany where { id, status: from }` → 409) and has approval chains with per-record snapshots. A mutation replayed after reconnection could act on a record that has since moved — an approval applied to something already decided. An honest network error beats a queued action that quietly applies to changed state.

## 7. Authentication compatibility

**No change to authentication.** No second mechanism, no credential handling in the worker, no touched business logic.

The session is an `httpOnly` cookie, and the browser talks to `/api/*` same-origin through the Next rewrite. Two consequences:

- The worker *could* see API traffic, which is exactly why rule 2 excludes it before anything else runs.
- The worker **cannot read the session** — `httpOnly` is invisible to script. It never needs to: it does not call the API.

Login, session restore, refresh-on-401 and logout are untouched because the worker never intercepts `/api/*` or `/auth/*`. Nothing authenticated is cached, so **logout leaves nothing behind** — which is why no cache-clearing-on-logout hook was needed. If a future phase ever caches an authenticated response, that hook becomes mandatory.

**Not yet verified end-to-end signed in** — see §16.

## 8. Security boundaries

1. **No authenticated response is cached.** Not HR, payroll, expenses, CRM, messages, documents or approvals. Asserted by a test over eight real API paths.
2. **No authenticated document is cached.** Navigations are network-first and the response is never stored; the only cached document is the generic offline page.
3. **Signed URLs are never cached** — they live under `/api/*` and expire in five minutes.
4. **No secrets in the worker or public assets.** A test greps the worker for key/secret/token/password/bearer/SUPABASE.
5. **Scope is `/` on this origin only**, and cross-origin requests are ignored entirely.
6. **The analytics proxy `/ingest/*` is excluded**, so events cannot be replayed from cache.
7. **Mutations are never stored or replayed.**

Reasoning: this is an internal business application, so a cache on a shared or lost device is a bigger risk than a slower offline experience. Offline capability was traded away wherever it conflicted.

## 9. Update strategy

The failure mode being avoided: a deploy silently swapping the asset set under someone half-way through a leave request.

1. New worker installs and **waits**. It never calls `skipWaiting()` itself — a test asserts the only occurrence is inside the message handler, and that `install` contains none.
2. The client detects a waiting worker and shows a toast: *"A new version is available — Reload"*, with no auto-dismiss.
3. Accepting posts `SKIP_WAITING`; the worker activates, `controllerchange` fires, the page reloads once (guarded against loops).
4. Declining changes nothing. The prompt appears once per page life, so a user who dismisses it is not nagged.
5. Old caches are removed on activate, after the new worker is in charge.

`/sw.js` is served `Cache-Control: public, max-age=0, must-revalidate` — without that the browser could sit on an old copy and the handshake would never fire.

## 10. Browser compatibility

| Platform | Install | Service worker | Notes |
| --- | --- | --- | --- |
| Android Chrome | Yes | Yes | Full support, maskable icons honoured |
| Desktop Chrome / Edge | Yes | Yes | Installs as a windowed app at the same URL |
| iOS Safari 16.4+ | Add to Home Screen (manual) | Yes | No `beforeinstallprompt`; the user must use the Share menu |
| iOS Safari < 16.4 | Add to Home Screen | Partial | Standalone works via the vendor meta tag |
| Firefox (desktop) | **No install** | Yes | No `beforeinstallprompt`; caching and offline still work |
| Safari (macOS) 17+ | Add to Dock | Yes | |

Every capability is behind a feature check. If `serviceWorker` is absent — a private window, an older browser, an insecure origin — the app behaves exactly as before. **Nothing in the intranet depends on the worker, and nothing ever says "PWA required".**

## 11. iOS considerations

- Viewport with `viewport-fit=cover` and safe-area utilities landed in Phase 1.
- `apple-touch-icon` at 180² — iOS ignores the manifest's icon list.
- `apple-mobile-web-app-title` = `Intranet`.
- `statusBarStyle: "default"` — `black-translucent` paints the page under the status bar and needs a per-page safe-area treatment the app does not have yet.
- **Next 16 emits the standardised `mobile-web-app-capable` and no longer emits `apple-mobile-web-app-capable`.** iOS only honours the standard tag from 17.4; below that an install opens inside Safari chrome instead of standalone. The vendor tag is therefore emitted explicitly via `metadata.other`. Verified in the served HTML.
- No speculative iOS workarounds added.
- **Open for device QA:** whether the `httpOnly`, `sameSite: "none"` session cookie survives inside an installed iOS standalone container. Flagged in the audit, still unverified — and it is the single item most likely to bite.

## 12. Android considerations

Manifest valid and parsed; 192 and 512 `any` icons present (Chrome refuses installation without both); dedicated `maskable` icons so the launcher does not shrink the mark inside a white circle; `theme_color` and `background_color` from real palette tokens; `standalone` display; `start_url` inside `scope`.

## 13. Desktop PWA behaviour

Chrome and Edge offer installation from the address bar. The installed window loads the same origin, routes and code — **no separate desktop application, no separate build**. `display_override` prefers `standalone`, falling back to `minimal-ui` then `browser`.

## 14. Development behaviour

**The worker does not register in development, and any leftover registration is actively unregistered.**

Turbopack serves modules that change on every keystroke; a worker caching them produces stale-asset bugs that look like application bugs. Worse, a worker registered by a production build on `localhost` outlives that build — so the manager calls `getRegistrations()` and unregisters in non-production, which is what stops a `pnpm build` experiment poisoning `pnpm dev` afterwards.

Confirmed: the dev branch is **eliminated from the production bundle** (`getRegistrations` appears zero times in the built chunk), so `NODE_ENV` compiles as expected.

`pnpm dev:api`, `pnpm dev:web` and HMR are unaffected.

To exercise PWA behaviour locally, build and then run the **standalone** server, not `next start`:

```bash
pnpm --filter @nexora/web build
cp -r apps/web/public apps/web/.next/standalone/apps/web/public
cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
cd apps/web/.next/standalone && PORT=3000 node apps/web/server.js
```

`next start` warns that it does not support `output: standalone`; it happens to serve the app, but it is not what production runs, and the copy steps above are what make `public/` reachable — the same two lines `Dockerfile.web` performs.

## 15. Testing

`src/components/pwa/__tests__/pwa-foundation.test.ts` — **31 tests**:

- **Manifest as data** — required fields, real product name (and no `nexora`), `short_name` length, canonical `start_url`/`scope` with no `/mobile`, display + fallback chain, required icon sizes and purposes, palette colours.
- **Icons on disk** — every referenced file exists, carries a PNG signature, and its real pixel dimensions match the declared `sizes`.
- **The caching boundary** — the worker's own `isNeverCacheable` / `isHashedStatic` predicates are lifted out of the shipped file and executed against eight real API paths, the analytics proxy, auth callbacks, five authenticated document routes and Next's data requests. This is the security-critical assertion of the phase.
- **Worker contract** — non-GET passthrough, no sync/replay machinery, exactly one `skipWaiting()` and none in `install`, versioned caches cleaned by prefix, offline precache containing no application route, cross-origin ignored, no secrets, and **no `push` handler yet**.

The last group runs against a comment-stripped copy of the worker. The first run of these tests failed because the worker documents its own decisions heavily — the install handler explains *why* it does not call `skipWaiting()`, and the header names the `push` handlers a later phase will add — so grepping raw source found prose and reported it as code. Stripping comments made the assertions mean what they claim.

### Results

| Gate | Result |
| --- | --- |
| type-check | 10/10 workspaces clean |
| lint | **0 errors** |
| Full suite | **2,348 passing** (1,911 API + 437 web), up from 2,317 |
| New PWA tests | 31 |
| Production build | Succeeded; `/offline` prerendered static (`.next/server/app/offline.html`) |

### Verified against a running production server

Twice: first with `next start`, then — after that emitted `⚠ "next start" does not work with "output: standalone"` — again through the **actual deployment path**, `node apps/web/server.js`, with `public/` and `.next/static` assembled exactly as `docker/Dockerfile.web` lines 101–103 do it. That second run is the one that matters, because Docker's `CMD` is `node apps/web/server.js` and a standalone build does **not** include `public/` on its own.

Result on the deployment path: all seven PWA assets 200 with correct content types, the custom `Cache-Control` / `Service-Worker-Allowed` headers preserved (they are applied by the Next server, so they had to be confirmed in standalone mode too), and the API proxy returning JSON from Express. `Dockerfile.web:101` copies `public/`, so the manifest, worker and icons ship correctly — checked rather than assumed.

| Check | Result |
| --- | --- |
| `/manifest.webmanifest` | 200, `application/manifest+json`, `max-age=3600` |
| `/sw.js` | 200, `application/javascript`, `max-age=0, must-revalidate`, `Service-Worker-Allowed: /` |
| `/offline` | 200 |
| All five icons | 200, `image/png` |
| `viewport` meta | `width=device-width, initial-scale=1, viewport-fit=cover` |
| `theme-color` | two entries, light `#ffffff` / dark `#1f1c19` |
| `manifest` link, `apple-touch-icon` link | present and correct |
| `mobile-web-app-capable` | `yes` |
| `sw.js` syntax | `node --check` passes; no `window`/`document` usage |
| Registration code in production bundle | present; dev branch eliminated |

## 16. Known limitations

1. **Service-worker registration was not verified in a live browser.** The embedded browser pane refuses worker registration (`TypeError: An unknown error occurred when fetching the script`) even though the script serves 200 with the correct content type and passes `node --check`. This is environmental, not a defect in the file — but it means **install, caching, offline fallback and the update handshake have not been observed end to end**. They remain for CI or a manual pass in real Chrome. This is the largest gap in the phase and should not be read as "verified".

   Attempted and ruled out as a way to confirm it indirectly: `next start` and `node server.js` do not log requests, so a fetch of `/sw.js` by a real browser leaves no server-side trace to check.
2. **Playwright browsers still not installed locally**, so no automated browser test was run. A ~130 MB download was not taken unprompted, per the brief.
3. **Authenticated flows not exercised** — login, session restore, logout with a worker active. The worker never touches `/api/*` or `/auth/*` by construction, and nothing authenticated is cached, but that is an argument, not an observation.
4. **iOS standalone + `sameSite: "none"` cookie remains unverified** (§11). Highest-risk open item.
5. **512px icons are upscaled** from a ~256px source (§3). A vector source would fix it.
6. **`SW_VERSION` is bumped by hand.** Deriving it from the build id would be better but would need the worker to be templated at build time, which the static-file approach deliberately avoids.
7. **No install prompt UI.** `beforeinstallprompt` capture, a considered moment to offer it, and iOS Share-menu instructions were not built — the brief lists installability, not an install campaign. Recommended for the next phase.
8. **No offline indicator in the app.** A connectivity banner would help, but it belongs with the module work that can act on it.
9. **Toast-based update prompt depends on sonner being mounted.** It is, in the root layout — but if a future refactor moves the Toaster below the manager, updates would become silent.

## 17. Future Web Push requirements

**Not implemented, by instruction.** The worker is structured so it can be added without touching anything else: `push` and `notificationclick` handlers append to `sw.js`, and a test currently asserts neither exists so nobody adds them by accident mid-phase.

Still required when that phase starts:

1. VAPID keys — private via GitHub Secrets → Cloud Run `--set-env-vars`; public may be `NEXT_PUBLIC_*` (it is designed to be public). Never in source.
2. A `PushSubscription` Prisma model + additive migration — the only database change the whole PWA effort needs.
3. `POST /api/push/subscribe`, `DELETE /api/push/unsubscribe`, permission-gated; prune on a 410/404 from the push service.
4. `web-push` on the API (not currently a dependency).
5. Per-user preferences, following the existing `OrchestratorNotificationPreference` pattern.
6. **Payloads must carry no sensitive content** — notifications render on lock screens. Send an identifier and a neutral title; fetch details after the user opens the app.
7. iOS requires **16.4+ and an installed PWA**; it does not work in a Safari tab. Plan for it being unavailable to a meaningful share of users.
8. A decision on read-state semantics: the notification bell's unread set is per-device `localStorage`, so a push read on a phone will not clear the badge on a desktop.

---

## Definition of Done

| Item | Status |
| --- | --- |
| PWA architecture implemented | Yes |
| Manifest implemented | Yes |
| Existing product name used | Yes — asserted by test |
| Correct canonical start URL | Yes — `/`, no `/mobile` |
| Icons configured | Yes — 5 generated from brand artwork |
| Theme metadata configured | Yes — per-theme `theme-color` |
| Service worker implemented | Yes |
| Static caching safe | Yes — content-hashed only |
| Shell caching safe | Yes — offline page only |
| Authenticated API not cached | **Yes — never, asserted by test** |
| Offline fallback | Yes — JS-free page |
| Cache versioning | Yes |
| Update lifecycle | Yes — user-controlled |
| Authentication unchanged | Yes — no files touched |
| Normal browser usage works | Yes — all behind capability checks |
| Desktop PWA | Manifest supports it; **not observed** (§16) |
| Android considerations | Verified as configuration |
| iOS considerations | Verified as configuration + documented |
| No API changes | Yes |
| No database changes | Yes |
| No business-module changes | Yes |
| Type-check / lint / tests | Clean / 0 errors / 2,348 passing |
| Documentation | This file |
