# Phase 6 — Notifications & Web Push

Web Push on the existing notification architecture. **No new notification system, no second backend, no business-module changes.**

References: [AUDIT](MOBILE_PWA_AUDIT.md) · [PHASE_3](PHASE_3_PWA_FOUNDATION.md) · [PHASE_4](PHASE_4_AUTH_NAVIGATION.md) · [SCHEMA PROPOSAL](PHASE_6_SCHEMA_PROPOSAL.md) · Completed 2026-08-25

---

## 1. Existing notification architecture

Audited before writing anything. The intranet already has **three** notification mechanisms; push becomes a fourth delivery channel on the same events, not a replacement.

```
Business event (approval raised, task assigned, status changed, …)
        │
        ├─▶ READ-MODEL          dashboard.service recomputes pendingActions /
        │                        urgentItems from source tables on every request
        │                        → notification bell renders them
        │
        ├─▶ EVENT STORE          CrmNotification rows for things that cannot be
        │                        recomputed (a comment happened, a status moved)
        │                        → bell reads them too; `readAt` per row
        │
        ├─▶ EMAIL                existing templated service (crmTaskUpdateEmail …)
        │
        └─▶ WEB PUSH  ← NEW      pushService.sendToUsers(recipients, payload)
                                 → service worker → device
```

| Piece | Where | Touched this phase? |
| --- | --- | --- |
| Bell UI | `components/layout/notification-bell.tsx` (595 lines) | Yes — responsive only, §3 |
| Feed | `GET /api/dashboard/stats` read-model | **No** |
| Event store | `CrmNotification` (`crm_notifications`) | **No** |
| Read/unread | `localStorage` seen-id set, `-v2`, capped | **No** |
| Email | existing service + templates | **No** |
| Realtime | Socket.IO (messages only) | **No** |
| Push | *did not exist* | **New** |

**Not found, despite `CLAUDE.md` describing it:** `OrchestratorNotificationPreference`. There is no notification-preference model on this branch at all. Recorded rather than assumed — it may exist on another branch.

## 2. Existing notification APIs

Reused unchanged: `GET /api/dashboard/stats` (the bell's entire feed, gated `HOME_READ`).

New, and only for subscriptions — never for content or recipients:

| Route | Purpose |
| --- | --- |
| `GET /api/push/config` | Is push available, the VAPID public key, this user's device count |
| `POST /api/push/subscribe` | Register this browser |
| `POST /api/push/unsubscribe` | Remove this browser |
| `POST /api/push/unsubscribe-all` | Remove every device — used on sign-out |
| `POST /api/push/test` | **Development only** — see §22 |

There is deliberately **no route that sends to another user.**

## 3. Existing notification UI, made responsive

The bell is a `Popover` with grouped items (`approval`, `survey`, `urgent`, `it-crm`, `it-crm-update`, `news`), a seen-id badge, mark-all-read, per-item deep links and an empty state. Its business model was not changed. Three defects found by reading it:

| Defect | Fix |
| --- | --- |
| Panel was `w-[360px]` — **wider than a 320px viewport**, so it was clipped or shoved off-axis on the narrowest phones | `w-[calc(100vw-1.5rem)] max-w-[360px] sm:w-[400px]` |
| Trigger was `size-7` (28px) — below touch guidance; Phase 4 raised the topbar's other controls to 36px and missed this one | `size-9 md:size-7` |
| List capped at `max-h-[60vh]` — `vh` includes mobile Safari's retracted URL bar, so the panel could extend under the browser chrome | `max-h-[60svh]` + `overscroll-contain` |

Everything else — grouping, timestamps, read state, deep links, empty state — is unchanged, so no notification information was removed at any width.

## 4. Notification badge

**One source, and it was already single.** `NotificationBell` is rendered once in the topbar and computes `unreadCount` from the dashboard stats feed plus the seen-id set. Desktop and mobile render the same component, so there is no `desktopUnreadCount` / `mobileUnreadCount` to diverge. No change was needed and none was made.

## 5. Deep links

Notification targets come from the existing items (`item.href`), which already point at real routes. **No route was invented.**

For push, the target travels in the payload as a root-relative path and is validated **twice**:

1. **Server** — `isSafeNotificationUrl()` refuses to send at all if the URL is not same-origin and root-relative. It refuses rather than rewrites, because quietly correcting a bad URL hides the bug that produced it.
2. **Service worker** — `safeTargetPath()` re-checks before `openWindow()`/`navigate()`.

Both mirror Phase 4's `safeRedirectTarget()`. Query strings and fragments are preserved, so `/projects?view=pending` survives. An unauthenticated tap lands on sign-in and returns to the target through the existing redirect handling — no new redirect architecture.

## 6–7. Web Push architecture and VAPID

Standards-based Web Push (RFC 8291/8292) via `web-push` — the one dependency added. It is not optional: RFC 8291 payload encryption must not be hand-rolled. No Firebase, no OneSignal; neither was already in the repository.

| Variable | Where | Secret? |
| --- | --- | --- |
| `VAPID_PUBLIC_KEY` | API runtime | No — it is designed to be public |
| `VAPID_PRIVATE_KEY` | API runtime | **Yes** — server only, never in a bundle |
| `VAPID_SUBJECT` | API runtime | No (`mailto:` or https URL) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | web build arg | No |

The client gets the public key from `GET /api/push/config` at runtime, so the `NEXT_PUBLIC_*` build arg is belt-and-braces for any future build-time use.

Wired per the three-file checklist in `CLAUDE.md`, because a half-wired flag is a documented failure mode here:

1. `turbo.json` `globalEnv` — all four
2. `docker/Dockerfile.web` — `ARG` + `ENV` for the public key
3. `deploy.yml` **and** `deploy-staging.yml` — `--build-arg` on the web build **and** `--set-env-vars` on the API service, in **both** workflows

Generate a pair with `npx web-push generate-vapid-keys`. **No key is committed**; without them the API logs a warning and push silently no-ops.

## 8. Subscription model

One new table. Full rationale, field-by-field, in [PHASE_6_SCHEMA_PROPOSAL.md](PHASE_6_SCHEMA_PROPOSAL.md).

## 9. Multiple devices

The design assumption throughout: **a user has devices, not a device.** `endpoint` is unique, not `userId`, so a desktop browser, an Android tab and an installed iOS PWA coexist as three rows. `sendToUsers()` resolves every device for every recipient and delivers to all of them. Tested with three devices for one user.

Re-subscribing the *same* device upserts on its endpoint rather than adding a row, and a shared device re-points at whoever is now signed in.

## 10. Subscription lifecycle

| Event | Behaviour |
| --- | --- |
| Enable | Upsert on endpoint; `failureCount` reset — a device coming back is not a failing device |
| Disable | Server told **first**, then the browser unsubscribes. The other order leaves the server sending to an endpoint the browser has discarded |
| Sign out | Every device dropped (§16) |
| **404 / 410** from the push service | Permanent — row deleted immediately |
| 429 / 5xx | Transient — `failureCount++`, row kept |
| 10 consecutive failures | Row deleted. "Transient" must not mean "forever" |
| Success | `failureCount` reset, `lastSuccessAt` stamped |

No cron job: cleanup is driven by delivery outcomes, so a dead endpoint goes the first time it is used.

## 11. Permission UX

**The prompt is never automatic.** There is no effect anywhere that calls `Notification.requestPermission()` — it is reachable only from `enable()`, which only runs from a click. Asking on page load and being dismissed gets a site permanently blocked by the browser.

The opt-in lives at the foot of the notification bell, which is where somebody looks when they wonder why they missed something. It renders **nothing at all** when the browser cannot do push or the server has no keys — advertising a feature that cannot be delivered is worse than staying quiet.

If the user declines, the UI stops asking and explains that it must be undone in browser settings, because the browser will not prompt again from a button.

## 12. Notification settings

None existed, and per Step 12 none was built. The send path takes a `tag`/category, so per-category preferences can be added later without touching the subscription table.

## 13. Authorization

**The server decides who.** `sendToUsers()` takes user ids resolved by the calling module from its own authorisation logic. There is no route through which a browser can name a recipient, and no broadcast-then-filter-on-client path.

Subscription routes are authorised by **ownership, not permission code**: managing delivery to your own phone is not a privilege the organisation grants, so `authenticate` is the whole gate, and `userId` always comes from the session. Unsubscribe is scoped by `userId` in the repository, so replaying somebody else's endpoint deletes nothing.

## 14. Payload strategy

Minimal, because a push renders on a lock screen:

```json
{ "title": "Approval required",
  "body": "You have an item requiring your attention.",
  "url": "/projects/abc",
  "notificationId": "…" }
```

Never the amount, the name or the decision. The device carries a pointer; the application fetches detail after the user opens it and is authenticated. A test asserts the serialised payload contains no subscription keys and no private key.

## 15. Service-worker changes

**Appended, not rewritten.** The Phase 3 caching rules were not touched, and a test asserts the API-caching boundary still holds after the push handlers landed.

Added: `push` and `notificationclick`. Both defensive — the payload arrives from the network:

- A malformed body falls back to a generic notification instead of throwing, because a throw shows the browser's own "site updated in the background" message.
- Non-JSON is taken as a plain body rather than dropped.
- Every URL goes through `safeTargetPath()`.

## 16. Notification click behaviour

An existing same-origin window is **focused and navigated**; a third copy of the intranet is only opened when nothing is open. `navigate()` failing is swallowed after a successful `focus()` — being in the app beats being nowhere.

## 17. Foreground vs background

**Chosen behaviour: no system notification while a window is focused.** The bell already shows the item, and a lock-screen banner for something visible on screen is noise. The worker instead `postMessage`s `PUSH_RECEIVED` to open clients so a page can refresh its badge.

When every window is closed or backgrounded, the notification is shown. Repeats of the same underlying item collapse via `tag`, which reuses the existing notification id rather than minting a second identifier system (§18).

## 18. Deduplication

Reuses the existing `CrmNotification.id` as `notificationId`, and that value becomes the notification `tag`. No second event-id scheme was introduced.

## 19–20. Retry and asynchronous delivery

Failure classification is in §10. Nothing retries in a loop: a transient failure is counted and the *next* event tries again, which bounds attempts naturally without a scheduler.

**There is no queue, deliberately.** The codebase has no job runner — cron endpoints and inline best-effort fan-outs are the existing patterns — and the brief forbids introducing Redis or similar for this alone. So `sendToUsers()` is called inline and is **best-effort**: it never throws, exactly like the existing email fan-outs, so a business transaction cannot fail because a push service is down.

**Limitation, stated plainly:** a fan-out to many devices runs within the request. Fine at this organisation's scale (hundreds of subscriptions); if a single event ever targets thousands of devices, it needs a queue. Recorded rather than pre-solved.

## 21. Logging

Follows the winston conventions. Logged: subscription registered/removed (user id + subscription id), fan-out totals, prune events, failure status codes.

**Never logged:** the endpoint (it is a capability URL — anyone holding it can push to that device), `p256dh`/`auth`, any VAPID key, or payload contents. A test greps the worker for secrets.

## 22. Test trigger

`POST /api/push/test` sends only to the **caller's own** devices — it takes no recipient, so it cannot be used to push text at colleagues. It is **not registered at all when `NODE_ENV === "production"`**: the route does not exist there, a 404 rather than a guarded 403, and the check fails closed.

## 23. Security summary

| Risk | Handling |
| --- | --- |
| VAPID private key exposure | Server-only env var; never a `NEXT_PUBLIC_*`, never logged |
| Sending to another user's device | No route accepts a recipient; ownership from session |
| Unsubscribing someone else | Repository scopes by `userId` |
| Open redirect via payload | Validated server-side **and** in the worker |
| SSRF via endpoint | Zod requires a valid **https** URL |
| Lock-screen data leakage | Minimal payload (§14) |
| Shared device after logout | All subscriptions dropped on sign-out |
| Stale endpoints accumulating | 404/410 pruned; failure cap |
| XSS via notification content | Content is server-generated; the worker only ever passes strings to `showNotification` |

## 24. iOS behaviour

Verified against documented platform behaviour, not assumed to match Android:

- **iOS 16.4+ required**, and **only for an installed (Add to Home Screen) PWA**. Web Push does not work in a normal Safari tab.
- The permission prompt must follow a user gesture — which the opt-in already guarantees.
- Below 16.4, or in a tab, the hook reports `unsupported` and the opt-in renders nothing. The intranet is unaffected.
- The Phase 3 `apple-touch-icon` and `apple-mobile-web-app-capable` work is what makes the installed context possible.

**Unverified and still open from Phase 0:** whether the `httpOnly`, `sameSite: "none"` session cookie behaves inside an installed iOS standalone container. This remains the highest-risk unknown of the whole PWA effort, and push depends on it — a subscription is useless if the tap lands on a signed-out app.

No speculative iOS workarounds were added.

## 25. Android behaviour

Chrome on Android supports Web Push in both a tab and an installed PWA. `userVisibleOnly: true` is set, which Chrome requires. Maskable icons from Phase 3 are used for the notification badge. Not verified on a device — see §27.

## 26. Browser fallback

Push is progressive enhancement throughout. Without service workers, `PushManager`, `Notification`, or with the server unconfigured, the hook reports `unsupported`/`unconfigured`, the opt-in renders nothing, and **the bell, the notification centre, email and every in-app notification keep working**. Nothing anywhere says "notifications required".

## 27. Tests

**32 new tests.**

`push.service.test.ts` (28) — configuration (disabled without keys; refuses to subscribe; public key never leaks the private one); lifecycle (upsert not duplicate, shared-device re-point, user-agent truncation, caller-scoped unsubscribe, logout clears all); multiple devices (three devices, recipient de-duplication, skipped vs failed); failures (404/410 delete, transient keeps, cap drops, success resets, never escapes to the caller); target safety (six accepted/rejected URL shapes, refuse-don't-rewrite); payload (exact contents, no keys, no secrets).

`pwa-foundation.test.ts` (4 changed/added) — push and notificationclick handled; **caching boundary still intact after push landed**; unsafe URLs refused; malformed payload survived; existing window reused.

The Phase 3 test asserting the worker had *no* push handler was replaced rather than deleted — it correctly failed the moment push was added, which is what it was for.

| Gate | Result |
| --- | --- |
| type-check | 10/10 workspaces clean |
| lint | **0 errors** |
| Full suite | **2,424 passing** (1,939 API + 485 web), up from 2,392 |

## 28. Manual verification

**Nothing here was verified end to end in a browser.** Push requires a real push service, a real subscription and — for anything meaningful — a signed-in session, which needs a password. The pieces are unit-tested and the worker parses; delivery has not been observed.

### Steps for a human

Prerequisites: `npx web-push generate-vapid-keys`, put the pair in `.env.development` as `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT=mailto:it@thebinaryholdings.com`, restart the API, and run the **production** web build (the worker does not register in dev — Phase 3 §14).

1. Sign in, open the notification bell → an "Enable" row appears at the foot.
2. Click **Enable** → the browser prompt appears (and not before).
3. Accept → the row becomes "Notifications are on for this device".
4. Confirm in DevTools → Application → Service Workers that a push subscription exists.
5. `POST /api/push/test` (dev only) from the browser console or curl with your session.
6. Background or close the window → the notification appears.
7. With the window **focused**, trigger again → no system notification (by design, §17).
8. Tap the notification → the existing window focuses and navigates to `/dashboard`; no second window.
9. Repeat on a second browser → confirm both receive (§9).
10. **Turn off** → confirm no further delivery.
11. Sign out → confirm the subscription is gone and delivery stops.
12. Android Chrome and an installed iOS 16.4+ PWA (§24, §25).

## 29. Known limitations

1. **No end-to-end delivery observed** (§28). The largest gap.
2. **The migration has not been applied anywhere.** Deliberate — see the schema proposal §8. Until it is, `/api/push/*` will fail at the database.
3. **No event producer is wired yet.** `pushService.sendToUsers()` is complete and tested, but **no business module calls it**, because wiring it into approvals, tasks or messages means editing those modules, which this phase's scope forbids. Push is currently reachable only through the dev test route. This is the obvious next step.
4. **No queue** (§19).
5. **iOS standalone session-cookie question still open** (§24).
6. **No per-category preferences** (§12).
7. **Foreground suppression is a judgement call.** If a notification is genuinely urgent, suppressing it because a window is focused may be wrong. Revisit with real usage.
8. `deviceCount` in the opt-in is optimistic after enable/disable — it adjusts locally rather than re-reading. Cosmetic.

## 30. Future improvements

Wire producers (approvals first — that is where push earns its place), per-category preferences, a queue if fan-out ever grows, and delivery observability beyond `lastSuccessAt`.

---

## Definition of Done

| Item | Status |
| --- | --- |
| Existing architecture audited / reused | Yes — read-model, event store and email untouched |
| Responsive notification UI | Yes — three real defects fixed |
| Desktop behaviour preserved | Yes — width/target changes are `md:`-scoped |
| Badge single-sourced | Already was; verified |
| Web Push implemented | Yes |
| VAPID handled securely | Yes — private key server-only, three-file wiring |
| Subscription lifecycle | Yes — including cap and prune |
| Multiple devices | Yes — endpoint-unique, tested |
| Permission UX | Yes — click-only, never on load |
| Backend recipient authorization | Yes — no client-addressable recipients |
| Payload minimised | Yes — tested |
| Service-worker push | Yes — appended, boundary intact |
| Click / deep link | Yes — validated twice, window reused |
| Invalid subscriptions handled | Yes |
| Delivery failures safe | Yes — never escapes to the caller |
| Browser fallback | Yes |
| iOS / Android documented | Yes |
| No business modules changed | Correct — and that is why no producer is wired |
| Database change documented | [Schema proposal](PHASE_6_SCHEMA_PROPOSAL.md); **not applied** |
| Type-check / lint / tests | Clean / 0 errors / 2,424 passing |
| Documentation | This file |
