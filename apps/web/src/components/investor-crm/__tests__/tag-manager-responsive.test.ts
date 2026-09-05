import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * Tag management dialog — the measured defects, and why each assertion is
 * phrased the way it is. Mirrors investor-pipeline-responsive.test.ts.
 *
 * 1. WIDTH. `DialogContent`'s base class ends in `sm:max-w-sm` (384px) and the
 *    dialog passed a BARE `max-w-2xl`. At >=640px the variant beats the
 *    unprefixed utility, so the override was dead CSS. Worse, `cn()` is
 *    tailwind-merge and only dedupes within the same group AND variant, so
 *    both classes survived in the string — a "contains sm:max-w-" assertion
 *    matches the BASE and passes on the broken code. Same trap the pipeline
 *    file documents for `h-auto` vs `group-data-*:h-8`.
 *
 * 2. THE ROW ON A PHONE. One row carries badge 96 + code 112 + colour 104 +
 *    active 80 + delete 28 plus gaps ~= 630px. A 375px phone leaves ~311px of
 *    content inside this dialog (375 - 2rem margin - 2rem padding), so a
 *    single flex line overflowed horizontally. A plain `flex-wrap` is NOT
 *    sufficient: with the label input on its own line the remaining controls
 *    still measure ~452px on one line.
 */

const SRC = resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");

const DIALOG = "components/investor-crm/investor-tags-manager-dialog.tsx";

describe("the tag manager is not clamped to the base dialog width", () => {
  const source = read(DIALOG);

  it("overrides the width with the sm: variant, not a bare utility", () => {
    expect(
      /<DialogContent className="[^"]*\bsm:max-w-/.test(source),
      "DialogContent's base ends in `sm:max-w-sm`. A bare `max-w-*` loses to " +
        "it at >=640px and twMerge keeps both, so the override silently does " +
        "nothing and the 630px row sits behind a horizontal scrollbar.",
    ).toBe(true);
  });

  it("does not pass a bare max-w-* that the base would beat", () => {
    expect(
      /<DialogContent className="(?:(?!sm:)[^"])*\bmax-w-[^"]*"/.test(source),
      "found a `max-w-*` with no `sm:` prefix on DialogContent",
    ).toBe(false);
  });
});

describe("a tag row survives a phone", () => {
  const source = read(DIALOG);

  it("stacks the row below sm and flattens it from sm up", () => {
    expect(source).toMatch(/flex flex-col gap-2 py-3\s+sm:flex-row/);
  });

  it("groups the controls so the groups can stack independently", () => {
    /*
     * `sm:contents` dissolves each wrapper from sm up, so ONE markup tree
     * serves both layouts. Two groups: badge+label, then
     * code+colour+active+delete. Without them the row is either one 630px line
     * or one 452px line.
     *
     * Matched on each wrapper's own class string rather than by counting
     * `sm:contents` occurrences — the explanatory comment in the component
     * names the utility too, so a bare count reads 3 and fails on correct code.
     */
    expect(source, "missing the badge+label group wrapper").toMatch(
      /flex items-center gap-2\s+sm:contents/,
    );
    expect(
      source,
      "missing the code+colour+active+delete group wrapper",
    ).toMatch(/flex flex-wrap items-center gap-2\s+sm:contents/);
  });

  it("gives the code slug its own row on a phone", () => {
    // 112px of slug next to the 228px of controls does not fit 311px.
    expect(source).toMatch(/w-full truncate font-mono[\s\S]{0,120}?sm:w-28/);
  });

  it("lets the add-tag row wrap instead of crushing the name field", () => {
    expect(source).toMatch(/flex flex-wrap items-end gap-2/);
    expect(source).toMatch(/min-w-\[12rem\] flex-1/);
  });

  it("keeps the label input shrinkable inside its flex row", () => {
    // Without min-w-0 a flex child refuses to shrink below its content and
    // pushes the row wider than the dialog regardless of the wrapping above.
    expect(source).toMatch(/h-8 min-w-0 flex-1 text-xs/);
  });
});
