# ADR 0001 — Cloudflare edge rewrite

**Status:** Accepted (in progress on `claude/cf-edge-migration`)  
**Date:** 2026-09-05

## Context

Intranet ran on Express 5 + Prisma (Cloud Run) and Next.js (Vercel/Firebase), with
Supabase Auth + Postgres + Storage. Latency, dual-deploy complexity, and the desire
for a single edge runtime (Workers) plus a cross-platform client (Expo) motivated a
full rewrite rather than incremental adapters.

## Decision

Replace the serving stack with:

| Layer | Choice |
|---|---|
| API | Cloudflare Workers + Hono (`apps/edge`) |
| Jobs | Workers Cron + Queues (`apps/edge-jobs`) |
| Client | Expo SPA (`apps/app`) exported to Worker assets |
| ORM | Drizzle (`packages/db`) over Hyperdrive → Postgres |
| Auth | Better Auth (`packages/auth`) + KV sessions |
| Contracts | Shared Zod (`packages/contracts`) |
| Domain | Pure services (`packages/core`) |
| Files | R2 (public + private); stream download until presign |

Legacy `apps/api` / `apps/web` / `packages/database` remain until Phase 9 decommission.

## Consequences

- **Positive:** One deploy path, edge latency, shared contracts, Expo web+native.
- **Negative:** Large port surface (~1.3k Express routes); many modules land as list/CRUD first with 501 stubs for Node-only paths (PDF encrypt, DocuSign, AI chat without keys).
- **Operational:** Cutover needs company CF account, zone NS, Hyperdrive; GCP Scheduler replaced by edge-jobs Cron.
- **Auth:** Session model change → forced re-login at cutover; bcrypt hashes rehashed to scrypt on login.

## Alternatives considered

1. Keep Express on Workers via node compatibility — rejected (cold start + incomplete Node APIs).
2. Next.js on Cloudflare OpenNext only — rejected (no shared native client path).
3. Dual-run Prisma + Drizzle indefinitely — rejected (schema drift); Drizzle is source of truth post-cutover.
4. Cloudflare D1 as the ERP database — rejected. Leave, users, and CRM stay on Hyperdrive → Postgres. D1 is a Worker-local sidecar (presence, workflow instance ids, handbook chunk metadata) only.

## Addendum — recommended Cloudflare primitives (2026-09-05)

The Worker now wires the recommended edge stack as **templates**, not a production cutover:

| Primitive | Binding / package | Role |
|---|---|---|
| Workers + Hono | `apps/edge` | Sub-millisecond API + routing |
| Hono RPC | `@nexora/edge/rpc` + Expo `createEdgeClient` | End-to-end types. Expo does not import the Worker runtime |
| D1 + Drizzle | `EDGE_DB` / `packages/db/src/edge` | Sidecar SQLite only |
| Durable Objects | `PRESENCE` / `PresenceRoom` | `/ws/messages/:channelId` presence + chat |
| Queues | `JOBS_QUEUE` + `apps/edge-jobs` sidecar handlers | Reminders, audit, handbook ingest |
| Workflows | `LEAVE_APPROVAL` | Multi-day leave **reminders**. Postgres still approves |
| R2 | `R2_PUBLIC` / `R2_PRIVATE` | Documents and attachments |
| Vectorize + Workers AI | optional `HANDBOOK` / `AI` | Semantic handbook search; D1 LIKE fallback locally |
| Zero Trust / Access | `CF_ACCESS_AUD` | Fail-open when empty |
