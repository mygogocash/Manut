# Authentication and RBAC

> **Current-state reference.** Sole forward identity/auth roadmap:
> [`docs/EXPO_CLOUDFLARE_MASTER_PLAN.md`](./EXPO_CLOUDFLARE_MASTER_PLAN.md)
> (esp. §6). This file describes present Supabase/Express/session behavior to
> preserve during the strangler; it is not the target design.

## One domain contract, two session transports

`packages/app-core` owns authentication state transitions and redirect policy.
The Expo app injects a platform transport:

- Web uses secure HTTP-only cookies through the same-origin `/api` gateway.
- Android and iOS use bearer sessions stored with Expo SecureStore.

The service-role key never enters app code, browser bundles, native bundles,
Playwright artifacts, or storage-state files.

## Session verification

`/auth/me` results are classified, not treated as one generic failure:

- `401` or `403`: clear identity, roles, permissions, and protected state.
- Network failure, `429`, or any other HTTP failure: preserve an already
  authenticated UI and expose `sessionVerificationError` with `refreshUser()`.
- Cold-start transient failure: show a retry panel and render no protected
  content until verification succeeds.

This avoids logging an employee out during a short edge/API interruption while
still failing closed when the server says the session is invalid.

## Login and deep links

`login(email, password, returnTo?)` uses replacement navigation after success.
Only same-origin paths beginning with one `/` are accepted; absolute URLs,
protocol-relative values, encoded authority tricks, and control characters are
rejected. The destination order is:

1. required password change;
2. validated return path, including its query string;
3. employee portal default;
4. dashboard.

Unauthenticated guards store the full pathname and search string.

## Route authorization

Client route policy uses an explicit leaf-route registry, never sidebar
membership. Resolution order is explicit override, exact path, then longest
segment-boundary prefix. `/foo` cannot authorize `/foobar`. Employee users may
open Performance when they hold its permission.

The client guard improves navigation and prevents accidental protected renders;
it is not an authorization boundary. API middleware and service ownership checks
remain authoritative.

## E2E gate

The suite creates confirmed admin and employee personas server-side with random
passwords, seeds only the minimal entity/RBAC/leave records, authenticates once
per persona into ignored storage state, runs one Chromium worker with one retry,
and deletes users afterward. Any retry is treated as flaky and fails the gate.
