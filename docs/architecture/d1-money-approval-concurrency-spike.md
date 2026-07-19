# Epic 1.3 — D1 money / approval concurrency spike

**Status:** Design + harness stubs (not executed evidence)  
**Master plan:** Epic 1.3 (D1 behavior), §8.3 query/transaction rules, Phase 1 AC  
**Harness:** [`tests/spikes/d1-money-approval/`](../../tests/spikes/d1-money-approval/)

## Goal

Prove that high-contention **money and approval** transitions on tenant D1 lose
or duplicate **zero** writes under realistic concurrency, retries, and Worker
crashes — before Phase 2 production commitment.

Acceptance (Phase 1):

> D1 money/approval concurrency fixtures lose or duplicate zero writes.

## Why D1 needs an explicit spike

D1 is not Prisma/PostgreSQL interactive transactions. Multi-step money and
approval flows must be redesigned around:

1. Single statements or bounded `batch` atomicity
2. Idempotency keys on command records
3. Optimistic version / compare-and-swap updates
4. Durable Object (or equivalent) serialization for hot aggregates
5. Outbox before external side effects (email, webhooks, provider calls)

Serialize high-contention sequences **by tenant and aggregate key** (§8.3).

## In-scope aggregates (starter set)

Mirror current Express money/approval domains that will land on tenant D1:

| Aggregate family | Contention pattern | Must not happen |
| ---------------- | ------------------ | --------------- |
| Cash-advance request + approval decision | Double-submit approve/reject; concurrent step advance | Two terminal states; skipped step; double payout intent |
| Expense claim approve / reject | Concurrent HR + manager | Duplicate decision rows; lost rejection |
| Leave / travel approval chain (optional wave-2) | Same as cash-advance | Same class of bugs |
| Satang balance / ledger line (if modeled in D1) | Concurrent debit/credit | Negative without policy; lost update |

Use **INTEGER satang** for THB (§8.2). No floating money.

## Design decisions for the spike

### Command + outbox skeleton (per tenant D1)

```text
operation_command(
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  state TEXT NOT NULL,           -- pending|applied|failed
  expected_version INTEGER,
  payload_json TEXT NOT NULL,
  outcome_json TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (type, idempotency_key)
)

outbox_event(
  id TEXT PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload_version INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
)
```

Rules:

- Client/API supplies `idempotency_key` (or server derives from stable request id).
- Apply path: insert command → mutate aggregate with `WHERE version = ?` → insert outbox → mark command `applied` in one D1 `batch` where possible.
- Version mismatch → deterministic conflict (no silent overwrite).
- Replay of same idempotency key returns the stored outcome (no second mutate).

### Serialization options (spike must pick with evidence)

| Option | Use when | Spike proof |
| ------ | -------- | ----------- |
| A. Optimistic version only | Low conflict rate | Conflict rate + zero lost updates under N writers |
| B. Durable Object per `(tenantId, aggregateType, aggregateId)` | Hot approve queues | DO serializes; D1 still authoritative |
| C. Hybrid | DO for money; optimistic for low-risk metadata | Document boundary |

The spike must **not** rely on async D1 replicas for authorization or
finance read-after-write without sequential consistency (Epic 1.3 task).

### Concurrency matrix (minimum)

| # | Scenario | Pass criteria |
| - | -------- | ------------- |
| C1 | Two identical approve POSTs (same idempotency key) | One applied command; one decision; duplicate HTTP returns same outcome |
| C2 | Two different approve/reject racing | Exactly one terminal decision; other gets conflict/410-equivalent |
| C3 | Approve after already-final request | No second state transition |
| C4 | Worker crash after D1 batch success, before HTTP response | Client retry with same key → same outcome; no duplicate outbox |
| C5 | Worker crash after partial non-batched writes (anti-pattern control) | Harness must fail closed if batch omitted — documents why batch is required |
| C6 | Overload / 429 / retryable D1 errors | Classified; safe retry; no double apply |
| C7 | Cross-tenant command with foreign aggregate id | Rejected; tenant A D1 never sees tenant B rows |

## Out of scope for this spike

- Full schema migration of all 237 models
- Production WfP dispatch (see Epic 1.5 checklist)
- Fake Finance sign-off of cost impact (use cost-model placeholders only)
- Closing P0 ops issues [#230](https://github.com/mygogocash/Manut/issues/230)–[#235](https://github.com/mygogocash/Manut/issues/235)

## Related issues

| Issue | Why linked |
| ----- | ---------- |
| [#235](https://github.com/mygogocash/Manut/issues/235) | Hyperdrive dual-path is the transitional store; D1 spike must not assume Hyperdrive semantics |
| [#236](https://github.com/mygogocash/Manut/issues/236) | Expenses disposition may change which money aggregates are in the first cut |
| [#233](https://github.com/mygogocash/Manut/issues/233) / [#230](https://github.com/mygogocash/Manut/issues/230) | Preview topology honesty before calling spike results “pilot-proven” |
| [#239](https://github.com/mygogocash/Manut/issues/239) | Umbrella tracker |
| [#237](https://github.com/mygogocash/Manut/issues/237) | CI protection for landing harness tests later |
| [#238](https://github.com/mygogocash/Manut/issues/238) | Optional later e2e journeys on top of unit/integration fixtures |

## Deliverables checklist

- [x] Design doc (this file)
- [x] Test harness stubs under `tests/spikes/d1-money-approval/`
- [ ] Local D1 / miniflare fixture wired (implementation PR)
- [ ] C1–C7 green under declared concurrency
- [ ] Overload/retry classification note linked from Epic 1.3
- [ ] Decision: Option A / B / C with measured conflict rates

## Rollback

Spike uses preview-only D1 databases. Delete preview resources; production
unchanged (Phase 1 rollback rule).
