---
type: Playbook
title: Submitter-conditional approval routing
description: Route one person's own requests down a different chain from everyone else's, using per-step `skipWhenSubmitterIds` / `onlyWhenSubmitterIds`. Covers the self-approval bypass this exists for, and the category-filter and fallback traps that make a wrong config look correct.
tags: [backend, workflow, config]
status: stable
verified:
  - at: 2026-08-27
    by: kunanon-ui
stale_after: 2027-02-27
---

# Submitter-conditional approval routing

Configuration, not code. Every field below is already exposed in the admin
step dialogs — reach for this before adding a special case to a service.

## When you need it

An approver cannot approve their own request. The moment a chain names a real
person as a gate, that person's *own* requests need a different route — usually
one level up.

**There is no self-approval guard in the expenses module.** Nothing stops a step
from asking its own approver to sign off their own report. So the conditional
fields below are not an organisational nicety; they are the only thing
preventing it.

## Shape

Two `Json` array columns on every `*ApprovalStep` table, evaluated when the
per-request decision snapshot is built — not at approve time:

| Field | Effect |
|---|---|
| `skipWhenSubmitterIds` | contains the submitter → the step is dropped for this request |
| `onlyWhenSubmitterIds` | non-empty and does **not** contain the submitter → the step is dropped |

An empty `onlyWhenSubmitterIds` means "applies to everyone". Both are filters on
the same pass, so a step carrying both is legal and reads as "only these people,
except these".

Because it is a snapshot, editing the chain never re-routes a request already in
flight. That is the whole point of the snapshot — see
[/patterns/approval-chain.md](/patterns/approval-chain.md).

Reference: `snapshotApprovalDecisions` in
`apps/api/src/modules/expenses/expense-reports.service.ts`. The same shape
exists in `travel`, `cash-advance` and `leave`.

## Worked example

Requirement: Sarah approves everyone's expenses, Sid reviews, Nanteera gives
final approval — but Sarah's *own* expenses go to Manit (CEO) instead.

| Order | Stage | Approver | `onlyWhen` | `skipWhen` |
|---|---|---|---|---|
| 1 | `approve` | User → Manit | Sarah | — |
| 2 | `approve` | User → Sarah | — | Sarah |
| 3 | `review` | User → Sid | — | Sarah |
| 4 | `approve` | User → Nanteera | — | Sarah |

Sarah's report snapshots step 1 alone. Everybody else snapshots 2 → 3 → 4.

Note step 3 is `stageRole: review`, not `approve`. A review gate advances the
chain but never finalises the request and cannot reduce the approved amount;
only an `approve` gate closes it.

## Traps

**An empty `categoryFilter` matches every category, including `allowance`.**
Adding a general chain while an allowance chain already exists, and leaving the
filter blank, makes allowance reports snapshot *both* sets — seven approvals
where three were intended. Set the filter explicitly on the new steps.

**Never let `allowance` disappear from every active step's filter.**
`hasAllowanceApprovalChain()` tests whether *any* active step lists
`allowance`; when none does, allowance-only reports take a legacy fast-path
**straight to `reimbursed` with no approval at all**. Repurposing existing
allowance steps rather than adding new ones is how this fires.

**A submitter who matches no step falls back to a single `manager` step**
(their `reportingTo`). So a mistyped `onlyWhenSubmitterIds` does not stall the
chain and does not error — it quietly routes to the person's manager. A config
mistake therefore looks like a working chain. Test one real submission per
route after any edit; the absence of a stall proves nothing.

**A `manager` step whose submitter has no `reportingTo` is dropped**, not
stalled — admin and system accounts have no manager. This already stalled an
Office-Admin submitter once (2026-05-26): the `manager` step had no approver, so
the next step never became active and the approver's Pending tab stayed empty.

**`order` is `Int @unique` and is displayed in the admin Order column.**
Renumbering is two-phase in both the reorder and delete paths; see
[/pitfalls/approval-step-order-gaps.md](/pitfalls/approval-step-order-gaps.md).

## Verification

Submit one request per route and confirm the snapshot, rather than reading the
config back:

```sql
SELECT d."order", d.stage_role, d.approver_user_id, d.status
FROM expense_approval_decisions d
WHERE d.expense_report_id = '<report id>'
ORDER BY d."order";
```

A route that produced the wrong number of rows was mis-filtered; a route that
produced a single `manager` row hit the fallback.

## Related

- [/patterns/approval-chain.md](/patterns/approval-chain.md) — the chain shape itself
- [/patterns/configurable-approval-chain-scoped.md](/patterns/configurable-approval-chain-scoped.md) — the generic scoped variant used by Project CRM and Proposals
