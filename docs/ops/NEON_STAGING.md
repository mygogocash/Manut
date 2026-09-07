# Neon staging (APAC) — greenfield Hyperdrive

**Region:** `ap-southeast-1` (AWS)  
**DB name:** `neondb`  
**Ledger:** Drizzle-only (`drizzle.__drizzle_migrations`) — do **not** run Prisma migrate on this database.  
**Data:** greenfield (empty business data; seed Better Auth users separately).

## Connection strings

Neon gives two URLs. Map them like this:

| Neon label | Use for | Depot / local env |
|---|---|---|
| **Unpooled** (`ep-….aws.neon.tech`, no `-pooler`) | Drizzle migrate, bootstrap, Hyperdrive origin | `STAGING_DIRECT_URL` / `DIRECT_URL` |
| **Pooled** (`ep-…-pooler.…`) | Optional direct app use (not Hyperdrive) | `STAGING_DATABASE_URL` if needed |

Strip `channel_binding=require` for Workers / `postgres.js` / Hyperdrive. Keep `sslmode=require`.

Hyperdrive already pools — point it at the **unpooled** Neon URL so you do not double-pool.

## One-time schema bootstrap (already done on this project)

On an empty Neon DB:

```bash
cd packages/db
DATABASE_URL="$STAGING_DIRECT_URL" pnpm db:bootstrap-greenfield
DATABASE_URL="$STAGING_DIRECT_URL" pnpm db:migrate
# second migrate must be a no-op
DATABASE_URL="$STAGING_DIRECT_URL" pnpm db:migrate
```

`db:bootstrap-greenfield` applies the commented `0000_*` DDL **without** editing the file on disk (preserves baseline hashes for existing Supabase DBs). It rewrites known bad introspect defaults (`{"RAY"}`, wrong index opclasses).

Do **not** run `db:migrate-auth` / `migrate-supabase-auth.mjs` — Neon has no `auth.users`.

## Hyperdrive (founder — needs `CLOUDFLARE_API_TOKEN`)

```bash
cd apps/edge
npx wrangler hyperdrive create staging-manut-edge-neon \
  --connection-string "$STAGING_DIRECT_URL"
```

Paste the returned `id` into:

- `apps/edge/wrangler.jsonc` → `env.staging.hyperdrive[0].id`
- `apps/edge-jobs/wrangler.jsonc` → same

Replace `REPLACE_WITH_STAGING_HYPERDRIVE_ID`.

Set Depot secret `STAGING_DIRECT_URL` to the same unpooled Neon URL (CI migrate step in `deploy-edge-staging.yml`).

## Seed users

Create Better Auth users via seed / admin after Hyperdrive is wired — no Supabase Auth import.

## PR database branches (Depot)

Workflow: `.depot/workflows/neon-pr-branches.yml` (Neon’s Create/Delete Branch template, Depot runners).

| Event | Action |
|---|---|
| PR opened / reopened / synchronize | Create (or reuse) Neon branch `preview-pr-<n>-<git-branch>` (≤63 chars), expire +14d, run `pnpm --filter @nexora/db db:migrate` **twice** on the **unpooled** URL |
| PR closed | Delete that Neon branch |

Parent is the Neon project primary (already bootstrapped). Do **not** run `db:bootstrap-greenfield` on PR branches.

### Depot secrets / vars

| Name | Kind | Notes |
|---|---|---|
| `NEON_API_KEY` | secret | Neon console → Account → API keys |
| `NEON_PROJECT_ID` | variable | Neon console → Project settings → Project ID (`proj_…`) |

Parent is always the Neon project primary. If you need a non-default parent, add `parent_branch` to the create step in the workflow.

If either `NEON_PROJECT_ID` or `NEON_API_KEY` is missing, the workflow no-ops with a notice (same pattern as unset `CLOUDFLARE_API_TOKEN` on staging deploy).

Schema-diff PR comments (`neondatabase/schema-diff-action`) are commented out in the workflow; enable when you want review noise and add `pull-requests: write`.

## Security

If a Neon password was pasted into chat or a ticket, **rotate it in the Neon console** and update Hyperdrive + Depot secrets.
