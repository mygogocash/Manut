# P0 ops topology checklists

Ops-owned checklist pack for Worker ↔ Express topology, application-session
JWKS, preview isolation, and first-admin bootstrap. **No secret values** belong
in this file or in git — set names and shapes only; store real values in
Cloudflare / GitHub Environments / private cutover records.

Binding decisions:

- `docs/ADR-002-worker-express-api-boundary.md` — distinct `API_ORIGIN`,
  fail-closed self-proxy / hop-loop
- `docs/ADR-003-auth-trust-model.md` — application session vs optional Access

Companion runbooks: `docs/CICD_CLOUDFLARE.md`, `docs/PRODUCTION_DEPLOY.md`,
`docs/CLOUDFLARE_BINDINGS.md`.

## Live probe snapshot (status codes only)

Probed 2026-07-19 from a clean agent environment. Values are HTTP status codes
(or DNS failure). No response bodies, tokens, or headers with credentials.

| Target                                                         | Status   | Notes                                              |
| -------------------------------------------------------------- | -------- | -------------------------------------------------- |
| `https://manut.bettergogocash.workers.dev/health`              | **200**  | Production Worker `manut` reachable                |
| `https://manut.bettergogocash.workers.dev/api/health`          | **401**  | Proxied/auth path not anonymous-ready              |
| `https://manut-preview.bettergogocash.workers.dev/health`      | **404**  | Isolated preview Worker not serving expected route |
| `https://manut-preview.bettergogocash.workers.dev/api/health`  | **404**  | Same — preview deploy/isolation incomplete         |
| `https://preview.manut.xyz/health`                             | **200**  | Custom domain responds; must not share prod Worker |
| `https://preview.manut.xyz/api/health`                         | **401**  | Same auth posture as production `/api/health`      |
| `https://app.manut.xyz/health`                                 | **DNS**  | Host does not resolve (cutover unauthorized)       |
| `https://app.manut.xyz/api/health`                             | **DNS**  | Same                                               |

Re-probe before claiming isolation or cutover. Health `200` alone is not
`/api` readiness (ADR-002).

---

## 1. Distinct `API_ORIGIN` per environment

`API_ORIGIN` is the **Express service origin** the Worker proxies to. It must
never equal the public Worker host for that environment.

| Environment | Worker service   | Public Worker host (not `API_ORIGIN`)                         | `API_ORIGIN` rule                                      |
| ----------- | ---------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| production  | `manut`          | `manut.bettergogocash.workers.dev` (+ `app.manut.xyz` later)  | Distinct HTTPS Express origin for production only      |
| preview     | `manut-preview`  | `manut-preview.bettergogocash.workers.dev`                    | Distinct HTTPS Express origin for preview only         |
| staging     | `manut-staging`  | staging workers.dev (when provisioned)                        | Distinct HTTPS Express origin for staging only         |

### Checklist

- [ ] Committed `wrangler.jsonc` preview/production `API_ORIGIN` remains `""`
      until a real Express origin exists (fail closed:
      `API_ORIGIN_NOT_CONFIGURED`).
- [ ] Ops sets preview `API_ORIGIN` to a **preview-only** Express base URL
      (scheme + host[+port][+optional path prefix]).
- [ ] Ops sets production `API_ORIGIN` to a **production-only** Express base
      URL — never reused from preview/staging.
- [ ] Neither value equals its Worker request host (including default `:443`
      / hostname case). Self-proxy → `API_ORIGIN_SELF_PROXY`.
- [ ] `TRUSTED_STORAGE_ORIGINS` may list public Worker hosts for R2 receipt
      provenance; that list is **not** a proxy target.
- [ ] No Express hostnames invented in git; private cutover record holds the
      real origins.
- [ ] After set: unauthenticated `/api/*` that still proxies returns honest
      Express/auth failures — not Worker hop-loop (`API_PROXY_HOP_LOOP`) or
      Cloudflare 530 Origin DNS from Worker→Worker recursion.

### Anti-patterns

- `API_ORIGIN=https://app.manut.xyz` or `https://preview.manut.xyz`
- `API_ORIGIN=https://manut.bettergogocash.workers.dev` (or preview twin)
- Sharing one Express origin across preview and production

---

## 2. Application-session `AUTH_JWKS_*` (not Access)

Per ADR-003, Worker vars verify the **Manut application session** issuer:

| Worker var      | Meaning (once provisioned)                                      |
| --------------- | --------------------------------------------------------------- |
| `AUTH_JWKS_URL` | JWKS URL for application access tokens                          |
| `AUTH_ISSUER`   | Issuer claim expected on those tokens                           |
| `AUTH_AUDIENCE` | Audience claim expected on those tokens                         |

Empty vars fail closed (`AUTH_*_NOT_CONFIGURED`). Cloudflare Access, if added
later, is an **independent outer gate** — do not point these three vars at
Access team JWKS unless a follow-up ADR defines dual-verification.

### Checklist

- [ ] Provision a Manut-owned application-session issuer per environment
      (preview ≠ production).
- [ ] Set Worker `AUTH_JWKS_URL` / `AUTH_ISSUER` / `AUTH_AUDIENCE` for
      `manut-preview` and `manut` separately (dashboard / wrangler vars —
      values stay out of git).
- [ ] Confirm Express still revalidates identity, roles, permissions, and
      ownership; Worker JWT checks never grant product access alone.
- [ ] Do **not** mark “Access JWKS done” on the first-green checklist until
      Access is intentionally enabled as an outer policy (separate work).
- [ ] Cookie unsafe methods + WebSocket upgrades keep same-origin `Origin`
      enforcement (Worker CSRF boundary).

### Shape examples (placeholders only)

```text
AUTH_JWKS_URL=https://<session-issuer-host>/.well-known/jwks.json
AUTH_ISSUER=https://<session-issuer-host>
AUTH_AUDIENCE=<application-audience>
```

---

## 3. Isolate `manut-preview` from production Worker `manut`

Durable Object migrations require a **full deploy** to a separate Worker name.
Preview must never overwrite production.

| Concern              | Required posture                                                         |
| -------------------- | ------------------------------------------------------------------------ |
| Wrangler env name    | `env.preview.name = "manut-preview"` (never `"manut"`)                   |
| Deploy owner         | GitHub Actions `deploy-preview.yml` → `wrangler deploy --env preview`    |
| Production owner     | Cloudflare Workers Builds on `main` → Worker `manut` only                |
| Custom domain        | `preview.manut.xyz` only on `manut-preview`, and only after approval     |
| Secrets / vars       | Unique `EDGE_SIGNING_KEY`, `API_ORIGIN`, `AUTH_*`, R2 bucket per env     |
| Native Builds        | Non-production Workers Builds disabled after preview token validation    |

### Checklist

- [ ] Dashboard confirms Worker **`manut-preview`** exists separately from
      **`manut`**.
- [ ] Preview ensure + deploy targets `manut-preview` only (build log names
      that service).
- [ ] `https://manut-preview.bettergogocash.workers.dev/health` returns **200**
      with `{ "service": "manut", "status": "ok" }` (today: **404** — deploy
      still required).
- [ ] Custom domain `preview.manut.xyz` is **not** attached to production
      `manut`. If it currently answers like production while
      `manut-preview.*.workers.dev` is 404, treat that as an isolation defect
      and fix before cutover claims.
- [ ] Preview R2 / Queues / DO / Hyperdrive bindings use preview-unique names
      from `wrangler.jsonc` (see `docs/CLOUDFLARE_BINDINGS.md`).
- [ ] Production Workers Builds pause / fail-close until cutover marker
      (P0-E4-T7) — dashboard action, not git. Exact steps:
      `docs/CICD_CLOUDFLARE.md` § P0-E4-T7; fail-closed marker
      `docs/ops/markers/p0-e4-t7-workers-builds-pause.md` (live check
      2026-07-19: Builds still **enabled**).
- [ ] Cloudflare Pages auto-deploy remains off.

---

## 4. First-admin bootstrap prerequisites

The clean Prisma seed creates entity + system roles (**Admin**, **Employee**)
and **no users** (`packages/database/prisma/seed.ts`). Authenticated
`user:create` APIs require an existing principal — so the first administrator
is an **ops out-of-band** step on Manut-owned identity + Postgres. Public
recovery / magic-link flows never auto-provision users
(`docs/ops/auth-recovery-fraud-prevention.md`).

### Prerequisites (all true before inviting the first human admin)

- [ ] Manut-owned Postgres migrated (`prisma migrate deploy` on an admin path).
- [ ] Clean seed applied: `pnpm db:seed` → entity + Admin/Employee roles only
      (no credential or identity seed in git).
- [ ] Express runtime has Manut-owned identity Admin API credentials
      (server-only; never client / Expo / Playwright storage). Names only in
      `.env.example` — values in private ops store.
- [ ] Worker topology for that env: distinct `API_ORIGIN` (checklist 1) and
      application-session `AUTH_*` (checklist 2), or accept fail-closed
      protected routes until set.
- [ ] Preview isolation complete if bootstrapping against preview (checklist 3).
- [ ] Dedicated E2E project credentials are **not** reused for production or
      preview first-admin (E2E deletes runtime users; wrong project fails the
      harness guard).

### Bootstrap steps (ops; no passwords in git)

1. Create the identity-provider user with a **confirmed** email and a
   one-time password generated in a password manager (not committed, not
   pasted into tickets or chat).
2. Insert the matching `User` row in Postgres (`id` = identity subject id,
   active, `mustChangePassword: true`, Manut entity).
3. Attach the system **Admin** role (`user_roles` → role name `Admin`,
   `isSystem: true`). Admin implies the full registered permission set at
   runtime (see auth permission resolution).
4. Sign in once via the public login UI; complete forced password change.
5. From that session, create subsequent users only through authorized
   `user:create` / invite paths — never share the service-role key with the
   browser.
6. Record completion privately (HMAC of email / ticket id). Do not commit
   emails, passwords, or service-role material.

### Explicit non-goals

- No first-admin identity seed in the repository baseline.
- No inventing Hyperdrive ids, DNS records, or Access AUD tags in git.
- No claiming production traffic cutover from this checklist alone.
