# Parity hardening (Phase 8)

Gate checklist before founder UAT on staging. Run locally / in CI where noted.
Staging provision (Hyperdrive, R2, KV, Queues) is a **founder blocker** — scripts
and checklists land here; live ticks wait on Cloudflare account access.

## Scripts

| Script | Purpose |
|---|---|
| `node scripts/route-parity.mjs` | Express controller verbs vs Hono handlers |
| `pnpm db:drizzle:parity` | Schema parity (Prisma vs Drizzle migrate) |
| `node packages/db/scripts/migrate-supabase-auth.mjs --dry-run` | Auth credential import dry-run |
| `node packages/db/scripts/migrate-storage.mjs --dry-run` | Storage URL inventory + rewrite plan |
| `pnpm test:e2e` | Playwright (`e2e/`) — point `BASE_URL` at staging edge |

```bash
# Route coverage snapshot (writes docs/parity/route-parity-latest.json)
pnpm route-parity

# Fail CI when below threshold (raise PARITY_MIN_RATIO toward 1.0)
PARITY_MIN_RATIO=0.65 pnpm route-parity -- --fail
```

## Checklist

- [ ] Route parity ratio ≥ current threshold; triage top Express-only modules
- [ ] Schema parity PASS on throwaway Postgres pair
- [ ] Auth migration dry-run against staging snapshot
- [ ] Storage inventory dry-run; rclone recipe reviewed
- [ ] Playwright: auth, leave smoke, PWA, a11y, responsive (BASE_URL=edge staging)
- [ ] Forced edge-jobs tick once per cron name (idempotent)
- [ ] Workers Logs + Logpush + DLQ alert wired
- [ ] Security review: Better Auth, RBAC, Turnstile, R2 private keys, HMAC (DocuSign when live)
- [ ] Founder UAT sign-off — **NOT READY** until CF staging is provisioned

## Retired on edge (allowlist)

- Legacy socket.io → Durable Object WebSocket (`messages`)
- Cloud Scheduler → `apps/edge-jobs` Cron Triggers + Queue fan-out
