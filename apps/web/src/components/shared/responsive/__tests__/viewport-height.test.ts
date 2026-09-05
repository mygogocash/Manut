import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * `max-h-[calc(100vh - Npx)]` sizes a panel by subtracting a fixed pixel
 * budget from the viewport. That budget is measured on a tall desktop window,
 * so on a short viewport it collapses.
 *
 * This repo has measured it: investor-pipeline-responsive.test.ts records a
 * column body at `max-h-[calc(100vh-360px)]` resolving to **15px** on a phone
 * in landscape (667x375). #1188 fixed that one instance; twenty others carried
 * the same pattern until this test.
 *
 * The fix is not to delete the calc — it is correct on desktop, where the
 * subtrahend genuinely reflects the chrome above the panel. It is to scope it
 * to `md` and up and give smaller viewports a proportional height.
 */

const SRC = resolve(__dirname, "../../../..");

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (entry.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

describe("viewport-subtraction heights do not collapse on short screens", () => {
  it("scopes every max-h-[calc(100vh-...)] to md and up", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      // The base dialog is exempt: it is viewport-positioned rather than a
      // panel inside page chrome, and its 2rem subtrahend is margin, not a
      // desktop-only header budget.
      if (file.endsWith("components/ui/dialog.tsx")) continue;

      for (const line of readFileSync(file, "utf8").split("\n")) {
        // A prefixed occurrence (md:, lg:) is the fix, not the defect.
        const bare = /(?<![\w:-])max-h-\[calc\(100vh-/.test(line);
        if (bare) {
          offenders.push(
            `${file.replace(SRC + "/", "")}: ${line.trim().slice(0, 90)}`,
          );
        }
      }
    }

    expect(
      offenders,
      "these collapse on a short viewport — scope the calc to `md:` and give " +
        `smaller screens a proportional height:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
