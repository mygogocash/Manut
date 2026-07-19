# ADR-009 — `/ingest/*` telemetry proxy (draft)

**Status:** Proposed (pending product + security decision)  
**Date:** 2026-07-19  
**Related plan tasks:** P0-E4-T8, P2-E6-T6, P7-E2-T4; risk R-017

## Context

Legacy Next.js (`apps/web/next.config.ts`) rewrites same-origin `/ingest/*` to
a third-party analytics ingestion host (PostHog US Cloud assets / decide /
events). Client initialization lives in `apps/web/src/lib/tracking.ts` and is
gated on public env keys; signing-token URLs are excluded from capture.

Expo + Cloudflare Worker delivery does **not** yet provide an equivalent
same-origin `/ingest/*` proxy. Silently dropping analytics while product
dashboards still rely on PostHog would corrupt usage evidence. Shipping a proxy
without a privacy/consent contract would also be unsafe.

This ADR does **not** authorize enabling production telemetry, inventing
provider project keys, or changing DNS.

## Decision options (choose one — not yet selected)

### Option A — Retain (Worker same-origin proxy)

1. Cloudflare Worker serves `/ingest/*` rewrites (or fetch proxy) to the
   approved analytics ingestion origin only.
2. Expo web uses the same-origin host; native either disables product analytics
   or uses an explicitly approved mobile SDK path (separate follow-up).
3. Fail closed when the analytics origin/env is unset (no silent drop while
   product still expects events).
4. Preserve signing-URL redaction / no-capture invariants from the Next tracker.
5. Document retention, consent, and PII minimization before cutover.

### Option B — Remove

1. Product + security approve retirement of product analytics for the Expo cutover.
2. Remove Next `/ingest` rewrites, tracker initialization, and admin PostHog
   activity sources that depend on it (or replace with audit-log-only).
3. Confirm no retained dashboard or health check still requires PostHog events.
4. Record `removed-approved` evidence; do not leave a half-dead `/ingest` stub.

### Option C — Replace with a different vendor/contract

Out of scope until Options A/B are rejected with a written replacement brief.

## Current interim posture (product-safe default)

- **No Expo/Worker `/ingest/*` implementation in this prep slice.**
- Next retains its existing proxy for the legacy surface only.
- Decision remains **PENDING** — do not assume retain or remove.
- Until ADR status becomes Accepted, treat `/ingest/*` as an open cutover
  dependency, not as retired.

## Consequences once accepted

- **If A:** Worker tests must cover proxy routing, fail-closed missing config,
  and signing-path non-capture; env names land in `.env.example` without values.
- **If B:** Ledger/handoff record the removal; admin usage sources that cite
  PostHog must be updated or gated off.
- Either path updates `docs/ROUTE_DISPOSITION.md` / handoff in the same change
  window as the implementation PR.

## Related

- Legacy rewrites: `apps/web/next.config.ts`
- Legacy tracker: `apps/web/src/lib/tracking.ts`
- Retirement plan risks: R-017 (`docs/EXPO_NEXTJS_RETIREMENT_PLAN.md` when present)
- Auth trust: `docs/ADR-003-auth-trust-model.md`
