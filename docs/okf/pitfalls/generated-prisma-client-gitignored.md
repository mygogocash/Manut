---
type: Pitfall
title: Generated Prisma client is gitignored
description: The generated Prisma client is gitignored, so it must be regenerated locally after any schema edit rather than committed.
tags: [database, tooling]
status: stable
verified:
  - at: 2026-08-17
    by: kunanon-ui
stale_after: 2027-02-17
---

# Generated Prisma client is gitignored

## Rule

Generated Prisma client is gitignored (`packages/database/src/generated/`,
`apps/api/src/generated/`). Locally, run `pnpm db:generate` after any schema
edit. `apps/web/tsconfig.tsbuildinfo` is generated — `git checkout --` it
before committing.

## Why

CI runs `pnpm db:generate` before type-check (`pr-checks.yml`), so new models
resolve without committing the client.

## Reference

`packages/database/src/generated/`, `apps/api/src/generated/`,
`pr-checks.yml`, `apps/web/tsconfig.tsbuildinfo`.
