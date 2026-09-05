# Per-business-unit stage on Sales and Sales Revenue opportunities

Status: **design, approved, not implemented**. Drafted 2026-08-25.
Supersedes the board-layout decision in `docs/sales-crm/PER_BUSINESS_UNIT_STAGE_PRD.md`.

## Problem

An opportunity carries several business units as tags (`businessUnits String[]`) but exactly one
`stage`. MTN is tagged Onewave and Onewave Revenue; Onewave is already **Live** while Onewave
Revenue is still at **Proposal**. The board can only show one of those, so the deal reads as
whichever stage won, and the other unit's outstanding work is invisible.

Everything describing "how far along, and how big" is currently opportunity-level: `stage`,
`probability` / `probabilityCustom`, `value` / `currency`, `closeDate`, `launchDate`,
`revenueLaunchDate`, `sortOrderWithinStage`, `lostReason`, `remindersSent`.

## Decisions

| Question                        | Decision                                                                                          | Source                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Which fields go per-BU          | stage, probability, value, closeDate, launchDate, revenueLaunchDate — **not** currency, see below | PRD 2026-08-24, amended 2026-08-25 |
| Is `value` per-BU or whole-deal | **Per-BU split**; deal value = SUM of BU values                                                   | approved 2026-08-25                |
| Stage catalog scope             | **One shared catalog per CRM**; all BUs pick from it                                              | approved 2026-08-25                |
| Board layout                    | **One card per (deal x business unit)**                                                           | approved 2026-08-25, overrides PRD |
| Drag-and-drop                   | Drag always moves that card's BU — no special cases                                               | follows from board layout          |
| Deal-level `stage`              | **Kept**, auto-maintained roll-up, so existing consumers keep working                             | PRD 2026-08-24                     |
| Scope                           | Sales CRM **and** Sales Revenue CRM together                                                      | PRD 2026-08-24                     |

### Why the board layout changed

The PRD specified one card per deal, parked at its least-advanced BU, with the other units reduced
to chips. That hides the exact thing this feature exists to surface: a deal whose units disagree
reads as a single stage, and you have to notice a chip to learn otherwise.

One card per (deal x BU) shows the disagreement directly — MTN appears in Live _and_ in Proposal —
and it removes two problems rather than adding one:

- **Drag stops being ambiguous.** Under the PRD's layout, dragging a multi-BU card had no defined
  meaning, and the PRD left it open (move every BU behind a confirm, or disable dragging). With one
  card per BU, every card maps to exactly one BU and drag always means the same thing. The open
  question disappears instead of being answered.
- **One board implementation instead of two.** A per-BU view becomes the same board filtered to one
  BU, not a separate rendering path.

The cost is card volume and repeated names, addressed under Board semantics below.

## Data model

A child table per CRM — `crm_opportunity_business_units` and
`revenue_opportunity_business_units`:

```prisma
opportunityId        String    // FK, onDelete: Cascade
businessUnit         String    // CrmBusinessUnit.code, NO FK (matches the existing tag convention)
stage                String    @default("qualified")
probability          Int       @default(20)
probabilityCustom    Boolean   @default(false)
value                Decimal   @db.Decimal(15, 2) @default(0)
closeDate            DateTime? @db.Date
launchDate           DateTime? @db.Date
revenueLaunchDate    DateTime? @db.Date
lostReason           String?
sortOrderWithinStage Int       @default(0)
remindersSent        Json      @default("[]")
lastReminderSentAt   DateTime?

@@unique([opportunityId, businessUnit])
@@index([businessUnit, stage])
@@index([stage, sortOrderWithinStage])
```

`Opportunity.businessUnits` stays as a tag array and remains the source of truth for **which** units
are on a deal; child rows are created and removed to match it. Keeping the array avoids rewriting
every `{ has: code }` filter and the `__none__` Unassigned sentinel.

`businessUnit` has no foreign key, matching how the tag array already references
`CrmBusinessUnit.code`. Renaming a BU code therefore has to update both the array and the child
rows — the same constraint that exists today.

### Currency stays deal-level

The PRD listed `currency` among the per-BU fields. It is deliberately **not** on the child row here.

Deal `value` is the SUM of its BU values. If two BUs on one deal carried different currencies, that
sum would be meaningless — USD 40,000 + THB 40,000 is not 80,000 of anything — and Sales CRM v2 has
no FX by design ("per-Opportunity currency, no FX in v2", `sales-crm.prisma`). Per-BU currency would
therefore either silently produce wrong pipeline totals or force an FX layer this feature does not
need.

So `Opportunity.currency` remains the one currency for the deal, and every child row's `value` is
denominated in it. Splitting a deal across currencies stays as impossible as it is today.

### Adding and removing a business unit

- **Adding a BU tag** creates a child row at the **first stage** in the catalog (`sortOrder` 0) with
  `value` 0, not inheriting the deal's current stage. A unit that was just added has not done the
  work the deal's other units have; starting it at Live because a sibling is Live would be a lie,
  and the roll-up would then hide that the new unit has not started.
- **Removing a BU tag** deletes its child row, and that unit's stage and value history goes with it.
  Re-adding starts fresh at the first stage. If history matters later, the child row grows a
  `removedAt` instead — out of scope here.

## Roll-up rules

Deal-level fields become derived. Recomputed in ONE place on every write that touches a child row or
the tag array — `recomputeOpportunityRollup(opportunityId, tx)` — never ad hoc.

| Deal field          | Rule                                                                                                                     | Rationale                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `stage`             | stage of the **least-advanced** BU, by `OpportunityStageConfig.sortOrder`; ties resolve to the BU first in the tag array | nothing reads as done while a BU is behind                              |
| `probability`       | the least-advanced BU's probability                                                                                      | stays consistent with the stage shown                                   |
| `value`             | **SUM** of BU values                                                                                                     | per-BU column totals then sum that column only, with no double counting |
| `closeDate`         | **latest** BU close date                                                                                                 | the deal is contractually done when the last BU closes                  |
| `launchDate`        | **earliest** non-null BU launch date                                                                                     | "first go-live" — matches how the card reads today                      |
| `revenueLaunchDate` | **earliest** non-null                                                                                                    | as above                                                                |
| `lostReason`        | set only when **every** BU is `closed_lost`                                                                              | a single lost BU does not lose the deal                                 |

Deal-level `stage` no longer drives board placement. It is still maintained because reports, exports,
the deal detail header, the `@@index([stage])` queries and every existing consumer read it.

**Deals with no business units get no child rows.** The roll-up must therefore treat "no children" as
"keep the deal's own stored values" rather than resetting to defaults — otherwise every untagged deal
silently reverts to `qualified` / 0 on the first recompute.

## Board semantics

- **One card per (deal x business unit).** MTN tagged Onewave + Onewave Revenue renders two cards:
  one in Live, one in Proposal. A deal with no BUs renders one card under Unassigned.
- **Each card is labelled with its BU** — "MTN · Onewave" — so a repeated deal name across columns
  reads as two units of one deal rather than duplicated data.
- **Column headers count both**: "12 cards · 9 deals". The card count is what you see; the deal count
  is what people mean when they ask how big the pipeline is.
- **Column value totals** sum that column's card values. Exact, because value is per-BU.
- **Per-BU views** (`/sales?tab=pipeline&businessUnit=<code>`) are the same board filtered to one BU.
- **Drag** moves that card's BU stage. No confirm, no disabled cards, no special case.
- `sortOrderWithinStage` lives on the child row, so manual ordering is per-BU-per-column.

## Migration and backfill

1. Create both tables.
2. For every existing opportunity, insert one child row per entry in `businessUnits`, copying the
   deal's current `stage`, `probability`, `probabilityCustom`, `closeDate`, `launchDate`,
   `revenueLaunchDate`, `lostReason`, `sortOrderWithinStage`.
3. `value`: copy the deal value onto the **first** BU (by the tag array's order) and `0` onto the
   rest, so the roll-up sum reproduces today's deal value exactly and **no pipeline total moves on
   deploy**. Reps split it properly afterwards.
4. Deals with an EMPTY `businessUnits` array get **no** child rows.
5. Idempotent: `INSERT … ON CONFLICT (opportunity_id, business_unit) DO NOTHING`, with the whole
   thing guarded on `information_schema` so a re-run is safe.

**Seed the stage and BU catalogs in code, not only in a migration.** Staging syncs with
`pnpm db:push:staging`, which reconciles the schema and never executes migration SQL, so a
migration-only INSERT never runs there. Use `ensureCatalogSeeded` from
`apps/api/src/common/utils/lazy-catalog.ts`. This is exactly why the Investor board once rendered
zero columns.

## Cron and reminders

`crm-reminders.ts` debounces close-date reminders on `Opportunity.remindersSent` and skips terminal
stages. Both become per-BU: a deal can need a reminder for Onewave Revenue while Onewave is already
`live`. Debounce state moves to the child row.

## Sequencing

1. **PR1 — schema, roll-up, backfill. No UI.** Deal-level behaviour is identical to today, so this
   is provably a no-op from the user's side and can land independently.
2. **PR2 — board.** One card per (deal x BU), BU-labelled cards, dual column counts, per-BU totals,
   per-BU editing, drag.
3. **PR3 — the rest.** Per-BU reminders, exports, bulk actions, and the Revenue CRM mirror if it is
   not already carried by PR1/PR2.

## Testing

- Roll-up helper: unit tests per rule, written before the implementation.
- The "no children → keep stored values" case gets its own test; it is the silent-corruption path.
- Backfill: a test asserting total pipeline value is unchanged across the migration.
- Board: card count and column totals for a multi-BU deal.
- Both CRMs, since `revenue-opportunities` mirrors `opportunities` and the mirror has drifted before.

## Risks

- **Denormalization.** `Opportunity.stage` being both stored and derived is the main hazard. Every
  write path must funnel through the one recompute helper, or the board and the deal record
  disagree — silently.
- **Totals double-counting.** Whether `value` is per-BU or whole-deal decides every pipeline total in
  both CRMs. Per-BU is chosen; the first-BU backfill is what keeps deploy day a no-op.
- **Card volume.** 50 deals averaging 2 BUs renders ~100 cards. If the board gets unreadable, the
  fallback is collapsing same-deal cards within a column, not reverting to one card per deal.
- **Two CRMs at once.** The same change lands twice and the mirror has historically drifted.

## Open

- Whether reps want a "split value evenly across BUs" helper after the first-BU backfill, or prefer
  to enter each BU's value by hand. Not a blocker for PR1.

## Deviation from plan (2026-08-25 fix wave)

Write-path wiring (Task 5 in the PR1 plan — funneling `OpportunityService.create` / `update` /
`closeLost` / `reopen` through `syncBusinessUnitRows` then `recomputeOpportunityRollup`) was
implemented, then reverted on `main` (`6e43353d`) and moved to PR2. It corrupted tagged deals in two
ways:

- **On create**, `syncBusinessUnitRows` sees a brand-new deal with no child rows yet, so it treats
  every submitted tag as newly added and seeds each one at `firstStage()` with value 0. Recompute
  then rolls that blank state back onto the stage/value/dates the rep just submitted — a deal
  created at `negotiation` for 500000 persisted as `qualified` / 0 / null.
- **On every edit of an already-tagged deal**, nothing writes the deal-level change DOWN onto the
  child rows first, so recompute reads the stale child rows and overwrites the edit with an outdated
  roll-up. Only untagged deals (where recompute is a no-op) were unaffected, which is why the test
  suite stayed green while this shipped.

**Root cause:** the rule above — "a newly tagged BU starts at the first stage with value 0" — was
written for the _backfill_ case, where a deal has no child rows yet and is being seeded from its own
already-correct deal-level fields for the very first time (see backfill, above: full value on the
first tag, 0 on the rest — an exact reproduction, not a reset). The spec never distinguished that
from the _write-path_ case, where a deal already has (or is only now getting) child rows and a
genuinely brand-new tag on it should start at 0 without disturbing anything else. The reverted wiring
applied the seed-shaped rule uniformly, so a first-time-tagged create used it to blank the very deal
it should have been reproducing.

PR2 must not inherit this: it needs to seed a tagged deal's _first_ set of child rows FROM the deal
(mirroring the backfill), and only apply "new tag → first stage / value 0" to a tag added to a deal
that already carries child rows — plus propagate deal-level edits down onto existing child rows
before recomputing, so recompute never overwrites a fresh write with a stale roll-up.
