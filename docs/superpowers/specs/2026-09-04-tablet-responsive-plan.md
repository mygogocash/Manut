# Tablet responsive support — measure, then fix primitives

**Status:** plan, not approved. No code written.
**Date:** 2026-09-04
**Approach:** A + B — measure first, then fix shared primitives, fixing only what
measurement confirms.

## What is already true

Tablet is not a blank slate, and a plan that ignores this will re-do or undo
working code.

- **The shell handles it.** `(dashboard)/layout.tsx:318` starts the sidebar
  collapsed to a 3rem icon rail between 768 and 1279, with the reasoning
  recorded inline: a 16rem sidebar plus content leaves the content column too
  narrow for the tables it holds. `collapsible="icon"` keeps every item
  reachable.
- **One breakpoint source.** `use-breakpoint.ts` exports `BREAKPOINTS` matching
  Tailwind exactly, so JS branches and `md:`/`lg:` prefixes cannot disagree.
- **Tables already scroll.** `ui/table.tsx:63` wraps in `overflow-x-auto`, so a
  wide table degrades to horizontal scroll rather than page overflow.
- **Dialogs are self-limiting.** `DialogContent`'s base carries
  `max-w-[calc(100%-2rem)]`, and dialogs are viewport-positioned rather than
  confined to the content column. Even the three `sm:max-w-3xl` dialogs (768px)
  are clamped to fit an iPad mini. **Dialog width is not a tablet defect** —
  this was my own initial assumption and the code disproved it.
- **Containers use max-widths, not fixed widths.** `page-container.tsx` uses
  `max-w-[1600px]`; `shared/modal.tsx` uses `sm:max-w-[Npx]`. Both shrink.

## The actual gap

Existing responsive tests are **phone-weighted**. Across nine files the viewport
widths are 320 (×7), 375 (×8), 390, 430 — 768 appears once, and 744, 810, 834,
1180 and 1366 not at all. Tablet behaviour is therefore *unverified* rather than
known-broken.

The risk band is **768–1279**: below `md` components use phone layouts, at `xl+`
they have room, and in between Tailwind's `md:` has fired so pages render
*desktop* tables and grids inside a ~700px column with the icon rail taking
3rem. Desktop layouts in a narrow column — not missing mobile styles.

## Phase A — measure

### Width matrix

Widths, not devices: the CSS cannot tell an iPad from an Android tablet, so
covering the widths covers both.

| Width | Why |
|---|---|
| 744 | iPad mini portrait — narrowest real tablet |
| 768 | `md` boundary, worst case: desktop styles fire at the narrowest width |
| 810 | iPad 10.9 portrait |
| 834 | iPad Air portrait |
| 1024 | iPad landscape, `lg` boundary |
| 1180 | iPad Pro 11 landscape |
| 1280 | `xl` boundary — sidebar expands, second worst case |

### What counts as a defect

Measured, not judged: page horizontal overflow > 0; any interactive control
clipped or outside the viewport; `scrollHeight > clientHeight` on a fixed-height
container; a primary action unreachable without horizontal scrolling.

### Surfaces

The list/board/detail surface of each top module — Investors, Sales CRM,
Projects, Accounting, HRMS, IT, Office — plus the four import-preview dialogs
flagged below.

### Constraint

Every surface is behind auth and **I cannot sign in** — entering credentials is
out of scope for me. Measurement needs either an authenticated browser session
the user drives, or a seeded test account used by the user. This is the one
dependency that blocks Phase A starting unattended.

## Candidate defects from static analysis

Not confirmed — these are where to point the measurement first.

| Site | Value | Concern |
|---|---|---|
| `office/asset-bulk-import-dialog.tsx:870` | `min-w-[900px]` | exceeds every tablet portrait width |
| `benefits/benefit-bulk-import-dialog.tsx:484` | `min-w-[800px]` | same |
| `accounting/journal-entries-import-dialog.tsx:732` | `min-w-[720px]` | exceeds 744 portrait once padding is counted |
| `expenses/[reportId]/page.tsx:636` | `min-w-[700px]` | detail page, not a dialog |
| `accounting/invoice-print.tsx:94` | `w-[800px]` | print layout — probably correct, verify only |

A `min-w` inside a scrolling ancestor is acceptable (horizontal scroll is a
legitimate table pattern). The same value inside a dialog that does not scroll is
a clipped control. Measurement distinguishes them; grep cannot.

## Phase B — fix primitives

Only what Phase A confirms. Ordered by leverage:

1. Import-preview tables — one shared scroll treatment rather than four.
2. Board column behaviour at 768–1024 — currently tuned for desktop column counts.
3. Form grids that step at `sm:` and never adapt again.
4. Any page-specific defect measurement turns up that no primitive covers.

## Testing

Extend the existing source-reading pattern (`investor-pipeline-responsive.test.ts`)
with tablet-band cases, and pin each confirmed defect with a test that fails
against the pre-fix source. Precedent: the tag-manager responsive test, where the
first assertion passed against broken code and only reverting the fix exposed it.

## Open questions

1. **Does the mobile dock appear on tablet?** The dock spec hides it at `md`, so
   768–1279 gets neither dock nor expanded sidebar — only the icon rail. That is
   defensible but should be decided, not inherited. Recommend deciding after
   Phase A shows how navigable the icon rail actually is at 768.
2. **Is landscape in scope**, or portrait only? The matrix above includes
   landscape widths; dropping them removes 1024/1180 and roughly halves the work.
