# Prisma model / schema inventory

> Phase 0.2 inventory (factual). Source: `packages/database/prisma/schema/*.prisma`.
> Companion: [`prisma-models.json`](./prisma-models.json).

## Summary

| Metric | Count |
| --- | ---: |
| Schema files | 17 (includes `base.prisma` generator/datasource) |
| Models | 214 |
| Enums in schema files | 0 |
| `@relation(` decorators | 532 |
| `@db.Uuid` annotations | 444 |
| `Json` scalar fields | 60 |
| Scalar array fields (`String[]` / etc.) | 8 |
| Migration directories | 6 |
| `$transaction` call sites in `apps/api` (non-test) | 108 |
| `$queryRaw` / `$queryRawUnsafe` call sites (non-test) | 22 |

### Migrations (this snapshot)

- `20260717000000_manut_baseline`
- `20260717010000_remove_legal_docusign`
- `20260717020000_isolate_legal_signature_batches`
- `20260717030000_track_current_legal_signature_batch`
- `20260717040000_bind_legal_signature_artifacts`
- `20260717050000_bind_cash_advance_disbursement_proof`

### Note vs master-plan baseline numbers

`docs/EXPO_CLOUDFLARE_MASTER_PLAN.md` Epic 0.2 cites **237 models / 18 schema files / 184 migrations** from the pre-consolidation intranet history. This Manut repo snapshot uses a **consolidated migration baseline** (`20260717000000_manut_baseline` + follow-ups). Inventory counts below are authoritative for **this** tree.

## Models by schema file

| Schema file | Models |
| --- | ---: |
| `comms.prisma` | 9 |
| `content.prisma` | 7 |
| `core.prisma` | 5 |
| `finance.prisma` | 16 |
| `helpdesk.prisma` | 4 |
| `hr.prisma` | 47 |
| `integrations.prisma` | 2 |
| `investors.prisma` | 11 |
| `it-operations.prisma` | 9 |
| `legal.prisma` | 8 |
| `operations.prisma` | 57 |
| `performance.prisma` | 7 |
| `rbac.prisma` | 7 |
| `sales-crm.prisma` | 10 |
| `sales-revenue-crm.prisma` | 10 |
| `system.prisma` | 5 |

## Full model list

See [`prisma-models.json`](./prisma-models.json) → `models[]`.

## Still open (Epic 0.2 follow-ups)

- Row-level tenant attribution rules + cross-wave relation DAG
- RLS reconciliation (deployed catalogs vs migration SQL vs any helper scripts)
- `User` lifecycle → Identity / control-plane / tenant-local profile split
