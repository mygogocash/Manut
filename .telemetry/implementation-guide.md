# Instrumentation Guide

## Target: PostHog (US Cloud — `posthog-js` web, `posthog-node` api)

Generated from `.telemetry/tracking-plan.yaml` v1 on 2026-05-08.

**Resolved project (from owner, 2026-05-08):**

| Field | Value |
|---|---|
| Region | US Cloud |
| Project ID | 415423 |
| Project token | stored in `NEXT_PUBLIC_POSTHOG_KEY` / `POSTHOG_API_KEY` (public ingestion key — safe in browser; do not commit literal value) |
| Host | `https://us.i.posthog.com` (api) / `/ingest` via Next.js rewrite (web) |
| Replay session example | https://us.posthog.com/project/sTMFPsFhdP1Ssg/replay/019e080e-f204-79b8-852c-4fee8c9340b8?t=819 |
| Admin link | http://go/adminOrgUS/019e0818-3d5c-0000-7920-18fdcfc362a2 |

This guide is the contract for the implementation phase. It teaches **how** to make PostHog `identify`, `group`, and `capture` calls in this codebase. It does **not** map every event in the tracking plan one-by-one — that is the implementation phase's job. Patterns shown here apply uniformly to all 49 target events.

> **Source artifacts.** This worktree (`silly-shaw-ca472f`) does not yet contain `tracking-plan.yaml` / `product.md` / `delta.md`. They live in worktree `intelligent-engelbart-75728b`. Before kicking off implementation, copy them into this worktree's `.telemetry/` so the implementation phase can read them next to this guide.
>
> **Path correction.** The skill brief named `apps/web/src/providers/auth-provider.tsx`. The actual file is `apps/web/src/providers/auth-provider.tsx`. All references below use the real path.

---

## SDK Setup

### Dependencies

```bash
# Web
pnpm --filter @nexora/web add posthog-js

# API
pnpm --filter @nexora/api add posthog-node
```

PostHog ships its own batching, retry, and IndexedDB / in-memory queue — there is no need for Sidekiq / BullMQ / Cloud Tasks. **Single chokepoint, no extra delivery layer.**

### Environment Variables

| Variable | Used by | Purpose | Required |
|---|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | web (browser) | Project API key. Public — safe to ship to the browser. | yes |
| `NEXT_PUBLIC_POSTHOG_HOST` | web (browser) | Reverse-proxy path (recommended `/ingest`) or PostHog host. | yes |
| `POSTHOG_API_KEY` | api (Node) | Same value as `NEXT_PUBLIC_POSTHOG_KEY`, kept under a non-public name for server use. | yes |
| `POSTHOG_HOST` | api (Node) | `https://us.i.posthog.com` (US Cloud) or `https://eu.i.posthog.com`. | yes |
| `NEXT_PUBLIC_TELEMETRY_ENABLED` | web (browser) | `1` to opt-in tracking outside production (staging smoke-tests). | no |
| `TELEMETRY_ENABLED` | api (Node) | `1` to opt-in tracking outside production. | no |

**Wiring per CLAUDE.md:**

1. Add to root `.env.development` (all four `*_HOST` / `*_KEY` placeholders + the two opt-ins).
2. Mirror `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` in `apps/web/.env.development`.
3. Append all six names to `turbo.json` `globalEnv` (after `DOCUSIGN_REDIRECT_URI`).
4. Add `POSTHOG_API_KEY`, `POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` to GitHub Secrets.
5. Append them to the `--set-env-vars` block in `.github/workflows/deploy.yml` (line 129 for the API service, line 206 for the web service — only the `NEXT_PUBLIC_*` pair needs to land on web).
6. Do **not** ship the keys to Cloud Run preview / staging unless `TELEMETRY_ENABLED=1` is also set in that environment.

### Reverse proxy (recommended — open question #1: yes)

Adblockers (uBlock, AdGuard, Brave Shields) block `*.posthog.com` by default and corporate users routinely run them. Proxy through Next.js so the browser only ever sees same-origin requests.

`apps/web/next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  // ...existing rewrites
  async rewrites() {
    return {
      beforeFiles: [
        // PostHog ingestion — masked behind same-origin /ingest path
        { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
        { source: "/ingest/:path*",        destination: "https://us.i.posthog.com/:path*" },
        { source: "/ingest/decide",        destination: "https://us.i.posthog.com/decide" },
      ],
      // ...existing rewrites
    };
  },
  // PostHog requires this for the rewrite to work with trailing slashes off
  skipTrailingSlashRedirect: true,
};
```

Then set `NEXT_PUBLIC_POSTHOG_HOST=/ingest` in `apps/web/.env.development` and prod. Swap `us.i.posthog.com` for `eu.i.posthog.com` on EU Cloud.

### Capture gate

Every public entry point (`tracking.identify`, `tracking.group`, `tracking.capture`) is a no-op unless one of the following is true:

- `process.env.NODE_ENV === "production"` (the prod gate from CLAUDE.md), **or**
- the dev-opt-in flag (`NEXT_PUBLIC_TELEMETRY_ENABLED === "1"` on web, `TELEMETRY_ENABLED === "1"` on api).

This single gate replaces SDK-level `opt_out_capturing()` — it's cleaner because it never sends to the SDK in the first place.

---

## Identity

### identify()

PostHog's `posthog.identify(distinctId, $set)` links the anonymous browser session to a known user, and `$set` writes person properties.

**User Traits (from `tracking-plan.yaml#entities.user`):**

| Trait | Type | PII | Notes |
|---|---|---|---|
| `email` | string | yes | Required. Set once on identify, refreshed on profile change. |
| `name` | string | yes | Required. |
| `entity_id` | string | no | cuid; matches the `entity` group key. |
| `entity_code` | string (enum: TH/IN/VN/ID) | no | Convenience filter. |
| `department` | string | no | |
| `job_title` | string | no | |
| `roles` | string (comma-joined) | no | PostHog person properties don't index arrays well; comma-joined string is searchable. |
| `is_employee_only` | boolean | no | Drives "employee-only vs full-staff" segmentation. |
| `created_at` | datetime | no | One-time. Use `$set_once`. |
| `last_active_at` | datetime | no | Updated by snapshot sync cron, not on every event. |
| `leave_requests_30d`, `expenses_30d`, `aria_messages_30d` | integer | no | Snapshot-sync only. |

**When to call (web):**

1. Once on page load if a session already exists — fired from `apps/web/src/providers/auth-provider.tsx` inside the existing `refreshUser()` callback. That callback already runs on mount, on visibility-return, on the periodic 4-minute timer, and after `login()`. Each is a valid identify hook.
2. Immediately after `login()` resolves.
3. On `logout()`, call `posthog.reset()` (clears identity **and** group associations).

Do **not** call identify on every render. The auth-provider's `refreshUser()` already de-dupes naturally — only fires when `/me` actually returns.

**When to call (api):**

Server-side, identify is fired from the snapshot-sync cron only (it owns the lifecycle of the `*_30d` and `last_active_at` traits). Per-request server identify is unnecessary because the web SDK already owns the live session.

**Template Code (web — inside auth-provider's refreshUser):**

```typescript
import { tracking } from "@/lib/tracking";

const refreshUser = useCallback(async () => {
  try {
    const result = await authService.getMe();
    setState({
      user: result.user,
      roles: result.roles ?? [],
      permissions: result.permissions ?? [],
      isLoading: false,
      isAuthenticated: true,
    });

    // Identify + group as soon as we know who they are.
    tracking.identify(result.user.id, {
      email: result.user.email,
      name: result.user.name,
      entity_id: result.user.entityId ?? null,
      entity_code: result.user.entityCode ?? null,
      department: result.user.department ?? null,
      job_title: result.user.jobTitle ?? null,
      roles: (result.roles ?? []).map((r) => r.name).join(","),
      is_employee_only:
        (result.roles ?? []).length > 0 &&
        (result.roles ?? []).every((r) => r.name === "Employee"),
      $set_once: { created_at: result.user.createdAt },
    });

    if (result.user.entityId) {
      tracking.group("entity", result.user.entityId, {
        code: result.user.entityCode,
        name: result.user.entityName,
      });
    }
  } catch {
    setState({ /* ...unauthenticated state */ });
    tracking.reset();
  }
}, []);
```

---

## group()

The tracking plan declares **one** group type: `entity`. PostHog supports up to 5 group types per project — we are using 1, so there is huge headroom.

**Group Hierarchy:**

| Plan level | PostHog `groupType` | ID source | Parent |
|---|---|---|---|
| `entity` | `entity` | `User.entityId` (cuid) | none (top level) |

There is no second tier. Single-tenant product; "account" is not a meaningful concept here. Do not invent a `company` group.

**Group Traits (from `tracking-plan.yaml#groups.entity`):**

| Trait | Type | Notes |
|---|---|---|
| `code` | string (enum: TH/IN/VN/ID) | |
| `name` | string | "TBH Thailand", "TBH India", etc. |
| `headcount` | integer | Snapshot-sync owned. |
| `created_at` | datetime | One-time. |

**When to call (web):**

Right after `identify`, in the same `refreshUser` block (see template above). The web SDK is stateful — once `posthog.group('entity', user.entityId, …)` is called, every subsequent `posthog.capture` is automatically attributed to that entity. No need to pass `$groups` on each capture.

**When to call (api):**

From the snapshot-sync cron (`groupIdentify`) to keep `headcount` fresh. Backend SDK is stateless — server-side captures must pass `groups: { entity: entityId }` explicitly. See the API tracking module below.

**Template Code (web):**

Already shown inside the `refreshUser` block above:

```typescript
tracking.group("entity", result.user.entityId, {
  code: result.user.entityCode,
  name: result.user.entityName,
});
```

**Template Code (api — group identify from cron):**

```typescript
posthog.groupIdentify({
  groupType: "entity",
  groupKey: entity.id,
  properties: {
    code: entity.code,
    name: entity.name,
    headcount: entity.headcount,
  },
});
```

---

## Events

### capture()

PostHog uses `capture(eventName, properties)` (browser) or `capture({ distinctId, event, properties, groups })` (Node).

**SDK Constraints:**

- **PostHog accepts properties** (unlike Accoil). Keep the `object.action` event names from the tracking plan exactly as written — `lead.created`, `task.status_changed`, etc. PostHog matches strings literally.
- **Browser SDK is stateful** — after `posthog.group('entity', …)`, every `posthog.capture` auto-attributes to the active entity. Do not pass `$groups` from the client.
- **Node SDK is stateless** — server-side `capture` MUST include `groups: { entity: entityId }` or it will land outside group analytics.
- **Reserved property names** start with `$` (`$set`, `$set_once`, `$groups`). Do not use `$`-prefixed keys for product properties.
- **No PII in event properties.** All PII (email, name) lives only on user traits via `identify`.
- **5 group types max per project.** We use 1.
- **Multiple groups of the same type cannot be assigned to a single event** — fine for us; one entity per event.

**Template Code (web — stateful):**

```typescript
// Funnel start — fired from a Dialog's onOpenChange(true).
tracking.capture("leave_request.started");

// Funnel submit — fired from the service layer after a 200/201.
tracking.capture("leave_request.submitted", {
  leave_type_code: payload.leaveTypeCode,
  days: payload.days,
  is_self: payload.isSelf,
});
```

**Template Code (api — stateless, groups required):**

```typescript
// Approval — fired from leave.service.ts after the DB update.
tracking.capture(actor.id, "leave_request.approved", {
  leave_request_id: leaveRequest.id,
  approver_role: approverRole,
}, actor.entityId);
```

### Group-Level Attribution

Single group type (`entity`), so attribution is uniform. Every event carries the actor's entity:

- **Web:** automatic after `posthog.group('entity', user.entityId)`. No per-call work.
- **Api:** the `tracking.capture` wrapper takes `entityId` as the last positional arg and injects `groups: { entity: entityId }` for you.

If a future module needs per-project or per-team group analytics (e.g. Projects rollups), add a second group type then — and pass it explicitly via `$groups` (web) or `groups` (api). Keep it out of v1.

---

## The five funnel rules (apply uniformly to every form)

The tracking plan has 11 funnel triplets (`*.started` / `*.submitted` / `*.cancelled`). One pattern fits all:

1. **`*.started` fires on `Dialog onOpenChange(true)`.** Most form dialogs in this repo follow `apps/web/src/components/accounting/invoice-dialog.tsx:148`'s pattern: `<Dialog open={...} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }} />`. Wrap that handler.
2. **`*.submitted` fires from the service-layer call site** (`apps/web/src/services/<module>.service.ts`) **after** the `api.post(...)` resolves. Service-layer guarantees the API confirmed 200/201 — never trust client-side state for "submitted."
3. **`*.cancelled` fires on `onOpenChange(false)`** **only if no submit happened** in this open session. Track via a `submittedRef = useRef(false)`; set it to `true` in the success branch; check it in the close branch.
4. **Server-confirmed events that have no client signal** (approvals, payroll runs, role grants) fire from `apps/api/src/modules/<module>/<module>.service.ts` after the DB write commits.
5. **`module.viewed` is special — single useEffect in the dashboard layout**, not per-page. See section below.

Do **not** add a second `started` event in the controller. Do **not** fire `submitted` from the dialog's `onSuccess` — go through the service.

### `module.viewed` — single useEffect, mapped from pathname

Per-route instrumentation will rot. Centralize in `apps/web/src/app/(dashboard)/layout.tsx`:

```typescript
"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { tracking } from "@/lib/tracking";

const MODULE_FROM_FIRST_SEGMENT: Record<string, string> = {
  dashboard:      "home",
  aria:           "aria",
  messages:       "messaging",
  projects:       "projects",
  partners:       "partner_crm",
  sales:          "sales_crm",
  deals:          "sales_crm",
  employees:      "employees",
  directory:      "employees",
  leave:          "leave",
  travel:         "travel",
  careers:        "careers",
  applications:   "careers",
  survey:         "survey",
  payroll:        "payroll",
  legal:          "legal",
  dataroom:       "legal",
  hrms:           "hrms",
  learning:       "learning",
  visa:           "visa",
  benefits:       "benefits",
  "my-portal":    "my_portal",
  admin:          "admin",
  settings:       "settings",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lastModule = useRef<string | null>(null);

  useEffect(() => {
    const seg = pathname.split("/").filter(Boolean)[0];
    const mod = MODULE_FROM_FIRST_SEGMENT[seg ?? ""];
    if (!mod) return;
    if (mod === lastModule.current) return; // de-dupe within a module
    lastModule.current = mod;

    const segs = pathname.split("/").filter(Boolean);
    tracking.capture("module.viewed", {
      module: mod,
      sub_section: segs[1] ?? null,
    });
  }, [pathname]);

  // ...rest of existing layout (ProtectedRoute, SidebarProvider, …)
}
```

Map all 18 modules from the YAML's `module` enum exactly. Unknown segments (`/change-password`, `/sign-in`, etc.) deliberately don't fire — they're not modules.

`source` is **not** set here — it requires knowing how the user arrived (sidebar click, deep link, search). Defer until v2; the server can't tell the difference reliably and instrumenting every nav anchor is exactly the noise the tracking plan rejects.

### Debouncing `task.status_changed` (open question #4)

Drag-and-drop columns can fire many status changes in a row. Strategy: **don't debounce on the client** — fire only after the API confirms the move. Optimistic UI changes that revert on error must NOT fire the event. The service-layer-after-200/201 rule handles this for free.

If a board ever batches multiple moves into one bulk request, fire one `task.status_changed` per task in that response — not one per drag.

---

## Complete Tracking Module — `apps/web/src/lib/tracking.ts`

Drop-in. No assembly required.

```typescript
"use client";

import posthog, { type PostHog } from "posthog-js";

const isEnabled =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === "1";

let initialized = false;

function init(): PostHog | null {
  if (!isEnabled) return null;
  if (typeof window === "undefined") return null;
  if (initialized) return posthog;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !host) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[tracking] posthog disabled — missing key/host");
    }
    return null;
  }

  posthog.init(key, {
    api_host: host,
    defaults: "2026-01-30",
    capture_pageview: false, // we use module.viewed
    capture_pageleave: true,
    autocapture: false,      // no $autocapture noise — explicit events only
    disable_session_recording: true, // open question #2: corp tool with PII on screen
    persistence: "localStorage+cookie", // open question #3: cookies on
    person_profiles: "identified_only",
    loaded: (ph) => {
      if (process.env.NODE_ENV !== "production") {
        ph.debug();
      }
    },
  });

  initialized = true;
  return posthog;
}

type Traits = Record<string, unknown>;

export const tracking = {
  identify(userId: string, traits: Traits & { $set_once?: Traits }) {
    const ph = init();
    if (!ph) return;
    const { $set_once, ...$set } = traits;
    ph.identify(userId, $set, $set_once);
  },

  group(type: "entity", key: string, traits: Traits) {
    const ph = init();
    if (!ph) return;
    ph.group(type, key, traits);
  },

  capture(event: string, properties?: Traits) {
    const ph = init();
    if (!ph) return;
    ph.capture(event, properties);
  },

  reset() {
    const ph = init();
    if (!ph) return;
    ph.reset();
  },
};
```

**Notes:**

- `autocapture: false` is deliberate. The tracking plan's `do_not_track` list rejects component-level UI noise; PostHog's autocapture would generate exactly that.
- `capture_pageview: false` because `module.viewed` is the canonical navigation event. Auto-pageviews would double-count.
- `person_profiles: "identified_only"` keeps anonymous person profiles out of PostHog (we don't have anonymous users — all traffic is logged-in staff).
- `disable_session_recording: true` for v1. Re-evaluate after open question #2 is signed off.
- `defaults: "2026-01-30"` opts into the modern PostHog defaults (SPA pageview tracking, cookieless flags, etc.) — only relevant if/when we toggle the booleans above.

---

## Complete Tracking Module — `apps/api/src/lib/tracking.ts`

```typescript
import { PostHog } from "posthog-node";

import { logger } from "@/common/utils/logger";

const isEnabled =
  process.env.NODE_ENV === "production" ||
  process.env.TELEMETRY_ENABLED === "1";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!isEnabled) return null;
  if (client) return client;

  const key = process.env.POSTHOG_API_KEY;
  const host = process.env.POSTHOG_HOST;
  if (!key || !host) {
    logger.warn("[tracking] posthog disabled — missing key/host");
    return null;
  }

  client = new PostHog(key, {
    host,
    flushAt: 20,
    flushInterval: 10_000,
  });
  return client;
}

type Properties = Record<string, unknown>;

export const tracking = {
  /** Server-side identify — fired from the snapshot-sync cron only. */
  identify(userId: string, traits: Properties) {
    const c = getClient();
    if (!c) return;
    c.identify({ distinctId: userId, properties: traits });
  },

  /** Server-side group identify — used by snapshot-sync to refresh headcount. */
  groupIdentify(type: "entity", key: string, traits: Properties) {
    const c = getClient();
    if (!c) return;
    c.groupIdentify({ groupType: type, groupKey: key, properties: traits });
  },

  /**
   * Server-side capture. `entityId` is required so we never accidentally
   * land an event outside group analytics.
   */
  capture(
    userId: string,
    event: string,
    properties: Properties,
    entityId: string | null,
  ) {
    const c = getClient();
    if (!c) return;
    c.capture({
      distinctId: userId,
      event,
      properties,
      groups: entityId ? { entity: entityId } : undefined,
    });
  },

  async shutdown() {
    if (!client) return;
    await client.shutdown();
    client = null;
  },
};
```

Wire shutdown in `apps/api/src/main.ts` next to the existing bootstrap:

```typescript
import { tracking } from "@/lib/tracking";

process.on("SIGTERM", async () => {
  await tracking.shutdown();
  process.exit(0);
});
process.on("SIGINT", async () => {
  await tracking.shutdown();
  process.exit(0);
});
```

---

## Server-side capture sites

### Approvals & manager flows — module service layer

`leave_request.approved`, `leave_request.rejected`, `expense.approved`, `travel_request.approved`, `payroll.run_started`, `payroll.run_completed`, `payroll.imported`, `role.assigned`, `role.revoked`, `lead.converted`, `deal.won`, `deal.lost`, `agreement.uploaded`, `agreement.downloaded`, `application.received`, `user.created`, `user.deactivated`.

Pattern (example for `leave.service.ts`):

```typescript
import { tracking } from "@/lib/tracking";

async function approveLeaveRequest(actorId: string, leaveRequestId: string) {
  const updated = await leaveRepository.approve(leaveRequestId, actorId);

  tracking.capture(
    actorId,
    "leave_request.approved",
    {
      leave_request_id: updated.id,
      approver_role: actor.primaryRole,
    },
    actor.entityId,
  );

  return updated;
}
```

### Errors — global handlers

**`form.validation_failed`** — append to the ZodError branch of `apps/api/src/core/middleware/error-handler.ts:66`:

```typescript
if (err instanceof ZodError) {
  logger.warn(`${req.method} ${req.path}`, { code: "VALIDATION_ERROR", issues: zodIssuesForLog(err) });
  if (req.user?.id) {
    tracking.capture(
      req.user.id,
      "form.validation_failed",
      {
        form: req.path.replace(/^\/api\//, "").split("/")[0] ?? "unknown",
        field_count: err.issues.length,
      },
      req.user.entityId ?? null,
    );
  }
  return res.status(422).json({ /* ... */ });
}
```

**`permission.denied`** — append to the failure branch of `requirePermission` at `apps/api/src/core/guards/auth.guard.ts:172`:

```typescript
if (!hasPermission) {
  tracking.capture(
    req.user.id,
    "permission.denied",
    {
      permission: requiredPermissions[0] ?? "unknown",
      route: req.path,
    },
    req.user.entityId ?? null,
  );
  return next(new ForbiddenException("Permission denied"));
}
```

### Snapshot-sync cron — new route

Append to `apps/api/src/modules/cron/cron.controller.ts`:

```typescript
import { telemetryService } from "@/modules/telemetry/telemetry.service";

router.post("/sync-telemetry", async (req, res, next) => {
  try {
    if (!verifyCronSecret(readSecret(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const data = await telemetryService.runSnapshotSync();
    res.json({ data });
  } catch (err) {
    next(err);
  }
});
```

`telemetryService.runSnapshotSync()` lives in a new module `apps/api/src/modules/telemetry/telemetry.service.ts`. It iterates the queries listed under `tracking-plan.yaml#snapshot_sync`, then fans out:

```typescript
import { tracking } from "@/lib/tracking";

async function runSnapshotSync() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const userSnapshots = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      entityId: true,
      _count: {
        select: {
          leaveRequests:    { where: { createdAt: { gt: since } } },
          expenseClaims:    { where: { submittedAt: { gt: since } } },
          ariaMessages:     { where: { createdAt: { gt: since } } },
        },
      },
    },
  });

  for (const u of userSnapshots) {
    tracking.identify(u.id, {
      leave_requests_30d: u._count.leaveRequests,
      expenses_30d: u._count.expenseClaims,
      aria_messages_30d: u._count.ariaMessages,
    });
  }

  const entitySnapshots = await prisma.entity.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      _count: { select: { users: { where: { isActive: true } } } },
    },
  });

  for (const e of entitySnapshots) {
    tracking.groupIdentify("entity", e.id, {
      code: e.code,
      name: e.name,
      headcount: e._count.users,
    });
  }

  await tracking.shutdown(); // flush before the cron container exits
  return { users: userSnapshots.length, entities: entitySnapshots.length };
}
```

Schedule it with Cloud Scheduler (per CLAUDE.md, coordinate with infra). Header: `X-Cron-Secret: ${CRON_SECRET}`. Frequency: `0 4 * * *` (daily at 04:00 SGT — quiet hours, well after the 02:00 backup window).

---

## Architecture

### Client vs Server

| Event category | Where it fires | Why |
|---|---|---|
| Lifecycle (`session.*`, `user.*`) | `session.started` web on identify; `user.created` / `user.deactivated` from api `employees.service.ts` | Server-confirmed lifecycle has no client trigger. |
| Navigation (`module.viewed`) | web — single `useEffect` in the dashboard layout | One source of truth, never per-page. |
| Funnel `*.started` | web — Dialog `onOpenChange(true)` | Pure client signal — no API call yet. |
| Funnel `*.submitted` | web — service layer after API success | Don't trust client state alone. |
| Funnel `*.cancelled` | web — Dialog `onOpenChange(false)` if no submit fired | Client-only by definition. |
| Approvals / admin / cron | api — module service after DB commit | Some flows have no UI for the actor (auto-approvals, cron). |
| Errors (`form.validation_failed`, `permission.denied`) | api — global error handler & `requirePermission` guard | Server is authoritative for rejection. |

### Queues and Batching

- **Browser:** `posthog-js` queues in memory and IndexedDB. Flushes on a timer + on `pagehide`. No additional batching logic needed.
- **Node:** `posthog-node` batches up to `flushAt: 20` events per request, and at most every `flushInterval: 10_000` ms (10 s). Events sent right before a Cloud Run instance scales to zero would normally be lost — handled by `await tracking.shutdown()` in SIGTERM and at the end of every cron handler.

No Sidekiq / BullMQ / Cloud Tasks. No outbound queue. The PostHog SDKs already do this.

### Shutdown / Flush

- Web: nothing to do — the SDK ships before unload via `pagehide`.
- API: SIGTERM / SIGINT handlers in `main.ts` (shown above).
- Cron: every cron handler that uses `tracking` must `await tracking.shutdown()` at the end of its run, before the response — Cloud Run kills the container as soon as the response is sent.

### Error Handling

PostHog SDK calls **never throw**. On network failure they retry asynchronously. `tracking.capture` returning means the SDK has accepted the event — not that the destination has it. Verify via the dashboard, not via return value.

If init fails (missing key, invalid host), the wrapper logs once and silently no-ops thereafter. There is no retry — config errors should fail loudly via the missing-event signal, not silently retry forever.

---

## Verification

### Confirming Delivery

1. **Live Events (PostHog dashboard):** Activity → Live Events. Real-time stream — events from the browser appear in 1-3 s, server events in 5-15 s (batched).
2. **Person view:** open the user's profile in PostHog → confirm traits set by `identify` are present and that `entity` group association exists.
3. **Group view:** open the `entity` group analytics → events should show under each TH/IN/VN/ID entity.
4. **Browser:** in dev, `posthog.debug()` is on (set by the `loaded` callback). The console prints every `capture` payload.
5. **Server:** events go through `posthog-node`'s internal logger; surface failures by setting `LOG_LEVEL=debug` for the api service.

### Expected Latency

| Source | Latency |
|---|---|
| Browser `capture` | 1-3 s to Live Events |
| Server `capture` | 5-15 s (batched at `flushAt: 20` or every 10 s) |
| Server `capture` immediately followed by `shutdown()` | < 1 s flush |

### Success vs Failure

`posthog-node` uses HTTP 200 / 207 from `https://*.i.posthog.com/batch/`. Failures retry up to 3 times then drop. In the api logs, a 4xx from PostHog usually means the project key is wrong; a sustained 5xx is a PostHog incident.

The browser SDK is more forgiving — it persists to IndexedDB and retries indefinitely across sessions.

### Development testing

- `NEXT_PUBLIC_TELEMETRY_ENABLED=1` (web) and `TELEMETRY_ENABLED=1` (api) opt staging into telemetry **but only against a separate "Intranet — Staging" PostHog project**. Use a different `NEXT_PUBLIC_POSTHOG_KEY` per environment.
- For local dev, leave `NODE_ENV=development` and the opt-in flags **unset** — every `tracking.*` call is a no-op. Add a one-off `NEXT_PUBLIC_TELEMETRY_ENABLED=1` in `apps/web/.env.development` if you want to drive a local smoke test against a personal sandbox project.
- **Never** point dev at the production PostHog project. The CLAUDE.md gate enforces this for prod (NODE_ENV gate) but doesn't stop a dev who exports the prod key locally — the separate staging project is the durable safeguard.

---

## Rollout Strategy

Phased per the open-question section. The skill recommends asking the user; default plan if not asked:

1. **Development (week 0):** wire the SDK + `tracking.ts` modules. Verify identify + group + a single `module.viewed` in a personal PostHog sandbox.
2. **Staging (week 1):** ship `apps/web/src/lib/tracking.ts`, `apps/api/src/lib/tracking.ts`, the auth-provider hook, the dashboard `module.viewed`, and the snapshot-sync cron. Run with `TELEMETRY_ENABLED=1` against a staging project. Confirm DAU + module breakdown shapes match the ~50-user expectation.
3. **Production gradual (week 2):**
   - Day 1: enable identify + group + lifecycle + `module.viewed` only. Verify in dashboard.
   - Day 3: enable funnel events for Leave + Aria (the two modules with the highest expected traffic).
   - Day 5: enable funnel events for Expenses + Travel + Messaging.
   - Day 7: enable everything else (long-tail modules — Survey, Learning, Visa, Benefits, Careers, Legal, HRMS).
4. **Monitoring (ongoing):** check PostHog Activity → Live Events daily for the first week. Watch for: any PII appearing in event properties (it shouldn't), unexpected high-volume events (especially `task.status_changed` — see open question #4), missing `entity` group on any event.

If the user prefers everything-at-once, skip the gradual cutover and ship phase 2 + 3 in a single PR.

---

## SDK-Specific Constraints

- **`autocapture: false` is non-negotiable.** Autocapture would generate exactly the noise the tracking plan rejects.
- **`capture_pageview: false` is non-negotiable.** `module.viewed` is the canonical nav event. Auto-pageviews would double the volume and obscure the module signal.
- **Web is stateful, api is stateless** for groups. Do not pass `$groups` from the client; do pass `groups` from the server.
- **Group analytics is a paid add-on on PostHog Cloud above the free tier.** Confirm with the project owner before relying on entity rollups in dashboards. At ~50 users we are well inside the free tier event quota (1M events/month).
- **Person profiles `identified_only`** — anonymous events would not be retained even if they fired. Acceptable since every Intranet user is logged in.
- **PostHog ignores non-string property values silently in some filters.** Stick to types the YAML declares (string / number / boolean / datetime ISO 8601).
- **Reserved property names:** `$set`, `$set_once`, `$groups` only. Don't mint custom `$`-prefixed props.

---

## Open Questions — Resolved Recommendations

1. **Reverse proxy** → **Yes**, ship the `/ingest/*` rewrites in `next.config.ts`. Adblockers are common; latency cost is one extra Vercel/Cloud Run hop and is irrelevant for this volume.
2. **Session replay** → **Off** for v1 (`disable_session_recording: true`). Internal HR + payroll tool with PII on screen. Re-evaluate only with HR + Legal sign-off and only with strict masking.
3. **Cookies vs cookieless** → **Cookies** (`persistence: "localStorage+cookie"`). Internal corporate tool, SSO already implies a session cookie, no consent banner required for first-party analytics on a logged-in app.
4. **Debouncing `task.status_changed`** → **No client-side debounce.** Fire only after the API confirms each move; bulk responses fan out 1:1. Optimistic UI changes that revert on error must NOT fire.

Owner-side questions still open (per `delta.md`):

- ~~Confirm PostHog Cloud (US vs EU).~~ **Resolved 2026-05-08: US Cloud, project 415423.**
- Retention window — set at project creation. Recommend 1y, override to 2y on request.
- Consent / disclosure — single line in the employee handbook + sign-off from HR & Legal before flipping the prod gate.

---

## Coverage Gaps

- **No Plan-mode docs for streaming Aria responses.** `aria.response_received` is the right name, but if Aria streams tokens word-by-word, capture must fire **once at completion**, not per chunk. Implementation phase: confirm by reading `apps/api/src/modules/aria/aria.service.ts` before instrumenting.
- **`session.ended` fires on voluntary logout only.** No tab-close detection. PostHog's `pagehide` capture is on but unrelated. If duration analytics are needed for idle/tab-close, revisit in v2.
- **No mobile / native client.** The reference assumes browser + Node. If a React Native app ships later, swap to `posthog-react-native` and re-do the web init block.

---

## Next phase

Run **product-tracking-implement-tracking** to generate real instrumentation code from this guide. Before kicking it off:

1. Copy `tracking-plan.yaml`, `product.md`, `delta.md` from worktree `intelligent-engelbart-75728b` into this worktree's `.telemetry/` so the implementation skill can read them.
2. Confirm PostHog region (US vs EU) and project key with the owner.
3. Decide phased vs all-at-once rollout.
