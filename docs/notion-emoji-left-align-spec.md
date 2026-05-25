# Notion-Style Page Emoji Left Alignment

## Requirement

The document emoji/icon shown above a page title must align to the same left
edge as the title text in page mode. The visual behavior should match Notion's
document header: the icon appears above the title and starts on the content
column's left edge, not centered or shifted inward by the trigger button.

## Data Model / Surface

- Surface: desktop page-detail editor in page mode.
- Layout source: `detail-page.css.ts` page-mode column variables.
- Icon trigger source: `doc-icon-picker.css.ts`.
- The editor column remains the current readable width contract:
  `--affine-editor-width: 760px` and `--affine-editor-side-padding: 40px`.

## Edge Cases

- Pages with a selected emoji or affine icon use the same alignment.
- Empty pages showing the "Add icon" placeholder keep their existing affordance.
- Narrow viewports keep the existing 24px compact page padding.
- Full-screen page mode keeps the same readable header alignment.

## Testing Strategy

- Add a focused Vitest guard that asserts the page-mode icon/title header uses
  a shared side-padding style.
- Add a focused guard that asserts the icon trigger itself is left-anchored, so
  the glyph is not visually shifted right by button centering or padding.
- Run the focused Vitest file, formatting/lint checks for touched files, and the
  web bundle.

## Task

- Intended behavior: document emoji aligns with the title text's left edge in a
  Notion-style page header.
- Test names:
  - `page detail layout > given page-mode document icon > then icon and title share the same left edge contract`
  - `page detail layout > given page icon trigger > then emoji glyph is left anchored like Notion`
- Affected files:
  - `packages/frontend/core/src/desktop/pages/workspace/detail-page/detail-page.css.ts`
  - `packages/frontend/core/src/desktop/pages/workspace/detail-page/detail-page-layout.spec.ts`
  - `packages/frontend/core/src/blocksuite/block-suite-editor/doc-icon-picker.css.ts`
- Risk tier: R2, scoped CSS alignment change.
- Rollback: revert this commit to restore the previous centered trigger behavior.
