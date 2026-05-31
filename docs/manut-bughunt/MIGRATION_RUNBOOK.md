# Manut Migration Runbook — Prod Drift (post-2026-05-17)

> **Audience:** Ops / on-call applying the Manut control-plane migrations to a
> production database that is behind `main`.
> **Source findings:** wf2-sweep migration-drift group (#1, #8, #9, #21, #22).
> **Verified against the working tree on 2026-05-31.** Where a finding's premise
> did not match the actual SQL on disk, this runbook says so explicitly rather
> than repeating the finding (NO MAGIC — see the correction callouts below).

---

## 0. Ground truth (verified, not assumed)

- Migrations live in `packages/backend/server/migrations/` (131 dirs total).
  There is **no** `schema/migrations/`; `schema.prisma` is a single file at
  `packages/backend/server/schema.prisma`.
- **19 migrations are dated `2026-05-17` or later.** These introduce the Manut
  control plane, social analytics, mongo ingestion, and the workspace
  `slug`/`plan` columns. Full ordered list in §A.
- These 19 migrations create **24 tables** and add **2 workspace columns**
  (`slug`, `plan`). Full list in §A — that list is the single source of truth
  mirrored into the smoke spec's `GATED_TABLES`.
- The module gate is the env var **`ENABLE_MANUT_MODULE`** (legacy alias
  `ENABLE_SUPERFLOW_MODULE` still honored — see CLAUDE.md §9). When on, the
  Manut services query the tables above; if the DB hasn't applied the
  migrations, Prisma throws `P2021`/`P2022` and the user sees a generic
  500/502 ("Unhandled error raised") **at first query**, not at boot (#22).

### ⚠️ Finding #8 correction (verified)

Finding #8 claims 4 post-May-17 migrations use raw `CREATE TABLE` / `ADD COLUMN`
**without** `IF NOT EXISTS` and so risk failing on a partial prior apply. **This
is NOT true in the current tree.** A scan of all 131 migrations found **zero**
non-idempotent `CREATE TABLE` or `ADD COLUMN` statements. Every post-May-17
`CREATE TABLE` uses `IF NOT EXISTS`, every `ADD COLUMN` uses
`ADD COLUMN IF NOT EXISTS`, every index uses `CREATE [UNIQUE] INDEX IF NOT
EXISTS`. The migrations as written are **safe to re-apply** on a partially
applied DB. Treat #8 as already-mitigated; the residual risk is the Prisma
ledger itself wedging (P3009 — see §3.1), not the DDL.

### ⚠️ Finding #21 correction (verified)

`20260520000000_add_mn_agent_memory_embedding` is the most _operationally
sensitive_ migration, but it is also **fully guarded** (verified contents in
§4). It does `DROP COLUMN IF EXISTS "embedding"`, `CREATE EXTENSION IF NOT
EXISTS vector`, then `CREATE INDEX IF NOT EXISTS ... USING ivfflat`. So it is
idempotent. The real risks are environmental, not idempotency: (a) the `vector`
extension must be installable, and (b) the `ivfflat` build on an empty table
produces a degenerate index. See §4.

---

## 1. The drift, in one paragraph

Production is missing the 19 post-2026-05-17 migrations. With
`ENABLE_MANUT_MODULE=true` (or the legacy `ENABLE_SUPERFLOW_MODULE`) the Manut
modules query `mn_*` / `social_analytics_*` / `mongo_ingestion_state` tables and
the `workspaces.slug` / `workspaces.plan` columns that don't exist on prod,
producing `P2021`/`P2022` → generic 500/502 at first query. Fix is operational:
apply the pending migrations. Do **not** edit applied migrations or
`schema.prisma` (CLAUDE.md R0).

---

## 2. Pre-flight

1. **Logical backup** (mandatory — `20260520000000` does a `DROP COLUMN` on
   `mn_agent_memories`; harmless on a fresh prod where the column is absent, but
   back up anyway):
   ```bash
   pg_dump --format=custom --no-owner --file=manut_predeploy_$(date +%Y%m%d%H%M).dump "$DATABASE_URL"
   ```
2. **Confirm `vector` extension is installable** (needed by `20260520000000`).
   The migration runs `CREATE EXTENSION IF NOT EXISTS vector;` itself, so the
   deploy role needs `CREATE` privilege and the `vector` package must be
   available on the server:
   ```sql
   SELECT * FROM pg_available_extensions WHERE name = 'vector';  -- expect 1 row
   ```
3. **Snapshot migration state:**
   ```sql
   SELECT migration_name, finished_at, applied_steps_count
   FROM _prisma_migrations ORDER BY started_at DESC LIMIT 30;
   ```
4. **Check for a wedged migration (P3009):**
   ```sql
   SELECT migration_name, started_at, finished_at, rolled_back_at, logs
   FROM _prisma_migrations WHERE finished_at IS NULL;   -- expect 0 rows
   ```
   A row here means a prior apply is stuck — resolve via §3.1 before proceeding.

---

## 3. Apply

In prod, migrations run via the `affine_migration` container in the compose
(CLAUDE.md §5). The underlying command is the standard:

```bash
yarn workspace @affine/server prisma migrate deploy
```

`migrate deploy` applies every pending migration in `migrations/` in filename
order (so `20260514…` → `20260520…`) and records each in `_prisma_migrations`.
It is non-interactive and does not reset. Because the DDL is idempotent (§0),
re-running after a partial apply is safe at the SQL level.

### 3.1 If `migrate deploy` aborts (P3009 — wedged ledger)

Even with idempotent DDL, the Prisma _ledger_ can wedge if a prior run died
mid-batch (network drop, OOM). Recovery (do NOT edit applied migration files —
CLAUDE.md R0):

1. Identify the failed migration from §2.4.
2. Because every statement in these migrations is `IF [NOT] EXISTS`-guarded, the
   objects are either fully present or absent — there is no divergent partial
   state to reconcile. Verify with §5.2 scoped to that migration's objects.
3. Mark it applied and continue:
   ```bash
   yarn workspace @affine/server prisma migrate resolve --applied <migration_name>
   yarn workspace @affine/server prisma migrate deploy
   ```

---

## 4. The single most sensitive step — `20260520000000_add_mn_agent_memory_embedding` (#21)

Verified contents:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "mn_agent_memories" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "mn_agent_memories" ADD COLUMN "embedding" vector(1536);
CREATE INDEX IF NOT EXISTS "mn_agent_memories_embedding_idx"
  ON "mn_agent_memories" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);
```

Note: the `ADD COLUMN "embedding" vector(1536)` is the **one** `ADD COLUMN`
without `IF NOT EXISTS` in the post-May-17 set — but it is immediately preceded
by `DROP COLUMN IF EXISTS "embedding"`, so the drop-then-add pair is idempotent
as a unit (re-running drops the just-added column and re-adds it). Don't
"fix" it by editing the applied file.

**Operational risks (not idempotency):**

- `CREATE EXTENSION vector` needs the extension available on the PG server
  (§2.2) and `CREATE` privilege for the deploy role.
- `ivfflat` index build on an **empty / near-empty** `mn_agent_memories` trains
  `lists=100` clusters on no data → degenerate index (poor recall, effectively
  a seq-scan). On a fresh prod the table is empty, so this WILL produce an
  untrained index.

**Mitigation:**

- After deploy, confirm the index exists and is valid:
  ```sql
  SELECT i.relname AS index_name, ix.indisvalid
  FROM pg_class i
  JOIN pg_index ix ON ix.indexrelid = i.oid
  JOIN pg_class t ON t.oid = ix.indrelid
  WHERE t.relname = 'mn_agent_memories'
    AND i.relname = 'mn_agent_memories_embedding_idx';
  ```
- Once `mn_agent_memories` has representative row volume, `REINDEX` the index so
  `lists` is trained on real data:
  ```sql
  REINDEX INDEX "mn_agent_memories_embedding_idx";
  ```

---

## 5. Verify (post-deploy)

### 5.1 Ledger advanced

```sql
SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL;  -- 0 rows
SELECT migration_name FROM _prisma_migrations
WHERE migration_name = '20260520050000_add_mongo_ingestion_tables';        -- 1 row (last in batch)
```

### 5.2 Gated tables present (#9, #22)

```sql
SELECT to_regclass('public.mn_agent_roles')   AS mn_agent_roles,
       to_regclass('public.mn_release_runs')   AS mn_release_runs,
       to_regclass('public.mn_agent_memories') AS mn_agent_memories,
       to_regclass('public.social_analytics_posts') AS social_analytics_posts,
       to_regclass('public.mongo_ingestion_state')  AS mongo_ingestion_state;
-- expect: each column returns the table name, NOT null
```

The **complete** gated-table list is in §A and is mirrored verbatim into
`packages/backend/server/src/__tests__/manut/module-init-smoke.spec.ts`
(`GATED_TABLES`). Run `to_regclass('public.<t>')` for each if you want a full
check, or just let the smoke spec (§6) do it.

### 5.3 Workspace columns present (#1)

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'workspaces'
  AND column_name IN ('plan', 'slug');                 -- expect 2 rows
```

### 5.4 pgvector index healthy (#21)

See §4 validation query.

### 5.5 Smoke the app

With `ENABLE_MANUT_MODULE=true`, boot the server and confirm the module-init
smoke check (§6) passes, then hit a Manut control-plane query and confirm 200,
not 502.

---

## 6. Boot-time guard (loud-at-deploy, not 502-at-query) — #22

Finding #22: nothing currently fails loudly when the gated tables are missing.
The companion spec
`packages/backend/server/src/__tests__/manut/module-init-smoke.spec.ts`
boots `ManutModule` (the same `createModule({ imports: [ManutModule] })` +
`ConfigModule.override({ manut: { enabled: true } })` pattern the existing
`m1`/`m2` module-init specs use) and asserts every table in `GATED_TABLES`
resolves via `to_regclass`, plus `workspaces.plan`/`slug`. Keep `GATED_TABLES`
in sync with §A — they are the same source of truth.

Run it locally against a migrated DB:

```bash
yarn workspace @affine/server ava src/__tests__/manut/module-init-smoke.spec.ts
```

> **Recommendation (future change, do NOT apply here):** promote the same
> `to_regclass` check into an `OnModuleInit` guard inside `ManutModule` so a
> deploy against a drifted DB fails the readiness probe instead of 502-ing.
> Out of scope for this drift pass; noted for the module owner.

---

## 7. What NOT to do

- ❌ Do not edit any applied file under `migrations/` (CLAUDE.md R0). The DDL is
  already idempotent; there is nothing to retrofit. If a future schema needs a
  guard, write a **new forward** migration.
- ❌ Do not edit `schema.prisma` to "make it match" — let `migrate deploy`
  reconcile.
- ❌ Do not run `prisma migrate reset` / `db push` / `migrate dev` against prod.
- ❌ Do not flip `ENABLE_MANUT_MODULE` on prod before §5 verification passes —
  CLAUDE.md §6 documents the exact "flip the flag → DI crash → 502" scar.

---

## 8. Rollback

- Forward-only: there is no clean down-migration. Rollback = restore the §2.1
  `pg_dump` to a point before the deploy window. On a fresh prod where these are
  the first Manut migrations, an alternative is to leave the (additive) tables in
  place and simply turn `ENABLE_MANUT_MODULE` back off — the tables are unused
  when the module is gated off, so they're inert.

---

## Appendix A — exact gated objects (source of truth for §5.2 + the smoke spec)

**Post-2026-05-17 migrations, in apply order:**

```
20260517120000_workspace_slug
20260517130000_add_mn_agent_identity
20260517170000_add_mn_m2_m3_m4_control_plane
20260517190000_add_mn_skills_export_snapshot
20260518020000_add_mn_plugin_runtime
20260518100000_add_mn_m7_execution_locks
20260518150000_add_mn_m8_adapter_types
20260518170000_add_mn_m11_definition_of_done
20260518180000_add_mn_m10_work_products
20260518200000_add_mn_m9_m14_research_milestones
20260518210000_add_mn_m12_maximizer_mode
20260518230000_add_mn_m12_m13_m15_m17_research_milestones
20260519140000_add_social_analytics_tables
20260520000000_add_mn_agent_memory_embedding
20260520010000_add_mn_ai_budget_usage
20260520020000_add_pinned_doc_id_to_chat_histories
20260520030000_add_user_completed_onboarding
20260520040000_add_workspace_plan
20260520050000_add_mongo_ingestion_tables
```

(`mn_agent_roles` / `mn_release_runs` come from the immediately-preceding
`20260514120000` / `20260514000000`, also part of the Manut control plane and
included in the guard.)

**24 tables created by the post-May-17 batch (+ the two May-14 control-plane
tables) — this is `GATED_TABLES`:**

```
mn_agent_roles                mn_research_milestones
mn_release_runs               mn_skills
mn_agent_identities           mn_task_plans
mn_adapter_registrations      mn_work_products
mn_approval_gates             mn_work_queue_items
mn_budgets                    mn_export_snapshots
mn_cost_entries               mn_ai_budget_usage
mn_definitions_of_done        mn_chat_pins
mn_execution_locks            user_onboarding_state
mn_goals                      mongo_ingestion_state
mn_maximizer_runs             social_analytics_accounts
mn_plugin_runtimes            social_analytics_metrics
                              social_analytics_posts
                              social_platform_connections
```

**Workspace columns added:** `workspaces.slug` (`20260517120000`),
`workspaces.plan` (`20260520040000`).

Note: `mn_agent_memories` is referenced by `20260520000000` (DROP/ADD the
`embedding` column) but is **created by an earlier (pre-May-17) migration**, so
it is in `GATED_TABLES` (the embedding feature needs it) but its base creation
is not part of this drift batch.
