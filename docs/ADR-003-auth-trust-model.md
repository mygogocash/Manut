# ADR-003 — Application session vs Cloudflare Access trust

**Status:** Proposed (P0-E4 draft)  
**Date:** 2026-07-19

## Context

Clients present an application session as:

- **Web:** HTTP-only `manut_access_token` cookie (same-origin mutations)
- **Native:** Bearer token in SecureStore (PKCE session)

The Worker extracts that credential and currently verifies JWTs with
`AUTH_JWKS_URL` / `AUTH_ISSUER` / `AUTH_AUDIENCE` via `jose`. Deployment docs
have historically described those vars as “Cloudflare Access JWKS,” which
conflates two different trust domains:

1. **Application session issuer** — Manut-issued access tokens used for RBAC
2. **Cloudflare Access** — optional outer network/identity gate (team JWKS,
   AUD tag) that never replaces application permissions

Access JWKS values are **not** claimed set in this repository; empty
`AUTH_*` vars fail closed (`AUTH_*_NOT_CONFIGURED`).

## Decision

1. **Authoritative identity for product authorization** is the application
   session (cookie or bearer). Express always revalidates identity,
   permissions, ownership, and state transitions — Worker checks never grant
   access alone.
2. **Worker `AUTH_JWKS_URL` / `AUTH_ISSUER` / `AUTH_AUDIENCE`** must point at
   the **application session issuer** once provisioned (not invented in git).
   Until then, protected routes fail closed.
3. **Cloudflare Access**, if enabled later, is an **independent additional
   policy layer** in front of the Worker. It must not substitute for
   application RBAC, and Access assertions must not be treated as
   `manut_access_token` without an explicit follow-up ADR that defines claim
   mapping and dual-verification.
4. Cookie-authenticated unsafe methods and WebSocket upgrades continue to
   require same-origin `Origin` (Worker CSRF boundary).

## Consequences

- Docs and runbooks must not imply Access JWKS is live merely because var
  names exist in `wrangler.jsonc`.
- Integrating Access as outer gate is ops + a follow-up engineering slice;
  this ADR only freezes the trust separation for P0.
- Session issuer provisioning (JWKS URL, issuer, audience) remains
  **ops-owned** and environment-specific.

## Related

- Worker verify path: `apps/edge/src/auth.ts`
- Topology / proxy: `docs/ADR-002-worker-express-api-boundary.md`
- Deploy checklist: `docs/PRODUCTION_DEPLOY.md`, `docs/CICD_CLOUDFLARE.md`
