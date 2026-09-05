# GCP → AWS migration pack

Prepared for Sanjeev. Baseline: commit `0479db8d` on `main` (production),
2026-08-26.

The ask was "full codebase and DB table structure". This directory answers that,
plus the infrastructure context needed to act on it.

## Read in this order

| File | What it is | Size |
|---|---|---|
| [01-codebase-overview.md](01-codebase-overview.md) | What the system is, repo layout, stack, size, build/deploy pipeline, and where the migration complexity actually sits | ~250 lines |
| [02-data-dictionary.md](02-data-dictionary.md) | Every one of the 274 tables — columns, types, nullability, defaults, primary keys, foreign keys, indexes, and reverse references — grouped by domain | ~5,900 lines |
| [03-schema.sql](03-schema.sql) | The authoritative DDL. Runnable against an empty PostgreSQL database | 274 tables |
| [04-schema-addendum.sql](04-schema-addendum.sql) | **Required.** The objects Prisma does not emit: pgvector, the ARIA embedding column and its ivfflat index, two GIN indexes, and the RLS layer | 285 lines |
| [05-tables-index.csv](05-tables-index.csv) | One row per table — domain, Prisma model, column count, PK, FK counts, index counts, soft-delete flag, JSONB/array/decimal counts. Open in a spreadsheet to sort and filter | 274 rows |
| [06-infrastructure-inventory.md](06-infrastructure-inventory.md) | What is running on GCP, the Supabase surface, all 38 secrets + 3 feature variables, all 20 cron endpoints, third-party dependencies, and the PII footprint | ~310 lines |
| [07-aws-target-mapping.md](07-aws-target-mapping.md) | Service-by-service AWS mapping, the three real decisions, a cutover checklist, and open questions | ~260 lines |
| [migration-pack.html](migration-pack.html) | Source of the published browsable version of this pack — the narrative sections plus a searchable, sortable browser for all 274 tables | 1 page |

## Three things to know before reading anything else

1. **The database is already on AWS.** Supabase runs on AWS and the connection
   strings point at an `aws-*-ap-southeast-*` region. The production data plane is
   not moving clouds — only vendors, and only if you decide it should. What is
   actually on GCP is two Cloud Run services, one Artifact Registry repo, Cloud
   Scheduler, Workload Identity Federation for CI, and the domain mappings.

2. **`03-schema.sql` is incomplete on its own.** It is generated from the Prisma
   schema, and several load-bearing objects exist only in raw migration SQL —
   most importantly the `vector` extension and
   `aria_knowledge_articles.embedding vector(768)`. A database built from the
   Prisma schema alone will boot, serve traffic, and silently degrade the ARIA
   assistant to keyword search. Always apply `04-schema-addendum.sql` after
   `03-schema.sql`.

3. **Only 4 of the 20 cron endpoints are provisioned by CI.** The other 16 were
   created by hand in Cloud Scheduler, and the repo's own ops doc has drifted by
   three entries. Before cutover, `gcloud scheduler jobs list` is the source of
   truth — not this pack.

## How the schema files were produced

```bash
# 03-schema.sql — canonical current shape, no database needed
cd packages/database
npx prisma migrate diff --from-empty --to-schema-datamodel ./prisma/schema --script
```

Deliberately *not* a concatenation of the 258 files under
`packages/database/prisma/migrations/` — those are the audit trail and include
retired tables, one-off data backfills and idempotency guards. They are history;
`03-schema.sql` is the present.

`02-data-dictionary.md` and `05-tables-index.csv` are derived from that DDL joined
against the Prisma `@@map` declarations, so table names, domains and model names
stay consistent across all three.

To regenerate the whole pack after schema changes, re-run the command above and
regenerate the derived files from it.

## Verification performed

`03-schema.sql` and `04-schema-addendum.sql` were applied to an empty
**PostgreSQL 16.14** database and the resulting objects counted, rather than
being taken on trust from the generator:

| Check | Expected | Actual |
|---|---:|---:|
| Tables | 274 | **274** |
| Columns | 3,228 | **3,228** |
| Foreign-key constraints | 444 | **444** |
| Primary-key constraints | 274 | **274** |
| Indexes (274 PK + 590 secondary) | 864 | **864** |
| Tables with `deleted_at` | 25 | **25** |
| RLS policies (addendum) | 91 | **91** |
| GIN indexes (addendum) | 2 | **2** |
| `public.is_service_role()` | 1 | **1** |

Both files are idempotent — a second run of the addendum against the same
database exits 0 with no errors.

Two findings came out of that verification and are folded into the files above:

- **The historical RLS block cannot be replayed verbatim.** `0000_init` enables
  RLS on 94 tables, but `survey_definitions`, `survey_waves` and `upload_jobs`
  were dropped afterwards, so copying it produces
  `ERROR: relation "public.survey_definitions" does not exist`.
  `04-schema-addendum.sql` iterates with a `to_regclass` guard instead and
  reports what it skipped.
- **The `anon` / `authenticated` / `service_role` roles are Supabase-specific.**
  Off Supabase they do not exist, so the `REVOKE` statements would error. The
  addendum guards them on `pg_roles` membership, which is also what makes it
  applicable to an RDS or Aurora target unchanged.

Section 1 of the addendum (pgvector) could not be exercised locally — the
`vector` extension is not installed on the test server, and
`CREATE EXTENSION IF NOT EXISTS vector` fails with
`ERROR: extension "vector" is not available`. That is precisely the failure a
staging rehearsal on the AWS target needs to surface **before** production.
