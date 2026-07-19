# Marker: P0-E4-T7 production Workers Builds pause

Fail-closed git marker for the production Workers Builds pause on Worker
`manut`. **Engineering must not pause, disconnect, or mutate Builds from a
code PR** until `approval` below is `granted` (or a private ops ticket id is
recorded) and an owner performs the dashboard/API steps in
`docs/CICD_CLOUDFLARE.md` § P0-E4-T7.

## Status (authoritative for this repo)

| Field | Value |
| ----- | ----- |
| Task | P0-E4-T7 |
| Account id | `187ab61ed9dbc6e616cb23e6b95aa8f1` |
| Worker | `manut` |
| Script / external id | `4d091451cca54519bfeb5c2eb4ccd7e1` |
| `status` | `required_not_paused` |
| `approval` | `not_granted` |
| Last live check | `2026-07-19` (read-only Cloudflare Builds API + Builds MCP) |
| Live Builds enabled? | **yes** |
| Production trigger | `Deploy default branch` / `b2dc37d3-1e1d-4a60-9c1a-42ada4fe03d2` |
| `branch_includes` | `main` |
| Non-production Builds (`previews_enabled`) | `false` (keep off) |
| Pause method applied | _(none)_ |
| Pause performed by | _(none)_ |
| Private ticket / change window | _(none — do not invent)_ |

Allowed `status` values: `required_not_paused` → `paused` →
`reenabled_after_cutover`.

Allowed `approval` values: `not_granted` → `granted` (ops owner + ticket id).

## What “done” means

1. `approval: granted` with a private ticket or change-window reference (no
   secrets in git).
2. Ops applies one pause method from `docs/CICD_CLOUDFLARE.md` (prefer
   **Disconnect**).
3. Read-only re-check shows no active `main` push trigger (or soft fail-close
   with `wrangler versions upload` verified not promoting Active Deployment).
4. This marker updated to `status: paused` with method + performer names only.

## Explicit non-claims

- This marker does **not** authorize DNS cutover, Hyperdrive id invention, or
  token rolls.
- A green merge to `main` while `status` remains `required_not_paused` is
  expected to keep deploying via Workers Builds until ops pauses.
