# Temporary dependency freeze (Phase 0)

**Status:** Active until lifted by a follow-up ADR referenced from
`docs/EXPO_CLOUDFLARE_MASTER_PLAN.md`  
**Date:** 2026-07-19

## Rule

Do **not** add new direct dependencies of these kinds without an accepted ADR
that names the exception, blast radius, and exit path:

| Frozen coupling | Why |
| --------------- | --- |
| Direct Supabase client / Auth / Storage SDKs in app or shared packages | Target retires Supabase; deepen only via temporary adapter + master-plan identity/storage ports |
| Prisma Client imported inside `apps/app` (Expo) or other client bundles | SoR access stays server-side; clients use `app-core` ports/DTOs |
| New Next.js surface area or Next-only libraries for product UI | Universal Expo Router is the primary frontend; `apps/web` is parity reference only |
| New Express-side provider SDKs (email/SMS/AI/storage “direct SDK” adds) | Prefer provider-neutral ports already in the master plan; avoid a second SDK stack |

Existing strangler usage (Prisma in `apps/api` / `packages/database`, Hyperdrive
on the Worker when provisioned, temporary Next parity in `apps/web`) may stay
and be maintained. This freeze blocks **new** direct couplings, not honest
bugfixes inside the current boundary.

## Allowed without a new ADR

- Patches/security bumps of already-declared packages.
- Test-only or stub adapters that do not ship a new provider SDK to runtime.
- Cloudflare-native bindings (R2, Queues, DO, Workers AI) behind existing ports.
- Docs and ADRs that shrink, not expand, provider surface.

## Exit

Lift or narrow this freeze only by ADR that cites the master-plan phase gate
being unblocked (for example Better Auth spike, ObjectStoragePort cutover, or
Phase 8 module SoR move). Until then, treat violations as out of scope for
merge.
