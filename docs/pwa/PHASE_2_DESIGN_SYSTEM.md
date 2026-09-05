# Phase 2 — Mobile Design System & Reusable Components

The shared component layer every later module builds on. No business module was converted.

References: [MOBILE_PWA_AUDIT.md](MOBILE_PWA_AUDIT.md) · [PHASE_1_RESPONSIVE_FOUNDATION.md](PHASE_1_RESPONSIVE_FOUNDATION.md) · Completed 2026-08-24

---

## ⚠ Standing deviations (unchanged from Phase 1)

**The mobile JSX prototype was still not supplied** — re-verified this phase; there are no `.jsx` files outside `node_modules` and nothing was attached. The brief did, however, name the prototype's **token vocabulary** (`background`, `surface`, `surface2`, `surface3`, `gold`, `bronze`, `green`, `red`, `amber`, `blue`, `violet`), and that was enough to do Step 2 properly: each name was mapped to this project's existing semantic token, and only the two with no equivalent were added. So the token work is grounded in the brief rather than guessed. Visual composition decisions (exact card density, mobile hierarchy per module) remain open.

**Typography: Playfair Display / Outfit were not adopted.** The app uses DM Sans / DM Serif Display / DM Mono. Step 4 says "preserve the existing brand/design language" and "reuse existing font implementation where possible", which conflicts with the named fonts. Existing fonts kept, consistent with the Phase 1 decision you approved. A font swap is a brand change affecting every page, and should be its own change with the brand owner's sign-off.

---

## 1. Design tokens

The existing token architecture was already strong — semantic status colours, a surface hierarchy, radius and shadow scales, all defined as HSL triples in `:root`, overridden in `.dark`, and exposed to Tailwind v4 through `@theme inline`. It was extended, not replaced.

### Prototype vocabulary → existing tokens

| Prototype | This project | Action |
| --- | --- | --- |
| `background` | `--background` | already existed |
| `surface` | `--surface` | already existed |
| `surface2` | `--surface-secondary` | already existed |
| **`surface3`** | `--surface-tertiary` | **added** |
| `gold` | `--primary-light` | already existed |
| `bronze` | `--primary` | already existed |
| `green` | `--success` | already existed |
| `red` | `--destructive` | already existed |
| `amber` | `--warning` | already existed |
| `blue` | `--info` | already existed |
| **`violet`** | `--violet` | **added** |

Nine of eleven were already present under this project's own semantic names. Duplicating them under prototype names would have created two vocabularies for one palette.

### Added

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| `--surface-tertiary` | `47 20% 95%` | `30 9% 21%` | A third elevation, for a panel nested inside a card |
| `--violet` / `--violet-foreground` | `262 42% 46%` | `262 60% 70%` | **Categorical**, not status — a chart series or phase label that must never read as an outcome |

Dark values are lifted rather than inverted, so a nested surface reads as *above* the card behind it in both themes.

### Layer scale

Z-index was previously per-component (`z-10` × 53, `z-50` × 23, one stray `z-[250]`), so "which of these sits on top" was answered by grepping. Named levels added as CSS variables plus utilities:

| Token | Value | Use |
| --- | --- | --- |
| `--z-sticky` | 10 | sticky table headers, in-page action bars |
| `--z-header` | 20 | the app topbar |
| `--z-overlay` | 50 | dialogs, sheets, drawers — matches Radix |
| `--z-toast` | 100 | must clear an open dialog |
| `--z-tooltip` | 150 | |

Existing usage is untouched; these are for new shared components.

## 2. Typography

No changes to the type stack. What the components standardise is *usage*, so the same role reads the same everywhere:

| Role | Treatment |
| --- | --- |
| Page title | `text-lg sm:text-xl font-semibold`, `text-balance` (`PageHeader`) |
| Card title | `text-sm font-semibold` (`DataCard`) |
| Record title | `text-sm font-medium` (`RecordCard`) |
| Section heading | `text-sm font-semibold` (`FormSection`) |
| Body | inherited, 15px base |
| Field label | `text-xs font-medium` (`FormFieldShell`) |
| Card field label | `text-[10px] uppercase tracking-wide` |
| Metadata / eyebrow | `text-[10px] uppercase` |
| Caption / helper | `text-xs text-muted-foreground` |
| Badge | `text-xs`, `text-[10px]` at `size="sm"` |
| Error | `text-xs text-destructive` |

Deliberately **not** a uniform down-scale: labels and metadata already sit at their floor, so mobile shrinks only the page title. **Text inputs go the other way** — `SearchInput` and `FileField` are `text-base` (16px) below `sm` and `text-sm` above, because anything under 16px makes iOS Safari zoom the viewport on focus.

## 3. Spacing

| Context | Mobile | ≥ `sm` |
| --- | --- | --- |
| Page padding (shell) | `px-4 py-4` | `px-6 py-5` |
| Section rhythm | `space-y-4` | `space-y-5` → `space-y-6` at `lg` |
| Card padding | `p-3` | `p-4` |
| Card header | `px-3 py-3` | `px-4` |
| Grid gap | `gap-3` | `gap-4` (`gap-6` for `lg`) |
| Field gap | `gap-3` | `gap-4` |
| Field internals | `space-y-1.5` | same |
| Action gap | `gap-1.5`–`gap-2` | same |
| List gap | `space-y-2.5` | same |

Compact but not cramped: 12px card padding on a phone against 16px on desktop, with touch targets carried by control height rather than by margins.

## 4. Responsive breakpoints

Unchanged from Phase 1 — `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536, matching Tailwind, asserted by a test. Mobile `< 640`, tablet `640–1023`, desktop `>= 1024`; the **shell, tables, dialogs and toasts switch at 768** (`isCompact`), preserving the pre-existing convention.

## 5. Card system

Two components, deliberately separate:

**`DataCard`** — a panel that holds content. Composes `ui/card.tsx` (which ~60 files already use) and adds the shape that was being hand-assembled per screen: `title`, `subtitle`, `meta`, `status`, `actions`, `footer`, `collapsible`, `loading`, `disabled`, `compact`.

**`RecordCard`** — a table row rendered for a phone. See §6.

Merging them would give one component two jobs and a confusing prop surface.

## 6. Expandable record pattern

`RecordCard`, extended this phase with what Step 7 specifies.

| Mode | Behaviour |
| --- | --- |
| `button` (default) | A "Show more" control under the fields. The card may separately be a tap target for navigation — how `DataTable`'s ~75 tables use it. |
| `row` | The header row **is** the toggle, with a rotating chevron. Fields join the detail, so a collapsed card stays two lines. |

The modes are mutually exclusive on purpose: a card-wide target with a nested toggle gives two overlapping hit areas, and on a phone the wrong one fires roughly half the time. When `expandMode="row"` and `onClick` are both passed, the row wins and the click is ignored — asserted by a test.

Also added: `loading` (skeleton, keeps height), `disabled` (dimmed, toggle disabled), `error` (replaces details with an `alert`), and controlled `expanded` / `onExpandedChange`.

Keyboard support comes from using a real `<button>` rather than a div with key handlers, so Enter, Space, focus ring and `aria-expanded` are the platform's.

## 7. Status badges

`StatusBadge` maps a raw status **string** to a semantic tone, and the tone to existing palette tokens. Previously each module picked its own colour, so "Approved" meant different things on different screens.

| Tone | Token | Statuses |
| --- | --- | --- |
| `success` | `--success` | approved, active, completed, paid, resolved, done, live, verified |
| `warning` | `--warning` | pending (+ variants), in review, escalated, awaiting information, partial |
| `info` | `--info` | pending development, in progress, submitted, processing |
| `danger` | `--destructive` | rejected, declined, cancelled, failed, overdue, expired, blocked |
| `neutral` | `--muted` | draft, new, inactive, archived, on hold, closed |
| `violet` | `--violet` | uat, staging, testing, planning — **categories, not outcomes** |
| `accent` | `--primary` | available for module-specific use |

Statuses normalise first (`pending_approval`, `Pending-Approval` and "Pending Approval" all resolve alike), unmapped statuses fall back to `neutral` and are title-cased rather than shown raw, and any module can override the tone or label. Adding a status here does not make it valid anywhere — this is presentation only.

## 8. Buttons

Audited: `ui/button.tsx` already provides 8 variants (`default`, `accent`, `outline`, `secondary`, `ghost`, `destructive`, `link`, `gradient`) and 8 sizes including four icon sizes. Nothing was missing except a loading state, so **the primitive was not touched** — 198+ call sites and `asChild` interplay make a new prop there risky.

`LoadingButton` composes it: keeps the label (so the button does not resize and the row does not jump), disables itself (so a submit cannot double-fire), and sets `aria-busy`.

Full-width is opt-in, not automatic — `StickyActionBar` makes its children full-width on mobile only, which is where it is right.

## 9. Action strips

From Phase 1, unchanged: `ResponsiveActions` demotes by priority (`primary` → `secondary` → `destructive`) with `splitActions` as the pure, tested rule; `ActionStrip` scrolls horizontally inside itself for chips and segmented controls.

**Demotion is never removal** — every action stays reachable in the overflow menu at every width, and a destructive action is never promoted to a bare button where a primary one sits at a wider breakpoint.

## 10. Tabs

From Phase 1, unchanged: `ResponsiveTabs` scrolls inside its own container (`allow-x-scroll` + `min-w-0`, so the page never scrolls), keeps triggers `shrink-0` so they never wrap, and scrolls the active tab into view with `block: "nearest"` so it only moves when actually off-screen. `aria-selected` and arrow-key navigation come from Radix `Tabs`.

## 11. Search

`SearchInput` — UI only, no fetching or query building.

Icon, clear button (only when there is something to clear), loading spinner that does not displace the layout, `Escape` to clear rather than blur (blurring loses the mobile keyboard), an accessible name that falls back to the placeholder, and the native `type=search` clear affordance suppressed so there are not two.

**Debounce is opt-in** (`debounceMs`, default 0). It is wrong by default: a submit-driven search should fire immediately, and a debounce on a client-side filter just makes typing feel broken.

## 12. Filters

Four components plus a hook, none of which know what is being filtered.

| Component | Role |
| --- | --- |
| `FilterChip` | A chip with `aria-pressed`, an optional value, and an independent clear |
| `FilterBar` | Search + scrollable chips + a Filters button with an applied count + Clear all |
| `FilterGroup` | One group; **native** radio/checkbox inputs, so grouping, position and state are announced without aria plumbing |
| `FilterSheet` | The groups in a bottom sheet with Reset / Apply |
| `useFilterDraft` | Editable copy, dirty flag, resynced on open |

The draft model is the important part on mobile: in a sheet, each tap must **not** re-run the query, or the list behind churns and the user cannot tell what they have selected. Abandoning a sheet discards the draft rather than leaking it into the next open.

## 13. Bottom sheets

`BottomSheet` — always a sheet, for panels that are the right shape at any width (filters, pickers, action lists). Built on `vaul` via `ui/drawer.tsx`, so focus trap, body-scroll lock, `Escape` and drag-to-dismiss come from a library that gets them right; hand-rolled sheets get the iOS scroll lock wrong almost every time.

Height caps use `svh`, not `vh`: on mobile Safari `vh` includes the retracted URL bar, so a `90vh` sheet is taller than the visible viewport and its footer sits below the fold. The body scrolls, not the sheet, so the title stays put and the footer stays reachable with a keyboard open. Footer uses `pb-safe-offset-4` to clear the home indicator.

## 14. Dialogs

Audited. `ui/dialog.tsx` (198 call sites) was **not** modified — making it shape-shift by width would convert all of them at once, and many (confirmations, small pickers) are perfectly usable as centred dialogs on a phone.

`ResponsiveDialog` (Phase 1) is the opt-in path: dialog `>= 768px`, bottom sheet below, with `mobileMode="dialog"` to stay centred. Long content scrolls inside the body (`max-h-[90vh]` / `max-h-[92svh]`), so actions stay reachable.

## 15. Forms

`ui/form.tsx` (react-hook-form + zodResolver, 104 call sites) and `ui/field.tsx` (a full `FieldSet`/`FieldLabel`/`FieldError`/`FieldDescription` set) already exist and remain the primary way to build a form. Duplicating either would split the codebase in two, so Phase 2 added only the gaps:

- **`FormFieldShell`** — label / control / description / error, stacked, with `required` announced to screen readers and errors carrying `role="alert"`. Stacked at every width on purpose: a label beside its input breaks at 320px, and `FormRow` already restores horizontal density on desktop.
- **`FileField`** — a label styled as a button wrapping a visually hidden input, so native keyboard and screen-reader behaviour survive. Carries the optional `capture` attribute, which is what makes photographing a receipt a two-tap operation. **Not set by default** — forcing the camera on a document upload is wrong.

Layout primitives from Phase 1 (`FormRow`, `FormSection`, `FormBody`) unchanged.

## 16. Sticky action bars

`StickyActionBar` from Phase 1, unchanged and deliberately generic — no module-specific labels. Sticky on mobile, static from `sm`; `pb-safe-offset-4` clears the home indicator; children full-width on mobile with the primary action under the thumb while tab order still reaches Cancel first (`flex-col-reverse`).

## 17. Loading states

| Component | Use |
| --- | --- |
| `StateView kind="loading"` | Generic varied-width bars |
| `CardSkeleton` | A `DataCard`-shaped panel |
| `ListSkeleton` | `RecordCard`-height rows, so the list does not jump |
| `PageSkeleton` | Header + KPI row + list |
| `LoadingButton` | In-place button progress |
| `InlineLoader` | The genuinely unknown-shape case only |
| `DataTable loading` | Existing table skeleton; now also card-shaped below 768px |

Rule: a skeleton where the shape is known, a spinner only where it is not. All carry `role="status"` and `aria-busy`.

## 18. Empty states

`StateView kind="empty"` — icon (overridable, or `null` for none), title, message, primary `action`, and a lower-emphasis `secondaryAction` kept distinct so the primary stays primary.

## 19. Error states

`StateView kind="error"` — `role="alert"`, a built-in **Try again** when `onRetry` is given, plus optional actions. Messages are caller-supplied plain language; no stack traces. `kind="permission-denied"` states the fact without explaining the permission model, and is never a substitute for the server check.

## 20. Toasts

Audited `ui/sonner.tsx`: icons, theme sync and class overrides were already correct; mobile placement was not. Changes:

| Aspect | Before | After |
| --- | --- | --- |
| Position | sonner default (bottom-right) at every width | `top-center` below 768px, `bottom-right` above |
| z-index | default | `var(--z-toast)` (100), above the overlay layer |
| Visible toasts | 3 | 2 on mobile, 3 above |
| Close button | off | off on mobile (swipe), on above |

Bottom placement on a phone lands on top of the sticky form action bar, so a success toast covered the Save button the user had just pressed. Desktop behaviour is unchanged. Sonner reads `position` once on mount, so a rotation keeps the initial choice — accepted, because the alternative drops any visible toast.

## 21. Accessibility

- Native semantics first: real `<button>`s for toggles, real radio/checkbox inputs in `FilterGroup`, `<dl>/<dt>/<dd>` for card fields, `<fieldset>/<legend>` for filter groups, `<label>` wrapping the file input.
- `aria-expanded` + `aria-controls` on every expander (`RecordCard`, `DataCard`); `aria-pressed` on filter chips; `aria-selected` from Radix `Tabs`.
- `role="status"` + `aria-busy` on loading; `role="alert"` on errors and validation messages; `aria-live="polite"` on `InlineLoader`.
- `aria-label` on every icon-only control (overflow trigger, clear search, chip clear, collapse).
- Visible `focus-visible` rings throughout; `aria-hidden` on decorative icons.
- Required fields announced as text, not just an asterisk.
- Touch targets: 36px controls, 44px minimum rows in `FilterGroup` (`min-h-11`).
- Pinch-zoom still enabled (WCAG 1.4.4).

**No automated a11y tooling exists in this repo** (no axe, jest-axe or Lighthouse CI) — the above is by construction and asserted through role-based queries in tests, not measured by a scanner. Adding one remains an open recommendation from the audit.

## 22. Keyboard behaviour

Desktop keyboard support is preserved: Radix owns dialog/sheet/tab focus management, all toggles are real buttons, `Escape` closes sheets and dialogs and clears the search field.

**Mobile keyboard items that need real-device verification in the Travel phase** — documented rather than guessed at:

1. Whether `position: sticky` action bars stay visible when the on-screen keyboard opens. iOS resizes the visual viewport but not the layout viewport; `interactiveWidget` in the viewport export may be needed.
2. Whether a focused input inside a bottom sheet scrolls into view above the keyboard on iOS.
3. Whether `svh` caps behave as expected with the keyboard open.
4. Textarea auto-grow versus a fixed height with internal scroll.
5. `inputMode` / `autocomplete` coverage across real form fields.

No iOS-specific workaround was added speculatively.

## 23. Components created

**New (7 files, 24 exports)**
```
status-badge.tsx   StatusBadge, statusTone, normalizeStatus, prettifyStatus, StatusTone
data-card.tsx      DataCard
search-input.tsx   SearchInput
filters.tsx        FilterChip, FilterBar, FilterGroup, FilterSheet, useFilterDraft, FilterOption
bottom-sheet.tsx   BottomSheet, BottomSheetClose
loading.tsx        LoadingButton, CardSkeleton, ListSkeleton, PageSkeleton, InlineLoader
form-field.tsx     FormFieldShell, FileField
```

## 24. Components modified

| File | Change | Desktop impact |
| --- | --- | --- |
| `globals.css` | `--surface-tertiary`, `--violet`(+fg) in both themes, `@theme` mappings, z-layer scale + utilities | None — additive tokens |
| `record-card.tsx` | `expandMode="row"`, `loading`, `disabled`, `error`, controlled expansion | None — defaults preserve Phase 1 behaviour |
| `state-view.tsx` | `icon` override, `secondaryAction` | None — additive |
| `ui/sonner.tsx` | Mobile position, z-index, visible count, close button | **None** — desktop keeps sonner's previous defaults |
| `responsive/index.ts` | Phase 2 exports | None |

`ui/button.tsx`, `ui/dialog.tsx`, `ui/card.tsx`, `ui/field.tsx`, `ui/form.tsx` and `shared/data-table.tsx` were **deliberately not modified** — each was audited and found sufficient, or too widely used to change safely for this phase's benefit.

## 25. Tests added

`__tests__/design-system.test.tsx` — **34 tests**: status normalisation and tone mapping (including the violet-is-not-an-outcome rule and neutral fallback), `RecordCard` expansion in both modes with the row-vs-click conflict, error/disabled/loading states, `DataCard` header and collapse, `SearchInput` immediate reporting / clear / Escape / accessible name, `FilterGroup` radio-vs-checkbox semantics and accumulate/remove, `FilterChip` pressed state, `LoadingButton` double-submit prevention, and `StateView` roles and dual actions.

Existing suites unchanged and passing, including the Phase 1 `DataTable` desktop-regression tests.

## 26. Known limitations

1. **Prototype absent** — visual composition per module remains open (§ deviations).
2. **No production consumer yet.** By design, but it means the components have been verified in a harness rather than in anger. The first real exercise is Phase 3.
3. **Visual verification used a temporary route** (`/design-preview`), created, measured, and **deleted** — it does not ship. Widths 390 and 1440 were not individually measured; they sit between verified points.
4. **No automated accessibility scanner** (§21).
5. **Mobile keyboard behaviour unverified on real devices** (§22) — five specific items listed.
6. **Playwright browsers still not installed locally**, so `e2e/responsive-overflow.spec.ts` (Phase 1) plus the four device projects remain **for CI**. Not run here; a ~130 MB download was not taken unprompted.
7. **`FilterSheet` is a sheet at every width.** Reasonable for a filter panel, but a desktop popover would be better on a wide screen. Deferred until a real module shows what is needed.
8. **`prettifyStatus` title-cases naively**, so an unmapped `pending_ceo_approval` renders "Pending Ceo Approval". Correct once mapped or given an explicit `label`; acronym handling was not worth guessing at.
9. **Toast position is fixed at mount**, so rotating a phone keeps the initial placement (§20).

---

## Definition of Done

| Item | Status |
| --- | --- |
| Design tokens centralised | Yes — extended existing architecture |
| Existing design system preserved | Yes — 9 of 11 prototype tokens mapped, not duplicated |
| Mobile UX follows prototype direction | **Partial** — token vocabulary followed; visual composition blocked on the prototype |
| Generic cards | `DataCard` |
| Expandable record | `RecordCard` with `expandMode` |
| Status badges | `StatusBadge` + semantic map |
| Button system consistent | Audited; `LoadingButton` added |
| Action strip | Phase 1, unchanged |
| Horizontal tabs | Phase 1, unchanged |
| Search | `SearchInput` |
| Filters | `FilterChip`/`Bar`/`Group`/`Sheet` + `useFilterDraft` |
| Bottom sheet | `BottomSheet` |
| Responsive dialogs | Phase 1 `ResponsiveDialog`; `ui/dialog` audited |
| Form primitives | `FormFieldShell`, `FileField` + Phase 1 layout |
| Sticky action bar | Phase 1, unchanged |
| Loading / empty / error states | `StateView` + 5 skeleton components |
| Toast feedback | Audited and fixed for mobile |
| Accessibility | By construction; no scanner available |
| Desktop preserved | Yes — every change additive or mobile-only |
| No horizontal overflow | Verified 320 / 375 / 430 / 768 / 1024 / 1920 |
| Type-check | 10/10 clean |
| Lint | 0 errors |
| Full suite | 2,317 passing |
| New tests | 34 passing |
| Documentation | This file |
