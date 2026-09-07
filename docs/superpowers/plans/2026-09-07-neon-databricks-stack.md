# Plan: Neon (Hyperdrive) + Databricks ERP lakehouse

**Date:** 2026-09-07  
**Status:** Draft — implement after founder sign-off on phases below  
**Credits:** ~$1k Neon + ~$1k Databricks  
**Out of scope:** Marketing / BNII / OneWave analytics (explicitly excluded)

---

## Goal

1. **Neon** becomes the staging (then optionally prod) Postgres behind Cloudflare Hyperdrive — branchable, migrate-deployable, Hyperdrive-safe.
2. **Databricks** becomes an offline ERP lakehouse (CDC/export → Delta → SQL warehouse) for HR/Finance/CRM reporting, ARIA batch, and audit — never on the Worker hot path.
3. **D1** stays Worker-local sidecar only (`edge_presence`, `edge_workflow_instances`, `edge_handbook_chunks`). No ERP tables on D1.

---

## Non-goals

- Replacing D1 with Neon or Databricks
- Putting leave/users/CRM on D1
- Marketing / BNII pipelines on Databricks
- Querying Databricks from `apps/edge` request handlers
- Immediate prod Postgres cutover (staging first; prod is a later gate)

---

## Current state (baseline)

| Layer | Today | Target |
|---|---|---|
| Edge OLTP | Hyperdrive → Supabase Postgres (IDs still `REPLACE_WITH_*` in wrangler) | Hyperdrive → **Neon** (staging first) |
| Staging schema apply | Depot `deploy-edge-staging.yml` → Drizzle migrate via `STAGING_DIRECT_URL` | Same CI path; secret points at Neon direct |
| Prod schema apply | Drizzle + Prisma `migrate deploy` | Unchanged until prod Neon gate |
| Auth (edge) | Better Auth + KV sessions | Unchanged; staging users seeded without Supabase `auth.users` |
| Auth (Express legacy) | Supabase JWT | Leave alone until Phase 9 decommission |
| D1 | Sidecar 3 tables | Unchanged |
| Analytics warehouse | None in-repo | Databricks Delta + SQL warehouse |
| Jobs | `apps/edge-jobs` cron → `/api/cron/*` | Add export/CDC job(s) behind same pattern |

Authoritative wiring: `apps/edge/wrangler.jsonc`, `.depot/workflows/deploy-edge-staging.yml`, `docs/ops/CLOUDFLARE_PROVISIONING.md`, ADR `docs/adr/0001-cloudflare-edge-rewrite.md`.

---

## Architecture

```
Expo SPA → Workers (Hono)
              ├─ Hyperdrive ──► Neon Postgres          ← ERP SoT (Drizzle)
              ├─ D1                                      ← sidecar only
              ├─ KV / DO / Queues / Workflows / R2
              └─ (no Databricks binding)

edge-jobs / Depot batch ──► Neon (read) ──► Databricks (Delta)
                                              └─ SQL warehouse / notebooks
```

**Rule:** Neon = transactional truth for the app. Databricks = derived, rebuildable analytics.

---

## Phase 0 — Decisions (sign-off before coding)

| # | Decision | Recommendation | Owner |
|---|---|---|---|
| D1 | Neon region | Closest to Workers + Hyperdrive (APAC / Singapore-class) | Founder |
| D2 | Staging ledger | **Drizzle-only** on Neon staging (`drizzle.__drizzle_migrations`). Do not also run Prisma history on the same Neon DB. | Eng |
| D3 | Prod Neon timing | After Better Auth cutover rehearsal is green on staging | Founder |
| D4 | First Databricks domain slice | `core` + `rbac` + leave/travel/expense/cash-advance + sales-crm + shared projects | Eng |
| D5 | CDC mechanism v1 | Nightly **snapshot export** (SQL → Parquet/CSV → volume) before true logical CDC | Eng |
| D6 | pgvector on Neon | Enable if ARIA embedding tables are restored to staging | Eng |

---

## Phase 1 — Neon staging project + Hyperdrive

**Outcome:** `staging.manut.xyz` Workers talk to Neon via Hyperdrive; Depot migrate uses Neon direct URL.

### 1.1 Provision (manual / founder)

1. Create Neon project (APAC) + `staging` database + role.
2. Enable extensions needed by schema (at least whatever `0000` / ARIA need — **pgvector** if embeddings tables are included).
3. Copy connection strings:
   - **Direct** → Depot secret `STAGING_DIRECT_URL` (migrations / DDL)
   - **Pooled** (or Neon Hyperdrive-recommended URL) → Hyperdrive create

```bash
# From apps/edge — see docs/ops/CLOUDFLARE_PROVISIONING.md
npx wrangler hyperdrive create staging-manut-edge-neon \
  --connection-string "<neon-hyperdrive-compatible-url>"
```

4. Paste Hyperdrive id into `apps/edge/wrangler.jsonc` and `apps/edge-jobs/wrangler.jsonc` staging env (replace `REPLACE_WITH_STAGING_HYPERDRIVE_ID`).
5. Set Depot secrets: `STAGING_DIRECT_URL` (Neon direct). Optionally keep `STAGING_DATABASE_URL` for backfill workflow aligned to same Neon.

### 1.2 Schema bootstrap

1. Prefer: dump/restore **public** schema from current staging Supabase **or** fresh Drizzle migrate against empty Neon + seed.
2. If restore: baseline Drizzle migrations (`packages/db` baseline script) so `db:migrate` is a no-op for already-applied SQL.
3. Do **not** rely on `migrate-supabase-auth.mjs` on Neon (no `auth.users`). Seed Better Auth users via existing seed / admin create path.
4. Apply D1 migrations separately (unchanged): `wrangler d1 migrations apply …`.

### 1.3 Verify

- [ ] `pnpm --filter @nexora/db db:migrate` against Neon direct (idempotent second run)
- [ ] Worker health: `https://staging.manut.xyz/api/auth/ok`
- [ ] Login + one ERP list read (leave or users) via Hyperdrive
- [ ] `edge-jobs` tick still posts cron with DB access

### 1.4 Docs / secrets matrix

Update in the same PR as wiring:

- `docs/ops/CLOUDFLARE_PROVISIONING.md` — Neon strings, not “Supabase only”
- `docs/CLOUDFLARE_DEPLOYMENT.md` — staging Neon note
- ADR addendum or short `docs/ops/NEON_STAGING.md` — direct vs pooled, no Prisma on Neon staging

**Exit criteria:** Staging edge deploy green with Neon Hyperdrive id committed; no `REPLACE_WITH_STAGING_HYPERDRIVE_ID` left.

---

## Phase 2 — Neon branching workflow

**Outcome:** Risky migrations and agent sandboxes use Neon branches instead of throwaway Docker-only verification.

### 2.1 Conventions

| Branch | Purpose |
|---|---|
| `staging` (primary) | `preview` deploy Hyperdrive target |
| `mig/<slug>` | One-off migrate verify (apply twice for idempotency) |
| `pr/<n>` or `agent/<id>` | Optional ephemeral DBs |

### 2.2 Engineer loop

1. Create Neon branch from staging.
2. Point local / CI `DATABASE_URL` + `DIRECT_URL` at branch.
3. Apply pending Drizzle migration(s) twice (idempotency).
4. Merge migration to `main` → promote → staging Neon primary migrates via Depot.

### 2.3 Optional automation (later)

- Depot workflow: create branch → migrate → destroy on PR close.
- Do **not** block Phase 1 on this.

**Exit criteria:** Documented branch recipe used for at least one real migration PR.

---

## Phase 3 — Databricks ERP lakehouse (v1 snapshot)

**Outcome:** Nightly (or on-demand) export of a first ERP slice into Delta; queryable via SQL warehouse. No Worker binding.

### 3.1 Workspace setup (manual)

1. Databricks workspace (region near Neon or cheap storage region — document choice).
2. Unity Catalog schema: `manut_erp` (or `manut_staging_erp`).
3. Storage: UC volume or external location for raw landing.
4. SQL warehouse starter (auto-stop aggressive to stretch $1k).

### 3.2 First table slice (no marketing)

From Prisma domains:

| Priority | Domain | Examples |
|---|---|---|
| P0 | core + rbac | `users`, entities, roles, permissions |
| P0 | HR requests | leave / travel request + decision tables |
| P0 | Finance requests | expenses, cash-advance (+ decisions) |
| P1 | Sales CRM | leads, opportunities, accounts, contacts |
| P1 | Projects | `projects`, `project_tasks` (+ IT/Legal native mirrors if needed) |
| P2 | Audit / auth logs | `auth_logs`, selected audit tables |
| Later | ARIA corpus | knowledge articles / embeddings (batch only) |

Explicitly **excluded:** marketing-crm, BNII, `ow_*` metrics.

### 3.3 Export job v1 (mirror existing patterns)

Prefer one of:

**A. Depot workflow** (simplest for credits burn / control)  
- Manual + scheduled workflow (like `db-backfill.yml`)  
- Reads Neon via `STAGING_DIRECT_URL`  
- Writes Parquet/CSV to a landing path Databricks picks up  
- Idempotent by `as_of_date` partition  

**B. edge-jobs cron** (fits runtime)  
- New job name in `apps/edge-jobs` schedule  
- Handler in `apps/edge` `/api/cron/…` → `@nexora/core` exporter  
- Staging only until `JOBS_ENABLED` prod gate  
- Must stay under Worker CPU/time limits — chunked exports  

**Recommendation:** start with **A (Depot)** for bulk; move hot incremental pieces to **B** only if needed.

### 3.4 Lakehouse objects

- Raw: `bronze.<table>` (append-by-date)
- Clean: `silver.<table>` (latest snapshot or SCD1 overwrite)
- Few gold views: e.g. leave cycle-time, expense by entity — only after silver is stable

### 3.5 Verify

- [ ] Dry-run export row counts match Neon `COUNT(*)` for P0 tables
- [ ] Re-run same day is idempotent (overwrite partition or merge key)
- [ ] SQL warehouse query returns expected sample
- [ ] No Databricks credentials in Worker `env.ts`

**Exit criteria:** Documented runbook + one green scheduled/manual export of P0 tables.

---

## Phase 4 — Prod Neon gate (optional, separate PR)

Only after Phase 1–2 are boring:

1. Neon prod project (or prod branch policy)
2. Hyperdrive prod id in wrangler
3. Dual-run checklist: Better Auth login, migrate deploy, R2, edge-jobs still disabled until Phase 9
4. Cutover runbook update (`docs/ops/CUTOVER_RUNBOOK.md`)
5. Supabase Postgres retained as rollback until soak period ends

**Do not** combine prod Neon cutover with Databricks v1 in the same PR.

---

## Phase 5 — Databricks v2 (only if credits remain)

- Logical CDC (Neon logical replication → Databricks) instead of full snapshots
- ARIA eval batch jobs
- Audit log retention lake
- Still no marketing/BNII

---

## Work breakdown (implementation PRs)

| PR | Title | Depends on |
|---|---|---|
| **PR1** | `docs(ops): Neon + Databricks stack plan` (this file) | — |
| **PR2** | `chore(edge): wire staging Hyperdrive to Neon` + provisioning doc updates | Neon project + Hyperdrive id |
| **PR3** | `chore(db): Neon staging baseline / seed Better Auth users` | PR2 |
| **PR4** | `docs(ops): Neon branch migrate recipe` | PR3 |
| **PR5** | `feat(analytics): Depot ERP snapshot export → Databricks bronze` | Databricks workspace + PR3 |
| **PR6** | (later) Prod Neon Hyperdrive | Founder gate |

---

## Risk register

| Risk | Mitigation |
|---|---|
| Dual Prisma + Drizzle history on one Neon DB | Staging = Drizzle-only; document hard |
| Hyperdrive + transaction pooler breakage | Use CF-recommended Neon URL; keep `prepare: false` in `packages/db/src/client.ts` |
| Auth import assumes `auth.users` | Seed Better Auth; skip `migrate-supabase-auth` on Neon |
| Worker OOM on big export | Depot batch first; chunk + date partitions |
| Credit burn on always-on SQL warehouse | Auto-stop; bronze jobs on schedule only |
| Accidental marketing scope creep | Table allowlist in exporter; deny `ow_*` / marketing-crm |

---

## Test plan (definition of done per phase)

### Phase 1
- [ ] Staging Hyperdrive id real (not placeholder)
- [ ] Drizzle migrate ×2 against Neon direct succeeds
- [ ] Staging login + one module list works
- [ ] D1 handbook/presence paths unchanged

### Phase 3
- [ ] P0 tables present in Databricks silver/bronze
- [ ] Row-count check script/job logged
- [ ] Re-run idempotent
- [ ] No marketing tables in allowlist

---

## Open questions for founder

1. Neon region preference (APAC vs US for credit pricing)?
2. Restore existing staging data into Neon, or greenfield seed?
3. Databricks cloud (Azure / AWS / GCP) already chosen with the $1k credit?
4. OK to start exports via Depot workflow (not edge-jobs) for v1?

---

## References

- ADR: `docs/adr/0001-cloudflare-edge-rewrite.md`
- Provisioning: `docs/ops/CLOUDFLARE_PROVISIONING.md`
- Deploy staging: `.depot/workflows/deploy-edge-staging.yml`
- DB client: `packages/db/src/client.ts`
- D1 schema: `packages/db/src/edge/schema.ts`
- Edge jobs schedule: `apps/edge-jobs/src/schedule.ts`
- Backfill pattern: `.depot/workflows/db-backfill.yml`, `packages/database/scripts/backfill-advance-side-vendor.mjs`
