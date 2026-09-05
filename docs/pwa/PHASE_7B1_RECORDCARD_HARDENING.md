# Phase 7B-1 — RecordCard Action Visibility Hardening

**Status:** complete.
**Character:** one-condition fix to a shared component, plus the tests that pin it.
**No API change. No database change. No new dependency. No production surface behaves differently.**

---

## 1. Issue discovered

Found during Phase 7B-0 (§15.4) and deferred to here.

`RecordCard` has two expansion modes. In `row` mode, the action bar was gated on
`expanded`, so a card's **actions were hidden until the record was opened**.

That is the Phase 7A defect — a buried Approve — arriving again through the other
expand mode. The action role added in 7A exists precisely to keep a decision on the face
of a card; `row` mode quietly undid it.

**It is latent.** Neither production consumer passes `expandMode`, so nothing that ships
today is affected. That is the reason to fix it rather than a reason not to: the next
adopter would inherit the defect silently, and the phase that introduced the action role
would be the one that left the trap.

---

## 2. Reproduction

Written **before** the fix and confirmed failing:

```tsx
render(
  <RecordCard {...props} expandMode="row"
              actions={<button type="button">Approve</button>} />,
);
expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
```

```
× shows the action while collapsed, in row mode
  TestingLibraryElementError: Unable to find an accessible element
  with the role "button" and name "Approve"
```

No existing test was modified to produce that failure.

---

## 3. Root cause

```tsx
{actions && (expandMode === "button" || expanded) && ( … )}
```

The action bar reused the **same** condition as the field list directly above it:

```tsx
fields && … && (expandMode === "button" || expanded) && <FieldList … />
```

For the fields that condition is correct and deliberate — in `row` mode the fields *are*
the record's detail, and hiding them is what keeps a collapsed row to two lines. Copying
it onto the actions read like symmetry and was a category error: **an action bar is not
detail.** It is what a person came to the card to use.

---

## 4. Intended behaviour

| | Collapsed | Expanded |
|---|---|---|
| Title / badge | shown | shown |
| **Actions** | **shown** | shown (same instance) |
| Fields | `row`: hidden · `button`: shown | shown |
| Details | hidden | shown |

**Actions only** were promoted. Non-action fields remain governed by the existing
expansion rules — promoting those too would flatten `row` mode into `button` mode and make
every collapsed card as tall as an expanded one.

---

## 5. Implementation

One condition removed, in the shared component, reusing the existing action bar:

```diff
-{actions && (expandMode === "button" || expanded) && (
+{actions && (
```

Nothing else changed — no new component, no second action area, no duplicate render, no
consumer workaround, no `stopPropagation`.

**Why this cannot affect what ships:** in `button` mode the removed condition
`expandMode === "button" || expanded` was **always true**, because its left operand was
always true. Removing an always-true guard is a no-op there. Both production consumers use
`button` mode, so the fix is provably inert in production and active only on the path
nothing uses yet.

### Files changed

| File | Change |
|---|---|
| `components/shared/responsive/record-card.tsx` | the condition above, plus the comment explaining why fields and actions gate differently |
| `components/shared/responsive/__tests__/design-system.test.tsx` | +15 tests |

No files created.

---

## 6. Existing consumers audited

Every `RecordCard` consumer in the app — **two**:

| Consumer | `expandMode` | Actions | Effect of this change |
|---|---|---|---|
| `components/projects/project-mobile-card.tsx` (Phase 7) | not passed → `button` | yes | none |
| `components/shared/data-table.tsx` card path (Phase 1 / 7B-0) | not passed → `button` | yes, when a column declares `mobileRole: "actions"` | none |

`row` mode appears **only in Phase 2's own tests**. No route, no module, no dialog uses it.

---

## 7. Interaction safety

`RecordCard` was already safe structurally and stayed that way: the card root is a plain
`<div>`, the row toggle is its own `<button>` wrapping only the heading, and the action bar
is a **sibling** of both. So the fix adds no event handling.

Verified in both directions:

- act → does not expand, does not navigate
- expand → does not act
- open record → does not act
- an action's nearest `button` ancestor is itself (no interactive nesting)

**No `stopPropagation` was added anywhere in this phase**, and none exists in `RecordCard`.

---

## 8. Touch targets

Unchanged from Phase 7B-0 — the `min-h-11` / `min-w-11` floor already lives on the action
bar, which is the element this fix now renders earlier. Measured 44px in `row` mode at
320/375/430/768/1440/1920.

Desktop **table** sizing is untouched: a `RecordCard` is only rendered in card mode, and in
production that is below the breakpoint. The 24px table button was confirmed unchanged in
Phase 7B-0 (`identical: true` against a control table at 1280 and 1920).

---

## 9. Accessibility

- action has an accessible name; a button stays a `<button>` and a link stays an `<a>` with its `href` intact (both tested)
- the row toggle keeps `aria-expanded` and its accessible name
- the action is focusable **without expanding** — tested by focusing it on a collapsed card
- focus order follows DOM order: heading/toggle, then expander content, then actions
- no nested interactive controls

**No automated accessibility scanner was run, so no WCAG conformance is claimed.** The 44px
figure is WCAG 2.5.5 / Apple HIG, measured directly.

---

## 10. Tests

**+15; 2,526 pass (1,958 API + 568 web); none weakened.**

`design-system.test.tsx` grew from 34 to 49.

| Group | Covers |
|---|---|
| the defect | action present while collapsed in `row` mode (the reproduction) |
| collapsed | action visible, enabled and focusable without expanding; non-action fields still hidden |
| expanded | action still visible, still exactly one instance; fields and details appear |
| toggling | expands and collapses; both directions |
| separation | act ↛ expand, expand ↛ act, no interactive nesting |
| multiple actions | Edit + Delete, order preserved, independent, no duplication |
| element types | a link stays a link with its `href` |
| edge | a card with nothing to expand still shows its action |
| other modes | `loading`, `disabled`, `error` — all three pinned (§12) |
| button mode | the production path is unchanged |

### Regressions (Steps 15–17)

| Suite | Result |
|---|---|
| Project Requests (Phase 7A) | 13/13 pass — cards, approval actions, expansion, tablet breakpoint |
| Project CRM (Phase 7) | 12/12 pass — `project-mobile-card` |
| DataTable (Phase 7B-0) | 31/31 pass — `mobileRole`, `cardBreakpoint`, defaults, desktop |
| DataTable desktop (pre-existing) | 14/14 pass, untouched |

---

## 11. Browser verification

Temporary harness (deleted; no data read or written) rendering three cards: `row` + actions,
`button` + actions, and `row` with no actions. Hostile content included a 62-character
unbroken string.

| Width | `row` actions | Touch target | `button` card | Page overflow | Uncontained |
|---|---|---|---|---|---|
| 320 | 2 visible collapsed | 44px | 2 visible | 0 | 0 |
| 375 | 2 | 44px | 2 | 0 | 0 |
| 430 | 2 | 44px | 2 | 0 | 0 |
| 768 | 2 | 44px | 2 | 0 | 0 |
| 1440 | 2 | 44px | 2 | 0 | 0 |
| 1920 | 2 | 44px | 2 | 0 | 0 |

At 320px the mode distinction was confirmed intact: `row` reported `ownerVisible: false`
while `button` reported `ownerVisible: true`. Only actions moved.

Expansion was confirmed live — `aria-expanded` false → true, Owner and Notes appearing, and
the action count staying at **2** rather than doubling.

**Honest note on method:** synthetic clicks dispatched into this browser pane did not
reliably reach React's handlers, so expansion was triggered by invoking the button's own
attached handler after confirming React had hydrated (`__reactProps` present, real
`<button>`, not disabled). The authoritative click-path coverage is the `fireEvent` tests
in §10, which exercise it normally.

**390, 834, 1024 and 1280 were not separately measured.** `RecordCard` contains no media
query and no internal breakpoint — it renders from props alone — so width only changes its
container. The nine widths above bracket that range; claiming ten distinct results would
overstate what was tested.

---

## 12. Other card modes (Step 13)

| Mode | Behaviour | Changed by this phase? |
|---|---|---|
| `loading` | actions render over the skeleton, in **both** modes | No — `button` mode already did this, because its gate never consulted `loading`. `row` now matches it. |
| `disabled` | card dims, the card's own toggle is disabled, the **caller's** action is not | No |
| `error` | error replaces the details; actions remain | No |
| `expanded` (controlled) | unchanged | No |

Whether a loading skeleton should carry live controls is a real question. It is
**pre-existing `button`-mode behaviour**, not something introduced here, so it was pinned
with a test and recorded rather than silently changed — see §14.

---

## 13. API / database impact

**None.** No endpoint, contract, schema, migration, seed, permission, approval rule,
notification, push, auth or routing change. No dependency added. This phase touched one
shared component and one test file.

---

## 14. Known limitations

1. **Actions render during `loading`** (§12). Consistent across both modes and pinned by a
   test, but arguably a skeleton should not offer live controls. Out of this phase's remit;
   flagged for a product decision.
2. **`disabled` does not disable the caller's actions.** Deliberate — they are the caller's
   nodes and the permission check that produced them lives there — but it is a sharp edge
   worth knowing.
3. **No accessibility scanner** (§9).
4. **`row` mode still has no production consumer**, so the fixed path remains exercised only
   by tests. The first real adopter should re-verify with real content.
5. **Row mode collapses to heading + action bar**, which is now taller than the two lines
   the mode was designed around. Correct for a card that has actions; worth looking at with
   real content when something adopts it.

---

## 15. Recommended next phase

**Phase 7B — project detail and board**, with the kanban-on-mobile question decided before
any conversion work starts. Carried forward unchanged from Phase 7A §32 and 7B-0 §16: it is
the largest remaining surface and the only one whose answer is a product decision rather
than a layout pass.

The 43 un-migrated action tables from Phase 7B-0 §8 remain the obvious mechanical sweep
whenever someone can verify those modules with a real session.
