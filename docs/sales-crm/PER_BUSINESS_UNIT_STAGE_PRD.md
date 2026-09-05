# Per-business-unit stage on Sales / Sales Revenue opportunities

Status: **design, not implemented**. Owner: BD (Vivek). Drafted 2026-08-24.

> **Superseded in part, 2026-08-25.** The board-layout decision below — one card per deal at its
> least-advanced BU — was overridden by Kunanon: the board now renders **one card per (deal x
> business unit)**, so a deal whose units disagree appears in both columns. The open drag-and-drop
> question is retired by that change rather than answered, because every card then maps to exactly
> one BU. Everything else in this document stands, and the remaining open questions are now settled:
> `value` is per-BU (summed to the deal) and all BUs share one stage catalog per CRM. One further
> correction: `currency` is **not** per-BU. Summing BU values across currencies would make every
> deal total meaningless, and v2 has no FX, so currency stays on the deal and BU values are
> denominated in it. See `docs/superpowers/specs/2026-08-25-per-business-unit-stage-design.md`.

## Problem

An opportunity carries several business units as tags (`businessUnits String[]`) but exactly one
`stage`. Vivek's case: **Prepone** is tagged Onewave, Onewave Revenue and ARIA; Onewave Revenue is
already **Live** while ARIA is still at **Proposal**. The board can only show one of those, so the
deal reads as fully Live and ARIA's outstanding work is invisible.

Everything that describes "how far along and how big" is currently opportunity-level:
`stage`, `probability` / `probabilityCustom`, `value` / `currency`, `closeDate`, `launchDate`,
`revenueLaunchDate`, `sortOrderWithinStage`, `lostReason`, `remindersSent`.

## Decisions taken

| Question                   | Decision                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Which fields go per-BU     | stage, probability, value + currency, closeDate, launchDate, revenueLaunchDate                                                 |
| "All deals" board position | ~~ONE card per deal, placed by its **least-advanced** BU, with per-BU stage chips~~ → **one card per (deal x BU)**, 2026-08-25 |
| Deal-level `stage`         | **Kept**, auto-maintained as a roll-up, so existing consumers keep working                                                     |
| Scope                      | Sales CRM **and** Sales Revenue CRM together                                                                                   |

## Data model

New child table per CRM — `crm_opportunity_business_units` and
`crm_revenue_opportunity_business_units`:

```
opportunityId  String        // FK, onDelete: Cascade
businessUnit   String        // CrmBusinessUnit.code, NO FK (matches the existing tag convention)
stage          String        @default("qualified")
probability    Int           @default(20)
probabilityCustom Boolean    @default(false)
value          Decimal       @db.Decimal(15, 2) @default(0)
currency       String        @default("USD")
closeDate         DateTime?  @db.Date
launchDate        DateTime?  @db.Date
revenueLaunchDate DateTime?  @db.Date
lostReason     String?
sortOrderWithinStage Int     @default(0)
remindersSent  Json          @default("[]")
lastReminderSentAt DateTime?
@@unique([opportunityId, businessUnit])
@@index([businessUnit, stage])
@@index([stage, sortOrderWithinStage])
```

`Opportunity.businessUnits` stays as the tag array and remains the source of truth for **which**
units are on the deal; the child rows are created/removed to match it. Keeping the array avoids
rewriting every `{ has: code }` filter and the `__none__` Unassigned sentinel.

## Roll-up rules — REVIEW THESE

The deal-level fields become derived. Recomputed in ONE place on every write that touches a child
row or the tag array (`recomputeOpportunityRollup(opportunityId, tx)`), never ad hoc.

| Deal field          | Rule                                                                      | Rationale                                                                                 |
| ------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `stage`             | stage of the **least-advanced** BU, by `OpportunityStageConfig.sortOrder` | nothing reads as done while a BU is behind                                                |
| `probability`       | the least-advanced BU's probability                                       | stays consistent with the stage shown                                                     |
| `value`             | **SUM** of BU values                                                      | a deal's worth is the sum of its parts; per-BU view totals then sum that BU's column only |
| `closeDate`         | **latest** BU close date                                                  | the deal is contractually done when the last BU closes                                    |
| `launchDate`        | **earliest** non-null BU launch date                                      | "first go-live" — matches how the card reads today                                        |
| `revenueLaunchDate` | **earliest** non-null                                                     | as above                                                                                  |
| `lostReason`        | set only when **every** BU is `closed_lost`                               | a single lost BU does not lose the deal                                                   |

Open question for BD: **is `value` really a sum?** If reps have been entering the whole-deal value
on a deal tagged with 3 BUs, backfilling that value onto each BU would triple the pipeline. The
backfill below assumes otherwise — see Migration.

## Board semantics

- **Per-BU views** (`/sales?tab=pipeline&businessUnit=<code>`) read child rows directly: Prepone
  appears in **Live** under Onewave Revenue and in **Proposal** under ARIA. Column counts and
  totals are that BU's rows only, so they are exact. This is the view Vivek needs and needs no new
  screen — the nav children already exist.
- ~~**All deals** shows one card per deal at its least-advanced BU stage, with a chip per BU showing
  that BU's stage. Counts and $ totals stay one-card-one-deal.~~ **Superseded 2026-08-25**: All
  deals shows **one card per (deal x BU)**, each card labelled with its unit, and column headers
  count both cards and distinct deals.
- ~~**Drag-and-drop**: on All deals, dragging is ambiguous — proposal: it moves **every** BU to the
  target stage, with a confirm naming how many BUs will move.~~ **Retired 2026-08-25**: with one
  card per BU, dragging always moves that card's BU. In a per-BU view it always did.
- The card's per-BU chips are the edit affordance: click a chip → stage picker for that BU.

## Migration and backfill

1. Create both tables.
2. For every existing opportunity, insert one child row per entry in `businessUnits`, copying the
   deal's current `stage`, `probability`, `probabilityCustom`, `closeDate`, `launchDate`,
   `revenueLaunchDate`, `lostReason`, `sortOrderWithinStage`.
3. `value`: copy the deal value onto the **first** BU (by the tag array's order) and `0` onto the
   rest, so the roll-up sum reproduces today's deal value exactly and no pipeline total moves on
   deploy. Reps then split it properly. _This is the safe choice; confirm with BD._
4. Deals with an EMPTY `businessUnits` array get **no** child rows. The roll-up must therefore
   treat "no children" as "keep the deal's own stored values" rather than resetting them to
   defaults, or every untagged deal silently reverts to `qualified` / `0`.
5. Idempotent: `INSERT … ON CONFLICT (opportunity_id, business_unit) DO NOTHING`, and guard the
   whole thing on `information_schema` so a re-run is safe.

**Seed the stage/BU catalogs in code, not only in this migration** — see
`common/utils/lazy-catalog.ts`. A migration-only INSERT never runs on staging (`db:push`), which is
exactly why the Investor board rendered zero columns.

## Cron / reminders

`crm-reminders.ts` currently debounces close-date reminders on `Opportunity.remindersSent` and skips
terminal stages. With per-BU close dates it must iterate child rows: a deal can need a reminder for
ARIA while Onewave Revenue is already `live`. Terminal-skip becomes per-BU. The debounce marker
moves to the child row (kept there in the schema above).

## Phasing

1. **PR1 — foundation.** Both tables, the backfill migration, `recomputeOpportunityRollup`, and
   child rows kept in sync with the tag array. No UI. Roll-up equality proven by tests against the
   pre-migration values.
2. **PR2 — read + edit.** Per-BU views read child rows; per-BU chips with a stage picker; per-BU
   fields in the opportunity form; per-BU column totals.
3. **PR3 — the rest.** Drag-and-drop semantics, reminders per BU, exports, bulk actions, and the
   Revenue CRM mirror if it is not already carried by PR1/PR2.

## Risks

- **Denormalization.** `Opportunity.stage` being both stored and derived is the main hazard; every
  write path must funnel through the one recompute helper or the board and the chips disagree.
- **Totals double-counting.** Whether `value` is per-BU or whole-deal decides every pipeline total
  in both CRMs. Getting it wrong is the "paginated aggregates" class of bug the repo has been bitten
  by before.
- **Two CRMs at once.** `revenue-opportunities` mirrors this module; the same change lands twice and
  the mirror has historically drifted.
