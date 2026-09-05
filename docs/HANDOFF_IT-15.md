# Handoff — IT-15 · Expense (Allowance) approval chain

Last updated: 2026-05-20
Owner: Kunanon (kunanon@thebinaryholdings.com)
Ticket: IT-15 (Expense / Allowance approval — Kanban "IT team" / Open)

Branch suggestion: `feat/it-15-allowance-approval-chain`
Status: **Implementation complete, ready for review + HR configuration.**

---

## TL;DR

Allowance expense reports (Meal / Transportation / Phone) used to
short-circuit to `reimbursed` on submit and only emailed the finance
desk for FYI. Per the ticket, they now flow through a dedicated
3-stage approval chain:

1. **First Approval** — Khun Sarah
2. **Payroll Filled** — payroll team approves after entering the
   figure into the payroll system
3. **Final Sign-off** — Kit (status flips to `reimbursed`)

Old behaviour is kept as a fallback for any deployment that hasn't
configured an allowance chain yet, so this change is forward-only —
in-flight allowance reports already marked `reimbursed` are untouched.

---

## Why this change

- HR wants visible sign-off on monthly allowances, not silent fast-path.
- The "Sara" finance-desk FYI email was the only audit hook today;
  Khun Sarah now needs to actively approve allowance amounts before
  payroll enters them.
- After payroll transfer, Kit closes the report — provides a clean
  audit trail tied to the same ExpenseApprovalDecision snapshot model
  travel + expense reports already use.

The codebase already had a full multi-stage approval primitive
(`ExpenseApprovalStep` + `ExpenseApprovalDecision` w/ amount-band +
category routing); this PR wires the existing primitive to the
allowance flow rather than adding new infrastructure.

---

## What changed

### Database

| File | Change |
|------|--------|
| `packages/database/prisma/migrations/20260711000000_allowance_approval_chain/migration.sql` | New idempotent migration. Creates 3 ExpenseCategory rows (`Meal Allowance`, `Transportation Allowance`, `Phone Allowance`) with `is_allowance = true`. Inserts 3 ExpenseApprovalStep rows at orders 100 / 101 / 102 with `category_filter = ["allowance"]` and `approver_user_id = NULL`. Narrows the seeded `Direct Manager` / `Skip-Level Manager` defaults from "all categories" to `["general", "business_or_bd"]` so they don't trip on allowance reports — only the as-shipped rows with an empty filter are touched, custom HR-configured rows stay put. |
| `packages/database/prisma/seed.ts` | Mirrors the migration via `prisma.expenseCategory.upsert` and `prisma.expenseApprovalStep.upsert` so fresh dev seeds get the chain. |

No Prisma schema changes — all new state slots into existing models.

### Backend

| File | Change |
|------|--------|
| `apps/api/src/modules/expenses/expenses.service.ts` | Added `hasAllowanceApprovalChain()` helper. `submitReport` now branches: allowance-only + chain configured → override `report.category` to `"allowance"` and fall through to the existing snapshot flow so Sarah / Payroll / Kit get queued. Allowance-only + no chain → legacy `finaliseAllowanceReport` fast-path. Mixed reports → unchanged generic chain. |
| `apps/api/src/modules/expenses/expenses.validation.ts` | Extended the `EXPENSE_CATEGORIES` enum + create/update Zod schemas to include `"allowance"`. The user-facing report dropdown is unaffected (hardcoded literals); only the admin step-filter UI gains the new option. |

### Frontend

| File | Change |
|------|--------|
| `apps/web/src/services/expense.service.ts` | `EXPENSE_CATEGORIES` and `EXPENSE_CATEGORY_LABEL` now include `"allowance" → "Allowance"`. This unblocks the admin step dialog from filtering by the new bucket and aligns the `ExpenseReportListItem.category` type with values the API can now return. |

### Tests

| File | Change |
|------|--------|
| `apps/api/src/modules/expenses/__tests__/expenses-allowance-chain.test.ts` | New focused suite covering the three routing branches of `submitReport`. All three cases green. |

---

## What HR must do post-merge

The chain ships with `approver_user_id = NULL` on every step. Until
those slots are filled, allowance reports submitted after deploy will
sit in `submitted` status waiting on an approver that doesn't exist
yet — actionable only via the `expense:hr-approve` escape hatch. To
avoid that gap, complete this checklist on the morning of deploy:

1. Open `/expenses/approval-steps` in the portal as an admin.
2. For each of the three rows:
   - `Allowance — First Approval (Sarah)` → set approver = Khun Sarah.
   - `Allowance — Payroll Filled` → set approver = payroll lead (the
     user who fills the payroll figure each cycle — currently the
     ticket author).
   - `Allowance — Final Sign-off (Kit)` → set approver = Kit.
3. Confirm `Active` toggle is ON for all three.
4. Submit a self-test allowance report with one line in a Meal /
   Transportation / Phone Allowance category and walk it through all
   three stages.

---

## Verification (local)

```bash
pnpm db:generate              # regenerate Prisma client (already done if you ran type-check)
pnpm db:migrate               # applies 20260711000000_allowance_approval_chain
pnpm db:seed                  # idempotent — adds the categories + steps to local
pnpm --filter @nexora/api test -- expenses-allowance-chain
pnpm type-check               # full monorepo
```

Local test result on this branch:

```
Test Files  1 passed (1)
     Tests  3 passed (3)
```

All three branches covered:

- Allowance-only report + chain configured → snapshots 1 decision row,
  status `submitted`, no `reimbursed` write.
- Allowance-only report + no chain → legacy fast-path; status flips
  straight to `reimbursed` inside a transaction.
- Mixed report (one allowance + one non-allowance) → ignores allowance
  routing entirely; generic chain runs.

---

## Rollout sequence

1. Open PR `feat(expenses): add 3-stage allowance approval chain (IT-15)`.
2. CI runs `type-check`, `lint`, `test`, `brand-drift` per the PR-checks
   workflow (see `CLAUDE.md`).
3. On merge, GitHub Actions runs `Apply Prisma migrations to prod DB`
   **before** the Docker build, so the migration lands before the new
   service code goes live.
4. HR completes the post-merge checklist above to wire Sarah and Kit.
5. Announce the change to Khun Sarah, payroll, Kit — first allowance
   submission post-deploy should be in lock-step with their account
   wiring.

---

## Backwards compatibility

- **In-flight reports already `reimbursed`**: not touched. The
  migration does not re-open closed allowance reports.
- **Allowance categories outside Meal / Transportation / Phone**: if
  HR ever flagged additional categories as `isAllowance = true`,
  those reports continue using the fast-path until HR adds them to
  the chain's `categoryFilter` via the admin UI.
- **Mixed reports**: unchanged — still flow through the generic
  manager / amount-band chain so the line manager keeps seeing
  non-allowance lines.
- **Pre-existing custom HR chains**: the migration only narrows
  `category_filter` on rows that match the seeded defaults exactly
  (name + approver type + still empty filter). Custom configurations
  are not modified.

---

## Risks / follow-ups

- If HR delays the approver wiring, allowance reports stack up. The
  `expense:hr-approve` escape hatch can clear them, but the UX will be
  poor. Mitigation: deploy + wire in the same window, or set the
  three steps to `isActive = false` until ready.
- "Sara" appears in code comments / desk-FYI emails as the legacy
  recipient. Once the chain is live, those comments are stale but
  harmless — leave them for the historical context this PR
  documents, or rewrite in a follow-up if HR confirms Sara and Sarah
  are the same person.
- The new "Allowance" option now appears in the admin step-filter
  UI. HR should *not* assign other (non-allowance) steps to the
  `allowance` bucket — those steps wouldn't fire on regular reports.
  Consider a follow-up that visually segregates allowance-only steps
  in the admin list.

---

## Files touched

```
packages/database/prisma/migrations/20260711000000_allowance_approval_chain/migration.sql   (new)
packages/database/prisma/seed.ts
apps/api/src/modules/expenses/expenses.service.ts
apps/api/src/modules/expenses/expenses.validation.ts
apps/api/src/modules/expenses/__tests__/expenses-allowance-chain.test.ts                    (new)
apps/web/src/services/expense.service.ts
docs/HANDOFF_IT-15.md                                                                       (new — this file)
```
