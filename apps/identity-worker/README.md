# `@manut/identity-worker` — Epic 1.1 Better Auth spike

Preview-only, **delete-able** Identity Worker scaffold for the master-plan
Epic 1.1 feasibility spike.

## What this is

| Piece | Status |
| ----- | ------ |
| `packages/identity-contracts` | **Real** provider-neutral `IdentityPort` + envelopes |
| Pinned Better Auth config snapshot (`1.6.23`) | **Real** CI-tested constants |
| Stock phone + password route blocks | **Real** (404) |
| Public magic-link / phone accept envelopes | **Stub** (enumeration-safe shape only) |
| Better Auth runtime + D1 adapter | **Stub** — not installed / not wired |
| `session_assurance` SQL | **Stub migration** — not auto-applied |
| Production auth cutover | **Out of scope** — Supabase/Express unchanged |

## Fail closed

`wrangler.jsonc` keeps `"d1_databases": []` and `"hyperdrive": []`.
Do **not** invent Cloudflare D1 or Hyperdrive ids. Until ops binds a
Manut-owned preview Identity D1 as `IDENTITY_DB`:

- `/health` reports `identityDb: "fail_closed"`
- consume / verify / revoke paths return `503 IDENTITY_D1_NOT_PROVISIONED`

## Commands

```bash
pnpm --filter @manut/identity-worker test
pnpm --filter @manut/identity-worker type-check
pnpm --filter @manut/identity-contracts test
```

## Docs

- `docs/identity/EPIC-1.1-BETTER-AUTH-SPIKE.md`
- `docs/identity/MAGIC-LINK-DIRECTION.md`
- `docs/identity/PRIVATE-PHONE-CHALLENGE-WRAPPER.md`
- `docs/identity/SESSION-ASSURANCE.md`

## Rollback

Delete `apps/identity-worker`, `packages/identity-contracts`, and
`docs/identity/*`. Production auth is untouched.
