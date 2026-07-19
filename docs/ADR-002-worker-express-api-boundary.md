# ADR-002 — Worker / Express API boundary and loop protection

**Status:** Proposed (P0-E4 draft)  
**Date:** 2026-07-19

## Context

The Cloudflare Worker (`apps/edge`) is the public front door for Expo Static
Assets and `/api/*`. Many routes still proxy to Express (`apps/api`) via
`API_ORIGIN` until Hyperdrive dual-path ownership is honest for that module.

Preview/production previously committed `API_ORIGIN` to the same public Worker
hosts (`app.manut.xyz` / `preview.manut.xyz`). That topology can recurse
(Worker → Worker) instead of reaching Express, and today `app.manut.xyz` is
also unresolvable (Cloudflare 530 Origin DNS on proxied `/api` — health alone
is not readiness). DNS cutover remains a separate ops approval.

## Decision

1. **`API_ORIGIN` must be a distinct Express service origin** per environment
   (scheme + host[+port][+optional path prefix]). It must never equal the
   incoming Worker request host (including default HTTPS port / hostname case).
2. **Fail closed** when `API_ORIGIN` is empty, unsafe (non-HTTPS except exact
   loopback), or self-proxying. Codes: `API_ORIGIN_NOT_CONFIGURED`,
   `API_ORIGIN_SELF_PROXY`.
3. **Hop marker:** the Worker sets reserved `x-manut-proxy-hop: 1` on outbound
   Express proxy requests and rejects any inbound request that already carries
   that header (`API_PROXY_HOP_LOOP`). This is not cryptographic request
   signing; signing would need a separate ADR (keys, canonicalization, replay,
   rotation, Express verification).
4. **Client API base paths:** hosted web uses same-origin `/api`; native uses
   an HTTPS Worker origin plus `/api`; app-core endpoint paths stay relative
   beneath that base. Direct Expo → Express is allowed only as a local focused
   test, never as release evidence.
5. **Do not invent** Express hostnames, Hyperdrive ids, or DNS records in git.
   Committed wrangler preview/production `API_ORIGIN` stays empty until ops
   binds a real distinct origin.

## Consequences

- Proxied `/api` fails closed (503) until ops provisions Express and sets
  `API_ORIGIN` — preferred over silent hop-loops or 530 Origin DNS.
- `TRUSTED_STORAGE_ORIGINS` may still list public Worker hosts for R2 receipt
  provenance; that is not a proxy target.
- Production Workers Builds pause / cutover marker (P0-E4-T7) remains an
  **explicit ops dashboard action** — not performed by this ADR.

## Related

- Implementation: `apps/edge/src/api-proxy.ts`, tests in
  `apps/edge/tests/api-proxy-topology.test.ts`
- Ops runbooks: `docs/CICD_CLOUDFLARE.md`, `docs/PRODUCTION_DEPLOY.md`
- Auth trust: `docs/ADR-003-auth-trust-model.md`
