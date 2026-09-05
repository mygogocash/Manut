# Per-business-unit stage — PR2 (write paths + board) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:test-driven-development` per task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** One card per (deal x business unit) on both pipeline boards, backed by write paths that keep the child rows and the deal roll-up in agreement on every mutation.

**Spec:** `docs/superpowers/specs/2026-08-25-per-business-unit-stage-design.md`
**Predecessor:** `docs/superpowers/plans/2026-08-25-per-bu-stage-pr1.md` (landed as #1139 + #1140)

## What PR1 actually left behind

Verified against `fd0a8b3e`, not assumed:

- `syncBusinessUnitRows` (`opportunity-business-units.repository.ts:117-152`) **never reads the deal**. `toAdd` is a pure set-difference against existing child rows, so a deal with zero rows and a deal with ten take the identical path: every tag seeds at `firstStage()` / `value 0`. It structurally cannot implement seed-from-deal.
- The seed-from-deal rule exists **once**, inlined at `backfillOpportunityBusinessUnits:263-281` — unexported, hardcoding `prisma`, no `tx` param, inside a page loop.
- **No down-propagation exists at all.** Nothing writes a deal-level edit onto child rows.
- `OpportunityRollup` (`crm-shared/opportunity-rollup.ts:24-32`) has 7 keys and is passed verbatim as a Prisma `data` payload. `probabilityCustom` is absent, so a recompute overwrites a rep's manual probability while leaving `probabilityCustom: true` stored. Live bug, PR2 owns it.
- No production code calls `syncBusinessUnitRows` or `recomputeOpportunityRollup` today.

## Decisions taken for PR2

| Question | Decision |
| --- | --- |
| PR shape | ONE PR, both CRMs, wiring and UI in separate commits so a staging anomaly stays attributable |
| Boot backfill | **Replaced** by lazy seed-on-read (precedent: `projectRepository.mirrorNativeProjectIfNeeded`) |
| Aggregate correctness under lazy seed | Roll-up query `LEFT JOIN`s children onto `unnest(business_units)` and **falls back to deal values** where no child row exists, so the number is correct regardless of seeding state |
| `probabilityCustom` | Wired into the roll-up (from the least-advanced row, same row as `stage`/`probability`) |
| `sortOrderWithinStage` | Becomes per-BU; deal-level value rolls up from the least-advanced row so legacy list ordering keeps working |
| Seed vs new-tag branch | Made **visible at the call site** — the helper returns which branch it took rather than deciding silently |

## Global constraints

- Every new exported helper takes an optional `tx?: Prisma.TransactionClient` and resolves it through the existing `client(tx)` pattern.
- Deal-level behaviour for an **untagged** deal must stay byte-identical. `computeOpportunityRollup` returning `null` for a childless deal is a load-bearing contract; do not weaken it.
- Both CRMs, every task. The Revenue mirror is verified clean today except `CODE_STAGE_SORT_ORDER` (`live: 45/closed_lost: 50` Sales vs `live: 50/closed_lost: 60` Revenue) which is **correct**, seeded that way by their own migrations. Do not "fix" it.
- `firstStage()` must resolve against the **calling CRM's** catalog (`opportunity_stage_config` vs `revenue_stage_config`). These are separate tables with identical shapes, so a copy-paste that forgets to swap the delegate type-checks and silently seeds Revenue rows at the Sales first stage. Revenue tests must use a catalog fixture whose `sortOrder` 0 key DIFFERS from Sales.
- No migration. Both child tables and all needed indexes shipped in PR1.

## Task list

### Task 1 — roll-up gains `probabilityCustom` + `sortOrderWithinStage` (pure, shared)
`crm-shared/opportunity-rollup.ts`. Both fields come from the least-advanced row, same row as `stage`. TDD; extend `opportunity-rollup.test.ts`. Assert the manual-probability case: a deal with `probabilityCustom: true` keeps flag and value in agreement after a recompute.

### Task 2 — extract seed-from-deal, add down-propagation, make the branch explicit
Per CRM adapter. Three new exports:
- `seedBusinessUnitRowsFromDeal(opportunityId, tx?)` — the ten-column copy from `backfill:263-281`, deduped tags, full `value` on the first tag and 0 on the rest. Idempotent (`skipDuplicates`).
- `propagateDealFieldsToChildren(opportunityId, patch, tx?)` — writes a deal-level edit down onto existing child rows. Must run BEFORE any recompute.
- `ensureBusinessUnitRows(opportunityId, tagOrder, tx?)` — the branch, returning `{ mode: "seeded" | "synced", added, removed }`. Zero child rows + non-empty tags -> seed from deal; otherwise -> existing sync semantics.

Re-scope `opportunity-business-units.test.ts:208`, which currently asserts zero-child-rows -> first-stage/value-0. That is the create-path corruption encoded as an expectation.

### Task 3 — wire the write paths (4 marked + 7 unmarked)
The four `TODO(PR2)` sites (`opportunities.service.ts:336, 436, 475, 522`, byte-identical in both services) plus:
- **M1** `businessUnitService.delete:135-158` — raw `array_remove` leaves orphaned child rows that still count toward `value` and `leastAdvanced`. Collect the affected ids, delete their child rows, recompute.
- **M2** `leadService.convert:456-476` — creates a **tagged** deal via `tx.opportunity.create`, bypassing the service. Already holds `tx`; best-positioned fix.
- **M3** `reorderWithinStage` — gains a `businessUnit` dimension; its "all rows in stageKey" check must compare the **child** stage. Array-form `$transaction` becomes callback form.
- **M5** `bulkUpdateStageConfigs` — changes the ranking every roll-up depends on, with no recompute. Bulk recompute of affected deals.
- M4 `syncAccountDeal` needs no change but is the best fixture for push-down with no tag info. M6 `archive`/M7 `delete` need none (cascade).

Create and update must **re-fetch after recompute** — `created`/`updated` are captured before it, and `notifyOpportunityCreated` would otherwise email the pre-roll-up stage.

### Task 4 — lazy seed replaces the boot backfill
Remove the `main.ts:53-60` fire-and-forget calls. Seed on first read in `findById` and in the per-BU card list (bounded to the loaded page). Delete the paged backfill and its paging tests; carry its "no money moves" invariant test onto `seedBusinessUnitRowsFromDeal`.

### Task 5 — API surface for the board (x2 CRMs)
1. Per-BU card list: one row per `(opportunityId, businessUnit)`, child progress + deal `name/currency/account/owner`, paginated per stage with its own `meta.total`.
2. Dual-count roll-up: per-stage card count + **distinct deal count** + per-currency sum of child value, via the `LEFT JOIN unnest(business_units)` fallback query.
3. Per-BU stage move: moves one child row, then recomputes. `PUT /opportunities/:id {stage}` must NOT be reused for a drop — it moves every unit.
4. Per-BU reorder over child `sortOrderWithinStage`.

### Task 6 — boards (x2 forked copies) — NOT STARTED

**Status at handoff:** tasks 1-5 are merged into the branch and green (220 files / 2320 tests). Task 6a (the web client) is done. The components themselves are untouched.

**Why this is bigger than it reads.** The change is to card IDENTITY, not to markup. `ColumnState` holds `Opportunity[]`; it has to hold `BusinessUnitCard[]`, keyed on the `(opportunityId, businessUnit)` pair rather than `id`. That ripples through:

- `emptyColumn()` / `ColumnState` (`pipeline-kanban.tsx:63`)
- the fetch effect — `listOpportunities` -> `listBusinessUnitCards`, `getOpportunityPipeline` -> `getBusinessUnitPipeline`
- all six drag handlers (`:498-563`), each of which currently passes a bare deal id through `dataTransfer`; they need the pair
- `moveOpportunity` (`:397`) -> `moveBusinessUnitCard`, and `persistReorder` (`:446`) -> `reorderBusinessUnitCards` with `cards` instead of `orderedIds`
- `reorderCard` / `reorderCardToEnd` (`:466`, `:487`) — index maths keyed on the pair
- the card JSX (~`:892`) — add the BU label via the existing `BusinessUnitChips`
- the column header (~`:825`) — dual counts, `cardCount` / `dealCount`
- everything above again in `components/sales-revenue/pipeline-kanban.tsx`, which is a fork, not a shared component

**Known traps for whoever picks this up:**

1. `updateOpportunity(id, { stage })` must NOT be used for a drag. It writes the deal, and the deal's stage is the least-advanced unit's, so it moves whichever card is furthest behind instead of the one under the cursor. Use `moveBusinessUnitCard`.
2. Column totals must come from `getBusinessUnitPipeline`, never from reducing the loaded cards — a column holds one page (CLAUDE.md).
3. A `synthesized: true` card has no child row yet. It is draggable (the move seeds it via `getById` first) but must not render as an error state.
4. The Unassigned column holds deals with NO units; those cards address `__none__` and the move falls through to a deal-level stage update. `BUSINESS_UNIT_UNASSIGNED` already exists client-side.
5. Neither kanban file has a single test today. The card-identity maths (reorder indices, pair keying) is where a test earns its keep.

Deferred with the board, deliberately:

- **M3** `reorderWithinStage` (the deal-level endpoint) stays in place and is now unused by the board. Remove it once nothing calls it.
- **M5** `bulkUpdateStageConfigs` changes the ranking every roll-up depends on without recomputing. Rare, admin-only, self-corrects on each deal's next write.
- `backfillOpportunityBusinessUnits` is now uncalled. Task 5a's projection made it unnecessary — an unseeded deal reads through to its own values — so it can be deleted with its paging tests, keeping the "no money moves" invariant on `seedBusinessUnitRowsFromDeal`.

### Task 6 original notes
`components/opportunities/pipeline-kanban.tsx` (41.0K) and `components/sales-revenue/pipeline-kanban.tsx` (39.7K) are forks, not a shared component, and **neither has a test today**. Native HTML5 DnD, no library. Per-BU cards labelled via the existing `BusinessUnitChips`; dual counts in the header; drag calls the new per-BU endpoints. Unassigned column reuses the existing `BUSINESS_UNIT_UNASSIGNED = "__none__"` sentinel.

### Task 7 — verification
`pnpm type-check && pnpm lint && pnpm test` from the repo root, plus scoped eslint on touched files. Baseline to beat: 212 files / 2194 tests green at `fd0a8b3e`.

## Risks specific to PR2

- **Green tests prove little here.** The reverted wiring passed because every fixture was an untagged deal, where recompute is a no-op. Every new test must use a **tagged** deal, and the seed-vs-new-tag cases need separate fixtures — one fixture cannot exercise both, which is how one uniform rule got written.
- **Nondeterministic tie-break.** `recomputeOpportunityRollup` reads children with **no `orderBy`**; two children sharing a stage and both absent from `businessUnits` collide at `MAX_SAFE_INTEGER` and resolve by DB row order. Untested. Add an `orderBy`.
- **`firstStage()` is not restricted to non-terminal stages.** An admin who gives `closed_lost` `sortOrder: 0` makes every newly tagged unit start closed-lost.
- **Card volume.** ~2 BUs per deal doubles card count. Fallback per spec is collapsing same-deal cards within a column, never reverting to one card per deal.
