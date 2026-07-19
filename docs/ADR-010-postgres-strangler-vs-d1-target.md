# ADR-010 — Postgres/Prisma/Hyperdrive strangler SoR vs D1 target

**Status:** Accepted  
**Date:** 2026-07-19

## Context

`docs/EXPO_CLOUDFLARE_MASTER_PLAN.md` (Version 1.4) is the sole forward-looking
architecture and migration roadmap. Its target production data plane is
tenant-isolated D1 (plus Identity D1 and Control-plane D1), not PostgreSQL.

This clean-room repository currently runs a **strangler** stack:

- PostgreSQL via Prisma 7 and Cloudflare Hyperdrive for transactional CRM/ERP
  business data.
- Express (`apps/api`) as the business API/parity bridge behind the Worker.
- D1 bindings (where present) for edge metadata / platform experiments only —
  not multi-statement transactional SoR for tenant modules.

Older agent guides (`CLAUDE.md`, `AGENTS.md`) stated “Postgres is authoritative;
D1 is edge metadata only” without naming the target retirement path. That
reading conflicts with the master plan’s Phase 8+ D1-per-tenant redesign unless
the dual track is made explicit.

## Decision

1. **Strangler system of record (now → Phase 8 gates):** PostgreSQL through
   Prisma 7 and Hyperdrive remains the transactional SoR for tenant business
   data. Modules keep Prisma repositories, migrations against the clean
   PostgreSQL 16 baseline, and Hyperdrive dual-path rules already documented
   in ops runbooks.
2. **Target system of record (after Phase 8+ acceptance):** Per-tenant D1
   (Workers for Platforms) plus Identity D1 and Control-plane D1, as specified
   in the master plan. D1 is a deliberate schema/behavior redesign, not a
   generated Prisma→D1 conversion.
3. **D1 is not transactional SoR yet.** Do not treat D1 as the authoritative
   store for money, approvals, payroll, RBAC grants, or any multi-step write
   that still depends on PostgreSQL invariants. Edge D1 usage stays metadata /
   non-SoR until a module passes the master-plan Phase 8+ migration,
   reconciliation, and rollback gates.
4. **Honest dual-track docs:** Binding guides must state both tracks — current
   strangler SoR and target D1 SoR — and defer schedule, cutover, and
   acceptance to `docs/EXPO_CLOUDFLARE_MASTER_PLAN.md`. If a historical
   checklist conflicts with that file, the master plan wins.
5. **No silent SoR flip.** Moving a module’s SoR from Postgres to D1 requires
   master-plan phase acceptance evidence (parity, rollback window, cost, and
   ownership gates). Code existence alone is not enough.

## Consequences

- Engineers continue shipping Expo + Worker + Express features against Prisma /
  PostgreSQL without pretending D1 already owns those writes.
- Identity and control-plane D1 work may proceed on their own Phase 1–4 tracks
  per the master plan; that does not authorize tenant CRM/ERP SoR on D1 early.
- Dependency freeze (`docs/DEPENDENCY_FREEZE.md`) blocks new direct Supabase,
  in-app Prisma client, Next.js, and Express provider-SDK deps without a
  follow-up ADR — so the strangler does not deepen the wrong coupling.
- Ops still must not invent Hyperdrive ids or perform DNS/prod Cloudflare
  mutations from documentation-only PRs.

## Related

- Authority plan: `docs/EXPO_CLOUDFLARE_MASTER_PLAN.md` (esp. §§1, 7–8, Phase 8)
- Dependency freeze: `docs/DEPENDENCY_FREEZE.md`
- Hyperdrive / topology: `docs/CLOUDFLARE_BINDINGS.md`, `docs/ADR-002-worker-express-api-boundary.md`
- Binding guides: `CLAUDE.md`, `AGENTS.md`
