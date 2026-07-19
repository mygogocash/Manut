# D1 money / approval concurrency harness (stubs)

Design:
[`docs/architecture/d1-money-approval-concurrency-spike.md`](../../../docs/architecture/d1-money-approval-concurrency-spike.md)

## Intent

Vitest stubs capture Epic 1.3 / Phase 1 acceptance scenarios (C1–C7) before a
local D1 (or miniflare) fixture exists. Tests use `it.todo` so CI stays green
until an implementation PR wires `createHarness()`.

## Layout

| File | Role |
| ---- | ---- |
| `harness.ts` | Types + stub factory (`createHarness` throws “not implemented”) |
| `money-approval.concurrency.test.ts` | Todo matrix for C1–C7 |
| `package.json` | Optional spike package metadata (not wired into turbo yet) |

## Run (after implementation)

```bash
# Planned — not wired to root pnpm test yet
pnpm exec vitest run tests/spikes/d1-money-approval
```

## Related issues

[#235](https://github.com/mygogocash/Manut/issues/235),
[#236](https://github.com/mygogocash/Manut/issues/236),
[#239](https://github.com/mygogocash/Manut/issues/239);
topology precursors [#230](https://github.com/mygogocash/Manut/issues/230),
[#233](https://github.com/mygogocash/Manut/issues/233).
